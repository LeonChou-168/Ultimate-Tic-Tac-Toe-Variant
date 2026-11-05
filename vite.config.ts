/// <reference types="vitest/config" />

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/Ultimate-Tic-Tac-Toe-Variant/' : '/',
  plugins: [react()],
  test: {
    environment: 'jsdom',
  },
});
