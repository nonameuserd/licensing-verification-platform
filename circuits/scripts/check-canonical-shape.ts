#!/usr/bin/env ts-node

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { CircuitLogger } from '../src/lib/logger';

const ROOT_DIR = join(__dirname, '..');
const BUILD_DIR = join(ROOT_DIR, 'build');
const CIRCUIT_NAME = 'ExamProof';

const logger = new CircuitLogger('check-canonical-shape');

function parseSym(symContent: string) {
  const lines = symContent.split(/\r?\n/);
  const scalarDeclared: Record<string, boolean> = {};
  const arrayMaxIndex: Record<string, number> = {};
  for (const l of lines) {
    if (!l) continue;
    const parts = l.split(',');
    if (parts.length < 4) continue;
    const sig = parts[3].trim();
    if (!sig.startsWith('main.')) continue;
    const withoutMain = sig.slice('main.'.length);
    const m = withoutMain.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
    if (m) {
      const base = m[1];
      const idx = parseInt(m[2], 10);
      arrayMaxIndex[base] = Math.max(arrayMaxIndex[base] ?? 0, idx + 1);
    } else {
      const base = withoutMain;
      scalarDeclared[base] = true;
    }
  }
  const symSizes: Record<string, number> = {};
  for (const base of Object.keys({ ...arrayMaxIndex, ...scalarDeclared })) {
    if (scalarDeclared[base]) {
      symSizes[base] = 0;
    } else {
      symSizes[base] = arrayMaxIndex[base] ?? 0;
    }
  }
  return symSizes;
}

function loadCanonical(canonicalPath: string) {
  if (!existsSync(canonicalPath))
    throw new Error(`Canonical not found: ${canonicalPath}`);
  const raw = readFileSync(canonicalPath, 'utf8');
  return JSON.parse(raw);
}

function inspect(canonical: any, symSizes: Record<string, number>) {
  const missing: string[] = [];
  const mismatched: Array<{ key: string; expected: number; actual: string }> =
    [];
  for (const [k, size] of Object.entries(symSizes)) {
    if (!(k in canonical)) {
      missing.push(k);
      continue;
    }
    const val = canonical[k];
    if (size === 0) {
      // scalar expected: not an array
      if (Array.isArray(val)) {
        mismatched.push({
          key: k,
          expected: 0,
          actual: `array(len=${val.length})`,
        });
      }
    } else {
      // array expected of exact length
      if (!Array.isArray(val)) {
        mismatched.push({ key: k, expected: size, actual: 'primitive' });
      } else if (val.length !== size) {
        mismatched.push({
          key: k,
          expected: size,
          actual: `array(len=${val.length})`,
        });
      }
    }
  }
  return { missing, mismatched };
}

async function main() {
  try {
    const symPath = join(BUILD_DIR, `${CIRCUIT_NAME}.sym`);
    if (!existsSync(symPath)) {
      logger.error('No .sym file found', { symPath });
      process.exit(2);
    }
    const symContent = readFileSync(symPath, 'utf8');
    const symSizes = parseSym(symContent);

    // Determine canonical path: prefer circuits/.last-canonical, else look for latest timestamp folder
    const lastCanonicalPath = join(ROOT_DIR, '.last-canonical');
    let canonicalPath = '';
    if (existsSync(lastCanonicalPath)) {
      canonicalPath = readFileSync(lastCanonicalPath, 'utf8').trim();
    } else {
      logger.error(
        'No .last-canonical marker found; please provide a canonical path as the first argument'
      );
      process.exit(2);
    }

    const canonical = loadCanonical(canonicalPath);
    logger.info('Comparing sym-derived signals to canonical input', {
      canonicalPath,
    });
    const result = inspect(canonical, symSizes);
    if (result.missing.length === 0 && result.mismatched.length === 0) {
      logger.info('OK: canonical input matches .sym top-level signals');
      process.exit(0);
    }

    if (result.missing.length > 0) {
      logger.error('Missing signals in canonical input', {
        missing: result.missing,
      });
    }
    if (result.mismatched.length > 0) {
      logger.error('Mismatched signal shapes', {
        mismatched: result.mismatched,
      });
    }
    process.exit(1);
  } catch (e) {
    logger.error('Error occurred', e as Error);
    process.exit(3);
  }
}

if (require.main === module) main();
