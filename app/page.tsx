"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Chat } from "./components/Chat";
import { WeekView, type CalendarEvent } from "./components/WeekView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toLocalDateStr(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

// Sunday–Saturday week bounds for a given offset from the current week
function getWeekBounds(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - now.getDay() + offset * 7);
  sunday.setHours(0, 0, 0, 0);

  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 6);
  saturday.setHours(23, 59, 59, 999);

  return { start: sunday, end: saturday };
}

function formatWeekLabel(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return start.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  const s = start.toLocaleDateString(undefined, { month: "short" });
  const e = end.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  return `${s} – ${e}`;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ChevronLeft() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 0 1 0 1.06L8.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06l-4.25-4.25a.75.75 0 0 1 0-1.06l4.25-4.25a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function Home() {
  const { data: session, status } = useSession();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset);
  const weekLabel = formatWeekLabel(weekStart, weekEnd);

  useEffect(() => {
    if (!session || session.error) return;

    setLoading(true);
    setError(null);
    setEvents([]);

    const startStr = toLocalDateStr(weekStart);
    const endStr = toLocalDateStr(weekEnd);

    fetch(`/api/calendar?start=${startStr}&end=${endStr}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setEvents(data.events);
      })
      .catch(() => setError("Failed to fetch calendar events"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, weekOffset, refreshKey]);

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {/* Header */}
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Calendar Copilot
          </h1>

          {/* Week navigation — inside header to keep it compact */}
          {session && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => setWeekOffset((o) => o - 1)}
                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Previous week"
              >
                <ChevronLeft />
              </button>
              <button
                onClick={() => setWeekOffset((o) => o + 1)}
                className="p-1 rounded text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Next week"
              >
                <ChevronRight />
              </button>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1 min-w-32">
                {weekLabel}
              </span>
            </div>
          )}
        </div>

        {/* Auth controls */}
        {status === "loading" ? (
          <span className="text-sm text-zinc-400">Loading…</span>
        ) : session ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
              {session.user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-xs px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="text-sm px-4 py-1.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Sign in with Google
          </button>
        )}
      </header>

      {/* Session expired banner */}
      {session?.error === "RefreshAccessTokenError" && (
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Your session has expired.
          </p>
          <button
            onClick={() => signIn("google")}
            className="text-xs px-3 py-1 rounded bg-amber-800 dark:bg-amber-300 text-white dark:text-amber-950 hover:opacity-90 transition-opacity"
          >
            Sign in again
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">Error: {error}</p>
        </div>
      )}

      {/* Main content */}
      {!session && status !== "loading" ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Connect your Google Calendar
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
              Sign in with Google to view and manage your calendar.
            </p>
            <button
              onClick={() => signIn("google")}
              className="px-5 py-2.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        </div>
      ) : session ? (
        <WeekView
          weekStart={weekStart}
          events={events}
          loading={loading}
        />
      ) : null}

      <Chat onCalendarChange={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}
