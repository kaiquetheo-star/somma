/** Monday-based week helpers for 7-day microcycles (day_index 1 = Monday … 7 = Sunday) */

export const MICROCYCLE_DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** day_index 1–7 for the current calendar day */
export function getTodayDayIndex(weekStartDate?: string | null): number {
  const today = todayDateKey();
  const weekStart = weekStartDate ?? getWeekStartMonday(today);
  return getDayIndexForDate(today, weekStart);
}

export function getWeekStartMonday(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

/** day_index 1–7 for a calendar date within the microcycle week */
export function getDayIndexForDate(dateKey: string, weekStartDate: string): number {
  const date = new Date(`${dateKey}T12:00:00`);
  const start = new Date(`${weekStartDate}T12:00:00`);
  if (Number.isNaN(date.getTime()) || Number.isNaN(start.getTime())) return 1;

  const diffMs = date.getTime() - start.getTime();
  const diffDays = Math.round(diffMs / (24 * 60 * 60 * 1000));
  return Math.min(7, Math.max(1, diffDays + 1));
}

export function dateForDayIndex(weekStartDate: string, dayIndex: number): string {
  const start = new Date(`${weekStartDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return weekStartDate;
  start.setDate(start.getDate() + dayIndex - 1);
  return start.toISOString().slice(0, 10);
}

/** Spread N training days across Mon–Sun (1–7) */
export function spreadTrainingDayIndices(trainingDaysPerWeek: number): number[] {
  const count = Math.min(7, Math.max(0, Math.round(trainingDaysPerWeek)));
  if (count >= 7) return [1, 2, 3, 4, 5, 6, 7];
  if (count === 0) return [];

  const indices = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const index =
      count === 1
        ? 4
        : Math.min(7, Math.max(1, Math.round(1 + (6 * i) / (count - 1))));
    indices.add(index);
  }

  for (let day = 1; day <= 7 && indices.size < count; day += 1) {
    indices.add(day);
  }

  return [...indices].sort((a, b) => a - b);
}
