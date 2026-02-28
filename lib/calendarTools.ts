import { google, calendar_v3 } from "googleapis";
import type OpenAI from "openai";

// ---------------------------------------------------------------------------
// Tool definitions (passed to OpenAI)
// ---------------------------------------------------------------------------

export const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_events",
      description:
        "Fetch calendar events (with their IDs, titles, and times) for a date range. " +
        "Always call this before update_calendar_event or delete_calendar_event so you have the correct event_id.",
      parameters: {
        type: "object",
        properties: {
          start_date: {
            type: "string",
            description: "Start of range, YYYY-MM-DD.",
          },
          end_date: {
            type: "string",
            description: "End of range, YYYY-MM-DD (inclusive).",
          },
        },
        required: ["start_date", "end_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_calendar_event",
      description: "Create a new event on the user's primary Google Calendar.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Event title." },
          start_datetime: {
            type: "string",
            description:
              "Start time in YYYY-MM-DDTHH:MM:SS (local time, no timezone suffix).",
          },
          end_datetime: {
            type: "string",
            description:
              "End time in YYYY-MM-DDTHH:MM:SS (local time, no timezone suffix).",
          },
          description: {
            type: "string",
            description: "Optional event description or notes.",
          },
          location: { type: "string", description: "Optional location." },
        },
        required: ["summary", "start_datetime", "end_datetime"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_calendar_event",
      description:
        "Update fields on an existing calendar event. Requires event_id — call get_events first if you don't have it. " +
        "Only the fields you provide will be changed.",
      parameters: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "ID of the event to update.",
          },
          summary: { type: "string", description: "New event title." },
          start_datetime: {
            type: "string",
            description: "New start time, YYYY-MM-DDTHH:MM:SS (local time).",
          },
          end_datetime: {
            type: "string",
            description: "New end time, YYYY-MM-DDTHH:MM:SS (local time).",
          },
          description: { type: "string", description: "New description." },
          location: { type: "string", description: "New location." },
        },
        required: ["event_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_calendar_event",
      description:
        "Permanently delete a calendar event. Requires event_id — call get_events first if you don't have it. " +
        "Only call this after the user has explicitly confirmed the deletion.",
      parameters: {
        type: "object",
        properties: {
          event_id: {
            type: "string",
            description: "ID of the event to delete.",
          },
        },
        required: ["event_id"],
      },
    },
  },
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
            description:
              "Start of the search window, YYYY-MM-DD (e.g. '2026-02-27').",
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
  accessToken: string | null,
): Promise<unknown> {
  // Narrow the union — custom tool calls don't have .function
  if (toolCall.type !== "function") {
    return { error: "Unsupported tool type" };
  }

  const { name, arguments: rawArgs } = toolCall.function;
  const args = JSON.parse(rawArgs) as Record<string, unknown>;

  if (!accessToken) {
    return {
      error:
        "User is not signed in with Google. Cannot access Google services.",
    };
  }

  switch (name) {
    case "get_events":
      return getEvents(
        accessToken,
        args.start_date as string,
        args.end_date as string,
      );

    case "create_calendar_event":
      return createCalendarEvent(
        accessToken,
        args.summary as string,
        args.start_datetime as string,
        args.end_datetime as string,
        args.description as string | undefined,
        args.location as string | undefined,
      );

    case "update_calendar_event":
      return updateCalendarEvent(accessToken, args.event_id as string, {
        summary: args.summary as string | undefined,
        start_datetime: args.start_datetime as string | undefined,
        end_datetime: args.end_datetime as string | undefined,
        description: args.description as string | undefined,
        location: args.location as string | undefined,
      });

    case "delete_calendar_event":
      return deleteCalendarEvent(accessToken, args.event_id as string);

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
  durationMinutes: number,
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
  const slots = computeFreeSlots(
    events,
    startDateStr,
    endDateStr,
    durationMinutes,
  );
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
  durationMinutes: number,
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
          const gapMinutes =
            (blockStart.getTime() - freeFrom.getTime()) / 60_000;
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
// get_events implementation
// ---------------------------------------------------------------------------

async function getEvents(
  accessToken: string,
  startDateStr: string,
  endDateStr: string,
) {
  const calApi = google.calendar({
    version: "v3",
    auth: makeOAuthClient(accessToken),
  });

  const res = await calApi.events.list({
    calendarId: "primary",
    timeMin: new Date(`${startDateStr}T00:00:00`).toISOString(),
    timeMax: new Date(`${endDateStr}T23:59:59`).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 50,
  });

  return (res.data.items ?? []).map((e) => ({
    event_id: e.id,
    summary: e.summary ?? "(No title)",
    start: e.start?.dateTime ?? e.start?.date,
    end: e.end?.dateTime ?? e.end?.date,
    location: e.location,
    description: e.description,
  }));
}

// ---------------------------------------------------------------------------
// Datetime normalizer
// ---------------------------------------------------------------------------

// Converts any datetime string the LLM might produce into a full RFC 3339
// string with the server's UTC offset embedded (e.g. 2026-03-01T09:00:00-08:00).
// This is unambiguous to Google Calendar and requires no separate timeZone field.
function toRFC3339WithOffset(dt: string): string {
  // Strip any existing timezone suffix so we can re-attach the correct one
  const clean = dt.replace(/(Z|[+-]\d{2}:?\d{2})$/, "");
  // Pad HH:MM → HH:MM:SS if seconds are missing
  const withSecs = /T\d{2}:\d{2}$/.test(clean) ? `${clean}:00` : clean;
  // Parse as local time — Node.js treats YYYY-MM-DDTHH:MM:SS (no suffix) as local
  const date = new Date(withSecs);
  // getTimezoneOffset() = minutes to add to local to get UTC, so negate for the offset
  const offsetMin = -date.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const hh = String(Math.floor(absMin / 60)).padStart(2, "0");
  const mm = String(absMin % 60).padStart(2, "0");
  return `${withSecs}${sign}${hh}:${mm}`;
}

// ---------------------------------------------------------------------------
// create_calendar_event implementation
// ---------------------------------------------------------------------------

async function createCalendarEvent(
  accessToken: string,
  summary: string,
  startDatetime: string,
  endDatetime: string,
  description?: string,
  location?: string,
) {
  const calApi = google.calendar({
    version: "v3",
    auth: makeOAuthClient(accessToken),
  });

  const requestBody: calendar_v3.Schema$Event = {
    summary,
    start: { dateTime: toRFC3339WithOffset(startDatetime) },
    end: { dateTime: toRFC3339WithOffset(endDatetime) },
  };
  if (description) requestBody.description = description;
  if (location) requestBody.location = location;

  try {
    const res = await calApi.events.insert({
      calendarId: "primary",
      requestBody,
    });
    return {
      success: true,
      event_id: res.data.id,
      summary: res.data.summary,
      start: res.data.start?.dateTime ?? res.data.start?.date,
      end: res.data.end?.dateTime ?? res.data.end?.date,
    };
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: unknown } }).response?.data;
    console.error(
      "create_calendar_event error:",
      JSON.stringify(detail ?? err),
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// update_calendar_event implementation
// ---------------------------------------------------------------------------

interface EventUpdates {
  summary?: string;
  start_datetime?: string;
  end_datetime?: string;
  description?: string;
  location?: string;
}

async function updateCalendarEvent(
  accessToken: string,
  eventId: string,
  updates: EventUpdates,
) {
  const calApi = google.calendar({
    version: "v3",
    auth: makeOAuthClient(accessToken),
  });

  const patch: calendar_v3.Schema$Event = {};
  if (updates.summary !== undefined) patch.summary = updates.summary;
  if (updates.description !== undefined)
    patch.description = updates.description;
  if (updates.location !== undefined) patch.location = updates.location;
  if (updates.start_datetime !== undefined)
    patch.start = { dateTime: toRFC3339WithOffset(updates.start_datetime) };
  if (updates.end_datetime !== undefined)
    patch.end = { dateTime: toRFC3339WithOffset(updates.end_datetime) };

  try {
    const res = await calApi.events.patch({
      calendarId: "primary",
      eventId,
      requestBody: patch,
    });
    return {
      success: true,
      event_id: res.data.id,
      summary: res.data.summary,
      start: res.data.start?.dateTime ?? res.data.start?.date,
      end: res.data.end?.dateTime ?? res.data.end?.date,
    };
  } catch (err: unknown) {
    const detail = (err as { response?: { data?: unknown } }).response?.data;
    console.error(
      "update_calendar_event error:",
      JSON.stringify(detail ?? err),
    );
    throw err;
  }
}

// ---------------------------------------------------------------------------
// delete_calendar_event implementation
// ---------------------------------------------------------------------------

async function deleteCalendarEvent(accessToken: string, eventId: string) {
  const calApi = google.calendar({
    version: "v3",
    auth: makeOAuthClient(accessToken),
  });
  await calApi.events.delete({ calendarId: "primary", eventId });
  return { success: true };
}

// ---------------------------------------------------------------------------
// Shared helper
// ---------------------------------------------------------------------------

function makeOAuthClient(accessToken: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ access_token: accessToken });
  return client;
}
