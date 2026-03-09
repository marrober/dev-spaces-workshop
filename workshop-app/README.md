# Web App

A simple Node.js web application using Express.

## Prerequisites

- Node.js 18 or later

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

Then open [http://localhost:3000](http://localhost:3000). User page for reserving clusters: [http://localhost:3000/clusters](http://localhost:3000/clusters).

For development with auto-restart on file changes:

```bash
npm run dev
```

## Endpoints

- `GET /` — Serves the main page
- `GET /clusters` — User page: list clusters (Cluster 1, Cluster 2, …) and reserve by name
- `GET /admin` — Administration page (drop/paste text for the app to interpret)
- `GET /api/health` — Health check (returns JSON)
- `POST /api/admin/text` — Submit text from the admin page (body: `{ "text": "…" }`). Extracts and stores `rosa_openshift_admin_password` → `adminPassword`, `rosa_openshift_admin_user` → `adminUser`, `rosa_openshift_console_url` → `consoleURL` (format: `key = value` or `key: value`). Multiple submissions are all stored.
- `GET /api/admin/credentials` — Returns all stored credential sets (array of `{ adminPassword?, adminUser?, consoleURL?, submittedAt?, reservedBy? }`)
- `GET /api/admin/workshop-url` — Returns current workshop URL (`{ workshopUrl }`)
- `POST /api/admin/workshop-url` — Set workshop URL (body: `{ "url": "…" }`)
- `DELETE /api/admin/credentials` — Clears all stored credentials (for restart)
- `GET /api/clusters` — Returns clusters and workshop URL (`{ clusters, workshopUrl }`); clusters include consoleURL, adminUser, reservedBy per cluster (no password)
- `POST /api/clusters/:index/reserve` — Reserve a specific cluster (body: `{ "name": "…" }`); sets `reservedBy` on that credential set
- `POST /api/clusters/reserve` — Allocate the first unallocated cluster to the given name (body: `{ "name": "…" }`); returns `{ reserved, index, clusterNumber, reservedBy }` or 409 if no clusters available. Atomic to avoid double-allocation.
