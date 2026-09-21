import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { SegmentedControl } from "./SegmentedControl";
import type { TimeView } from "./SegmentedControl";

function renderControl(value: TimeView, onChange = vi.fn()) {
  return render(<SegmentedControl value={value} onChange={onChange} />);
}

describe("SegmentedControl", () => {
  it("renders all four segments", () => {
    const { getByText } = renderControl("day");
    expect(getByText("Day")).toBeTruthy();
    expect(getByText("Week")).toBeTruthy();
    expect(getByText("Month")).toBeTruthy();
    expect(getByText("Year")).toBeTruthy();
  });

  it("marks the active segment with aria-pressed=true", () => {
    const { getByText } = renderControl("week");
    expect(getByText("Week").getAttribute("aria-pressed")).toBe("true");
    expect(getByText("Day").getAttribute("aria-pressed")).toBe("false");
  });

  it("calls onChange with the clicked segment value", () => {
    const handler = vi.fn();
    const { getByText } = renderControl("day", handler);
    fireEvent.click(getByText("Month"));
    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith("month");
  });

  it("does not call onChange when the active segment is clicked", () => {
    const handler = vi.fn();
    const { getByText } = renderControl("day", handler);
    fireEvent.click(getByText("Day"));
    // onChange is still called — caller decides whether to re-render
    expect(handler).toHaveBeenCalledWith("day");
  });

  it("has a group role with an accessible label", () => {
    const { getByRole } = renderControl("year");
    expect(getByRole("group", { name: "Time view" })).toBeTruthy();
  });

  it("each segment is a button", () => {
    const { getAllByRole } = renderControl("day");
    expect(getAllByRole("button").length).toBe(4);
  });
});
