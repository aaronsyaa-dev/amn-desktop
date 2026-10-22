import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const racine = process.cwd();
const globVite = { name: 'g', setup(b) { b.onLoad({ filter: /modules[\\/]registre\.ts$/ }, (a) => {
  const dir = path.dirname(a.args?.path ?? a.path); const imports = [];
  const c = fs.readFileSync(a.path, 'utf8').replace(/import\.meta\.glob(?:<[^>]*>)?\(\s*'\.\/([\w-]+)\/\*\.ts'[^)]*\)/g, (_t, sous) => {
    const fs_ = fs.readdirSync(path.join(dir, sous)).filter((f) => f.endsWith('.ts')).sort();
    return '{ ' + fs_.map((f) => { const n = imports.length; imports.push(`import * as g${n} from './${sous}/${f}';`); return `'./${sous}/${f}': g${n}`; }).join(', ') + ' }'; });
  return { contents: imports.join('\n') + '\n' + c, loader: 'ts' }; }); } };
const b = await esbuild.build({ stdin: { contents: process.argv[2], resolveDir: racine + '/scripts', loader: 'ts' }, plugins: [globVite], bundle: true, write: false, format: 'esm', platform: 'node', tsconfig: racine + '/tsconfig.json', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"', 'import.meta.env.DEV': 'false', __AMN_EDITION__: '"internal"', __AMN_VERSION__: '"0.0.0"' }, logLevel: 'silent' });
await import('data:text/javascript;base64,' + Buffer.from(b.outputFiles[0].text).toString('base64'));
