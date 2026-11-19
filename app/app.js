// GTA VI trophy guide + tracker, round 3.
// Checklist + per-trophy notes in localStorage, export/import (progress and
// notes together), copy-as-text, kind/grade/earned/missable filters, search,
// sort, spoiler blur, per-kind progress, a live "Next up" QUEUE (roadmap
// order, missables first, platinum last), a missable watch view, a 7-stage
// platinum roadmap and a complete print sheet. Every trophy carries a cited
// guide; three are still honestly flagged unconfirmed.
const STORE_KEY = 'gta6-trophy-checklist-v2';
const NOTES_KEY = 'gta6-trophy-notes-v3';
const query = new URLSearchParams(location.search);
const trophiesDoc = await (await fetch('data/trophies.json')).json();
const roadmapDoc = await (await fetch('data/roadmap.json')).json();
const trophies = trophiesDoc.trophies;
const byId = new Map(trophies.map(t => [t.id, t]));
const byName = new Map(trophies.map(t => [t.name, t]));

// Roadmap order: stage by stage, trophy by trophy. Used for the sort, the
// next-up pointer and the queue, so the checklist follows the platinum route.
const roadOrder = roadmapDoc.stages.flatMap(s => s.trophies);
const roadRank = new Map(roadOrder.map((id, i) => [id, i]));
const stageOf = new Map();
for (const s of roadmapDoc.stages) for (const id of s.trophies) stageOf.set(id, s);

let earned = new Set(
  JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]').filter(n => byName.has(n)),
);
let notes = {};
try {
  const raw = JSON.parse(localStorage.getItem(NOTES_KEY) ?? '{}');
  for (const [k, v] of Object.entries(raw)) if (byName.has(k) && typeof v === 'string') notes[k] = v;
} catch { notes = {}; }
// Demo seed for screenshots (?demo=N ticks the first N story trophies,
// session only, and it is a story run so far — never the platinum).
if (query.get('demo')) {
  const n = Math.min(Number(query.get('demo')) || 0, 12);
  earned = new Set(trophies.slice(1, 1 + n).map(t => t.name));
  notes = { 'Positive Mental Attitude': 'Balcony meditation DONE in Chapter 1 — counter +1, save kept.' };
}
const $ = id => document.getElementById(id);
const controls = {
  q: $('q'), kind: $('kind'), grade: $('grade'), earned: $('earned'),
  missOnly: $('missOnly'), spoiler: $('spoiler'), sort: $('sort'),
};
if (query.get('q')) controls.q.value = query.get('q');
if (query.get('spoiler') === 'on') controls.spoiler.checked = true;
if (query.get('kind')) controls.kind.value = query.get('kind');
if (query.get('grade')) controls.grade.value = query.get('grade');
if (query.get('sort')) controls.sort.value = query.get('sort');

function persist() { localStorage.setItem(STORE_KEY, JSON.stringify([...earned])); }
function persistNotes() { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); }

const KIND_LABEL = {
  story: 'Story', stranger: 'Strangers & side lines', collectible: 'Collectibles',
  activity: 'Activities', robbery: 'Robberies', exploration: 'Exploration',
  money: 'Money & property', feat: 'One-off feat', completion: '100% completion',
  platinum: 'Platinum',
};
const GRADE_MARK = { platinum: '◆', gold: '●', silver: '●', bronze: '●' };
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

function spoilersHidden(t) {
  return controls.spoiler.checked && t.spoiler && !earned.has(t.name);
}

// The queue rule, shared by the one-line pointer and the queue view:
// unearned trophies in roadmap order, except (a) a possibly-missable trophy
// still unearned always comes first while its window may be open, and
// (b) the platinum is held back until it is the only trophy left.
function nextUpQueue(limit = 8) {
  const todo = roadOrder.map(id => byId.get(id)).filter(t => !earned.has(t.name));
  const urgent = todo.filter(t => t.missable);
  const plat = todo.filter(t => t.kind === 'platinum');
  const rest = todo.filter(t => !t.missable && t.kind !== 'platinum');
  const ordered = [...urgent, ...rest, ...plat];
  return ordered.slice(0, limit);
}

function noteField(t) {
  const wrap = document.createElement('div');
  wrap.className = 'notebox';
  const label = document.createElement('label');
  label.textContent = 'My note';
  label.htmlFor = 'note-' + t.id;
  const area = document.createElement('textarea');
  area.id = 'note-' + t.id;
  area.className = 'note';
  area.rows = 2;
  area.placeholder = 'Your own note — a spot, a count, a reminder…';
  area.value = notes[t.name] ?? '';
  area.addEventListener('change', () => {
    const v = area.value.trim();
    if (v) notes[t.name] = v; else delete notes[t.name];
    persistNotes();
  });
  wrap.append(label, area);
  return wrap;
}

