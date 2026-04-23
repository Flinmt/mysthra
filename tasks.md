# Tasks: Self-Hosted Collaborative Worldbuilding Platform

This file breaks the project into practical implementation tasks for Codex.

---

## General Rules

- Follow `PROJECT_SPEC.md` strictly
- Do not introduce any database
- Use filesystem only
- Keep code minimal and modular
- Do not implement future phases too early
- Prefer small independent modules

---

## Phase 1 — Core Foundation

### Task 1.1 — Initialize backend project
Create the initial Node.js backend project structure.

Requirements:
- Use a minimal and clean structure
- Prepare folders for routes, services, utils, and data access
- Add scripts for development and production
- Keep the setup lightweight

Expected output:
- A working backend skeleton
- Minimal entrypoint
- Organized folder structure

---

### Task 1.2 — Define filesystem structure
Implement the base filesystem layout used by the application.

Requirements:
- Create helper functions to resolve world paths safely
- Standardize folder names:
  - `pages/`
  - `entities/`
  - `relations/`
  - `themes/`
  - `templates/`
  - `media/`
- Ensure directories are created automatically if missing

Expected output:
- Filesystem utility module
- Safe directory creation
- Path validation helpers

---

### Task 1.3 — Add path safety protections
Implement path validation and traversal protection.

Requirements:
- Prevent access outside the allowed `/data/worlds` root
- Validate filenames and world names
- Reject dangerous relative paths like `../`

Expected output:
- Reusable path validation helpers
- Errors for invalid paths
- Test coverage if possible

---

## Phase 2 — Page System

### Task 2.1 — Implement page listing
Create logic to list all pages in a world.

Requirements:
- Read `.md` files from the world `pages/` folder
- Return page metadata:
  - id
  - title
  - slug
  - file path
- Keep it simple

Expected output:
- Service to list pages
- API endpoint to return page list

---

### Task 2.2 — Implement page reading
Create logic to read a single markdown page.

Requirements:
- Load a `.md` file by id or slug
- Return raw markdown content
- Extract title from first heading when possible

Expected output:
- Page read service
- API endpoint for single page retrieval

---

### Task 2.3 — Implement page creation
Create logic to create new markdown pages.

Requirements:
- Generate safe filenames/slugs
- Save new `.md` file
- Prevent overwriting existing pages unless explicitly allowed

Expected output:
- Page creation service
- API endpoint to create pages

---

### Task 2.4 — Implement page update
Create logic to update existing markdown pages.

Requirements:
- Replace content safely
- Preserve encoding as UTF-8
- Handle missing files gracefully

Expected output:
- Page update service
- API endpoint to update pages

---

### Task 2.5 — Implement page deletion
Create logic to delete pages.

Requirements:
- Delete only valid page files
- Confirm target exists before deletion

Expected output:
- Page deletion service
- API endpoint to delete pages

---

## Phase 3 — Markdown Rendering

### Task 3.1 — Add markdown renderer
Implement markdown-to-HTML rendering.

Requirements:
- Render standard markdown
- Keep implementation modular
- Prepare for later wikilink parsing

Expected output:
- Rendering module
- HTML output from markdown input

---

### Task 3.2 — Allow embedded HTML
Support inline HTML inside markdown pages.

Requirements:
- Preserve valid HTML blocks
- Keep rendering pipeline compatible with sanitization

Expected output:
- Rendering that supports markdown + HTML

---

### Task 3.3 — Sanitize HTML
Add HTML sanitization to rendering output.

Requirements:
- Disallow `<script>` tags
- Disallow unsafe inline event handlers
- Keep safe markup and classes

Expected output:
- Safe HTML render pipeline
- Sanitization step isolated in its own module

---

## Phase 4 — Wikilink System

### Task 4.1 — Parse wikilinks
Implement parsing for `[[Entity Name]]` syntax.

Requirements:
- Detect wikilinks in markdown
- Extract link targets
- Keep parser separate from renderer

Expected output:
- Wikilink parser module
- List of extracted links from a page

---

### Task 4.2 — Convert wikilinks to HTML links
Transform wikilinks into rendered anchor tags.

Requirements:
- Preserve readable link text
- Resolve links by slug
- Handle unresolved links gracefully

Expected output:
- Wikilinks rendered as links in HTML

---

### Task 4.3 — Generate relation data
Create relation extraction from page content.

Requirements:
- Read all wikilinks from a page
- Generate relation entries
- Save relation data to `relations.json`

Expected output:
- Relation generation service
- Basic graph-ready data format

---

## Phase 5 — Entity System

### Task 5.1 — Define entity file format
Create the base JSON schema structure for entities.

Requirements:
- Support at least:
  - character
  - location
  - item
  - event
- Include:
  - id
  - type
  - name
  - description

