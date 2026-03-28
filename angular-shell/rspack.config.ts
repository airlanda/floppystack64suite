
  import { createConfig }from '@nx/angular-rspack';
  import baseWebpackConfig from './webpack.config';
      import webpackMerge from 'webpack-merge';
  
  export default async () => {
        const baseConfig = await createConfig({ 
    options: {
      root: __dirname,
      
  "outputPath": {
    "base": "../dist/angular-shell"
  },
  "index": "./src/index.html",
  "browser": "./src/main.ts",
  "tsConfig": "./tsconfig.app.json",
  "assets": [
    {
      "glob": "**/*",
      "input": "./public"
    }
  ],
  "styles": [
    "./src/styles.css"
  ],
  "devServer": {
    "port": 4200,
    "proxyConfig": "./proxy.conf.json",
    "publicHost": "http://localhost:4200"
  }

    }
  }, {
      "production": {
        options: {
          
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "700kb",
      "maximumError": "900kb"
    },
    {
      "type": "anyComponentStyle",
      "maximumWarning": "8kb",
      "maximumError": "12kb"
    }
  ],
  "outputHashing": "all",
  "devServer": {}

        }
      },

      "development": {
        options: {
          
  "optimization": false,
  "vendorChunk": true,
  "extractLicenses": false,
  "sourceMap": true,
  "namedChunks": true,
  "devServer": {}

        }
      }});
        return webpackMerge(baseConfig[0], baseWebpackConfig, {
          devServer: {
            historyApiFallback: {
              disableDotRule: true,
              index: '/index.html',
            },
            proxy: [
              {
                context: ['/backend'],
                target: 'http://localhost:5000',
                changeOrigin: true,
                secure: false,
              },
            ],
          },
        });};
