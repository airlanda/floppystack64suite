
  import { createConfig }from '@nx/angular-rspack';
  import baseWebpackConfig from './webpack.config';
      import webpackMerge from 'webpack-merge';
  
  export default async () => {
        const baseConfig = await createConfig({ 
    options: {
      root: __dirname,
      
  "outputPath": {
    "base": "../../dist/apps/angular-disks"
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
    "port": 4301,
    "proxyConfig": "./proxy.conf.json",
    "publicHost": "http://localhost:4301"
  }

    }
  }, {
      "production": {
        options: {
          
  "budgets": [
    {
      "type": "initial",
      "maximumWarning": "1200kb",
      "maximumError": "1400kb"
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
            headers: {
              'Access-Control-Allow-Origin': '*',
            },
          },
        });};
        
