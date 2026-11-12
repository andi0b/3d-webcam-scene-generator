import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: process.env.PAGES_BASE_URL ?? '/',
  plugins: [basicSsl()],
});
