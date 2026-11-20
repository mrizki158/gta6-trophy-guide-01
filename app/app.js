/* Leonida Trophy Guide: offline checklist + tracker for GTA VI's 55 PS5 trophies.
   Data lives in data/trophies.json (55 trophies, each with a cited guide) and
   data/roadmap.json (7 stages to the platinum). Progress and notes are saved in
   localStorage; nothing is fetched at runtime except those two local files. */
(function () {
  'use strict';

  var STORE_KEY = 'leonida-trophy-guide-r5';
  var DATA_URLS = ['data/trophies.json', 'data/roadmap.json'];

  var trophies = [];
  var sources = [];
  var sourceById = {};
  var stages = [];
  var roadmapMeta = {};
  var roadmapAdvice = [];
  var roadmapWarnings = [];
  var state = { earned: {}, notes: {}, spoiler: true, kind: 'all', grade: 'all', query: '' };
  var selectedId = null;
  var currentView = 'checklist';

  var $ = function (id) { return document.getElementById(id); };

  function esc(text) {
    return String(text == null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved.earned) state.earned = saved.earned;
      if (saved.notes) state.notes = saved.notes;
      if (typeof saved.spoiler === 'boolean') state.spoiler = saved.spoiler;
    } catch (e) { /* a corrupt save starts fresh rather than breaking the guide */ }
  }

  function saveState() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        earned: state.earned, notes: state.notes, spoiler: state.spoiler
      }));
    } catch (e) { /* private mode: the guide still works, it just does not persist */ }
  }

  function isEarned(t) { return !!state.earned[t.id]; }

  function citedGuideCount() {
    return trophies.filter(function (t) { return t.status === 'verified' || t.status === 'partial'; }).length;
  }

  function unconfirmedCount() {
    return trophies.filter(function (t) { return t.status === 'unconfirmed'; }).length;
  }

  function sourceClaimCounts() {
    var counts = {};
    sources.forEach(function (s) { counts[s.id] = 0; });
    trophies.forEach(function (t) {
      (t.sources || []).forEach(function (sid) {
        if (counts[sid] !== undefined) counts[sid] += 1;
      });
    });
    return counts;
  }

  function sourceChip(t) {
    var sid = (t.sources || [])[0];
    if (!sid || !sourceById[sid]) return '';
    var s = sourceById[sid];
    return '<span class="chip source" title="' + esc(s.name) + ' — ' + esc(s.role) + '">' +
      esc(s.short) + ' &middot; ' + esc(s.date) + '</span>';
  }

  function statusChip(t) {
    if (t.status === 'verified') return '<span class="chip status-verified">verified</span>';
    if (t.status === 'partial') return '<span class="chip status-partial">partial — 1 detail open</span>';
    return '<span class="chip status-unconfirmed">unconfirmed</span>';
  }

  function spoilerHidden(t) {
    return state.spoiler && t.kind === 'story' && !isEarned(t);
  }

  function trophyMatches(t) {
    if (state.kind === 'missable' && !t.missable) return false;
    if (state.kind !== 'all' && state.kind !== 'missable' && t.kind !== state.kind) return false;
    if (state.grade !== 'all' && t.grade !== state.grade) return false;
    if (state.query) {
      var q = state.query.toLowerCase();
      var hay = (t.name + ' ' + t.description + ' ' + t.guide).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  function renderHeader() {
    var earned = trophies.filter(isEarned).length;
    var pct = trophies.length ? Math.round(earned / trophies.length * 100) : 0;
    $('statTrophies').textContent = trophies.length;
    $('statCited').textContent = citedGuideCount();
    $('statSources').textContent = sources.length;
    $('statProgress').textContent = pct + '%';
    $('progressBar').style.width = pct + '%';
    $('countLine').textContent = trophies.length + ' trophies · ' + citedGuideCount() +
      ' cited guides · ' + unconfirmedCount() + ' honestly unconfirmed · ' + sources.length +
      ' dated sources · ' + earned + ' earned so far';
  }

  function renderList() {
    var list = $('trophyList');
    var shown = trophies.filter(trophyMatches);
    $('listMeta').textContent = 'Showing ' + shown.length + ' of ' + trophies.length +
      ' trophies. Every row carries its source chip: the guide and date behind the method.';
    list.innerHTML = shown.map(function (t) {
      var hidden = spoilerHidden(t);
      var name = hidden ? 'Hidden story trophy' : esc(t.name);
      var desc = hidden ? 'Earn it to reveal the name and description.' : esc(t.description);
      var cls = 'trophyrow' + (isEarned(t) ? ' earned' : '') + (t.id === selectedId ? ' selected' : '');
      return '<li class="' + cls + '" data-id="' + esc(t.id) + '" tabindex="0">' +
        '<input type="checkbox" ' + (isEarned(t) ? 'checked' : '') + ' aria-label="Earned: ' + esc(t.name) + '">' +
        '<div><div class="trophyname' + (hidden ? ' blurred' : '') + '">' + name +
        '<span class="grade grade-' + esc(t.grade) + '">' + esc(t.grade) + '</span></div>' +
        '<div class="trophydesc' + (hidden ? ' blurred' : '') + '">' + desc + '</div>' +
        '<div class="trophymeta">' + sourceChip(t) + statusChip(t) +
        (t.missable ? '<span class="chip missable">missable — Ch 1</span>' : '') +
        (t.hidden ? '<span class="chip hiddenflag">hidden on PSN</span>' : '') +
        '<span class="chip">Stage ' + t.stage + '</span></div></div>' +
        '<div class="rowside"><span class="stage">Stage ' + t.stage + '</span><br>' +
        (state.notes[t.id] ? 'has a note' : '') + '</div></li>';
    }).join('');
  }

  function renderDetail() {
    var panel = $('detailPanel');
    var t = trophies.find(function (x) { return x.id === selectedId; });
    if (!t) {
      panel.innerHTML = '<p class="detailhint">Select a trophy to read its full cited guide.</p>';
      return;
    }
    var hidden = spoilerHidden(t);
    var srcLinks = (t.sources || []).map(function (sid) {
      var s = sourceById[sid];
      if (!s) return '';
      var link = s.url ? ' — <a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.url.replace(/^https?:\/\//, '')) + '</a>' : '';
      return '<div><strong>' + esc(s.name) + '</strong> · ' + esc(s.date) + link +
        '<br><span style="color:var(--muted)">' + esc(s.role) + '</span></div>';
    }).join('');
    var steps = (t.steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    panel.innerHTML =
      '<h2>' + (hidden ? 'Hidden story trophy' : esc(t.name)) + '</h2>' +
      '<p><span class="grade grade-' + esc(t.grade) + '">' + esc(t.grade) + '</span> ' +
      statusChip(t) + (t.missable ? ' <span class="chip missable">missable</span>' : '') + '</p>' +
      '<p class="desc' + (hidden ? ' blurred' : '') + '">' + esc(t.description) + '</p>' +
      (hidden ? '<p class="desc">Spoilers are hidden until this story trophy is earned. Tick it earned to reveal it.</p>' : '') +
      (t.missable && t.missableNote ? '<div class="missnote"><strong>When it can be missed:</strong> ' + esc(t.missableNote) + '</div>' : '') +
      '<h3>Guide</h3><p>' + esc(t.guide) + '</p>' +
      (steps ? '<h3>Steps</h3><ol>' + steps + '</ol>' : '') +
      '<div class="sources"><h3>Sources for this guide</h3>' + srcLinks + '</div>' +
      '<h3>Your note</h3><textarea id="noteBox" placeholder="Where you are up to, a location, a reminder&hellip;">' +
      esc(state.notes[t.id] || '') + '</textarea>' +
      '<p class="notehint">Notes are saved in this browser and included in export.</p>';
    var box = $('noteBox');
    box.addEventListener('input', function () {
      if (box.value.trim()) { state.notes[t.id] = box.value; } else { delete state.notes[t.id]; }
      saveState();
    });
  }

  function renderRoadmap() {
    $('roadmapNote').textContent = 'Seven stages, ' + (roadmapMeta.totalHours || 200) +
      ' estimated hours in total (' + (roadmapMeta.difficulty || '') + '). ' +
      'Hours are estimates: the story takes 60-80 hours and the full platinum about 200, per PowerPyx.';
    var byId = {};
    trophies.forEach(function (t) { byId[t.id] = t; });
    $('roadmapList').innerHTML = stages.map(function (st) {
      var items = (st.trophies || []).map(function (tid) {
        var t = byId[tid];
        if (!t) return '';
        return '<li>' + esc(t.name) + ' <span style="color:var(--muted)">(' + esc(t.grade) + ')' +
          (t.missable ? ' <span class="chip missable">missable</span>' : '') + '</span></li>';
      }).join('');
      return '<div class="stagecard"><h3>Stage ' + st.id + ' — ' + esc(st.title) + '</h3>' +
        '<div class="hours">~' + st.hours + ' hours (estimate) · ' + (st.trophies || []).length + ' trophies</div>' +
        '<p>' + esc(st.note) + '</p><ul>' + items + '</ul></div>';
    }).join('');
    $('adviceList').innerHTML = roadmapAdvice.map(function (a) {
      return '<li><strong>' + esc(a.title) + '.</strong> ' + esc(a.text) + '</li>';
    }).join('');
  }

  function renderNextUp() {
    var queue = trophies.filter(function (t) { return !isEarned(t); });
    queue.sort(function (a, b) {
      if (a.id === 'vice-got-a-price') return 1;
      if (b.id === 'vice-got-a-price') return -1;
      if (a.missable !== b.missable) return a.missable ? -1 : 1;
      if (a.stage !== b.stage) return a.stage - b.stage;
      return 0;
    });
    $('nextList').innerHTML = queue.map(function (t) {
      var why = t.missable ? 'Do this first — it can be missed in Chapter 1.' :
        t.id === 'vice-got-a-price' ? 'The platinum, last.' :
        'Stage ' + t.stage + ' · ' + t.grade;
      return '<li><strong>' + esc(t.name) + '</strong> ' + sourceChip(t) + '<br>' +
        '<span class="why">' + esc(why) + ' ' + esc(t.description) + '</span></li>';
    }).join('') || '<li>Everything is earned. The platinum is yours.</li>';
  }

  function renderMissables() {
    var miss = trophies.filter(function (t) { return t.missable; });
    var cards = miss.map(function (t) {
      return '<div class="stagecard"><h3>' + esc(t.name) + ' <span class="chip missable">missable</span></h3>' +
        '<p>' + esc(t.description) + '</p>' +
        '<div class="missnote"><strong>When it can be missed:</strong> ' + esc(t.missableNote || '') + '</div>' +
        '<p>' + esc(t.guide) + '</p><p>' + sourceChip(t) + ' ' + statusChip(t) + '</p></div>';
    }).join('');
    var warnings = (roadmapWarnings || []).map(function (w) {
      return '<div class="stagecard"><h3>' + esc(w.title) + '</h3><p>' + esc(w.text) + '</p></div>';
    }).join('');
    $('missableList').innerHTML = cards + warnings +
      '<p class="sectionnote">Everything else in this guide is confirmed still available after the story: PowerPyx notes all trophy-related quest givers return in free-roam, and there is no mission replay, so keep a save at the start and end of every chapter just in case.</p>';
  }

  function renderSources() {
    var counts = sourceClaimCounts();
    var rows = sources.slice().sort(function (a, b) { return counts[b.id] - counts[a.id]; });
    $('sourceList').innerHTML = rows.map(function (s) {
      var link = s.url ? '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' +
        esc(s.url.replace(/^https?:\/\//, '')) + '</a>' : '<span style="color:var(--muted)">No public link — cited by name and date.</span>';
      return '<div class="sourcecard"><div><h3>' + esc(s.name) + ' <span class="date">' + esc(s.date) + '</span></h3>' +
        '<p>' + esc(s.role) + '</p><p>' + link + '</p></div>' +
        '<div class="count">' + counts[s.id] + '<small>cited ' + (counts[s.id] === 1 ? 'guide' : 'guides') + '</small></div></div>';
    }).join('');
  }

  function renderAll() {
    renderHeader();
    renderList();
    renderDetail();
    renderRoadmap();
    renderNextUp();
    renderMissables();
    renderSources();
  }

  function showView(name) {
    currentView = name;
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === name);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + name);
    });
  }

  function applyHash() {
    var hash = (location.hash || '').replace(/^#\/?/, '');
    if (hash.indexOf('trophy/') === 0) {
      var id = decodeURIComponent(hash.slice(7));
      if (trophies.some(function (t) { return t.id === id; })) {
        selectedId = id;
        showView('checklist');
        renderList();
        renderDetail();
        return;
      }
    }
    var views = ['checklist', 'roadmap', 'nextup', 'missables', 'sources'];
    if (views.indexOf(hash) !== -1) showView(hash);
  }

  function exportProgress() {
    var blob = new Blob([JSON.stringify({
      app: 'leonida-trophy-guide-r5',
      exportedAt: new Date().toISOString(),
      earned: Object.keys(state.earned).filter(function (k) { return state.earned[k]; }),
      notes: state.notes
    }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gta6-trophy-progress.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (data.earned && Array.isArray(data.earned)) {
          state.earned = {};
          data.earned.forEach(function (id) { state.earned[id] = true; });
        }
        if (data.notes && typeof data.notes === 'object') state.notes = data.notes;
        saveState();
        renderAll();
      } catch (e) { alert('That file is not a valid progress export.'); }
    };
    reader.readAsText(file);
  }

  function wireEvents() {
    $('tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-view]');
      if (!btn) return;
      showView(btn.getAttribute('data-view'));
      location.hash = '#/' + btn.getAttribute('data-view');
    });
    $('search').addEventListener('input', function (e) { state.query = e.target.value; renderList(); });
    $('kindFilter').addEventListener('change', function (e) { state.kind = e.target.value; renderList(); });
    $('gradeFilter').addEventListener('change', function (e) { state.grade = e.target.value; renderList(); });
    $('spoilerToggle').addEventListener('change', function (e) {
      state.spoiler = e.target.checked; saveState(); renderList(); renderDetail();
    });
    $('btnExport').addEventListener('click', exportProgress);
    $('btnImport').addEventListener('click', function () { $('fileImport').click(); });
    $('fileImport').addEventListener('change', function (e) {
      if (e.target.files[0]) importProgress(e.target.files[0]);
      e.target.value = '';
    });
    $('btnPrint').addEventListener('click', function () { window.print(); });
    $('trophyList').addEventListener('click', function (e) {
      var row = e.target.closest('.trophyrow');
      if (!row) return;
      var id = row.getAttribute('data-id');
      if (e.target.type === 'checkbox') {
        state.earned[id] = e.target.checked;
        if (!e.target.checked) delete state.earned[id];
        saveState(); renderHeader(); renderList(); renderDetail(); renderNextUp();
        return;
      }
      selectedId = id;
      location.hash = '#/trophy/' + encodeURIComponent(id);
      renderList(); renderDetail();
    });
    $('trophyList').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var row = e.target.closest('.trophyrow');
      if (!row) return;
      e.preventDefault();
      selectedId = row.getAttribute('data-id');
      renderList(); renderDetail();
    });
    window.addEventListener('hashchange', applyHash);
  }

  function boot() {
    loadState();
    $('spoilerToggle').checked = state.spoiler;
    Promise.all(DATA_URLS.map(function (u) { return fetch(u).then(function (r) { return r.json(); }); }))
      .then(function (loaded) {
        var trophyData = loaded[0];
        var roadmapData = loaded[1];
        trophies = trophyData.trophies || [];
        sources = trophyData.sources || [];
        sources.forEach(function (s) { sourceById[s.id] = s; });
        stages = roadmapData.stages || [];
        roadmapMeta = roadmapData.meta || {};
        roadmapAdvice = roadmapData.advice || [];
        roadmapWarnings = roadmapData.warnings || [];
        wireEvents();
        renderAll();
        applyHash();
      })
      .catch(function (err) {
        $('countLine').textContent = 'Could not load the trophy data. Open this guide from its own folder over http, not as a bare file: ' + err;
      });
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
