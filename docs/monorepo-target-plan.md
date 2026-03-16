# FloppyStack Monorepo Target

## Goal
Consolidate the current FloppyStack codebases into a single canonical monorepo rooted at `wookie-stack`.

This monorepo should eventually contain:
- legacy production web app
- React Native app
- Express backend
- MFE host
- MFE remotes
- shared FS64 libraries

## Current State
There are two active repos:

1. `floppystack64`
- Express backend
- legacy web client
- React Native app
- production reference implementation

2. `wookie-stack`
- Nx workspace
- MFE host
- `disks` remote
- `games` remote
- shared FS64 theme/ui/domain/registry libraries

## Recommended End State
Use `wookie-stack` as the long-term monorepo root.

### Apps
- `apps/backend`
- `apps/web-legacy`
- `apps/mobile`
- `apps/host`
- `apps/disks`
- `apps/games`
- later:
  - `apps/play`
  - `apps/config`
  - `apps/profile`

### Shared Libraries
- `libs/fs64/domain`
- `libs/fs64/theme`
- `libs/fs64/ui`
- `libs/fs64/registry`
- later:
  - `libs/fs64/auth`
  - `libs/fs64/play`
  - `libs/fs64/metadata`

## Migration Order
1. Stabilize runtime federation in the Nx workspace.
2. Import the backend into the Nx workspace as `apps/backend`.
3. Import the RN app as `apps/mobile` without refactoring behavior.
4. Import the legacy web app as `apps/web-legacy`.
5. Extract and reconcile shared contracts/libs.
6. Retire sibling-repo development flow.

## Phase 1 Decision
Do not physically move all files in one shot.

Instead, start with a transitional backend project inside Nx so:
- the workspace has a canonical `backend` app now
- scripts and CI can target `backend`
- the physical file move can happen later with less risk

## Transitional Backend Strategy
`apps/backend` in Nx is initially a wrapper project that runs the current backend from `../floppystack64`.

This gives us:
- one monorepo mental model
- one Nx project graph entry for backend
- a safe path to later move the actual backend files under `apps/backend`

## Physical Move Sequence
When the runtime is stable:
1. move backend code into `apps/backend`
2. fix backend local paths
3. point Nx backend targets at in-repo files
4. move RN app into `apps/mobile`
5. move legacy web app into `apps/web-legacy`
6. remove sibling repo dependency

## Non-Goals Right Now
- no backend framework rewrite
- no separate BFF split yet
- no full repo surgery before runtime stabilization

## Immediate Next Step
Treat `backend` as a first-class Nx app now, while the actual backend source remains in the sibling repo temporarily.
