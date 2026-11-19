// GTA VI trophy guide + tracker, round 3 (Node 22, standard library only).
// The guide is this directory's app/ folder: plain static files a browser
// opens at app/index.html (ES modules, CSS, no build step), offline: it loads
// nothing over the network, and its trophy list and guides are
// app/data/trophies.json. This program hands the entry in: it first checks
// the trophy list and the screenshots are what the gate expects, then copies
// app/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads (your screenshots, the
// first load's files and bytes, and your source), with the vendored make.fun
// library. Leave vendor/makefun-frontend.ts as it is: the scorer requires
// dossier.json to be byte for byte what its own copy writes.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-frontend.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Authored check, round 2: refuse to hand in a guide whose trophy list is
// short, whose grades do not add up to 1 platinum / 2 gold / 6 silver /
// 46 bronze, or whose screenshots are outside the gate's 3-to-4 range.
// A failure here is loud and early instead of a silent invalid entry.
const trophies = JSON.parse(readFileSync(join(here, 'app', 'data', 'trophies.json'), 'utf8')).trophies;
const grades = { platinum: 0, gold: 0, silver: 0, bronze: 0 };
for (const t of trophies) {
  if (!(t.grade in grades)) throw new Error(`trophy ${t.id} has unknown grade ${t.grade}`);
  if (typeof t.guide !== 'string' || !t.guide.trim()) throw new Error(`trophy ${t.id} has no guide`);
  grades[t.grade] += 1;
}
if (trophies.length !== 55) throw new Error(`expected 55 trophies, found ${trophies.length}`);
if (grades.platinum !== 1 || grades.gold !== 2 || grades.silver !== 6 || grades.bronze !== 46) {
  throw new Error(`grade split is ${JSON.stringify(grades)}, expected 1/2/6/46`);
}
const shots = readdirSync(join(here, 'screenshots')).filter(f => !f.startsWith('.'));
if (shots.length < 3 || shots.length > 4) throw new Error(`expected 3-4 screenshots, found ${shots.length}`);

// Authored check, round 3: the roadmap is data the app renders blind, so
// validate it against the trophy list here — every stage must name trophies
// that exist, no trophy may appear in two stages, every trophy must appear
// in exactly one stage, stage numbers must run 1..N in order, and the
// per-stage hour estimates (all labelled estimates) must add up to the
// roadmap's own total. Also count guide statuses so the handover line can
// report the verified / partial / unconfirmed split the Sources view claims.
const roadmap = JSON.parse(readFileSync(join(here, 'app', 'data', 'roadmap.json'), 'utf8'));
const trophyIds = new Set(trophies.map(t => t.id));
const staged = new Set();
let stagedHours = 0;
roadmap.stages.forEach((stage, i) => {
  if (stage.n !== i + 1) throw new Error(`roadmap stage ${i} has n=${stage.n}, expected ${i + 1}`);
  if (!Array.isArray(stage.trophies) || stage.trophies.length === 0) {
    throw new Error(`roadmap stage ${stage.n} lists no trophies`);
  }
  for (const id of stage.trophies) {
    if (!trophyIds.has(id)) throw new Error(`roadmap stage ${stage.n} names unknown trophy id ${id}`);
    if (staged.has(id)) throw new Error(`trophy id ${id} appears in two roadmap stages`);
    staged.add(id);
  }
  stagedHours += stage.hours;
});
if (staged.size !== trophies.length) {
  throw new Error(`roadmap stages cover ${staged.size} trophies, expected ${trophies.length}`);
}
if (stagedHours !== roadmap.total_estimate_hours) {
  throw new Error(`stage hours add to ${stagedHours}, roadmap total says ${roadmap.total_estimate_hours}`);
}
const statuses = { verified: 0, partial: 0, unconfirmed: 0 };
for (const t of trophies) {
  if (!(t.status in statuses)) throw new Error(`trophy ${t.id} has unknown status ${t.status}`);
  statuses[t.status] += 1;
}

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

console.log(
  `gta6-trophy-guide-01: ${trophies.length} trophies `
  + `(${grades.platinum} platinum, ${grades.gold} gold, ${grades.silver} silver, ${grades.bronze} bronze), `
  + `guides ${statuses.verified} verified / ${statuses.partial} partial / ${statuses.unconfirmed} unconfirmed, `
  + `roadmap ${roadmap.stages.length} stages / ${stagedHours} h, `
  + `${shots.length} screenshots -> ${out}`,
);
