// ─── ROUTING DETAIL ───
//
// STEP NUMBERING SCHEME
// ---------------------
// Every step has a two-part number: process on the left, sub-process on the right.
// Both parts are zero-padded to two digits and joined with a dot when a sub exists.
//
//   01        → main process 1
//   01.01     → first sub-process under process 01
//   01.02     → second sub-process under process 01
//   03.07     → seventh sub-process under process 03
//
// Numbers are assigned in the next available gap, not always at the end.
// If process 02 is deleted and a new one is added, it comes back as 02.
// Same rule applies to sub-processes within a parent.
//
// Ceiling: 80 main processes (01–80), 80 sub-processes per parent (XX.01–XX.80).
// There is no third level — sub-processes cannot have children.
//
// The same number appears in: tree rows, detail panel header,
// sub-process breakdown cards, and the cycle time modal label.
// All rendered via _stepNum(pno, sno) — left side is process_no,
// right side is subprocess_no if present, joined with a dot only when it exists.
//
const API  = '/api/v1/workflow-costing';
const MAPI = '/api/v1/machine';
let _steps      = [];
let _routing    = {};
let _editMode   = false;
let _exp        = {};
let _activeStep = null;
let _machTimer  = null;
let _costLoaded = false;
let _pendingStep = null; // { type:'proc'|'sub', pno, sno, stepName, machines:[{machine_id,machine_code,machine_name,is_preferred}] }

