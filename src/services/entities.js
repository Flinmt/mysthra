const fs = require("node:fs/promises");
const path = require("node:path");

const { ensureWorldStructure, getWorldPaths } = require("../data");

const ENTITY_TYPES = Object.freeze([
  "character",
  "location",
  "item",
  "event"
]);

function createEntityValidationError(message, value) {
  const error = new Error(message);
  error.code = "INVALID_ENTITY";
  error.value = value;
  return error;
}

function assertNonEmptyText(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw createEntityValidationError(`${fieldName} must be a non-empty string`, value);
  }

  return value.trim();
}

function normalizeEntityType(type) {
  const normalizedType = assertNonEmptyText(type, "Entity type").toLowerCase();

  if (!ENTITY_TYPES.includes(normalizedType)) {
    throw createEntityValidationError("Entity type is not supported", type);
  }

  return normalizedType;
}

function normalizeEntityId(id) {
  const normalizedId = assertNonEmptyText(id, "Entity id")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedId) {
    throw createEntityValidationError("Entity id must contain valid characters", id);
  }

  return normalizedId;
}

function createEntityDefinition(input) {
  const type = normalizeEntityType(input?.type);
  const name = assertNonEmptyText(input?.name, "Entity name");
  const description = assertNonEmptyText(input?.description, "Entity description");
  const id = normalizeEntityId(input?.id || name);

  return {
    id,
    type,
    name,
    description
  };
}

function validateEntityDefinition(entity) {
  const normalizedEntity = createEntityDefinition(entity);

  if (entity?.id && normalizedEntity.id !== String(entity.id).trim().toLowerCase()) {
    throw createEntityValidationError("Entity id must already be normalized", entity.id);
  }

  return normalizedEntity;
}

function getEntityTypeDirectory(worldName, type) {
  const worldPaths = getWorldPaths(worldName);
  return path.join(worldPaths.entities, normalizeEntityType(type));
}

function getEntityFilePath(worldName, type, id) {
  return path.join(getEntityTypeDirectory(worldName, type), `${normalizeEntityId(id)}.json`);
}

async function ensureEntityTypeDirectory(worldName, type) {
  await ensureWorldStructure(worldName);

  const directoryPath = getEntityTypeDirectory(worldName, type);
  await fs.mkdir(directoryPath, { recursive: true });

  return directoryPath;
}

async function createEntity(worldName, input, options = {}) {
  const entity = createEntityDefinition(input);
  const allowOverwrite = options.allowOverwrite === true;

  await ensureEntityTypeDirectory(worldName, entity.type);

  const filePath = getEntityFilePath(worldName, entity.type, entity.id);

  try {
    if (!allowOverwrite) {
      await fs.access(filePath);
      const error = new Error("Entity already exists");
      error.code = "ENTITY_ALREADY_EXISTS";
      error.value = entity.id;
      throw error;
    }
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  await fs.writeFile(filePath, JSON.stringify(entity, null, 2), "utf8");

  return entity;
}

async function readEntity(worldName, type, id) {
  await ensureEntityTypeDirectory(worldName, type);

  const filePath = getEntityFilePath(worldName, type, id);

  try {
    const content = await fs.readFile(filePath, "utf8");
    const entity = JSON.parse(content);
    return validateEntityDefinition(entity);
  } catch (error) {
    if (error.code === "ENOENT") {
      const notFoundError = new Error("Entity not found");
      notFoundError.code = "ENTITY_NOT_FOUND";
      notFoundError.value = id;
      throw notFoundError;
    }

    throw error;
  }
}

async function listEntities(worldName, type) {
  await ensureEntityTypeDirectory(worldName, type);

  const directoryPath = getEntityTypeDirectory(worldName, type);
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  const entityFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));

  return Promise.all(
    entityFiles.map((entry) => readEntity(worldName, type, path.basename(entry.name, ".json")))
  );
}

async function updateEntity(worldName, type, id, input) {
  const currentEntity = await readEntity(worldName, type, id);
  const nextEntity = validateEntityDefinition({
    ...currentEntity,
    ...input,
    id: currentEntity.id,
    type: currentEntity.type
  });

  const filePath = getEntityFilePath(worldName, currentEntity.type, currentEntity.id);
  await fs.writeFile(filePath, JSON.stringify(nextEntity, null, 2), "utf8");

  return nextEntity;
}

async function deleteEntity(worldName, type, id) {
  const entity = await readEntity(worldName, type, id);
  const filePath = getEntityFilePath(worldName, entity.type, entity.id);

  await fs.unlink(filePath);

  return {
    id: entity.id,
    type: entity.type,
    deleted: true
  };
}

module.exports = {
  ENTITY_TYPES,
  createEntity,
  createEntityDefinition,
  createEntityValidationError,
  deleteEntity,
  ensureEntityTypeDirectory,
  getEntityFilePath,
  getEntityTypeDirectory,
  listEntities,
  normalizeEntityId,
  normalizeEntityType,
  readEntity,
  updateEntity,
  validateEntityDefinition
};
