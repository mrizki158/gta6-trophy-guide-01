// Leonida Trophy Guide entry (Node 22, standard library only).
// The guide itself is plain static files under app/ (index.html, style.css,
// app.js, data/trophies.json, data/roadmap.json): no build step, no network
// at run time. This program first validates the guide's own data, then
// hands it in: it copies app/ and screenshots/ beside this file to /output
// and writes /output/dossier.json with the vendored make.fun library.
// Leave vendor/makefun-frontend.ts untouched: the scorer requires the
// dossier to be byte for byte what its own copy of the library writes.
//
// Validation I wrote for this entry (it runs before anything is copied):
// the trophy file must name 55 trophies with grades 1 platinum, 2 gold,
// 6 silver and 46 bronze, every guide non-blank and every trophy carrying
// a citation; and the roadmap must place every trophy id in exactly one
// stage, so no trophy is left out of the platinum route and none is
// counted twice. If any of those checks fails, the run stops here.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function fail(message: string): never {
  throw new Error('Leonida guide validation failed: ' + message);
}

function checkGuideData(): void {
  const trophiesPath = join(here, 'app', 'data', 'trophies.json');
  const roadmapPath = join(here, 'app', 'data', 'roadmap.json');
  const trophyDoc = JSON.parse(readFileSync(trophiesPath, 'utf8')) as {
    trophies: Array<{ id: number; name: string; guide: string; grade: string; source: string; source_url: string }>;
  };
  const roadmapDoc = JSON.parse(readFileSync(roadmapPath, 'utf8')) as {
    total_hours_estimate: number;
    stages: Array<{ stage: number; hours: number; trophy_ids: number[] }>;
  };

  const trophies = trophyDoc.trophies;
  if (!Array.isArray(trophies) || trophies.length !== 55) {
    fail('expected 55 trophies, found ' + (Array.isArray(trophies) ? trophies.length : 'none'));
  }
  const gradeCounts: Record<string, number> = {};
  const seenIds = new Set<number>();
  for (const trophy of trophies) {
    if (seenIds.has(trophy.id)) fail('duplicate trophy id ' + trophy.id);
    seenIds.add(trophy.id);
    gradeCounts[trophy.grade] = (gradeCounts[trophy.grade] ?? 0) + 1;
    if (!trophy.name || !trophy.name.trim()) fail('trophy ' + trophy.id + ' has no name');
    if (!trophy.guide || !trophy.guide.trim()) fail('trophy ' + trophy.id + ' (' + trophy.name + ') has a blank guide');
    if (!trophy.source || !trophy.source_url) fail('trophy ' + trophy.id + ' (' + trophy.name + ') has no citation');
  }
  const expectedGrades: Record<string, number> = { platinum: 1, gold: 2, silver: 6, bronze: 46 };
  for (const [grade, expected] of Object.entries(expectedGrades)) {
    if ((gradeCounts[grade] ?? 0) !== expected) {
      fail('expected ' + expected + ' ' + grade + ' trophies, found ' + (gradeCounts[grade] ?? 0));
    }
  }

  const stages = roadmapDoc.stages;
  if (!Array.isArray(stages) || stages.length !== 7) {
    fail('expected 7 roadmap stages, found ' + (Array.isArray(stages) ? stages.length : 'none'));
  }
  const placed = new Map<number, number>();
  let hoursTotal = 0;
  for (const stage of stages) {
    hoursTotal += stage.hours;
    for (const id of stage.trophy_ids) {
      if (!seenIds.has(id)) fail('roadmap stage ' + stage.stage + ' names unknown trophy id ' + id);
      if (placed.has(id)) fail('trophy id ' + id + ' is in roadmap stages ' + placed.get(id) + ' and ' + stage.stage);
      placed.set(id, stage.stage);
    }
  }
  if (placed.size !== 55) fail('roadmap covers ' + placed.size + ' trophies, expected 55');
  if (hoursTotal < 150 || hoursTotal > 300) fail('roadmap hours sum ' + hoursTotal + ' is outside 150-300');
  if (roadmapDoc.total_hours_estimate !== hoursTotal) {
    fail('roadmap total_hours_estimate ' + roadmapDoc.total_hours_estimate + ' does not match stage sum ' + hoursTotal);
  }
}

checkGuideData();

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files and directories in app/ or
// 48 MiB of app files: app/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, app_max_files: 993, app_max_bytes: 50331648 }),
);
