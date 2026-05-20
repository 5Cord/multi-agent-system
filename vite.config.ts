import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig(() => {
  return {
    base: '/',
    plugins: [react()],
    resolve: {
      alias: {
        app: r('src/app'),
        assets: r('src/assets'),
        features: r('src/features'),
        pages: r('src/pages'),
        services: r('src/services'),
        shared: r('src/shared'),
        styles: r('src/styles'),
        widgets: r('src/widgets'),
      }
    },
    test: {
      globals: true,
      environment: 'node',
    }
  };
});
