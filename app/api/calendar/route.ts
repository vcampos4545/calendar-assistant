import { auth } from "@/auth";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { makeGoogleAuth } from "@/lib/googleAuth";

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as Record<string, unknown>;
  const calendar = google.calendar({ version: "v3", auth: makeGoogleAuth(session.accessToken) });

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: body,
  });

  return NextResponse.json({ event: response.data });
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json(
      { error: "Missing required query params: start, end (YYYY-MM-DD)" },
      { status: 400 },
    );
  }

  const calendar = google.calendar({ version: "v3", auth: makeGoogleAuth(session.accessToken) });

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: new Date(`${start}T00:00:00`).toISOString(),
    timeMax: new Date(`${end}T23:59:59`).toISOString(),
    singleEvents: true,
    orderBy: "startTime",
    maxResults: 250,
  });

  return NextResponse.json({ events: response.data.items ?? [] });
}
