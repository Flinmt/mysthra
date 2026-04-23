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

module.exports = {
  ENTITY_TYPES,
  createEntityDefinition,
  createEntityValidationError,
  normalizeEntityId,
  normalizeEntityType,
  validateEntityDefinition
};
