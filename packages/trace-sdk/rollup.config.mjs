import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import esbuild from 'rollup-plugin-esbuild';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const external = [];
const srcDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'src');

const sdkAlias = {
  name: 'tracega-sdk-alias',
  resolveId(source) {
    if (!source.startsWith('@/')) {
      return null;
    }

    const target = path.resolve(srcDir, source.slice(2));
    return [`${target}.ts`, path.join(target, 'index.ts'), target].find(existsSync) ?? null;
  },
};

export default {
  input: 'src/index.ts',
  output: [
    {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    {
      file: 'dist/index.esm.js',
      format: 'esm',
      sourcemap: true,
    },
    {
      name: 'TraceGASDK',
      file: 'dist/index.umd.js',
      format: 'umd',
      sourcemap: true,
    },
  ],
  plugins: [
    sdkAlias,
    resolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.json',
      declaration: true,
      declarationDir: 'dist',
    }),
    esbuild({
      target: 'es2018',
      minify: false,
    }),
  ],
  external,
};
