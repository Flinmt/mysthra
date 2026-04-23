# Project Status

This file tracks implementation progress for the Mythra project based on `specs.md` and `tasks.md`.

## Current Summary

- Spec source of truth: `specs.md`
- Task plan source: `tasks.md`
- Backend skeleton: created
- Task 1.1 validation: partially verified
- Filesystem structure: implemented
- Task 1.2 validation: verified
- Path safety protections: implemented
- Task 1.3 validation: verified
- Page listing: implemented
- Task 2.1 validation: verified
- Page reading: implemented
- Task 2.2 validation: verified
- Page creation: implemented
- Task 2.3 validation: verified
- Page update: implemented
- Task 2.4 validation: verified
- Page deletion: implemented
- Task 2.5 validation: verified
- Markdown rendering: implemented
- Task 3.1 validation: verified
- Embedded HTML rendering: implemented
- Task 3.2 validation: verified
- HTML sanitization: implemented
- Task 3.3 validation: verified
- Wikilink parsing: implemented
- Task 4.1 validation: verified
- Wikilink HTML rendering: implemented
- Task 4.2 validation: verified
- Relation generation: implemented
- Task 4.3 validation: verified
- Entity format definition: implemented
- Task 5.1 validation: verified
- Entity CRUD: implemented
- Task 5.2 validation: verified
- Page/entity link resolution: implemented
- Task 5.3 validation: verified
- Theme loading: implemented
- Task 6.1 validation: verified
- Themed rendered page output: implemented
- Task 6.2 validation: verified
- Per-page theme override: implemented
- Task 6.3 validation: verified
- Node.js installed: yes
- Current Node.js version: `v18.19.1`
- Current npm version: `9.2.0`
- Required Node.js version in `package.json`: `>=20`
- Current phase: Phase 6 — Theme System
- Current recommended next task: `Task 7.1`

## Status Legend

- `[x]` Done
- `[ ]` Not started
- `[~]` In progress or partially validated

## Environment Notes

- `node` is now available in the environment
- `npm` is now available in the environment
- Current runtime does not yet match the version declared by the project
- Project has no npm package dependencies yet
- Sandbox blocks opening a listening HTTP port during verification
- Test world directories were created during filesystem validation
- Test suites currently pass with `npm test`
- Local `data/` contains test artifacts generated during task validation

## Completed Work

### Task 1.1 — Initialize backend project

Status: `[x] Done`

Implemented:
- Minimal `package.json`
- Development and production scripts
- Backend entrypoint in `src/server.js`
- Basic router in `src/routes/index.js`
- HTTP utility in `src/utils/http.js`
- Initial module placeholders for `services` and `data`

Files created:
- `package.json`
- `src/server.js`
- `src/routes/index.js`
- `src/utils/http.js`
- `src/services/index.js`
- `src/data/index.js`

Notes:
- The structure is ready for the next filesystem-focused tasks
- Runtime version should be upgraded to Node 20+ for full alignment with the project config

Validation:
- `node -v` returned `v18.19.1`
- `npm -v` returned `9.2.0`
- Direct router verification for `GET /health` returned `200`
- Direct router verification for an unknown route returned `404`
- Full server listen test could not complete because the environment blocked binding to port `3000` with `EPERM`

### Task 1.2 — Define filesystem structure

Status: `[x] Done`

Implemented:
- Filesystem helper module in `src/data/filesystem.js`
- Standard world directory names for `pages`, `entities`, `relations`, `themes`, `templates`, and `media`
- Helper functions to resolve `data/`, `data/worlds/`, and per-world paths
- Automatic directory creation with `ensureDirectory`
- Automatic world bootstrap with `ensureWorldStructure(worldName)`

Files created or modified:
- `src/data/filesystem.js`
- `src/data/index.js`

Notes:
- Path resolution is in place for the world filesystem layout
- Strict path safety and traversal protection are intentionally deferred to Task `1.3`
- Validation created sample directories under `data/worlds/demo-world` and `data/worlds/test-world`

