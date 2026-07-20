import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import esbuild from 'rollup-plugin-esbuild';

const entries = {
  index: 'src/index.ts',
  core: 'src/core/index.ts',
  behavior: 'src/plugins/behavior/index.ts',
  error: 'src/plugins/error/index.ts',
  utils: 'src/utils/index.ts',
};

const umdEntries = [
  ['index', entries.index, 'TraceGASDK'],
  ['core', entries.core, 'TraceGACore'],
  ['behavior', entries.behavior, 'TraceGABehavior'],
  ['error', entries.error, 'TraceGAError'],
  ['utils', entries.utils, 'TraceGAUtils'],
];

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
