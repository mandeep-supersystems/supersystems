// ─── ROUTING DETAIL ───
const API  = '/api/v1/workflow-costing';
const MAPI = '/api/v1/machine';
let _steps      = [];
let _routing    = {};
let _editMode   = false;
let _exp        = {};
let _activeStep = null;   // currently selected step id
let _machTimer  = null;
let _costLoaded = false;

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

    if (!topSteps.length) {
        wrap.innerHTML = `<div class="rd-tree-empty">${_editMode
            ? 'Click <b>+ Add Process</b> to start.'
            : 'No processes yet.<br>Click Edit to begin.'}</div>`
            + (_editMode ? treeAddProcHtml() : '');
        return;
    }

    let html = '';
    topSteps.forEach(proc => {
        const subs     = _steps.filter(s => s.process_no === proc.process_no && s.subprocess_no)
                               .sort((a,b) => a.subprocess_no - b.subprocess_no);
        const expanded = _exp[proc.id] !== false;
        const isActive = _activeStep === proc.id;

        html += `<div class="rd-tree-proc">
            <div class="rd-tree-row ${isActive ? 'active' : ''}" onclick="selectStep('${proc.id}')">
                <button class="rd-tree-expbtn" onclick="toggleExp('${proc.id}',event)" title="${expanded?'Collapse':'Expand'}">
                    <span class="material-icons-outlined">${expanded ? 'expand_more' : 'chevron_right'}</span>
                </button>
                <span class="rd-tree-badge proc">${esc(proc.step_code)}</span>
                <span class="rd-tree-name">${esc(proc.step_name)}</span>
                ${_editMode ? `<button class="rd-tree-del" onclick="event.stopPropagation();confirmDeleteStep('${proc.id}','${esc(proc.step_code)}')" title="Delete">
                    <span class="material-icons-outlined">delete</span>
                </button>` : ''}
            </div>`;

        if (expanded) {
            subs.forEach(sub => {
                const subActive = _activeStep === sub.id;
                html += `<div class="rd-tree-sub">
                    <div class="rd-tree-row ${subActive ? 'active' : ''}" onclick="selectStep('${sub.id}')">
                        <span class="rd-tree-indent"></span>
                        <span class="rd-tree-badge sub">${esc(sub.step_code)}</span>
                        <span class="rd-tree-name sub">${esc(sub.step_name)}</span>
                        <span class="rd-tree-mcount">${sub.machines.length}</span>
                        ${_editMode ? `<button class="rd-tree-del" onclick="event.stopPropagation();confirmDeleteStep('${sub.id}','${esc(sub.step_code)}')" title="Delete">
                            <span class="material-icons-outlined">delete</span>
                        </button>` : ''}
                    </div>
                </div>`;
            });
            if (_editMode) {
                html += treeAddSubHtml(proc.process_no);
            }
        }
        html += `</div>`;
    });

    if (_editMode) html += treeAddProcHtml();
    wrap.innerHTML = html;
}

function treeAddSubHtml(pno) {
    return `<div class="rd-tree-addsub">
        <div class="rd-tree-inline" id="subForm_${pno}" style="display:none">
            <input id="subInput_${pno}" placeholder="Sub-process name..." maxlength="120" autocomplete="off"
                onkeydown="if(event.key==='Enter')submitNewSubprocess(${pno});else if(event.key==='Escape')hideForm('subForm_${pno}','subBtn_${pno}')">
            <button class="rd-if-ok" onclick="submitNewSubprocess(${pno})"><span class="material-icons-outlined">check</span></button>
            <button class="rd-if-cancel" onclick="hideForm('subForm_${pno}','subBtn_${pno}')"><span class="material-icons-outlined">close</span></button>
        </div>
        <button class="rd-tree-addlink" id="subBtn_${pno}" onclick="showForm('subForm_${pno}','subInput_${pno}','subBtn_${pno}')">
            + sub-process
        </button>
    </div>`;
}

function treeAddProcHtml() {
    return `<div class="rd-tree-addproc">
        <div class="rd-tree-inline" id="addProcForm" style="display:none">
            <input id="newProcName" placeholder="Process name..." maxlength="120" autocomplete="off"
                onkeydown="if(event.key==='Enter')submitNewProcess();else if(event.key==='Escape')hideForm('addProcForm','addProcBtn')">
            <button class="rd-if-ok" onclick="submitNewProcess()"><span class="material-icons-outlined">check</span></button>
            <button class="rd-if-cancel" onclick="hideForm('addProcForm','addProcBtn')"><span class="material-icons-outlined">close</span></button>
        </div>
        <button class="rd-tree-addlink proc" id="addProcBtn" onclick="showForm('addProcForm','newProcName','addProcBtn')">
            + Add Process
        </button>
    </div>`;
}