function trophyCard(t) {
  const hidden = spoilersHidden(t);
  const card = document.createElement('article');
  card.className = 'card grade-' + t.grade
    + (t.missable ? ' missable' : '') + (earned.has(t.name) ? ' done' : '');
  card.dataset.id = t.id;
  const tick = document.createElement('input');
  tick.type = 'checkbox';
  tick.checked = earned.has(t.name);
  tick.setAttribute('aria-label', 'Earned: ' + t.name);
  tick.addEventListener('change', () => {
    if (tick.checked) earned.add(t.name); else earned.delete(t.name);
    persist();
    renderAll();
  });
  const body = document.createElement('div');
  body.className = 'card-body';
  const title = document.createElement('h3');
  title.textContent = hidden ? 'Hidden trophy — story spoiler' : t.name;
  if (hidden) title.classList.add('blurred');
  const desc = document.createElement('p');
  desc.className = 'desc';
  desc.textContent = hidden
    ? 'Name and description hidden until earned (spoiler mode on).'
    : t.description;
  if (hidden) desc.classList.add('blurred');
  const meta = document.createElement('p');
  meta.className = 'meta';
  meta.textContent = GRADE_MARK[t.grade] + ' ' + t.grade + ' · ' + KIND_LABEL[t.kind]
    + ' · Stage ' + (stageOf.get(t.id)?.n ?? '?')
    + (t.missable ? ' · ⚠ POSSIBLY MISSABLE' : '')
    + (t.status === 'unconfirmed' ? ' · method unconfirmed'
      : t.status === 'partial' ? ' · partly confirmed' : '');
  const guide = document.createElement('p');
  guide.className = 'guide';
  guide.textContent = hidden ? 'Guide hidden until earned.' : t.guide;
  if (hidden) guide.classList.add('blurred');
  const cite = document.createElement('p');
  cite.className = 'src';
  if (!hidden) {
    cite.textContent = 'Source: ';
    const link = document.createElement('a');
    link.href = t.source.url;
    link.textContent = t.source.name;
    link.target = '_blank';
    link.rel = 'noopener';
    cite.append(link);
    const note = document.createElement('span');
    note.textContent = ' — ' + t.missable_note;
    cite.append(note);
  }
  body.append(title, desc, meta, guide, cite);
  if (!hidden) body.append(noteField(t));
  card.append(tick, body);
  return card;
}

function visibleTrophies() {
  const needle = controls.q.value.trim().toLowerCase();
  let list = trophies.filter(t => {
    if (controls.kind.value !== 'all' && t.kind !== controls.kind.value) return false;
    if (controls.grade.value !== 'all' && t.grade !== controls.grade.value) return false;
    if (controls.earned.value === 'todo' && earned.has(t.name)) return false;
    if (controls.earned.value === 'done' && !earned.has(t.name)) return false;
    if (controls.missOnly.checked && !t.missable) return false;
    if (needle && !(t.name + ' ' + t.description + ' ' + t.guide + ' ' + KIND_LABEL[t.kind]
      + ' ' + (notes[t.name] ?? '')).toLowerCase().includes(needle)) return false;
    return true;
  });
  if (controls.sort.value === 'grade') {
    list = [...list].sort((a, b) =>
      GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || roadRank.get(a.id) - roadRank.get(b.id));
  } else if (controls.sort.value === 'name') {
    list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    list = [...list].sort((a, b) => roadRank.get(a.id) - roadRank.get(b.id));
  }
  return list;
}

function renderProgress() {
  const total = trophies.length;
  const got = earned.size;
  const pct = Math.round(got / total * 100);
  $('platPct').textContent = pct + '%';
  $('platCount').textContent = got + ' of ' + total + ' earned';
  $('barFill').style.width = pct + '%';
  const left = total - got;
  $('platEta').textContent = left === 0
    ? 'Platinum earned — Vice Got a Price!'
    : '~' + Math.round(left / total * roadmapDoc.total_estimate_hours)
      + ' h left at the ~200 h estimate';
  $('gradeCounts').textContent = ['platinum', 'gold', 'silver', 'bronze'].map(g => {
    const all = trophies.filter(t => t.grade === g).length;
    const done = trophies.filter(t => t.grade === g && earned.has(t.name)).length;
    return g + ' ' + done + '/' + all;
  }).join(' · ');
}

