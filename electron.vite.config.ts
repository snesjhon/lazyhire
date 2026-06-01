import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import react from '@vitejs/plugin-react';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const shared = resolve(__dirname, 'shared');

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/main.ts'),
        },
      },
    },
    resolve: {
      alias: { '@shared': shared },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'electron/preload.ts'),
        },
        output: {
          format: 'cjs',
          entryFileNames: '[name].js',
        },
      },
    },
    resolve: {
      alias: { '@shared': shared },
    },
  },
  renderer: {
    root: resolve(__dirname, 'src'),
    server: {
      host: '127.0.0.1',
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/index.html'),
        },
      },
    },
    resolve: {
      alias: { '@shared': shared },
    },
    plugins: [react()],
  },
});
