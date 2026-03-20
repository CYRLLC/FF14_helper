import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const basePath = process.env.VITE_BASE_PATH ?? './'
const normalizedBasePath =
  basePath === './' ? './' : basePath.endsWith('/') ? basePath : `${basePath}/`

export default defineConfig({
  plugins: [react()],
  base: normalizedBasePath,
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
  optimizeDeps: {
    // onnxruntime-web ships its own WASM and must NOT be pre-bundled by Vite
    exclude: ['onnxruntime-web'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
