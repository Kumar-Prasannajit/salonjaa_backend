export function addSeconds(date: Date, seconds: number): Date {
  return new Date(date.getTime() + seconds * 1000);
}

export function addMinutes(date: Date, minutes: number): Date {
  return addSeconds(date, minutes * 60);
}

export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

export function addDays(date: Date, days: number): Date {
  return addHours(date, days * 24);
}

export function isPast(date: Date, reference: Date = new Date()): boolean {
  return date.getTime() < reference.getTime();
}

export function isFuture(date: Date, reference: Date = new Date()): boolean {
  return date.getTime() > reference.getTime();
}

/** True if [aStart, aEnd) overlaps [bStart, bEnd). End == start is NOT an overlap. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime();
}
