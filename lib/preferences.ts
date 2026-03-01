// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PreferredTime = "morning" | "afternoon" | "evening" | "any";
export type BufferMinutes = 0 | 5 | 10 | 15 | 30;
export type CommunicationStyle = "concise" | "detailed";
export type Units = "imperial" | "metric";

export interface RecurringActivity {
  id: string;
  name: string;
  timesPerWeek: number; // 1–7
  durationMinutes: number; // 15 | 30 | 45 | 60 | 90 | 120
  preferredTime: PreferredTime;
  preferredDays?: number[]; // 0=Sun…6=Sat; empty = any day
}

export interface UserPreferences {
  // Location
  homeLocation: string; // e.g. "San Francisco, CA"
  workLocation: string; // e.g. "Remote" or a street address
  nearestAirport: string; // IATA code or city, e.g. "SFO"
  // Work schedule
  workDays: boolean[]; // length 7, index 0=Sun…6=Sat
  workStartTime: string; // "HH:MM" 24-hour
  workEndTime: string; // "HH:MM" 24-hour
  bufferMinutes: BufferMinutes; // padding between meetings
  lunchBreakStart: string; // "HH:MM" or "" to disable
  lunchBreakEnd: string; // "HH:MM" or "" to disable
  defaultMeetingDuration: number; // minutes: 15 | 30 | 45 | 60
  // Recurring activities
  activities: RecurringActivity[];
  // AI behavior
  communicationStyle: CommunicationStyle;
  units: Units;
  additionalContext: string; // free-form notes, max 500 chars
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PREFERENCES: UserPreferences = {
  homeLocation: "",
  workLocation: "",
  nearestAirport: "",
  workDays: [false, true, true, true, true, true, false], // Mon–Fri
  workStartTime: "09:00",
  workEndTime: "18:00",
  bufferMinutes: 0,
  lunchBreakStart: "",
  lunchBreakEnd: "",
  defaultMeetingDuration: 30,
  activities: [],
  communicationStyle: "concise",
  units: "imperial",
  additionalContext: "",
};

// ---------------------------------------------------------------------------
// localStorage helpers (client-side only)
// ---------------------------------------------------------------------------

const STORAGE_KEY = "calendar-copilot-prefs";

export function loadPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    // Validate workDays array length to guard against stale stored objects
    if (
      !Array.isArray(parsed.workDays) ||
      parsed.workDays.length !== 7
    ) {
      parsed.workDays = DEFAULT_PREFERENCES.workDays;
    }
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

// ---------------------------------------------------------------------------
// System prompt context builder (safe to call server-side)
// ---------------------------------------------------------------------------

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const PREFERRED_TIME_LABELS: Record<PreferredTime, string> = {
  morning: "morning (before noon)",
  afternoon: "afternoon (12–5 PM)",
  evening: "evening (after 5 PM)",
  any: "any time of day",
};

export function buildPreferencesContext(prefs: UserPreferences): string {
  const sections: string[] = [];

  // --- Profile ---
  const profileLines: string[] = [];
  if (prefs.homeLocation) profileLines.push(`Home: ${prefs.homeLocation}`);
  if (prefs.workLocation) profileLines.push(`Work: ${prefs.workLocation}`);
  if (prefs.nearestAirport)
    profileLines.push(`Nearest airport: ${prefs.nearestAirport}`);
  if (prefs.units === "metric") profileLines.push("Units: metric (°C, km)");

  if (profileLines.length) sections.push(profileLines.join("\n"));

  // --- Work schedule ---
  const schedLines: string[] = [];
  const workDayNames = prefs.workDays
    .map((on, i) => (on ? DAY_NAMES[i] : null))
    .filter(Boolean);
  if (workDayNames.length)
    schedLines.push(`Work days: ${workDayNames.join(", ")}`);
  schedLines.push(`Work hours: ${prefs.workStartTime}–${prefs.workEndTime}`);
  if (prefs.bufferMinutes > 0)
    schedLines.push(`Buffer between meetings: ${prefs.bufferMinutes} min`);
  if (prefs.lunchBreakStart && prefs.lunchBreakEnd)
    schedLines.push(
      `Lunch break: ${prefs.lunchBreakStart}–${prefs.lunchBreakEnd} (avoid scheduling over this)`,
    );
  if (prefs.defaultMeetingDuration !== 30)
    schedLines.push(
      `Default meeting duration: ${prefs.defaultMeetingDuration} min`,
    );
  if (schedLines.length) sections.push(schedLines.join("\n"));

  // --- Recurring activities ---
  if (prefs.activities.length) {
    const lines = [
      "Recurring weekly activities (soft commitments — schedule these and avoid conflicts):",
    ];
    for (const a of prefs.activities) {
      const timeLabel = PREFERRED_TIME_LABELS[a.preferredTime];
      const dayLabel =
        a.preferredDays?.length
          ? `preferred days: ${a.preferredDays.map((d) => DAY_NAMES[d]).join("/")}`
          : "any day";
      lines.push(
        `  • ${a.name}: ${a.timesPerWeek}×/week, ${a.durationMinutes} min, ${timeLabel}, ${dayLabel}`,
      );
    }
    lines.push(
      "When a new event conflicts with a recurring activity, warn the user and offer to reschedule the activity to the next available matching slot.",
    );
    lines.push(
      'When asked to "plan my week" or "schedule my activities", use get_free_slots then create_calendar_event for each recurring activity.',
    );
    sections.push(lines.join("\n"));
  }

  // --- Additional context ---
  if (prefs.additionalContext.trim()) {
    sections.push(
      `Additional context: ${prefs.additionalContext.trim().slice(0, 500)}`,
    );
  }

  if (sections.length === 0) return "";

  return `\n\nUSER PREFERENCES\n${sections.join("\n\n")}`;
}
