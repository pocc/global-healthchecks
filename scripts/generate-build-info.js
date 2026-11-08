#!/usr/bin/env node
import { execSync } from 'child_process';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const gitHash = execSync('git rev-parse --short HEAD').toString().trim();
const gitBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
const buildTime = new Date().toISOString();

const buildInfo = {
  gitHash,
  gitBranch,
  buildTime,
  buildTimestamp: Date.now(),
};

const outputPath = join(__dirname, '../src/buildInfo.json');
writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

console.log('Build info generated:', buildInfo);
