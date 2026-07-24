const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const {
  createThemePreset,
  deleteThemePreset,
  importThemePresets,
  listThemePresets
} = require("../../src/services/themePresets");

const colors = {
  background: "#123",
  surface: "#20252a",
  text: "#f8fafc",
  mutedText: "#abc",
  accent: "#AA55CC",
  secondaryAccent: "#14b8a6"
};

let temporaryDirectory;
let previousPresetFile;

test.before(async () => {
  temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "mysthra-theme-presets-"));
  previousPresetFile = process.env.THEME_PRESETS_FILE;
  process.env.THEME_PRESETS_FILE = path.join(temporaryDirectory, "theme-presets.json");
});

test.after(async () => {
  if (previousPresetFile === undefined) delete process.env.THEME_PRESETS_FILE;
  else process.env.THEME_PRESETS_FILE = previousPresetFile;
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
});

test("theme presets are normalized, persisted, and assigned unique names", async () => {
  const first = await createThemePreset({
    name: "  Midnight Archive  ",
    baseTheme: "default",
    colors
  });
  const second = await createThemePreset({
    name: "midnight archive",
    baseTheme: "default",
    colors
  });

  assert.equal(first.name, "Midnight Archive");
  assert.equal(first.colors.background, "#112233");
  assert.equal(first.colors.mutedText, "#aabbcc");
  assert.equal(first.colors.accent, "#aa55cc");
  assert.equal(second.name, "midnight archive (2)");
  assert.deepEqual(await listThemePresets(), [first, second]);
});

test("versioned imports are atomic and preserve conflicting presets as copies", async () => {
  const before = await listThemePresets();
  const imported = await importThemePresets({
    format: "mysthra-theme-presets",
    version: 1,
    presets: [
      { name: "Midnight Archive", baseTheme: "ember-archive", colors },
      { name: "Blood Ledger", baseTheme: "vampire-masquerade", colors }
    ]
  });

  assert.equal(imported[0].name, "Midnight Archive (3)");
  assert.equal(imported[1].name, "Blood Ledger");

  await assert.rejects(
    () => importThemePresets({
      format: "mysthra-theme-presets",
      version: 1,
      presets: [
        { name: "Valid first item", baseTheme: "default", colors },
        { name: "Invalid second item", baseTheme: "unknown", colors }
      ]
    }),
    { code: "INVALID_THEME_PRESET" }
  );
  assert.equal((await listThemePresets()).length, before.length + 2);
});

test("custom presets can be deleted and missing ids return a typed error", async () => {
  const [preset] = await listThemePresets();
  assert.deepEqual(await deleteThemePreset(preset.id), { success: true });
  assert.equal((await listThemePresets()).some((item) => item.id === preset.id), false);
  await assert.rejects(
    () => deleteThemePreset(preset.id),
    { code: "THEME_PRESET_NOT_FOUND" }
  );
});
