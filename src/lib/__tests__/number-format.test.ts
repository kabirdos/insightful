import { describe, it, expect } from "vitest";
import {
  formatCompactNumber,
  formatInteger,
  formatCompactCurrency,
} from "../number-format";

describe("formatCompactNumber", () => {
  it("renders values under 1k as raw with commas", () => {
    expect(formatCompactNumber(0)).toBe("0");
    expect(formatCompactNumber(42)).toBe("42");
    expect(formatCompactNumber(999)).toBe("999");
  });

  it("rolls into the k tier at 1,000", () => {
    expect(formatCompactNumber(1_000)).toBe("1.0k");
    expect(formatCompactNumber(12_345)).toBe("12.3k");
  });

  it("drops the decimal at ≥ 100 within a tier", () => {
    expect(formatCompactNumber(99_400)).toBe("99.4k");
    expect(formatCompactNumber(100_000)).toBe("100k");
    expect(formatCompactNumber(417_200_000)).toBe("417M");
  });

  it("renders the M tier for 1M – 999M", () => {
    expect(formatCompactNumber(1_000_000)).toBe("1.0M");
    expect(formatCompactNumber(12_300_000)).toBe("12.3M");
    expect(formatCompactNumber(999_000_000)).toBe("999M");
  });

  it("rolls into the B tier at 1,000,000,000", () => {
    expect(formatCompactNumber(1_000_000_000)).toBe("1.0B");
    expect(formatCompactNumber(11_307_500_000)).toBe("11.3B");
    expect(formatCompactNumber(5_086_539_595)).toBe("5.1B");
  });

  it("rolls into the T tier at one trillion", () => {
    expect(formatCompactNumber(1_000_000_000_000)).toBe("1.0T");
    expect(formatCompactNumber(2_500_000_000_000)).toBe("2.5T");
  });

  it("handles bigint input (for totalTokens column)", () => {
    expect(formatCompactNumber(BigInt(11_307_500_000))).toBe("11.3B");
    expect(formatCompactNumber(BigInt(0))).toBe("0");
  });

  it("handles negative numbers with a leading minus", () => {
    expect(formatCompactNumber(-1_200)).toBe("-1.2k");
    expect(formatCompactNumber(-5_086_539_595)).toBe("-5.1B");
  });

  it("returns '0' for non-finite input", () => {
    expect(formatCompactNumber(Number.NaN)).toBe("0");
    expect(formatCompactNumber(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("formatInteger", () => {
  it("adds thousands separators to raw integers", () => {
    expect(formatInteger(0)).toBe("0");
    expect(formatInteger(42)).toBe("42");
    expect(formatInteger(1_234)).toBe("1,234");
    expect(formatInteger(5_086_539_595)).toBe("5,086,539,595");
  });

  it("handles bigint input", () => {
    expect(formatInteger(BigInt(5_086_539_595))).toBe("5,086,539,595");
  });

  it("rounds fractional numbers before formatting", () => {
    expect(formatInteger(1_234.7)).toBe("1,235");
  });
});

describe("formatCompactCurrency", () => {
  it("shows two-decimal precision under $1 so pennies stay visible", () => {
    expect(formatCompactCurrency(0.04)).toBe("$0.04");
    expect(formatCompactCurrency(0.5)).toBe("$0.50");
  });

  it("drops decimals between $1 and $999", () => {
    expect(formatCompactCurrency(1)).toBe("$1");
    expect(formatCompactCurrency(123.45)).toBe("$123");
  });

  it("uses compact tiers for $1k+", () => {
    expect(formatCompactCurrency(1_234)).toBe("$1.2k");
    expect(formatCompactCurrency(1_234_567)).toBe("$1.2M");
  });

  it("handles non-finite input as $0", () => {
    expect(formatCompactCurrency(Number.NaN)).toBe("$0");
  });
});
