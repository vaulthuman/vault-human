// Writes storage-seed/vault-human-member-guide.pdf: a one-page placeholder until the real guide exists.
import { writeFileSync } from 'node:fs';

const lines = [
  ['F2', 28, 'VAULT HUMAN'],
  ['F1', 14, 'The member guide'],
  ['F1', 11, 'Placeholder. The real guide will replace this file.'],
  ['F1', 11, 'www.vaulthuman.com'],
];
let y = 720;
const text = lines
  .map(([f, size, t]) => { const s = `BT /${f} ${size} Tf 72 ${y} Td (${t}) Tj ET`; y -= size + 18; return s; })
  .join('\n');
const objs = [
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>',
  `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
];
let pdf = '%PDF-1.4\n';
const offsets = objs.map((o, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
const xref = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
writeFileSync(new URL('../storage-seed/vault-human-member-guide.pdf', import.meta.url), pdf, 'latin1');
console.log('wrote storage-seed/vault-human-member-guide.pdf');
