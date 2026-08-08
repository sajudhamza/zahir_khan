import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { recipeAdminPlugin } from './server/recipeAdmin.js'

export default defineConfig({
  plugins: [react(), recipeAdminPlugin()],
})
