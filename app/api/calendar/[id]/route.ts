import { auth } from "@/auth";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

function makeOAuth(token: string) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );
  client.setCredentials({ access_token: token });
  return client;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.accessToken)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = (await req.json()) as Record<string, unknown>;

  const calendar = google.calendar({
    version: "v3",
    auth: makeOAuth(session.accessToken),
  });

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

  const calendar = google.calendar({
    version: "v3",
    auth: makeOAuth(session.accessToken),
  });

  await calendar.events.delete({ calendarId: "primary", eventId: id });

  return NextResponse.json({ success: true });
}
