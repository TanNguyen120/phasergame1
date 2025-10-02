import { defineConfig } from 'vite';
import checker from 'vite-plugin-checker';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [checker({ typescript: true })],
});
