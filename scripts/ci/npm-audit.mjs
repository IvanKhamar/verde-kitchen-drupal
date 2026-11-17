/**
 * npm audit with a short, reviewed list of exceptions.
 *
 *   node scripts/ci/npm-audit.mjs
 *
 * Fails (exit 1) on any advisory of "high" or "critical" severity, like
 * `npm audit --audit-level=high`, except advisories listed in
 * npm-audit-allowlist.json next to this script. Each exception needs a reason
 * and an expiry date. An expired exception fails again, so it cannot be
 * forgotten; an exception npm no longer reports is printed so it can be removed.
 *
 * Use an exception only when no fixed version exists yet and the package is a
 * build tool that never reaches the browser or the server.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FAIL_LEVELS = new Set(['high', 'critical']);
const allowlistPath = path.join(import.meta.dirname, 'npm-audit-allowlist.json');
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, 'utf8'));
const today = new Date().toISOString().slice(0, 10);

// One constant command string: shell mode is needed for npm.cmd on Windows.
const result = spawnSync('npm audit --json', {
  encoding: 'utf8',
  shell: true,
});
let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit did not return JSON:', result.stderr || result.stdout);
  process.exit(1);
}

// Each advisory, once: GHSA id -> { title, severity, packages }.
const advisories = new Map();
for (const [name, vulnerability] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vulnerability.via) {
    if (typeof via !== 'object' || !FAIL_LEVELS.has(via.severity)) continue;
    const id = via.url.split('/').pop();
    const advisory = advisories.get(id) ?? { title: via.title, severity: via.severity, packages: new Set() };
    advisory.packages.add(name);
    advisories.set(id, advisory);
  }
}

let failed = false;
for (const [id, advisory] of advisories) {
  const exception = allowlist[id];
  const packages = [...advisory.packages].join(', ');
  if (!exception) {
    console.error(`✖ ${id} (${advisory.severity}) ${advisory.title} — in ${packages}`);
    failed = true;
  } else if (exception.until < today) {
    console.error(`✖ ${id}: the exception expired on ${exception.until}. Check for a fix, then update or remove it.`);
    failed = true;
  } else {
    console.log(`• ${id} allowed until ${exception.until}: ${exception.reason}`);
  }
}
for (const id of Object.keys(allowlist)) {
  if (!advisories.has(id)) {
    console.log(`ℹ ${id} is no longer reported: remove it from ${path.basename(allowlistPath)}.`);
  }
}

if (failed) {
  console.error('npm audit: high or critical advisories found.');
  process.exit(1);
}
console.log(`npm audit OK (${advisories.size} high/critical advisories, all with a reviewed exception).`);
