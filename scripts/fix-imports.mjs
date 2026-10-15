import { readdirSync, statSync, readFileSync, writeFileSync } from 'fs';
import { join, relative, dirname, sep, posix } from 'path';

const ROOT = 'src';
const FROM_PREFIX = '@/lib/supabase';
const TO_BASE = join(process.cwd(), 'src/lib/supabase');

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

const files = walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f));
let changed = 0;

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  let next = src.replace(
    /from\s+['"]@\/lib\/supabase\/([^'"]+)['"]/g,
    (_, sub) => {
      const target = join(TO_BASE, sub);
      let rel = relative(dirname(file), target).split(sep).join(posix.sep);
      if (!rel.startsWith('.')) rel = './' + rel;
      return `from '${rel}'`;
    }
  );
  // também cobre import('@/lib/supabase/...')
  next = next.replace(
    /import\(\s*['"]@\/lib\/supabase\/([^'"]+)['"]\s*\)/g,
    (_, sub) => {
      const target = join(TO_BASE, sub);
      let rel = relative(dirname(file), target).split(sep).join(posix.sep);
      if (!rel.startsWith('.')) rel = './' + rel;
      return `import('${rel}')`;
    }
  );
  if (next !== src) {
    writeFileSync(file, next);
    console.log('✔', file);
    changed++;
  }
}
console.log(`\n✅ ${changed} arquivo(s) atualizado(s).`);
