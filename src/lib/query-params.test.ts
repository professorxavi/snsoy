import { describe, expect, it } from "vitest";
import {
  clearAll,
  hasFilters,
  readBoolean,
  readList,
  readNumberList,
  readPage,
  toggleFlag,
  toggleValue,
  withValue,
} from "./query-params";

/**
 * Filter state lives in the URL and nowhere else, so these functions *are* the
 * state layer. The behaviours worth pinning are the ones that quietly ruin a
 * browse view: stale paging after a filter change, and two spellings of the
 * same filter state producing two different URLs.
 */

describe("reading", () => {
  it("splits comma-separated values", () => {
    expect(readList({ level: "3,4,5" }, "level")).toEqual(["3", "4", "5"]);
    expect(readNumberList({ level: "3,4" }, "level")).toEqual([3, 4]);
  });

  it("drops values that are not integers rather than yielding NaN", () => {
    expect(readNumberList({ level: "3,abc,5" }, "level")).toEqual([3, 5]);
  });

  it("treats an absent flag as no opinion, not as false", () => {
    expect(readBoolean({}, "conc")).toBeUndefined();
    expect(readBoolean({ conc: "1" }, "conc")).toBe(true);
    expect(readBoolean({ conc: "0" }, "conc")).toBe(false);
  });

  it("falls back to page 1 for anything unusable", () => {
    expect(readPage({ page: "4" })).toBe(4);
    expect(readPage({ page: "0" })).toBe(1);
    expect(readPage({ page: "-2" })).toBe(1);
    expect(readPage({ page: "abc" })).toBe(1);
    expect(readPage({})).toBe(1);
  });

  it("takes the first value when a param is repeated", () => {
    expect(readList({ level: ["3", "4"] }, "level")).toEqual(["3"]);
  });
});

describe("toggleValue", () => {
  it("adds and removes a value", () => {
    expect(toggleValue({}, "level", "3")).toBe("?level=3");
    expect(toggleValue({ level: "3" }, "level", "3")).toBe("");
    expect(toggleValue({ level: "3" }, "level", "4")).toBe("?level=3%2C4");
  });

  /** Page 7 of an unfiltered list is not page 7 once a filter narrows it. */
  it("resets paging on every filter change", () => {
    expect(toggleValue({ page: "7", level: "3" }, "school", "V")).toBe(
      "?level=3&school=V",
    );
  });

  it("keeps unrelated params", () => {
    expect(toggleValue({ q: "fire", sort: "level" }, "level", "3")).toBe(
      "?level=3&q=fire&sort=level",
    );
  });

  /**
   * Keys are sorted, so one filter state has exactly one URL. Otherwise the
   * same view would be two cache entries and two history entries.
   */
  it("produces a stable URL regardless of insertion order", () => {
    const a = toggleValue({ school: "V", q: "fire" }, "level", "3");
    const b = toggleValue({ q: "fire", school: "V" }, "level", "3");
    expect(a).toBe(b);
  });
});

describe("withValue and toggleFlag", () => {
  it("sets and clears a single value", () => {
    expect(withValue({}, "sort", "level")).toBe("?sort=level");
    expect(withValue({ sort: "level" }, "sort", undefined)).toBe("");
  });

  /** Paging is the one param allowed to change without resetting itself. */
  it("does not reset paging when the change is paging", () => {
    expect(withValue({ level: "3", page: "2" }, "page", "3")).toBe(
      "?level=3&page=3",
    );
  });

  it("flips a flag off when it is already on", () => {
    expect(toggleFlag({}, "conc")).toBe("?conc=1");
    expect(toggleFlag({ conc: "1" }, "conc")).toBe("");
  });
});

describe("clearAll", () => {
  it("drops filters but can keep chosen params", () => {
    const params = { level: "3", school: "V", sort: "level", page: "2" };
    expect(clearAll(params, ["sort"])).toBe("?sort=level");
    expect(clearAll(params)).toBe("");
  });
});

describe("hasFilters", () => {
  it("ignores params that are not filters", () => {
    expect(hasFilters({ page: "3", sort: "level" }, ["level", "school"])).toBe(
      false,
    );
    expect(hasFilters({ school: "V" }, ["level", "school"])).toBe(true);
  });
});
