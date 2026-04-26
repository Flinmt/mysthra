const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getTemplatesRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const { generateSessionToken } = require("../../src/utils/auth");
const {
  applyTemplate,
  buildTemplateFileName,
  injectTemplateContent,
  listTemplates,
  loadTemplates,
  readTemplate,
  templateNameFromFile
} = require("../../src/services/templates");

const createdTemplateFiles = new Set();

function getTestTemplatePath(fileName) {
  const filePath = path.join(getTemplatesRoot(), fileName);
  createdTemplateFiles.add(filePath);
  return filePath;
}

test.after(async () => {
  await Promise.all(
    [...createdTemplateFiles].map((filePath) =>
      fs.rm(filePath, { force: true })
    )
  );
});

function createAuthenticatedHeaders() {
  return {
    cookie: `mysthra_session=${generateSessionToken()}`
  };
}

test("templateNameFromFile removes the html extension", () => {
  assert.equal(templateNameFromFile("chronicle.html"), "chronicle");
});

test("buildTemplateFileName appends the html extension", () => {
  assert.equal(buildTemplateFileName("chronicle"), "chronicle.html");
});

test("injectTemplateContent uses the explicit content placeholder when present", () => {
  assert.equal(
    injectTemplateContent("<main>{{content}}</main>", "<p>Hello</p>"),
    "<main><p>Hello</p></main>"
  );
});

test("applyTemplate injects content placeholders and preserves sanitization", () => {
  const result = applyTemplate(
    "<html><head><title>{{title}}</title></head><body><main>{{content}}</main><script>alert(1)</script></body></html>",
    {
      title: "Eldoria",
      content: "<p>Hello</p>",
      themeHref: "/themes/eldoria.css"
    }
  );

  assert.equal(
    result,
    "<html><head><title>Eldoria</title></head><body><main><p>Hello</p></main></body></html>"
  );
});

test("listTemplates returns global html templates", async () => {
  const templatesRoot = getTemplatesRoot();
  await fs.mkdir(templatesRoot, { recursive: true });

  await fs.writeFile(getTestTemplatePath("chronicle-list-test.html"), "<main></main>", "utf8");
  await fs.writeFile(getTestTemplatePath("codex-list-test.html"), "<article></article>", "utf8");
  await fs.writeFile(getTestTemplatePath("ignore-list-test.txt"), "noop", "utf8");

  const templates = await listTemplates();
  const names = templates.map((template) => template.name);

  assert.equal(names.includes("chronicle-list-test"), true);
  assert.equal(names.includes("codex-list-test"), true);
});

test("readTemplate returns html template content", async () => {
  const templatesRoot = getTemplatesRoot();
  await fs.mkdir(templatesRoot, { recursive: true });
  await fs.writeFile(getTestTemplatePath("chronicle-read-test.html"), "<main>{{content}}</main>", "utf8");

  const template = await readTemplate("chronicle-read-test");

  assert.equal(template.name, "chronicle-read-test");
  assert.equal(template.fileName, "chronicle-read-test.html");
  assert.equal(template.content, "<main>{{content}}</main>");
});

test("loadTemplates returns the available template list", async () => {
  const templatesRoot = getTemplatesRoot();
  await fs.mkdir(templatesRoot, { recursive: true });
  await fs.writeFile(getTestTemplatePath("chronicle-load-test.html"), "<main></main>", "utf8");

  const result = await loadTemplates();

  assert.equal(result.items.some((template) => template.name === "chronicle-load-test"), true);
});

test("GET /api/templates returns the template list payload", async () => {
  const templatesRoot = getTemplatesRoot();
  await fs.mkdir(templatesRoot, { recursive: true });
  await fs.writeFile(getTestTemplatePath("chronicle-route-test.html"), "<main></main>", "utf8");

  const result = {
    statusCode: null,
    headers: null,
    body: null
  };

  const response = {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers;
    },
    end(body) {
      result.body = JSON.parse(body);
    }
  };

  await router({
    method: "GET",
    url: "/api/templates",
    headers: createAuthenticatedHeaders()
  }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.items.some((template) => template.name === "chronicle-route-test"), true);
});

test("GET /api/templates/read returns the template html content", async () => {
  const templatesRoot = getTemplatesRoot();
  await fs.mkdir(templatesRoot, { recursive: true });
  await fs.writeFile(getTestTemplatePath("chronicle-asset-route-test.html"), "<main>Chronicle</main>", "utf8");

  const result = {
    statusCode: null,
    headers: null,
    body: null
  };

  const response = {
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers;
    },
    end(body) {
      result.body = body;
    }
  };

  await router({
    method: "GET",
    url: "/api/templates/read?path=chronicle-asset-route-test.html",
    headers: createAuthenticatedHeaders()
  }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Content-Type"], "text/html");
  assert.equal(result.body, "<main>Chronicle</main>");
});
