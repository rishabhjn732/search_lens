import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Browser-only app: it calls OpenSearch directly, so there is no /api proxy.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
  },
});
