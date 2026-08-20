import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import path from 'path';

const rootDir = import.meta.dirname;
const forGitHubPages = process.env.GITHUB_PAGES === 'true';

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [{ src: 'assets/**/*', dest: 'assets' }],
    }),
  ],
  base: forGitHubPages ? '/SLB100FamilyDay/docs/' : '/',
  build: {
    outDir: forGitHubPages ? 'docs' : 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
});
