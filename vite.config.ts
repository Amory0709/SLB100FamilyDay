import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

const rootDir = import.meta.dirname;

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [{ src: 'assets/**/*', dest: 'assets' }],
    }),
  ],
  base: process.env.GITHUB_PAGES === 'true' ? '/SLB100FamilyDay/' : '/',
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
});
