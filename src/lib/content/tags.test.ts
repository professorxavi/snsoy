import { describe, expect, it } from "vitest";
import { parseTag, replaceOutsideTags, splitByTags } from "./tags";

describe("splitByTags", () => {
  it("returns a single text segment when there is no markup", () => {
    expect(splitByTags("plain prose")).toEqual([
      { kind: "text", value: "plain prose" },
    ]);
  });

  it("separates tags from surrounding text", () => {
    const segments = splitByTags("takes {@damage 8d6} fire damage");
    expect(segments.map((s) => s.kind)).toEqual(["text", "tag", "text"]);
    expect(segments[1]).toMatchObject({ name: "damage", parts: ["8d6"] });
  });

  it("splits tag arguments on pipes", () => {
    const [segment] = splitByTags("{@spell fireball|phb|a fireball}");
    expect(segment).toMatchObject({
      kind: "tag",
      name: "spell",
      parts: ["fireball", "phb", "a fireball"],
    });
  });

  it("keeps a nested tag intact inside its parent's parts", () => {
    const [segment] = splitByTags("{@b bold with {@i italic} inside}");
    expect(segment).toMatchObject({
      kind: "tag",
      name: "b",
      parts: ["bold with {@i italic} inside"],
    });
  });

  it("does not split on a pipe that belongs to a nested tag", () => {
    const [segment] = splitByTags("{@b see {@spell fireball|phb} now}");
    expect((segment as { parts: string[] }).parts).toHaveLength(1);
  });

  it("treats a brace not followed by @ or = as literal text", () => {
    expect(splitByTags("a {literal} brace")).toEqual([
      { kind: "text", value: "a {literal} brace" },
    ]);
  });

  it("handles a tag with no arguments", () => {
    expect(parseTag("{@atk mw}")).toMatchObject({ name: "atk", parts: ["mw"] });
  });
});

describe("replaceOutsideTags", () => {
  it("rewrites literal prose", () => {
    expect(
      replaceOutsideTags("the githyanki attacks", (s) =>
        s.replace(/the githyanki/g, "Al'chaia"),
      ),
    ).toBe("Al'chaia attacks");
  });

  /**
   * The reason this function exists: tag arguments are lookup keys. Rewriting
   * inside them silently breaks cross-references.
   */
  it("leaves tag interiors untouched", () => {
    const input = "the githyanki casts {@spell githyanki bolt|MM}";
    const output = replaceOutsideTags(input, (s) =>
      s.replace(/githyanki/g, "Al'chaia"),
    );
    expect(output).toBe("the Al'chaia casts {@spell githyanki bolt|MM}");
  });

  it("round-trips a string when the transform is identity", () => {
    const input = "a {@b bold {@i nested}} thing with {@damage 1d4}";
    expect(replaceOutsideTags(input, (s) => s)).toBe(input);
  });
});
