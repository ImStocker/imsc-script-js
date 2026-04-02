import { defineConfig } from 'tsdown'

export default defineConfig([
  {
    entry: [
      'src/index.ts',
      'src/Props.ts',
      'src/Graph.ts'
    ],
    outDir: 'dist',
    format: ['esm', 'cjs'],
    splitting: true,
    dts: {
      tsgo: true,
    },
    exports: true,
    clean: true,
  },
  {
    entry: ['src/index.ts'],
    outDir: 'dist-browser',
    format: ['iife'],
    globalName: 'ImscScript',
    splitting: false,
    minify: true,
  }
])