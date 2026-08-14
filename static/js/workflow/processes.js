// ─── ALL PROCESSES ───
const API  = '/api/v1/workflow-costing';
const MAPI = '/api/v1/machine';

let _procs      = [];
let _filtered   = [];
let _activeProc = null;   // full process object currently in panel
let _panelEdit  = false;
let _machTimer  = null;

// pending machines for new-process modal
let _newMachines = [];   // [{machine_id, machine_code, machine_name, cycle_time_minutes, is_preferred}]
let _newMachSel  = null; // {id, code, name}

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
function openM(id)  { document.getElementById(id).classList.add('active'); }
function closeM(id) { document.getElementById(id).classList.remove('active'); }
function toast(msg, type='success') {
    const t = document.getElementById('wfToast');
    t.textContent = msg; t.className = `wf-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── LOAD ──
async function loadProcesses() {
    const res  = await fetch(`${API}/processes`, { headers: getH() });
    const data = await res.json();
    _procs    = data.data || [];
    _filtered = [..._procs];
    renderGrid();
    renderStats();
}

function filterProcs(q) {
    const lq = q.toLowerCase();
    _filtered = q ? _procs.filter(p =>
        p.process_name.toLowerCase().includes(lq) ||
        p.process_code.toLowerCase().includes(lq) ||
        (p.description||'').toLowerCase().includes(lq)
    ) : [..._procs];
    renderGrid();
}

function renderStats() {
    const totalM = _procs.reduce((a,p) => a + p.machines.length, 0);
    document.getElementById('procStats').innerHTML =
        `<span class="proc-stat-pill">${_procs.length} processes</span>` +
        `<span class="proc-stat-pill">${totalM} machine assignments</span>`;
}

function renderGrid() {
    const el = document.getElementById('procGrid');
    if (!_filtered.length) {
        el.innerHTML = `<div class="rd-detail-empty" style="grid-column:1/-1;padding:60px 24px">
            <span class="material-icons-outlined">category</span>
            <strong>No processes found</strong>
            Click <em>New Process</em> to create your first one.
        </div>`;
        return;
    }
    el.innerHTML = _filtered.map(p => {
        const mCount = p.machines.length;
        const pref   = p.machines.find(m => m.is_preferred);
        const machPills = p.machines.slice(0,3).map(m =>
            `<span class="proc-card-mach-pill ${m.is_preferred?'pref':''}">${esc(m.machine_code)}</span>`
        ).join('') + (mCount > 3 ? `<span class="proc-card-mach-pill more">+${mCount-3}</span>` : '');

        return `<div class="proc-card" onclick="openPanel('${p.id}')">
            <div class="proc-card-header">
                <div class="proc-card-icon"><span class="material-icons-outlined">settings</span></div>
                <div class="proc-card-meta">
                    <div class="proc-card-code">${esc(p.process_code)}</div>
                    <div class="proc-card-name">${esc(p.process_name)}</div>
                </div>
                <button class="proc-card-del" onclick="event.stopPropagation();confirmDelete('${p.id}','${esc(p.process_name)}')" title="Delete">
                    <span class="material-icons-outlined">delete</span>
                </button>
            </div>
            ${p.description ? `<div class="proc-card-desc">${esc(p.description)}</div>` : ''}
            <div class="proc-card-footer">
                <div class="proc-card-mach-row">
                    ${mCount ? machPills : '<span style="font-size:11px;color:var(--text-muted)">No machines assigned</span>'}
                </div>
                <span class="proc-card-mcount">${mCount} machine${mCount!==1?'s':''}</span>
            </div>
        </div>`;
    }).join('');
}

// ── PANEL ──
async function openPanel(id) {
    const res  = await fetch(`${API}/processes/${id}`, { headers: getH() });
    const data = await res.json();
    if (!data.success) return;
    _activeProc = data.data;
    _panelEdit  = false;
    renderPanel();
    document.getElementById('procPanel').classList.add('active');
    document.getElementById('procPanelOverlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closePanel() {
    document.getElementById('procPanel').classList.remove('active');
    document.getElementById('procPanelOverlay').classList.remove('active');
    document.body.style.overflow = '';
    _activeProc = null;
}

function renderPanel() {
    const p = _activeProc;
    document.getElementById('panelTitle').textContent = p.process_name;

    // hero
    document.getElementById('panelHero').innerHTML = `
        <div class="proc-panel-hero-icon"><span class="material-icons-outlined">settings</span></div>
        <div class="proc-panel-hero-body">
            <div class="proc-panel-hero-code">${esc(p.process_code)}</div>
            <div class="proc-panel-hero-name">${esc(p.process_name)}</div>
            ${p.description ? `<div class="proc-panel-hero-desc">${esc(p.description)}</div>` : ''}
        </div>
        <div class="proc-panel-hero-stats">
            <div class="proc-panel-stat">
                <span class="proc-panel-stat-val">${p.machines.length}</span>
                <span class="proc-panel-stat-lbl">Machines</span>
            </div>
            <div class="proc-panel-stat">
                <span class="proc-panel-stat-val">${p.machines.filter(m=>m.is_preferred).length}</span>
                <span class="proc-panel-stat-lbl">Preferred</span>
            </div>
        </div>`;

    // machines
    const machEl = document.getElementById('panelMachines');
    if (!p.machines.length) {
        machEl.innerHTML = `<div class="rd-detail-empty" style="padding:32px 0">
            <span class="material-icons-outlined">precision_manufacturing</span>
            <strong>No machines assigned</strong>
        </div>`;
    } else {
        machEl.innerHTML = `<div class="rd-mcard-list">${p.machines.map(m => {
            const mhr = 0; // MHR not returned here, shown in routing detail
            return `<div class="rd-mcard ${m.is_preferred?'pref':''}">
                <div class="rd-mcard-header">
                    <div class="rd-mcard-icon"><span class="material-icons-outlined">precision_manufacturing</span></div>
                    <div class="rd-mcard-left">
                        <div class="rd-mcard-code">${esc(m.machine_code)}</div>
                        <div class="rd-mcard-name">${esc(m.machine_name)}</div>
                    </div>
                    <div class="rd-mcard-right">
                        ${m.machine_type ? `<span class="rd-mcard-type">${esc(m.machine_type)}</span>` : ''}
                        ${m.is_preferred ? `<span class="rd-mcard-pref-badge">★ Preferred</span>`
                            : `<button class="rd-mcard-setpref" onclick="setProcPreferred('${m.id}')">Set Preferred</button>`}
                        <button class="rd-mcard-del" onclick="removeProcMachine('${m.id}','${esc(m.machine_name)}')">
                            <span class="material-icons-outlined">delete</span>
                        </button>
                    </div>
                </div>
                <div class="rd-mcard-body">
                    <div class="rd-mcard-stat">
                        <span class="rd-mcard-stat-lbl">Role</span>
                        <span class="rd-mcard-stat-val">${m.is_preferred ? 'Preferred' : 'Alternative'}</span>
                    </div>
                    ${m.machine_type ? `<div class="rd-mcard-stat"><span class="rd-mcard-stat-lbl">Type</span><span class="rd-mcard-stat-val">${esc(m.machine_type)}</span></div>` : ''}
                    ${m.station_name ? `<div class="rd-mcard-stat"><span class="rd-mcard-stat-lbl">Station</span><span class="rd-mcard-stat-val">${esc(m.station_name)}</span></div>` : ''}
                </div>
            </div>`;
        }).join('')}</div>`;
    }

    // edit form pre-fill
    document.getElementById('editCode').value = p.process_code;
    document.getElementById('editName').value = p.process_name;
    document.getElementById('editDesc').value  = p.description || '';

    document.getElementById('panelView').style.display = '';
    document.getElementById('panelEdit').style.display = 'none';
    document.getElementById('panelEditBtn').innerHTML = '<span class="material-icons-outlined">edit</span>Edit';
}

function togglePanelEdit() {
    _panelEdit = !_panelEdit;
    document.getElementById('panelView').style.display = _panelEdit ? 'none' : '';
    document.getElementById('panelEdit').style.display = _panelEdit ? '' : 'none';
    document.getElementById('panelEditBtn').innerHTML = _panelEdit
        ? '<span class="material-icons-outlined">visibility</span>View'
        : '<span class="material-icons-outlined">edit</span>Edit';
}

async function saveProcess(e) {
    e.preventDefault();
    const body = {
        process_code: document.getElementById('editCode').value.trim(),
        process_name: document.getElementById('editName').value.trim(),
        description:  document.getElementById('editDesc').value.trim()
    };
    const res  = await fetch(`${API}/processes/${_activeProc.id}`, {
        method: 'PUT', headers: getH(), body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.success) {
        toast('Process updated');
        await loadProcesses();
        await openPanel(_activeProc.id);
    } else toast(data.message || 'Error', 'error');
}

// ── SET PREFERRED ──
async function setProcPreferred(pmid) {
    await fetch(`${API}/processes/${_activeProc.id}/machines/${pmid}`, {
        method: 'PUT', headers: getH(), body: JSON.stringify({ is_preferred: true })
    });
    await openPanel(_activeProc.id);
    loadProcesses();
}

// ── REMOVE MACHINE FROM PROCESS ──
async function removeProcMachine(pmid, name) {
    document.getElementById('deleteMsg').textContent = `Remove machine "${name}" from this process?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res  = await fetch(`${API}/processes/${_activeProc.id}/machines/${pmid}`, { method: 'DELETE', headers: getH() });
        const data = await res.json();
        if (data.success) { closeM('deleteModal'); toast('Machine removed'); await openPanel(_activeProc.id); loadProcesses(); }
        else toast(data.message || 'Error', 'error');
    };
    openM('deleteModal');
}

