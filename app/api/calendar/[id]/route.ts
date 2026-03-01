import { auth } from "@/auth";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";
import { makeGoogleAuth } from "@/lib/googleAuth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.accessToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const calendar = google.calendar({ version: "v3", auth: makeGoogleAuth(session.accessToken) });

  const response = await calendar.events.patch({
    calendarId: "primary",
    eventId: id,
    requestBody: body,
  });

  return NextResponse.json({ event: response.data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.accessToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const calendar = google.calendar({ version: "v3", auth: makeGoogleAuth(session.accessToken) });

  await calendar.events.delete({ calendarId: "primary", eventId: id });

  return NextResponse.json({ success: true });
}