function getH() {
    const t   = localStorage.getItem('access_token')   || sessionStorage.getItem('access_token')   || '';
    const tid = localStorage.getItem('tenant_id')      || sessionStorage.getItem('tenant_id')      || 'TEST';
    const e   = localStorage.getItem('user_email')     || sessionStorage.getItem('user_email')     || '';
    const n   = localStorage.getItem('user_name')      || sessionStorage.getItem('user_name')      || '';
    return { 'Content-Type':'application/json', 'Authorization':`Bearer ${t}`,
             'X-Tenant-ID':tid, 'X-User-Email':e, 'X-User-Name':n };
}
function esc(s) { const d=document.createElement('div'); d.textContent=String(s||''); return d.innerHTML; }
function fmtN(n,d=2) { return parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:d,maximumFractionDigits:d}); }
function fmtN4(n) { return parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:4}); }
function openM(id)  { document.getElementById(id).classList.add('active'); }
function closeM(id) { document.getElementById(id).classList.remove('active'); }
function toast(msg, type='success') {
    const t = document.getElementById('wfToast');
    t.textContent = msg; t.className = `wf-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

function _nextProcessNo() {
    const used = _steps.filter(s => !s.subprocess_no).map(s => s.process_no);
    for (let i = 1; i <= 80; i++) if (!used.includes(i)) return i;
    return null;
}
function _nextSubNo(pno) {
    const used = _steps.filter(s => s.process_no === pno && s.subprocess_no).map(s => s.subprocess_no);
    for (let i = 1; i <= 80; i++) if (!used.includes(i)) return i;
    return null;
}

// ── LOAD ──
async function loadRouting() {
    const res  = await fetch(`${API}/routings/${ROUTING_ID}`, { headers: getH() });
    const data = await res.json();
    document.getElementById('rdLoading').style.display = 'none';
    if (!data.success) {
        document.getElementById('rdLoading').innerHTML = '<span style="color:#e53935">Routing not found.</span>';
        return;
    }
    _steps   = data.data.steps || [];
    _routing = data.data.routing;
    _steps.forEach(s => { if (_exp[s.id] === undefined) _exp[s.id] = true; });

    document.getElementById('rdContent').style.display = 'block';
    document.getElementById('rdPartNumber').textContent = _routing.part_number;
    document.getElementById('rdPartDesc').textContent   = _routing.part_description || '';
    document.getElementById('sbPartNumber').textContent = _routing.part_number;
    document.getElementById('sbPartDesc').textContent   = _routing.part_description || '';
    document.getElementById('rdStatusBadge').textContent = _routing.status;
    document.getElementById('rdRevBadge').textContent    = `Rev ${_routing.revision}`;
    document.title = `${_routing.part_number} — Routing`;

    // stats
    const topCount = _steps.filter(s => !s.subprocess_no).length;
    const subCount = _steps.filter(s => s.subprocess_no).length;
    const mCount   = _steps.reduce((a,s) => a + s.machines.length, 0);
    document.getElementById('rdInfoStats').innerHTML = `
        <div class="rd-stat"><span class="rd-stat-val">${topCount}</span><span class="rd-stat-lbl">Processes</span></div>
        <div class="rd-stat"><span class="rd-stat-val">${subCount}</span><span class="rd-stat-lbl">Sub-processes</span></div>
        <div class="rd-stat"><span class="rd-stat-val">${mCount}</span><span class="rd-stat-lbl">Machines</span></div>`;

    renderTree();
    if (_activeStep) renderDetail(_activeStep);
    if (_costLoaded) loadCost();
}

// ── TABS ──
function switchTab(tab) {
    document.querySelectorAll('.rd-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.rd-tab-panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`panel-${tab}`).classList.add('active');
    if (tab === 'costing' && !_costLoaded) loadCost();
}

// ── EDIT MODE ──
function toggleEditMode() {
    _editMode = !_editMode;
    const btn  = document.getElementById('rdEditToggle');
    const sbtn = document.getElementById('sbEditBtn');
    btn.innerHTML = _editMode
        ? '<span class="material-icons-outlined">visibility</span> View'
        : '<span class="material-icons-outlined">edit</span> Edit';
    btn.classList.toggle('active', _editMode);
    sbtn.innerHTML = _editMode
        ? '<span class="material-icons-outlined">visibility</span>View Mode'
        : '<span class="material-icons-outlined">edit</span>Edit Routing';
    renderTree();
    if (_activeStep) renderDetail(_activeStep);
}

function expandAll()   { _steps.forEach(s => _exp[s.id] = true);  renderTree(); }
function collapseAll() { _steps.forEach(s => _exp[s.id] = false); renderTree(); }
function toggleExp(id, e) { e.stopPropagation(); _exp[id] = !_exp[id]; renderTree(); }

// ── RENDER TREE (left panel) ──
function renderTree() {
    const wrap     = document.getElementById('rdTree');
    const topSteps = _steps.filter(s => !s.subprocess_no).sort((a,b) => a.process_no - b.process_no);
    const totalM   = _steps.reduce((a,s) => a + s.machines.length, 0);

    // update panel head count
    const headCount = document.getElementById('rdTreeHeadCount');
    if (headCount) headCount.textContent = `${topSteps.length} steps · ${totalM} machines`;

    if (!topSteps.length) {
        wrap.innerHTML = `<div class="rd-tree-empty"><span class="material-icons-outlined">account_tree</span>${_editMode
            ? 'Click <b>+ Add Process</b> to start building the routing.'
            : 'No processes yet.<br>Switch to Edit mode to begin.'}</div>`
            + (_editMode ? treeAddProcHtml() : '');
        return;
    }

    let html = '';
    topSteps.forEach(proc => {
        const subs     = _steps.filter(s => s.process_no === proc.process_no && s.subprocess_no)
                               .sort((a,b) => a.subprocess_no - b.subprocess_no);
        const expanded = _exp[proc.id] !== false;
        const isActive = _activeStep === proc.id;
        const mCount   = proc.machines.length;
        const subMeta  = subs.length ? `${subs.length} sub-process${subs.length>1?'es':''}` : 'No sub-processes';
        const mMeta    = mCount ? `${mCount} machine${mCount>1?'s':''}` : 'No machines';

        html += `<div class="rd-tree-proc">
            <div class="rd-tree-row ${isActive ? 'active' : ''}" onclick="selectStep('${proc.id}')">
                <span class="rd-tree-num">${String(proc.process_no).padStart(2,'0')}</span>
                <button class="rd-tree-expbtn" onclick="toggleExp('${proc.id}',event)" title="${expanded?'Collapse':'Expand'}">
                    <span class="material-icons-outlined">${expanded ? 'expand_more' : 'chevron_right'}</span>
                </button>
                <div class="rd-tree-info">
                    <span class="rd-tree-name">${esc(proc.step_name)}</span>
                    <span class="rd-tree-meta">${mMeta}<span class="rd-tree-meta-dot"></span>${subMeta}</span>
                </div>
                ${mCount ? `<span class="rd-tree-mcount">${mCount}</span>` : ''}
                ${_editMode ? `<button class="rd-tree-del" onclick="event.stopPropagation();confirmDeleteStep('${proc.id}','${esc(proc.step_code)}')" title="Delete"><span class="material-icons-outlined">delete</span></button>` : ''}
            </div>`;

        if (expanded) {
            html += `<div class="rd-tree-proc-children">`;
            subs.forEach(sub => {
                const subActive = _activeStep === sub.id;
                const smCount   = sub.machines.length;
                const smMeta    = smCount ? `${smCount} machine${smCount>1?'s':''}` : 'No machines';
                html += `<div class="rd-tree-sub">
                    <div class="rd-tree-row ${subActive ? 'active' : ''}" onclick="selectStep('${sub.id}')">
                        <span class="rd-tree-num">${String(sub.subprocess_no).padStart(2,'0')}</span>
                        <div class="rd-tree-info">
                            <span class="rd-tree-name">${esc(sub.step_name)}</span>
                            <span class="rd-tree-meta">${smMeta}</span>
                        </div>
                        ${smCount ? `<span class="rd-tree-mcount">${smCount}</span>` : ''}
                        ${_editMode ? `<button class="rd-tree-del" onclick="event.stopPropagation();confirmDeleteStep('${sub.id}','${esc(sub.step_code)}')" title="Delete"><span class="material-icons-outlined">delete</span></button>` : ''}
                    </div>
                </div>`;
            });
            if (_editMode) html += treeAddSubHtml(proc.process_no);
            html += `</div>`;
        }
        html += `</div>`;
    });

    if (_editMode) html += treeAddProcHtml();
    wrap.innerHTML = html;
}

function treeAddSubHtml(pno) {
    return `<div class="rd-tree-addsub">
        <div class="rd-tree-inline" id="subForm_${pno}" style="display:none">
            <div style="position:relative;flex:1">
                <input id="subInput_${pno}" placeholder="Search process master…" maxlength="120" autocomplete="off"
                    oninput="searchSubProcMaster(${pno},this.value)"
                    onkeydown="if(event.key==='Escape')hideForm('subForm_${pno}','subBtn_${pno}')">
                <div id="subProcDd_${pno}" class="part-search-dropdown" style="display:none"></div>
                <input type="hidden" id="subProcId_${pno}">
            </div>
            <button class="rd-if-ok" onclick="submitNewSubprocess(${pno})"><span class="material-icons-outlined">check</span></button>
            <button class="rd-if-cancel" onclick="hideForm('subForm_${pno}','subBtn_${pno}');clearSubSearch(${pno})"><span class="material-icons-outlined">close</span></button>
        </div>
        <button class="rd-tree-addlink" id="subBtn_${pno}" onclick="showForm('subForm_${pno}','subInput_${pno}','subBtn_${pno}')">
            + sub-process
        </button>
    </div>`;
}

function treeAddProcHtml() {
    return `<div class="rd-tree-addproc">
        <div class="rd-tree-inline" id="addProcForm" style="display:none">
            <div style="position:relative;flex:1">
                <input id="newProcSearch" placeholder="Search process master…" maxlength="120" autocomplete="off"
                    oninput="searchProcMaster(this.value)"
                    onkeydown="if(event.key==='Escape')hideForm('addProcForm','addProcBtn')">
                <div id="procMasterDropdown" class="part-search-dropdown" style="display:none"></div>
                <input type="hidden" id="newProcMasterId">
            </div>
            <button class="rd-if-ok" onclick="submitNewProcess()"><span class="material-icons-outlined">check</span></button>
            <button class="rd-if-cancel" onclick="hideForm('addProcForm','addProcBtn');clearProcSearch()"><span class="material-icons-outlined">close</span></button>
        </div>
        <button class="rd-tree-addlink proc" id="addProcBtn" onclick="showForm('addProcForm','newProcSearch','addProcBtn')">
            <span class="material-icons-outlined" style="font-size:14px">add</span> Add Process
        </button>
    </div>`;
}

let _subProcTimer = {};
function searchSubProcMaster(pno, q) {
    clearTimeout(_subProcTimer[pno]);
    const dd = document.getElementById(`subProcDd_${pno}`);
    document.getElementById(`subProcId_${pno}`).value = '';
    if (!q) { dd.style.display = 'none'; return; }
    _subProcTimer[pno] = setTimeout(async () => {
        const res  = await fetch(`${API}/processes?q=${encodeURIComponent(q)}`, { headers: getH() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(p =>
            `<div class="part-search-option" onclick="selectSubProcMaster(${pno},'${p.id}','${esc(p.process_code)}','${esc(p.process_name)}')">
                <span class="part-search-code">${esc(p.process_code)}</span>
                <span class="part-search-desc">${esc(p.process_name)}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${p.machines.length} machine${p.machines.length!==1?'s':''}</span>
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 200);
}
function selectSubProcMaster(pno, id, code, name) {
    document.getElementById(`subProcId_${pno}`).value = id;
    document.getElementById(`subInput_${pno}`).value  = `${code} — ${name}`;
    document.getElementById(`subProcDd_${pno}`).style.display = 'none';
}
function clearSubSearch(pno) {
    const inp = document.getElementById(`subInput_${pno}`);
    const dd  = document.getElementById(`subProcDd_${pno}`);
    const hd  = document.getElementById(`subProcId_${pno}`);
    if (inp) inp.value = '';
    if (dd)  dd.style.display = 'none';
    if (hd)  hd.value = '';
}

