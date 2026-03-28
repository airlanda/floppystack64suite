# WookieStack

WookieStack is an Nx monorepo with a shared backend plus multiple frontend surfaces:

- React micro frontends for the current host/disks/games/play experience
- Angular experiments and Angular micro frontends
- A legacy web app
- A mobile app

## Prerequisites

- Node.js 20+
- npm

Install dependencies with:

```sh
npm install
```

## Apps In This Workspace

### Backend

- `backend`
  - Express API used by the frontend apps
  - Default port: `5000`
  - Run with: `npm run dev:backend`

### React Micro Frontends

- `host`
  - Main React host shell
  - Port: `4200`
  - Run with: `npm run dev:host`

- `disks`
  - React disks micro frontend
  - Port: `4201`
  - Run with: `npm run dev:disks`

- `games`
  - React games micro frontend
  - Port: `4202`
  - Run with: `npm run dev:games`

- `play`
  - React play app / frontend surface
  - Port: `4203`
  - Run with: `npm run dev:play`

### Angular Apps And Experiments

- `angular-host`
  - Older Angular host experiment
  - Port: `4300`
  - Run with: `npm run dev:angular-host`

- `angular-shell`
  - New Angular shell for dynamic remote loading
  - Port: `4200`
  - Run with: `npm run dev:angular-shell`

- `angularDisks`
  - New Angular disks micro frontend
  - Port: `4301`
  - Run with: `npm run dev:angular-disks`

- `angularGames`
  - New Angular games micro frontend
  - Port: `4302`
  - Run with: `npm run dev:angular-games`

### Other Apps

- `web-legacy`
  - Legacy web app
  - Run with: `npm run dev:web-legacy`

- `mobile`
  - Mobile app
  - Run with: `npm run dev:mobile`
  - Expo entry: `npm run dev:mobile:expo`

### E2E Projects

- `host-e2e`
- `disks-e2e`

## Common Run Flows

### Backend Only

```sh
npm run dev:backend
```

### Current React Frontend Stack

Starts `host`, `disks`, `games`, and `play` together:

```sh
npm run dev:frontend
```

If you want the backend too, run it in a separate terminal:

```sh
npm run dev:backend
```

### Angular Micro Frontend Stack

Starts the new Angular shell plus the two new Angular remotes:

```sh
npm run dev:angular-mfes
```

Run the backend in a separate terminal:

```sh
npm run dev:backend
```

If you want a clean port reset first:

```sh
npm run dev:angular-mfes:clean
```

### Older Angular Interop Stack

Starts the older Angular host experiment plus the existing `disks` and `games` apps:

```sh
npm run dev:angular-interop
```

### Start Everything For Local React Development

```sh
npm run start-all:dev:clean
```

## Useful Commands

### Show all Nx projects

```sh
npx nx show projects
```

### Run a target directly

```sh
npx nx <target> <project>
```

Example:

```sh
npx nx build angular-shell
```

### Build the Angular micro frontends

```sh
npx nx build angular-shell
npx nx build angularDisks
npx nx build angularGames
```

### Check the backend entrypoint

```sh
npx nx run backend:check
```

## Ports Summary

- `5000` backend
- `4200` React host or Angular shell, depending on what you start
- `4201` React disks
- `4202` React games
- `4203` play
- `4300` older Angular host
- `4301` Angular disks
- `4302` Angular games

## Notes

- `host` and `angular-shell` both want port `4200`. Run one stack at a time unless you change ports.
- The Angular micro frontends reuse the same backend APIs as the React apps.
- If ports are stuck from prior runs, use:

```sh
npm run clean:dev-ports
```
