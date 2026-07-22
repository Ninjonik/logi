import type { Clock } from "@/application/ports/clock";

export class FakeClock implements Clock {
  constructor(private current: Date) {}

  now(): Date {
    return new Date(this.current);
  }

  set(date: Date) {
    this.current = new Date(date);
  }
}
