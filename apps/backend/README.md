# Backend Transitional App

This Nx project now contains an imported copy of the Express backend source under `apps/backend`.

Current state:
- `nx serve backend` still runs the sibling repo backend in `../floppystack64`
- `nx run backend:check` validates the imported in-repo `apps/backend/server.js`
- `nx run backend:check:legacy` validates the original sibling repo server

Why this split exists:
- the source is now visible and versioned in the monorepo
- runtime still points at the legacy location until dependency parity and path cleanup are completed

Planned future state:
- install/align backend runtime dependencies in the monorepo
- point `serve` at `apps/backend/server.js`
- remove the sibling repo dependency
