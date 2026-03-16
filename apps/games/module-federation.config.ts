import { ModuleFederationConfig } from '@nx/module-federation';

const reactSingletons = new Set(['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime']);

const config: ModuleFederationConfig = {
  name: 'games',
  exposes: {
    './Module': './src/remote-entry.ts',
    './WebComponent': './src/web-component.tsx',
  },
  shared: (libraryName, sharedConfig) => {
    if (reactSingletons.has(libraryName)) {
      return {
        ...sharedConfig,
        singleton: true,
        strictVersion: false,
        requiredVersion: false,
      };
    }

    return sharedConfig;
  },
};

export default config;
