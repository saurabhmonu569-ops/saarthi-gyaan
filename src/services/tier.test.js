import { describe, it, expect } from "vitest";
import { isOwnerEmail, isPaidUser, OWNER_EMAIL } from "./tier.js";

describe("tier.js — owner/paid detection", () => {
  it("matches the exact owner email", () => {
    expect(isOwnerEmail(OWNER_EMAIL)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(isOwnerEmail(OWNER_EMAIL.toUpperCase())).toBe(true);
    expect(isOwnerEmail(`  ${OWNER_EMAIL}  `)).toBe(true);
  });

  it("rejects any other email", () => {
    expect(isOwnerEmail("someone.else@gmail.com")).toBe(false);
  });

  it("rejects missing/empty/null email without throwing", () => {
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });

  it("isPaidUser mirrors isOwnerEmail via profile.email", () => {
    expect(isPaidUser({ email: OWNER_EMAIL })).toBe(true);
    expect(isPaidUser({ email: "random@x.com" })).toBe(false);
    expect(isPaidUser(null)).toBe(false);
    expect(isPaidUser(undefined)).toBe(false);
  });
});
