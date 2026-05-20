import { describe, expect, it } from "vitest";
import { buildIcsCalendar, type IcsEvent } from "@/lib/ical";

describe("buildIcsCalendar", () => {
  const sampleEvent: IcsEvent = {
    uid: "test-uid@local",
    start: new Date("2026-05-20T14:30:00.000Z"),
    end: new Date("2026-05-20T15:30:00.000Z"),
    summary: "Besichtigung, Test",
    description: "Line1\nLine2",
    location: "Bremen, DE",
  };

  it("wraps events in VCALENDAR", () => {
    const body = buildIcsCalendar([sampleEvent], "PickHome Test");
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("END:VCALENDAR");
    expect(body).toContain("VERSION:2.0");
    expect(body).toContain("X-WR-CALNAME:PickHome Test");
  });

  it("emits one VEVENT per input", () => {
    const body = buildIcsCalendar([sampleEvent, { ...sampleEvent, uid: "b@local" }], "Cal");
    expect(body.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(body.match(/END:VEVENT/g)?.length).toBe(2);
  });

  it("escapes commas and newlines in text fields", () => {
    const body = buildIcsCalendar([sampleEvent], "Cal");
    expect(body).toContain("SUMMARY:Besichtigung\\, Test");
    expect(body).toContain("DESCRIPTION:Line1\\nLine2");
    expect(body).toContain("LOCATION:Bremen\\, DE");
  });

  it("formats DTSTART/DTEND without separators or milliseconds", () => {
    const body = buildIcsCalendar([sampleEvent], "Cal");
    expect(body).toMatch(/DTSTART:20260520T143000Z/);
    expect(body).toMatch(/DTEND:20260520T153000Z/);
    expect(body).not.toMatch(/DTSTART:2026-05-20/);
  });
});
