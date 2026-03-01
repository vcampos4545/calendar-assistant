"use client";

import { useState } from "react";
import type { CalendarEvent } from "./WeekView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dateToStr(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

function minToTimeStr(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Builds a UTC ISO string from a local date string (YYYY-MM-DD) + time string (HH:MM)
function toUtcIso(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventModalProps {
  event?: CalendarEvent | null; // undefined/null = create mode
  defaultDate?: string; // YYYY-MM-DD, used in create mode
  defaultStartMin?: number; // minutes since midnight, used in create mode
  onClose: () => void;
  onSaved: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventModal({
  event,
  defaultDate,
  defaultStartMin,
  onClose,
  onSaved,
}: EventModalProps) {
  const isCreate = !event;

  const existingStart = event?.start?.dateTime
    ? new Date(event.start.dateTime)
    : null;
  const existingEnd = event?.end?.dateTime
    ? new Date(event.end.dateTime)
    : null;

  const initialDate = existingStart
    ? dateToStr(existingStart)
    : (defaultDate ?? dateToStr(new Date()));

  const initialStartMin = existingStart
    ? existingStart.getHours() * 60 + existingStart.getMinutes()
    : (defaultStartMin ?? 9 * 60);

  const initialEndMin = existingEnd
    ? existingEnd.getHours() * 60 + existingEnd.getMinutes()
    : initialStartMin + 60;

  const [summary, setSummary] = useState(event?.summary ?? "");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState(minToTimeStr(initialStartMin));
  const [endTime, setEndTime] = useState(minToTimeStr(initialEndMin));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!summary.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const requestBody = {
        summary: summary.trim(),
        start: { dateTime: toUtcIso(date, startTime) },
        end: { dateTime: toUtcIso(date, endTime) },
      };
      const url = isCreate ? "/api/calendar" : `/api/calendar/${event!.id}`;
      const method = isCreate ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to save");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event?.id) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/calendar/${event.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Failed to delete");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Network error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-[340px] overflow-hidden border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 dark:border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {isCreate ? "New event" : "Edit event"}
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          <input
            type="text"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="Event title"
            autoFocus
            className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
                Start
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] font-medium text-zinc-400 uppercase tracking-wide mb-1">
                End
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 rounded-xl px-3 py-2 outline-none focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-2">
          {!isCreate && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Delete
            </button>
          )}
          {confirmDelete && (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-xs px-2.5 py-1 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {deleting ? "Deleting…" : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="ml-auto flex gap-2">
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs px-3 py-1.5 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : isCreate ? "Create" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
