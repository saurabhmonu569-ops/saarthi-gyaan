import { describe, it, expect, beforeEach } from "vitest";
import { featureQuotaLeft, featureQuotaUse } from "./quota.js";

const LIMIT = 5;

describe("quota.js — per-feature daily quota", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts a fresh feature at the full limit", () => {
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(LIMIT);
  });

  it("decrements by 1 on each use, down to 0", () => {
    for (let i = LIMIT; i > 0; i--) {
      expect(featureQuotaLeft("chat", LIMIT, null)).toBe(i);
      featureQuotaUse("chat", LIMIT, null);
    }
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(0);
  });

  it("never goes negative even if used past the limit", () => {
    for (let i = 0; i < LIMIT + 3; i++) featureQuotaUse("chat", LIMIT, null);
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(0);
  });

  it("keeps separate pools per feature (the actual bug this fixed)", () => {
    // Chat/PDF pool exhausted...
    for (let i = 0; i < LIMIT; i++) featureQuotaUse("chat", LIMIT, null);
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(0);
    // ...must NOT affect a different feature's pool (this was the original bug:
    // Vedic-Ask showing "0 left" because it shared Chat's pool)
    expect(featureQuotaLeft("vedic", 6, null)).toBe(6);
    expect(featureQuotaLeft("search", 5, null)).toBe(5);
  });

  it("resets to the full limit on a new day", () => {
    featureQuotaUse("chat", LIMIT, null);
    featureQuotaUse("chat", LIMIT, null);
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(LIMIT - 2);
    // Simulate a stale stored date (yesterday)
    const key = "SAARTHI_QUOTA_chat";
    const stale = JSON.parse(localStorage.getItem(key));
    stale.date = "2000-01-01";
    localStorage.setItem(key, JSON.stringify(stale));
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(LIMIT);
  });

  it("owner profile (tier.js OWNER_EMAIL) is always unlimited", () => {
    const owner = { email: "saurabhmonu569@gmail.com" };
    for (let i = 0; i < LIMIT + 5; i++) featureQuotaUse("chat", LIMIT, owner);
    expect(featureQuotaLeft("chat", LIMIT, owner)).toBe(Infinity);
  });

  it("a non-owner profile is NOT granted unlimited", () => {
    const someone = { email: "random@gmail.com" };
    expect(featureQuotaLeft("chat", LIMIT, someone)).toBe(LIMIT);
  });

  it("SAARTHI_RUNTIME_KEY (own API key) bypasses quota entirely", () => {
    localStorage.setItem("SAARTHI_RUNTIME_KEY", "gsk_test");
    expect(featureQuotaLeft("chat", LIMIT, null)).toBe(Infinity);
    expect(featureQuotaUse("chat", LIMIT, null)).toBe(Infinity);
  });
});
