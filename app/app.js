// GTA VI trophy guide + tracker, round 2.
// Checklist in localStorage, export/import, copy-as-text, kind/grade/earned/
// missable filters, search, sort, spoiler blur, per-kind progress, next-up
// pointer, platinum roadmap and a cited guide for every trophy.
const STORE_KEY = 'gta6-trophy-checklist-v2';
const query = new URLSearchParams(location.search);
const trophiesDoc = await (await fetch('data/trophies.json')).json();
const roadmapDoc = await (await fetch('data/roadmap.json')).json();
const trophies = trophiesDoc.trophies;
const byId = new Map(trophies.map(t => [t.id, t]));
const byName = new Map(trophies.map(t => [t.name, t]));

// Roadmap order: stage by stage, trophy by trophy. Used for the sort and
// for the next-up pointer, so the checklist can follow the platinum route.
const roadOrder = roadmapDoc.stages.flatMap(s => s.trophies);
const roadRank = new Map(roadOrder.map((id, i) => [id, i]));

let earned = new Set(
  JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]').filter(n => byName.has(n)),
);
// Demo seed for screenshots (?demo=N ticks the first N story trophies,
// session only, and it is a story run so far — never the platinum).
if (query.get('demo')) {
  const n = Math.min(Number(query.get('demo')) || 0, 12);
  earned = new Set(trophies.slice(1, 1 + n).map(t => t.name));
}
const $ = id => document.getElementById(id);
const controls = {
  q: $('q'), kind: $('kind'), grade: $('grade'), earned: $('earned'),
  missOnly: $('missOnly'), spoiler: $('spoiler'), sort: $('sort'),
};
if (query.get('spoiler') === 'on') controls.spoiler.checked = true;
if (query.get('kind')) controls.kind.value = query.get('kind');
if (query.get('grade')) controls.grade.value = query.get('grade');
if (query.get('sort')) controls.sort.value = query.get('sort');

function persist() { localStorage.setItem(STORE_KEY, JSON.stringify([...earned])); }

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
    if (needle && !(t.name + ' ' + t.description + ' ' + t.guide + ' ' + KIND_LABEL[t.kind])
      .toLowerCase().includes(needle)) return false;
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
  const next = roadOrder.map(id => byId.get(id)).find(t => !earned.has(t.name));
  const box = $('nextUp');
  box.replaceChildren();
  if (!next) {
    box.textContent = 'Every trophy is ticked — Vice Got a Price! is yours.';
    return;
  }
  const label = document.createElement('strong');
  label.textContent = 'Next up on the roadmap: ';
  const name = document.createElement('span');
  name.textContent = next.name + ' (' + KIND_LABEL[next.kind] + ', ' + next.grade + ')';
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
  box.append(label, name, ' ', jump);
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
  renderList();
}

function show(view) {
  $('viewCheck').hidden = view !== 'check';
  $('viewRoad').hidden = view !== 'road';
  $('viewSources').hidden = view !== 'sources';
  $('tabCheck').classList.toggle('active', view === 'check');
  $('tabRoad').classList.toggle('active', view === 'road');
  $('tabSources').classList.toggle('active', view === 'sources');
}
$('tabCheck').addEventListener('click', () => show('check'));
$('tabRoad').addEventListener('click', () => show('road'));
$('tabSources').addEventListener('click', () => show('sources'));
$('printBtn').addEventListener('click', () => window.print());
for (const el of Object.values(controls)) {
  el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', renderAll);
}
$('export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(
    { game: 'GTA VI', exported: new Date().toISOString(), earned: [...earned] }, null, 1,
  )], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'gta6-trophy-progress.json';
  a.click();
});
$('copyList').addEventListener('click', async () => {
  const lines = trophies.map(t =>
    (earned.has(t.name) ? '[x] ' : '[ ] ') + t.name + ' (' + t.grade + ')');
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
    persist();
    renderAll();
  } catch {
    alert('That file is not valid trophy progress JSON.');
  }
});
$('reset').addEventListener('click', () => {
  if (confirm('Clear all earned ticks?')) { earned = new Set(); persist(); renderAll(); }
});

renderRoadmap();
renderSources();
renderAll();
if (query.get('view') === 'roadmap') {
  show('road');
  if (query.get('stage')) document.getElementById('stage-' + query.get('stage'))?.scrollIntoView();
}
if (query.get('view') === 'sources') show('sources');
if (query.get('view') === 'detail') show('check');
