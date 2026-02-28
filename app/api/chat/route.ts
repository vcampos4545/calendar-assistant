import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { TOOLS, executeTool } from "@/lib/calendarTools";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_TOOL_ITERATIONS = 5;

function buildSystemPrompt(): string {
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `You are a helpful calendar assistant. Today is ${today}.

FINDING FREE TIME
When a user asks about finding time, scheduling something, or checking their availability, always call get_free_slots with an appropriate date range before answering — do not guess or make up times. If the user doesn't specify a duration, default to 30 minutes.

DRAFTING EMAILS
When a user asks you to draft an email, write the full draft directly in your response.`;
}

export async function POST(req: NextRequest) {
  const [session, body] = await Promise.all([auth(), req.json()]);

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: "Invalid messages" }, { status: 400 });
  }

  const accessToken = session?.accessToken ?? null;

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt() },
    ...messages,
  ];

  // -------------------------------------------------------------------------
  // ReAct loop: non-streaming calls until no more tool_calls
  // -------------------------------------------------------------------------
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

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
