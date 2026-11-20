// Leonida Trophy Guide, round 5: hands the guide in for gta6-trophy-guide-01.
// Node 22, standard library only. It copies app/ and screenshots/ from beside
// this file to /output (or MAKEFUN_OUTPUT_DIR outside the grader) and writes
// /output/dossier.json with the vendored make.fun library, which the scorer
// rebuilds byte for byte. Before copying it validates the guide itself, so a
// broken entry fails loudly here instead of silently at the gate:
//   - trophies.json holds exactly 55 trophies, 1 platinum / 2 gold / 6 silver / 46 bronze
//   - every trophy has a non-blank guide and at least one cited source id
//   - every cited source id exists in the sources table, and every source is dated
//   - the roadmap's 7 stages cover all 55 trophies exactly once and sum to 200 hours
//   - at most 4 screenshots, each a whole PNG or JPEG of at most 256 KiB
// Run it twice and compare: both runs must write identical bytes.
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const EXPECTED_GRADES = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
const EXPECTED_TOTAL = 55;
const EXPECTED_STAGES = 7;
const EXPECTED_HOURS = 200;
const MAX_SCREENSHOTS = 4;
const MAX_SCREENSHOT_BYTES = 262144;

function fail(message: string): never {
  throw new Error('main.ts validation failed: ' + message);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

interface TrophyEntry {
  id: string;
  name: string;
  description: string;
  grade: string;
  guide: string;
  sources: string[];
  stage: number;
  status: string;
}

interface SourceEntry {
  id: string;
  name: string;
  date: string;
}

interface TrophyFile {
  meta?: { total?: number };
  sources: SourceEntry[];
  trophies: TrophyEntry[];
}

interface RoadmapFile {
  meta?: { totalHours?: number };
  stages: { id: number; hours: number; trophies: string[] }[];
}

function checkTrophySet(data: TrophyFile): string[] {
  const trophies = data.trophies;
  if (!Array.isArray(trophies)) fail('trophies.json has no trophies array');
  if (trophies.length !== EXPECTED_TOTAL) {
    fail('expected ' + EXPECTED_TOTAL + ' trophies, found ' + trophies.length);
  }
  const grades: Record<string, number> = {};
  const seen = new Set<string>();
  const knownSources = new Set((data.sources || []).map((s) => s.id));
  for (const t of trophies) {
    if (!t.name || !t.name.trim()) fail('a trophy has no name');
    if (!t.guide || !t.guide.trim()) fail('trophy "' + t.name + '" has no guide');
    if (!t.description || !t.description.trim()) fail('trophy "' + t.name + '" has no description');
    if (seen.has(t.name)) fail('duplicate trophy name "' + t.name + '"');
    seen.add(t.name);
    grades[t.grade] = (grades[t.grade] || 0) + 1;
    if (!Array.isArray(t.sources) || t.sources.length === 0) {
      fail('trophy "' + t.name + '" cites no source');
    }
    for (const sid of t.sources) {
      if (!knownSources.has(sid)) fail('trophy "' + t.name + '" cites unknown source "' + sid + '"');
    }
  }
  for (const [grade, count] of Object.entries(EXPECTED_GRADES)) {
    if ((grades[grade] || 0) !== count) {
      fail('expected ' + count + ' ' + grade + ' trophies, found ' + (grades[grade] || 0));
    }
  }
  return [...seen];
}

function checkSources(data: TrophyFile): void {
  if (!Array.isArray(data.sources) || data.sources.length < 20) {
    fail('expected at least 20 dated sources, found ' + (data.sources || []).length);
  }
  for (const s of data.sources) {
    if (!s.id || !s.name) fail('a source has no id or name');
    if (!s.date || !/Nov 2026/.test(s.date)) fail('source "' + s.name + '" has no November 2026 date');
  }
  const cited = new Set<string>();
  for (const t of data.trophies) for (const sid of t.sources) cited.add(sid);
  for (const s of data.sources) {
    if (!cited.has(s.id)) fail('source "' + s.name + '" is listed but cited by no guide');
  }
}

function checkRoadmap(data: RoadmapFile, trophyNames: string[], trophies: TrophyEntry[]): void {
  if (!Array.isArray(data.stages) || data.stages.length !== EXPECTED_STAGES) {
    fail('expected ' + EXPECTED_STAGES + ' roadmap stages, found ' + (data.stages || []).length);
  }
  const hours = data.stages.reduce((sum, s) => sum + (s.hours || 0), 0);
  if (hours !== EXPECTED_HOURS) fail('roadmap hours sum to ' + hours + ', expected ' + EXPECTED_HOURS);
  const byId = new Map(trophies.map((t) => [t.id, t]));
  const covered = new Set<string>();
  for (const stage of data.stages) {
    if (!Array.isArray(stage.trophies) || stage.trophies.length === 0) {
      fail('roadmap stage ' + stage.id + ' lists no trophies');
    }
    for (const tid of stage.trophies) {
      if (!byId.has(tid)) fail('roadmap stage ' + stage.id + ' names unknown trophy "' + tid + '"');
      if (covered.has(tid)) fail('trophy "' + tid + '" appears in two roadmap stages');
      covered.add(tid);
      if (byId.get(tid)!.stage !== stage.id) {
        fail('trophy "' + tid + '" says stage ' + byId.get(tid)!.stage + ' but sits in stage ' + stage.id);
      }
    }
  }
  if (covered.size !== EXPECTED_TOTAL) {
    fail('roadmap covers ' + covered.size + ' trophies, expected ' + EXPECTED_TOTAL);
  }
  void trophyNames;
}

function checkScreenshots(dir: string): void {
  if (!existsSync(dir)) fail('screenshots/ is missing');
  const files = readdirSync(dir).filter((f) => !f.startsWith('.'));
  if (files.length < 3 || files.length > MAX_SCREENSHOTS) {
    fail('expected 3 or 4 screenshots, found ' + files.length);
  }
  for (const f of files) {
    const path = join(dir, f);
    if (!statSync(path).isFile()) fail('screenshots/' + f + ' is not a regular file');
    if (!/\.(png|jpe?g)$/i.test(f)) fail('screenshots/' + f + ' is not a PNG or JPEG');
    const bytes = statSync(path).size;
    if (bytes > MAX_SCREENSHOT_BYTES) fail('screenshots/' + f + ' is ' + bytes + ' bytes, over 256 KiB');
  }
}

function validateEntry(): void {
  const trophyData = readJson<TrophyFile>(join(here, 'app', 'data', 'trophies.json'));
  const roadmapData = readJson<RoadmapFile>(join(here, 'app', 'data', 'roadmap.json'));
  const names = checkTrophySet(trophyData);
  checkSources(trophyData);
  checkRoadmap(roadmapData, names, trophyData.trophies);
  checkScreenshots(join(here, 'screenshots'));
  const cited = trophyData.trophies.filter((t) => t.status === 'verified' || t.status === 'partial').length;
  console.log('validated: 55 trophies (1/2/6/46), ' + cited + ' cited guides, ' +
    trophyData.sources.length + ' dated sources, 7 roadmap stages totalling 200 hours');
}

validateEntry();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes;
// the others refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files and directories in app/ or 48 MiB of app files).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
console.log('wrote ' + join(out, 'dossier.json'));
