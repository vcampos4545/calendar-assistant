import { calendar_v3, google } from "googleapis";
import type OpenAI from "openai";
import { makeGoogleAuth } from "./googleAuth";

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
          timezone: {
            type: "string",
            description:
              "IANA timezone identifier (e.g. 'America/New_York'). Always pass this — the system prompt provides the user's timezone.",
          },
        },
        required: ["start_date", "end_date", "timezone"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_flights",
      description:
        "Search for available one-way or round-trip flights between two airports or cities. " +
        "Returns up to 5 options with airline, departure/arrival times, duration, stops, price, " +
        "and a Kayak booking link. Pass IATA airport codes when known (e.g. 'JFK', 'NRT'); " +
        "pass a city name otherwise and the tool will resolve it.",
      parameters: {
        type: "object",
        properties: {
          origin: {
            type: "string",
            description:
              "Departure airport IATA code or city name (e.g. 'SFO' or 'San Francisco').",
          },
          destination: {
            type: "string",
            description:
              "Arrival airport IATA code or city name (e.g. 'NRT' or 'Tokyo').",
          },
          departure_date: {
            type: "string",
            description: "Outbound departure date, YYYY-MM-DD.",
          },
          return_date: {
            type: "string",
            description:
              "Return date for round trips, YYYY-MM-DD. Omit for one-way.",
          },
          adults: {
            type: "number",
            description: "Number of adult passengers. Defaults to 1.",
          },
          currency: {
            type: "string",
            description: "Currency code, e.g. 'USD'. Defaults to 'USD'.",
          },
        },
        required: ["origin", "destination", "departure_date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "prepare_email_draft",
      description:
        "Prepare an email draft for the user to review. " +
        "Call this after writing an email draft in your response — it will display a 'Save to Gmail Drafts' button in the UI so the user can save it with one click. " +
        "Does not send or save anything automatically.",
      parameters: {
        type: "object",
        properties: {
          to: {
            type: "string",
            description:
              "Recipient email address or display name (e.g. 'joe@company.com' or 'Joe Smith <joe@company.com>'). Omit if unknown.",
          },
          subject: {
            type: "string",
            description: "Email subject line.",
          },
          body: {
            type: "string",
            description: "Full plain-text email body.",
          },
        },
        required: ["subject", "body"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_weather_forecast",
      description:
        "Get a daily weather forecast for a destination city over a date range. " +
        "Returns conditions, high/low temperatures, precipitation, and a packing list. " +
        "Call this when the user asks what to expect weather-wise or what to pack for a trip.",
      parameters: {
        type: "object",
        properties: {
          city: {
            type: "string",
            description:
              "Destination city name, e.g. 'Tokyo' or 'Paris, France'.",
          },
          start_date: {
            type: "string",
            description: "First day of the trip, YYYY-MM-DD.",
          },
          end_date: {
            type: "string",
            description: "Last day of the trip, YYYY-MM-DD.",
          },
        },
        required: ["city", "start_date", "end_date"],
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

  // Calendar tools require Google sign-in; travel tools do not
  const CALENDAR_TOOLS = new Set([
    "get_events",
    "create_calendar_event",
    "update_calendar_event",
    "delete_calendar_event",
    "get_free_slots",
    // prepare_email_draft intentionally omitted — it needs no Google auth
  ]);

  if (!accessToken && CALENDAR_TOOLS.has(name)) {
    return {
      error:
        "User is not signed in with Google. Cannot access Google Calendar.",
    };
  }

  try {
    switch (name) {
      case "get_events":
        return getEvents(
          accessToken!,
          args.start_date as string,
          args.end_date as string,
        );

      case "create_calendar_event":
        return createCalendarEvent(
          accessToken!,
          args.summary as string,
          args.start_datetime as string,
          args.end_datetime as string,
          args.description as string | undefined,
          args.location as string | undefined,
        );

      case "update_calendar_event":
        return updateCalendarEvent(accessToken!, args.event_id as string, {
          summary: args.summary as string | undefined,
          start_datetime: args.start_datetime as string | undefined,
          end_datetime: args.end_datetime as string | undefined,
          description: args.description as string | undefined,
          location: args.location as string | undefined,
        });

      case "delete_calendar_event":
        return deleteCalendarEvent(accessToken!, args.event_id as string);

      case "get_free_slots": {
        const startDate = args.start_date as string;
        const endDate = args.end_date as string;
        const duration = (args.duration_minutes as number | undefined) ?? 30;
        const timezone = (args.timezone as string | undefined) ?? "UTC";
        return getFreeSlots(accessToken!, startDate, endDate, duration, timezone);
      }

      case "prepare_email_draft":
        return prepareEmailDraft(
          args.to as string | undefined,
          args.subject as string,
          args.body as string,
        );

      case "search_flights":
        return searchFlights(
          args.origin as string,
          args.destination as string,
          args.departure_date as string,
          args.return_date as string | undefined,
          (args.adults as number | undefined) ?? 1,
          (args.currency as string | undefined) ?? "USD",
        );

      case "get_weather_forecast":
        return getWeatherForecast(
          args.city as string,
          args.start_date as string,
          args.end_date as string,
        );

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Tool "${name}" threw:`, message);
    return { error: message };
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
  timezone: string,
) {
  console.log("getFreeSlots()", startDateStr, endDateStr, timezone);
  const oauth2Client = makeGoogleAuth(accessToken);
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
    timezone,
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

// Returns the UTC offset in minutes for the given IANA timezone at the given instant.
// e.g. tzOffsetMin("America/New_York", date) in winter → -300
function tzOffsetMin(timezone: string, date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  // hour12:false can return "24" for midnight — normalise to 0
  const localAsUtcMs = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour") % 24,
    get("minute"),
    get("second"),
  );
  return (localAsUtcMs - date.getTime()) / 60_000;
}

// Returns a UTC Date representing `hour:00` on `dateStr` in `timezone`.
// Uses noon UTC as the reference point to safely straddle DST boundaries.
function dateAtHourInTZ(dateStr: string, hour: number, timezone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const offsetMin = tzOffsetMin(timezone, noonUtc);
  // utc_ms = local_ms - offset  (local "hour:00" expressed as if it were UTC, minus offset)
  return new Date(Date.UTC(year, month - 1, day, hour, 0, 0) - offsetMin * 60_000);
}

// Increments a YYYY-MM-DD string by `days` days (UTC-safe, no server-timezone dependence).
function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + days));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

// Formats a Date as an ISO 8601 string in the given IANA timezone
// (e.g. "2026-03-01T09:00:00-05:00"). The LLM can read the hour directly.
function toTZISOString(date: Date, timezone: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) =>
    parseInt(parts.find((p) => p.type === t)?.value ?? "0");
  const h = get("hour") % 24;
  const offsetMin = tzOffsetMin(timezone, date);
  const sign = offsetMin >= 0 ? "+" : "-";
  const absOff = Math.abs(Math.round(offsetMin));
  return (
    `${get("year")}-${pad(get("month"))}-${pad(get("day"))}` +
    `T${pad(h)}:${pad(get("minute"))}:${pad(get("second"))}` +
    `${sign}${pad(Math.floor(absOff / 60))}:${pad(absOff % 60)}`
  );
}

function computeFreeSlots(
  events: calendar_v3.Schema$Event[],
  startDateStr: string,
  endDateStr: string,
  durationMinutes: number,
  timezone: string,
): FreeSlot[] {
  const slots: FreeSlot[] = [];

  let dateStr = startDateStr;
  while (dateStr <= endDateStr) {
    const workStart = dateAtHourInTZ(dateStr, WORK_START_HOUR, timezone);
    const workEnd = dateAtHourInTZ(dateStr, WORK_END_HOUR, timezone);

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
              start: toTZISOString(freeFrom, timezone),
              end: toTZISOString(blockStart, timezone),
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
            start: toTZISOString(freeFrom, timezone),
            end: toTZISOString(workEnd, timezone),
            available_minutes: Math.floor(gapMinutes),
          });
        }
      }
    }

    dateStr = addDays(dateStr, 1);
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
    auth: makeGoogleAuth(accessToken),
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
  if (isNaN(date.getTime())) throw new Error(`Invalid datetime: "${dt}"`);
  // Detect JS silently rolling over invalid dates (e.g. Feb 29 in a non-leap year)
  const [datePart] = withSecs.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  if (
    date.getFullYear() !== y ||
    date.getMonth() + 1 !== m ||
    date.getDate() !== d
  ) {
    throw new Error(
      `"${datePart}" is not a valid calendar date. Please use an existing date.`,
    );
  }
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
    auth: makeGoogleAuth(accessToken),
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
    auth: makeGoogleAuth(accessToken),
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
    auth: makeGoogleAuth(accessToken),
  });
  await calApi.events.delete({ calendarId: "primary", eventId });
  return { success: true };
}

// ---------------------------------------------------------------------------
// prepare_email_draft implementation
// ---------------------------------------------------------------------------

// Does not call any API — simply returns the structured draft data so the
// route can surface it via the X-Draft-Data header and the UI can render
// a "Save to Gmail Drafts" button for the user to confirm.
function prepareEmailDraft(
  to: string | undefined,
  subject: string,
  body: string,
) {
  return {
    prepared: true,
    to: to ?? null,
    subject,
    body,
    note: "A 'Save to Gmail Drafts' button will appear in the chat for the user to confirm.",
  };
}

// ---------------------------------------------------------------------------
// search_flights implementation
// ---------------------------------------------------------------------------

// Module-level Amadeus token cache (valid for process lifetime)
interface AmadeusTokenCache {
  token: string;
  expiresAt: number; // unix ms
}
let amadeusTokenCache: AmadeusTokenCache | null = null;

async function getAmadeusToken(): Promise<string> {
  const key = process.env.AMADEUS_API_KEY;
  const secret = process.env.AMADEUS_API_SECRET;
  if (!key || !secret) {
    throw new Error(
      "Amadeus API credentials are not configured (AMADEUS_API_KEY / AMADEUS_API_SECRET).",
    );
  }

  // Return cached token if still valid (60s buffer)
  if (amadeusTokenCache && amadeusTokenCache.expiresAt - 60_000 > Date.now()) {
    return amadeusTokenCache.token;
  }

  const res = await fetch(
    "https://test.api.amadeus.com/v1/security/oauth2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: key,
        client_secret: secret,
      }),
    },
  );
  if (!res.ok) throw new Error("Amadeus authentication failed.");
  const data = await res.json();
  amadeusTokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return amadeusTokenCache.token;
}

// Resolve a city name to an IATA code using Amadeus Airport Search
async function resolveIata(token: string, query: string): Promise<string> {
  // Already an IATA code — 2-3 uppercase letters
  if (/^[A-Z]{2,3}$/.test(query)) return query;

  const params = new URLSearchParams({
    keyword: query,
    subType: "AIRPORT,CITY",
    "page[limit]": "1",
  });
  const res = await fetch(
    `https://test.api.amadeus.com/v1/reference-data/locations?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const data = await res.json();
  const code = data.data?.[0]?.iataCode;
  if (!code) {
    throw new Error(`Could not find an airport for "${query}".`);
  }
  return code as string;
}

// Convert Amadeus ISO 8601 duration (PT14H30M) to human-readable string
function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return iso;
  const parts: string[] = [];
  if (match[1]) parts.push(`${match[1]}h`);
  if (match[2]) parts.push(`${match[2]}m`);
  return parts.join(" ") || iso;
}

// Known carrier names for display
const CARRIER_NAMES: Record<string, string> = {
  AA: "American Airlines",
  DL: "Delta",
  UA: "United",
  WN: "Southwest",
  B6: "JetBlue",
  AS: "Alaska Airlines",
  F9: "Frontier",
  NK: "Spirit",
  G4: "Allegiant",
  BA: "British Airways",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM",
  EK: "Emirates",
  QR: "Qatar Airways",
  SQ: "Singapore Airlines",
  CX: "Cathay Pacific",
  NH: "ANA",
  JL: "Japan Airlines",
  AC: "Air Canada",
  VS: "Virgin Atlantic",
};

function buildKayakLink(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
  adults = 1,
): string {
  const trip = returnDate
    ? `${origin}-${destination}/${departureDate}/${returnDate}`
    : `${origin}-${destination}/${departureDate}`;
  return `https://www.kayak.com/flights/${trip}/${adults}adults`;
}

async function searchFlights(
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string,
  adults = 1,
  currency = "USD",
) {
  const token = await getAmadeusToken();

  // Resolve city names → IATA codes
  const [originCode, destCode] = await Promise.all([
    resolveIata(token, origin.trim().toUpperCase()),
    resolveIata(token, destination.trim().toUpperCase()),
  ]);

  const params = new URLSearchParams({
    originLocationCode: originCode,
    destinationLocationCode: destCode,
    departureDate,
    adults: String(adults),
    currencyCode: currency,
    max: "5",
  });
  if (returnDate) params.set("returnDate", returnDate);

  const res = await fetch(
    `https://test.api.amadeus.com/v2/shopping/flight-offers?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!res.ok) {
    const err = await res.json();
    const detail = err.errors?.[0]?.detail ?? "Unknown Amadeus error";
    return { error: `Flight search failed: ${detail}` };
  }

  const data = await res.json();
  if (!data.data?.length) {
    return {
      flights: [],
      message: "No flights found for this route and date combination.",
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const flights = data.data.slice(0, 5).map((offer: any) => {
    const price = `${parseFloat(offer.price.grandTotal).toFixed(2)} ${offer.price.currency}`;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formatItinerary = (itin: any) => {
      const segs = itin.segments;
      const first = segs[0];
      const last = segs[segs.length - 1];
      const carrierCode: string = first.carrierCode;
      return {
        airline: CARRIER_NAMES[carrierCode] ?? carrierCode,
        carrier_code: carrierCode,
        departs: `${first.departure.iataCode} ${first.departure.at}`,
        arrives: `${last.arrival.iataCode} ${last.arrival.at}`,
        duration: formatDuration(itin.duration as string),
        stops: segs.length - 1,
      };
    };

    return {
      price,
      outbound: formatItinerary(offer.itineraries[0]),
      ...(offer.itineraries[1]
        ? { return: formatItinerary(offer.itineraries[1]) }
        : {}),
      booking_link: buildKayakLink(
        originCode,
        destCode,
        departureDate,
        returnDate,
        adults,
      ),
    };
  });

  return {
    origin: originCode,
    destination: destCode,
    departure_date: departureDate,
    return_date: returnDate,
    adults,
    currency,
    flights,
    search_link: buildKayakLink(
      originCode,
      destCode,
      departureDate,
      returnDate,
      adults,
    ),
  };
}

// ---------------------------------------------------------------------------
// get_weather_forecast implementation
// ---------------------------------------------------------------------------

const WMO_CONDITIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Light rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Light snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Light showers",
  81: "Moderate showers",
  82: "Heavy showers",
  85: "Light snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with hail",
  99: "Thunderstorm with heavy hail",
};

function buildPackingList(
  forecast: Array<{
    high_f: number;
    low_f: number;
    precipitation_in: number;
    weathercode: number;
  }>,
): string[] {
  const packing = new Set<string>();

  const maxHigh = Math.max(...forecast.map((d) => d.high_f));
  const minLow = Math.min(...forecast.map((d) => d.low_f));
  const hasRain = forecast.some((d) => d.precipitation_in > 0.05);
  const hasSnow = forecast.some(
    (d) => d.weathercode >= 71 && d.weathercode <= 77,
  );
  const hasThunder = forecast.some((d) => d.weathercode >= 95);

  // Temperature-based layers
  if (maxHigh >= 85) {
    packing.add("Shorts and t-shirts");
    packing.add("Sunscreen and sunglasses");
    packing.add("Hat or cap");
  }
  if (minLow < 45) {
    packing.add("Warm jacket or heavy coat");
    packing.add("Thermal layers");
    packing.add("Gloves and scarf");
  }
  if (minLow < 32) {
    packing.add("Heavy winter boots");
    packing.add("Wool socks");
  }
  if (maxHigh >= 50 && minLow >= 32 && maxHigh < 85) {
    packing.add("Light jacket or layers for variable temps");
  }

  // Precipitation
  if (hasRain || hasThunder) {
    packing.add("Umbrella or compact rain jacket");
    packing.add("Waterproof shoes or extra dry socks");
  }
  if (hasSnow) {
    packing.add("Snow boots");
    packing.add("Extra warm socks");
  }

  // Always
  packing.add("Comfortable walking shoes");
  packing.add("Phone charger and power bank");
  packing.add("Travel adapter (if international)");
  packing.add("Any medications and toiletries");

  return Array.from(packing);
}

async function getWeatherForecast(
  city: string,
  startDate: string,
  endDate: string,
) {
  // Step 1: Geocode the city
  const geoRes = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  const geoData = await geoRes.json();

  if (!geoData.results?.length) {
    return { error: `Could not find location: "${city}"` };
  }

  const { latitude, longitude, name, country } = geoData.results[0];

  // Step 2: Fetch daily forecast
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${latitude}&longitude=${longitude}` +
      `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weathercode` +
      `&temperature_unit=fahrenheit` +
      `&precipitation_unit=inch` +
      `&timezone=auto` +
      `&start_date=${startDate}` +
      `&end_date=${endDate}`,
  );
  const weatherData = await weatherRes.json();

  if (!weatherData.daily?.time?.length) {
    return {
      error:
        "Weather data unavailable for this date range. Open-Meteo covers up to 16 days ahead.",
    };
  }

  const daily = weatherData.daily;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const forecast = daily.time.map((date: string, i: number) => ({
    date,
    condition: WMO_CONDITIONS[daily.weathercode[i] as number] ?? "Unknown",
    high_f: Math.round(daily.temperature_2m_max[i] as number),
    low_f: Math.round(daily.temperature_2m_min[i] as number),
    precipitation_in: (daily.precipitation_sum[i] as number) ?? 0,
    weathercode: daily.weathercode[i] as number,
  }));

  const packing = buildPackingList(forecast);

  // Strip weathercode from the returned forecast (it's internal)
  const displayForecast = forecast.map(
    ({
      weathercode: _wc,
      ...rest
    }: {
      weathercode: number;
      date: string;
      condition: string;
      high_f: number;
      low_f: number;
      precipitation_in: number;
    }) => rest,
  );

  return {
    destination: `${name}, ${country}`,
    forecast: displayForecast,
    packing_list: packing,
  };
}
