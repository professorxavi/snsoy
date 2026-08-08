/**
 * Structural helpers for the deeply-nested plain-JSON content objects. Shared
 * by the copy resolver, the variable resolver, and the renderer.
 */

/** Apply `transform` to every string anywhere in a JSON value. */
export function walkStrings<T>(value: T, transform: (str: string) => string): T {
  if (typeof value === "string") return transform(value) as unknown as T;

  if (Array.isArray(value)) {
    return value.map((item) => walkStrings(item, transform)) as unknown as T;
  }

  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = walkStrings(item, transform);
    }
    return out as T;
  }

  return value;
}

/** Read a nested property by path. Returns undefined at any missing link. */
export function getPath(target: unknown, path: readonly string[]): unknown {
  let current = target;
  for (const key of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Write a nested property by path, creating intermediate objects as needed. */
export function setPath(
  target: Record<string, unknown>,
  path: readonly string[],
  value: unknown,
): void {
  if (!path.length) return;

  let current = target;
  for (const key of path.slice(0, -1)) {
    if (current[key] == null || typeof current[key] !== "object") {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[path[path.length - 1]] = value;
}

/** Structural equality for JSON values. */
export function deepEquals(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b || a == null || b == null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEquals(item, b[i]));
  }

  if (typeof a !== "object") return false;

  const keysA = Object.keys(a as object);
  const keysB = Object.keys(b as object);
  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) =>
    deepEquals(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key],
    ),
  );
}

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}
