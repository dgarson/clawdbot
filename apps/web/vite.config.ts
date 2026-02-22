import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import path from "path";
import { fileURLToPath } from "url";
import { visualizer } from "rollup-plugin-visualizer";

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default dev token for local development (must match gateway config)
const DEV_TOKEN = "dev-token-local";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const gatewayToken = env.OPENCLAW_GATEWAY_TOKEN || env.VITE_GATEWAY_TOKEN || DEV_TOKEN;
  const gatewayUrl = env.VITE_GATEWAY_URL || "http://127.0.0.1:18789";
  const gatewayWsUrl = gatewayUrl.replace(/^http/, "ws");

  return {
    plugins: [
      // TanStack Router must be before React plugin
      tanstackRouter({
        target: "react",
        autoCodeSplitting: true,
      }),
      react(),
      tailwindcss(),
      visualizer({
        filename: "./dist/stats.html",
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Split large vendor libraries into separate chunks
            // Strategy: Group packages by feature/domain to minimize circular dependencies
            if (id.includes('node_modules')) {
              // Large animation library
              if (id.includes('framer-motion')) {
                return 'vendor-framer';
              }
              // Icon library (large with many icons)
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              // TanStack ecosystem (check before React to avoid @tanstack/react-* being caught by React check)
              if (id.includes('@tanstack/')) {
                return 'vendor-tanstack';
              }
              // 3D rendering libraries (from reagraph)
              if (id.includes('three') || id.includes('@react-three/') || id.includes('@react-spring/three')) {
                return 'vendor-three';
              }
              // Terminal libraries
              if (id.includes('@xterm/xterm')) {
                return 'vendor-xterm';
              }
              if (id.includes('@xterm/addon-')) {
                return 'vendor-xterm-addons';
              }
              // Graph visualization
              if (id.includes('reagraph') || id.includes('graphology')) {
                return 'vendor-graph';
              }
              // Flow/DAG visualization (lazy-loaded, only used in workstreams/workflow)
              if (id.includes('@xyflow/')) {
                return 'vendor-xyflow';
              }
              // React ecosystem - bundle React core with Radix, state management and UI utilities
              // Radix depends on React internals, so they must stay together to avoid circular chunks
              if (
                id.match(/\/react\//) ||
                id.match(/\/react-dom\//) ||
                id.includes('@radix-ui/') ||
                id.includes('zustand') ||
                id.includes('immer') ||
                // React UI component libraries
                id.includes('cmdk') ||
                id.includes('sonner') ||
                // Shared UI utilities used heavily by React components
                id.includes('class-variance-authority') ||
                id.includes('clsx') ||
                id.includes('tailwind-merge') ||
                // React-specific utilities that React packages actually use
                id.includes('scheduler') ||
                id.includes('use-sync-external-store')
              ) {
                return 'vendor-react';
              }
              // Form libraries with validation
              if (id.includes('react-hook-form') || id.includes('@hookform/')) {
                return 'vendor-forms';
              }
              // Date utilities
              if (id.includes('date-fns')) {
                return 'vendor-dates';
              }
              // Schema validation (Zod v4 is large ~440KB, keep isolated for lazy loading)
              if (id.includes('zod') || id.includes('node_modules/zod/')) {
                return 'vendor-zod';
              }
              // Other vendor code
              return 'vendor';
            }
          },
        },
      },
    },
    server: {
      host: true,
      port: 5174,
      strictPort: true,
      fs: {
        allow: [path.resolve(__dirname, "../..")],
      },
      proxy: {
        "/ws": {
          target: gatewayWsUrl,
          ws: true,
          headers: { origin: gatewayUrl },
          rewrite: (p) => `${p}${p.includes("?") ? "&" : "?"}token=${encodeURIComponent(gatewayToken)}`,
        },
        "/api": {
          target: gatewayUrl,
          changeOrigin: true,
          headers: {
            Authorization: `Bearer ${gatewayToken}`,
          },
        },
      },
    },
  };
});
