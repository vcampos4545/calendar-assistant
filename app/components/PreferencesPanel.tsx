"use client";

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
  onClose: () => void;
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
// Small reusable pieces
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3">
      {children}
    </p>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
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
      className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
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
      className="text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-colors"
    />
  );
}

function Select<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        const opt = options.find((o) => String(o.value) === raw);
        if (opt) onChange(opt.value);
      }}
      className="text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-2 py-1.5 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Recurring activity row
// ---------------------------------------------------------------------------

function ActivityRow({
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-3 space-y-2.5 bg-zinc-50 dark:bg-zinc-800/50">
      {/* Name + remove */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={activity.name}
          onChange={(e) => onChange({ ...activity, name: e.target.value })}
          placeholder="Activity name"
          className="flex-1 text-sm font-medium bg-transparent border-b border-zinc-200 dark:border-zinc-700 pb-0.5 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:border-blue-500 transition-colors"
        />
        <button
          onClick={onRemove}
          className="shrink-0 text-zinc-400 hover:text-red-500 transition-colors"
          aria-label="Remove activity"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Frequency + duration + preferred time */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={1}
            max={7}
            value={activity.timesPerWeek}
            onChange={(e) =>
              onChange({
                ...activity,
                timesPerWeek: Math.max(1, Math.min(7, Number(e.target.value))),
              })
            }
            className="w-10 text-center text-sm bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded-md py-1 outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-xs text-zinc-500">×/week</span>
        </div>

        <Select
          value={activity.durationMinutes}
          onChange={(v) => onChange({ ...activity, durationMinutes: v })}
          options={DURATION_OPTIONS.map((d) => ({
            value: d,
            label: d >= 60 ? `${d / 60}h${d % 60 ? ` ${d % 60}m` : ""}` : `${d}m`,
          }))}
        />

        <Select
          value={activity.preferredTime}
          onChange={(v) => onChange({ ...activity, preferredTime: v })}
          options={PREFERRED_TIME_OPTIONS}
        />
      </div>

      {/* Optional preferred days */}
      <div>
        <p className="text-[10px] text-zinc-400 mb-1.5">Preferred days (optional)</p>
        <div className="flex gap-1">
          {DAY_LABELS.map((label, idx) => {
            const active = (activity.preferredDays ?? []).includes(idx);
            return (
              <button
                key={idx}
                onClick={() => toggleDay(idx)}
                className={`w-7 h-7 rounded-full text-[11px] font-semibold transition-colors ${
                  active
                    ? "bg-blue-600 text-white"
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
  onClose,
}: PreferencesPanelProps) {
  function set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) {
    onChange({ ...prefs, [key]: value });
  }

  function addActivity() {
    const newActivity: RecurringActivity = {
      id: crypto.randomUUID(),
      name: "",
      timesPerWeek: 3,
      durationMinutes: 60,
      preferredTime: "morning",
      preferredDays: [],
    };
    set("activities", [...prefs.activities, newActivity]);
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
    <div className="w-[340px] shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-white dark:bg-zinc-900">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Preferences
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Close preferences"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      </div>

      {/* Scrollable form body */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* ── Profile ── */}
        <section>
          <SectionHeader>Profile</SectionHeader>
          <div className="space-y-3">
            <div>
              <Label>Home location</Label>
              <TextInput
                value={prefs.homeLocation}
                onChange={(v) => set("homeLocation", v)}
                placeholder="e.g. San Francisco, CA"
              />
            </div>
            <div>
              <Label>Work location</Label>
              <TextInput
                value={prefs.workLocation}
                onChange={(v) => set("workLocation", v)}
                placeholder="e.g. Remote or 123 Main St"
              />
            </div>
            <div>
              <Label>Nearest airport</Label>
              <TextInput
                value={prefs.nearestAirport}
                onChange={(v) => set("nearestAirport", v)}
                placeholder="e.g. SFO"
              />
            </div>
          </div>
        </section>

        {/* ── Work Schedule ── */}
        <section>
          <SectionHeader>Work Schedule</SectionHeader>
          <div className="space-y-3">
            <div>
              <Label>Work days</Label>
              <div className="flex gap-1.5 mt-1">
                {DAY_FULL.map((name, idx) => {
                  const active = prefs.workDays[idx];
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        const next = [...prefs.workDays];
                        next[idx] = !next[idx];
                        set("workDays", next);
                      }}
                      className={`flex-1 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                        active
                          ? "bg-blue-600 text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <Label>Work hours</Label>
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
              <Label>Lunch break (optional)</Label>
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

            <div>
              <Label>Buffer between meetings</Label>
              <Select
                value={prefs.bufferMinutes}
                onChange={(v) => set("bufferMinutes", v as BufferMinutes)}
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
              <Label>Default meeting duration</Label>
              <Select
                value={prefs.defaultMeetingDuration}
                onChange={(v) => set("defaultMeetingDuration", v)}
                options={[
                  { value: 15, label: "15 min" },
                  { value: 30, label: "30 min" },
                  { value: 45, label: "45 min" },
                  { value: 60, label: "1 hour" },
                ]}
              />
            </div>
          </div>
        </section>

        {/* ── Recurring Activities ── */}
        <section>
          <SectionHeader>Recurring Activities</SectionHeader>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 leading-relaxed">
            Activities you want scheduled every week. The AI will find open slots and avoid conflicts.
          </p>
          <div className="space-y-2.5">
            {prefs.activities.map((a) => (
              <ActivityRow
                key={a.id}
                activity={a}
                onChange={(updated) => updateActivity(a.id, updated)}
                onRemove={() => removeActivity(a.id)}
              />
            ))}
          </div>
          <button
            onClick={addActivity}
            className="mt-3 w-full py-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            + Add activity
          </button>
        </section>

        {/* ── AI Settings ── */}
        <section>
          <SectionHeader>AI Settings</SectionHeader>
          <div className="space-y-3">
            <div>
              <Label>Response style</Label>
              <div className="flex gap-2 mt-1">
                {(["concise", "detailed"] as const).map((style) => (
                  <button
                    key={style}
                    onClick={() => set("communicationStyle", style)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      prefs.communicationStyle === style
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                    }`}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Units</Label>
              <div className="flex gap-2 mt-1">
                {(["imperial", "metric"] as const).map((u) => (
                  <button
                    key={u}
                    onClick={() => set("units", u)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                      prefs.units === u
                        ? "bg-blue-600 text-white border-blue-600"
                        : "bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400"
                    }`}
                  >
                    {u === "imperial" ? "Imperial (°F, mi)" : "Metric (°C, km)"}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <Label>Additional context for AI</Label>
              <textarea
                value={prefs.additionalContext}
                onChange={(e) =>
                  set("additionalContext", e.target.value.slice(0, 500))
                }
                rows={3}
                maxLength={500}
                placeholder="e.g. I prefer not to schedule anything before 9:30 on Mondays. I have a standing team lunch on Fridays."
                className="w-full text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 outline-none focus:ring-1 focus:ring-blue-500 resize-none transition-colors"
              />
              <p className="text-[10px] text-zinc-400 text-right mt-0.5">
                {prefs.additionalContext.length}/500
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Sticky footer */}
      <div className="shrink-0 border-t border-zinc-200 dark:border-zinc-800 px-4 py-3 space-y-2 bg-white dark:bg-zinc-900">
        {prefs.activities.length > 0 && (
          <button
            onClick={onScheduleThisWeek}
            className="w-full py-2 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
          >
            Schedule this week&apos;s activities
          </button>
        )}
        <button
          onClick={onSave}
          className="w-full py-2 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-sm font-medium hover:bg-zinc-700 dark:hover:bg-zinc-200 transition-colors"
        >
          Save preferences
        </button>
      </div>
    </div>
  );
}