// ── SELECT STEP → render detail ──
function selectStep(id) {
    _activeStep = id;
    renderTree();
    renderDetail(id);
}

function renderDetail(id) {
    const step = _steps.find(s => s.id === id);
    if (!step) return;
    const titleEl  = document.getElementById('rdDetailTitle');
    const detailEl = document.getElementById('rdDetail');
    titleEl.textContent = `${step.step_code} — ${step.step_name}`;

    let html = '';

    // machine cards
    if (step.machines.length) {
        html += `<div class="rd-detail-section-label">Machines assigned</div>`;
        html += `<div class="rd-mcard-list">`;
        step.machines.forEach(m => {
            html += `<div class="rd-mcard ${m.is_preferred ? 'pref' : ''}">
                <div class="rd-mcard-top">
                    <div class="rd-mcard-left">
                        <span class="rd-mcard-code">${esc(m.machine_code)}</span>
                        <span class="rd-mcard-name">${esc(m.machine_name)}</span>
                        ${m.machine_type ? `<span class="rd-mcard-type">${esc(m.machine_type)}</span>` : ''}
                    </div>
                    <div class="rd-mcard-right">
                        ${m.is_preferred
                            ? `<span class="rd-mcard-pref-badge">★ Preferred</span>`
                            : (_editMode ? `<button class="rd-mcard-setpref" onclick="setPreferred('${step.id}','${m.id}')">Set Preferred</button>` : '')}
                        ${_editMode ? `<button class="rd-mcard-del" onclick="confirmDeleteSM('${step.id}','${m.id}','${esc(m.machine_name)}')">
                            <span class="material-icons-outlined">delete</span>
                        </button>` : ''}
                    </div>
                </div>
                <div class="rd-mcard-row">
                    <div class="rd-mcard-stat">
                        <span class="rd-mcard-stat-lbl">Cycle Time</span>
                        <span class="rd-mcard-stat-val">${fmtN4(m.cycle_time_minutes)} min</span>
                    </div>
                    <div class="rd-mcard-stat">
                        <span class="rd-mcard-stat-lbl">MHR</span>
                        <span class="rd-mcard-stat-val">₹${fmtN(m.mhr)}/hr</span>
                    </div>
                </div>
            </div>`;
        });
        html += `</div>`;
    } else {
        html += `<div class="rd-detail-empty"><span class="material-icons-outlined">precision_manufacturing</span>No machines assigned yet</div>`;
    }

    if (_editMode) {
        html += `<button class="btn-primary" style="margin-top:16px" onclick="openAssignMachine('${step.id}','${esc(step.step_code)} — ${esc(step.step_name)}')">
            <span class="material-icons-outlined">add</span> Add Machine
        </button>`;
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

// ── ADD PROCESS ──
async function submitNewProcess() {
    const name = document.getElementById('newProcName').value.trim();
    if (!name) { toast('Enter a process name', 'error'); return; }
    const pno = _nextProcessNo();
    if (!pno) { toast('Maximum 80 processes reached', 'error'); return; }
    const res  = await fetch(`${API}/routings/${ROUTING_ID}/steps`, {
        method: 'POST', headers: getH(),
        body: JSON.stringify({ process_no: pno, step_name: name })
    });
    const data = await res.json();
    if (data.success) { _exp[data.data.id] = true; toast(`Process ${pno} added`); loadRouting(); }
    else toast(data.message || 'Error', 'error');
}

// ── ADD SUB-PROCESS ──
async function submitNewSubprocess(pno) {
    const name = document.getElementById(`subInput_${pno}`).value.trim();
    if (!name) { toast('Enter a sub-process name', 'error'); return; }
    const sno = _nextSubNo(pno);
    if (!sno) { toast('Maximum 80 sub-processes reached', 'error'); return; }
    const res  = await fetch(`${API}/routings/${ROUTING_ID}/steps`, {
        method: 'POST', headers: getH(),
        body: JSON.stringify({ process_no: pno, subprocess_no: sno, step_name: name })
    });
    const data = await res.json();
    if (data.success) { _exp[data.data.id] = true; toast('Sub-process added'); loadRouting(); }
    else toast(data.message || 'Error', 'error');
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
