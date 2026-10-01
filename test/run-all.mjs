// Run every test file. No framework: `node test/run-all.mjs`.
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((f) => f.endsWith('.test.mjs')).sort();

let failed = 0;
for (const file of files) {
  const { status } = spawnSync(process.execPath, [join(here, file)], { stdio: 'inherit' });
  if (status !== 0) failed++;
}
console.log(failed ? `\n${failed}/${files.length} test file(s) failed\n` : `\n${files.length}/${files.length} test files passed\n`);
process.exit(failed ? 1 : 0);
