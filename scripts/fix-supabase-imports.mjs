import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, dirname, sep, posix, resolve } from 'path';

const CWD     = process.cwd();
const ROOT    = resolve(CWD, 'src');
const FROM_BASE = resolve(CWD, 'src/lib/supabase');

// Regex que pega TANTO '@\/lib\/supabase/x' QUANTO '../../lib/supabase/x'
const RE_STATIC  = /from\s+['"](?:@\/lib\/supabase|(?:\.\.\/)+lib\/supabase)\/([^'"]+)['"]/g;
const RE_DYNAMIC = /import\(\s*['"](?:@\/lib\/supabase|(?:\.\.\/)+lib\/supabase)\/([^'"]+)['"]\s*\)/g;

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    // ignora node_modules, .next, backups
    if (f === 'node_modules' || f === '.next' || f.endsWith('.bak')) return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function toRel(filePath, sub) {
  const target = join(FROM_BASE, sub);
  const dirAbs = dirname(resolve(filePath));           // ⬅️ SEMPRE absoluto
  let rel = relative(dirAbs, target).split(sep).join(posix.sep);
  if (!rel.startsWith('.')) rel = './' + rel;
  return rel;
}

const files = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f));
let changed = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const next = src
    .replace(RE_STATIC,  (_, sub) => `from '${toRel(file, sub)}'`)
    .replace(RE_DYNAMIC, (_, sub) => `import('${toRel(file, sub)}')`);

  if (next !== src) {
    writeFileSync(file, next);
    console.log('✔', relative(CWD, file));
    changed++;
  }
}
console.log(`\n✅ ${changed} arquivo(s) atualizado(s).`);
