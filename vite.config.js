import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

const page = (name) => fileURLToPath(new URL(name, import.meta.url))

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        catalog: page('index.html'),
        favorites: page('favorites.html'),
      },
    },
  },
})