// ── ADD MACHINE TO EXISTING PROCESS ──
function openAddMachine() {
    document.getElementById('addMachProcLabel').textContent = _activeProc.process_name;
    document.getElementById('amSearch').value = '';
    document.getElementById('amMachId').value = '';
    document.getElementById('amMachSelected').textContent = '';
    document.getElementById('amPref').checked = false;
    openM('addMachModal');
}

function searchMachinesAM(q) {
    clearTimeout(_machTimer);
    const dd = document.getElementById('amDropdown');
    if (!q) { dd.style.display = 'none'; return; }
    _machTimer = setTimeout(async () => {
        const res  = await fetch(`${MAPI}/search?q=${encodeURIComponent(q)}`, { headers: getH() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(m =>
            `<div class="part-search-option" onclick="selectMachAM('${m.id}','${esc(m.machine_code)}','${esc(m.machine_name)}')">
                <span class="part-search-code">${esc(m.machine_code)}</span>
                <span class="part-search-desc">${esc(m.machine_name)}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${esc(m.station_name||m.machine_type||'')}</span>
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 200);
}
function selectMachAM(id, code, name) {
    document.getElementById('amMachId').value = id;
    document.getElementById('amSearch').value = `${code} — ${name}`;
    document.getElementById('amDropdown').style.display = 'none';
    document.getElementById('amMachSelected').textContent = `✓ ${code} — ${name}`;
}

async function saveAddMachine(e) {
    e.preventDefault();
    const mid = document.getElementById('amMachId').value;
    if (!mid) { toast('Select a machine', 'error'); return; }
    const res  = await fetch(`${API}/processes/${_activeProc.id}/machines`, {
        method: 'POST', headers: getH(),
        body: JSON.stringify({
            machine_id: mid,
            is_preferred: document.getElementById('amPref').checked
        })
    });
    const data = await res.json();
    if (data.success) { closeM('addMachModal'); toast('Machine added'); await openPanel(_activeProc.id); loadProcesses(); }
    else toast(data.message || 'Error', 'error');
}

// ── NEW PROCESS MODAL ──
function openNewProcess() {
    _newMachines = [];
    _newMachSel  = null;
    document.getElementById('newCode').value = '';
    document.getElementById('newName').value = '';
    document.getElementById('newDesc').value = '';
    document.getElementById('newMachSearch').value = '';
    document.getElementById('newMachPref').checked = false;
    document.getElementById('newMachList').innerHTML = '';
    openM('newProcModal');
}

let _newMachTimer = null;
function searchMachinesNew(q) {
    clearTimeout(_newMachTimer);
    const dd = document.getElementById('newMachDropdown');
    if (!q) { dd.style.display = 'none'; return; }
    _newMachTimer = setTimeout(async () => {
        const res  = await fetch(`${MAPI}/search?q=${encodeURIComponent(q)}`, { headers: getH() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(m =>
            `<div class="part-search-option" onclick="selectMachNew('${m.id}','${esc(m.machine_code)}','${esc(m.machine_name)}')">
                <span class="part-search-code">${esc(m.machine_code)}</span>
                <span class="part-search-desc">${esc(m.machine_name)}</span>
                <span style="font-size:11px;color:var(--text-muted);margin-left:auto">${esc(m.station_name||m.machine_type||'')}</span>
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 200);
}
function selectMachNew(id, code, name) {
    _newMachSel = { id, code, name };
    document.getElementById('newMachSearch').value = `${code} — ${name}`;
    document.getElementById('newMachDropdown').style.display = 'none';
}

function addMachineToNew() {
    if (!_newMachSel) { toast('Select a machine first', 'error'); return; }
    if (_newMachines.find(m => m.machine_id === _newMachSel.id)) { toast('Already added', 'error'); return; }
    const pref = document.getElementById('newMachPref').checked;
    _newMachines.push({ machine_id: _newMachSel.id, machine_code: _newMachSel.code, machine_name: _newMachSel.name, is_preferred: pref });
    document.getElementById('newMachSearch').value = '';
    document.getElementById('newMachPref').checked = false;
    _newMachSel = null;
    renderNewMachList();
}

function removeNewMach(idx) {
    _newMachines.splice(idx, 1);
    renderNewMachList();
}

function renderNewMachList() {
    document.getElementById('newMachList').innerHTML = _newMachines.map((m,i) =>
        `<div class="proc-mach-preview-row">
            <span class="proc-mach-preview-code">${esc(m.machine_code)}</span>
            <span class="proc-mach-preview-name">${esc(m.machine_name)}</span>
            ${m.is_preferred ? '<span class="rd-mcard-pref-badge" style="font-size:10px">★ Preferred</span>' : ''}
            <button type="button" class="rd-mcard-del" onclick="removeNewMach(${i})"><span class="material-icons-outlined">close</span></button>
        </div>`
    ).join('');
}

async function createProcess(e) {
    e.preventDefault();
    const name = document.getElementById('newName').value.trim();
    if (!name) return;
    const body = {
        process_code: document.getElementById('newCode').value.trim() || undefined,
        process_name: name,
        description:  document.getElementById('newDesc').value.trim()
    };
    const res  = await fetch(`${API}/processes`, { method: 'POST', headers: getH(), body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.success) { toast(data.message || 'Error', 'error'); return; }
    const pid = data.data.id;
    // assign machines
    for (const m of _newMachines) {
        await fetch(`${API}/processes/${pid}/machines`, {
            method: 'POST', headers: getH(),
            body: JSON.stringify({ machine_id: m.machine_id, is_preferred: m.is_preferred })
        });
    }
    closeM('newProcModal');
    toast('Process created');
    await loadProcesses();
    openPanel(pid);
}

// ── DELETE PROCESS ──
function confirmDelete(id, name) {
    document.getElementById('deleteMsg').textContent = `Delete process "${name}"? This cannot be undone.`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res  = await fetch(`${API}/processes/${id}`, { method: 'DELETE', headers: getH() });
        const data = await res.json();
        if (data.success) { closeM('deleteModal'); toast('Process deleted'); loadProcesses(); if (_activeProc?.id === id) closePanel(); }
        else toast(data.message || 'Error', 'error');
    };
    openM('deleteModal');
}

// close dropdowns on outside click
document.addEventListener('click', e => {
    if (!e.target.closest('#amSearch') && !e.target.closest('#amDropdown'))
        document.getElementById('amDropdown').style.display = 'none';
    if (!e.target.closest('#newMachSearch') && !e.target.closest('#newMachDropdown'))
        document.getElementById('newMachDropdown').style.display = 'none';
});

loadProcesses();
