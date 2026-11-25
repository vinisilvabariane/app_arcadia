import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base relativa: funciona no GitHub Pages em qualquer subpasta (usuario.github.io/repo/)
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
});
