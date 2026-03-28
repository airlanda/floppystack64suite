import { ModuleFederationConfig } from '@nx/module-federation';

const localOnlyShared = new Set([
  '@angular/common',
  '@angular/core',
  '@angular/forms',
  '@angular/platform-browser',
  '@angular/router',
  'rxjs',
]);

const config: ModuleFederationConfig = {
  name: 'angularGames',
  shared: (libraryName, sharedConfig) => {
    if (!localOnlyShared.has(libraryName)) {
      return sharedConfig;
    }

    return false;
  },
  exposes: {
    './Routes': 'apps/angular-games/src/app/remote-entry/entry.routes.ts',
  },
};

/**
* Nx requires a default export of the config to allow correct resolution of the module federation graph.
**/
export default config;
