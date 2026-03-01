import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { TOOLS, executeTool } from "@/lib/calendarTools";
import {
  buildPreferencesContext,
  type UserPreferences,
} from "@/lib/preferences";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TOOL_ITERATIONS = 10;

function buildSystemPrompt(preferences?: UserPreferences): string {
  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return `You are a helpful calendar assistant. Today is ${today}. The local timezone is ${timeZone}.

FINDING FREE TIME
When a user asks about availability or finding time to schedule something, call get_free_slots first — never guess. Default duration is 30 minutes if unspecified.

DATE VALIDATION (IMPORTANT)
Before passing any date to a tool, verify it is a real calendar date:
- February has 28 days in non-leap years and 29 only in leap years. A year is a leap year if divisible by 4, except century years must be divisible by 400. ${now.getFullYear()} is ${now.getFullYear() % 4 === 0 && (now.getFullYear() % 100 !== 0 || now.getFullYear() % 400 === 0) ? "a leap year (Feb has 29 days)" : "not a leap year (Feb has 28 days)"}.
- April, June, September, and November have 30 days. All other months have 31 days (except February).
- If a user says "tomorrow" or a relative day, compute the exact date from today (${today}) before calling any tool.
- Never invent or guess a date. If unsure, ask the user to confirm.

CREATING EVENTS
When creating an event, use create_calendar_event. Pass datetimes as YYYY-MM-DDTHH:MM:SS in local time (no timezone suffix — the server handles that). If the user doesn't specify an end time, default to 1 hour after the start.

UPDATING EVENTS
When updating an event, call get_events first to find the event_id, then call update_calendar_event with only the fields that should change.

DELETING EVENTS
When the user asks to delete an event, call get_events to find it, confirm with the user ("Are you sure you want to delete [event name]?"), then call delete_calendar_event only after they confirm.

DRAFTING EMAILS
When a user asks you to draft an email:
1. Write the full draft in your response (To, Subject, and body) so they can read it.
2. Call prepare_email_draft with the same to, subject, and body — this will show a "Save to Gmail Drafts" button in the UI so the user can save it with one click.
If drafting multiple emails (e.g. one per person), write each draft in your response and call prepare_email_draft once per email.

TRIP PLANNING
When the user mentions a trip or you detect travel events in their calendar (multi-day events, events in a different city, events titled "Trip to...", "Flight", etc.), proactively offer flight and weather help.

Searching flights:
- Call search_flights with the origin and destination. Use IATA airport codes when you know them; otherwise pass the city name and the tool resolves it.
- Present each option as: airline, departs → arrives, duration, nonstop or N stop(s), and price.
- Always include the booking_link from each result so the user can book.

Checking weather:
- Call get_weather_forecast with the destination city and trip start/end dates.
- Summarize conditions day-by-day, then present the packing list returned by the tool.
- If the tool returns an error about date range, tell the user the forecast is not available yet and offer general seasonal advice instead.

Full trip planning workflow (uses 3 tool calls, fits within the 5-call budget):
1. get_events → find the trip on the calendar (dates, destination).
2. search_flights → show flight options with booking links.
3. get_weather_forecast → show weather summary and packing list.${preferences ? buildPreferencesContext(preferences) : ""}`;
}

export async function POST(req: NextRequest) {
  const [session, body] = await Promise.all([auth(), req.json()]);

  const { messages, preferences } = body as {
    messages: unknown;
    preferences?: UserPreferences;
  };
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  const accessToken = session?.accessToken ?? null;

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(preferences) },
    ...messages,
  ];

  // -------------------------------------------------------------------------
  // ReAct loop: non-streaming calls until no more tool_calls
  // -------------------------------------------------------------------------
  const MUTATING_TOOLS = new Set([
    "create_calendar_event",
    "update_calendar_event",
    "delete_calendar_event",
  ]);
  let calendarModified = false;
  const pendingDrafts: Array<{ to?: string; subject: string; body: string }> = [];

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatMessages,
      tools: TOOLS,
      tool_choice: "auto",
    });

    const choice = response.choices[0];

    // No tool calls → ready to stream the final answer
    if (choice.finish_reason !== "tool_calls" || !choice.message.tool_calls) {
      break;
    }

    // Append the assistant's tool-call message to history
    chatMessages.push(choice.message);

    // Track mutations and capture any email drafts
    for (const toolCall of choice.message.tool_calls) {
      if (MUTATING_TOOLS.has(toolCall.function.name)) {
        calendarModified = true;
      }
      if (toolCall.function.name === "prepare_email_draft") {
        const args = JSON.parse(toolCall.function.arguments) as {
          to?: string;
          subject: string;
          body: string;
        };
        pendingDrafts.push({ to: args.to, subject: args.subject, body: args.body });
      }
    }

    // Execute all tool calls (in parallel if there are multiple)
    const toolResults = await Promise.all(
      choice.message.tool_calls.map(async (toolCall) => ({
        role: "tool" as const,
        tool_call_id: toolCall.id,
        content: JSON.stringify(await executeTool(toolCall, accessToken)),
      }))
    );

    chatMessages.push(...toolResults);
  }

  // -------------------------------------------------------------------------
  // Stream the final response back to the client
  // -------------------------------------------------------------------------
  const finalStream = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: chatMessages,
    stream: true,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of finalStream) {
        const text = chunk.choices[0]?.delta?.content ?? "";
        if (text) controller.enqueue(encoder.encode(text));
      }
      controller.close();
    },
  });

  const responseHeaders: Record<string, string> = {
    "Content-Type": "text/plain; charset=utf-8",
    "X-Calendar-Modified": calendarModified ? "true" : "false",
  };
  if (pendingDrafts.length > 0) {
    responseHeaders["X-Draft-Data"] = encodeURIComponent(
      JSON.stringify(pendingDrafts),
    );
  }

  return new Response(readable, { headers: responseHeaders });
}
