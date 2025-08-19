#!/usr/bin/env node

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

async function exists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function copyDir(src, dest) {
  await fsp.mkdir(dest, { recursive: true });
  const entries = await fsp.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(s, d);
    } else if (entry.isFile()) {
      // Do not overwrite existing files; prefer server/data
      if (!(await exists(d))) {
        await fsp.copyFile(s, d);
      }
    }
  }
}

async function main() {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const serverDir = path.resolve(__dirname, '..');
  const rootData = path.join(repoRoot, 'data');
  const serverData = path.join(serverDir, 'data');

  if (!(await exists(rootData))) {
    console.log('No root-level data folder found. Nothing to consolidate.');
    return;
  }

  await fsp.mkdir(serverData, { recursive: true });

  // Copy specific known subfolders
  const subfolders = ['memory', 'backup'];
  for (const sub of subfolders) {
    const src = path.join(rootData, sub);
    if (await exists(src)) {
      const dest = path.join(serverData, sub);
      console.log(`Copying ${src} -> ${dest}`);
      await copyDir(src, dest);
    }
  }

  console.log('Consolidation complete. You can remove the root-level data folder if desired.');
}

main().catch(err => {
  console.error('Consolidation failed:', err);
  process.exit(1);
});
