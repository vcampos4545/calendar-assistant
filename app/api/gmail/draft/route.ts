import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const session = await auth();
  const accessToken = session?.accessToken;

  if (!accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { to, subject, body } = (await req.json()) as {
    to?: string;
    subject: string;
    body: string;
  };

  if (!subject || !body) {
    return NextResponse.json(
      { error: "subject and body are required" },
      { status: 400 },
    );
  }

  // Build RFC 2822 message and base64url-encode it for the Gmail API
  const headerLines = [
    to ? `To: ${to}` : null,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=utf-8",
    "MIME-Version: 1.0",
  ]
    .filter(Boolean)
    .join("\r\n");

  const raw = `${headerLines}\r\n\r\n${body}`;
  const encoded = Buffer.from(raw).toString("base64url");

  const gmailRes = await fetch(
    "https://gmail.googleapis.com/gmail/v1/users/me/drafts",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: { raw: encoded } }),
    },
  );

  if (!gmailRes.ok) {
    const err = (await gmailRes.json()) as { error?: { message?: string } };
    return NextResponse.json(
      { error: err.error?.message ?? "Failed to save draft to Gmail" },
      { status: gmailRes.status },
    );
  }

  return NextResponse.json({
    success: true,
    drafts_link: "https://mail.google.com/mail/u/0/#drafts",
  });
}
