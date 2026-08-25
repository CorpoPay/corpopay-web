import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "@/components/shared/StatusBadge";

describe("StatusBadge", () => {
  it("renders the raw status when there is no label override", () => {
    render(<StatusBadge status="SUCCEEDED" />);
    expect(screen.getByText("SUCCEEDED")).toBeInTheDocument();
  });

  it("renders the abbreviated label for known statuses", () => {
    render(<StatusBadge status="REQUIRES_ACTION" />);
    expect(screen.getByText("Action Req.")).toBeInTheDocument();
  });
});
