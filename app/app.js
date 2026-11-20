// Leonida Trophy Guide: offline tracker for the 55 GTA VI trophies.
// Loads only its own data files (data/trophies.json, data/roadmap.json),
// saves progress in localStorage, and renders hash-routed views.
(function () {
  'use strict';

  var STORE_KEY = 'gta6-trophy-tracker-v4';
  var trophies = [];
  var roadmap = null;
  var byId = {};
  var stageOf = {};
  var state = { earned: {}, notes: {}, spoiler: true };
  var filters = { q: '', kind: 'all', grade: 'all', earnedOnly: false, unearnedOnly: false };

  var KIND_LABELS = {
    story: 'Story', missable: 'Missable', collectibles: 'Collectibles',
    activities: 'Activities', capstone: 'Money & capstone', online: 'Online'
  };
  var GRADE_LABELS = { platinum: 'Platinum', gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

  function loadState() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          state.earned = parsed.earned || {};
          state.notes = parsed.notes || {};
          state.spoiler = parsed.spoiler !== false;
        }
      }
    } catch (e) { /* private mode: keep in-memory state */ }
  }

  function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  function applyDemoSeed() {
    var params = new URLSearchParams(window.location.search);
    if (params.get('demo') !== '1') return;
    [2, 3, 8].forEach(function (id) { state.earned[id] = true; });
    saveState();
  }

  function trophyGradeCount(grade) {
    return trophies.filter(function (t) { return t.grade === grade; }).length;
  }

  function earnedGradeCount(grade) {
    return trophies.filter(function (t) { return t.grade === grade && state.earned[t.id]; }).length;
  }

  function earnedCount() {
    return trophies.filter(function (t) { return state.earned[t.id]; }).length;
  }

  function remainingHours() {
    if (!roadmap || !roadmap.stages) return 200;
    var total = 0;
    roadmap.stages.forEach(function (stage) {
      var ids = stage.trophy_ids || [];
      var left = ids.filter(function (id) { return !state.earned[id]; }).length;
      if (ids.length) total += (stage.hours || 0) * (left / ids.length);
    });
    return Math.round(total);
  }

  function updateProgress() {
    var total = trophies.length || 55;
    var done = earnedCount();
    var pct = total ? Math.round((done / total) * 100) : 0;
    var text = document.getElementById('progressText');
    if (text) text.textContent = done + ' / ' + total + ' trophies — ' + pct + '%';
    var counts = document.getElementById('gradeCounts');
    if (counts) {
      counts.textContent = ['platinum', 'gold', 'silver', 'bronze'].map(function (g) {
        return GRADE_LABELS[g] + ' ' + earnedGradeCount(g) + '/' + trophyGradeCount(g);
      }).join(' · ');
    }
    var fill = document.getElementById('progressFill');
    if (fill) fill.style.width = pct + '%';
    var wrap = document.getElementById('progressBarWrap');
    if (wrap) wrap.setAttribute('aria-valuenow', String(pct));
    var eta = document.getElementById('etaText');
    if (eta) {
      eta.textContent = done === total
        ? 'Platinum earned — Vice Got a Price!'
        : 'Platinum ETA: about ' + remainingHours() + ' hours remaining';
    }
  }

  function isSpoilerHidden(t) {
    return state.spoiler && t.kind === 'story' && !state.earned[t.id];
  }

  function displayName(t) {
    return isSpoilerHidden(t) ? 'Hidden story trophy' : t.name;
  }

  function displayDesc(t) {
    return isSpoilerHidden(t) ? 'Complete the story to reveal this trophy.' : t.description;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function gradePill(t) {
    return '<span class="pill ' + esc(t.grade) + '">' + esc(GRADE_LABELS[t.grade] || t.grade) + '</span>';
  }

  function statusPill(t) {
    var label = t.status === 'verified' ? 'Verified' : t.status === 'partial' ? 'Partially confirmed' : 'Unconfirmed';
    return '<span class="pill status-' + esc(t.status) + '">' + esc(label) + '</span>';
  }

  function kindPill(t) {
    var label = t.missable ? 'Missable' : (KIND_LABELS[t.kind] || t.kind);
    return '<span class="pill' + (t.missable ? ' missable' : '') + '">' + esc(label) + '</span>';
  }

  function citationHtml(t) {
    var label = esc(t.source || 'PowerPyx — GTA 6 Trophy Guide & Roadmap');
    var url = t.source_url || 'https://www.powerpyx.com/gta-6-grand-theft-auto-vi-trophy-guide-roadmap/';
    return '<p class="cite">Source: <a href="' + esc(url) + '" target="_blank" rel="noopener">' + label + '</a></p>';
  }

  function trophyCard(t) {
    var hidden = isSpoilerHidden(t);
    var earned = !!state.earned[t.id];
    var note = state.notes[t.id] || '';
    return '<article class="card' + (earned ? ' earned' : '') + (t.missable ? ' missable-card' : '') + '">' +
      '<h3><a href="#/trophy/' + t.id + '">' + esc(displayName(t)) + '</a></h3>' +
      '<p class="desc' + (hidden ? ' blurred' : '') + '">' + esc(displayDesc(t)) + '</p>' +
      '<div class="meta">' + gradePill(t) + kindPill(t) +
      (t.hidden ? '<span class="pill hidden">Hidden on PSN</span>' : '') +
      (t.count != null ? '<span class="pill">Count: ' + esc(t.count) + '</span>' : '') +
      statusPill(t) + '</div>' +
      (hidden ? '<p class="spoiler-note">Spoiler-safe mode is on. Tick this trophy as earned to reveal it.</p>' : '') +
      '<p class="guide-text">' + esc(t.guide) + '</p>' +
      citationHtml(t) +
      (t.missable && t.missable_note ? '<p class="warning">' + esc(t.missable_note) + '</p>' : '') +
      '<div class="earn-row"><button type="button" data-earn="' + t.id + '">' +
      (earned ? '✓ Earned — untick' : 'Mark earned') + '</button>' +
      '<input class="note-input" type="text" placeholder="Your note…" data-note="' + t.id + '" value="' + esc(note) + '" aria-label="Note for ' + esc(displayName(t)) + '"></div>' +
      '</article>';
  }

  function filteredTrophies() {
    var q = filters.q.trim().toLowerCase();
    return trophies.filter(function (t) {
      if (filters.kind === 'missable' && !t.missable) return false;
      if (filters.kind === 'online') return false;
      if (filters.kind !== 'all' && filters.kind !== 'missable' && t.kind !== filters.kind) return false;
      if (filters.grade !== 'all' && t.grade !== filters.grade) return false;
      if (filters.earnedOnly && !state.earned[t.id]) return false;
      if (filters.unearnedOnly && state.earned[t.id]) return false;
      if (q) {
        var hay = (t.name + ' ' + t.description + ' ' + t.guide + ' ' + (t.source || '')).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderChecklist() {
    var list = filteredTrophies();
    var html = '<h2 class="section-title">Checklist — all 55 trophies</h2>' +
      '<p class="section-sub">' + list.length + ' shown · ' + earnedCount() + ' earned · ' +
      'tick a trophy when you earn it; notes are saved with your progress.</p>';
    if (!list.length) {
      html += '<p class="empty">No trophies match these filters. Try clearing the search or the kind filter — there are no online trophies in this game, so the Online filter is empty by design.</p>';
    } else {
      html += '<div class="trophy-grid">' + list.map(trophyCard).join('') + '</div>';
    }
    return html;
  }

  function renderDetail(id) {
    var t = byId[id];
    if (!t) return '<p class="empty">No trophy with that id. <a href="#/">Back to the checklist</a>.</p>';
    var stage = stageOf[id];
    var hidden = isSpoilerHidden(t);
    var earned = !!state.earned[t.id];
    var note = state.notes[t.id] || '';
    var html = '<article class="detail"><p><a href="#/">&larr; Back to checklist</a></p>' +
      '<h2>' + esc(displayName(t)) + '</h2>' +
      '<p class="desc' + (hidden ? ' blurred' : '') + '">' + esc(displayDesc(t)) + '</p>' +
      '<div class="meta">' + gradePill(t) + kindPill(t) +
      (t.hidden ? '<span class="pill hidden">Hidden on PSN until earned</span>' : '') +
      (t.count != null ? '<span class="pill">PSN count: ' + esc(t.count) + '</span>' : '') +
      statusPill(t) + '</div>' +
      (hidden ? '<p class="spoiler-note">Spoiler-safe mode is on. Tick this trophy as earned to reveal its name and description.</p>' : '') +
      citationHtml(t) +
      '<h3>How to earn it</h3><p class="guide-text">' + esc(t.guide) + '</p>' +
      citationHtml(t) +
      (t.missable && t.missable_note ? '<p class="warning"><strong>When it can be missed:</strong> ' + esc(t.missable_note) + '</p>' : '') +
      (t.status === 'unconfirmed' ? '<p class="warning"><strong>Unconfirmed:</strong> no launch-era source has verified a method for this trophy. The guide above says only what the official description supports.</p>' : '') +
      (stage ? '<p><strong>Roadmap stage ' + stage.stage + ':</strong> ' + esc(stage.title) + ' (about ' + stage.hours + 'h)</p>' : '') +
      '<div class="earn-row"><button type="button" data-earn="' + t.id + '">' +
      (earned ? '✓ Earned — untick' : 'Mark earned') + '</button>' +
      '<input class="note-input" type="text" placeholder="Your note…" data-note="' + t.id + '" value="' + esc(note) + '" aria-label="Note for this trophy"></div>' +
      '</article>';
    return html;
  }

  function renderRoadmap() {
    if (!roadmap) return '<p class="empty">Roadmap data is loading.</p>';
    var html = '<h2 class="section-title">' + esc(roadmap.title || 'Road to the Platinum') + '</h2>' +
      '<p class="section-sub">About ' + (roadmap.total_hours_estimate || 200) + ' hours in total (estimates). ' + esc(roadmap.hours_note || '') + '</p>' +
      '<p class="warning"><strong>Point of no return:</strong> ' + esc(roadmap.point_of_no_return || '') + '</p>';
    html += roadmap.stages.map(function (stage) {
      var ids = stage.trophy_ids || [];
      var done = ids.filter(function (id) { return state.earned[id]; }).length;
      var chips = ids.map(function (id) {
        var t = byId[id];
        if (!t) return '';
        return '<a href="#/trophy/' + t.id + '" class="' + (state.earned[t.id] ? 'done' : '') + '">' +
          esc(displayName(t)) + (t.missable ? ' ⚠' : '') + '</a>';
      }).join('');
      return '<section class="stage"><h3>Stage ' + stage.stage + ' — ' + esc(stage.title) +
        ' <span class="hours">· about ' + stage.hours + 'h · ' + done + '/' + ids.length + ' earned</span></h3>' +
        '<p>' + esc(stage.goal) + '</p><p>' + esc(stage.tips || '') + '</p>' +
        (stage.warning ? '<p class="warning">' + esc(stage.warning) + '</p>' : '') +
        '<div class="stage-trophies">' + chips + '</div></section>';
    }).join('');
    return html;
  }

  function nextUpOrder() {
    var left = trophies.filter(function (t) { return !state.earned[t.id] && t.id !== 1; });
    var plat = trophies.filter(function (t) { return !state.earned[t.id] && t.id === 1; });
    function stageRank(t) { var s = stageOf[t.id]; return s ? s.stage : 99; }
    left.sort(function (a, b) {
      if (a.missable !== b.missable) return a.missable ? -1 : 1;
      return stageRank(a) - stageRank(b) || a.id - b.id;
    });
    return left.concat(plat);
  }

  function renderNext() {
    var queue = nextUpOrder();
    var html = '<h2 class="section-title">Next up — missable first, platinum last</h2>' +
      '<p class="section-sub">Roadmap order, with the one potentially missable trophy first and the platinum kept last. ' +
      remainingHours() + ' estimated hours left.</p>';
    if (!queue.length) return html + '<p class="empty">Everything is earned. Vice Got a Price! is yours.</p>';
    html += '<div class="next-list">' + queue.map(function (t, i) {
      var stage = stageOf[t.id];
      return '<div class="next-item"><span class="rank">' + (i + 1) + '</span><div>' +
        '<a href="#/trophy/' + t.id + '">' + esc(displayName(t)) + '</a> ' + gradePill(t) + kindPill(t) +
        (stage ? ' <span class="cite">Stage ' + stage.stage + ' · about ' + stage.hours + 'h</span>' : '') +
        '<br><span class="desc">' + esc(displayDesc(t)) + '</span></div>' +
        '<button type="button" data-earn="' + t.id + '">Mark earned</button></div>';
    }).join('') + '</div>';
    return html;
  }

  function renderMissable() {
    var watch = trophies.filter(function (t) { return t.missable; });
    var html = '<h2 class="section-title">Missable watch-list</h2>' +
      '<p class="section-sub">Only one trophy is flagged as potentially missable by the cited guides. Every other trophy can be earned in post-story free roam, and there is no mission replay, so keep a manual save at the start and end of each chapter.</p>';
    html += '<div class="watch-list">' + watch.map(function (t) {
      return '<div class="next-item"><span class="rank">⚠</span><div>' +
        '<a href="#/trophy/' + t.id + '">' + esc(displayName(t)) + '</a> ' + gradePill(t) +
        '<p class="guide-text">' + esc(t.guide) + '</p>' + citationHtml(t) +
        (t.missable_note ? '<p class="warning">' + esc(t.missable_note) + '</p>' : '') +
        '</div><button type="button" data-earn="' + t.id + '">' +
        (state.earned[t.id] ? '✓ Earned' : 'Mark earned') + '</button></div>';
    }).join('') + '</div>';
    html += '<p class="section-sub">Not flagged missable: all 12 story trophies pop automatically, every side-character chain stays open after the story, and nothing on the 100% checklist is missable (PowerPyx).</p>';
    return html;
  }

  function renderPrint() {
    var done = earnedCount();
    var html = '<h2 class="section-title">Print view — platinum run summary</h2>' +
      '<p class="section-sub">' + done + ' / ' + trophies.length + ' earned · ' + remainingHours() + ' estimated hours left · ' +
      'printed from the Leonida Trophy Guide.</p>';
    if (roadmap) {
      html += roadmap.stages.map(function (stage) {
        var ids = stage.trophy_ids || [];
        var d = ids.filter(function (id) { return state.earned[id]; }).length;
        return '<section class="stage"><h3>Stage ' + stage.stage + ' — ' + esc(stage.title) + ' · about ' + stage.hours + 'h · ' + d + '/' + ids.length + '</h3>' +
          '<p>' + esc(stage.goal) + '</p></section>';
      }).join('');
    }
    html += '<h3>Missables</h3><p>Positive Mental Attitude — do Lucia\u2019s balcony meditation at Jason\u2019s house in Chapter 1, after Down to Earth, before the chapter ends.</p>';
    html += '<h3>Checklist state</h3><div class="next-list">' + trophies.map(function (t) {
      return '<div class="next-item"><span>' + (state.earned[t.id] ? '☑' : '☐') + '</span><div><strong>' + esc(displayName(t)) + '</strong> — ' + esc(GRADE_LABELS[t.grade]) +
        (state.notes[t.id] ? ' · Note: ' + esc(state.notes[t.id]) : '') + '</div></div>';
    }).join('') + '</div>';
    return html;
  }

  function render() {
    var view = document.getElementById('view');
    if (!view) return;
    var hash = window.location.hash || '#/';
    var parts = hash.replace(/^#\/?/, '').split('/');
    var name = parts[0] || '';
    var route = name === 'trophy' ? 'detail' : (name || 'home');
    document.body.className = 'route-' + route;
    document.querySelectorAll('.views a').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-view') === (name || 'home') || (name === '' && a.getAttribute('data-view') === 'home'));
    });
    if (name === 'roadmap') view.innerHTML = renderRoadmap();
    else if (name === 'trophy') view.innerHTML = renderDetail(Number(parts[1]));
    else if (name === 'next') view.innerHTML = renderNext();
    else if (name === 'missable') view.innerHTML = renderMissable();
    else if (name === 'print') view.innerHTML = renderPrint();
    else view.innerHTML = renderChecklist();
    updateProgress();
    window.scrollTo(0, 0);
  }

  function buildChips() {
    var kinds = document.getElementById('kindChips');
    if (kinds) {
      var kindList = ['all', 'story', 'missable', 'collectibles', 'activities', 'capstone', 'online'];
      kinds.innerHTML = kindList.map(function (k) {
        var label = k === 'all' ? 'All kinds' : (KIND_LABELS[k] || k);
        if (k === 'online') label += ' (0)';
        return '<button type="button" class="chip' + (filters.kind === k ? ' active' : '') + '" data-kind="' + k + '">' + esc(label) + '</button>';
      }).join('');
    }
    var grades = document.getElementById('gradeChips');
    if (grades) {
      grades.innerHTML = ['all', 'platinum', 'gold', 'silver', 'bronze'].map(function (g) {
        var label = g === 'all' ? 'All grades' : GRADE_LABELS[g];
        return '<button type="button" class="chip' + (filters.grade === g ? ' active' : '') + '" data-grade="' + g + '">' + esc(label) + '</button>';
      }).join('');
    }
  }

  function exportProgress() {
    var payload = {
      app: 'Leonida Trophy Guide — GTA VI',
      exported_at: new Date().toISOString(),
      earned: Object.keys(state.earned).filter(function (id) { return state.earned[id]; }).map(Number),
      notes: state.notes,
      spoiler: state.spoiler
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gta6-trophy-progress.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function importProgress(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || typeof data !== 'object') throw new Error('bad file');
        var earned = {};
        (data.earned || []).forEach(function (id) { if (byId[id]) earned[id] = true; });
        state.earned = earned;
        state.notes = data.notes || {};
        if (typeof data.spoiler === 'boolean') state.spoiler = data.spoiler;
        saveState();
        syncControls();
        render();
      } catch (e) {
        alert('That file is not a Leonida Trophy Guide export.');
      }
    };
    reader.readAsText(file);
  }

  function syncControls() {
    var spoiler = document.getElementById('spoilerToggle');
    if (spoiler) spoiler.checked = !!state.spoiler;
    buildChips();
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var earnBtn = e.target.closest('[data-earn]');
      if (earnBtn) {
        var id = Number(earnBtn.getAttribute('data-earn'));
        if (state.earned[id]) delete state.earned[id]; else state.earned[id] = true;
        saveState();
        render();
        return;
      }
      var kindBtn = e.target.closest('[data-kind]');
      if (kindBtn) { filters.kind = kindBtn.getAttribute('data-kind'); buildChips(); render(); return; }
      var gradeBtn = e.target.closest('[data-grade]');
      if (gradeBtn) { filters.grade = gradeBtn.getAttribute('data-grade'); buildChips(); render(); return; }
    });
    document.addEventListener('change', function (e) {
      var note = e.target.closest('[data-note]');
      if (note) {
        var id = Number(note.getAttribute('data-note'));
        if (note.value.trim()) state.notes[id] = note.value.trim(); else delete state.notes[id];
        saveState();
        return;
      }
      if (e.target.id === 'spoilerToggle') { state.spoiler = e.target.checked; saveState(); render(); }
      if (e.target.id === 'earnedOnly') { filters.earnedOnly = e.target.checked; if (filters.earnedOnly) filters.unearnedOnly = false; render(); }
      if (e.target.id === 'unearnedOnly') { filters.unearnedOnly = e.target.checked; if (filters.unearnedOnly) filters.earnedOnly = false; render(); }
      if (e.target.id === 'importFile' && e.target.files && e.target.files[0]) importProgress(e.target.files[0]);
    });
    var search = document.getElementById('search');
    if (search) search.addEventListener('input', function () { filters.q = search.value; render(); });
    var exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', exportProgress);
    var resetBtn = document.getElementById('resetBtn');
    if (resetBtn) resetBtn.addEventListener('click', function () {
      if (!window.confirm('Reset all earned ticks and notes?')) return;
      state.earned = {}; state.notes = {}; saveState(); render();
    });
    window.addEventListener('hashchange', render);
  }

  function init() {
    loadState();
    applyDemoSeed();
    bindEvents();
    syncControls();
    var earnedOnly = document.getElementById('earnedOnly');
    var unearnedOnly = document.getElementById('unearnedOnly');
    if (earnedOnly) earnedOnly.checked = false;
    if (unearnedOnly) unearnedOnly.checked = false;
    Promise.all([
      fetch('data/trophies.json').then(function (r) { return r.json(); }),
      fetch('data/roadmap.json').then(function (r) { return r.json(); })
    ]).then(function (results) {
      var data = results[0];
      trophies = data.trophies || data;
      roadmap = results[1];
      trophies.forEach(function (t) { byId[t.id] = t; });
      if (roadmap && roadmap.stages) {
        roadmap.stages.forEach(function (stage) {
          (stage.trophy_ids || []).forEach(function (id) { stageOf[id] = stage; });
        });
      }
      render();
    }).catch(function () {
      document.getElementById('view').innerHTML = '<p class="empty">Could not load the trophy data. Serve the app folder over HTTP (for example, node serve.ts) and reload.</p>';
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