Validation:
- `getDataRoot()` resolved to the local `data` directory
- `getWorldsRoot()` resolved to `data/worlds`
- `getWorldPaths('alpha-world')` returned all expected world subpaths
- `ensureWorldStructure('test-world')` created all required directories
- Re-running `ensureWorldStructure('test-world')` was idempotent

### Task 1.3 — Add path safety protections

Status: `[x] Done`

Implemented:
- Validation helpers for world names and file names
- Reusable invalid path errors for unsafe path input
- Protection against path traversal such as `../`, `/`, and `\`
- Root-bound path resolution to keep access inside `data/worlds`
- Safe world path resolver for later page operations
- Test script with `node --test`

Files created or modified:
- `package.json`
- `src/data/filesystem.js`
- `test/data/filesystem.test.js`

Notes:
- Validation rules were kept intentionally simple and strict
- The filesystem module is now the main enforcement point for safe world path access

Validation:
- `npm test` passed
- Tests cover valid names, invalid names, traversal rejection, root escape rejection, and directory creation

### Task 2.1 — Implement page listing

Status: `[x] Done`

Implemented:
- Page listing service in `src/services/pages.js`
- Markdown-only listing from each world `pages/` directory
- Page metadata output with `id`, `title`, `slug`, and `filePath`
- Title extraction from the first markdown heading
- `GET /pages?world=...` endpoint

Files created or modified:
- `src/services/pages.js`
- `src/services/index.js`
- `src/routes/index.js`
- `test/services/pages.test.js`

Notes:
- `id` currently matches the page slug
- The route keeps the API simple by using the `world` query parameter

Validation:
- `npm test` passed
- Service tests cover markdown filtering, metadata extraction, and automatic world bootstrap
- Route verification returned `200` with the expected page list payload

### Task 2.2 — Implement page reading

Status: `[x] Done`

Implemented:
- Single page read service by `id` or slug
- Markdown file lookup in the world `pages/` directory
- Raw markdown content return with metadata
- Not found handling with explicit `PAGE_NOT_FOUND`
- `GET /pages/:id?world=...` endpoint

Files created or modified:
- `src/services/pages.js`
- `src/routes/index.js`
- `test/services/pages.test.js`

Notes:
- Reading currently resolves pages by a safe slug-based filename
- The endpoint returns raw markdown content, matching the task requirements

Validation:
- `npm test` passed
- Tests cover read success, title fallback, and missing page handling
- Direct route verification returned `404` with `Page not found` for a missing page

### Task 2.3 — Implement page creation

Status: `[x] Done`

Implemented:
- Page creation service in `src/services/pages.js`
- Safe slug generation from page titles
- Optional explicit slug support with normalization
- Markdown file creation in the world `pages/` directory
- Overwrite protection by default with optional `allowOverwrite`
- `POST /pages` endpoint with JSON body parsing

Files created or modified:
- `src/services/pages.js`
- `src/routes/index.js`
- `test/services/pages.test.js`
- `project_status.md`

Notes:
- Creation currently expects `world`, `title`, and optional `content`, `slug`, and `allowOverwrite`
- Slugs are normalized to lowercase kebab-case before file creation
- Existing pages are protected from overwrite unless explicitly allowed

Validation:
- `npm test` passed
- Tests cover slug generation, create success, explicit slug usage, conflict prevention, and overwrite support
- Direct route verification returned `201` with the expected created page payload

### Task 2.4 — Implement page update

Status: `[x] Done`

Implemented:
- Page update service in `src/services/pages.js`
- Safe content replacement by `id` or slug
- UTF-8 markdown file writing
- Missing page handling with explicit not found errors
- `PUT /pages/:id?world=...` endpoint with JSON body parsing

Files created or modified:
- `src/services/pages.js`
- `src/routes/index.js`
- `test/services/pages.test.js`
- `project_status.md`

Notes:
- Update currently replaces page content only, keeping filename and slug stable
- The endpoint expects `content` in the request body and returns the updated page payload

Validation:
- `npm test` passed
- Tests cover update success, missing page handling, and route-level update behavior
- Direct route verification returned `404` with `Page not found` for an unknown page

### Task 2.5 — Implement page deletion

Status: `[x] Done`

Implemented:
- Page deletion service in `src/services/pages.js`
- Safe delete flow based on valid page file resolution
- Existence check through page read before removal
- `DELETE /pages/:id?world=...` endpoint

Files created or modified:
- `src/services/pages.js`
- `src/routes/index.js`
- `test/services/pages.test.js`
- `project_status.md`

Notes:
- Deletion currently removes only valid markdown page files
- The endpoint returns a compact confirmation payload with `id`, `slug`, and `deleted`

Validation:
- `npm test` passed
- Tests cover delete success, missing page handling, and route-level delete behavior
- Direct route verification returned `404` with `Page not found` for an unknown page

### Task 3.1 — Add markdown renderer

Status: `[x] Done`

Implemented:
- Markdown rendering module in `src/services/rendering.js`
- Standard markdown support for headings, paragraphs, unordered lists, ordered lists, links, emphasis, strong text, inline code, and fenced code blocks
- HTML escaping in the base renderer to keep raw HTML inert until the later HTML-support phase
- Modular rendering helpers exported for reuse in later wikilink and sanitization work

Files created or modified:
- `src/services/rendering.js`
- `src/services/index.js`
- `test/services/rendering.test.js`
- `project_status.md`

Notes:
- The renderer intentionally escapes raw HTML for now because embedded HTML support belongs to Task `3.2`
- The implementation stays dependency-free and lightweight, matching the current project approach

Validation:
- `npm test` passed
- Tests cover HTML escaping, inline formatting, headings, paragraphs, lists, code blocks, and raw HTML escaping behavior

### Task 3.2 — Allow embedded HTML

Status: `[x] Done`

Implemented:
- Inline HTML preservation in the markdown renderer
- HTML block preservation for tag-based content blocks
- HTML-aware helpers in `src/services/rendering.js`
- Rendering behavior kept modular for the later sanitization phase

Files created or modified:
- `src/services/rendering.js`
- `test/services/rendering.test.js`
- `project_status.md`

Notes:
- Embedded HTML is now preserved in renderer output
- Sanitization is intentionally deferred to Task `3.3`, so this phase focuses only on compatibility

Validation:
- `npm test` passed
- Tests cover inline HTML tags, HTML block preservation, and compatibility with standard markdown rendering

### Task 3.3 — Sanitize HTML

Status: `[x] Done`

Implemented:
- Isolated HTML sanitization step in `src/services/rendering.js`
- Removal of `<script>` tags from rendered output
- Removal of unsafe inline event handler attributes such as `onclick`
- Sanitized rendering entrypoint for markdown-to-HTML output

Files created or modified:
- `src/services/rendering.js`
- `test/services/rendering.test.js`
- `project_status.md`

Notes:
- Sanitization is intentionally simple and targeted to the requirements of this phase
- The isolated sanitizer keeps the rendering pipeline ready for future hardening if needed

Validation:
- `npm test` passed
- Tests cover script removal, inline event handler stripping, and sanitized markdown rendering output

### Task 4.1 — Parse wikilinks

Status: `[x] Done`

Implemented:
- Separate wikilink parser module in `src/services/wikilinks.js`
- Extraction of `[[Entity Name]]` targets from markdown content
- Normalization of extracted targets for consistent spacing
- Wikilink metadata output including raw token, target, index, and length

Files created or modified:
- `src/services/wikilinks.js`
- `src/services/index.js`
- `test/services/wikilinks.test.js`
- `project_status.md`

Notes:
- The parser is intentionally separate from the renderer, matching the phase requirement
- This phase focuses on detection and extraction only; HTML conversion stays for Task `4.2`

Validation:
- `npm test` passed
- Tests cover target normalization, empty cases, multiple links, malformed input, and multiline extraction
- Direct verification returned the expected extracted targets for a sample markdown line

### Task 4.2 — Convert wikilinks to HTML links

Status: `[x] Done`

Implemented:
- Wikilink-to-HTML conversion in `src/services/wikilinks.js`
- Slug resolution from wikilink targets
- Anchor rendering with readable link text preserved
- Unresolved link handling with a dedicated CSS class

Files created or modified:
- `src/services/wikilinks.js`
- `test/services/wikilinks.test.js`
- `project_status.md`

Notes:
- Resolved links render with class `wikilink`
- Unresolved links render with class `wikilink unresolved`
- This phase converts syntax to HTML only; relation extraction stays for Task `4.3`

Validation:
- `npm test` passed
- Tests cover slug conversion, HTML anchor generation, and unresolved link behavior
- Direct verification produced the expected anchor tags for sample wikilinks

### Task 4.3 — Generate relation data

Status: `[x] Done`

Implemented:
- Relation generation service in `src/services/relations.js`
- Wikilink extraction from page content for relation building
- Basic relation format with `from`, `to`, `label`, and `type`
- Persistence of relations in `relations/relations.json`

Files created or modified:
- `src/services/relations.js`
- `src/services/index.js`
- `test/services/relations.test.js`
- `project_status.md`

Notes:
- Relation generation currently replaces previous relations for the same source page
- The stored structure is graph-ready and stays file-based as required

Validation:
- `npm test` passed
- Tests cover relation building, persistence to `relations.json`, and replacement of stale relations for the same page
- Direct verification produced the expected saved relation data for a sample page

### Task 5.1 — Define entity file format

Status: `[x] Done`

Implemented:
- Entity schema module in `src/services/entities.js`
- Supported entity types for `character`, `location`, `item`, and `event`
- Base entity structure with `id`, `type`, `name`, and `description`
- Validation and normalization helpers for entity ids and types

Files created or modified:
- `src/services/entities.js`
- `src/services/index.js`
- `test/services/entities.test.js`
- `project_status.md`

Notes:
- Entity ids are normalized to a slug-safe format
- Validation rejects unsupported entity types and non-normalized ids

Validation:
- `npm test` passed
- Tests cover supported types, normalization, schema creation, and invalid entity definitions
- Direct verification produced the expected normalized entity payload for a sample character

### Task 5.2 — Implement entity CRUD

Status: `[x] Done`

Implemented:
- Filesystem CRUD in `src/services/entities.js`
- Per-type entity storage under `entities/{type}/{id}.json`
- Safe create, read, list, update, and delete operations
- Automatic directory bootstrap for entity type folders

Files created or modified:
- `src/services/entities.js`
- `src/services/index.js`
- `test/services/entities-crud.test.js`
- `project_status.md`

Notes:
- Entity persistence stays fully file-based and grouped by type
- Update operations preserve entity `id` and `type` stability
- The route/API layer for entities can now build on this service layer cleanly

Validation:
- `npm test` passed
- Tests cover create, read, list, update, and delete operations
- Direct verification returned the expected stored entities for a sample character list

### Task 5.3 — Link entities from pages

Status: `[x] Done`

Implemented:
- Centralized link resolver service in `src/services/link-resolver.js`
- Resolution of wikilinks to pages, entities, or unresolved targets
- Support for page link priority when both a page and entity share the same target
- Page-level resolution of all wikilinks in a markdown document

Files created or modified:
- `src/services/link-resolver.js`
- `src/services/index.js`
- `test/services/link-resolver.test.js`
- `project_status.md`

Notes:
- Resolution logic is now centralized as requested by the task
- Page targets resolve before entity targets to keep page navigation stable
- Unresolved links still return a normalized slug for later creation flows

Validation:
- `npm test` passed
- Tests cover page resolution, entity resolution, unresolved targets, cross-type entity listing, and page-level wikilink resolution
- Direct verification returned the expected entity and unresolved matches for a sample page

### Task 6.1 — Load world themes

Status: `[x] Done`

Implemented:
- Theme service in `src/services/themes.js`
- Listing of `.css` theme files from each world `themes/` directory
- Active theme selection storage via a small config file
- `GET /themes?world=...` endpoint for theme listing

Files created or modified:
- `src/services/themes.js`
- `src/services/index.js`
- `src/routes/index.js`
- `test/services/themes.test.js`
- `project_status.md`

Notes:
- Active theme selection is stored separately from the CSS files
- Theme loading remains isolated from content rendering, as required for this phase

Validation:
- `npm test` passed
- Tests cover theme listing, active theme reading, active theme selection, aggregated theme loading, and route behavior
- Direct verification returned the expected theme list and active theme payload

### Task 6.2 — Apply theme to rendered pages

Status: `[x] Done`

Implemented:
- Rendered page output service in `src/services/page-output.js`
- Composition of page reading, markdown rendering, sanitization, and active theme lookup
- Theme asset reading with CSS metadata and stable asset href generation
- `GET /pages/:id/rendered?world=...` endpoint for themed rendered output
- `GET /themes/:file.css?world=...` endpoint for loading theme CSS assets

Files created or modified:
- `src/services/page-output.js`
- `src/services/themes.js`
- `src/services/index.js`
- `src/routes/index.js`
- `src/utils/http.js`
- `test/services/page-output.test.js`
- `test/services/themes.test.js`
- `project_status.md`

Notes:
- Rendered HTML and theme data stay separate in the response payload
- The rendered page output references the active world theme through a CSS asset href
- The theme system remains decoupled from markdown rendering internals

Validation:
- `npm test` passed
- Tests cover rendered page output with and without active theme, CSS asset loading, active theme resolution, and route behavior
- Direct verification returned sanitized HTML plus the expected theme href for a rendered page

### Task 6.3 — Add per-page theme override

Status: `[x] Done`

Implemented:
- Top-level page theme override parsing with the `<!-- theme: name -->` convention
- Removal of the override marker from rendered markdown output
- Theme resolution that prefers the page override before the active world theme
- Theme source metadata in rendered page responses

Files created or modified:
- `src/services/page-output.js`
- `src/services/themes.js`
- `test/services/page-output.test.js`
- `test/services/themes.test.js`
- `project_status.md`

Notes:
- The override stays optional and lightweight
- Page content and theme data remain separate in the rendered output payload
- The override marker is treated as metadata and does not appear in rendered HTML

Validation:
- `npm test` passed
- Tests cover override parsing, override stripping, page-level theme precedence, and fallback to the world theme
- Direct verification returned the page-selected theme reference when an override marker was present

## Task Checklist

### Phase 1 — Core Foundation

- [x] Task 1.1 — Initialize backend project
- [x] Task 1.2 — Define filesystem structure
- [x] Task 1.3 — Add path safety protections

### Phase 2 — Page System

- [x] Task 2.1 — Implement page listing
- [x] Task 2.2 — Implement page reading
- [x] Task 2.3 — Implement page creation
- [x] Task 2.4 — Implement page update
- [x] Task 2.5 — Implement page deletion

### Phase 3 — Markdown Rendering

- [x] Task 3.1 — Add markdown renderer
- [x] Task 3.2 — Allow embedded HTML
- [x] Task 3.3 — Sanitize HTML

### Phase 4 — Wikilink System

- [x] Task 4.1 — Parse wikilinks
- [x] Task 4.2 — Convert wikilinks to HTML links
- [x] Task 4.3 — Generate relation data

### Phase 5 — Entity System

- [x] Task 5.1 — Define entity file format
- [x] Task 5.2 — Implement entity CRUD
- [x] Task 5.3 — Link entities with pages

### Phase 6 — Themes

- [x] Task 6.1 — Implement theme loading
- [x] Task 6.2 — Apply theme to rendered pages
- [x] Task 6.3 — Support per-page theme override

### Phase 7 — Templates

- [ ] Task 7.1 — Add HTML template support
- [ ] Task 7.2 — Bind templates to pages/entities

### Phase 8 — Frontend

- [ ] Task 8.1 — Create frontend shell
- [ ] Task 8.2 — Build page viewer
- [ ] Task 8.3 — Build editor UI
- [ ] Task 8.4 — Add world navigation

### Phase 9 — Quality

- [ ] Task 9.1 — Add validation and error handling
- [ ] Task 9.2 — Add tests
- [ ] Task 9.3 — Final cleanup

## Next Actions

1. Upgrade Node.js to version 20 or newer.
2. Execute `Task 7.1`.
3. Update this file after each completed task.
