import path from 'path'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  resolve: {
    alias: {
      '@external': path.resolve(__dirname, './src/external'),
      '@logic': path.resolve(__dirname, './src/logic'),
      '@src': path.resolve(__dirname, './src'),
    },
  },
})