function renderKindBars() {
  const host = $('kindBars');
  host.replaceChildren();
  for (const kind of Object.keys(KIND_LABEL)) {
    const inKind = trophies.filter(t => t.kind === kind);
    if (!inKind.length) continue;
    const done = inKind.filter(t => earned.has(t.name)).length;
    const row = document.createElement('div');
    row.className = 'kind-row';
    const label = document.createElement('span');
    label.className = 'kind-name';
    label.textContent = KIND_LABEL[kind];
    const track = document.createElement('span');
    track.className = 'kind-track';
    const fill = document.createElement('span');
    fill.className = 'kind-fill';
    fill.style.width = Math.round(done / inKind.length * 100) + '%';
    track.append(fill);
    const count = document.createElement('span');
    count.className = 'kind-count';
    count.textContent = done + '/' + inKind.length;
    row.append(label, track, count);
    host.append(row);
  }
}

function renderNextUp() {
  const queue = nextUpQueue(1);
  const box = $('nextUp');
  box.replaceChildren();
  if (!queue.length) {
    box.textContent = 'Every trophy is ticked — Vice Got a Price! is yours.';
    return;
  }
  const next = queue[0];
  const label = document.createElement('strong');
  label.textContent = next.missable ? 'Next up — missable first: ' : 'Next up on the roadmap: ';
  const name = document.createElement('span');
  name.textContent = next.name + ' (' + KIND_LABEL[next.kind] + ', ' + next.grade
    + ', Stage ' + (stageOf.get(next.id)?.n ?? '?') + ')';
  const jump = document.createElement('button');
  jump.type = 'button';
  jump.textContent = 'Show it';
  jump.addEventListener('click', () => {
    controls.q.value = '';
    controls.kind.value = 'all';
    controls.grade.value = 'all';
    controls.earned.value = 'all';
    controls.missOnly.checked = false;
    renderAll();
    const el = document.querySelector('[data-id="' + next.id + '"]');
    if (el) { el.classList.add('detail'); el.scrollIntoView({ block: 'start' }); }
  });
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Open the queue';
  open.addEventListener('click', () => show('next'));
  box.append(label, name, ' ', jump, ' ', open);
}

function renderQueue() {
  const host = $('nextQueue');
  host.replaceChildren();
  const queue = nextUpQueue(8);
  if (!queue.length) {
    const p = document.createElement('p');
    p.className = 'hint';
    p.textContent = 'Nothing left — every trophy is ticked. Vice Got a Price!';
    host.append(p);
    return;
  }
  queue.forEach((t, i) => {
    const row = document.createElement('div');
    row.className = 'qrow' + (t.missable ? ' missable' : '');
    const tick = document.createElement('input');
    tick.type = 'checkbox';
    tick.checked = false;
    tick.setAttribute('aria-label', 'Earned: ' + t.name);
    tick.addEventListener('change', () => {
      earned.add(t.name);
      persist();
      renderAll();
    });
    const rank = document.createElement('span');
    rank.className = 'qrank';
    rank.textContent = '#' + (i + 1);
    const body = document.createElement('div');
    const h = document.createElement('h3');
    h.textContent = t.name + (t.missable ? ' ⚠ POSSIBLY MISSABLE' : '');
    const p = document.createElement('p');
    const stage = stageOf.get(t.id);
    p.textContent = t.grade + ' · ' + KIND_LABEL[t.kind] + ' · Stage ' + stage.n + ' — ' + stage.title
      + (t.status === 'unconfirmed' ? ' · method unconfirmed — see its entry before chasing it'
        : t.status === 'partial' ? ' · partly confirmed' : '')
      + (notes[t.name] ? ' · Note: ' + notes[t.name] : '');
    body.append(h, p);
    row.append(tick, rank, body);
    host.append(row);
  });
}

