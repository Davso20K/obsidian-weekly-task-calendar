import esbuild from 'esbuild';
import { builtinModules } from 'node:module';

const watch = process.argv[2] === 'watch';

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  format: 'cjs',
  target: 'es2020',
  platform: 'node',
  outfile: 'main.js',
  sourcemap: watch ? 'inline' : false,
  minify: !watch,
  logLevel: 'info',
  external: [
    'obsidian',
    'electron',
    '@codemirror/*',
    '@lezer/*',
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
});

if (watch) {
  await ctx.watch();
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
