import { describe, it, expect } from "vitest";
import { computePanchang } from "./panchang.js";

// Fixed reference date so tests are deterministic — not testing astronomical
// correctness against a published panchang (that needs a human/reference-app
// cross-check), just structural sanity: every index in-range, internally
// consistent, and doesn't throw across a spread of dates/locations.
const REF_DATE = new Date("2026-07-25T06:00:00+05:30"); // Ujjain-ish local morning
const UJJAIN = { lat: 23.1765, lon: 75.7885 };

describe("panchang.js — computePanchang structural sanity", () => {
  it("returns all expected fields for a normal date", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    for (const field of ["tithi", "nakshatra", "yoga", "karana", "ritu", "vaar", "muhurta", "hinduMonth", "vikramSamvat"]) {
      expect(p).toHaveProperty(field);
    }
  });

  it("tithi index is 0..29 and paksha matches the half", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.tithi.index).toBeGreaterThanOrEqual(0);
    expect(p.tithi.index).toBeLessThan(30);
    expect(p.tithi.inPaksha).toBeGreaterThanOrEqual(1);
    expect(p.tithi.inPaksha).toBeLessThanOrEqual(15);
    expect(["shukla", "krishna"]).toContain(p.tithi.paksha);
    expect(p.tithi.paksha).toBe(p.tithi.index < 15 ? "shukla" : "krishna");
  });

  it("nakshatra index is 0..26, pada is 1..4", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.nakshatra.index).toBeGreaterThanOrEqual(0);
    expect(p.nakshatra.index).toBeLessThan(27);
    expect(p.nakshatra.pada).toBeGreaterThanOrEqual(1);
    expect(p.nakshatra.pada).toBeLessThanOrEqual(4);
  });

  it("yoga index is 0..26, ritu index is 0..5", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.yoga.index).toBeGreaterThanOrEqual(0);
    expect(p.yoga.index).toBeLessThan(27);
    expect(p.ritu.index).toBeGreaterThanOrEqual(0);
    expect(p.ritu.index).toBeLessThan(6);
  });

  it("vaar index matches the JS Date weekday exactly (no off-by-one)", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.vaar.index).toBe(REF_DATE.getDay());
  });

  it("sunrise is before sunset on the same day", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.sunrise).toBeInstanceOf(Date);
    expect(p.sunset).toBeInstanceOf(Date);
    expect(p.sunrise.getTime()).toBeLessThan(p.sunset.getTime());
  });

  it("muhurta index is 0..29 when sunrise is known", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.muhurta.index).toBeGreaterThanOrEqual(0);
    expect(p.muhurta.index).toBeLessThan(30);
  });

  it("hinduMonth/vikramSamvat are explicitly marked approximate (honesty check)", () => {
    const p = computePanchang(REF_DATE, UJJAIN.lat, UJJAIN.lon);
    expect(p.hinduMonth.approximate).toBe(true);
    expect(p.vikramSamvat.approximate).toBe(true);
    expect(p.vikramSamvat.value).toBeGreaterThan(2000); // sanity: plausible VS year
  });

  it("does not throw across a spread of dates and locations", () => {
    const dates = [
      new Date("2026-01-01T05:00:00+05:30"),
      new Date("2026-04-15T12:00:00+05:30"),
      new Date("2026-12-31T23:00:00+05:30"),
    ];
    const locations = [UJJAIN, { lat: 28.6139, lon: 77.2090 }, { lat: 13.0827, lon: 80.2707 }];
    for (const d of dates) {
      for (const loc of locations) {
        expect(() => computePanchang(d, loc.lat, loc.lon)).not.toThrow();
      }
    }
  });
});
