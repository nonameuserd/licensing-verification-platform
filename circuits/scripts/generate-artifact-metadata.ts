import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function findRepoRoot() {
  let cur = process.cwd();
  while (!fs.existsSync(path.join(cur, 'package.json'))) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return cur;
}

const root = findRepoRoot();
const circuitsDir = path.join(root, 'circuits');
const outDir = path.join(root, 'artifacts');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

const files = [
  'build/ExamProof_js/ExamProof.wasm',
  'build/ExamProof.r1cs',
  'verification_key.json',
];

interface FileEntry {
  sha256: string;
  size: number;
}
interface Meta {
  artifact_version: string;
  name: string;
  commit: string;
  build_time: string;
  files: Record<string, FileEntry>;
}

const meta: Meta = {
  artifact_version: '1',
  name: 'ExamProof',
  commit: process.env['GITHUB_SHA'] || 'local',
  build_time: new Date().toISOString(),
  files: {},
};

for (const f of files) {
  const p = path.join(circuitsDir, f);
  if (!fs.existsSync(p)) continue;
  const buf = fs.readFileSync(p);
  const h = crypto.createHash('sha256').update(buf).digest('hex');
  meta.files[f] = { sha256: h, size: buf.length };
}

const outPath = path.join(outDir, 'artifact-metadata.json');
fs.writeFileSync(outPath, JSON.stringify(meta, null, 2));
console.log('Wrote', outPath);
