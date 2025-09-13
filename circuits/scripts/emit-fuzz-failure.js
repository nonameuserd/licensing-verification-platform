const fs = require('fs');
const path = require('path');

const [, , logPath, outJson] = process.argv;
if (!logPath || !outJson) {
  console.error('Usage: node emit-fuzz-failure.js <jest-log> <out-json>');
  process.exit(2);
}

function extractFastCheck(raw) {
  // fast-check prints lines like:
  // "Counterexample: ..."
  // and a seed line like: "Seed: 1234567890"
  const seedMatch = raw.match(/Seed:\s*(\d+)/i);
  const counterexampleMatch = raw.match(
    /Counterexample:(?:[\s\S]*?)\n(?:Shrinking\.|$)/i
  );
  const shrunkMatch = raw.match(/\n\s*shrunk to:\s*([\s\S]*)$/i);

  const seed = seedMatch ? seedMatch[1] : null;
  let counterexample = null;
  if (counterexampleMatch) {
    counterexample = counterexampleMatch[0]
      .replace(/Counterexample:\s*/i, '')
      .trim();
  } else if (shrunkMatch) {
    counterexample = shrunkMatch[1].trim();
  }

  // Attempt to parse JSON-like structures inside counterexample
  let parsed = null;
  if (counterexample) {
    try {
      // fast-check often prints objects with single quotes -> try to normalize
      const normalized = counterexample.replace(/'/g, '"');
      parsed = JSON.parse(normalized);
    } catch (e) {
      // not JSON, leave as string; reference `e` to satisfy linters
      void e;
      parsed = null;
    }
  }

  return { seed, counterexample, parsed };
}

try {
  const resolvedLog = path.resolve(logPath);
  if (!fs.existsSync(resolvedLog)) {
    // Write an artifact indicating the log file was not present (caller likely invoked emitter prematurely)
    const payload = {
      timestamp: new Date().toISOString(),
      logPath: resolvedLog,
      error: 'log_not_found',
      message: `Log file not found at ${resolvedLog}`,
    };
    fs.mkdirSync(path.dirname(outJson), { recursive: true });
    fs.writeFileSync(outJson, JSON.stringify(payload, null, 2));
    console.log('Wrote fuzz failure metadata (log missing) to', outJson);
    process.exit(1);
  }
  const raw = fs.readFileSync(resolvedLog, 'utf8');
  // Heuristic: take the last 20000 chars as counterexample / failure region
  const tail = raw.slice(-20000);

  const fc = extractFastCheck(raw + '\n' + tail);

  const payload = {
    timestamp: new Date().toISOString(),
    logPath: path.resolve(logPath),
    excerpt: tail,
    fastcheck: fc,
  };

  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, JSON.stringify(payload, null, 2));
  console.log('Wrote fuzz failure metadata to', outJson);
  process.exit(0);
} catch (err) {
  console.error('Failed to write fuzz failure metadata', err);
  process.exit(1);
}
