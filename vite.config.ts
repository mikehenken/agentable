import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { inspectAttr } from 'kimi-plugin-inspect-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [inspectAttr(), react()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      classnames: path.resolve(__dirname, "./src/shims/classnames.ts"),
      "classnames-original": path.resolve(__dirname, "./node_modules/classnames/index.js"),
    },
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "tldraw",
      "@tldraw/editor",
      "classnames",
    ],
  },
});
