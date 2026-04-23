# Project Spec: Self-Hosted Collaborative Worldbuilding Platform

---

## 1. Objective

Build a self-hosted web application for worldbuilding with the following characteristics:

- File-based storage (no database)
- Markdown + HTML + CSS support
- Wikilink system
- Real-time collaborative editing (future)
- Inspired by Chronicler, Obsidian, and Notion

The system must prioritize simplicity, modularity, and extensibility.

---

## 2. Core Principles

- No database (filesystem only)
- Self-hosted only
- Local-first architecture
- Human-readable data
- Modular codebase
- Performance over abstraction

---

## 3. Tech Stack

### Backend
- Node.js
- Fastify or minimal HTTP server
- WebSocket support (future)

### Frontend
- Next.js (or simple React app)
- TipTap editor (recommended)

### Storage
- Filesystem (Markdown + JSON)

---

## 4. Data Architecture

All data must be stored as files.

### Directory Structure

/data/
  worlds/
    {world-name}/
      pages/
        *.md
      entities/
        character/
        location/
        item/
        event/
      relations/
        relations.json
      themes/
        *.css
      templates/
        *.html
      media/
        images/
        assets/

---

## 5. Page System

Pages are Markdown files with optional embedded HTML.

### Requirements

- Support Markdown
- Support inline HTML
- Support custom CSS classes
- Render safely (sanitize HTML)

### Example

```md
# Kingdom of Eldoria

Ruled by [[King Tharos]]

<div class="card">
  A powerful empire in the north.
</div>
```

---

## 6. Wikilink System

### Format

[[Entity Name]]

### Behavior

- Resolve links to pages/entities
- Create relation graph automatically
- Allow creation of new pages from links

---

## 7. Entity System

Entities are stored as JSON files.

### Example

```json
{
  "id": "king-tharos",
  "type": "character",
  "name": "King Tharos",
  "description": "Tyrant ruler of Eldoria"
}
```

### Requirements

- CRUD operations
- Linkable from pages
- Extensible schema

---

## 8. Theme System (HTML + CSS)

Themes must be user-defined.

### Requirements

- Global CSS per world
- Optional per-page styling
- No JS allowed in themes

### Example

```css
body {
  background: #0f0f0f;
  color: #eee;
}

.card {
  border: 1px solid #444;
  padding: 10px;
}
```

---

## 9. Rendering Engine

### Pipeline

Markdown → HTML → Sanitize → Apply Theme → Render

### Requirements

- Safe HTML rendering (no script execution)
- Support embedded HTML blocks
- Support custom components (future)

---

## 10. Collaboration (Future Phase)

- Use WebSockets
- Use CRDT (Yjs)
- Real-time sync between users
- Conflict-free editing

---

## 11. API Requirements

### Pages

- GET /pages
- GET /pages/:id
- POST /pages
- PUT /pages/:id
- DELETE /pages/:id

### Entities

- CRUD endpoints

### Filesystem

- All operations must reflect file system state

---

## 12. Security

- Sanitize all HTML input
- Disallow <script> tags
- Prevent path traversal
- Validate all file operations

---

## 13. Performance

- Lazy load files
- Cache parsed pages in memory
- Avoid full re-renders

---

## 14. Extensibility

The system must allow:

- Plugin system (future)
- Custom components
- Additional entity types

---

## 15. Non-Goals (Important)

- No SaaS
- No cloud-first architecture
- No complex authentication system
- No relational database

---

## 16. MVP Scope

### Phase 1

- File-based pages
- Markdown rendering
- Basic UI

### Phase 2

- Wikilinks
- Entities

### Phase 3

- Themes (CSS)

### Phase 4

- Collaboration (Yjs)

---

## 17. Development Rules

- Keep code minimal
- Avoid overengineering
- Prefer simple file operations
- Each module must be independent

---

## 18. Codex Instructions

When generating code:

- Follow this spec strictly
- Do not introduce databases
- Do not add unnecessary abstractions
- Keep functions small and modular
- Prefer clarity over cleverness

---

## END OF SPEC
