"use client";

import { useState } from "react";
import type {
  BufferMinutes,
  PreferredTime,
  RecurringActivity,
  UserPreferences,
} from "@/lib/preferences";

interface PreferencesPanelProps {
  prefs: UserPreferences;
  onChange: (p: UserPreferences) => void;
  onSave: () => void;
  onScheduleThisWeek: () => void;
}

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
const PREFERRED_TIME_OPTIONS: { value: PreferredTime; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "any", label: "Any time" },
];

// ---------------------------------------------------------------------------
// Small reusable primitives
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-4">
      {children}
    </h3>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
    />
  );
}

function TimeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
    />
  );
}

function Select<T extends string | number>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const opt = options.find((o) => String(o.value) === raw);
        if (opt) onChange(opt.value);
      }}
      className={`text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all ${className ?? ""}`}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
        active
          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
          : "bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Activity card
// ---------------------------------------------------------------------------

function ActivityCard({
  activity,
  onChange,
  onRemove,
}: {
  activity: RecurringActivity;
  onChange: (a: RecurringActivity) => void;
  onRemove: () => void;
}) {
  const toggleDay = (idx: number) => {
    const current = activity.preferredDays ?? [];
    const next = current.includes(idx)
      ? current.filter((d) => d !== idx)
      : [...current, idx].sort((a, b) => a - b);
    onChange({ ...activity, preferredDays: next });
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 p-4 space-y-3">
      {/* Name + remove */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={activity.name}
          onChange={(e) => onChange({ ...activity, name: e.target.value })}
          placeholder="Activity name (e.g. Gym)"
          className="flex-1 text-sm font-semibold bg-transparent border-b border-zinc-200 dark:border-zinc-700 pb-1 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={onRemove}
          className="shrink-0 p-1 rounded text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
          aria-label="Remove"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="w-4 h-4"
          >
            <path
              fillRule="evenodd"
              d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Config row */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 bg-zinc-50 dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1">
          <button
            onClick={() =>
              onChange({
                ...activity,
                timesPerWeek: Math.max(1, activity.timesPerWeek - 1),
              })
            }
            className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold text-sm"
          >
            −
          </button>
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 w-4 text-center">
            {activity.timesPerWeek}
          </span>
          <button
            onClick={() =>
              onChange({
                ...activity,
                timesPerWeek: Math.min(7, activity.timesPerWeek + 1),
              })
            }
            className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 font-bold text-sm"
          >
            +
          </button>
          <span className="text-xs text-zinc-400 ml-0.5">×/wk</span>
        </div>

        <Select
          value={activity.durationMinutes}
          onChange={(v) => onChange({ ...activity, durationMinutes: v })}
          options={DURATION_OPTIONS.map((d) => ({
            value: d,
            label:
              d >= 60 ? `${d / 60}h${d % 60 ? ` ${d % 60}m` : ""}` : `${d} min`,
          }))}
        />

        <Select
          value={activity.preferredTime}
          onChange={(v) => onChange({ ...activity, preferredTime: v })}
          options={PREFERRED_TIME_OPTIONS}
        />
      </div>

      {/* Preferred days */}
      <div>
        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-1.5 font-medium">
          Preferred days <span className="font-normal">(optional)</span>
        </p>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, idx) => {
            const active = (activity.preferredDays ?? []).includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                className={`w-8 h-8 rounded-full text-[11px] font-semibold transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "bg-zinc-100 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-600"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function PreferencesPanel({
  prefs,
  onChange,
  onSave,
  onScheduleThisWeek,
}: PreferencesPanelProps) {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSave();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
  ) {
    onChange({ ...prefs, [key]: value });
  }

  function addActivity() {
    set("activities", [
      ...prefs.activities,
      {
        id: crypto.randomUUID(),
        name: "",
        timesPerWeek: 3,
        durationMinutes: 60,
        preferredTime: "morning" as PreferredTime,
        preferredDays: [],
      },
    ]);
  }

  function updateActivity(id: string, updated: RecurringActivity) {
    set(
      "activities",
      prefs.activities.map((a) => (a.id === id ? updated : a)),
    );
  }

  function removeActivity(id: string) {
    set(
      "activities",
      prefs.activities.filter((a) => a.id !== id),
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900">
      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {/* ── Row 1: Profile + Work Schedule ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            {/* Profile */}
            <section>
              <SectionHeader>Profile</SectionHeader>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Home location</FieldLabel>
                  <TextInput
                    value={prefs.homeLocation}
                    onChange={(v) => set("homeLocation", v)}
                    placeholder="e.g. San Francisco, CA"
                  />
                </div>
                <div>
                  <FieldLabel>Work location</FieldLabel>
                  <TextInput
                    value={prefs.workLocation}
                    onChange={(v) => set("workLocation", v)}
                    placeholder="e.g. Remote or 123 Main St, SF"
                  />
                </div>
                <div>
                  <FieldLabel>Nearest airport</FieldLabel>
                  <TextInput
                    value={prefs.nearestAirport}
                    onChange={(v) => set("nearestAirport", v)}
                    placeholder="e.g. SFO"
                  />
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Used as default departure for flight searches.
                  </p>
                </div>
              </div>
            </section>

            {/* Work schedule */}
            <section>
              <SectionHeader>Work Schedule</SectionHeader>
              <div className="space-y-4">
                <div>
                  <FieldLabel>Work days</FieldLabel>
                  <div className="flex gap-1.5">
                    {DAY_FULL.map((name, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          const next = [...prefs.workDays];
                          next[idx] = !next[idx];
                          set("workDays", next);
                        }}
                        className={`flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                          prefs.workDays[idx]
                            ? "bg-blue-600 text-white shadow-sm"
                            : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300"
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <FieldLabel>Work hours</FieldLabel>
                  <div className="flex items-center gap-2">
                    <TimeInput
                      value={prefs.workStartTime}
                      onChange={(v) => set("workStartTime", v)}
                    />
                    <span className="text-xs text-zinc-400">to</span>
                    <TimeInput
                      value={prefs.workEndTime}
                      onChange={(v) => set("workEndTime", v)}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>
                    Lunch break{" "}
                    <span className="font-normal text-zinc-400">
                      (optional)
                    </span>
                  </FieldLabel>
                  <div className="flex items-center gap-2">
                    <TimeInput
                      value={prefs.lunchBreakStart}
                      onChange={(v) => set("lunchBreakStart", v)}
                    />
                    <span className="text-xs text-zinc-400">to</span>
                    <TimeInput
                      value={prefs.lunchBreakEnd}
                      onChange={(v) => set("lunchBreakEnd", v)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Buffer between meetings</FieldLabel>
                    <Select
                      value={prefs.bufferMinutes}
                      onChange={(v) => set("bufferMinutes", v as BufferMinutes)}
                      className="w-full"
                      options={[
                        { value: 0, label: "None" },
                        { value: 5, label: "5 min" },
                        { value: 10, label: "10 min" },
                        { value: 15, label: "15 min" },
                        { value: 30, label: "30 min" },
                      ]}
                    />
                  </div>
                  <div>
                    <FieldLabel>Default meeting length</FieldLabel>
                    <Select
                      value={prefs.defaultMeetingDuration}
                      onChange={(v) => set("defaultMeetingDuration", v)}
                      className="w-full"
                      options={[
                        { value: 15, label: "15 min" },
                        { value: 30, label: "30 min" },
                        { value: 45, label: "45 min" },
                        { value: 60, label: "1 hour" },
                      ]}
                    />
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* ── Recurring Activities ── */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <SectionHeader>Recurring Activities</SectionHeader>
              <button
                onClick={addActivity}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                + Add activity
              </button>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 -mt-3">
              Activities you want scheduled every week. The AI will find open
              slots, respect your preferred times, and avoid conflicts.
            </p>

            {prefs.activities.length === 0 ? (
              <button
                onClick={addActivity}
                className="w-full py-8 rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 text-sm text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
              >
                + Add your first recurring activity
              </button>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {prefs.activities.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    onChange={(updated) => updateActivity(a.id, updated)}
                    onRemove={() => removeActivity(a.id)}
                  />
                ))}
                <button
                  onClick={addActivity}
                  className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 py-6 text-sm text-zinc-400 hover:border-blue-400 hover:text-blue-500 transition-colors"
                >
                  + Add activity
                </button>
              </div>
            )}
          </section>

          {/* ── AI Settings ── */}
          <section>
            <SectionHeader>AI Settings</SectionHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div>
                  <FieldLabel>Response style</FieldLabel>
                  <div className="flex gap-2">
                    <ToggleButton
                      active={prefs.communicationStyle === "concise"}
                      onClick={() => set("communicationStyle", "concise")}
                    >
                      Concise
                    </ToggleButton>
                    <ToggleButton
                      active={prefs.communicationStyle === "detailed"}
                      onClick={() => set("communicationStyle", "detailed")}
                    >
                      Detailed
                    </ToggleButton>
                  </div>
                </div>

                <div>
                  <FieldLabel>Units</FieldLabel>
                  <div className="flex gap-2">
                    <ToggleButton
                      active={prefs.units === "imperial"}
                      onClick={() => set("units", "imperial")}
                    >
                      Imperial (°F, mi)
                    </ToggleButton>
                    <ToggleButton
                      active={prefs.units === "metric"}
                      onClick={() => set("units", "metric")}
                    >
                      Metric (°C, km)
                    </ToggleButton>
                  </div>
                </div>
              </div>

              <div>
                <FieldLabel>Additional context for AI</FieldLabel>
                <textarea
                  value={prefs.additionalContext}
                  onChange={(e) =>
                    set("additionalContext", e.target.value.slice(0, 500))
                  }
                  rows={5}
                  maxLength={500}
                  placeholder="e.g. I prefer not to schedule anything before 9:30 on Mondays. I have a standing team lunch on Fridays at noon."
                  className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-all"
                />
                <p className="text-[10px] text-zinc-400 text-right mt-1">
                  {prefs.additionalContext.length} / 500
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-8 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-xs text-zinc-400">
            Preferences are saved locally and included with every AI request.
          </p>
          <div className="flex items-center gap-3">
            {saved && (
              <span className="text-xs text-green-600 dark:text-green-400 font-medium transition-opacity">
                Saved
              </span>
            )}
            {prefs.activities.some((a) => a.name.trim()) && (
              <button
                onClick={onScheduleThisWeek}
                className="px-4 py-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
              >
                Schedule this week
              </button>
            )}
            <button
              onClick={handleSave}
              className="px-5 py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
            >
              Save preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
