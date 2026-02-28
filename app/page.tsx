"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { Chat } from "./components/Chat";

interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

// Returns the YYYY-MM-DD key for an event
function eventDateKey(event: CalendarEvent): string {
  if (event.start?.dateTime) return event.start.dateTime.slice(0, 10);
  return event.start?.date ?? "unknown";
}

// Groups a sorted event list into [dateKey, events[]] pairs
function groupByDay(events: CalendarEvent[]): [string, CalendarEvent[]][] {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const key = eventDateKey(event);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(event);
  }
  return Array.from(map.entries());
}

function formatDayLabel(dateKey: string): { label: string; isToday: boolean } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // Parse as local date to avoid UTC offset shifting the day
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);

  if (date.getTime() === today.getTime()) return { label: "Today", isToday: true };
  if (date.getTime() === tomorrow.getTime()) return { label: "Tomorrow", isToday: false };

  return {
    label: date.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    isToday: false,
  };
}

function formatTimeRange(event: CalendarEvent): string {
  if (!event.start?.dateTime) return "All day";

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });

  const start = fmt(event.start.dateTime);
  const end = event.end?.dateTime ? fmt(event.end.dateTime) : null;
  return end ? `${start} – ${end}` : start;
}

export default function Home() {
  const { data: session, status } = useSession();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session && !session.error) {
      setLoading(true);
      fetch("/api/calendar")
        .then((res) => res.json())
        .then((data) => {
          if (data.error) setError(data.error);
          else setEvents(data.events);
        })
        .catch(() => setError("Failed to fetch calendar events"))
        .finally(() => setLoading(false));
    }
  }, [session]);

  const grouped = groupByDay(events);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Calendar Assistant
        </h1>
        {status === "loading" ? (
          <span className="text-sm text-zinc-400">Loading...</span>
        ) : session ? (
          <div className="flex items-center gap-4">
            <span className="text-sm text-zinc-600 dark:text-zinc-400">
              {session.user?.email}
            </span>
            <button
              onClick={() => signOut()}
              className="text-sm px-3 py-1.5 rounded-md border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="text-sm px-4 py-1.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
          >
            Sign in with Google
          </button>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        {/* Session expired banner */}
        {session?.error === "RefreshAccessTokenError" && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Your session has expired.
            </p>
            <button
              onClick={() => signIn("google")}
              className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-amber-800 dark:bg-amber-300 text-white dark:text-amber-950 hover:opacity-90 transition-opacity"
            >
              Sign in again
            </button>
          </div>
        )}

        {/* Signed-out state */}
        {!session && status !== "loading" && (
          <div className="text-center py-20">
            <h2 className="text-xl font-medium text-zinc-700 dark:text-zinc-300 mb-2">
              Connect your Google Calendar
            </h2>
            <p className="text-zinc-500 dark:text-zinc-400 mb-6">
              Sign in with Google to view and manage your calendar events.
            </p>
            <button
              onClick={() => signIn("google")}
              className="px-5 py-2.5 rounded-md bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Sign in with Google
            </button>
          </div>
        )}

        {/* Signed-in state */}
        {session && (
          <>
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 mb-6">
              Upcoming Events
            </h2>

            {loading && (
              <p className="text-sm text-zinc-400">Fetching events...</p>
            )}

            {error && (
              <p className="text-sm text-red-500">Error: {error}</p>
            )}

            {!loading && !error && events.length === 0 && (
              <p className="text-sm text-zinc-400">No upcoming events found.</p>
            )}

            {!loading && !error && grouped.length > 0 && (
              <div className="space-y-8">
                {grouped.map(([dateKey, dayEvents]) => {
                  const { label, isToday } = formatDayLabel(dateKey);
                  return (
                    <section key={dateKey}>
                      {/* Day header */}
                      <div className="flex items-center gap-3 mb-3">
                        <span
                          className={`text-xs font-semibold tracking-wide uppercase whitespace-nowrap ${
                            isToday
                              ? "text-blue-600 dark:text-blue-400"
                              : "text-zinc-400 dark:text-zinc-500"
                          }`}
                        >
                          {label}
                        </span>
                        <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />
                      </div>

                      {/* Events for this day */}
                      <ul className="space-y-2">
                        {dayEvents.map((event) => {
                          const timeRange = formatTimeRange(event);
                          const isAllDay = !event.start?.dateTime;
                          return (
                            <li
                              key={event.id}
                              className="flex items-start justify-between gap-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-3"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                  {event.summary ?? "(No title)"}
                                </p>
                                {event.location && (
                                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 truncate">
                                    {event.location}
                                  </p>
                                )}
                              </div>
                              <span
                                className={`shrink-0 text-xs mt-0.5 ${
                                  isAllDay
                                    ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 rounded px-1.5 py-0.5"
                                    : "text-zinc-400 dark:text-zinc-500"
                                }`}
                              >
                                {timeRange}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </section>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      <Chat />
    </div>
  );
}
