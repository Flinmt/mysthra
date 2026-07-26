function getErrorStatusCode(error) {
  if (error.code === "PAYLOAD_TOO_LARGE") return 413;
  if (error.code === "UNSUPPORTED_MEDIA_TYPE") return 415;
  if (error.code === "INVALID_JSON") return 400;
  if (error.code === "INVALID_PATH") return 400;
  if (error.code === "INVALID_DOCUMENT_METADATA") return 400;
  if (error.code === "INVALID_HOME_PAGE") return 400;
  if (error.code === "INVALID_USER_INPUT") return 400;
  if (error.code === "INVALID_THEME_PRESET") return 400;
  if (error.code === "INVALID_WORLD_INPUT" || error.code === "INVALID_THUMBNAIL") return 400;
  if (error.code === "USER_ALREADY_EXISTS") return 409;
  if (error.code === "WORLD_ALREADY_EXISTS") return 409;
  if (error.code === "WORLD_NOT_FOUND") return 404;
  if (error.code === "ASSET_NOT_FOUND") return 404;
  if (error.code === "DOCUMENT_NOT_FOUND") return 404;
  if (error.code === "THEME_PRESET_NOT_FOUND") return 404;
  if (error.code === "USER_NOT_FOUND") return 404;
  if (error.code === "FORBIDDEN") return 403;
  return 500;
}

function getErrorMessage(error, statusCode) {
  if ([400, 403, 404, 409, 413, 415, 416].includes(statusCode)) return error.message;
  return "Internal Server Error";
}

module.exports = { getErrorMessage, getErrorStatusCode };