let _procSearchTimer = null;
function searchProcMaster(q) {
    clearTimeout(_procSearchTimer);
    const dd = document.getElementById('procMasterDropdown');
    document.getElementById('newProcMasterId').value = '';
    if (!q) { dd.style.display = 'none'; return; }
    _procSearchTimer = setTimeout(async () => {
        const res  = await fetch(`${API}/processes?q=${encodeURIComponent(q)}`, { headers: getH() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(p =>
            `<div class="part-search-option" onclick="selectProcMaster('${p.id}','${esc(p.process_code)}','${esc(p.process_name)}')">
                <span class="part-search-code">${esc(p.process_code)}</span>
                <span class="part-search-desc">${esc(p.process_name)}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${p.machines.length} machine${p.machines.length!==1?'s':''}</span>
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 200);
}
function selectProcMaster(id, code, name) {
    document.getElementById('newProcMasterId').value = id;
    document.getElementById('newProcSearch').value   = `${code} — ${name}`;
    document.getElementById('procMasterDropdown').style.display = 'none';
}
function clearProcSearch() {
    const el = document.getElementById('newProcSearch');
    const dd = document.getElementById('procMasterDropdown');
    const hd = document.getElementById('newProcMasterId');
    if (el) el.value = '';
    if (dd) dd.style.display = 'none';
    if (hd) hd.value = '';
}

// ── SELECT STEP → render detail ──
function selectStep(id) {
    _activeStep = id;
    renderTree();
    renderDetail(id);
}

function _machineCardsHtml(step) {
    if (!step.machines.length) return `<div class="rd-detail-empty" style="padding:24px">
        <span class="material-icons-outlined">precision_manufacturing</span>
        <strong>No machines assigned</strong>
        ${_editMode ? 'Click <em>Add Machine</em> below.' : 'Switch to Edit mode to assign machines.'}
    </div>`;
    return `<div class="rd-mcard-list">${step.machines.map(m => {
        const cost = parseFloat(m.mhr||0) * parseFloat(m.cycle_time_minutes||0) / 60;
        const ctDisplay = _editMode
            ? `<div class="rd-mcard-stat rd-mcard-stat-ct">
                <span class="rd-mcard-stat-lbl">Cycle Time</span>
                <div style="display:flex;align-items:center;gap:4px;margin-top:2px">
                    <input type="number" class="rd-ct-input" id="ctinp_${m.id}" value="${parseFloat(m.cycle_time_minutes||0)}" min="0" step="0.001"
                        style="width:72px;padding:3px 6px;border:1px solid var(--border-color);border-radius:5px;font-size:13px;font-weight:700;background:var(--bg-secondary);color:var(--text-primary);outline:none"
                        onfocus="this.style.borderColor='var(--accent)'"
                        onblur="this.style.borderColor='var(--border-color)'">
                    <span style="font-size:11px;color:var(--text-muted)">min</span>
                    <button class="rd-ct-save" onclick="saveCycleTime('${step.id}','${m.id}')" title="Save cycle time">
                        <span class="material-icons-outlined">check</span>
                    </button>
                </div>
               </div>`
            : `<div class="rd-mcard-stat"><span class="rd-mcard-stat-lbl">Cycle Time</span>
                <span class="rd-mcard-stat-val">${fmtN4(m.cycle_time_minutes)} <small style="font-size:11px;font-weight:500;color:var(--text-muted)">min</small></span></div>`;
        return `<div class="rd-mcard ${m.is_preferred?'pref':''}">
            <div class="rd-mcard-header">
                <div class="rd-mcard-icon"><span class="material-icons-outlined">precision_manufacturing</span></div>
                <div class="rd-mcard-left">
                    <div class="rd-mcard-code">${esc(m.machine_code)}</div>
                    <div class="rd-mcard-name">${esc(m.machine_name)}</div>
                </div>
                <div class="rd-mcard-right">
                    ${m.machine_type ? `<span class="rd-mcard-type">${esc(m.machine_type)}</span>` : ''}
                    ${m.is_preferred
                        ? `<span class="rd-mcard-pref-badge">★ Preferred</span>`
                        : (_editMode ? `<button class="rd-mcard-setpref" onclick="setPreferred('${step.id}','${m.id}')">Set Preferred</button>` : '')}
                    ${_editMode ? `<button class="rd-mcard-del" onclick="confirmDeleteSM('${step.id}','${m.id}','${esc(m.machine_name)}')">
                        <span class="material-icons-outlined">delete</span></button>` : ''}
                </div>
            </div>
            <div class="rd-mcard-body">
                ${ctDisplay}
                <div class="rd-mcard-stat"><span class="rd-mcard-stat-lbl">MHR</span>
                    <span class="rd-mcard-stat-val">₹${fmtN(m.mhr)} <small style="font-size:11px;font-weight:500;color:var(--text-muted)">/hr</small></span></div>
                <div class="rd-mcard-stat"><span class="rd-mcard-stat-lbl">Cost / Cycle</span>
                    <span class="rd-mcard-stat-val" id="ctcost_${m.id}">₹${fmtN(cost,4)}</span></div>
            </div>
        </div>`;
    }).join('')}</div>`;
}

function renderDetail(id) {
    const step = _steps.find(s => s.id === id);
    if (!step) return;
    const detailEl = document.getElementById('rdDetail');
    const titleEl  = document.getElementById('rdDetailTitle');

    const subs    = _steps.filter(s => s.process_no === step.process_no && s.subprocess_no)
                          .sort((a,b) => a.subprocess_no - b.subprocess_no);
    const isProc  = !step.subprocess_no;

    // ── summary stats ──
    const totalCT   = step.machines.reduce((a,m) => a + parseFloat(m.cycle_time_minutes||0), 0);
    const prefM     = step.machines.find(m => m.is_preferred);
    const prefCost  = prefM ? parseFloat(prefM.mhr||0) * parseFloat(prefM.cycle_time_minutes||0) / 60 : null;

    // for main process: also roll up sub totals
    const subTotalCT   = isProc ? subs.reduce((a,s) => a + s.machines.reduce((b,m) => b + parseFloat(m.cycle_time_minutes||0), 0), 0) : 0;
    const subPrefCost  = isProc ? subs.reduce((a,s) => {
        const pm = s.machines.find(m => m.is_preferred) || s.machines[0];
        return a + (pm ? parseFloat(pm.mhr||0) * parseFloat(pm.cycle_time_minutes||0) / 60 : 0);
    }, 0) : 0;

    titleEl.innerHTML = `
        <div class="rd-detail-header">
            <div class="rd-detail-step-num">${esc(step.step_code)}</div>
            <div class="rd-detail-step-info">
                <div class="rd-detail-step-code">${isProc ? `Process ${step.process_no}` : `Process ${step.process_no} · Sub-process ${step.subprocess_no}`}</div>
                <div class="rd-detail-step-name">${esc(step.step_name)}</div>
            </div>
            <span class="rd-step-type-badge ${isProc?'proc':'sub'}">${isProc?'Main Process':'Sub-process'}</span>
        </div>
        <div class="rd-step-summary">
            <div class="rd-step-summary-cell">
                <span class="rd-step-summary-lbl">Machines Assigned</span>
                <span class="rd-step-summary-val">${step.machines.length || '—'}</span>
            </div>
            <div class="rd-step-summary-cell">
                <span class="rd-step-summary-lbl">${isProc ? 'Sub-processes' : 'Parent Process'}</span>
                <span class="rd-step-summary-val">${isProc ? (subs.length || '—') : `Process ${step.process_no}`}</span>
            </div>
            <div class="rd-step-summary-cell">
                <span class="rd-step-summary-lbl">${isProc ? 'Total Cycle Time (incl. subs)' : 'Total Cycle Time'}</span>
                <span class="rd-step-summary-val">${(totalCT + subTotalCT) ? fmtN4(totalCT + subTotalCT) + ' min' : '—'}</span>
            </div>
            <div class="rd-step-summary-cell">
                <span class="rd-step-summary-lbl">${isProc ? 'Preferred Cost (incl. subs)' : 'Preferred Cost / Cycle'}</span>
                <span class="rd-step-summary-val">${(prefCost !== null || subPrefCost) ? '₹' + fmtN(( prefCost||0) + subPrefCost, 4) : '—'}</span>
            </div>
        </div>`;

    let html = '';

    // ── own machines ──
    html += `<div class="rd-detail-section-label">Machines — ${esc(step.step_name)}</div>`;
    html += _machineCardsHtml(step);
    if (_editMode) html += `<button class="btn-primary" style="margin:10px 0 16px" onclick="openAssignMachine('${step.id}','${esc(step.step_code)} — ${esc(step.step_name)}')">
        <span class="material-icons-outlined">add</span>Add Machine</button>`;

    // ── sub-process breakdown (only when main process selected) ──
    if (isProc && subs.length) {
        html += `<div class="rd-sub-breakdown">`;
        subs.forEach(sub => {
            const subCT   = sub.machines.reduce((a,m) => a + parseFloat(m.cycle_time_minutes||0), 0);
            const subPref = sub.machines.find(m => m.is_preferred);
            const subCost = subPref ? parseFloat(subPref.mhr||0) * parseFloat(subPref.cycle_time_minutes||0) / 60 : null;
            html += `<div class="rd-sub-block">
                <div class="rd-sub-block-head" onclick="selectStep('${sub.id}')">
                    <div class="rd-sub-block-num">${String(sub.subprocess_no).padStart(2,'0')}</div>
                    <div class="rd-sub-block-info">
                        <span class="rd-sub-block-name">${esc(sub.step_name)}</span>
                        <span class="rd-sub-block-meta">
                            ${sub.machines.length} machine${sub.machines.length!==1?'s':''}
                            ${subCT ? `· ${fmtN4(subCT)} min` : ''}
                            ${subCost !== null ? `· ₹${fmtN(subCost,4)}/cycle` : ''}
                        </span>
                    </div>
                    <span class="rd-step-type-badge sub" style="flex-shrink:0">Sub</span>
                    <span class="material-icons-outlined" style="font-size:16px;color:var(--text-muted);flex-shrink:0">open_in_new</span>
                </div>
                <div class="rd-sub-block-body">
                    ${_machineCardsHtml(sub)}
                    ${_editMode ? `<button class="btn-primary" style="margin:8px 0 4px" onclick="openAssignMachine('${sub.id}','${esc(sub.step_code)} — ${esc(sub.step_name)}')">
                        <span class="material-icons-outlined">add</span>Add Machine</button>` : ''}
                </div>
            </div>`;
        });
        html += `</div>`;
    }

    detailEl.innerHTML = html;
}

// ── FORM HELPERS ──
function showForm(formId, inputId, btnId) {
    const f = document.getElementById(formId), b = document.getElementById(btnId);
    if (f) f.style.display = 'flex';
    if (b) b.style.display = 'none';
    const inp = document.getElementById(inputId);
    if (inp) { inp.value = ''; inp.focus(); }
}
function hideForm(formId, btnId) {
    const f = document.getElementById(formId), b = document.getElementById(btnId);
    if (f) f.style.display = 'none';
    if (b) b.style.display = 'inline-flex';
}

// ── SET PREFERRED ──
async function setPreferred(stepId, smId) {
    const res  = await fetch(`${API}/steps/${stepId}/machines/${smId}`, {
        method: 'PUT', headers: getH(), body: JSON.stringify({ is_preferred: true })
    });
    const data = await res.json();
    if (data.success) loadRouting();
    else toast(data.message || 'Error', 'error');
}

// ── SAVE CYCLE TIME INLINE ──
async function saveCycleTime(stepId, smId) {
    const inp = document.getElementById(`ctinp_${smId}`);
    const ct  = parseFloat(inp?.value) || 0;
    const res  = await fetch(`${API}/steps/${stepId}/machines/${smId}`, {
        method: 'PUT', headers: getH(), body: JSON.stringify({ cycle_time_minutes: ct })
    });
    const data = await res.json();
    if (data.success) { toast('Cycle time saved'); loadRouting(); }
    else toast(data.message || 'Error', 'error');
}

// ── ADD PROCESS ──
async function submitNewProcess() {
    const masterId = document.getElementById('newProcMasterId').value.trim();
    const rawVal   = document.getElementById('newProcSearch').value.trim();
    if (!rawVal) { toast('Select a process from the list', 'error'); return; }

    let stepName = rawVal;
    let masterMachines = [];
    if (masterId) {
        const pr = await fetch(`${API}/processes/${masterId}`, { headers: getH() });
        const pd = await pr.json();
        if (pd.success) { stepName = pd.data.process_name; masterMachines = pd.data.machines || []; }
    } else {
        stepName = rawVal.includes(' — ') ? rawVal.split(' — ').slice(1).join(' — ') : rawVal;
    }

    const pno = _nextProcessNo();
    if (!pno) { toast('Maximum 80 processes reached', 'error'); return; }

    hideForm('addProcForm', 'addProcBtn');
    clearProcSearch();
    _openCTModal({ type: 'proc', pno, sno: null, stepName, machines: masterMachines });
}

// ── ADD SUB-PROCESS ──
async function submitNewSubprocess(pno) {
    const rawVal   = document.getElementById(`subInput_${pno}`).value.trim();
    const masterId = document.getElementById(`subProcId_${pno}`).value.trim();
    if (!rawVal) { toast('Select a process from the list', 'error'); return; }

    let stepName = rawVal;
    let masterMachines = [];
    if (masterId) {
        const pr = await fetch(`${API}/processes/${masterId}`, { headers: getH() });
        const pd = await pr.json();
        if (pd.success) { stepName = pd.data.process_name; masterMachines = pd.data.machines || []; }
    } else {
        stepName = rawVal.includes(' — ') ? rawVal.split(' — ').slice(1).join(' — ') : rawVal;
    }

    const sno = _nextSubNo(pno);
    if (!sno) { toast('Maximum 80 sub-processes reached', 'error'); return; }

    clearSubSearch(pno);
    hideForm(`subForm_${pno}`, `subBtn_${pno}`);
    _openCTModal({ type: 'sub', pno, sno, stepName, machines: masterMachines });
}

// ── CYCLE TIME MODAL ──
function _openCTModal(pending) {
    _pendingStep = pending;
    const label = pending.type === 'proc'
        ? `Process ${pending.pno} — ${pending.stepName}`
        : `Process ${pending.pno}.${pending.sno} — ${pending.stepName}`;
    document.getElementById('ctModalLabel').textContent = label;

    const rowsEl = document.getElementById('ctMachineRows');
    if (!pending.machines.length) {
        rowsEl.innerHTML = `<p style="font-size:12px;color:var(--text-muted);padding:8px 0">No machines from process master — you can add machines after the step is created.</p>`;
    } else {
        rowsEl.innerHTML = pending.machines.map((m, i) => `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
                <div style="flex:1;min-width:0">
                    <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${esc(m.machine_code)}</div>
                    <div style="font-size:11px;color:var(--text-muted)">${esc(m.machine_name)}${m.is_preferred ? ' <span style="color:var(--accent)">★</span>' : ''}</div>
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
                    <input type="number" id="ct_${i}" min="0" step="0.001" placeholder="0.000"
                        style="width:90px;padding:5px 8px;border:1px solid var(--border-color);border-radius:6px;font-size:13px;background:var(--bg-primary);color:var(--text-primary)">
                    <span style="font-size:11px;color:var(--text-muted)">min</span>
                </div>
            </div>`).join('');
    }
    openM('ctModal');
}

async function confirmCTAndSave() {
    const p = _pendingStep;
    closeM('ctModal');

    const res = await fetch(`${API}/routings/${ROUTING_ID}/steps`, {
        method: 'POST', headers: getH(),
        body: JSON.stringify({ process_no: p.pno, subprocess_no: p.sno || undefined, step_name: p.stepName })
    });
    const data = await res.json();
    if (!data.success) { toast(data.message || 'Error', 'error'); return; }

    const sid = data.data.id;
    _exp[sid] = true;
    for (let i = 0; i < p.machines.length; i++) {
        const m  = p.machines[i];
        const ct = parseFloat(document.getElementById(`ct_${i}`)?.value) || 0;
        await fetch(`${API}/steps/${sid}/machines`, {
            method: 'POST', headers: getH(),
            body: JSON.stringify({ machine_id: m.machine_id, cycle_time_minutes: ct, is_preferred: m.is_preferred })
        });
    }
    toast(`${p.type === 'proc' ? 'Process' : 'Sub-process'} added${p.machines.length ? ` with ${p.machines.length} machine(s)` : ''}`);
    loadRouting();
}

// ── DELETE STEP ──
function confirmDeleteStep(sid, code) {
    document.getElementById('deleteMsg').textContent = `Delete "${code}" and all its machine assignments?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res  = await fetch(`${API}/routings/${ROUTING_ID}/steps/${sid}`, { method: 'DELETE', headers: getH() });
        const data = await res.json();
        if (data.success) {
            closeM('deleteModal');
            if (_activeStep === sid) { _activeStep = null; document.getElementById('rdDetail').innerHTML = '<div class="rd-detail-empty"><span class="material-icons-outlined">touch_app</span>Select a process</div>'; }
            toast('Deleted'); loadRouting();
        } else toast(data.message || 'Error', 'error');
    };
    openM('deleteModal');
}

// ── MACHINE SEARCH ──
function searchMachines(q) {
    clearTimeout(_machTimer);
    const dd = document.getElementById('amMachineDropdown');
    if (!q) { dd.style.display = 'none'; return; }
    _machTimer = setTimeout(async () => {
        const res  = await fetch(`${MAPI}/search?q=${encodeURIComponent(q)}`, { headers: getH() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(m =>
            `<div class="part-search-option" onclick="selectMachine('${m.id}','${esc(m.machine_code)}','${esc(m.machine_name)}')">
                <span class="part-search-code">${esc(m.machine_code)}</span>
                <span class="part-search-desc">${esc(m.machine_name)}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${esc(m.machine_type||'')}</span>
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 200);
}
function selectMachine(id, code, name) {
    document.getElementById('amMachineId').value = id;
    document.getElementById('amMachineSearch').value = `${code} — ${name}`;
    document.getElementById('amMachineDropdown').style.display = 'none';
    document.getElementById('amMachineSelected').textContent = `✓ ${code} — ${name}`;
}
document.addEventListener('click', e => {
    if (!e.target.closest('#amMachineSearch') && !e.target.closest('#amMachineDropdown')) {
        const dd = document.getElementById('amMachineDropdown');
        if (dd) dd.style.display = 'none';
    }
    if (!e.target.closest('#newProcSearch') && !e.target.closest('#procMasterDropdown')) {
        const dd = document.getElementById('procMasterDropdown');
        if (dd) dd.style.display = 'none';
    }
    // close any open sub-process dropdowns
    if (!e.target.closest('[id^="subInput_"]') && !e.target.closest('[id^="subProcDd_"]')) {
        document.querySelectorAll('[id^="subProcDd_"]').forEach(dd => dd.style.display = 'none');
    }
});

// ── ASSIGN MACHINE ──
function openAssignMachine(stepId, label) {
    document.getElementById('amStepId').value = stepId;
    document.getElementById('amSmId').value   = '';
    document.getElementById('amStepLabel').textContent = label;
    document.getElementById('amMachineSearch').value   = '';
    document.getElementById('amMachineId').value       = '';
    document.getElementById('amMachineSelected').textContent = '';
    document.getElementById('amCycleTime').value  = '';
    document.getElementById('amPreferred').checked = false;
    openM('assignMachineModal');
}
async function saveStepMachine(e) {
    e.preventDefault();
    const stepId    = document.getElementById('amStepId').value;
    const smId      = document.getElementById('amSmId').value;
    const machineId = document.getElementById('amMachineId').value;
    if (!machineId) { toast('Please select a machine', 'error'); return; }
    const body = {
        machine_id: machineId,
        cycle_time_minutes: parseFloat(document.getElementById('amCycleTime').value) || 0,
        is_preferred: document.getElementById('amPreferred').checked
    };
    const url = smId ? `${API}/steps/${stepId}/machines/${smId}` : `${API}/steps/${stepId}/machines`;
    const res  = await fetch(url, { method: smId ? 'PUT' : 'POST', headers: getH(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeM('assignMachineModal'); toast('Machine assigned'); loadRouting(); }
    else toast(data.message || 'Error', 'error');
}

// ── DELETE MACHINE ──
function confirmDeleteSM(stepId, smId, name) {
    document.getElementById('deleteMsg').textContent = `Remove machine "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res  = await fetch(`${API}/steps/${stepId}/machines/${smId}`, { method: 'DELETE', headers: getH() });
        const data = await res.json();
        if (data.success) { closeM('deleteModal'); toast('Machine removed'); loadRouting(); }
        else toast(data.message || 'Error', 'error');
    };
    openM('deleteModal');
}

// ── COSTING TAB ──
async function loadCost() {
    const el = document.getElementById('rdCostPanel');
    el.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted)">
        <span class="material-icons-outlined" style="font-size:36px;display:block;margin-bottom:8px;animation:spin 1s linear infinite">autorenew</span>
        Calculating costs...
    </div>`;
    const res  = await fetch(`${API}/routings/${ROUTING_ID}/cost`, { headers: getH() });
    const data = await res.json();
    if (!data.success) { toast('Error loading cost', 'error'); return; }
    _costLoaded = true;
    const c = data.data;

    // formula explanation box
    const formulaHtml = `<div class="rd-cost-formula">
        <div class="rd-cost-formula-title"><span class="material-icons-outlined">info</span> How cost is calculated</div>
        <div class="rd-cost-formula-body">
            <div class="rd-formula-row"><span class="rd-formula-label">MHR (Machine Hour Rate)</span><span class="rd-formula-eq">= Depreciation + Power + Maintenance + Operator + Overhead</span></div>
            <div class="rd-formula-row"><span class="rd-formula-label">Depreciation/hr</span><span class="rd-formula-eq">= (Purchase Cost − Residual Value) ÷ (Life Years × Working Hours/Year)</span></div>
            <div class="rd-formula-row"><span class="rd-formula-label">Power/hr</span><span class="rd-formula-eq">= Power Rating (kW) × Electricity Rate (₹/kWh)</span></div>
            <div class="rd-formula-row"><span class="rd-formula-label">Maintenance/hr</span><span class="rd-formula-eq">= Annual AMC Cost ÷ Working Hours/Year</span></div>
            <div class="rd-formula-row"><span class="rd-formula-label">Cost per Cycle</span><span class="rd-formula-eq">= MHR × Cycle Time (min) ÷ 60</span></div>
        </div>
    </div>`;

    // steps table
    const stepsHtml = c.steps.map(s => {
        const optRows = s.machine_options.map(m => `
            <tr class="${m.is_preferred ? 'rd-cost-pref-row' : ''}">
                <td class="rd-cost-td mono">${esc(m.machine_code)}</td>
                <td class="rd-cost-td">${esc(m.machine_name)}</td>
                <td class="rd-cost-td right">${fmtN4(m.cycle_time_minutes)} min</td>
                <td class="rd-cost-td right">₹${fmtN(m.mhr)}/hr</td>
                <td class="rd-cost-td right bold ${m.is_preferred ? 'green' : ''}">₹${fmtN4(m.cost)}${m.is_preferred ? ' ★' : ''}</td>
            </tr>`).join('');
        return `<tbody>
            <tr class="rd-cost-step-row">
                <td colspan="4" class="rd-cost-td">
                    <span class="rd-cost-step-badge">${esc(s.step_code)}</span>
                    <span class="rd-cost-step-name">${esc(s.step_name)}</span>
                </td>
                <td class="rd-cost-td right bold green">₹${fmtN4(s.preferred_cost)}</td>
            </tr>
            ${optRows}
        </tbody>`;
    }).join('');

    el.innerHTML = `${formulaHtml}
    <div class="rd-cost-card">
        <div class="rd-cost-card-head">
            <span>Cost Breakdown — <span class="mono">${esc(c.part_number)}</span></span>
        </div>
        <div style="overflow-x:auto">
            <table class="rd-cost-table">
                <thead><tr>
                    <th class="rd-cost-th">Machine Code</th>
                    <th class="rd-cost-th">Machine Name</th>
                    <th class="rd-cost-th right">Cycle Time</th>
                    <th class="rd-cost-th right">MHR</th>
                    <th class="rd-cost-th right">Cost / Cycle</th>
                </tr></thead>
                ${stepsHtml}
            </table>
        </div>
        <div class="rd-cost-total-row">
            <span>Total Manufacturing Cost</span>
            <span class="rd-cost-total-val">₹${fmtN(c.total_manufacturing_cost)}</span>
        </div>
    </div>`;
}

loadRouting();
