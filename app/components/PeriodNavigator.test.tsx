import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { PeriodNavigator } from "./PeriodNavigator";

describe("PeriodNavigator", () => {
  const value = new Date(2026, 5, 19); // Fri 19 Jun 2026

  it("renders the current period label", () => {
    const { getByText } = render(
      <PeriodNavigator view="month" value={value} onChange={() => {}} now={value} />
    );
    expect(getByText(/June 2026/)).toBeTruthy();
  });

  it("steps forward and back", () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <PeriodNavigator view="day" value={value} onChange={onChange} now={value} />
    );

    fireEvent.click(getByLabelText("Next period"));
    fireEvent.click(getByLabelText("Previous period"));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect((onChange.mock.calls[0][0] as Date).getDate()).toBe(20);
    expect((onChange.mock.calls[1][0] as Date).getDate()).toBe(18);
  });

  it("hides the Today reset when on the current period", () => {
    const { queryByText } = render(
      <PeriodNavigator view="day" value={value} onChange={() => {}} now={value} />
    );
    expect(queryByText("Today")).toBeNull();
  });

  it("shows Today off the current period and resets to now", () => {
    const onChange = vi.fn();
    const now = new Date(2026, 5, 25);
    const { getByText } = render(
      <PeriodNavigator view="day" value={value} onChange={onChange} now={now} />
    );

    fireEvent.click(getByText("Today"));
    expect((onChange.mock.calls[0][0] as Date).getTime()).toBe(now.getTime());
  });

  it("exposes a labelled navigation group", () => {
    const { getByRole } = render(
      <PeriodNavigator view="year" value={value} onChange={() => {}} now={value} />
    );
    expect(getByRole("group", { name: "Navigate periods" })).toBeTruthy();
  });
});
