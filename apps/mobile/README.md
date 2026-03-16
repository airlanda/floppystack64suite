# Mobile App

The React Native / Expo app is now physically imported into `apps/mobile`.

Current state:
- `nx serve mobile` runs the in-repo Expo app in `apps/mobile`
- `nx run mobile:check` validates the in-repo mobile data tests
- `nx run mobile:check:legacy` validates the original sibling mobile app

This app is now part of the monorepo source tree.
