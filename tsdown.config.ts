import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/Props.ts',
    'src/Graph.ts'
  ],
  dts: {
    tsgo: true,
  },
  exports: true,
  // ...config options
})
