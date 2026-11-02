// Puts the sample member documents into the LOCAL R2 bucket (Wrangler's on-disk stand-in for Cloudflare R2).
// Documents are stored as page images (storage-seed/<folder>/p1.png ...). Never touches the remote bucket.
// To turn a PDF into pages: pdftoppm -png -r 110 file.pdf storage-seed/documents/<id>/p  (then rename p-1.png to p1.png).
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import documents from '../src/data/documents.json' with { type: 'json' };

const BUCKET = 'vault-human-member-files';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));

for (const d of documents) {
  for (let p = 1; p <= d.pages; p++) {
    const object = `${d.folder}/p${p}.png`;
    const file = here(`../storage-seed/${object}`);
    if (!existsSync(file)) { console.log(`skip ${object}: no local page`); continue; }
    execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${object}`, '--local', `--file=${file}`, '--content-type=image/png'], { stdio: 'inherit' });
  }
}
