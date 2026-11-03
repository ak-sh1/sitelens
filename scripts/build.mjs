import { build } from 'esbuild';
import { mkdir, rm, cp, writeFile, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
process.chdir(root);
await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('extension', 'dist', { recursive: true });
await build({ entryPoints: ['src/background.ts', 'src/popup.ts', 'src/options.ts'], bundle: true, outdir: 'dist', format: 'esm', target: 'chrome120', minify: false, legalComments: 'eof' });
await mkdir('.artifacts', { recursive: true });
await build({ stdin: { contents: "export * from './src/analyzer'; export * from './src/features'; export * from './src/domains'; export * from './src/collector'; export * from './src/model'; export * from './src/settings';", resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: '.artifacts/core.mjs' });
for (const dependency of ['tldts', 'tldts-core']) {
  const license = await readFile(`node_modules/${dependency}/LICENSE`, 'utf8');
  await writeFile(path.join('dist', `${dependency}-LICENSE.txt`), license);
}
console.log('Built dist/ — load this folder in chrome://extensions.');
