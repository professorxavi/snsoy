import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * The containment check on the local image route.
 *
 * This route exists only in development, but it takes a user-controlled path
 * and joins it onto a directory on disk — so the check that the result is still
 * inside that directory is the whole of its security. Nothing else in the repo
 * covers it, and the failure mode is silent: a refactor that moves the
 * comparison, or swaps `resolve` for a string prefix test, keeps every image
 * working and starts serving whatever else it is pointed at.
 *
 * The env module reads `CONTENT_IMAGE_DIR` at import time, so it is mocked to
 * a real temporary directory rather than the developer's own copy. That also
 * makes the traversal targets safe to assert on: the file the test tries to
 * escape to is one it created itself, one level above the root.
 */

const root = mkdtempSync(join(tmpdir(), "snsoy-media-"));
const served = join(root, "public");
const OUTSIDE = "outside.txt";

vi.mock("@/env", () => ({ env: { CONTENT_IMAGE_DIR: join(root, "public") } }));

let GET: typeof import("./route").GET;

/** Next decodes catch-all segments before handing them over, so these are raw. */
const request = async (segments: string[]) =>
  GET(new Request("http://localhost/api/media"), {
    params: Promise.resolve({ path: segments }),
  });

beforeAll(async () => {
  mkdirSync(join(served, "races"), { recursive: true });
  writeFileSync(join(served, "races", "dwarf.webp"), "not really a webp");
  // One level above the served root — the thing traversal would reach.
  writeFileSync(join(root, OUTSIDE), "secret");

  ({ GET } = await import("./route"));
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("the media route", () => {
  describe("serving a file inside the root", () => {
    it("returns it with the type its extension implies", async () => {
      const response = await request(["races", "dwarf.webp"]);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/webp");
      expect(response.headers.get("Content-Length")).toBe("17");
    });

    it("404s a file that is not there", async () => {
      expect((await request(["races", "missing.webp"])).status).toBe(404);
    });

    /** A directory is not a file, and streaming one throws rather than 404s. */
    it("404s a directory", async () => {
      expect((await request(["races"])).status).toBe(404);
    });
  });

  describe("containment", () => {
    /**
     * Each of these resolves outside the root. They are written as separate
     * cases because they defeat different naive checks: a `..` string match, a
     * separator assumption, and a prefix comparison that forgets the trailing
     * separator.
     */
    const escapes: [string, string[]][] = [
      ["a parent segment", ["..", OUTSIDE]],
      ["a parent segment below a real one", ["races", "..", "..", OUTSIDE]],
      ["several parent segments", ["..", "..", "..", "etc", "passwd"]],
      ["a parent segment inside one string", [`../${OUTSIDE}`]],
      ["a backslash separator", [`..\\${OUTSIDE}`]],
      ["an absolute path", [sep === "\\" ? "C:\\Windows\\win.ini" : "/etc/passwd"]],
    ];

    it.each(escapes)("refuses %s", async (_label, segments) => {
      const response = await request(segments);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain("secret");
    });

    /**
     * The sibling-prefix case: a directory next to the root whose name starts
     * with the root's. A `startsWith(root)` test with no separator lets it
     * through.
     */
    it("refuses a sibling directory that merely starts with the root's name", async () => {
      const sibling = `${served}-evil`;
      mkdirSync(sibling, { recursive: true });
      writeFileSync(join(sibling, "leak.txt"), "secret");

      const response = await request(["..", "public-evil", "leak.txt"]);

      expect(response.status).toBe(404);
      rmSync(sibling, { recursive: true, force: true });
    });

    it("still serves the root's own files after all that", async () => {
      expect((await request(["races", "dwarf.webp"])).status).toBe(200);
    });
  });

  describe("with no image directory configured", () => {
    it("404s rather than serving from the process's working directory", async () => {
      vi.resetModules();
      vi.doMock("@/env", () => ({ env: { CONTENT_IMAGE_DIR: undefined } }));

      const { GET: unconfigured } = await import("./route");
      const response = await unconfigured(
        new Request("http://localhost/api/media"),
        { params: Promise.resolve({ path: ["races", "dwarf.webp"] }) },
      );

      expect(response.status).toBe(404);
      vi.doUnmock("@/env");
      vi.resetModules();
    });
  });
});
