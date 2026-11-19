// GTA VI trophy guide + tracker: checklist in localStorage, export/import,
// kind/grade/earned/missable filters, search, spoiler blur, roadmap, detail view.
const KEY = 'gta6-trophy-checklist-v2';
const params = new URLSearchParams(location.search);
const doc = await (await fetch('data/trophies.json')).json();
const roadmap = await (await fetch('data/roadmap.json')).json();
const byId = Object.fromEntries(doc.trophies.map(t => [t.id, t]));
const byName = Object.fromEntries(doc.trophies.map(t => [t.name, t]));

let earned = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]').filter(n => byName[n]));
// Demo seed for screenshots (?demo=N ticks the first N story-order trophies, session only)
if (params.get('demo')) {
  const n = Math.min(+params.get('demo') || 0, 12);
  earned = new Set(doc.trophies.slice(1, 1 + n).map(t => t.name)); // story run so far, not the platinum
}
const $ = id => document.getElementById(id);
const els = { q: $('q'), kind: $('kind'), grade: $('grade'), earned: $('earned'), missOnly: $('missOnly'), spoiler: $('spoiler') };
if (params.get('spoiler') === 'on') els.spoiler.checked = true;
if (params.get('kind')) els.kind.value = params.get('kind');
if (params.get('grade')) els.grade.value = params.get('grade');

function save() { localStorage.setItem(KEY, JSON.stringify([...earned])); }

const KIND_LABEL = { story: 'Story', stranger: 'Strangers & side lines', collectible: 'Collectibles', activity: 'Activities', robbery: 'Robberies', exploration: 'Exploration', money: 'Money & property', feat: 'One-off feat', completion: '100% completion', platinum: 'Platinum' };
const GRADE_SYMBOL = { platinum: '◆', gold: '●', silver: '●', bronze: '●' };

function spoilerOn(t) { return els.spoiler.checked && t.spoiler && !earned.has(t.name); }

function card(t) {
  const d = document.createElement('article');
  d.className = `card grade-${t.grade}${t.missable ? ' missable' : ''}${earned.has(t.name) ? ' done' : ''}`;
  d.dataset.id = t.id;
  const box = document.createElement('input');
  box.type = 'checkbox'; box.checked = earned.has(t.name);
  box.setAttribute('aria-label', 'Earned: ' + t.name);
  box.addEventListener('change', () => { box.checked ? earned.add(t.name) : earned.delete(t.name); save(); render(); });
  const body = document.createElement('div'); body.className = 'card-body';
  const h = document.createElement('h3');
  h.textContent = spoilerOn(t) ? 'Hidden trophy — story spoiler' : t.name;
  if (spoilerOn(t)) h.classList.add('blurred');
  const desc = document.createElement('p'); desc.className = 'desc';
  desc.textContent = spoilerOn(t) ? 'Name and description hidden until earned (spoiler mode on).' : t.description;
  if (spoilerOn(t)) desc.classList.add('blurred');
  const meta = document.createElement('p'); meta.className = 'meta';
  meta.textContent = `${GRADE_SYMBOL[t.grade]} ${t.grade} · ${KIND_LABEL[t.kind]}${t.missable ? ' · ⚠ POSSIBLY MISSABLE' : ''}${t.status === 'unconfirmed' ? ' · method unconfirmed' : t.status === 'partial' ? ' · partly confirmed' : ''}`;
  const guide = document.createElement('p'); guide.className = 'guide';
  guide.textContent = spoilerOn(t) ? 'Guide hidden until earned.' : t.guide;
  if (spoilerOn(t)) guide.classList.add('blurred');
  const src = document.createElement('p'); src.className = 'src';
  if (!spoilerOn(t)) {
    src.textContent = 'Source: ';
    const a = document.createElement('a'); a.href = t.source.url; a.textContent = t.source.name; a.target = '_blank'; a.rel = 'noopener';
    src.append(a);
    const note = document.createElement('span'); note.textContent = ' — ' + t.missable_note;
    src.append(note);
  }
  body.append(h, desc, meta, guide, src);
  d.append(box, body);
  return d;
}

function render() {
  const q = els.q.value.trim().toLowerCase();
  const list = $('list'); list.replaceChildren();
  let shown = 0;
  for (const t of doc.trophies) {
    if (els.kind.value !== 'all' && t.kind !== els.kind.value) continue;
    if (els.grade.value !== 'all' && t.grade !== els.grade.value) continue;
    if (els.earned.value === 'todo' && earned.has(t.name)) continue;
    if (els.earned.value === 'done' && !earned.has(t.name)) continue;
    if (els.missOnly.checked && !t.missable) continue;
    if (q && !(t.name + ' ' + t.description + ' ' + t.guide + ' ' + KIND_LABEL[t.kind]).toLowerCase().includes(q)) continue;
    list.append(card(t)); shown++;
  }
  $('countLine').textContent = `Showing ${shown} of 55 trophies · ${earned.size} earned`;
  const pct = Math.round(earned.size / doc.trophies.length * 100);
  $('platPct').textContent = pct + '%';
  $('platCount').textContent = `${earned.size} of 55 earned`;
  $('barFill').style.width = pct + '%';
  const remain = doc.trophies.length - earned.size;
  $('platEta').textContent = remain === 0 ? 'Platinum earned — Vice Got a Price!' :
    `~${Math.round(remain / doc.trophies.length * roadmap.total_estimate_hours)} h left at the ~200 h estimate`;
  const counts = ['platinum', 'gold', 'silver', 'bronze'].map(g => {
    const tot = doc.trophies.filter(t => t.grade === g).length;
    const got = doc.trophies.filter(t => t.grade === g && earned.has(t.name)).length;
    return `${g} ${got}/${tot}`;
  }).join(' · ');
  $('gradeCounts').textContent = counts;
  // detail view (?view=detail&id=N): scroll to + highlight one trophy
  if (params.get('view') === 'detail' && byId[+params.get('id')]) {
    const el = list.querySelector(`[data-id="${params.get('id')}"]`);
    if (el) { el.classList.add('detail'); el.scrollIntoView({ block: 'start' }); }
  }
}

function renderRoadmap() {
  $('roadTotal').textContent = `${roadmap.title} — ${roadmap.total_estimate_note}`;
  const w = $('roadWarn'); w.replaceChildren();
  for (const warn of roadmap.warnings) { const p = document.createElement('p'); p.className = 'warn'; p.textContent = warn; w.append(p); }
  const host = $('roadmap'); host.replaceChildren();
  for (const s of roadmap.stages) {
    const sec = document.createElement('section'); sec.className = 'stage';
    const h = document.createElement('h3');
    h.textContent = `Stage ${s.n} — ${s.title} · ~${s.hours} h (${s.hours_note})`;
    const ol = document.createElement('ol');
    for (const step of s.steps) { const li = document.createElement('li'); li.textContent = step; ol.append(li); }
    const chips = document.createElement('p'); chips.className = 'chips';
    for (const id of s.trophies) {
      const t = byId[id];
      const c = document.createElement('span');
      c.className = `chip grade-${t.grade}${earned.has(t.name) ? ' done' : ''}${t.missable ? ' missable' : ''}`;
      c.textContent = `${earned.has(t.name) ? '✓ ' : ''}${t.name}${t.missable ? ' ⚠' : ''}`;
      chips.append(c);
    }
    sec.append(h, ol, chips);
    host.append(sec);
  }
}

function renderSources() {
  const host = $('sources'); host.replaceChildren();
  for (const s of doc.meta.sources) {
    const p = document.createElement('p');
    const a = document.createElement('a'); a.href = s.url; a.textContent = s.name; a.target = '_blank'; a.rel = 'noopener';
    p.append(a); host.append(p);
  }
  const p = document.createElement('p');
  p.textContent = 'Checked 2026-11-19. ' + doc.meta.note;
  host.append(p);
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
for (const el of Object.values(els)) el.addEventListener(el.type === 'checkbox' ? 'change' : 'input', render);
$('export').addEventListener('click', () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ game: 'GTA VI', exported: new Date().toISOString(), earned: [...earned] }, null, 1)], { type: 'application/json' }));
  a.download = 'gta6-trophy-progress.json'; a.click();
});
$('import').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const names = Array.isArray(data) ? data : data.earned;
    const next = new Set(names.filter(n => byName[n]));
    earned = next; save(); render();
  } catch { alert('That file is not valid trophy progress JSON.'); }
});
$('reset').addEventListener('click', () => { if (confirm('Clear all earned ticks?')) { earned = new Set(); save(); render(); } });

renderRoadmap(); renderSources(); render();
if (params.get('view') === 'roadmap') show('road');
if (params.get('view') === 'sources') show('sources');
if (params.get('view') === 'detail') show('check');
