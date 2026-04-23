const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const test = require("node:test");

const { getWorldPaths, resolveWorldRoot } = require("../../src/data");
const { router } = require("../../src/routes");
const {
  applyTemplate,
  buildTemplateFileName,
  injectTemplateContent,
  listTemplates,
  loadTemplates,
  readTemplate,
  templateNameFromFile
} = require("../../src/services/templates");

async function resetWorld(worldName) {
  await fs.rm(resolveWorldRoot(worldName), { recursive: true, force: true });
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

test("listTemplates returns html templates for a world", async () => {
  const worldName = "templates-list-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.templates, { recursive: true });

  await fs.writeFile(path.join(worldPaths.templates, "chronicle.html"), "<main></main>", "utf8");
  await fs.writeFile(path.join(worldPaths.templates, "codex.html"), "<article></article>", "utf8");
  await fs.writeFile(path.join(worldPaths.templates, "ignore.txt"), "noop", "utf8");

  const templates = await listTemplates(worldName);

  assert.deepEqual(templates.map((template) => template.name), ["chronicle", "codex"]);
});

test("readTemplate returns html template content", async () => {
  const worldName = "templates-read-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.templates, { recursive: true });
  await fs.writeFile(path.join(worldPaths.templates, "chronicle.html"), "<main>{{content}}</main>", "utf8");

  const template = await readTemplate(worldName, "chronicle");

  assert.equal(template.name, "chronicle");
  assert.equal(template.fileName, "chronicle.html");
  assert.equal(template.content, "<main>{{content}}</main>");
});

test("loadTemplates returns the available template list", async () => {
  const worldName = "templates-load-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.templates, { recursive: true });
  await fs.writeFile(path.join(worldPaths.templates, "chronicle.html"), "<main></main>", "utf8");

  const result = await loadTemplates(worldName);

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].name, "chronicle");
});

test("GET /templates returns the template list payload", async () => {
  const worldName = "templates-route-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.templates, { recursive: true });
  await fs.writeFile(path.join(worldPaths.templates, "chronicle.html"), "<main></main>", "utf8");

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

  await router({ method: "GET", url: "/templates?world=templates-route-world" }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.body.items.length, 1);
  assert.equal(result.body.items[0].name, "chronicle");
});

test("GET /templates/:file returns the template html content", async () => {
  const worldName = "templates-asset-route-world";
  await resetWorld(worldName);
  const worldPaths = getWorldPaths(worldName);
  await fs.mkdir(worldPaths.templates, { recursive: true });
  await fs.writeFile(path.join(worldPaths.templates, "chronicle.html"), "<main>Chronicle</main>", "utf8");

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

  await router({ method: "GET", url: "/templates/chronicle.html?world=templates-asset-route-world" }, response);

  assert.equal(result.statusCode, 200);
  assert.equal(result.headers["Content-Type"], "text/html; charset=utf-8");
  assert.equal(result.body, "<main>Chronicle</main>");
});
