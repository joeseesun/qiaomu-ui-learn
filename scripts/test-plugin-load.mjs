import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

// Exercise the actual bundle with the same CommonJS wrapper as Obsidian.
// A typecheck alone misses duplicate declarations in an esbuild banner.
class Plugin {
  constructor(app, manifest) { this.app = app; this.manifest = manifest; this.commands = []; }
  async loadData() { return this.app.savedData; }
  registerView(type, factory) { this.viewType = type; this.viewFactory = factory; }
  addRibbonIcon() {}
  addCommand(command) { this.commands.push(command); }
  addSettingTab() {}
}
class HostClass {}
const obsidian = new Proxy({ Plugin }, { get: (target, key) => target[key] ?? HostClass });

for (const mode of ["development", "production"]) {
  const build = spawnSync(process.execPath, ["esbuild.config.mjs", mode, "--once"], { encoding: "utf8" });
  assert.equal(build.status, 0, build.stderr);
  const code = readFileSync("main.js", "utf8");
  for (const savedData of [null, { notesFolder: "Existing notes", recents: [], learnReviews: { example: { rating: 4 } } }]) {
    const module = { exports: {} };
    const wrapper = vm.runInNewContext(`(function(require,module,exports){${code}\n})`, {
      window: { moment: { locale: () => "en" } }, console,
    }, { filename: `plugin:${mode}` });
    wrapper((name) => {
      assert.equal(name, "obsidian", `Unexpected runtime dependency: ${name}`);
      return obsidian;
    }, module, module.exports);
    assert.equal(typeof module.exports.default, "function");
    const layoutCallbacks = [];
    const app = { savedData, workspace: { onLayoutReady: (callback) => layoutCallbacks.push(callback) } };
    const plugin = new module.exports.default(app, { id: "qiaomu-ui-learn" });
    assert.ok(plugin instanceof Plugin);
    await plugin.onload();
    assert.ok(plugin.commands.some(command => command.id === "open-gallery"));
    for (const callback of layoutCallbacks) callback();
    assert.ok(plugin.flatItems.length > 13000);
    assert.equal(plugin.learnui.entries.length, 62);
    assert.equal(plugin.learnui.styles.length, 44);
    if (savedData) assert.equal(plugin.settings.notesFolder, savedData.notesFolder);
    assert.equal(plugin.catalogError, false);
    assert.equal(plugin.learnuiError, false);
    plugin.onunload();
  }
  console.log(`${mode}: bundle evaluation, fresh settings, existing settings and dataset loading passed`);
}
