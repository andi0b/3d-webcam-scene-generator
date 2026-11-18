import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  base: process.env.PAGES_BASE_URL ?? '/',
  plugins: [svelte(), basicSsl()],
});
