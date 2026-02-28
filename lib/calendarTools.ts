import { google, calendar_v3 } from "googleapis";
import type OpenAI from "openai";

// ---------------------------------------------------------------------------
// Tool definitions (passed to OpenAI)
// ---------------------------------------------------------------------------

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_free_slots",
      description:
        "Find available (free) time slots in the user's Google Calendar for a given date range. " +
        "Use this whenever the user wants to find time to schedule something, check their availability, " +
        "or figure out when they are free. Working hours are 9 AM – 6 PM, Mon–Fri.",
      parameters: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description: "Start of the search window, YYYY-MM-DD (e.g. '2026-02-27').",
          },
          end_date: {
            type: "string",
            description: "End of the search window, YYYY-MM-DD (inclusive).",
          },
          duration_minutes: {
            type: "number",
            description:
              "Desired slot length in minutes. Defaults to 30 if the user didn't specify.",
          },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Tool dispatcher
// ---------------------------------------------------------------------------

export async function executeTool(
  toolCall: OpenAI.Chat.ChatCompletionMessageToolCall,
  accessToken: string | null
): Promise<unknown> {
  // Narrow the union — custom tool calls don't have .function
  if (toolCall.type !== "function") {
    return { error: "Unsupported tool type" };
  }

  const { name, arguments: rawArgs } = toolCall.function;
  const args = JSON.parse(rawArgs) as Record<string, unknown>;

  if (!accessToken) {
    return { error: "User is not signed in with Google. Cannot access Google services." };
  }

  switch (name) {
    case "get_free_slots": {
      const startDate = args.start_date as string;
      const endDate = args.end_date as string;
      const duration = (args.duration_minutes as number | undefined) ?? 30;
      return getFreeSlots(accessToken, startDate, endDate, duration);
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ---------------------------------------------------------------------------
// get_free_slots implementation
// ---------------------------------------------------------------------------

const WORK_START_HOUR = 9;
const WORK_END_HOUR = 18;
const MAX_SLOTS_RETURNED = 30;

interface FreeSlot {
  start: string;
  end: string;
  available_minutes: number;
}

async function getFreeSlots(
  accessToken: string,
  startDateStr: string,
  endDateStr: string,
  durationMinutes: number
) {
  const oauth2Client = makeOAuthClient(accessToken);
  const calApi = google.calendar({ version: "v3", auth: oauth2Client });

  const timeMin = new Date(`${startDateStr}T00:00:00`).toISOString();
  const timeMax = new Date(`${endDateStr}T23:59:59`).toISOString();

  const res = await calApi.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  const events = res.data.items ?? [];
  const slots = computeFreeSlots(events, startDateStr, endDateStr, durationMinutes);
  const capped = slots.slice(0, MAX_SLOTS_RETURNED);

  return {
    duration_requested_minutes: durationMinutes,
    search_window: { start: startDateStr, end: endDateStr },
    total_free_slots_found: slots.length,
    slots_returned: capped.length,
    note:
      slots.length > MAX_SLOTS_RETURNED
        ? `Only the first ${MAX_SLOTS_RETURNED} of ${slots.length} slots are shown.`
        : undefined,
    slots: capped,
  };
}

// Returns a YYYY-MM-DD string in local time (avoids UTC offset shifting the date)
function toLocalDateStr(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function computeFreeSlots(
  events: calendar_v3.Schema$Event[],
  startDateStr: string,
  endDateStr: string,
  durationMinutes: number
): FreeSlot[] {
  const slots: FreeSlot[] = [];
  const startDay = new Date(`${startDateStr}T00:00:00`);
  const endDay = new Date(`${endDateStr}T00:00:00`);

  const current = new Date(startDay);
  while (current <= endDay) {
    const workStart = new Date(current);
    workStart.setHours(WORK_START_HOUR, 0, 0, 0);
    const workEnd = new Date(current);
    workEnd.setHours(WORK_END_HOUR, 0, 0, 0);

    // Use local date string to correctly match all-day events (avoids UTC offset shifting the day)
    const dateStr = toLocalDateStr(current);
    const hasAllDayBlock = events.some((e) => e.start?.date === dateStr);

    if (!hasAllDayBlock) {
      const dayEvents = events
        .filter((e) => {
          if (!e.start?.dateTime) return false;
          const evStart = new Date(e.start.dateTime);
          const evEnd = new Date(e.end?.dateTime ?? e.start.dateTime);
          return evStart < workEnd && evEnd > workStart;
        })
        .map((e) => ({
          start: new Date(e.start!.dateTime!),
          end: new Date(e.end?.dateTime ?? e.start!.dateTime!),
        }))
        .sort((a, b) => a.start.getTime() - b.start.getTime());

      let freeFrom = workStart;

      for (const event of dayEvents) {
        const blockStart = event.start < workStart ? workStart : event.start;
        const blockEnd = event.end > workEnd ? workEnd : event.end;

        if (blockStart > freeFrom) {
          const gapMinutes = (blockStart.getTime() - freeFrom.getTime()) / 60_000;
          if (gapMinutes >= durationMinutes) {
            slots.push({
              start: freeFrom.toISOString(),
              end: blockStart.toISOString(),
              available_minutes: Math.floor(gapMinutes),
            });
          }
        }

        if (blockEnd > freeFrom) freeFrom = blockEnd;
      }

      if (freeFrom < workEnd) {
        const gapMinutes = (workEnd.getTime() - freeFrom.getTime()) / 60_000;
        if (gapMinutes >= durationMinutes) {
          slots.push({
            start: freeFrom.toISOString(),
            end: workEnd.toISOString(),
            available_minutes: Math.floor(gapMinutes),
          });
        }
      }
    }

    current.setDate(current.getDate() + 1);
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function makeOAuthClient(accessToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  client.setCredentials({ access_token: accessToken });
  return client;
}
