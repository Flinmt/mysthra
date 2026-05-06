# <p align="center"><img src="client/public/favicon.png" width="80" height="80" alt="Mysthra Logo" /><br/>Mysthra</p>

<p align="center">
  <strong>Self-hosted worldbuilding workspace</strong><br/>
  <em>Worlds, wiki documents, media assets, and shared editing in a dark Nexus-style interface.</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Beta-purple?style=for-the-badge" alt="Status" />
  <img src="https://img.shields.io/badge/License-AGPL--3.0-red?style=for-the-badge" alt="License" />
  <img src="https://img.shields.io/badge/Self--Hosted-Yes-green?style=for-the-badge" alt="Self Hosted" />
</p>

---

## What Is Mysthra?

**Mysthra** is a self-hosted app for building fictional worlds. It is designed around a private "Nexus" dashboard where you manage worlds, then enter each world as a workspace with a wiki tree, rich wiki tabs, assets, covers, thumbnails, and document-level editing controls.

The project is in beta and moving fast. The current focus is a solid writing/workspace foundation: worlds, root documents, tabs, BlockNote wiki editing, asset uploads, multiuser access per world, and read-only visitor sharing.

---

## Current Features

### Nexus Dashboard

- Create, edit, delete, and search worlds.
- Add thumbnails to worlds.
- Configure internal Mysthra users as the global admin.
- Manage which worlds each user can access.
- Switch language between `pt` and `en`.

### World Workspace

- Wiki tree in the left sidebar.
- Root documents/containers with child documents.
- Tabs inside each document.
- Wiki tabs powered by **BlockNote**.
- Map tabs are preserved as a separate tab type.
- Inline tab creation, without modal prompts.
- Context menus for documents, tabs, and assets.
- Document cover image, repositioning, icon, and inline title rename.
- Home page support: a root document can be marked as the default page for the world.
- Document lock/unlock state stored in document metadata.

### Assets

- Asset sidebar for authenticated users.
- Upload images, GIFs, and audio files.
- Create folders, move, duplicate, and delete assets.
- Insert images into Wiki content through drag/drop or editor context menu.
- Assets can still be served to visitors when needed for covers and wiki rendering.

### Users And Access

- Login uses `username + password`.
- The global admin is defined by environment variables.
- Admin can create/delete users and reset passwords.
- Admin can grant or revoke access to worlds per user.
- A normal logged-in user can edit worlds where they are a member.
- There is no viewer role: read-only access is handled by visitor mode.
- Sessions expire after 24 hours in both the browser cookie and the server-side session store.

### Visitor Mode

- Public visitor links use `/world/:id?view=true`.
- Visitor mode requires `PUBLIC_READ=true` on the server.
- Visitors are read-only.
- Visitors see only the Wiki tree, not Assets or Templates UI.
- Visitors cannot create, edit, upload, rename, delete, change covers, or unlock documents.

---

## Data Model

Mysthra stores data on disk under `data/` by default.

- `data/users.json`: internal non-admin users.
- `data/sessions.json`: active sessions with server-side expiration.
- `data/worlds/<world>/world.json`: world metadata, members, thumbnail info, and home page.
- `data/worlds/<world>/documents`: document/container/tab content and metadata.
- `data/worlds/<world>/assets`: uploaded media files.

Wiki content is saved as native BlockNote JSON serialized into the existing document content storage. Older Markdown content is converted client-side when opened.

---

## Requirements

- Node.js `>=22`
- npm
- Docker, optional but recommended for self-hosting

---

## Environment

Create a `.env` file in the repository root:

```env
PORT=3000
ADMIN_USERNAME=admin
MASTER_PASSWORD=change-this-password
PUBLIC_READ=false
```

Important variables:

- `PORT`: HTTP port used by the Node server.
- `ADMIN_USERNAME`: global admin username. Defaults to `admin`.
- `MASTER_PASSWORD`: password for the global admin. Required in production.
- `PUBLIC_READ`: enables unauthenticated visitor access when set to `true`.

Optional advanced variables:

- `USERS_FILE`: custom path for the users JSON file.
- `SESSION_FILE`: custom path for the sessions JSON file.

---

## Running Locally

Install backend dependencies:

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
```

Start the backend from the repository root:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The backend serves the built client in production. During frontend development, you can also run Vite from `client/` if needed:

```bash
npm run dev
```

---

## Docker Compose

The repository includes a `docker-compose.yml` for self-hosting:

```bash
export MASTER_PASSWORD=change-this-password
export PUBLIC_READ=false
docker-compose up -d
```

Mysthra will be available at:

```text
http://localhost:3000
```

Persistent data is mounted at:

```text
./data:/app/data
```

Set `PUBLIC_READ=true` only if you want visitor links to work without login.

---

## Scripts

Backend:

```bash
npm run dev
npm run start
npm test
```

Frontend:

```bash
cd client
npm run dev
npm run lint
npm run build
npm run preview
```

Recommended verification before committing:

```bash
npm test
cd client
npm run lint
npm run build
```

---

## Tech Stack

- Frontend: React 19, Vite, Wouter, i18next, Lucide React
- Wiki editor: BlockNote, Mantine
- Backend: Node.js HTTP server
- Storage: filesystem JSON/files
- License: AGPL-3.0-only

---

## Roadmap Notes

Planned or intended areas include:

- More complete map tab implementation.
- Per-file visibility such as `world` vs `private`.
- Better conflict handling for simultaneous editing.
- More document and world configuration actions.
- Templates returning as a fuller workspace feature.

---

## License

Mysthra is licensed under the **GNU Affero General Public License v3.0 only** (`AGPL-3.0-only`). See [LICENSE](LICENSE) for the full license text.

<p align="center">
  <em>Forged for worlds that refuse to stay small.</em>
</p>
