import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import esbuild from 'rollup-plugin-esbuild';
import { rmSync } from 'fs';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

const entries = {
  index: 'src/index.ts',
  core: 'src/core/index.ts',
  behavior: 'src/plugins/behavior/index.ts',
  error: 'src/plugins/error/index.ts',
  utils: 'src/utils/index.ts',
  performance: 'src/plugins/performance/index.ts',
};

const umdEntries = [
  ['index', entries.index, 'TraceGASDK'],
  ['core', entries.core, 'TraceGACore'],
  ['behavior', entries.behavior, 'TraceGABehavior'],
  ['error', entries.error, 'TraceGAError'],
  ['utils', entries.utils, 'TraceGAUtils'],
  ['performance', entries.performance, 'TraceGAPerformance'],
];

function clean() {
  return {
    name: 'clean',
    buildStart() {
      try {
        rmSync('dist', { recursive: true, force: true });
      } catch {
        // dist may not exist on first build
      }
    },
  };
}

function runtimePlugins() {
  return [
    resolve(),
    commonjs(),
    esbuild({
      minify: false,
      target: 'es2018',
    }),
  ];
}

const moduleBuild = {
  input: entries,
  output: [
    {
      chunkFileNames: 'chunks/[name]-[hash].cjs',
      dir: 'dist',
      entryFileNames: '[name].cjs',
      exports: 'named',
      format: 'cjs',
      sourcemap: true,
    },
    {
      chunkFileNames: 'chunks/[name]-[hash].mjs',
      dir: 'dist',
      entryFileNames: '[name].mjs',
      format: 'esm',
      sourcemap: true,
    },
  ],
  plugins: [
    clean(),
    resolve(),
    commonjs(),
    typescript({
      declaration: true,
      declarationDir: 'dist',
      tsconfig: './tsconfig.json',
    }),
    esbuild({
      minify: false,
      target: 'es2018',
      define: {
        __SDK_VERSION__: JSON.stringify(pkg.version),
      },
    }),
  ],
};

const umdBuilds = umdEntries.map(([entryName, input, globalName]) => ({
  input,
  output: {
    exports: 'named',
    file: `dist/${entryName}.umd.js`,
    format: 'umd',
    name: globalName,
    sourcemap: true,
  },
  plugins: runtimePlugins(),
}));

export default [moduleBuild, ...umdBuilds];
