import { defineConfig } from 'vitest/config'

// Tests run in plain Node: they cover the server functions, the chatbot's search and the world layout, none of which need a browser.
export default defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } })
