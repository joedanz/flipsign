import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: r('./src/web'),
  server: { proxy: { '/api': 'http://localhost:3000', '/events': 'http://localhost:3000' } },
  build: {
    outDir: r('./dist'),
    emptyOutDir: true,
    target: 'chrome110',
    rollupOptions: {
      input: { display: r('./src/web/index.html'), control: r('./src/web/control/index.html') },
    },
  },
});
