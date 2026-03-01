"use client";

import type { CalendarEvent } from "./WeekView";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DayStat {
  label: string;
  isWeekend: boolean;
  meetingMinutes: number;
  eventCount: number;
}

export interface AnalyticsStats {
  weekLabel: string;
  totalEvents: number;
  totalMeetingMinutes: number;
  avgMeetingMinutes: number;
  busiestDayLabel: string;
  workHoursPercent: number;
  days: DayStat[];
}

// ---------------------------------------------------------------------------
// Compute (called from page.tsx on first tab open)
// ---------------------------------------------------------------------------

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WORK_MINUTES_PER_WEEK = 5 * 8 * 60; // Mon–Fri, 8 h/day = 2 400 min

function toDateKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

export function computeAnalytics(
  events: CalendarEvent[],
  weekStart: Date,
): AnalyticsStats {
  type DayStatInternal = DayStat & { date: string };

  const days: DayStatInternal[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return {
      label: DAY_LABELS[i],
      isWeekend: i === 0 || i === 6,
      date: toDateKey(d),
      meetingMinutes: 0,
      eventCount: 0,
    };
  });

  let totalMeetingMinutes = 0;
  let timedEventCount = 0;

  for (const event of events) {
    if (!event.start?.dateTime) continue; // skip all-day events
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end?.dateTime ?? event.start.dateTime);
    const durationMin = Math.max(
      Math.round((end.getTime() - start.getTime()) / 60_000),
      0,
    );
    const day = days.find((d) => d.date === toDateKey(start));
    if (!day) continue;
    day.meetingMinutes += durationMin;
    day.eventCount++;
    totalMeetingMinutes += durationMin;
    timedEventCount++;
  }

  const busiestDay = days.reduce((a, b) =>
    a.meetingMinutes >= b.meetingMinutes ? a : b,
  );

  const weekLabel = weekStart.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return {
    weekLabel,
    totalEvents: timedEventCount,
    totalMeetingMinutes,
    avgMeetingMinutes:
      timedEventCount > 0
        ? Math.round(totalMeetingMinutes / timedEventCount)
        : 0,
    busiestDayLabel:
      busiestDay.meetingMinutes > 0 ? busiestDay.label : "—",
    workHoursPercent: Math.min(
      Math.round((totalMeetingMinutes / WORK_MINUTES_PER_WEEK) * 100),
      100,
    ),
    days,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(min: number): string {
  if (min === 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 flex flex-col gap-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
      <p className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500">{sub}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export function AnalyticsPanel({ stats }: { stats: AnalyticsStats }) {
  const maxMinutes = Math.max(...stats.days.map((d) => d.meetingMinutes), 60);

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Week Analytics
        </h2>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
          {stats.weekLabel}
        </p>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Meeting time"
            value={fmt(stats.totalMeetingMinutes)}
          />
          <StatCard
            label="Meetings"
            value={String(stats.totalEvents)}
          />
          <StatCard
            label="Work week"
            value={`${stats.workHoursPercent}%`}
            sub="of 40h in meetings"
          />
          <StatCard
            label="Avg length"
            value={stats.avgMeetingMinutes > 0 ? fmt(stats.avgMeetingMinutes) : "—"}
          />
        </div>

        {/* Daily breakdown */}
        <div className="bg-white dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-xl p-4">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-4">
            Daily Breakdown
          </h3>
          <div className="space-y-3">
            {stats.days.map((day) => (
              <div key={day.label} className="flex items-center gap-3">
                {/* Day label */}
                <span
                  className={`text-[11px] font-medium w-7 shrink-0 ${
                    day.isWeekend
                      ? "text-zinc-400 dark:text-zinc-600"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {day.label}
                </span>

                {/* Bar */}
                <div className="flex-1 h-3.5 bg-zinc-100 dark:bg-zinc-700/50 rounded-full overflow-hidden">
                  {day.meetingMinutes > 0 && (
                    <div
                      className={`h-full rounded-full ${
                        day.isWeekend
                          ? "bg-zinc-300 dark:bg-zinc-600"
                          : "bg-blue-500 dark:bg-blue-600"
                      }`}
                      style={{
                        width: `${(day.meetingMinutes / maxMinutes) * 100}%`,
                      }}
                    />
                  )}
                </div>

                {/* Duration */}
                <span className="text-[11px] text-zinc-500 dark:text-zinc-400 w-12 text-right shrink-0">
                  {fmt(day.meetingMinutes)}
                </span>

                {/* Count badge */}
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 w-16 shrink-0">
                  {day.eventCount > 0
                    ? `${day.eventCount} ${day.eventCount === 1 ? "event" : "events"}`
                    : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Insight callout */}
        {stats.busiestDayLabel !== "—" && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 rounded-xl px-4 py-3">
            <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
              <span className="font-semibold">{stats.busiestDayLabel}</span> is
              your busiest day —{" "}
              {fmt(
                stats.days.find((d) => d.label === stats.busiestDayLabel)
                  ?.meetingMinutes ?? 0,
              )}{" "}
              in meetings.
              {stats.workHoursPercent >= 50 && (
                <> Consider blocking focus time earlier in the week.</>
              )}
            </p>
          </div>
        )}

        {stats.totalEvents === 0 && (
          <p className="text-sm text-zinc-400 dark:text-zinc-500 text-center py-6">
            No timed events found for this week.
          </p>
        )}
      </div>
    </div>
  );
}
