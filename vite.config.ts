import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    strictPort: true,
    watch: {
      ignored: ['**/engine/target/**', '**/.local/**', '**/playtest-results/**', '**/test-results*/**', '**/playwright-report/**'],
    },
  },
  build: { target: 'es2022' },
});
