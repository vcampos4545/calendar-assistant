"use client";

import { useEffect, useRef } from "react";

export interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  location?: string;
}

interface WeekViewProps {
  weekStart: Date; // Sunday of the displayed week
  events: CalendarEvent[];
  loading?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HOUR_HEIGHT = 60; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDateKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function hourLabel(h: number): string {
  if (h === 0) return "";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const period = h >= 12 ? "PM" : "AM";
  const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0
    ? `${displayH} ${period}`
    : `${displayH}:${String(m).padStart(2, "0")} ${period}`;
}

// ---------------------------------------------------------------------------
// Overlap layout
// ---------------------------------------------------------------------------

interface TimedEvent {
  id: string;
  summary: string;
  startMin: number;
  endMin: number;
  col: number;
  totalCols: number;
}

function layoutEvents(events: Omit<TimedEvent, "col" | "totalCols">[]): TimedEvent[] {
  if (!events.length) return [];

  const sorted: TimedEvent[] = [...events]
    .sort((a, b) => a.startMin - b.startMin)
    .map((e) => ({ ...e, col: 0, totalCols: 1 }));

  let i = 0;
  while (i < sorted.length) {
    let maxEnd = sorted[i].endMin;
    let j = i + 1;
    while (j < sorted.length && sorted[j].startMin < maxEnd) {
      maxEnd = Math.max(maxEnd, sorted[j].endMin);
      j++;
    }

    const group = sorted.slice(i, j);
    const colEnds: number[] = [];

    for (const ev of group) {
      let placed = false;
      for (let c = 0; c < colEnds.length; c++) {
        if (colEnds[c] <= ev.startMin) {
          colEnds[c] = ev.endMin;
          ev.col = c;
          placed = true;
          break;
        }
      }
      if (!placed) {
        ev.col = colEnds.length;
        colEnds.push(ev.endMin);
      }
    }

    const total = colEnds.length;
    for (const ev of group) ev.totalCols = total;
    i = j;
  }

  return sorted;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeekView({ weekStart, events, loading }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to 7 AM (or current time) on week change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, [weekStart]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const todayKey = toDateKey(new Date());

  // Bucket events into timed and all-day per day
  const timedByDay: TimedEvent[][] = Array.from({ length: 7 }, () => []);
  const allDayByDay: CalendarEvent[][] = Array.from({ length: 7 }, () => []);

  for (const event of events) {
    if (!event.start?.dateTime) {
      // All-day event — match by date string
      const dateStr = event.start?.date ?? "";
      const dayIdx = days.findIndex((d) => toDateKey(d) === dateStr);
      if (dayIdx >= 0) allDayByDay[dayIdx].push(event);
      continue;
    }

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end?.dateTime ?? event.start.dateTime);
    const dayIdx = days.findIndex((d) => toDateKey(d) === toDateKey(start));
    if (dayIdx < 0) continue;

    const startMin = start.getHours() * 60 + start.getMinutes();
    const endMinRaw = end.getHours() * 60 + end.getMinutes();
    // Midnight-crossing or same-moment: clamp to end of day or add 30 min minimum
    const endMin = endMinRaw <= startMin ? Math.min(startMin + 30, 1440) : endMinRaw;

    timedByDay[dayIdx].push({
      id: event.id,
      summary: event.summary ?? "(No title)",
      startMin,
      endMin,
      col: 0,
      totalCols: 1,
    });
  }

  for (let d = 0; d < 7; d++) {
    timedByDay[d] = layoutEvents(timedByDay[d]);
  }

  const now = new Date();
  const currentTimeTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
  const todayColIdx = days.findIndex((d) => toDateKey(d) === todayKey);
  const hasAllDay = allDayByDay.some((arr) => arr.length > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-900">
      {/* Day headers */}
      <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 z-10">
        {/* gutter */}
        <div className="w-14 shrink-0" />
        {days.map((day, i) => {
          const isToday = toDateKey(day) === todayKey;
          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center py-2 border-l border-zinc-200 dark:border-zinc-800"
            >
              <span
                className={`text-[10px] font-semibold uppercase tracking-widest ${
                  isToday
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-zinc-400 dark:text-zinc-500"
                }`}
              >
                {DAY_LABELS[i]}
              </span>
              <span
                className={`mt-0.5 text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors ${
                  isToday
                    ? "bg-blue-600 text-white"
                    : "text-zinc-800 dark:text-zinc-200"
                }`}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      {hasAllDay && (
        <div className="flex shrink-0 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="w-14 shrink-0 flex items-center justify-end pr-2">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">all-day</span>
          </div>
          {allDayByDay.map((dayEvents, i) => (
            <div
              key={i}
              className="flex-1 border-l border-zinc-200 dark:border-zinc-800 px-0.5 py-1 space-y-0.5 min-h-[28px]"
            >
              {dayEvents.map((e) => (
                <div
                  key={e.id}
                  className="text-[11px] leading-tight bg-blue-500 dark:bg-blue-600 text-white rounded px-1.5 py-0.5 truncate"
                >
                  {e.summary ?? "(No title)"}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative">
        {loading && (
          <div className="absolute inset-0 flex items-start justify-center pt-16 z-20 pointer-events-none">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 bg-white dark:bg-zinc-900 px-3 py-1 rounded-full shadow-sm border border-zinc-200 dark:border-zinc-700">
              Loading…
            </span>
          </div>
        )}

        <div className="flex" style={{ height: `${24 * HOUR_HEIGHT}px` }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 relative select-none">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 text-[10px] text-zinc-400 dark:text-zinc-500 leading-none"
                style={{ top: h * HOUR_HEIGHT - 6, display: h === 0 ? "none" : undefined }}
              >
                {hourLabel(h)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, dayIdx) => {
            const isToday = toDateKey(day) === todayKey;

            return (
              <div
                key={dayIdx}
                className={`flex-1 relative border-l border-zinc-200 dark:border-zinc-800 ${
                  isToday ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                }`}
              >
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}

                {/* Half-hour lines (fainter) */}
                {HOURS.map((h) => (
                  <div
                    key={`hh-${h}`}
                    className="absolute left-0 right-0 border-t border-zinc-50 dark:border-zinc-800/50"
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Timed events */}
                {timedByDay[dayIdx].map((ev) => {
                  const top = (ev.startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    ((ev.endMin - ev.startMin) / 60) * HOUR_HEIGHT,
                    20,
                  );
                  const leftPct = (ev.col / ev.totalCols) * 100;
                  const widthPct = (1 / ev.totalCols) * 100;

                  return (
                    <div
                      key={ev.id}
                      className="absolute rounded-sm bg-blue-500 dark:bg-blue-600 text-white overflow-hidden cursor-default select-none"
                      style={{
                        top,
                        height,
                        left: `calc(${leftPct}% + 2px)`,
                        width: `calc(${widthPct}% - 4px)`,
                      }}
                    >
                      <div className="px-1.5 py-0.5">
                        <p className="text-[11px] font-semibold leading-tight truncate">
                          {ev.summary}
                        </p>
                        {height >= 38 && (
                          <p className="text-[10px] text-blue-100 leading-tight">
                            {formatTime(ev.startMin)} – {formatTime(ev.endMin)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Current time indicator */}
                {isToday && todayColIdx >= 0 && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 -ml-1" />
                      <div className="flex-1 border-t-[1.5px] border-red-500" />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
