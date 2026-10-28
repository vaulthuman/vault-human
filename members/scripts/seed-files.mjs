// Puts the sample member files into the LOCAL R2 bucket (Wrangler's on-disk stand-in for Cloudflare R2).
// Reads the B003 video from the public site's folder without changing it. Never touches the remote bucket.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import downloads from '../src/data/downloads.json' with { type: 'json' };

const BUCKET = 'vault-human-member-files';
const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const sources = {
  guide: here('../storage-seed/vault-human-member-guide.pdf'),
  'b003-video': here('../../public/video/b003-thank-your-body.mp4'),
};

for (const d of downloads) {
  const file = sources[d.id];
  if (!file || !existsSync(file)) { console.log(`skip ${d.id}: no local source`); continue; }
  execFileSync('npx', ['wrangler', 'r2', 'object', 'put', `${BUCKET}/${d.object}`, '--local', `--file=${file}`, `--content-type=${d.contentType}`], { stdio: 'inherit' });
}
