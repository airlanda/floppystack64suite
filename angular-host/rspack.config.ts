import { createConfig } from '@nx/angular-rspack';
import { NxModuleFederationPlugin } from '@nx/module-federation/src/plugins/nx-module-federation-plugin/angular/nx-module-federation-plugin';
import { NxModuleFederationDevServerPlugin } from '@nx/module-federation/src/plugins/nx-module-federation-plugin/angular/nx-module-federation-dev-server-plugin';
import config from './module-federation.config';

const rspackConfig = createConfig(
  {
    options: {
      root: __dirname,
      outputPath: {
        base: '../dist/angular-host',
      },
      index: './src/index.html',
      browser: './src/main.ts',
      tsConfig: './tsconfig.app.json',
      assets: [
        {
          glob: '**/*',
          input: './public',
        },
      ],
      styles: ['./src/styles.css'],
      devServer: {
        port: 4300,
      },
    },
  },
  {
    production: {
      options: {
        budgets: [
          {
            type: 'initial',
            maximumWarning: '500kb',
            maximumError: '1mb',
          },
          {
            type: 'anyComponentStyle',
            maximumWarning: '4kb',
            maximumError: '8kb',
          },
        ],
        outputHashing: 'all',
      },
    },
    development: {
      options: {
        optimization: false,
        vendorChunk: true,
        extractLicenses: false,
        sourceMap: true,
        namedChunks: true,
      },
    },
  }
);

rspackConfig.plugins ??= [];
rspackConfig.plugins.push(new NxModuleFederationPlugin({ config }, { dts: false }));
rspackConfig.plugins.push(new NxModuleFederationDevServerPlugin({ config }));

export default rspackConfig;
