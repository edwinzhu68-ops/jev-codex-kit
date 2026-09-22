import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
async function compile(dir, out) {
  await mkdir(out, { recursive: true });
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const source = path.join(dir, entry.name);
    if (entry.isDirectory()) await compile(source, path.join(out, entry.name));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      const result = ts.transpileModule(await readFile(source, 'utf8'), {
        fileName: source, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 }
      });
      if (result.diagnostics?.some(d => d.category === ts.DiagnosticCategory.Error)) throw Error('Vendor syntax error');
      await writeFile(path.join(out, entry.name.replace(/\.ts$/, '.js')), result.outputText);
    }
  }
}
for (const vendor of ['jev-mcp', 'pijev']) await compile(path.join(root, 'vendor', vendor, 'src'), path.join(root, 'vendor', vendor, 'dist'));
console.log('Built pinned vendor modules (transpilation; not upstream full-suite verification).');
