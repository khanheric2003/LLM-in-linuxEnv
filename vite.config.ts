import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import * as dotenv from 'dotenv';


// load .env dotenv.config();
dotenv.config();

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  define: {
    'process.env': process.env
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})