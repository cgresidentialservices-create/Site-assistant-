/* C&G Operatives Portal - add-on for index.html
   Adds: operative Home dashboard, Jobs (list, map, job page), Library (RAMS, method
   statements, policies) with sign-off, and the owner "Staff portal" (library upload,
   job briefs, AI-written RAMS / method statements you can edit and re-issue).
   Operatives never see prices: nothing here reads or stores one. */
(function () {
  'use strict';
  if (window.__portal) return;
  window.__portal = 1;

  // ---------- state ----------
  const PT = { briefs: {}, jdocs: [], lib: [], acks: [], checks: [], tasks: [], err: '' };
  const PV = { jm: 'list', openTask: null, doc: null, back: null, map: null, edit: null, prev: false,
               adm: { briefs: {}, jdocs: [], lib: [], acks: [], err: '', ok: false, busy: false } };
  const OPT = [['mydash', 'Home', 'home'], ['myjobs', 'Jobs', 'jobs'], ['mydocs', 'Library', 'docs'], ['mypay', 'Pay', 'pay'], ['mydetails', 'Details', 'me']];
  const MYTABS = OPT.map(x => x[0]);
  const CATS = [['policy', 'Company policies'], ['rams', 'RAMS'], ['method_statement', 'Method statements'], ['info', 'Information & notes'], ['other', 'Other']];
  const KIND = { rams: 'RAMS', method_statement: 'Method statement' };

  // ---------- small helpers ----------
  const f1 = n => String(Math.round(n * 10) / 10);
  const fh = h => (h < 1 ? Math.round(h * 60) + ' min' : f1(h) + ' h');
  const first = () => ((ME && ME.full_name) || '').split(' ')[0] || 'there';
  const byDue = (a, b) => ((a.due_date || '9999') < (b.due_date || '9999') ? -1 : 1);
  const dirLink = t => t.lat != null && t.lng != null ? 'https://www.google.com/maps/dir/?api=1&destination=' + t.lat + ',' + t.lng
    : t.address ? 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(t.address) : '';
  const fdd = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const nl = s => esc(s || '').replace(/\n/g, '<br>');
  const myTasks = () => (PT.tasks.length ? PT.tasks : OPS.tasks || []);
  const signed = (kind, id, ver) => PT.acks.some(a => a.doc_kind === kind && a.doc_id === id && a.doc_version === ver);
  const jobDocs = jid => PT.jdocs.filter(d => d.job_id === String(jid));
  const stripMoney = s => String(s || '').replace(/£\s?[\d,]+(\.\d+)?/g, '[price removed]');

  const css = document.createElement('style');
  css.textContent = `
  .pseg{display:flex;gap:8px;margin:0 0 12px}
  .pdoc h3{margin:6px 0 8px}.pdoc h4{margin:16px 0 6px;font:600 15px var(--ui)}
  .pdoc ul,.pdoc ol{margin:4px 0 10px;padding-left:20px}.pdoc li{margin:3px 0}
  .pdoc .tw{overflow-x:auto;margin:6px 0 12px}
  .pdoc table{font-size:12px;min-width:480px}
  .pdoc th,.pdoc td{padding:6px 7px;border-bottom:1px solid var(--bd);text-align:left;white-space:normal;vertical-align:top}
  .pdoc th{font-weight:600;background:var(--tint)}
  /* ===== visual refresh (operative + owner) ===== */
  :root{--ac2:#3a46a8;--accent:#d9730d;--grad:linear-gradient(135deg,#1b2150 0%,#2c3a8c 60%,#3a46a8 100%);--r:20px}
  @media(prefers-color-scheme:dark){:root{--grad:linear-gradient(135deg,#1c2247 0%,#27318a 100%)}}
  .card{border-radius:var(--r);border-color:transparent;box-shadow:0 1px 2px rgba(20,24,58,.06),0 10px 30px rgba(20,24,58,.07)}
  @media(prefers-color-scheme:dark){.card{border-color:var(--bd)}}
  h3{font-size:21px}
  button:not(.g){background:var(--grad);color:#fff;box-shadow:0 4px 12px rgba(27,33,80,.22)}
  @media(prefers-color-scheme:dark){button:not(.g){color:#10143a;background:linear-gradient(135deg,#aab5ff,#8e9cff)}}
  nav{margin:0 12px calc(8px + env(safe-area-inset-bottom,0px));border:1px solid var(--bd);border-radius:24px;padding:6px 8px;box-shadow:0 8px 30px rgba(20,24,58,.15)}
  nav button,nav button:not(.g){box-shadow:none;background:none;color:var(--mu)}
  nav button.on{background:var(--tint)!important;color:var(--ac)}
  nav button.on::before{display:none}
  .tag{padding:4px 11px}
  .tag.warn{color:#b45309;background:rgba(217,115,13,.14)}
  .sec{font:700 11px var(--ui);letter-spacing:.14em;text-transform:uppercase;color:var(--mu);margin:20px 2px 8px}
  /* greeting + hero */
  .phi{display:flex;justify-content:space-between;align-items:flex-start;margin:2px 2px 16px}
  .phi h2{margin:0;font:600 26px/1.15 var(--display);letter-spacing:-.2px}
  .phi .mu{margin-top:3px}
  .pav{flex:none;width:42px;height:42px;border-radius:50%;background:var(--grad);color:#fff;display:grid;place-items:center;font:600 17px var(--display)}
  .phero{background:var(--grad);color:#fff;border-radius:26px;padding:20px 20px 18px;margin-bottom:14px;box-shadow:0 14px 34px rgba(27,33,80,.35);position:relative;overflow:hidden}
  .phero::after{content:"";position:absolute;right:-40px;top:-40px;width:160px;height:160px;border-radius:50%;background:rgba(255,255,255,.07)}
  .phero .k{font:700 11px var(--ui);letter-spacing:.16em;text-transform:uppercase;opacity:.75;display:flex;justify-content:space-between;align-items:center}
  .phero .t{font:600 24px/1.2 var(--display);margin:8px 0 2px}
  .phero .s{opacity:.8;font-size:13px}
  .phero .meta{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0 4px}
  .phero .chip{background:rgba(255,255,255,.14);border-radius:99px;padding:6px 12px;font-size:12.5px;font-weight:600}
  .phero .bar{margin:14px 0 0}
  .phero button{background:#fff!important;color:#1b2150!important;box-shadow:none;font-weight:700}
  .phero button.g{background:rgba(255,255,255,.16)!important;color:#fff!important;border:0}
  .phero a{text-decoration:none}
  .phero .live{background:#34d399;color:#053b27;border-radius:99px;padding:3px 10px;font-size:10.5px;font-weight:700}
  .pstats{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:6px}
  .pstat{background:var(--cd);border-radius:var(--r);padding:14px;box-shadow:0 1px 2px rgba(20,24,58,.06),0 8px 22px rgba(20,24,58,.06)}
  .pstat .n{font:600 28px/1.1 var(--display);margin:6px 0 2px;font-variant-numeric:tabular-nums}
  .pstat .i{width:32px;height:32px;border-radius:10px;display:grid;place-items:center;font-size:16px;background:var(--tint)}
  /* job cards */
  .pjob{position:relative;padding-left:20px!important;overflow:hidden;cursor:pointer}
  .pjob::before{content:"";position:absolute;left:0;top:0;bottom:0;width:6px;background:var(--ac2)}
  .pjob.doing::before{background:#10b981}.pjob.late::before{background:var(--bad)}.pjob.done::before{background:var(--bd)}
  .pjob .nn{flex:none;width:28px;height:28px;border-radius:50%;background:var(--grad);color:#fff;font:700 13px var(--ui);display:grid;place-items:center;margin-right:10px}
  .pjob .tt{display:flex;align-items:center}
  .pjob .go{display:flex;gap:8px;margin-top:10px}
  .pjob .go a{text-decoration:none}
  .pseg{background:var(--tint);padding:4px;border-radius:14px;display:inline-flex;gap:2px}
  .pseg button,.pseg button.g{border:0;background:transparent!important;color:var(--mu);box-shadow:none;padding:8px 22px;border-radius:11px}
  .pseg button.s{background:var(--cd)!important;color:var(--ac);box-shadow:0 2px 8px rgba(20,24,58,.12)}
  /* map */
  .pmapwrap{position:relative;margin:0 0 12px}
  .pmap{height:min(62vh,520px);min-height:340px;border-radius:24px;overflow:hidden;border:0;box-shadow:0 10px 30px rgba(20,24,58,.18);margin:0}
  .pmap.sm{height:230px;min-height:0;border-radius:20px}
  .pmapctl{position:absolute;z-index:500;right:10px;top:10px;display:flex;flex-direction:column;gap:8px}
  .pmapctl button,.pmapctl button:not(.g){background:#fff;color:#1b2150;box-shadow:0 3px 10px rgba(0,0,0,.25);padding:9px 12px;font-size:12.5px;border-radius:12px}
  .pmapnote{position:absolute;z-index:500;left:10px;bottom:10px;background:rgba(255,255,255,.92);color:#1b2150;border-radius:99px;padding:6px 12px;font-size:12px;font-weight:600;box-shadow:0 3px 10px rgba(0,0,0,.2)}
  .ppin{width:34px;height:34px;border-radius:50% 50% 50% 4px;transform:rotate(-45deg);background:var(--accent);border:3px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.4);display:grid;place-items:center}
  .ppin b{transform:rotate(45deg);color:#fff;font:700 14px var(--ui)}
  .ppin.doing{background:#10b981}.ppin.me{background:#2563eb;border-radius:50%;transform:none;width:20px;height:20px;box-shadow:0 0 0 8px rgba(37,99,235,.25)}
  .leaflet-popup-content-wrapper{border-radius:16px}.leaflet-popup-content{font:500 13px/1.4 var(--ui);margin:12px 14px}
  .leaflet-popup-content a{font-weight:700}
  /* owner staff portal */
  .ptiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-bottom:12px}
  .ptile{background:var(--grad);color:#fff;border-radius:18px;padding:13px 12px;text-align:left}
  .ptile .n{font:600 26px/1 var(--display)}.ptile .l{font-size:11px;opacity:.8;margin-top:4px;font-weight:600}
  .ptile.alt{background:var(--cd);color:var(--tx);box-shadow:0 1px 2px rgba(20,24,58,.06),0 8px 22px rgba(20,24,58,.06)}.ptile.alt .l{color:var(--mu);opacity:1}
  .pwarn{border-color:var(--bad)!important}
  .pchk{display:flex!important;gap:10px;align-items:flex-start;text-transform:none!important;letter-spacing:0!important;font-size:14px!important;color:var(--tx)!important;font-weight:400!important;margin:6px 0!important}
  .pchk input{width:auto!important;margin:3px 0 0!important}
  .pk{display:grid;grid-template-columns:110px 1fr;gap:4px 10px;font-size:13.5px}.pk dt{color:var(--mu)}.pk dd{margin:0}
  textarea.pbig{min-height:340px;font:400 14px/1.5 ui-monospace,Menlo,monospace}
  `;
  document.head.appendChild(css);
  IC.docs = '<path d="M6 2h9l5 5v15H6z"/><path d="M14 2v6h6M9 13h8M9 17h8"/>';

  // ---------- tiny markdown-lite renderer ----------
  function pMd(t) {
    const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
    const tbl = rows => {
      const cells = r => r.replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());
      const body = rows.filter(r => !cells(r).every(c => /^[-: ]*$/.test(c)));
      if (!body.length) return '';
      const hd = cells(body[0]);
      return '<div class="tw"><table><tr>' + hd.map(c => '<th>' + inl(c) + '</th>').join('') + '</tr>' +
        body.slice(1).map(r => '<tr>' + cells(r).map(c => '<td>' + inl(c) + '</td>').join('') + '</tr>').join('') + '</table></div>';
    };
    let h = '', mode = '', tb = [];
    const close = () => { if (mode === 'ul') h += '</ul>'; if (mode === 'ol') h += '</ol>'; if (mode === 'tb') h += tbl(tb); mode = ''; tb = []; };
    for (const raw of String(t || '').replace(/\r/g, '').split('\n')) {
      const s = raw.trim();
      if (!s) { close(); continue; }
      if (s[0] === '|') { if (mode !== 'tb') { close(); mode = 'tb'; } tb.push(s); continue; }
      if (/^#{1}\s/.test(s)) { close(); h += '<h3>' + inl(s.replace(/^#\s*/, '')) + '</h3>'; continue; }
      if (/^#{2,3}\s/.test(s)) { close(); h += '<h4>' + inl(s.replace(/^#+\s*/, '')) + '</h4>'; continue; }
      if (/^[-*•]\s/.test(s)) { if (mode !== 'ul') { close(); h += '<ul>'; mode = 'ul'; } h += '<li>' + inl(s.slice(2)) + '</li>'; continue; }
      if (/^\d+[.)]\s/.test(s)) { if (mode !== 'ol') { close(); h += '<ol>'; mode = 'ol'; } h += '<li>' + inl(s.replace(/^\d+[.)]\s*/, '')) + '</li>'; continue; }
      close(); h += '<p>' + inl(s) + '</p>';
    }
    close();
    return h;
  }

  // ---------- maps (Leaflet from cdnjs, OpenStreetMap tiles) ----------
  let LLp = null;
  function pLeaflet() {
    if (window.L) return Promise.resolve();
    if (LLp) return LLp;
    LLp = new Promise((res, rej) => {
      const l = document.createElement('link'); l.rel = 'stylesheet';
      l.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(l);
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
      s.onload = res; s.onerror = () => { LLp = null; rej(new Error('map')); }; document.head.appendChild(s);
    });
    return LLp;
  }
  // job locations: use saved lat/lng, otherwise look the address up once and remember it on this phone
  let GEO = {}; try { GEO = JSON.parse(localStorage.getItem('pgeo') || '{}'); } catch (e) { }
  const gkey = a => String(a || '').trim().toLowerCase();
  const pCoord = t => (t.lat != null && t.lat !== '' && t.lng != null && t.lng !== '') ? { lat: +t.lat, lng: +t.lng } : (GEO[gkey(t.address)] || null);
  let geoBusy = false;
  async function pGeoFill(tasks) {
    if (geoBusy) return false; geoBusy = true; let changed = false;
    try {
      const need = [...new Set(tasks.filter(t => !pCoord(t) && t.address).map(t => gkey(t.address)))].filter(a => GEO[a] !== 0).slice(0, 8);
      for (const a of need) {
        try {
          const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=gb&q=' + encodeURIComponent(a)), j = await r.json();
          if (j[0]) { GEO[a] = { lat: +j[0].lat, lng: +j[0].lon }; changed = true; } else GEO[a] = 0;
        } catch (e) { break; }
        await new Promise(r => setTimeout(r, 1100));
      }
      try { localStorage.setItem('pgeo', JSON.stringify(GEO)); } catch (e) { }
    } finally { geoBusy = false; }
    return changed;
  }
  const pinIcon = (n, doing) => L.divIcon({ className: '', html: `<div class="ppin${doing ? ' doing' : ''}"><b>${n}</b></div>`, iconSize: [34, 34], iconAnchor: [6, 34], popupAnchor: [10, -34] });
  async function pMapInit(id, pts, opt) {
    opt = opt || {};
    try { await pLeaflet(); } catch (e) {
      const el = $('#' + id); if (el) el.innerHTML = '<p class="mu" style="padding:14px">The map could not load. Use the Directions links instead.</p>'; return;
    }
    const el = $('#' + id); if (!el || !window.L || !pts.length) return;
    const m = L.map(el, { scrollWheelZoom: false, zoomControl: !opt.small, attributionControl: true }).setView([pts[0].lat, pts[0].lng], 15);
    const street = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19, subdomains: 'abcd', attribution: '© OpenStreetMap © CARTO' }),
      sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19, attribution: 'Imagery © Esri' });
    street.on('tileerror', () => { if (!m.__fb) { m.__fb = 1; m.removeLayer(street); L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m); } });
    street.addTo(m);
    const b = [];
    pts.forEach((p, i) => {
      const mk = L.marker([p.lat, p.lng], { icon: pinIcon(p.n || (pts.length > 1 ? i + 1 : '★'), p.doing) }).addTo(m);
      if (p.html) mk.bindPopup(p.html); b.push([p.lat, p.lng]);
    });
    if (b.length > 1) m.fitBounds(b, { padding: [40, 40] });
    PV.map = m; PV.mapSat = false; PV.street = street; PV.sat = sat;
    window.pSat = function () { PV.mapSat = !PV.mapSat; if (PV.mapSat) { m.removeLayer(street); sat.addTo(m); } else { m.removeLayer(sat); street.addTo(m); } const bt = $('#psatbtn'); if (bt) bt.textContent = PV.mapSat ? '🗺 Street' : '🛰 Satellite'; };
    window.pFit = function () { if (b.length > 1) m.fitBounds(b, { padding: [40, 40] }); else m.setView(b[0], 16); };
    [250, 700].forEach(ms => setTimeout(() => m.invalidateSize(), ms));
  }
  window.pLocate = async function () {
    try {
      const p = await getPos();
      if (PV.map && window.L) {
        if (PV.me) PV.map.removeLayer(PV.me);
        PV.me = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<div class="ppin me"></div>', iconSize: [20, 20] }) }).addTo(PV.map).bindPopup('You are here');
        PV.map.panTo([p.lat, p.lng]);
      }
    } catch (e) { stat('Could not get your location: ' + (e.message || e)); setTimeout(() => stat(''), 3000); }
  };

  // ---------- data loading ----------
  async function pLoad() {
    if (!sb || !ME) return;
    try {
      const u = ME.id;
      const q = await Promise.all([
        sb.from('job_briefs').select('*'),
        sb.from('job_documents').select('*').eq('status', 'published'),
        sb.from('library_docs').select('*').order('title'),
        sb.from('doc_acks').select('*').eq('user_id', u),
        sb.from('checkins').select('*').eq('user_id', u).order('in_at', { ascending: false }).limit(300),
        sb.from('tasks').select('*').eq('user_id', u).order('created_at', { ascending: false }).limit(300)]);
      const bad = q.find(r => r.error);
      PT.err = bad ? bad.error.message : '';
      PT.briefs = {}; (q[0].data || []).forEach(b => { PT.briefs[b.job_id] = b; });
      PT.jdocs = q[1].data || []; PT.lib = q[2].data || []; PT.acks = q[3].data || [];
      PT.checks = q[4].data || []; PT.tasks = q[5].data || [];
    } catch (e) { PT.err = String(e.message || e); }
    PT.loaded = true;
  }
  async function pAdmLoad() {
    const A = PV.adm; if (!sb) return;
    try {
      const q = await Promise.all([sb.from('job_briefs').select('*'), sb.from('job_documents').select('*').order('updated_at', { ascending: false }),
        sb.from('library_docs').select('*').order('title'), sb.from('doc_acks').select('*')]);
      const bad = q.find(r => r.error); A.err = bad ? bad.error.message : ''; A.ok = !bad;
      A.briefs = {}; (q[0].data || []).forEach(b => { A.briefs[b.job_id] = b; });
      A.jdocs = q[1].data || []; A.lib = q[2].data || []; A.acks = q[3].data || [];
    } catch (e) { A.err = String(e.message || e); }
    A.tried = true;
  }
  const _loadOp = window.loadOp;
  window.loadOp = async function () { await _loadOp.apply(this, arguments); await pLoad(); await ctLoad(); };
  const _loadOwner = window.loadOwner;
  window.loadOwner = async function () { await _loadOwner.apply(this, arguments); await pAdmLoad(); await ctLoad(); setTimeout(pAuto, 1500); };

  // ---------- operative: stats ----------
  function pStats() {
    const T = myTasks(), dur = c => (new Date(c.out_at) - new Date(c.in_at)) / 36e5;
    const done = PT.checks.filter(c => c.out_at && !c.rejected && dur(c) > 0 && dur(c) < 20);
    const ws = wkStart(), wk = done.filter(c => iso(c.in_at) >= ws);
    const sum = a => a.reduce((x, y) => x + y, 0);
    const byTask = {};
    done.forEach(c => { if (!c.task_id) return; const o = byTask[c.task_id] || (byTask[c.task_id] = { h: 0, n: 0 }); o.h += dur(c); o.n++; });
    const dt = T.filter(t => t.status === 'done'), tH = dt.map(t => byTask[t.id]).filter(Boolean);
    const jobs = {};
    dt.forEach(t => { const o = byTask[t.id]; if (!o) return; const k = t.job_name || t.title, j = jobs[k] || (jobs[k] = { h: 0, n: 0 }); j.h += o.h; j.n++; });
    return {
      weekH: sum(wk.map(dur)), weekDays: new Set(wk.map(c => iso(c.in_at))).size,
      avgVisit: done.length ? sum(done.map(dur)) / done.length : null,
      avgTask: tH.length ? sum(tH.map(x => x.h)) / tH.length : null,
      doneN: dt.length, visits: done.length,
      jobs: Object.entries(jobs).map(([k, v]) => ({ name: k, n: v.n, h: v.h, avg: v.h / v.n })).sort((a, b) => b.h - a.h).slice(0, 6)
    };
  }
  function pPending() {
    const jobIds = new Set(myTasks().filter(t => t.status !== 'done' && t.job_id != null).map(t => String(t.job_id)));
    const a = PT.jdocs.filter(d => jobIds.has(d.job_id) && d.requires_ack && !signed('job', d.id, d.version))
      .map(d => ({ kind: 'job', id: d.id, title: d.title, upd: d.version > 1 }));
    const b = PT.lib.filter(d => d.requires_ack && !signed('library', d.id, d.version)).map(d => ({ kind: 'library', id: d.id, title: d.title, upd: d.version > 1 }));
    return a.concat(b);
  }

  // ---------- operative: Home ----------
  function dashView() {
    const v = $('#view'), T = myTasks(), open = (PT.checks.find(c => !c.out_at) || (OPS.checks || []).find(c => !c.out_at)),
      act = T.filter(t => t.status !== 'done').sort(byDue), td = today(), next = act.find(t => !t.due_date || t.due_date >= td) || act[0],
      st = pStats(), pend = pPending(), hr = new Date().getHours(), gr = hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening';
    const brief = t => PT.briefs[String(t.job_id)] || {};
    const dueTxt = t => !t.due_date ? 'No date set' : t.due_date === td ? 'Today' : fdate(t.due_date), late = t => t.due_date && t.due_date < td && t.status !== 'done';
    const nCo = next && pCoord(next);
    v.innerHTML = `<div class="phi"><div><h2>${gr},<br>${esc(first())}</h2><div class="mu">${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div><div class="pav">${esc(first().charAt(0).toUpperCase())}</div></div>`
      + (PT.err ? `<div class="card"><span class="err">Portal data is not set up yet (${esc(PT.err)}). Tell your boss.</span></div>` : '')
      + (open ? `<div class="phero" style="background:linear-gradient(135deg,#047857,#10b981)"><div class="k"><span>On site now</span><span class="live">● LIVE</span></div><div class="t">${esc(open.job_name || 'job')}</div><div class="s">Since ${fdt(open.in_at)}</div><div class="meta">${distTag(open.in_dist_m, 150)}</div><div class="bar"><button onclick="doOut()">Check out – I'm leaving</button></div><p class="mu" id="om" style="color:#fff;opacity:.8"></p></div>` : '')
      + ctCard()
      + (pend.length ? `<div class="card pwarn"><div class="row"><b>✍️ ${pend.length} document${pend.length > 1 ? 's' : ''} to read and sign</b></div><div class="mu">${pend.slice(0, 3).map(p => esc(p.title) + (p.upd ? ' (updated)' : '')).join(' · ')}${pend.length > 3 ? ' …' : ''}</div><div class="bar"><button class="s" onclick="pGo('mydocs')">Open library</button></div></div>` : '')
      + (next ? `<div class="phero"><div class="k"><span>Next job</span>${next.status === 'doing' ? '<span class="live">IN PROGRESS</span>' : ''}</div>
          <div class="t">${esc(next.title)}</div><div class="s">${esc(next.job_name || '')}</div>
          <div class="meta"><span class="chip">📅 ${dueTxt(next)}</span>${brief(next).start_time ? `<span class="chip">⏰ ${esc(brief(next).start_time)}</span>` : ''}${brief(next).est_days ? `<span class="chip">⏳ ~${esc(brief(next).est_days)} day${+brief(next).est_days === 1 ? '' : 's'}</span>` : ''}</div>
          ${next.address ? `<div class="s">📍 ${esc(next.address)}</div>` : ''}
          <div class="bar"><button onclick="pOpenJob('${next.id}')">Open job</button>${dirLink(next) ? `<a href="${dirLink(next)}" target="_blank" rel="noopener"><button class="g" type="button">Directions</button></a>` : ''}</div></div>
          ${nCo ? '<div id="pmapH" class="pmap sm"></div><div style="height:12px"></div>' : ''}`
        : '<div class="card mu">No jobs booked yet. Your boss will send them here.</div>')
      + `<div class="sec">Your numbers</div><div class="pstats">
          <div class="pstat"><div class="i">🕒</div><div class="n">${fh(st.weekH)}</div><div class="mu">This week · ${st.weekDays} day${st.weekDays === 1 ? '' : 's'} on site</div></div>
          <div class="pstat"><div class="i">✅</div><div class="n">${st.doneN}</div><div class="mu">Jobs done · ${st.visits} visit${st.visits === 1 ? '' : 's'}</div></div>
          <div class="pstat"><div class="i">📈</div><div class="n">${st.avgTask == null ? '–' : fh(st.avgTask)}</div><div class="mu">Average per job</div></div>
          <div class="pstat"><div class="i">📍</div><div class="n">${st.avgVisit == null ? '–' : fh(st.avgVisit)}</div><div class="mu">Average visit</div></div></div>`
      + (act.length > 1 ? `<div class="sec">Coming up</div>${act.filter(t => t !== next).slice(0, 6).map(t => `<div class="card pjob ${t.status === 'doing' ? 'doing' : late(t) ? 'late' : ''}" onclick="pOpenJob('${t.id}')" style="padding-top:13px;padding-bottom:13px;margin-bottom:8px"><div class="row"><span><b>${esc(t.title)}</b><br><span class="mu">${esc(t.job_name || '')}</span></span><span class="tag${late(t) ? ' bad' : ''}">${dueTxt(t)}</span></div></div>`).join('')}<div class="bar"><button class="g s" onclick="pGo('myjobs')">See all jobs & map →</button></div>` : '')
      + (st.jobs.length ? `<div class="sec">Time on jobs</div><div class="card"><table>${st.jobs.map(j => `<tr><td>${esc(j.name)}<br><span class="mu">${j.n} task${j.n > 1 ? 's' : ''} · ${fh(j.h)} total</span></td><td>${fh(j.avg)}<br><span class="mu">avg / task</span></td></tr>`).join('')}</table></div>` : '')
      + `<p class="mu" style="text-align:center;margin-top:18px">🔒 Your location is recorded only when you tap Check in or Check out.</p>`;
    if (nCo) pMapInit('pmapH', [{ lat: nCo.lat, lng: nCo.lng, n: '★', doing: next.status === 'doing', html: `<b>${esc(next.title)}</b><br>${esc(next.address || '')}` }], { small: true });
    else if (next && next.address && !pCoord(next)) pGeoFill([next]).then(ch => { if (ch && mode === 'operative' && tab === 'mydash' && !PV.doc) render(); });
  }

  // ---------- operative: Jobs (list / map / job page) ----------
  function jobsList() {
    const v = $('#view'), T = myTasks(), open = PT.checks.find(c => !c.out_at) || (OPS.checks || []).find(c => !c.out_at),
      act = T.filter(t => t.status !== 'done').sort(byDue), dn = T.filter(t => t.status === 'done').slice(0, 8), td = today();
    const pins = act.filter(t => pCoord(t)), nopin = act.filter(t => !pCoord(t));
    const num = t => act.indexOf(t) + 1;
    const card = t => {
      const b = PT.briefs[String(t.job_id)] || {}, ds = jobDocs(t.job_id), need = ds.filter(d => d.requires_ack && !signed('job', d.id, d.version)).length,
        late = t.due_date && t.due_date < td, dl = dirLink(t);
      return `<div class="card pjob ${t.status === 'doing' ? 'doing' : late ? 'late' : ''}" onclick="pOpenJob('${t.id}')"><div class="row"><div class="tt"><span class="nn">${num(t)}</span><b>${esc(t.title)}</b></div><span class="tag${t.status === 'doing' ? ' ok' : late ? ' bad' : ''}">${t.status === 'doing' ? 'in progress' : late ? 'overdue' : 'to do'}</span></div>
        <div class="mu" style="margin-top:6px">${esc(t.job_name || '')}</div>${t.address ? `<div class="mu">📍 ${esc(t.address)}</div>` : ''}
        <div style="margin-top:8px;font-weight:600">${t.due_date ? fdate(t.due_date) : 'No date'}${b.start_time ? ' · ' + esc(b.start_time) : ''}${b.est_days ? ' · ~' + esc(b.est_days) + ' day' + (+b.est_days === 1 ? '' : 's') : ''}</div>
        ${ds.length ? `<div style="margin-top:8px">${need ? `<span class="tag bad">${need} to sign</span>` : '<span class="tag ok">✓ RAMS signed</span>'}</div>` : ''}
        ${dl ? `<div class="go"><a href="${dl}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><button class="s" type="button">Directions</button></a></div>` : ''}</div>`;
    };
    v.innerHTML = `<div class="phi"><div><h2>My jobs</h2><div class="mu">${act.length} to do${dn.length ? ' · ' + dn.length + ' done' : ''}</div></div><div class="pseg"><button class="${PV.jm === 'list' ? 's' : 'g s'}" onclick="pMode('list')">List</button><button class="${PV.jm === 'map' ? 's' : 'g s'}" onclick="pMode('map')">Map</button></div></div>`
      + (open ? `<div class="phero" style="background:linear-gradient(135deg,#047857,#10b981)"><div class="k"><span>On site now</span><span class="live">● LIVE</span></div><div class="t">${esc(open.job_name || 'job')}</div><div class="s">Since ${fdt(open.in_at)}</div><div class="bar"><button onclick="doOut()">Check out – I'm leaving</button></div></div>` : '') + `<p class="mu" id="om"></p>`
      + (PV.jm === 'map'
        ? (pins.length ? `<div class="pmapwrap"><div id="pmap" class="pmap"></div><div class="pmapctl"><button id="psatbtn" onclick="pSat()">🛰 Satellite</button><button onclick="pLocate()">📍 Me</button><button onclick="pFit()">⤢ All</button></div><div class="pmapnote">${pins.length} job${pins.length > 1 ? 's' : ''} on map</div></div>`
          : `<div class="card mu">${act.some(t => t.address) ? 'Finding your job locations…' : 'None of your jobs have an address yet. Ask your boss to add one.'}</div>`)
          + (nopin.length ? `<div class="sec">Not on the map yet</div>` + nopin.map(card).join('') : '') + `<div class="sec">All jobs</div>` + pins.map(card).join('')
        : (act.length ? act.map(card).join('') : '<div class="card mu">No jobs right now. Your boss will send you jobs here.</div>'))
      + (dn.length ? `<details><summary>Done (${dn.length})</summary>${dn.map(t => `<p class="mu" onclick="pOpenJob('${t.id}')">✓ ${esc(t.title)} · ${esc(t.job_name || '')}</p>`).join('')}</details>` : '');
    if (PV.jm === 'map' && pins.length) pMapInit('pmap', pins.map(t => { const c = pCoord(t); return { lat: c.lat, lng: c.lng, n: num(t), doing: t.status === 'doing', html: `<b>${esc(t.title)}</b><br>${esc(t.job_name || '')}<br>${t.due_date ? fdate(t.due_date) : ''}<br><a onclick="pOpenJob('${t.id}')">Open job →</a>${dirLink(t) ? ` &nbsp; <a href="${dirLink(t)}" target="_blank" rel="noopener">Directions</a>` : ''}` }; }));
    if (nopin.some(t => t.address)) pGeoFill(nopin).then(ch => { if (ch && mode === 'operative' && tab === 'myjobs' && !PV.openTask && !PV.doc) render(); });
  }
  function jobPage(t) {
    const v = $('#view'), b = PT.briefs[String(t.job_id)] || {}, ds = jobDocs(t.job_id), open = PT.checks.find(c => !c.out_at) || (OPS.checks || []).find(c => !c.out_at),
      here = open && open.task_id === t.id, need = ds.filter(d => d.requires_ack && !signed('job', d.id, d.version)), ml = mapLink(t), dl = dirLink(t), hasPin = !!pCoord(t);
    const rows = [['When', (t.due_date ? fdate(t.due_date) : 'Not set') + (b.start_time ? ', start ' + esc(b.start_time) : '')], ['Expected', b.est_days ? '~' + esc(b.est_days) + ' day' + (+b.est_days === 1 ? '' : 's') : ''],
      ['Address', esc(t.address || '')], ['Site contact', b.site_contact ? esc(b.site_contact) + (b.site_contact_phone ? ` · <a href="tel:${esc(b.site_contact_phone)}">${esc(b.site_contact_phone)}</a>` : '') : '']].filter(r => r[1]);
    v.innerHTML = `<div class="row"><button class="g s" onclick="pBack()">← Back</button><span class="tag${t.status === 'doing' ? ' ok' : ''}">${t.status === 'done' ? 'done' : t.status === 'doing' ? 'in progress' : 'to do'}</span></div>
      <h3 style="margin-top:12px">${esc(t.title)}</h3><div class="mu" style="margin:-6px 0 10px">${esc(t.job_name || '')}</div>
      <p class="mu" id="om"></p>
      ${need.length ? `<div class="card pwarn"><b>Read and sign the RAMS before you start</b><div class="mu">${need.map(d => esc(d.title)).join(' · ')}</div></div>` : ''}
      <div class="card"><dl class="pk">${rows.map(r => `<dt>${r[0]}</dt><dd>${r[1]}</dd>`).join('')}</dl>
        <div class="bar">${dl ? `<a href="${dl}" target="_blank" rel="noopener"><button class="s" type="button">Directions</button></a>` : ''}${ml ? `<a href="${ml}" target="_blank" rel="noopener"><button class="g s" type="button">Open in Maps</button></a>` : ''}</div></div>
      ${hasPin ? '<div id="pmap1" class="pmap sm"></div>' : ''}
      ${t.details ? `<div class="card"><h3>Task</h3><p style="margin:0">${nl(t.details)}</p></div>` : ''}
      ${b.hazards ? `<div class="card pwarn"><h3>Known hazards</h3><p style="margin:0">${nl(b.hazards)}</p></div>` : ''}
      ${b.access_notes ? `<div class="card"><h3>Access & parking</h3><p style="margin:0">${nl(b.access_notes)}</p></div>` : ''}
      ${b.site_notes ? `<div class="card"><h3>Site notes</h3><p style="margin:0">${nl(b.site_notes)}</p></div>` : ''}
      ${b.materials ? `<div class="card"><h3>Materials & tools</h3><p style="margin:0">${nl(b.materials)}</p></div>` : ''}
      <div class="card"><h3>RAMS & method statements</h3>${ds.length ? ds.map(d => { const s = signed('job', d.id, d.version); return `<div class="row" style="margin-bottom:8px"><span><b>${esc(d.title)}</b><br><span class="mu">${KIND[d.kind]} · v${d.version}${d.version > 1 ? ' (updated)' : ''}</span></span>${d.requires_ack ? (s ? '<span class="tag ok">✓ signed</span>' : '<span class="tag bad">sign</span>') : ''}<button class="g s" onclick="pOpenDoc('job','${d.id}')">Open</button></div>`; }).join('') : '<span class="mu">Nothing issued for this job yet. Ask your boss before you start.</span>'}
        <div class="bar"><button class="g s" onclick="pGo('mydocs')">Company policies</button></div></div>
      ${t.status !== 'done' ? `<div class="card"><textarea id="tn_${t.id}" rows="2" placeholder="Note for your boss (optional)"></textarea>
        <div class="bar">${!open && t.job_name ? (need.length ? `<button class="s" onclick="pOpenDoc('job','${need[0].id}')">Sign RAMS to check in</button>` : `<button class="s" onclick="doIn('${t.id}')">Check in</button>`) : ''}${t.status === 'todo' ? `<button class="g s" onclick="setTask('${t.id}','doing')">Start</button>` : ''}${here ? '' : `<button class="g s" onclick="setTask('${t.id}','done')">✓ Done</button>`}</div></div>` : ''}`;
    if (hasPin) { const c = pCoord(t); pMapInit('pmap1', [{ lat: c.lat, lng: c.lng, n: '★', doing: t.status === 'doing', html: esc(t.address || t.title) }], { small: true }); }
    else if (t.address) pGeoFill([t]).then(ch => { if (ch && mode === 'operative' && PV.openTask === t.id && !PV.doc) render(); });
  }

  // ---------- documents: reader, sign, library ----------
  function docPage() {
    const v = $('#view'), { kind, id } = PV.doc, d = kind === 'job' ? PT.jdocs.find(x => x.id === id) : PT.lib.find(x => x.id === id);
    if (!d) { v.innerHTML = '<div class="card mu">That document is no longer available.</div><button class="g" onclick="pBack()">Back</button>'; return; }
    const s = signed(kind, id, d.version);
    v.innerHTML = `<div class="row"><button class="g s" onclick="pBack()">← Back</button><span class="tag">${kind === 'job' ? KIND[d.kind] : esc((CATS.find(c => c[0] === d.category) || [0, 'Document'])[1])} · v${d.version}</span></div>
      ${d.change_note && d.version > 1 ? `<div class="card pwarn" style="margin-top:12px"><b>Updated:</b> ${esc(d.change_note)}</div>` : ''}
      <div class="card pdoc" style="margin-top:12px">${kind === 'job' ? pMd(d.content) : `<h3>${esc(d.title)}</h3>${d.description ? `<p>${nl(d.description)}</p>` : ''}<div class="bar"><button class="s" onclick="pLibOpen('${d.id}')">Open file</button></div>`}</div>
      ${d.requires_ack ? (s ? `<div class="card"><span class="tag ok">✓ You signed this</span></div>`
        : `<div class="card"><label class="pchk"><input type="checkbox" id="sg_ok"> <span>I have read and understood this document and will follow it on site.</span></label><p class="err" id="sg_err"></p><button onclick="pSign('${kind}','${d.id}',${d.version})">Sign</button></div>`) : ''}`;
  }
  window.pSign = async function (kind, id, ver) {
    const cb = $('#sg_ok'), er = $('#sg_err');
    if (!cb || !cb.checked) { if (er) er.textContent = 'Tick the box to confirm you have read it.'; return; }
    const { error } = await sb.from('doc_acks').upsert({ user_id: ME.id, doc_kind: kind, doc_id: id, doc_version: ver, signed_name: ME.full_name || ME.email }, { onConflict: 'user_id,doc_kind,doc_id,doc_version', ignoreDuplicates: true });
    if (error) { if (er) er.textContent = error.message; return; }
    await pLoad(); render();
  };
  window.pLibOpen = async function (id) {
    const d = (mode === 'owner' ? PV.adm.lib : PT.lib).find(x => x.id === id); if (!d) return;
    const w = window.open('', '_blank');
    const { data, error } = await sb.storage.from('company-library').createSignedUrl(d.storage_path, 300);
    if (error || !data) { if (w) w.close(); stat('Could not open: ' + (error ? error.message : 'no link')); return; }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  };
  function libraryView() {
    const v = $('#view'), pend = pPending(), T = myTasks(), jobIds = new Set(T.filter(t => t.status !== 'done' && t.job_id != null).map(t => String(t.job_id)));
    const myJD = PT.jdocs.filter(d => jobIds.has(d.job_id)), nm = jid => { const t = T.find(x => String(x.job_id) === jid); return t ? t.job_name : ''; };
    const row = (kind, d, sub) => { const s = d.requires_ack ? signed(kind, d.id, d.version) : null; return `<div class="row" style="margin-bottom:10px"><span><b>${esc(d.title)}</b><br><span class="mu">${sub}</span></span>${s === false ? '<span class="tag bad">sign</span>' : s ? '<span class="tag ok">✓</span>' : ''}<button class="g s" onclick="pOpenDoc('${kind}','${d.id}')">Open</button></div>`; };
    v.innerHTML = '<h3>Library</h3>' + ctCard() + ctListCard() + (PT.err ? `<div class="card"><span class="err">${esc(PT.err)}</span></div>` : '')
      + (pend.length ? `<div class="card pwarn"><b>Needs your signature (${pend.length})</b>${pend.map(p => `<div class="row" style="margin-top:8px"><span>${esc(p.title)}${p.upd ? ' <span class="mu">(updated)</span>' : ''}</span><button class="s" onclick="pOpenDoc('${p.kind}','${p.id}')">Read & sign</button></div>`).join('')}</div>` : '')
      + (myJD.length ? `<div class="card"><h3>My job documents</h3>${myJD.map(d => row('job', d, esc(nm(d.job_id)) + ' · ' + KIND[d.kind] + ' · v' + d.version)).join('')}</div>` : '')
      + CATS.map(([k, l]) => { const ds = PT.lib.filter(d => d.category === k); return ds.length ? `<div class="card"><h3>${l}</h3>${ds.map(d => row('library', d, esc(d.description || '') || fdd(d.created_at))).join('')}</div>` : ''; }).join('')
      + (!PT.lib.length && !myJD.length ? '<div class="card mu">Nothing here yet. Your boss will add company policies, RAMS and method statements.</div>' : '');
  }

  // ---------- navigation ----------
  window.pGo = function (t) { FM = null; PV.ct = null; PV.openTask = null; PV.doc = null; PV.edit = null; tab = t; render(); const v = $('#view'); if (v) v.scrollTop = 0; };
  window.pMode = function (m) { PV.jm = m; render(); };
  window.pOpenJob = function (id) { PV.ct = null; PV.openTask = id; PV.doc = null; if (tab !== 'myjobs') { PV.back = tab; tab = 'myjobs'; } else PV.back = null; render(); $('#view').scrollTop = 0; };
  window.pOpenDoc = function (kind, id) { PV.back = PV.openTask ? 'job' : tab; PV.doc = { kind, id }; render(); $('#view').scrollTop = 0; };
  window.pBack = function () {
    if (PV.doc) { PV.doc = null; if (PV.back === 'job') { render(); } else { tab = PV.back || 'mydocs'; PV.back = null; render(); } }
    else { PV.openTask = null; if (PV.back) { tab = PV.back; PV.back = null; } render(); }
    $('#view').scrollTop = 0;
  };

  // ============================================================
  //  OWNER: AI writer, library, job briefs, editor
  // ============================================================
  const PSYS = `You write UK construction health and safety paperwork (RAMS and method statements) for C&G Residential Services, a small domestic building and property maintenance firm in Essex and East London. Write for tradespeople: short, practical, specific to the job given.
FORMAT (strict): plain text only. A line starting "# " is the document title; "## " is a section heading; "- " is a bullet; "1. " is a numbered step; tables use pipe rows like "| Hazard | Who is at risk | Controls | Risk before | Risk after |" with a header row. Use **bold** sparingly. No code fences, no preamble, no closing commentary.
RULES: Never include prices, costs, client names or phone numbers. Where a site-specific fact is not known, write [CONFIRM ON SITE] rather than guessing. Rate risk Low / Medium / High. Reflect UK law where relevant: Health and Safety at Work Act 1974, Management of Health and Safety at Work Regulations 1999, Work at Height Regulations 2005, COSHH 2002, Control of Asbestos Regulations 2012, Manual Handling Operations Regulations 1992, Electricity at Work Regulations 1989, Gas Safe registration for gas work. Always include an asbestos stop-work rule for older properties. Keep it complete but concise (roughly 600 to 900 words).`;

  function jobScope(j) {
    const notes = (S.notes || []).filter(n => n.job === j.id).map(n => n.text),
      qs = (S.quotes || []).filter(q => q.job === j.id).map(q => (q.lines || []).map(l => ((l.qty || '') + ' ' + (l.unit || '') + ' ' + (l.desc || '')).trim()).join('; '));
    return stripMoney([...qs, ...notes].join('\n')).slice(0, 3000);
  }
  function genPrompt(j, kind, note, existing) {
    const b = PV.adm.briefs[j.id] || {};
    const facts = `JOB: ${j.name}\nSITE ADDRESS: ${j.address || '[CONFIRM ON SITE]'}\nSKILLS / TRADES NEEDED: ${(j.needs || []).join(', ') || 'not stated'}\nSCOPE OF WORK (from accepted quote and notes):\n${jobScope(j) || 'Not recorded - infer sensibly from the job name and flag assumptions.'}\nEXPECTED DURATION: ${b.est_days ? b.est_days + ' days' : '[CONFIRM ON SITE]'}\nKNOWN HAZARDS: ${stripMoney(b.hazards) || 'none recorded'}\nMATERIALS / TOOLS: ${stripMoney(b.materials) || 'not recorded'}\nACCESS: ${stripMoney(b.access_notes) || 'not recorded'}`;
    const spec = kind === 'rams'
      ? 'Write a RAMS (risk assessment and method statement summary) with these sections: ## Job details; ## Hazards and risk assessment (a table with columns Hazard | Who is at risk | Controls | Risk before | Risk after, covering every realistic hazard for this scope such as working at height, manual handling, dust and RPE, noise and vibration, tools and electrics, hazardous substances/COSHH, slips and trips, asbestos in older buildings, working in occupied homes, fire, waste); ## PPE required; ## COSHH and substances; ## Welfare, first aid and emergency arrangements; ## Stop-work triggers; ## Operative sign-off.'
      : 'Write a step-by-step method statement with these sections: ## Scope of works; ## Sequence of works (numbered steps in the order the work is actually done, including setting up, protecting the property, the work itself, testing/checking, clearing up and handover); ## Tools, plant and materials; ## Protecting the client\'s property and occupants; ## Competence and supervision; ## Waste and environmental controls; ## Completion and handover; ## Stop-work triggers.';
    const title = (kind === 'rams' ? 'RAMS' : 'Method statement') + ' - ' + j.name;
    return existing
      ? `Revise the document below. Requested change: ${note || 'general review'}\nKeep the same format and sections, update everything affected by the change, and return the FULL updated document.\n\n${facts}\n\nCURRENT DOCUMENT:\n${existing}`
      : `${spec}\nStart with a title line "# ${title}".\n\n${facts}${note ? '\nEXTRA INSTRUCTIONS: ' + note : ''}`;
  }
  async function pAI(prompt) {
    const call = async body => { const { data, error } = await sb.functions.invoke('assistant', { body }); if (error) throw new Error(await aiErr(error)); if (!data || data.error) throw new Error((data && data.error && (data.error.message || data.error)) || 'No reply'); return data; };
    const msg = [{ role: 'user', content: prompt }];
    let data;
    try { data = await call({ system: PSYS, messages: msg }); } catch (e) { data = await call({ system: PSYS, messages: msg, tools: typeof AIT !== 'undefined' ? AIT : [] }); }
    const tx = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!tx) throw new Error('The assistant sent back nothing. Try again.');
    return tx.replace(/^```[a-z]*\n?|```$/gm, '').trim();
  }
  async function pGenJob(j, kinds) {
    for (const kind of kinds) {
      stat('Writing ' + (kind === 'rams' ? 'RAMS' : 'method statement') + ' for ' + j.name + '…');
      const content = await pAI(genPrompt(j, kind));
      const { error } = await sb.from('job_documents').insert({ job_id: j.id, kind, title: (kind === 'rams' ? 'RAMS - ' : 'Method statement - ') + j.name, content, status: 'draft', ai_generated: true });
      if (error) throw new Error(error.message);
    }
  }
  const liveJobs = () => (S.jobs || []).filter(j => j.status !== 'complete');
  const missingFor = j => ['rams', 'method_statement'].filter(k => !PV.adm.jdocs.some(d => d.job_id === j.id && d.kind === k));
  window.pGenOne = async function (jid) {
    const j = J(jid); if (!j || PV.adm.busy) return; PV.adm.busy = true;
    try { await pGenJob(j, missingFor(j)); await pAdmLoad(); stat('✓ Drafts ready - check them, then publish'); } catch (e) { stat('Could not generate: ' + (e.message || e)); }
    PV.adm.busy = false; render();
  };
  window.pGenAll = async function () {
    if (PV.adm.busy) return; PV.adm.busy = true;
    try { for (const j of liveJobs()) { const m = missingFor(j); if (m.length) { await pGenJob(j, m); await pAdmLoad(); render(); } } stat('✓ Drafts ready - check them, then publish'); } catch (e) { stat('Stopped: ' + (e.message || e)); }
    PV.adm.busy = false; render();
  };
  let autoRan = false;
  async function pAuto() {
    try { if (autoRan || localStorage.getItem('pAuto') !== '1' || !PV.adm.ok || PV.adm.busy) return; } catch (e) { return; }
    autoRan = true;
    if (liveJobs().some(j => missingFor(j).length)) window.pGenAll();
  }
  window.pAutoToggle = function () { try { localStorage.setItem('pAuto', localStorage.getItem('pAuto') === '1' ? '0' : '1'); } catch (e) { } render(); };

  // ---------- owner: Staff portal screen ----------
  const signees = jid => { const ids = [...new Set((OPS.tasks || []).filter(t => String(t.job_id) === String(jid)).map(t => t.user_id))]; return ids.map(id => PROFS.find(p => p.id === id)).filter(Boolean); };
  const pname = p => (p && (p.full_name || p.email)) || '?';
  function adminView() {
    const v = $('#view'), A = PV.adm, jobs = liveJobs(), miss = jobs.filter(j => missingFor(j).length), auto = (() => { try { return localStorage.getItem('pAuto') === '1'; } catch (e) { return false; } })();
    const operatives = PROFS.filter(p => p.role === 'operative' && p.approved);
    const stTag = (j, k) => { const d = A.jdocs.find(x => x.job_id === j.id && x.kind === k); return d ? `<a onclick="pEdit('${d.id}')" class="tag ${d.status === 'published' ? 'ok' : ''}" style="cursor:pointer">${k === 'rams' ? 'RAMS' : 'Method st.'} · ${d.status === 'published' ? 'live v' + d.version : 'draft'}</a>` : `<span class="tag bad">${k === 'rams' ? 'RAMS' : 'Method st.'} · none</span>`; };
    v.innerHTML = `<div class="row"><h3>Staff portal</h3><button class="g s" onclick="pGo('tasks')">Back</button></div>`
      + `<div class="ptiles"><div class="ptile"><div class="n">${jobs.length}</div><div class="l">Active jobs</div></div><div class="ptile ${miss.length ? '' : 'alt'}"><div class="n">${miss.length}</div><div class="l">Need RAMS</div></div><div class="ptile ${CT.adm.some(c => c.status !== 'signed') ? '' : 'alt'}"><div class="n">${CT.adm.filter(c => c.status !== 'signed').length}</div><div class="l">Unsigned contracts</div></div></div>`
      + ctAdminCard(PROFS.filter(p => p.role === 'operative'))
      + (!A.ok ? `<div class="card pwarn"><b>Portal database not set up</b><p class="mu">${esc(A.err || 'Loading…')}</p><p class="mu">Run portal.sql in Supabase (SQL Editor), then refresh.</p></div>` : '')
      + `<div class="card"><h3>Jobs: RAMS & method statements</h3>
        ${miss.length ? `<p class="mu">${miss.length} job${miss.length > 1 ? 's have' : ' has'} no RAMS / method statement yet.</p><div class="bar"><button class="s" ${A.busy ? 'disabled' : ''} onclick="pGenAll()">${A.busy ? 'Writing…' : 'Write drafts for all with AI'}</button></div>` : '<p class="mu">Every active job has RAMS and a method statement.</p>'}
        <p class="mu">AI writes a draft. Nothing reaches operatives until you read it and tap Publish.</p>
        <label class="pchk"><input type="checkbox" ${auto ? 'checked' : ''} onchange="pAutoToggle()"> Automatically write drafts when new jobs appear (this phone)</label></div>`
      + (jobs.length ? jobs.slice().reverse().map(j => `<div class="card"><div class="row"><b>${esc(j.name)}</b></div><div class="mu">${esc(j.address || '')}</div>
          <div style="margin:8px 0;display:flex;gap:6px;flex-wrap:wrap">${stTag(j, 'rams')}${stTag(j, 'method_statement')}${A.briefs[j.id] ? '<span class="tag ok">Job info ✓</span>' : '<span class="tag">No job info</span>'}</div>
          <div class="bar"><button class="g s" onclick="pBriefForm('${j.id}')">Job info for operatives</button>${missingFor(j).length ? `<button class="s" ${A.busy ? 'disabled' : ''} onclick="pGenOne('${j.id}')">Write with AI</button>` : ''}</div></div>`).join('') : '<div class="card mu">No active jobs yet.</div>')
      + `<div class="card"><h3>Company library</h3><p class="mu">Policies, insurance, information and notes. Operatives can read these in the app.</p>
        <label>Type</label><select id="lb_cat">${CATS.map(c => `<option value="${c[0]}">${c[1]}</option>`).join('')}</select>
        <label>Title</label><input id="lb_title" placeholder="e.g. Health & Safety Policy">
        <label>Short description (optional)</label><input id="lb_desc">
        <label>Staff must sign to say they've read it?</label><select id="lb_ack"><option value="1">Yes</option><option value="0">No</option></select>
        <label>File (PDF, Word, image…)</label><input id="lb_file" type="file">
        <p class="err" id="lb_err"></p><button onclick="pUpload()">Upload</button></div>`
      + (A.lib.length ? `<div class="card"><h3>In the library (${A.lib.length})</h3>${A.lib.map(d => {
        const sg = A.acks.filter(a => a.doc_kind === 'library' && a.doc_id === d.id && a.doc_version === d.version).map(a => a.user_id), ns = operatives.filter(p => !sg.includes(p.id));
        return `<div style="margin-bottom:12px"><div class="row"><span><b>${esc(d.title)}</b><br><span class="mu">${esc((CATS.find(c => c[0] === d.category) || [0, ''])[1])} · v${d.version}</span></span><span><button class="g s" onclick="pLibOpen('${d.id}')">View</button></span></div>
          ${d.requires_ack ? `<div class="mu">Signed ${sg.length} of ${operatives.length}${ns.length ? ' · waiting: ' + esc(ns.map(pname).join(', ')) : ''}</div>` : ''}
          <div class="bar" style="margin-top:6px"><input type="file" id="lb_rep_${d.id}" hidden onchange="pReplace('${d.id}')"><button class="g s" onclick="$('#lb_rep_${d.id}').click()">Upload new version</button><button class="g s" id="lb_del_${d.id}" onclick="pLibDel('${d.id}')">Delete</button></div></div>`;
      }).join('')}</div>` : '');
  }
  window.pBriefForm = function (jid) {
    const j = J(jid), b = PV.adm.briefs[jid] || {};
    openForm('Job info: ' + j.name, [['start_time', 'Start time (e.g. 08:00)'], ['est_days', 'Expected days', 'number'], ['site_contact', 'Site contact name'], ['site_contact_phone', 'Site contact phone', 'tel'],
      ['access_notes', 'Access, parking, keys', 'area'], ['site_notes', 'Site notes for the team', 'area'], ['hazards', 'Known hazards (asbestos, pets, live services…)', 'area'], ['materials', 'Materials & tools to bring', 'area'],
      ['_', '', 'act', '<p class="mu">Operatives see this on their job page. Do not put prices here.</p>']],
      { start_time: b.start_time || '', est_days: b.est_days == null ? '' : b.est_days, site_contact: b.site_contact || '', site_contact_phone: b.site_contact_phone || '', access_notes: b.access_notes || '', site_notes: b.site_notes || '', hazards: b.hazards || '', materials: b.materials || '' },
      async o => {
        if (/£\s?\d/.test(Object.values(o).join(' '))) return 'Remove any £ amounts - operatives can see this page.';
        const row = { job_id: jid, start_time: o.start_time, est_days: o.est_days === '' ? null : o.est_days, site_contact: o.site_contact, site_contact_phone: o.site_contact_phone, access_notes: o.access_notes, site_notes: o.site_notes, hazards: o.hazards, materials: o.materials, updated_at: new Date().toISOString() };
        const { error } = await sb.from('job_briefs').upsert(row, { onConflict: 'job_id' }); if (error) return error.message;
        await pAdmLoad();
      });
  };
  window.pUpload = async function () {
    const er = $('#lb_err'), f = $('#lb_file').files[0], title = $('#lb_title').value.trim(); er.textContent = '';
    if (!title) { er.textContent = 'Give it a title.'; return; } if (!f) { er.textContent = 'Choose a file.'; return; }
    if (f.size > 20 * 1024 * 1024) { er.textContent = 'File is over 20 MB.'; return; }
    er.textContent = 'Uploading…';
    const path = Date.now() + '-' + f.name.replace(/[^\w.\-]+/g, '_'), up = await sb.storage.from('company-library').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
    if (up.error) { er.textContent = up.error.message; return; }
    const { error } = await sb.from('library_docs').insert({ category: $('#lb_cat').value, title, description: $('#lb_desc').value.trim(), file_name: f.name, storage_path: path, mime_type: f.type || '', requires_ack: $('#lb_ack').value === '1' });
    if (error) { er.textContent = error.message; return; }
    await pAdmLoad(); stat('✓ Uploaded'); render();
  };
  window.pReplace = async function (id) {
    const d = PV.adm.lib.find(x => x.id === id), f = $('#lb_rep_' + id).files[0]; if (!d || !f) return;
    stat('Uploading new version…');
    const path = Date.now() + '-' + f.name.replace(/[^\w.\-]+/g, '_'), up = await sb.storage.from('company-library').upload(path, f, { contentType: f.type || 'application/octet-stream' });
    if (up.error) { stat(up.error.message); return; }
    const { error } = await sb.from('library_docs').update({ storage_path: path, file_name: f.name, mime_type: f.type || '', version: d.version + 1 }).eq('id', id);
    if (error) { stat(error.message); return; }
    sb.storage.from('company-library').remove([d.storage_path]);
    await pAdmLoad(); stat('✓ New version live. Staff will be asked to sign again.'); render();
  };
  window.pLibDel = async function (id) {
    const b = $('#lb_del_' + id), d = PV.adm.lib.find(x => x.id === id);
    if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Tap again to confirm'; return; }
    await sb.from('library_docs').delete().eq('id', id); if (d) sb.storage.from('company-library').remove([d.storage_path]);
    await pAdmLoad(); render();
  };

  // ---------- owner: document editor (RAMS / method statement) ----------
  window.pEdit = function (id) { PV.edit = id; PV.prev = false; render(); $('#view').scrollTop = 0; };
  function editorView() {
    const v = $('#view'), d = PV.adm.jdocs.find(x => x.id === PV.edit), j = d && J(d.job_id);
    if (!d) { PV.edit = null; return adminView(); }
    const ss = signees(d.job_id), sg = PV.adm.acks.filter(a => a.doc_kind === 'job' && a.doc_id === d.id && a.doc_version === d.version).map(a => a.user_id);
    const live = d.status === 'published';
    v.innerHTML = `<div class="row"><button class="g s" onclick="pEditClose()">← Back</button><span class="tag ${live ? 'ok' : ''}">${live ? 'live v' + d.version : 'draft'}${d.ai_generated ? ' · AI written' : ''}</span></div>
      <h3 style="margin-top:12px">${esc(j ? j.name : 'Job')}</h3>
      ${live ? `<p class="mu">Signed by ${ss.filter(p => sg.includes(p.id)).length} of ${ss.length} on this job${ss.some(p => !sg.includes(p.id)) ? ' · waiting: ' + esc(ss.filter(p => !sg.includes(p.id)).map(pname).join(', ')) : ''}</p>` : '<p class="mu">Draft - operatives cannot see this yet. Read it through, fix anything wrong, then publish.</p>'}
      <div class="card"><label>Title</label><input id="ed_title" value="${esc(d.title)}">
        <label>Document</label><textarea id="ed_body" class="pbig">${esc(d.content)}</textarea>
        <div class="bar"><button class="g s" onclick="pPreview()">${PV.prev ? 'Hide preview' : 'Preview'}</button></div>
        <div id="ed_prev" class="pdoc" ${PV.prev ? '' : 'hidden'}></div>
        <label>Staff must sign?</label><select id="ed_ack"><option value="1"${d.requires_ack ? ' selected' : ''}>Yes</option><option value="0"${d.requires_ack ? '' : ' selected'}>No</option></select>
        ${d.ever_published ? `<label>What changed? (shown to staff)</label><input id="ed_note" value="${esc(d.change_note || '')}" placeholder="e.g. Scaffold tower now needed for back wall"><label class="pchk"><input type="checkbox" id="ed_minor"> Minor fix only - don't make staff sign again</label>` : ''}
        <p class="err" id="ed_err"></p>
        <div class="bar"><button onclick="pSaveDoc('${live || d.ever_published ? 'publish' : 'publish'}')">${live ? 'Publish update' : d.ever_published ? 'Publish again' : 'Publish'}</button>${live ? '' : '<button class="g" onclick="pSaveDoc(\'draft\')">Save draft</button>'}${live ? '<button class="g" onclick="pUnpublish()">Take back to draft</button>' : ''}</div></div>
      <div class="card"><h3>Something changed?</h3><p class="mu">Tell the assistant what has changed on the job and it will rewrite this document. You still review it before publishing.</p>
        <textarea id="ed_ai" rows="2" placeholder="e.g. Client has a dog, work now needs a tower scaffold, extra day added"></textarea><button class="g" onclick="pRevise()">Rewrite with AI</button>
        <div class="bar"><button class="g s" id="ed_del" onclick="pDelDoc()">Delete this document</button></div></div>`;
    if (PV.prev) $('#ed_prev').innerHTML = pMd(d.content);
  }
  window.pEditClose = function () { PV.edit = null; render(); };
  window.pPreview = function () { const d = PV.adm.jdocs.find(x => x.id === PV.edit); if (d) { d.content = $('#ed_body').value; d.title = $('#ed_title').value; } PV.prev = !PV.prev; render(); };
  async function pPersist(patch) {
    const { error } = await sb.from('job_documents').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', PV.edit);
    if (error) throw new Error(error.message); await pAdmLoad();
  }
  window.pSaveDoc = async function (how) {
    const d = PV.adm.jdocs.find(x => x.id === PV.edit), er = $('#ed_err'); if (!d) return; er.textContent = '';
    const content = $('#ed_body').value.trim(), title = $('#ed_title').value.trim() || d.title, ack = $('#ed_ack').value === '1';
    if (!content) { er.textContent = 'The document is empty.'; return; }
    try {
      if (how === 'draft') { await pPersist({ title, content, requires_ack: ack }); stat('✓ Draft saved'); render(); return; }
      if (/£\s?\d/.test(content) && !confirm('This document contains a £ amount and operatives will be able to see it. Publish anyway?')) return;
      const note = $('#ed_note') ? $('#ed_note').value.trim() : '', minor = $('#ed_minor') && $('#ed_minor').checked;
      if (d.ever_published && !minor && !note && !confirm('You have not said what changed. Publish anyway?')) return;
      const bump = d.ever_published && !minor;
      await pPersist({ title, content, requires_ack: ack, status: 'published', ever_published: true, version: bump ? d.version + 1 : d.version, change_note: note });
      stat('✓ Published' + (bump ? ' - staff will be asked to sign again' : '')); PV.edit = null; render();
    } catch (e) { er.textContent = e.message; }
  };
  window.pUnpublish = async function () { try { await pPersist({ status: 'draft' }); stat('✓ Back to draft - hidden from operatives'); render(); } catch (e) { $('#ed_err').textContent = e.message; } };
  window.pRevise = async function () {
    const d = PV.adm.jdocs.find(x => x.id === PV.edit), er = $('#ed_err'), note = $('#ed_ai').value.trim(), j = d && J(d.job_id);
    if (!d || !j) return; if (!note) { er.textContent = 'Say what has changed first.'; return; }
    er.textContent = ''; stat('Rewriting…');
    try {
      const body = $('#ed_body').value;
      const txt = await pAI(genPrompt(j, d.kind, note, body));
      d.content = txt; await pPersist({ content: txt, ai_generated: true, change_note: note }); stat('✓ Rewritten - read it, then publish'); render();
    } catch (e) { stat(''); er.textContent = 'Could not rewrite: ' + (e.message || e); }
  };
  window.pDelDoc = async function () {
    const b = $('#ed_del'); if (!b.dataset.arm) { b.dataset.arm = 1; b.textContent = 'Tap again to confirm'; return; }
    await sb.from('job_documents').delete().eq('id', PV.edit); PV.edit = null; await pAdmLoad(); render();
  };

  // ---------- owner: banner on Home / Tasks ----------
  function ownerBanner() {
    const A = PV.adm, n = liveJobs().filter(j => missingFor(j).length).length, draft = A.jdocs.filter(d => d.status === 'draft').length, v = $('#view');
    if (!v) return;
    v.insertAdjacentHTML('afterbegin', `<div class="card"><div class="row"><span><b>Staff portal</b><br><span class="mu">${!A.ok ? 'Needs setup (run portal.sql)' : n ? n + ' job' + (n > 1 ? 's' : '') + ' without RAMS' : 'RAMS up to date'}${draft ? ' · ' + draft + ' draft' + (draft > 1 ? 's' : '') + ' to review' : ''}</span></span><button class="s" onclick="pGo('portal')">Open</button></div></div>`);
  }


  // ============================================================
  //  CONTRACTS: owner issues one per operative, operative signs in the app, signature is saved
  // ============================================================
  const CT = { mine: [], adm: [], loaded: false, err: '', busy: false };
  const fdt2 = d => d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  async function ctLoad() {
    if (!sb || !ME) return;
    try {
      let q = sb.from('contracts').select('*').order('created_at', { ascending: false });
      if (ME.role !== 'owner') q = q.eq('user_id', ME.id);
      const { data, error } = await q;
      CT.err = error ? error.message : '';
      if (ME.role === 'owner') CT.adm = data || []; else CT.mine = data || [];
    } catch (e) { CT.err = String(e.message || e); }
    CT.loaded = true;
  }
  function ctTemplate(f) {
    const d = f.date ? new Date(f.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '____ / ____ / ________';
    return `# Self-Employed Contractor Agreement
Including Confidentiality (NDA) Terms

This Agreement is made on **${d}**

## Between
(1) C&G Residential Services of High Road, Chadwell Heath, RM6 (the "Company"); and
(2) **${f.name}** (the "Contractor").

## 1. Engagement
1.1 The Company engages the Contractor as an independent, self-employed contractor to provide the following trade or services as reasonably requested by the Company (the "Services"): **${f.services}**.
1.2 The Contractor is not an employee, worker, partner or agent of the Company. Nothing in this Agreement creates a relationship of employment.

## 2. Term
2.1 This Agreement starts on the date above and continues until either party ends it by giving the other 1 day's notice, or until the Services are completed.

## 3. Fees and Payment
3.1 The Company will pay the Contractor a day rate of **£${f.rate}** per day worked.
3.2 The Contractor will confirm the days worked in each week, and the Company will pay for those days weekly, on a Friday, on a week in hand basis. This means that days worked in one week (Monday to Sunday) are paid on the Friday of the following week, and the Company will always hold one week's pay in hand.
3.3 Apart from expenses under clause 7, the day rate is the full amount payable. It is not subject to holiday pay, sick pay, pension contributions or any other employee benefits.

## 4. Tax, CIS and National Insurance
4.1 The Contractor is responsible for their own Income Tax, National Insurance contributions and any other taxes or levies arising from payments under this Agreement.
4.2 The Contractor confirms they are registered as self-employed with HMRC and will indemnify the Company against any tax liability relating to the Contractor's earnings under this Agreement.
4.3 The Company operates the Construction Industry Scheme (CIS) and will make CIS deductions from payments to the Contractor at the rate set by HMRC, unless the Contractor holds gross payment status. The day rate is stated before any CIS deduction.
4.4 The Contractor will give the Company their Unique Taxpayer Reference (UTR) and any other details needed for CIS verification before the first payment. The Company will provide a payment and deduction statement, and any CIS deducted counts towards the Contractor's own tax bill.

## 5. Independence and Working Arrangements
5.1 The Contractor provides labour only and will carry out the Services as directed by the Company, following the Company's reasonable instructions on how, when and where the work is done, deadlines and site rules.
5.2 The Contractor may work for other clients, provided this does not conflict with this Agreement or breach clause 8.
5.3 The Company supplies the materials. The Contractor supplies all of their own tools, equipment and transport. The Company does not supply tools unless otherwise agreed in writing.
5.4 The Contractor may send a suitably skilled substitute, with the Company's prior approval, which will not be unreasonably withheld.

## 6. Insurance and Safety
6.1 The Company holds public liability and employers' liability insurance which extends to cover the Contractor while carrying out the Services under this Agreement. The Contractor is not required to hold their own public liability insurance.
6.2 The Contractor will work safely, follow all health and safety rules on site, and carry out the Services with reasonable skill and care.

## 7. Expenses
7.1 If the Contractor spends money on anything needed to carry out the Services, the Contractor must send the Company a receipt, and the amount will be added to the Contractor's next weekly pay.

## 8. Confidentiality (NDA)
8.1 "Confidential Information" means all non-public information the Contractor receives or learns through this engagement, including client details, pricing, business methods, plans, suppliers, financial information, designs, documents and any other information marked or reasonably understood to be confidential.
8.2 The Contractor agrees to:
- keep all Confidential Information strictly confidential;
- use it only to carry out the Services;
- not disclose it to anyone without the Company's prior written consent; and
- take reasonable care to keep it secure.
8.3 Confidential Information does not include information that is public (other than through breach of this Agreement), was already lawfully known to the Contractor, or must be disclosed by law.
8.4 The Contractor will not take, copy or keep any documents, photos, files or data belonging to the Company or its clients, and will return or delete them when this Agreement ends or when asked.
8.5 These confidentiality obligations continue for 3 years after this Agreement ends.

## 9. Ownership of Work
9.1 All work, materials and results produced by the Contractor for the Company under this Agreement belong to the Company.

## 10. Non-Solicitation
10.1 For 6 months after this Agreement ends, the Contractor will not directly approach the Company's clients, introduced through this engagement, to offer them the same services in competition with the Company.

## 11. Liability
11.1 The Contractor is responsible for putting right, at their own cost, any defective work they carry out.
11.2 Nothing in this Agreement limits liability for death or personal injury caused by negligence, or for fraud.
11.3 The Contractor remains responsible for any loss or damage caused by their own negligence or deliberate acts, including damage to a client's property, and the Company may recover the cost of this from the Contractor.

## 12. Ending the Agreement
12.1 Either party may end this Agreement immediately in writing if the other seriously breaches it, including a breach of the confidentiality terms.
12.2 On ending, the Company will pay for all days properly worked up to that date, including the week held in hand. Payment will be made on the next normal weekly pay date under clause 3.2.

## 13. General
13.1 This is the entire agreement between the parties and replaces any earlier discussions.
13.2 Any change must be in writing and signed by both parties.
13.3 If any clause is found to be unenforceable, the rest of the Agreement remains in force.
13.4 This Agreement is governed by the laws of England and Wales, and the courts of England and Wales have jurisdiction.`;
  }

  // ---------- operative side ----------
  const ctUnsigned = () => CT.mine.filter(c => c.status !== 'signed');
  function ctCard() {
    const u = ctUnsigned();
    if (CT.err && !CT.mine.length) return /relation|does not exist|schema/i.test(CT.err) ? '' : '';
    if (!u.length) return '';
    return `<div class="card pwarn"><div class="row"><b>✍️ ${u.length === 1 ? 'Your contract is' : 'Your contracts are'} waiting for your signature</b></div><div class="mu">${u.map(c => esc(c.title)).join(' · ')}</div><div class="bar"><button class="s" onclick="ctOpen('${u[0].id}')">Read &amp; sign</button></div></div>`;
  }
  function ctListCard() {
    if (!CT.mine.length) return '';
    return `<div class="card"><h3>My contracts</h3>${CT.mine.map(c => `<div class="row" style="margin-bottom:10px"><span><b>${esc(c.title)}</b><br><span class="mu">${c.status === 'signed' ? 'Signed ' + fdt2(c.signed_at) : 'Issued ' + fdd(c.created_at)}</span></span>${c.status === 'signed' ? '<span class="tag ok">✓ signed</span>' : '<span class="tag bad">sign</span>'}<button class="g s" onclick="ctOpen('${c.id}')">${c.status === 'signed' ? 'View' : 'Read & sign'}</button></div>`).join('')}</div>`;
  }
  window.ctOpen = function (id) { PV.ct = id; PV.sig = null; PV.doc = null; render(); const v = $('#view'); if (v) v.scrollTop = 0; };
  window.ctBack = function () { PV.ct = null; PV.sig = null; render(); const v = $('#view'); if (v) v.scrollTop = 0; };
  window.ctFile = async function (id, owner) {
    const c = (owner ? CT.adm : CT.mine).find(x => x.id === id); if (!c || !c.storage_path) return;
    const w = window.open('', '_blank');
    const { data, error } = await sb.storage.from('contracts').createSignedUrl(c.storage_path, 300);
    if (error || !data) { if (w) w.close(); stat('Could not open: ' + (error ? error.message : 'no link')); return; }
    if (w) w.location = data.signedUrl; else location.href = data.signedUrl;
  };
  function ctPage() {
    const v = $('#view'), c = CT.mine.find(x => x.id === PV.ct), signed = c.status === 'signed';
    v.innerHTML = `<div class="row"><button class="g s" onclick="ctBack()">← Back</button><span class="tag${signed ? ' ok' : ' bad'}">${signed ? '✓ signed' : 'needs your signature'}</span></div>
      <div class="card pdoc" style="margin-top:12px">${c.content ? pMd(c.content) : `<h3>${esc(c.title)}</h3><p class="mu">This contract is a file. Open it, read it all, then sign below.</p><div class="bar"><button class="s" onclick="ctFile('${c.id}')">Open ${esc(c.file_name || 'contract')}</button></div>`}</div>
      ${signed ? `<div class="card"><span class="tag ok">✓ You signed this</span><p style="margin:10px 0 4px"><b>${esc(c.signed_name)}</b><br><span class="mu">${fdt2(c.signed_at)}</span></p><div style="background:#fff;border-radius:12px;padding:6px;border:1px solid var(--bd)"><img src="${c.signature}" alt="Your signature" style="max-width:100%;height:90px;display:block"></div><div class="bar"><button class="g s" onclick="ctPrint('${c.id}')">Print / save as PDF</button></div></div>`
        : `<div class="card"><h3>Sign this agreement</h3>
        <label>Type your full name</label><input id="sg_name" value="${esc(PV.sgName || ME.full_name || '')}" oninput="PV.sgName=this.value" autocomplete="name">
        <label>Draw your signature</label><canvas id="sgpad" style="width:100%;height:160px;background:#fff;border:1px solid var(--bd);border-radius:12px;touch-action:none;display:block"></canvas>
        <div class="bar" style="margin-top:6px"><button class="g s" onclick="ctClear()">Clear</button></div>
        <label class="pchk"><input type="checkbox" id="sg_ok"> <span>I have read and agree to this agreement. I understand my drawn signature and typed name are my electronic signature and have the same effect as signing on paper.</span></label>
        <p class="err" id="sg_err"></p><button id="sg_btn" onclick="ctSign('${c.id}')">Sign agreement</button></div>`}`;
    if (!signed) ctPad();
  }
  function ctPad() {
    const c = $('#sgpad'); if (!c) return;
    const r = c.getBoundingClientRect(), d = window.devicePixelRatio || 1;
    c.width = Math.round(r.width * d); c.height = Math.round(r.height * d);
    const x = c.getContext('2d'); x.scale(d, d); x.lineWidth = 2.4; x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#111';
    if (PV.sig) { const im = new Image(); im.onload = () => x.drawImage(im, 0, 0, r.width, r.height); im.src = PV.sig; }
    let down = false, last = null;
    const pt = e => { const b = c.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    c.onpointerdown = e => { e.preventDefault(); try { c.setPointerCapture(e.pointerId); } catch (_) { } down = true; last = pt(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(last[0] + .1, last[1] + .1); x.stroke(); };
    c.onpointermove = e => { if (!down) return; e.preventDefault(); const p = pt(e); x.beginPath(); x.moveTo(last[0], last[1]); x.lineTo(p[0], p[1]); x.stroke(); last = p; };
    const up = () => {
      if (!down) return; down = false;
      const o = document.createElement('canvas'); o.width = 600; o.height = Math.round(600 * c.height / c.width);
      o.getContext('2d').drawImage(c, 0, 0, o.width, o.height); PV.sig = o.toDataURL('image/png');
    };
    c.onpointerup = up; c.onpointercancel = up; c.onpointerleave = up;
  }
  window.ctClear = function () { PV.sig = null; ctPad(); };
  window.ctSign = async function (id) {
    const nm = (($('#sg_name') || {}).value || '').trim(), ok = $('#sg_ok'), er = $('#sg_err'), bt = $('#sg_btn');
    if (!nm) { er.textContent = 'Type your full name.'; return; }
    if (!PV.sig) { er.textContent = 'Draw your signature in the box.'; return; }
    if (!ok || !ok.checked) { er.textContent = 'Tick the box to confirm you agree.'; return; }
    er.textContent = ''; bt.disabled = true; bt.textContent = 'Saving…';
    const { error } = await sb.rpc('sign_contract', { p_id: id, p_name: nm, p_sig: PV.sig, p_ua: navigator.userAgent });
    if (error) { bt.disabled = false; bt.textContent = 'Sign agreement'; er.textContent = error.message + (/function|does not exist|schema cache/i.test(error.message) ? ' - tell your boss the contracts setup (contracts.sql) has not been run.' : ''); return; }
    PV.sig = null; await ctLoad(); render(); const v = $('#view'); if (v) v.scrollTop = 0;
  };
  // printable signed copy (operative and owner)
  window.ctPrint = function (id) {
    const c = CT.mine.concat(CT.adm).find(x => x.id === id); if (!c) return;
    const p = PROFS.find(x => x.id === c.user_id), who = c.signed_name || (p && (p.full_name || p.email)) || '';
    const w = window.open('', '_blank'); if (!w) { stat('Allow pop-ups to print'); return; }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(c.title)} - ${esc(who)}</title><style>body{font:14px/1.55 Georgia,serif;max-width:720px;margin:24px auto;padding:0 18px;color:#111}h3{font-size:22px}h4{font-size:15px;margin:18px 0 4px;font-family:Arial,sans-serif}p{margin:6px 0}.sig{border:1px solid #999;border-radius:8px;padding:14px;margin-top:26px;page-break-inside:avoid}.sig img{height:90px;display:block}small{color:#555}@media print{button{display:none}}</style></head><body><button onclick="window.print()" style="padding:10px 16px;margin-bottom:12px">Print / Save as PDF</button>
      ${c.content ? pMd(c.content) : `<h3>${esc(c.title)}</h3><p>Signed agreement: <b>${esc(c.file_name || 'uploaded file')}</b></p>`}
      <div class="sig"><b>${c.status === 'signed' ? 'Electronically signed by the Contractor' : 'NOT YET SIGNED'}</b>${c.status === 'signed' ? `<p>${esc(c.signed_name)}<br>${fdt2(c.signed_at)}</p><img src="${c.signature}" alt="signature"><p><small>Contract ref ${esc(c.id)} · C&amp;G Residential Services</small></p>` : ''}</div></body></html>`);
    w.document.close();
  };

  // ---------- owner side ----------
  function ctAdminCard(operatives) {
    const nm = id => { const p = PROFS.find(x => x.id === id); return pname(p); };
    const today10 = new Date().toISOString().slice(0, 10);
    const open = CT.adm.filter(c => c.status !== 'signed').length;
    return `<div class="card"><h3>Contracts</h3><p class="mu">Issue a contract to an operative. They sign it in their app and the signed copy is saved here.</p>
      ${CT.err ? `<p class="err">${esc(CT.err)}${/relation|does not exist|schema/i.test(CT.err) ? ' - run contracts.sql in Supabase (SQL Editor), then refresh.' : ''}</p>` : ''}
      <label>Operative</label><select id="ct_who">${operatives.length ? operatives.map(p => `<option value="${p.id}">${esc(pname(p))}</option>`).join('') : '<option value="">No operatives yet</option>'}</select>
      <label>Contract</label><select id="ct_kind" onchange="ctKind()"><option value="tpl">C&amp;G Self-Employed Contractor Agreement (built in)</option><option value="file">Upload my own contract (PDF / Word)</option></select>
      <div id="ct_tpl"><label>Trade / services</label><input id="ct_services" placeholder="e.g. Carpenter / Joiner"><label>Day rate (£)</label><input id="ct_rate" type="number" inputmode="decimal" placeholder="e.g. 180"><label>Agreement date</label><input id="ct_date" type="date" value="${today10}"></div>
      <div id="ct_up" hidden><label>Title</label><input id="ct_title" placeholder="e.g. Contractor agreement - Dan"><label>File</label><input id="ct_file" type="file" accept=".pdf,.doc,.docx,application/pdf"></div>
      <p class="err" id="ct_err"></p><button id="ct_btn" onclick="ctIssue()">Issue contract</button></div>`
      + (CT.adm.length ? `<div class="card"><h3>Issued contracts${open ? ` <span class="tag bad">${open} unsigned</span>` : ''}</h3>${CT.adm.map(c => `<div style="margin-bottom:12px"><div class="row"><span><b>${esc(nm(c.user_id))}</b><br><span class="mu">${esc(c.title)} · ${c.status === 'signed' ? 'signed ' + fdt2(c.signed_at) : 'issued ' + fdd(c.created_at)}</span></span><span class="tag${c.status === 'signed' ? ' ok' : ' bad'}">${c.status === 'signed' ? '✓ signed' : 'waiting'}</span></div>
          <div class="bar" style="margin-top:6px"><button class="g s" onclick="ctPrint('${c.id}')">${c.status === 'signed' ? 'View signed copy' : 'View'}</button>${c.storage_path ? `<button class="g s" onclick="ctFile('${c.id}',1)">Open file</button>` : ''}${c.status !== 'signed' ? `<button class="g s" onclick="ctWithdraw('${c.id}')">Withdraw</button>` : ''}</div></div>`).join('')}</div>` : '');
  }
  window.ctKind = function () { const f = $('#ct_kind').value === 'file'; $('#ct_tpl').hidden = f; $('#ct_up').hidden = !f; };
  window.ctIssue = async function () {
    const er = $('#ct_err'), bt = $('#ct_btn'), uid = $('#ct_who').value, kind = $('#ct_kind').value; er.textContent = '';
    if (!uid) { er.textContent = 'Choose an operative first.'; return; }
    const p = PROFS.find(x => x.id === uid); let row;
    bt.disabled = true; bt.textContent = 'Issuing…';
    try {
      if (kind === 'tpl') {
        const services = $('#ct_services').value.trim(), rate = $('#ct_rate').value.trim(), date = $('#ct_date').value;
        if (!services || !rate) throw new Error('Enter the trade / services and the day rate.');
        row = { user_id: uid, title: 'Self-Employed Contractor Agreement', content: ctTemplate({ name: pname(p), services, rate, date }), day_rate: +rate, services };
      } else {
        const f = $('#ct_file').files[0], title = $('#ct_title').value.trim() || (f ? f.name : '');
        if (!f) throw new Error('Choose a file first.');
        if (f.size > 15 * 1024 * 1024) throw new Error('File must be 15 MB or smaller.');
        const path = uid + '/' + Date.now() + '-' + f.name.replace(/[^\w.\-]+/g, '_');
        const up = await sb.storage.from('contracts').upload(path, f, { contentType: f.type || 'application/octet-stream', upsert: false });
        if (up.error) throw new Error('Upload failed: ' + up.error.message);
        row = { user_id: uid, title, storage_path: path, file_name: f.name, mime_type: f.type || '' };
      }
      const { error } = await sb.from('contracts').insert(row); if (error) throw new Error(error.message);
      await ctLoad(); render(); stat('Contract issued to ' + pname(p)); setTimeout(() => stat(''), 3000);
    } catch (e) { er.textContent = e.message || String(e); bt.disabled = false; bt.textContent = 'Issue contract'; }
  };
  window.ctWithdraw = async function (id) {
    if (!confirm('Withdraw this unsigned contract?')) return;
    const c = CT.adm.find(x => x.id === id), { error } = await sb.from('contracts').delete().eq('id', id);
    if (error) { stat(error.message); return; }
    if (c && c.storage_path) sb.storage.from('contracts').remove([c.storage_path]);
    await ctLoad(); render();
  };

  // ---------- hook into the app ----------
  OPN.length = 0; OPT.forEach(x => OPN.push(x));
  const _render = window.render;
  window.render = function () {
    if (PV.map) { try { PV.map.remove(); } catch (e) { } PV.map = null; }
    if (mode === 'operative' && tab === 'mytasks') tab = 'mydash';
    const r = _render.apply(this, arguments);
    // the app may have logged in before this file loaded: fetch our data once, then redraw
    if (mode === 'operative' && !PT.loaded && !PT.loading) { PT.loading = 1; pLoad().then(() => { PT.loading = 0; render(); }); }
    if (mode === 'owner' && !PV.adm.tried && !PV.adm.loading) { PV.adm.loading = 1; pAdmLoad().then(() => { PV.adm.loading = 0; render(); setTimeout(pAuto, 1500); }); }
    if (FM) return r;
    if (mode === 'pending') {
      if (PV.ct && CT.mine.find(x => x.id === PV.ct)) return ctPage();
      PV.ct = null;
      const v = $('#view'); if (v) v.insertAdjacentHTML('beforeend', ctCard() + ctListCard());
      if (!CT.loaded && !CT.loading) { CT.loading = 1; ctLoad().then(() => { CT.loading = 0; if (mode === 'pending') render(); }); }
      return r;
    }
    if (mode === 'operative' && PV.ct) { if (CT.mine.find(x => x.id === PV.ct)) return ctPage(); PV.ct = null; }
    if (mode === 'operative' && MYTABS.includes(tab)) {
      if (tab === 'mydash') return dashView();
      if (tab === 'myjobs') { const t = PV.openTask && myTasks().find(x => x.id === PV.openTask); if (PV.doc) return docPage(); if (t) return jobPage(t); PV.openTask = null; return jobsList(); }
      if (tab === 'mydocs') return PV.doc ? docPage() : libraryView();
    }
    if (mode === 'operative' && PV.doc && (tab === 'myjobs' || tab === 'mydash')) return docPage();
    if (mode === 'owner') {
      if (tab === 'portal') return PV.edit ? editorView() : adminView();
      if (tab === 'tasks' || tab === 'home') ownerBanner();
    }
    return r;
  };
  $('#nav').addEventListener('click', () => { PV.ct = null; PV.openTask = null; PV.doc = null; PV.edit = null; PV.back = null; }, true);

  // keep the operative screens fresh without wiping what is being typed or the map
  setInterval(async () => {
    try {
      if (mode !== 'operative' || document.hidden || FM || PV.doc || PV.ct || PV.map || !MYTABS.includes(tab) || tab === 'mypay' || tab === 'mydetails') return;
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      await loadOp(); render();
    } catch (e) { }
  }, 60000);

  // if the app finished logging in before this file loaded, redraw now with the portal screens
  if (mode === 'operative' || mode === 'owner') { try { render(); } catch (e) { console.error(e); } }
})();
