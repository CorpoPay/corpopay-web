import { describe, expect, it } from "vitest";
import { statusLabel, statusVariant } from "@/lib/status";

describe("statusVariant", () => {
  it("maps provider health to NORMAL/DEGRADED/DOWN (not HEALTHY/UNHEALTHY)", () => {
    expect(statusVariant("NORMAL")).toBe("success");
    expect(statusVariant("DEGRADED")).toBe("warning");
    expect(statusVariant("DOWN")).toBe("destructive");
  });

  it("maps tenant status DISABLED (not SUSPENDED)", () => {
    expect(statusVariant("DISABLED")).toBe("secondary");
  });

  it("keeps CANCELED and CANCELLED as distinct keys with a neutral variant", () => {
    expect(statusVariant("CANCELED")).toBe("secondary");
    expect(statusVariant("CANCELLED")).toBe("secondary");
  });

  it("falls back to outline for unknown statuses", () => {
    expect(statusVariant("TOTALLY_UNKNOWN")).toBe("outline");
  });
});

describe("statusLabel", () => {
  it("abbreviates known statuses", () => {
    expect(statusLabel("REQUIRES_ACTION")).toBe("Action Req.");
    expect(statusLabel("PARTIALLY_REFUNDED")).toBe("Part. Refunded");
  });

  it("returns the status as-is otherwise", () => {
    expect(statusLabel("SUCCEEDED")).toBe("SUCCEEDED");
  });
});
