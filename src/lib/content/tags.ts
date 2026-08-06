/**
 * Tokenizer for the inline markup found throughout corpus entry text:
 *
 *   "A target takes {@damage 8d6} fire damage"
 *   "{@spell fireball|phb|a fireball}"
 *   "{@scaledamage 8d6|3-9|1d6}"
 *
 * Tags nest ({@b bold with a {@i nested} tag}), so this cannot be a regex.
 *
 * This module is deliberately free of React and of database access: the copy
 * resolver needs it at ingest time and the renderer needs it at request time.
 */

/** A tag opens on `{` followed by one of these. `{` otherwise is literal. */
const TAG_LEADING_CHARS = new Set(["@", "="]);

export type TagSegment =
  | { kind: "text"; value: string }
  | { kind: "tag"; name: string; parts: string[]; raw: string };

/**
 * Split a string into literal text and tag segments, preserving order.
 *
 * Nested tags stay inside their parent's `parts` as raw text — the renderer
 * recurses into them, so flattening here would lose structure.
 */
export function splitByTags(input: string): TagSegment[] {
  const out: TagSegment[] = [];
  let depth = 0;
  let current = "";

  const flush = () => {
    if (!current) return;
    out.push(
      current.startsWith("{@") || current.startsWith("{=")
        ? parseTag(current)
        : { kind: "text", value: current },
    );
    current = "";
  };

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];

    if (char === "{") {
      if (!TAG_LEADING_CHARS.has(next)) {
        current += "{";
        continue;
      }
      if (depth++ > 0) {
        current += "{";
      } else {
        flush();
        current = `{${next}`;
        i++;
      }
      continue;
    }

    if (char === "}") {
      current += "}";
      if (depth !== 0 && --depth === 0) flush();
      continue;
    }

    current += char;
  }

  flush();
  return out;
}

/**
 * Parse a single `{@name part|part|part}` token.
 *
 * Pipes inside a nested tag must not split the outer tag's parts, so this
 * tracks brace depth rather than calling `String.split("|")`.
 */
export function parseTag(raw: string): TagSegment {
  const inner = raw.slice(2, -1);
  const spaceAt = inner.search(/\s/);
  const name = spaceAt === -1 ? inner : inner.slice(0, spaceAt);
  const body = spaceAt === -1 ? "" : inner.slice(spaceAt + 1);

  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (char === "{") depth++;
    else if (char === "}") depth--;

    if (char === "|" && depth === 0) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);

  return { kind: "tag", name, parts, raw };
}

/**
 * Apply a string transform to the literal text of `input`, leaving the
 * interior of every tag untouched.
 *
 * This is what makes `_copy._mod.replaceTxt` safe: rewriting "the githyanki"
 * to a proper name must not corrupt `{@creature githyanki|MM}`, whose parts
 * are lookup keys rather than prose.
 */
export function replaceOutsideTags(
  input: string,
  transform: (text: string) => string,
): string {
  return splitByTags(input)
    .map((seg) => (seg.kind === "text" ? transform(seg.value) : seg.raw))
    .join("");
}
