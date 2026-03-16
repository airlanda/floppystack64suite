import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

export default defineConfig({
  plugins: [
    react(),

    svgr({
      include: "**/*.svg",
      // keep exclude undefined unless you really need it
      exportAsDefault: false,
      svgrOptions: {
        icon: false,
        svgo: true,
        ref: false,
        titleProp: true,
        prettier: false,
        svgoConfig: {
          plugins: [
            {
              name: "preset-default",
              params: {
                overrides: {
                  removeViewBox: false,
                },
              },
            },
          ],
        },
      },
    }),

    // Put legacy LAST so it can wrap the final output
    legacy({
      // Android WebView can lag behind Chrome, so be explicit
      targets: ["Android >= 7", "Chrome >= 60"],
      // Ensures polyfills for modern chunk too (helps some WebViews)
      modernPolyfills: true,
      // Ensure legacy chunks are generated consistently
      renderLegacyChunks: true,

      // Uncomment if you still see generator/async issues on older WebViews
      // additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
  ],

  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  css: {
    modules: {
      localsConvention: "camelCase",
    },
  },

  optimizeDeps: {
    // usually not required, but harmless
    include: ["react/jsx-runtime"],
  },

  build: {
    // Debug mode: stop “b is not a function” minified nonsense
    sourcemap: true,
    minify: false,
    target: "es2015",
  },
});
