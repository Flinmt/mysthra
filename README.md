# <p align="center"><img src="client/public/favicon.png" width="80" height="80" alt="Mysthra Logo" /><br/>Mysthra</p>

<p align="center">
  <strong>Self-hosted worldbuilding workspace</strong><br/>
  <em>Worlds, wiki trees, collaborative tabs, maps, boards, media assets, and read-only sharing.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-purple?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-red?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Self--Hosted-Yes-green?style=for-the-badge" alt="Self Hosted" />
</p>

---

## Overview

Mysthra is a self-hosted app for building and running fictional worlds. It starts with a private Nexus dashboard for managing worlds and users, then opens each world into a workspace with hierarchical documents, multiple content tabs, media assets, collaboration, permissions, and public read-only visitor links.

The project is in beta. It is already usable as a private worldbuilding workspace, but storage format, UI details, and deployment defaults may still evolve.

---

## Features

### Worlds And Nexus

- Create, edit, search, theme, and delete worlds.
- Add world thumbnails and short descriptions.
- Choose built-in world themes or define custom interface colors.
- Set a root document as the world's home page.
- Manage internal Mysthra users from the admin dashboard.

### Workspace

- Organize each world as a nested wiki tree.
- Create root documents, child documents, and up to 5 tabs per document.
- Use context menus for document, tab, and asset actions.
- Rename, move, duplicate, and delete documents and tabs.
- Set covers, cover positions, icons, and inline document titles.
- Lock documents to prevent editing and new tab creation.

### Tab Types

- **Wiki**: BlockNote-powered rich text editor for notes, structure, and visual blocks.
- **Map**: collaborative canvas for RPG-style maps, markers, labels, images, and page links.
- **Markdown/HTML**: collaborative source editor with rendered preview.
- **Board**: collaborative whiteboard for notes, shapes, connectors, links, and images.

### Assets

- Upload and organize images, GIFs, and audio files.
- Create asset folders.
- Move, duplicate, rename, and delete assets.
- Insert or reference assets from wiki, markdown, map, and board workflows.

### Collaboration

- Real-time collaboration is served through Hocuspocus/Yjs at `/collaboration`.
- Presence rooms are scoped per world.
- Tab rooms are scoped by world and tab UID.
- Yjs state is persisted on disk under each world's `yjs/` directory.

### Access Control

- Login uses an admin account plus internal Mysthra users.
- The global admin is controlled by environment variables.
- World members can be regular members or world admins.
- Documents support inherited permissions with `none`, `read`, `write`, and `admin` levels.
- Public visitor mode is read-only and must be enabled per world.

---

## Quick Start With Docker

Docker Compose is the recommended way to run Mysthra for self-hosting.

```bash
export MASTER_PASSWORD=change-this-password
docker compose up -d
```

Open:

```text
http://localhost:3000
```

Persistent application data is stored in a named Docker volume:

```text
mysthra-data:/app/data
```

Named volumes are recommended for Docker Desktop, WSL, and autostart setups because the container does not depend on a host folder being ready before it starts. If you need direct host access to the files, you can change the Compose mount to a bind mount such as `./data:/app/data`, but make sure that path is available before the container starts.

---

## Local Development

Requirements:

- Node.js `>=22`
- npm

Install backend dependencies from the repository root:

```bash
npm install
```

Install frontend dependencies:

```bash
npm --prefix client install
```

Create a local environment file:

```bash
cp .env.example .env
```

For backend-only development, including serving the built client:

```bash
npm run dev
```

For UI iteration, run the API and Vite client separately:

```bash
npm run dev:api
npm run dev:client
```

Vite proxies `/api` and `/collaboration` to the backend port.

---

## Configuration

Example `.env`:

```env
PORT=3000
CLIENT_PORT=5173
ADMIN_USERNAME=admin
MASTER_PASSWORD=change-this-password
MAX_JSON_BODY_SIZE=1mb
MAX_UPLOAD_SIZE=50mb
```

Important variables:

- `PORT`: backend HTTP port. Defaults to `3000`.
- `CLIENT_PORT`: Vite development port.
- `ADMIN_USERNAME`: global admin username. Defaults to `admin`.
- `MASTER_PASSWORD`: global admin password. Required when `NODE_ENV=production`.
- `MAX_JSON_BODY_SIZE`: maximum JSON request body size. Defaults to `1mb`.
- `MAX_UPLOAD_SIZE`: maximum thumbnail and asset upload size. Defaults to `50mb`.

Advanced variables:

- `USERS_FILE`: custom path for `users.json`.
- `SESSION_FILE`: custom path for `sessions.json`.
- `COLLABORATION_DEBUG`: set to `true`, `1`, `yes`, or `on` to log collaboration events.

---

## Data Storage

Mysthra stores state on disk. In local development this defaults to `data/`; in Docker this path is mounted at `/app/data`.

```text
data/
  users.json
  sessions.json
  worlds/
    <world>/
      world.json
      pages/
      assets/
      yjs/
```

Key files and directories:

- `users.json`: internal non-admin users.
- `sessions.json`: active server-side sessions.
- `world.json`: world metadata, members, theme, thumbnail, home page, and public visitor settings.
- `pages/`: document tree, tab content, and document metadata.
- `assets/`: uploaded media.
- `yjs/`: persisted collaborative tab state.

Do not edit files under `data/` while the server is running unless you know the impact. The backend maintains an in-memory UID index for document paths and rebuilds it on startup.

---

## Useful Commands

Backend:

```bash
npm run dev
npm run dev:api
npm start
npm test
```

Frontend:

```bash
npm run dev:client
npm --prefix client run lint
npm --prefix client run build
npm --prefix client run preview
```

Build the production client:

```bash
npm run build
```

Recommended checks before committing:

```bash
npm test
npm --prefix client run lint
npm run build
```

---

## Architecture

- **Backend**: CommonJS Node.js HTTP server, without Express or a routing framework.
- **Routing**: single hand-written API router in `src/routes/index.js`.
- **Domain services**: filesystem-backed world, tree, asset, user, and collaboration services in `src/services/`.
- **Frontend**: React + Vite app in `client/`.
- **Editors**: BlockNote for wiki tabs, CodeMirror for Markdown/HTML, Konva for map and board canvases.
- **Collaboration**: Hocuspocus/Yjs over WebSocket.
- **Storage**: JSON and files under `data/`.

---

## Project Status

Mysthra is beta software. Current focus areas include:

- Stronger collaborative editing behavior.
- More complete map and board tools.
- Better permission and visitor workflows.
- More import/export and backup-friendly operations.
- Continued UI cleanup as the workspace grows.

---

## License

Mysthra is licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full license text.

<p align="center">
  <em>Forged for worlds that refuse to stay small.</em>
</p>
