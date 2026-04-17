export function getStartOfDay(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

export function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export function isWithinLast(dateStr: string, hours: number): boolean {
  const date = new Date(dateStr);
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  return date > cutoff;
}

export function formatISO(date: Date): string {
  return date.toISOString();
}
