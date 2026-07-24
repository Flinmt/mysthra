const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { getDataRoot } = require("../data/filesystem");

const THEME_PRESET_FORMAT = "mysthra-theme-presets";
const THEME_PRESET_VERSION = 1;
const MAX_IMPORT_PRESETS = 100;
const WORLD_THEMES = new Set(["default", "ember-archive", "vampire-masquerade"]);
const COLOR_KEYS = [
  "background",
  "surface",
  "text",
  "mutedText",
  "accent",
  "secondaryAccent"
];
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

let writeQueue = Promise.resolve();

function createPresetError(message, code = "INVALID_THEME_PRESET") {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getThemePresetsPath() {
  return process.env.THEME_PRESETS_FILE
    ? path.resolve(process.env.THEME_PRESETS_FILE)
    : path.join(getDataRoot(), "theme-presets.json");
}

function normalizeHexColor(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!HEX_COLOR_PATTERN.test(trimmed)) return null;
  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase();
  }
  return trimmed.toLowerCase();
}

function normalizePresetInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw createPresetError("Theme preset must be an object");
  }

  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!name || name.length > 60) {
    throw createPresetError("Theme preset name must contain between 1 and 60 characters");
  }

  if (!WORLD_THEMES.has(value.baseTheme)) {
    throw createPresetError("Theme preset base theme is invalid");
  }

  if (!value.colors || typeof value.colors !== "object" || Array.isArray(value.colors)) {
    throw createPresetError("Theme preset colors are required");
  }

  const colors = {};
  for (const key of COLOR_KEYS) {
    const normalized = normalizeHexColor(value.colors[key]);
    if (!normalized) {
      throw createPresetError(`Theme preset color "${key}" must be a valid hexadecimal color`);
    }
    colors[key] = normalized;
  }

  return { name, baseTheme: value.baseTheme, colors };
}

async function readPresetStore() {
  const presetPath = getThemePresetsPath();
  try {
    const content = await fs.readFile(presetPath, "utf-8");
    const parsed = JSON.parse(content);
    if (parsed?.version !== THEME_PRESET_VERSION || !Array.isArray(parsed.items)) {
      throw createPresetError("Theme preset store has an unsupported format");
    }
    return parsed.items;
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function writePresetStore(items) {
  const presetPath = getThemePresetsPath();
  const directory = path.dirname(presetPath);
  const temporaryPath = `${presetPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await fs.mkdir(directory, { recursive: true });
  try {
    await fs.writeFile(
      temporaryPath,
      JSON.stringify({ version: THEME_PRESET_VERSION, items }, null, 2),
      "utf-8"
    );
    await fs.rename(temporaryPath, presetPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

function runPresetWrite(operation) {
  const queuedOperation = writeQueue.then(operation, operation);
  writeQueue = queuedOperation.catch(() => {});
  return queuedOperation;
}

function getUniquePresetName(requestedName, usedNames) {
  if (!usedNames.has(requestedName.toLocaleLowerCase())) {
    usedNames.add(requestedName.toLocaleLowerCase());
    return requestedName;
  }

  let suffix = 2;
  let candidate = `${requestedName} (${suffix})`;
  while (usedNames.has(candidate.toLocaleLowerCase())) {
    suffix += 1;
    candidate = `${requestedName} (${suffix})`;
  }
  usedNames.add(candidate.toLocaleLowerCase());
  return candidate;
}

function createStoredPreset(input, name = input.name) {
  return {
    id: crypto.randomUUID(),
    name,
    baseTheme: input.baseTheme,
    colors: input.colors,
    createdAt: Date.now()
  };
}

async function listThemePresets() {
  return readPresetStore();
}

async function createThemePreset(value) {
  const normalized = normalizePresetInput(value);
  return runPresetWrite(async () => {
    const items = await readPresetStore();
    const usedNames = new Set(items.map((item) => String(item.name).toLocaleLowerCase()));
    const preset = createStoredPreset(
      normalized,
      getUniquePresetName(normalized.name, usedNames)
    );
    await writePresetStore([...items, preset]);
    return preset;
  });
}

function normalizeImportPayload(payload) {
  if (
    !payload ||
    payload.format !== THEME_PRESET_FORMAT ||
    payload.version !== THEME_PRESET_VERSION ||
    !Array.isArray(payload.presets)
  ) {
    throw createPresetError("Theme preset import file has an unsupported format");
  }
  if (payload.presets.length === 0 || payload.presets.length > MAX_IMPORT_PRESETS) {
    throw createPresetError(`Theme preset import must contain between 1 and ${MAX_IMPORT_PRESETS} presets`);
  }
  return payload.presets.map(normalizePresetInput);
}

async function importThemePresets(payload) {
  const normalizedPresets = normalizeImportPayload(payload);
  return runPresetWrite(async () => {
    const items = await readPresetStore();
    const usedNames = new Set(items.map((item) => String(item.name).toLocaleLowerCase()));
    const importedItems = normalizedPresets.map((preset) => createStoredPreset(
      preset,
      getUniquePresetName(preset.name, usedNames)
    ));
    await writePresetStore([...items, ...importedItems]);
    return importedItems;
  });
}

async function deleteThemePreset(presetId) {
  return runPresetWrite(async () => {
    const items = await readPresetStore();
    const nextItems = items.filter((item) => item.id !== presetId);
    if (nextItems.length === items.length) {
      throw createPresetError("Theme preset not found", "THEME_PRESET_NOT_FOUND");
    }
    await writePresetStore(nextItems);
    return { success: true };
  });
}

module.exports = {
  THEME_PRESET_FORMAT,
  THEME_PRESET_VERSION,
  createThemePreset,
  deleteThemePreset,
  importThemePresets,
  listThemePresets,
  normalizePresetInput
};