Expected output:
- Entity format definition
- Validation rules

---

### Task 5.2 — Implement entity CRUD
Create filesystem CRUD for entity JSON files.

Requirements:
- Separate folders by entity type
- Read/write JSON safely
- Validate structure before save

Expected output:
- Entity service module
- API endpoints for entity CRUD

---

### Task 5.3 — Link entities from pages
Allow pages and wikilinks to resolve to entities.

Requirements:
- Match links to page or entity
- Keep resolution logic centralized

Expected output:
- Link resolver service

---

## Phase 6 — Theme System

### Task 6.1 — Load world themes
Implement logic to load CSS theme files for a world.

Requirements:
- Read `.css` files from `themes/`
- Allow selecting an active theme
- Keep theme loading separate from page rendering

Expected output:
- Theme service
- API endpoint to list themes

---

### Task 6.2 — Apply theme to rendered pages
Attach selected CSS theme to rendered content.

Requirements:
- Support global world theme
- Keep content and theme separate

Expected output:
- Rendered page output with theme reference

---

### Task 6.3 — Add per-page theme override (optional after global theme)
Allow a page to optionally specify a theme override.

Requirements:
- Only implement after global theme works
- Keep override logic simple

Expected output:
- Optional per-page theme support

---

## Phase 7 — Templates

### Task 7.1 — Add HTML templates folder support
Implement support for loading `.html` templates from the world.

Requirements:
- Read template files from `templates/`
- Make templates available to rendering logic later

Expected output:
- Template service
- Template listing endpoint if useful

---

### Task 7.2 — Define template injection strategy
Create a simple strategy for wrapping rendered page content in templates.

Requirements:
- Do not overengineer
- Keep templates optional
- Preserve sanitization rules

Expected output:
- Template application flow design
- Initial implementation if straightforward

---

## Phase 8 — Frontend Foundation

### Task 8.1 — Initialize frontend project
Create the frontend structure.

Requirements:
- Minimal app shell
- Page list view
- Page editor view
- Page preview view

Expected output:
- Basic frontend setup
- Clear folder structure

---

### Task 8.2 — Fetch and display pages
Connect frontend to backend page list and page read APIs.

Requirements:
- List pages in sidebar or index view
- Open a selected page
- Show raw or rendered content

Expected output:
- Working page browser UI

---

### Task 8.3 — Add markdown editor
Implement a minimal page editor.

Requirements:
- Load page content
- Edit markdown text
- Save changes through API

Expected output:
- Editable page screen

---

### Task 8.4 — Add preview mode
Render sanitized HTML preview for the current page.

Requirements:
- Display rendered output
- Support markdown + HTML + theme styling

Expected output:
- Live preview or refreshable preview

---

## Phase 9 — Quality and Reliability

### Task 9.1 — Add error handling
Improve backend and frontend error handling.

Requirements:
- Friendly API errors
- Handle missing files
- Handle invalid input cleanly

Expected output:
- Consistent error responses

---

### Task 9.2 — Add logging
Implement simple logging for filesystem operations and API errors.

Requirements:
- Log create/read/update/delete operations
- Avoid excessive verbosity

Expected output:
- Minimal logging utility

---

### Task 9.3 — Add tests for core modules
Create tests for the most important parts.

Priority modules:
- path safety
- page CRUD
- wikilink parser
- entity validation
- renderer sanitization

Expected output:
- Core test coverage

---

## Phase 10 — Future Work (Do Not Implement Yet Unless Requested)

### Task 10.1 — Real-time collaboration
Future implementation:
- WebSockets
- Yjs
- conflict-free collaborative editing

### Task 10.2 — Plugin system
Future implementation:
- plugin loading
- custom components
- extended render pipeline

### Task 10.3 — Search and indexing
Future implementation:
- local search index
- page/entity search
- relation-based navigation

---

## Codex Execution Advice

When working through this file:

1. Implement one task at a time
2. After each task, summarize:
   - what was created
   - what files were added
   - what remains
3. Do not jump ahead unless dependencies are complete
4. Keep modules small and reusable
5. Favor simple filesystem logic over abstractions

---

## Recommended Execution Order

1. Task 1.1
2. Task 1.2
3. Task 1.3
4. Task 2.1
5. Task 2.2
6. Task 2.3
7. Task 2.4
8. Task 2.5
9. Task 3.1
10. Task 3.2
11. Task 3.3
12. Task 4.1
13. Task 4.2
14. Task 4.3
15. Task 5.1
16. Task 5.2
17. Task 5.3
18. Task 6.1
19. Task 6.2
20. Task 7.1
21. Task 8.1
22. Task 8.2
23. Task 8.3
24. Task 8.4
25. Task 9.1
26. Task 9.2
27. Task 9.3

---

## End of Tasks
