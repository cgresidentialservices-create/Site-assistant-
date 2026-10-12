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
  .pmap{height:340px;border-radius:14px;overflow:hidden;border:1px solid var(--bd);margin:0 0 12px}
  .pmap.sm{height:210px}
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
  async function pMapInit(id, pts) {
    try { await pLeaflet(); } catch (e) {
      const el = $('#' + id); if (el) el.innerHTML = '<p class="mu" style="padding:14px">The map could not load. Use the Directions links instead.</p>'; return;
    }
    const el = $('#' + id); if (!el || !window.L || !pts.length) return;
    const m = L.map(el, { scrollWheelZoom: false }).setView([pts[0].lat, pts[0].lng], 15);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
    const b = [];
    pts.forEach(p => {
      const mk = L.circleMarker([p.lat, p.lng], { radius: 10, color: '#ffffff', weight: 2, fillColor: '#d9730d', fillOpacity: 1 }).addTo(m);
      if (p.html) mk.bindPopup(p.html);
      b.push([p.lat, p.lng]);
    });
    if (b.length > 1) m.fitBounds(b, { padding: [30, 30] });
    PV.map = m; setTimeout(() => m.invalidateSize(), 250);
  }
  window.pLocate = async function () {
    try {
      const p = await getPos();
      if (PV.map && window.L) { L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }).addTo(PV.map).bindPopup('You are here'); PV.map.panTo([p.lat, p.lng]); }
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
  window.loadOp = async function () { await _loadOp.apply(this, arguments); await pLoad(); };
  const _loadOwner = window.loadOwner;
  window.loadOwner = async function () { await _loadOwner.apply(this, arguments); await pAdmLoad(); setTimeout(pAuto, 1500); };

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
    v.innerHTML = `<h3>${gr}, ${esc(first())}</h3>`
      + (PT.err ? `<div class="card"><span class="err">Portal data is not set up yet (${esc(PT.err)}). Tell your boss.</span></div>` : '')
      + (open ? `<div class="card"><b>You are on site: ${esc(open.job_name || 'job')}</b><div class="mu">Since ${fdt(open.in_at)}</div><div style="margin:6px 0">${distTag(open.in_dist_m, 150)}</div><button onclick="doOut()">Check out – I'm leaving</button><p class="mu" id="om"></p></div>` : '')
      + (pend.length ? `<div class="card pwarn"><b>${pend.length} document${pend.length > 1 ? 's' : ''} to read and sign</b><div class="mu">${pend.slice(0, 3).map(p => esc(p.title) + (p.upd ? ' (updated)' : '')).join(' · ')}${pend.length > 3 ? ' …' : ''}</div><div class="bar"><button class="s" onclick="pGo('mydocs')">Open library</button></div></div>` : '')
      + (next ? `<div class="card"><div class="row"><span class="mu">NEXT JOB</span>${next.status === 'doing' ? '<span class="tag ok">in progress</span>' : ''}</div><b style="font-size:16px">${esc(next.title)}</b><div class="mu">${esc(next.job_name || '')}</div>
          <div style="margin:6px 0">${next.due_date ? fdate(next.due_date) : 'No date set'}${brief(next).start_time ? ' · start ' + esc(brief(next).start_time) : ''}</div>
          ${next.address ? `<div class="mu">${esc(next.address)}</div>` : ''}
          <div class="bar"><button class="s" onclick="pOpenJob('${next.id}')">Open job</button>${dirLink(next) ? `<a href="${dirLink(next)}" target="_blank" rel="noopener"><button class="g s" type="button">Directions</button></a>` : ''}</div></div>`
        : '<div class="card mu">No jobs booked yet. Your boss will send them here.</div>')
      + `<div class="grid2">
          <div class="card"><div class="mu">This week</div><div class="big">${fh(st.weekH)}</div><div class="mu">${st.weekDays} day${st.weekDays === 1 ? '' : 's'} on site</div></div>
          <div class="card"><div class="mu">Jobs completed</div><div class="big">${st.doneN}</div><div class="mu">${st.visits} site visit${st.visits === 1 ? '' : 's'} logged</div></div>
          <div class="card"><div class="mu">Average per job</div><div class="big">${st.avgTask == null ? '–' : fh(st.avgTask)}</div><div class="mu">time on site to finish a task</div></div>
          <div class="card"><div class="mu">Average visit</div><div class="big">${st.avgVisit == null ? '–' : fh(st.avgVisit)}</div><div class="mu">per check-in</div></div></div>`
      + (act.length > 1 ? `<div class="card"><h3>Coming up</h3>${act.filter(t => t !== next).slice(0, 6).map(t => `<div class="row" style="margin-bottom:8px" onclick="pOpenJob('${t.id}')"><span><b>${esc(t.title)}</b><br><span class="mu">${esc(t.job_name || '')}</span></span><span class="mu">${t.due_date ? fdate(t.due_date) : ''}</span></div>`).join('')}<div class="bar"><button class="g s" onclick="pGo('myjobs')">All jobs</button></div></div>` : '')
      + (st.jobs.length ? `<div class="card"><h3>Time on jobs</h3><table>${st.jobs.map(j => `<tr><td>${esc(j.name)}<br><span class="mu">${j.n} task${j.n > 1 ? 's' : ''} · ${fh(j.h)} total</span></td><td>${fh(j.avg)}<br><span class="mu">avg / task</span></td></tr>`).join('')}</table></div>` : '')
      + `<p class="mu">Your location is recorded only when you tap Check in or Check out. It is not tracked in between.</p>`;
  }

  // ---------- operative: Jobs (list / map / job page) ----------
  function jobsList() {
    const v = $('#view'), T = myTasks(), open = PT.checks.find(c => !c.out_at) || (OPS.checks || []).find(c => !c.out_at),
      act = T.filter(t => t.status !== 'done').sort(byDue), dn = T.filter(t => t.status === 'done').slice(0, 8);
    const pins = act.filter(t => t.lat != null && t.lng != null);
    const card = t => {
      const b = PT.briefs[String(t.job_id)] || {}, ds = jobDocs(t.job_id), need = ds.filter(d => d.requires_ack && !signed('job', d.id, d.version)).length;
      return `<div class="card" onclick="pOpenJob('${t.id}')"><div class="row"><b>${esc(t.title)}</b><span class="tag${t.status === 'doing' ? ' ok' : ''}">${t.status === 'doing' ? 'in progress' : 'to do'}</span></div>
        <div class="mu">${esc(t.job_name || '')}</div>${t.address ? `<div class="mu">${esc(t.address)}</div>` : ''}
        <div style="margin-top:6px">${t.due_date ? fdate(t.due_date) : 'No date'}${b.start_time ? ' · ' + esc(b.start_time) : ''}${b.est_days ? ' · ~' + esc(b.est_days) + ' day' + (+b.est_days === 1 ? '' : 's') : ''}</div>
        ${ds.length ? `<div style="margin-top:6px">${need ? `<span class="tag bad">${need} to sign</span>` : '<span class="tag ok">✓ RAMS signed</span>'}</div>` : ''}</div>`;
    };
    v.innerHTML = `<div class="row"><h3>My jobs</h3></div>
      <div class="pseg"><button class="${PV.jm === 'list' ? 's' : 'g s'}" onclick="pMode('list')">List</button><button class="${PV.jm === 'map' ? 's' : 'g s'}" onclick="pMode('map')">Map</button></div>`
      + (open ? `<div class="card"><b>You are on site: ${esc(open.job_name || 'job')}</b><div class="mu">Since ${fdt(open.in_at)}</div><button style="margin-top:8px" onclick="doOut()">Check out – I'm leaving</button></div>` : '') + `<p class="mu" id="om"></p>`
      + (PV.jm === 'map'
        ? (pins.length ? `<div id="pmap" class="pmap"></div><div class="bar"><button class="g s" onclick="pLocate()">Show where I am</button></div>` : '<div class="card mu">None of your jobs have a site location yet. Use the job pages for the address and directions.</div>')
          + act.filter(t => !(t.lat != null && t.lng != null)).map(card).join('')
        : (act.length ? act.map(card).join('') : '<div class="card mu">No jobs right now. Your boss will send you jobs here.</div>'))
      + (dn.length ? `<details><summary>Done (${dn.length})</summary>${dn.map(t => `<p class="mu" onclick="pOpenJob('${t.id}')">✓ ${esc(t.title)} · ${esc(t.job_name || '')}</p>`).join('')}</details>` : '');
    if (PV.jm === 'map' && pins.length) pMapInit('pmap', pins.map(t => ({ lat: +t.lat, lng: +t.lng, html: `<b>${esc(t.title)}</b><br>${esc(t.job_name || '')}<br>${t.due_date ? fdate(t.due_date) : ''}<br><a onclick="pOpenJob('${t.id}')" style="cursor:pointer;text-decoration:underline">Open job</a>` })));
  }
  function jobPage(t) {
    const v = $('#view'), b = PT.briefs[String(t.job_id)] || {}, ds = jobDocs(t.job_id), open = PT.checks.find(c => !c.out_at) || (OPS.checks || []).find(c => !c.out_at),
      here = open && open.task_id === t.id, need = ds.filter(d => d.requires_ack && !signed('job', d.id, d.version)), ml = mapLink(t), dl = dirLink(t), hasPin = t.lat != null && t.lng != null;
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
    if (hasPin) pMapInit('pmap1', [{ lat: +t.lat, lng: +t.lng, html: esc(t.address || t.title) }]);
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
    v.innerHTML = '<h3>Library</h3>' + (PT.err ? `<div class="card"><span class="err">${esc(PT.err)}</span></div>` : '')
      + (pend.length ? `<div class="card pwarn"><b>Needs your signature (${pend.length})</b>${pend.map(p => `<div class="row" style="margin-top:8px"><span>${esc(p.title)}${p.upd ? ' <span class="mu">(updated)</span>' : ''}</span><button class="s" onclick="pOpenDoc('${p.kind}','${p.id}')">Read & sign</button></div>`).join('')}</div>` : '')
      + (myJD.length ? `<div class="card"><h3>My job documents</h3>${myJD.map(d => row('job', d, esc(nm(d.job_id)) + ' · ' + KIND[d.kind] + ' · v' + d.version)).join('')}</div>` : '')
      + CATS.map(([k, l]) => { const ds = PT.lib.filter(d => d.category === k); return ds.length ? `<div class="card"><h3>${l}</h3>${ds.map(d => row('library', d, esc(d.description || '') || fdd(d.created_at))).join('')}</div>` : ''; }).join('')
      + (!PT.lib.length && !myJD.length ? '<div class="card mu">Nothing here yet. Your boss will add company policies, RAMS and method statements.</div>' : '');
  }

  // ---------- navigation ----------
  window.pGo = function (t) { FM = null; PV.openTask = null; PV.doc = null; PV.edit = null; tab = t; render(); const v = $('#view'); if (v) v.scrollTop = 0; };
  window.pMode = function (m) { PV.jm = m; render(); };
  window.pOpenJob = function (id) { PV.openTask = id; PV.doc = null; if (tab !== 'myjobs') { PV.back = tab; tab = 'myjobs'; } else PV.back = null; render(); $('#view').scrollTop = 0; };
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
  $('#nav').addEventListener('click', () => { PV.openTask = null; PV.doc = null; PV.edit = null; PV.back = null; }, true);

  // keep the operative screens fresh without wiping what is being typed or the map
  setInterval(async () => {
    try {
      if (mode !== 'operative' || document.hidden || FM || PV.doc || PV.map || !MYTABS.includes(tab) || tab === 'mypay' || tab === 'mydetails') return;
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      await loadOp(); render();
    } catch (e) { }
  }, 60000);

  // if the app finished logging in before this file loaded, redraw now with the portal screens
  if (mode === 'operative' || mode === 'owner') { try { render(); } catch (e) { console.error(e); } }
})();