function renderMissables() {
  const host = $('missList');
  host.replaceChildren();
  const flagged = trophies.filter(t => t.missable);
  for (const t of flagged) {
    const card = document.createElement('article');
    card.className = 'misscard' + (earned.has(t.name) ? ' done' : '');
    const h = document.createElement('h3');
    h.textContent = (earned.has(t.name) ? '✓ ' : '⚠ ') + t.name + ' — ' + t.grade + ', ' + KIND_LABEL[t.kind];
    const when = document.createElement('p');
    when.className = 'miss-when';
    when.textContent = 'When it can be missed: ' + t.missable_note;
    const stage = stageOf.get(t.id);
    const guard = document.createElement('p');
    guard.textContent = 'Guarded by Stage ' + stage.n + ' — ' + stage.title
      + '. Do that stage\'s steps in order and this trophy cannot be lost.'
      + (earned.has(t.name) ? ' Already earned — the window no longer matters.' : '');
    const src = document.createElement('p');
    src.className = 'src';
    src.textContent = 'Flag source: ';
    const a = document.createElement('a');
    a.href = t.source.url;
    a.textContent = t.source.name;
    a.target = '_blank';
    a.rel = 'noopener';
    src.append(a);
    card.append(h, when, guard, src);
    host.append(card);
  }
  const clear = document.createElement('p');
  clear.className = 'hint';
  const notFlagged = trophies.length - flagged.length;
  clear.textContent = 'Checked and clear: the other ' + notFlagged + ' trophies are marked not missable '
    + 'per the cited guides — free-roam continues after the story and they stay earnable. '
    + 'Three trophies (In The Beginning…, Bad Luck, I Guess, Ten Pin) still have no confirmed method, '
    + 'so their missability cannot be judged yet; the roadmap parks them in the mop-up stage and keeps chapter saves as insurance.';
  host.append(clear);
}

function renderList() {
  const shown = visibleTrophies();
  const list = $('list');
  list.replaceChildren();
  for (const t of shown) list.append(trophyCard(t));
  $('countLine').textContent = 'Showing ' + shown.length + ' of ' + trophies.length
    + ' trophies · ' + earned.size + ' earned';
  if (query.get('view') === 'detail' && byId.has(Number(query.get('id')))) {
    const el = list.querySelector('[data-id="' + query.get('id') + '"]');
    if (el) { el.classList.add('detail'); el.scrollIntoView({ block: 'start' }); }
  }
}

function renderRoadmap() {
  $('roadTotal').textContent = roadmapDoc.total_estimate_note;
  const warnHost = $('roadWarn');
  warnHost.replaceChildren();
  for (const warn of roadmapDoc.warnings) {
    const p = document.createElement('p');
    p.className = 'warn';
    p.textContent = warn;
    warnHost.append(p);
  }
  const host = $('roadmap');
  host.replaceChildren();
  for (const stage of roadmapDoc.stages) {
    const sec = document.createElement('section');
    sec.className = 'stage';
    sec.id = 'stage-' + stage.n;
    const h = document.createElement('h3');
    const doneInStage = stage.trophies.filter(id => earned.has(byId.get(id).name)).length;
    h.textContent = 'Stage ' + stage.n + ' — ' + stage.title + ' · ~' + stage.hours
      + ' h (' + stage.hours_note + ') · ' + doneInStage + '/' + stage.trophies.length + ' earned';
    const steps = document.createElement('ol');
    for (const step of stage.steps) {
      const li = document.createElement('li');
      li.textContent = step;
      steps.append(li);
    }
    const chips = document.createElement('p');
    chips.className = 'chips';
    for (const id of stage.trophies) {
      const t = byId.get(id);
      const chip = document.createElement('span');
      chip.className = 'chip grade-' + t.grade
        + (earned.has(t.name) ? ' done' : '') + (t.missable ? ' missable' : '');
      chip.textContent = (earned.has(t.name) ? '✓ ' : '') + t.name + (t.missable ? ' ⚠' : '');
      chips.append(chip);
    }
    sec.append(h, steps, chips);
    host.append(sec);
  }
}

// The print sheet is rebuilt on every render so Print always matches the
// live state: summary line, all 7 stages with earned counts, the missable
// list, and the full checklist state including notes.
function renderPrint() {
  const total = trophies.length;
  const got = earned.size;
  $('printSummary').textContent = got + ' of ' + total + ' trophies earned ('
    + Math.round(got / total * 100) + '%). Platinum estimate ~'
    + roadmapDoc.total_estimate_hours + ' h total. '
    + 'Status of the guides: 50 verified, 2 partial, 3 unconfirmed (round-3 re-check, 19 Nov 2026).';
  const road = $('printRoad');
  road.replaceChildren();
  for (const stage of roadmapDoc.stages) {
    const doneInStage = stage.trophies.filter(id => earned.has(byId.get(id).name)).length;
    const p = document.createElement('p');
    p.textContent = 'Stage ' + stage.n + ' — ' + stage.title + ' · ~' + stage.hours + ' h · '
      + doneInStage + '/' + stage.trophies.length + ' earned: '
      + stage.trophies.map(id => {
        const t = byId.get(id);
        return (earned.has(t.name) ? '[x] ' : '[ ] ') + t.name;
      }).join('; ');
    road.append(p);
  }
  const miss = $('printMiss');
  miss.replaceChildren();
  for (const t of trophies.filter(t => t.missable)) {
    const p = document.createElement('p');
    p.textContent = (earned.has(t.name) ? '[x] ' : '[ ] ') + t.name + ' — ' + t.missable_note;
    miss.append(p);
  }
  const check = $('printCheck');
  check.replaceChildren();
  for (const t of trophies) {
    const p = document.createElement('p');
    p.textContent = (earned.has(t.name) ? '[x] ' : '[ ] ') + t.name + ' (' + t.grade + ', '
      + KIND_LABEL[t.kind] + ')' + (notes[t.name] ? ' — note: ' + notes[t.name] : '');
    check.append(p);
  }
}

