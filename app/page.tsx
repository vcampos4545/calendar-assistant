"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { Chat, type ChatHandle } from "./components/Chat";
import { WeekView, type CalendarEvent } from "./components/WeekView";
import { PreferencesPanel } from "./components/PreferencesPanel";
import { LandingPage } from "./components/LandingPage";
import {
  AnalyticsPanel,
  computeAnalytics,
  type AnalyticsStats,
} from "./components/AnalyticsPanel";
import {
  DEFAULT_PREFERENCES,
  loadPreferences,
  savePreferences,
  type UserPreferences,
} from "@/lib/preferences";

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function toLocalDateStr(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

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

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M12.75 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM7.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM8.25 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM9.75 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM10.5 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM12.75 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM14.25 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 17.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 15.75a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5ZM15 12.75a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM16.5 13.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
      <path fillRule="evenodd" d="M6.75 2.25A.75.75 0 0 1 7.5 3v1.5h9V3A.75.75 0 0 1 18 3v1.5h.75a3 3 0 0 1 3 3v11.25a3 3 0 0 1-3 3H5.25a3 3 0 0 1-3-3V7.5a3 3 0 0 1 3-3H6V3a.75.75 0 0 1 .75-.75Zm13.5 9a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5v7.5a1.5 1.5 0 0 0 1.5 1.5h13.5a1.5 1.5 0 0 0 1.5-1.5v-7.5Z" clipRule="evenodd" />
    </svg>
  );
}

function SlidersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M18.75 12.75h1.5a.75.75 0 0 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5ZM12 6a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 12 6ZM12 18a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 12 18ZM3.75 6.75h1.5a.75.75 0 1 0 0-1.5h-1.5a.75.75 0 0 0 0 1.5ZM5.25 18.75h-1.5a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 0 1.5ZM3 12a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 3 12ZM9 3.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5ZM12.75 12a2.25 2.25 0 1 1 4.5 0 2.25 2.25 0 0 1-4.5 0ZM9 15.75a2.25 2.25 0 1 0 0 4.5 2.25 2.25 0 0 0 0-4.5Z" />
    </svg>
  );
}

function ChartBarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path d="M18.375 2.25c-1.035 0-1.875.84-1.875 1.875v15.75c0 1.035.84 1.875 1.875 1.875h.75c1.035 0 1.875-.84 1.875-1.875V4.125c0-1.036-.84-1.875-1.875-1.875h-.75ZM9.75 8.625c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v11.25c0 1.035-.84 1.875-1.875 1.875h-.75a1.875 1.875 0 0 1-1.875-1.875V8.625ZM3 13.125c0-1.036.84-1.875 1.875-1.875h.75c1.036 0 1.875.84 1.875 1.875v6.75c0 1.035-.84 1.875-1.875 1.875h-.75A1.875 1.875 0 0 1 3 19.875v-6.75Z" />
    </svg>
  );
}

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
// Sidebar tab button
// ---------------------------------------------------------------------------

function SidebarTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold border-l-2 transition-all ${
        active
          ? "border-blue-600 text-blue-600 bg-blue-50/70 dark:text-blue-400 dark:border-blue-400 dark:bg-blue-950/20"
          : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

type ActiveTab = "calendar" | "analytics" | "preferences";

export default function Home() {
  const { data: session, status } = useSession();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("calendar");

  const [analyticsStats, setAnalyticsStats] = useState<AnalyticsStats | null>(null);

  const [savedPrefs, setSavedPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [draftPrefs, setDraftPrefs] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const chatRef = useRef<ChatHandle>(null);

  useEffect(() => {
    const loaded = loadPreferences();
    setSavedPrefs(loaded);
    setDraftPrefs(loaded);
  }, []);

  const { start: weekStart, end: weekEnd } = getWeekBounds(weekOffset);
  const weekLabel = formatWeekLabel(weekStart, weekEnd);

  useEffect(() => {
    if (!session || session.error) return;
    setLoading(true);
    setError(null);
    fetch(`/api/calendar?start=${toLocalDateStr(weekStart)}&end=${toLocalDateStr(weekEnd)}`)
      .then((r) => r.json())
      .then((d) => { if (d.error) setError(d.error); else setEvents(d.events); })
      .catch(() => setError("Failed to fetch calendar events"))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, weekOffset, refreshKey]);

  // Compute analytics once when the tab is first opened (after events load)
  useEffect(() => {
    if (activeTab === "analytics" && !loading && analyticsStats === null) {
      setAnalyticsStats(computeAnalytics(events, weekStart));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loading, analyticsStats]);

  // Reset saved analytics whenever the viewed week changes
  useEffect(() => {
    setAnalyticsStats(null);
  }, [weekOffset]);

  function handleSavePrefs() {
    savePreferences(draftPrefs);
    setSavedPrefs(draftPrefs);
  }

  function handleScheduleThisWeek() {
    const activities = draftPrefs.activities.filter((a) => a.name.trim());
    if (!activities.length) return;
    const list = activities
      .map((a) => `${a.name} (${a.timesPerWeek}×/week, ${a.durationMinutes} min, ${a.preferredTime})`)
      .join("; ");
    setActiveTab("calendar");
    chatRef.current?.sendMessage(
      `Please schedule my recurring activities for this week. Activities: ${list}. Use get_free_slots to find open slots and create_calendar_event to schedule each one.`,
    );
  }

  // Show landing page to unauthenticated visitors
  if (status !== "loading" && !session) {
    return <LandingPage />;
  }

  const isAuthenticated = status === "authenticated" && !!session;

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-white dark:bg-zinc-900">
      {/* ── Header ── */}
      <header className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3 flex items-center justify-between bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            Calendar Copilot
          </h1>
          {isAuthenticated && activeTab === "calendar" && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset(0)}
                className="text-xs px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                Today
              </button>
              <button onClick={() => setWeekOffset((o) => o - 1)} className="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Previous week">
                <ChevronLeft />
              </button>
              <button onClick={() => setWeekOffset((o) => o + 1)} className="p-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" aria-label="Next week">
                <ChevronRight />
              </button>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300 ml-1 min-w-36">
                {weekLabel}
              </span>
            </div>
          )}
        </div>

        {status === "loading" ? (
          <span className="text-sm text-zinc-400">Loading…</span>
        ) : session ? (
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">{session.user?.email}</span>
            <button onClick={() => signOut()} className="text-xs px-3 py-1.5 rounded border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors">
              Sign out
            </button>
          </div>
        ) : (
          <button onClick={() => signIn("google")} className="text-sm px-4 py-1.5 rounded bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors">
            Sign in with Google
          </button>
        )}
      </header>

      {/* ── Banners ── */}
      {session?.error === "RefreshAccessTokenError" && (
        <div className="shrink-0 flex items-center justify-between gap-4 border-b border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950 px-4 py-2">
          <p className="text-xs text-amber-800 dark:text-amber-300">Your session has expired.</p>
          <button onClick={() => signIn("google")} className="text-xs px-3 py-1 rounded bg-amber-800 dark:bg-amber-300 text-white dark:text-amber-950 hover:opacity-90 transition-opacity">
            Sign in again
          </button>
        </div>
      )}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-950 border-b border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">Error: {error}</p>
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Sidebar ── */}
          <aside className="w-72 shrink-0 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 min-h-0">
            {/* Tab nav — vertical */}
            <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 py-1">
              <SidebarTab
                active={activeTab === "calendar"}
                onClick={() => setActiveTab("calendar")}
                icon={<CalendarIcon />}
                label="Calendar"
              />
              <SidebarTab
                active={activeTab === "analytics"}
                onClick={() => setActiveTab("analytics")}
                icon={<ChartBarIcon />}
                label="Analytics"
              />
              <SidebarTab
                active={activeTab === "preferences"}
                onClick={() => setActiveTab("preferences")}
                icon={<SlidersIcon />}
                label="Preferences"
              />
            </div>

            {/* Chat — fills remaining space */}
            <div className="flex-1 min-h-0">
              <Chat
                ref={chatRef}
                onCalendarChange={() => setRefreshKey((k) => k + 1)}
                preferences={savedPrefs}
              />
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 overflow-hidden min-w-0">
            {activeTab === "calendar" && isAuthenticated && (
              <WeekView weekStart={weekStart} events={events} loading={loading} />
            )}
            {activeTab === "analytics" && analyticsStats && (
              <AnalyticsPanel stats={analyticsStats} />
            )}
            {activeTab === "analytics" && !analyticsStats && (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-zinc-400 dark:text-zinc-500">
                  {loading ? "Loading events…" : "Computing…"}
                </p>
              </div>
            )}
            {activeTab === "preferences" && (
              <PreferencesPanel
                prefs={draftPrefs}
                onChange={setDraftPrefs}
                onSave={handleSavePrefs}
                onScheduleThisWeek={handleScheduleThisWeek}
              />
            )}
          </main>
        </div>
    </div>
  );
}
