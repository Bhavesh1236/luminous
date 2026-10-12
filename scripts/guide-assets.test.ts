// @vitest-environment node
import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { USER_GUIDE_DIR, referencedAssets } from "./guide-assets.ts";

// Everything the guides reference is embedded in the exe (and in the Flatpak's single binary
// object, which GitHub caps at 100 MB). 3.0 briefly shipped 139 MB of PNGs here (#1647); the
// WebP copies are about 16 MB, so 30 MB leaves room for new screenshots without letting that recur.
const BUDGET_MB = 30;

describe("user guide assets", () => {
  const refs = referencedAssets();

  it("references WebP copies, not the PNG captures", () => {
    expect(refs.length).toBeGreaterThan(0);
    expect(refs.filter((r) => r.endsWith(".png"))).toEqual([]);
  });

  it("has every referenced asset committed", () => {
    expect(refs.filter((r) => !fs.existsSync(path.join(USER_GUIDE_DIR, r)))).toEqual([]);
  });

  it(`stays within the ${BUDGET_MB} MB embedded-size budget`, () => {
    const bytes = refs.reduce((sum, r) => sum + fs.statSync(path.join(USER_GUIDE_DIR, r)).size, 0);
    expect(bytes / 1024 / 1024).toBeLessThan(BUDGET_MB);
  });
});
