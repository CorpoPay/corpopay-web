import { describe, expect, it } from "vitest";
import { toMoney } from "@/lib/money";

describe("toMoney", () => {
  it("passes numbers and strings through unchanged", () => {
    expect(toMoney(1250)).toBe(1250);
    expect(toMoney("1250.00")).toBe("1250.00");
  });

  it("narrows null, undefined, and objects down to null", () => {
    expect(toMoney(null)).toBeNull();
    expect(toMoney(undefined)).toBeNull();
    expect(toMoney({ amount: 1 })).toBeNull();
  });
});