function renderSources() {
  const host = $('sources');
  host.replaceChildren();
  for (const s of trophiesDoc.meta.sources) {
    const p = document.createElement('p');
    const a = document.createElement('a');
    a.href = s.url;
    a.textContent = s.name;
    a.target = '_blank';
    a.rel = 'noopener';
    p.append(a);
    host.append(p);
  }
  const p = document.createElement('p');
  p.textContent = 'Checked ' + trophiesDoc.meta.checked + '. ' + trophiesDoc.meta.note;
  host.append(p);
}

function renderAll() {
  renderProgress();
  renderKindBars();
  renderNextUp();
  renderQueue();
  renderMissables();
  renderRoadmap();
  renderPrint();
  renderList();
}

const VIEWS = { check: 'viewCheck', next: 'viewNext', road: 'viewRoad', miss: 'viewMiss', sources: 'viewSources' };
const TABS = { check: 'tabCheck', next: 'tabNext', road: 'tabRoad', miss: 'tabMiss', sources: 'tabSources' };
function show(view) {
  for (const [key, id] of Object.entries(VIEWS)) $(id).hidden = key !== view;
  for (const [key, id] of Object.entries(TABS)) $(id).classList.toggle('active', key === view);
}
$('tabCheck').addEventListener('click', () => show('check'));
$('tabNext').addEventListener('click', () => show('next'));
$('tabRoad').addEventListener('click', () => show('road'));
$('tabMiss').addEventListener('click', () => show('miss'));
$('tabSources').addEventListener('click', () => show('sources'));
$('printBtn').addEventListener('click', () => window.print());
for (const el of Object.values(controls)) {
  el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', renderAll);
}
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(
    { game: 'GTA VI', exported: new Date().toISOString(), earned: [...earned], notes }, null, 1,
  )], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
});
$('copyList').addEventListener('click', async () => {
  const lines = trophies.map(t =>
    (earned.has(t.name) ? '[x] ' : '[ ] ') + t.name + ' (' + t.grade + ')'
    + (notes[t.name] ? ' — ' + notes[t.name] : ''));
  try {
    await navigator.clipboard.writeText(
      'GTA VI trophies — ' + earned.size + '/55 earned\n' + lines.join('\n'));
    $('copyList').textContent = 'Copied ✓';
    setTimeout(() => { $('copyList').textContent = 'Copy checklist as text'; }, 1500);
  } catch {
    alert('Clipboard is unavailable in this browser.');
  }
});
$('import').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const names = Array.isArray(data) ? data : data.earned;
    earned = new Set(names.filter(n => byName.has(n)));
    if (data && typeof data === 'object' && data.notes && typeof data.notes === 'object') {
      notes = {};
      for (const [k, v] of Object.entries(data.notes)) {
        if (byName.has(k) && typeof v === 'string') notes[k] = v;
      }
      persistNotes();
    }
    persist();
    renderAll();
  } catch {
    alert('That file is not valid trophy progress JSON.');
  }
});
$('reset').addEventListener('click', () => {
  if (confirm('Clear all earned ticks and notes?')) {
    earned = new Set(); notes = {}; persist(); persistNotes(); renderAll();
  }
});

renderSources();
renderAll();
if (query.get('view') === 'roadmap') {
  show('road');
  if (query.get('stage')) document.getElementById('stage-' + query.get('stage'))?.scrollIntoView();
}
if (query.get('view') === 'next') show('next');
if (query.get('view') === 'miss') show('miss');
if (query.get('view') === 'print') { renderPrint(); setTimeout(() => window.print(), 350); }
if (query.get('view') === 'sources') show('sources');
if (query.get('view') === 'detail') show('check');
