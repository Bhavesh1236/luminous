// @vitest-environment node
//
// The AppImage (and .deb/.rpm) use the host's glibc, so their glibc floor is
// the Linux build runner's. v3.0.0 was built on ubuntu-24.04 and needed
// glibc 2.39: it didn't start on Ubuntu 22.04 / Debian 12 or in the AppImage
// catalog's test (#1700). These pin the runner, the guard that checks the
// result, and the linux_only re-run that replaced v3.0.0's Linux assets.
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../../..");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf-8");

describe("release.yml: Linux glibc floor", () => {
  it("builds the Linux installers on ubuntu-22.04, never a newer image", () => {
    const platform = workflow.match(/^\s*platform:\s*(.+)$/m)?.[1] ?? "";
    expect(platform).toContain("ubuntu-22.04");
    expect(platform).not.toMatch(/ubuntu-(2[4-9]|latest)/);
  });

  it("keys the Rust cache on the runner image", () => {
    expect(workflow).toMatch(/uses:\s*Swatinem\/rust-cache@\S+\s+with:\s+key:\s*\$\{\{\s*matrix\.platform\s*\}\}/);
  });

  it("checks the built AppImage against glibc 2.35", () => {
    expect(workflow).toMatch(/check-glibc-floor\.sh "\$\{APPIMAGES\[0\]\}" 2\.35/);
    expect(fs.existsSync(path.join(root, "scripts/check-glibc-floor.sh"))).toBe(true);
  });
});

describe("release.yml: linux_only re-run", () => {
  it("builds the release's tag rather than the dispatching branch", () => {
    expect(workflow).toMatch(/ref:\s*\$\{\{\s*needs\.create-release\.outputs\.tag\s*\}\}/);
  });

  it("drops the Windows leg and the Flatpak job", () => {
    expect(workflow).toMatch(/inputs\.linux_only && '\["ubuntu-22\.04"\]'/);
    expect(workflow).toMatch(/flatpak-build:[\s\S]*?if:[^\n]*!inputs\.linux_only/);
  });

  it("refuses to create a new release", () => {
    expect(workflow).toMatch(/inputs\.linux_only \}\}" == "true" \]\]; then\s+echo "::error::/);
  });
});
