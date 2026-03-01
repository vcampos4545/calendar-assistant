"use client";

import { useEffect, useRef, useState } from "react";
import { EventModal } from "./EventModal";

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
  onCalendarChange?: () => void;
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
// Resize drag state (kept in a ref to avoid re-registering listeners)
// ---------------------------------------------------------------------------

interface ResizeDragState {
  eventId: string;
  startMin: number;
  origEndMin: number;
  currentEndMin: number;
  startDateIso: string; // ISO string of the event's start, used to rebuild the end datetime
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WeekView({ weekStart, events, loading, onCalendarChange }: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep a stable ref to onCalendarChange for use inside event handlers
  const onCalendarChangeRef = useRef(onCalendarChange);
  onCalendarChangeRef.current = onCalendarChange;

  // Resize drag state (ref = no re-render on every mousemove)
  const resizeDragRef = useRef<ResizeDragState | null>(null);
  // Set to true on resize handle mousedown so the subsequent click event is ignored
  const suppressNextClickRef = useRef(false);
  // Separate state just for rendering the preview (causes re-render)
  const [resizePreview, setResizePreview] = useState<{
    eventId: string;
    endMin: number;
  } | null>(null);

  // Modal state
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [creating, setCreating] = useState<{
    date: string;
    startMin: number;
  } | null>(null);

  // Scroll to 7 AM on week change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 7 * HOUR_HEIGHT;
    }
  }, [weekStart]);

  // Global mouse listeners for resize drag — registered once, use refs for current values
  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      const drag = resizeDragRef.current;
      if (!drag) return;
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      const rect = scrollEl.getBoundingClientRect();
      const pixelFromTop = e.clientY - rect.top + scrollEl.scrollTop;
      const rawEndMin = Math.round(((pixelFromTop / HOUR_HEIGHT) * 60) / 15) * 15;
      const newEndMin = Math.max(drag.startMin + 15, Math.min(rawEndMin, 24 * 60));
      drag.currentEndMin = newEndMin;
      setResizePreview({ eventId: drag.eventId, endMin: newEndMin });
    }

    async function onMouseUp() {
      const drag = resizeDragRef.current;
      if (!drag) return;
      resizeDragRef.current = null;
      setResizePreview(null);
      if (drag.currentEndMin === drag.origEndMin) return;

      const startDate = new Date(drag.startDateIso);
      const endDate = new Date(startDate);
      endDate.setHours(
        Math.floor(drag.currentEndMin / 60),
        drag.currentEndMin % 60,
        0,
        0,
      );

      await fetch(`/api/calendar/${drag.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ end: { dateTime: endDate.toISOString() } }),
      });

      onCalendarChangeRef.current?.();
    }

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  // Change cursor globally during resize
  useEffect(() => {
    if (resizePreview) {
      document.body.style.cursor = "ns-resize";
      document.body.style.userSelect = "none";
    } else {
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  }, [resizePreview]);

  // ── Event handlers ──────────────────────────────────────────────────────────

  function onEventClick(e: React.MouseEvent, ev: TimedEvent) {
    e.stopPropagation();
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
    const fullEvent = events.find((orig) => orig.id === ev.id);
    if (fullEvent) setSelectedEvent(fullEvent);
  }

  function onResizeMouseDown(e: React.MouseEvent, ev: TimedEvent) {
    e.stopPropagation();
    e.preventDefault();
    suppressNextClickRef.current = true;
    const origEvent = events.find((orig) => orig.id === ev.id);
    if (!origEvent?.start?.dateTime) return;
    resizeDragRef.current = {
      eventId: ev.id,
      startMin: ev.startMin,
      origEndMin: ev.endMin,
      currentEndMin: ev.endMin,
      startDateIso: origEvent.start.dateTime,
    };
    setResizePreview({ eventId: ev.id, endMin: ev.endMin });
  }

  function onColumnClick(e: React.MouseEvent, day: Date) {
    if (resizeDragRef.current) return;
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const rect = scrollEl.getBoundingClientRect();
    const pixelFromTop = e.clientY - rect.top + scrollEl.scrollTop;
    const clickedMin =
      Math.floor(((pixelFromTop / HOUR_HEIGHT) * 60) / 15) * 15;
    setCreating({ date: toDateKey(day), startMin: clickedMin });
  }

  function onModalClose() {
    setSelectedEvent(null);
    setCreating(null);
  }

  function onModalSaved() {
    setSelectedEvent(null);
    setCreating(null);
    onCalendarChange?.();
  }

  // ── Data bucketing ──────────────────────────────────────────────────────────

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  const todayKey = toDateKey(new Date());

  const timedByDay: TimedEvent[][] = Array.from({ length: 7 }, () => []);
  const allDayByDay: CalendarEvent[][] = Array.from({ length: 7 }, () => []);

  for (const event of events) {
    if (!event.start?.dateTime) {
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

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-900">
      {/* Modals */}
      {selectedEvent && (
        <EventModal
          event={selectedEvent}
          onClose={onModalClose}
          onSaved={onModalSaved}
        />
      )}
      {creating && (
        <EventModal
          defaultDate={creating.date}
          defaultStartMin={creating.startMin}
          onClose={onModalClose}
          onSaved={onModalSaved}
        />
      )}

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
                  onClick={() => setSelectedEvent(e)}
                  className="text-[11px] leading-tight bg-blue-500 dark:bg-blue-600 text-white rounded px-1.5 py-0.5 truncate cursor-pointer hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
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
                onClick={(e) => onColumnClick(e, day)}
                className={`flex-1 relative border-l border-zinc-200 dark:border-zinc-800 cursor-pointer ${
                  isToday ? "bg-blue-50/40 dark:bg-blue-950/20" : ""
                }`}
              >
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute left-0 right-0 border-t border-zinc-100 dark:border-zinc-800 pointer-events-none"
                    style={{ top: h * HOUR_HEIGHT }}
                  />
                ))}

                {/* Half-hour lines (fainter) */}
                {HOURS.map((h) => (
                  <div
                    key={`hh-${h}`}
                    className="absolute left-0 right-0 border-t border-zinc-50 dark:border-zinc-800/50 pointer-events-none"
                    style={{ top: h * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                  />
                ))}

                {/* Timed events */}
                {timedByDay[dayIdx].map((ev) => {
                  const displayEndMin =
                    resizePreview?.eventId === ev.id
                      ? resizePreview.endMin
                      : ev.endMin;
                  const top = (ev.startMin / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    ((displayEndMin - ev.startMin) / 60) * HOUR_HEIGHT,
                    20,
                  );
                  const leftPct = (ev.col / ev.totalCols) * 100;
                  const widthPct = (1 / ev.totalCols) * 100;
                  const isDragging = resizePreview?.eventId === ev.id;

                  return (
                    <div
                      key={ev.id}
                      onClick={(e) => onEventClick(e, ev)}
                      className={`absolute rounded-sm bg-blue-500 dark:bg-blue-600 text-white overflow-hidden select-none group ${
                        isDragging ? "cursor-ns-resize" : "cursor-pointer hover:brightness-110"
                      }`}
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
                            {formatTime(ev.startMin)} – {formatTime(displayEndMin)}
                          </p>
                        )}
                      </div>

                      {/* Resize handle */}
                      <div
                        onMouseDown={(e) => onResizeMouseDown(e, ev)}
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Drag to resize"
                      >
                        <div className="w-6 h-0.5 rounded-full bg-white/60" />
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
