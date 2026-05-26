const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

if (process.platform !== "win32") {
  process.exit(0);
}

const addonDir = path.resolve(__dirname, "..", "native", "winembed");
const desktopPkgPath = path.resolve(__dirname, "..", "package.json");
const desktopPkg = JSON.parse(fs.readFileSync(desktopPkgPath, "utf8"));
const electronVersion = String((desktopPkg.devDependencies && desktopPkg.devDependencies.electron) || "").replace(/^[^\d]*/, "");

const args = ["rebuild"];
if (electronVersion) {
  args.push(
    `--target=${electronVersion}`,
    "--runtime=electron",
    "--dist-url=https://electronjs.org/headers",
    "--arch=x64"
  );
}

const result = spawnSync("node-gyp", args, {
  cwd: addonDir,
  stdio: "inherit",
  shell: true
});

if (result.status !== 0) {
  console.warn("[WARN] Failed to build Windows embed native addon. Desktop app will run with non-embedded fallback.");
  process.exit(0);
}
