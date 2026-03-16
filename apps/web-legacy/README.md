# Web Legacy App

The legacy production web client is now physically imported into `apps/web-legacy`.

Current state:
- `nx serve web-legacy` runs the in-repo legacy web app in `apps/web-legacy`
- `nx run web-legacy:check` validates the in-repo Vite build
- `nx run web-legacy:check:legacy` validates the original sibling web app

This app is now part of the monorepo source tree.
