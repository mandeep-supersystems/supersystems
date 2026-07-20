// ─── MACHINE MODULE ───
const API = '/api/v1/machine';
let allMachines = [], allStations = [];

function getH() {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';
    const tenant = localStorage.getItem('tenant_id') || sessionStorage.getItem('tenant_id') || 'TEST';
    const email = localStorage.getItem('user_email') || sessionStorage.getItem('user_email') || '';
    const name = localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenant, 'X-User-Email': email, 'X-User-Name': name };
}
function esc(s) { const d = document.createElement('div'); d.textContent = String(s||''); return d.innerHTML; }
function fmtDate(s) { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}); } catch { return s; } }
function fmtN(n) { return parseFloat(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:4}); }
function openM(id) { document.getElementById(id).classList.add('active'); }
function closeM(id) { document.getElementById(id).classList.remove('active'); }
function toast(msg, type='success') {
    const t = document.getElementById('mchToast');
    t.textContent = msg; t.className = `mch-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3200);
}
function showSec(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-sec]').forEach(l => l.classList.remove('active'));
    document.getElementById('sec-' + sec).classList.add('active');
    document.querySelector(`.sidebar-link[data-sec="${sec}"]`).classList.add('active');
    const secMap = { machines: { label: 'Machines', icon: 'precision_manufacturing' }, stations: { label: 'Stations', icon: 'location_on' }, mhr: { label: 'MHR Calculator', icon: 'calculate' } };
    if (secMap[sec]) trackModule(secMap[sec].label, secMap[sec].icon, '/machine/' + sec);
    if (sec === 'machines') loadMachines();
    if (sec === 'stations') loadStations();
    if (sec === 'mhr') loadMHRMachineList();
}

// ── MACHINES ──
async function loadMachines() {
    const res = await fetch(`${API}/machines`, { headers: getH() });
    const data = await res.json();
    allMachines = data.data || [];
    renderMachines(allMachines);
}

function filterMachines(q) {
    const lq = (q||'').toLowerCase();
    const status = document.getElementById('machineStatusFilter').value;
    const filtered = allMachines.filter(m => {
        const matchQ = !lq || lq.length < 2 ||
            (m.machine_name||'').toLowerCase().includes(lq) ||
            (m.machine_code||'').toLowerCase().includes(lq) ||
            (m.machine_type||'').toLowerCase().includes(lq);
        const matchS = !status || (m.current_status||'') === status;
        return matchQ && matchS;
    });
    renderMachines(filtered);
}

function statusBadge(s) {
    const map = { active:'status-active', under_maintenance:'status-maintenance', retired:'status-retired' };
    const label = { active:'Active', under_maintenance:'Under Maintenance', retired:'Retired' };
    return `<span class="status-badge ${map[s]||''}">${label[s]||esc(s)}</span>`;
}

function renderMachines(list) {
    const el = document.getElementById('machineCards');
    if (!list.length) { el.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted)">No machines found.</div>'; return; }
    el.innerHTML = `<div class="mch-table-wrap"><table class="mch-table">
        <thead><tr>
            <th>Code</th>
            <th>Machine Name</th>
            <th>Type</th>
            <th>Make / Model</th>
            <th>Station</th>
            <th class="right">Power (kW)</th>
            <th class="right">MHR (₹/hr)</th>
            <th>Status</th>
            <th>Actions</th>
        </tr></thead>
        <tbody>${list.map(m => `
        <tr>
            <td><span class="mch-code">${esc(m.machine_code)}</span></td>
            <td><span class="mch-name">${esc(m.machine_name)}</span></td>
            <td>${esc(m.machine_type||'—')}</td>
            <td class="mch-muted">${[m.make, m.model].filter(Boolean).map(esc).join(' · ') || '—'}</td>
            <td class="mch-muted">${esc(m.station_name||'—')}</td>
            <td class="right mch-muted">${m.power_rating_kw ? fmtN(m.power_rating_kw) : '—'}</td>
            <td class="right"><span class="mch-mhr">₹${fmtN(m.mhr)}</span></td>
            <td>${statusBadge(m.current_status||'active')}</td>
            <td><div class="actions-cell">
                <button class="btn-action" title="Edit" onclick="editMachine('${m.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action" title="Efficiency" onclick="openEffModal('${m.id}')"><span class="material-icons-outlined">speed</span></button>
                <button class="btn-action btn-danger" title="Delete" onclick="confirmDelete('machine','${m.id}','${esc(m.machine_name)}')"><span class="material-icons-outlined">delete</span></button>
            </div></td>
        </tr>`).join('')}
        </tbody>
    </table></div>`;
}

function openMachineModal() {
    document.getElementById('machineModalTitle').textContent = 'New Machine';
    document.getElementById('mId').value = '';
    ['mCode','mName','mMake','mModel','mVendor','mInvoice','mNotes'].forEach(id => document.getElementById(id).value = '');
    ['mBuyDate','mInstDate','mWarranty','mAMC'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('mType').value = '';
    document.getElementById('mStatus').value = 'active';
    document.getElementById('mCost').value = 0;
    document.getElementById('mDepLife').value = 10;
    document.getElementById('mResidual').value = 0;
    document.getElementById('mPower').value = 0;
    document.getElementById('mHrsDay').value = 8;
    document.getElementById('mShifts').value = 1;
    document.getElementById('mDays').value = 250;
    document.getElementById('mElec').value = 0;
    document.getElementById('mAMCCost').value = 0;
    document.getElementById('mOpCost').value = 0;
    document.getElementById('mOverhead').value = 0;
    document.getElementById('mCap').value = '';
    document.getElementById('mStation').value = '';
    openM('machineModal');
}

async function editMachine(id) {
    const res = await fetch(`${API}/machines/${id}`, { headers: getH() });
    const data = await res.json();
    if (!data.success) { toast('Error loading machine', 'error'); return; }
    const m = data.data;
    document.getElementById('machineModalTitle').textContent = 'Edit Machine';
    document.getElementById('mId').value = m.id;
    document.getElementById('mCode').value = m.machine_code || '';
    document.getElementById('mName').value = m.machine_name || '';
    document.getElementById('mType').value = m.machine_type || '';
    document.getElementById('mStatus').value = m.current_status || 'active';
    document.getElementById('mMake').value = m.make || '';
    document.getElementById('mModel').value = m.model || '';
    document.getElementById('mCost').value = m.purchase_cost || 0;
    document.getElementById('mBuyDate').value = m.buying_date ? m.buying_date.split('T')[0] : '';
    document.getElementById('mVendor').value = m.vendor || '';
    document.getElementById('mInvoice').value = m.invoice_ref || '';
    document.getElementById('mInstDate').value = m.installation_date ? m.installation_date.split('T')[0] : '';
    document.getElementById('mWarranty').value = m.warranty_expiry ? m.warranty_expiry.split('T')[0] : '';
    document.getElementById('mAMC').value = m.amc_expiry ? m.amc_expiry.split('T')[0] : '';
    document.getElementById('mDepLife').value = m.depreciation_life_years || 10;
    document.getElementById('mResidual').value = m.residual_value || 0;
    document.getElementById('mStation').value = m.station_id || '';
    document.getElementById('mPower').value = m.power_rating_kw || 0;
    document.getElementById('mHrsDay').value = m.max_hours_per_day || 8;
    document.getElementById('mShifts').value = m.shifts_per_day || 1;
    document.getElementById('mDays').value = m.working_days_per_year || 250;
    document.getElementById('mCap').value = m.rated_capacity || '';
    document.getElementById('mElec').value = m.electricity_rate || 0;
    document.getElementById('mAMCCost').value = m.annual_amc_cost || 0;
    document.getElementById('mOpCost').value = m.operator_cost_per_hour || 0;
    document.getElementById('mOverhead').value = m.overhead_percent || 0;
    document.getElementById('mNotes').value = m.notes || '';
    openM('machineModal');
}

async function saveMachine(e) {
    e.preventDefault();
    const id = document.getElementById('mId').value;
    const body = {
        machine_code: document.getElementById('mCode').value.trim(),
        machine_name: document.getElementById('mName').value.trim(),
        machine_type: document.getElementById('mType').value,
        current_status: document.getElementById('mStatus').value,
        make: document.getElementById('mMake').value.trim(),
        model: document.getElementById('mModel').value.trim(),
        purchase_cost: parseFloat(document.getElementById('mCost').value) || 0,
        buying_date: document.getElementById('mBuyDate').value || null,
        vendor: document.getElementById('mVendor').value.trim(),
        invoice_ref: document.getElementById('mInvoice').value.trim(),
        installation_date: document.getElementById('mInstDate').value || null,
        warranty_expiry: document.getElementById('mWarranty').value || null,
        amc_expiry: document.getElementById('mAMC').value || null,
        depreciation_life_years: parseFloat(document.getElementById('mDepLife').value) || 10,
        residual_value: parseFloat(document.getElementById('mResidual').value) || 0,
        station_id: document.getElementById('mStation').value || null,
        power_rating_kw: parseFloat(document.getElementById('mPower').value) || 0,
        max_hours_per_day: parseFloat(document.getElementById('mHrsDay').value) || 8,
        shifts_per_day: parseFloat(document.getElementById('mShifts').value) || 1,
        working_days_per_year: parseInt(document.getElementById('mDays').value) || 250,
        rated_capacity: document.getElementById('mCap').value.trim(),
        electricity_rate: parseFloat(document.getElementById('mElec').value) || 0,
        annual_amc_cost: parseFloat(document.getElementById('mAMCCost').value) || 0,
        operator_cost_per_hour: parseFloat(document.getElementById('mOpCost').value) || 0,
        overhead_percent: parseFloat(document.getElementById('mOverhead').value) || 0,
        notes: document.getElementById('mNotes').value.trim()
    };
    const url = id ? `${API}/machines/${id}` : `${API}/machines`;
    const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getH(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeM('machineModal'); toast(id ? 'Machine updated' : 'Machine created'); loadMachines(); }
    else toast(data.message || 'Error', 'error');
}

// ── STATIONS ──
async function loadStations() {
    const res = await fetch(`${API}/stations`, { headers: getH() });
    const data = await res.json();
    allStations = data.data || [];
    renderStations(allStations);
    // Populate station dropdowns
    const sel = document.getElementById('mStation');
    sel.innerHTML = '<option value="">— None —</option>' + allStations.map(s => `<option value="${s.id}">${esc(s.station_name)}</option>`).join('');
}

function renderStations(list) {
    const tbody = document.getElementById('stationsBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No stations.</td></tr>'; return; }
    tbody.innerHTML = list.map(s => `<tr>
        <td><span style="font-family:monospace;font-weight:700;color:var(--accent)">${esc(s.station_code||'—')}</span></td>
        <td><strong>${esc(s.station_name)}</strong></td>
        <td>${esc(s.plant||'—')}</td>
        <td style="font-size:12px">${esc(s.description||'—')}</td>
        <td class="actions-cell">
            <button class="btn-action" onclick="editStation(${JSON.stringify(s).replace(/"/g,'&quot;')})"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-action btn-danger" onclick="confirmDelete('station','${s.id}','${esc(s.station_name)}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function openStationModal() {
    document.getElementById('stationModalTitle').textContent = 'New Station';
    document.getElementById('stId').value = '';
    ['stCode','stName','stPlant','stDesc'].forEach(id => document.getElementById(id).value = '');
    openM('stationModal');
}

function editStation(s) {
    document.getElementById('stationModalTitle').textContent = 'Edit Station';
    document.getElementById('stId').value = s.id;
    document.getElementById('stCode').value = s.station_code || '';
    document.getElementById('stName').value = s.station_name || '';
    document.getElementById('stPlant').value = s.plant || '';
    document.getElementById('stDesc').value = s.description || '';
    openM('stationModal');
}

async function saveStation(e) {
    e.preventDefault();
    const id = document.getElementById('stId').value;
    const body = {
        station_code: document.getElementById('stCode').value.trim(),
        station_name: document.getElementById('stName').value.trim(),
        plant: document.getElementById('stPlant').value.trim(),
        description: document.getElementById('stDesc').value.trim()
    };
    const url = id ? `${API}/stations/${id}` : `${API}/stations`;
    const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: getH(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeM('stationModal'); toast('Station saved'); loadStations(); }
    else toast(data.message || 'Error', 'error');
}

// ── EFFICIENCY ──
function openEffModal(machineId) {
    document.getElementById('effMachineId').value = machineId;
    ['effPeriod','effNotes'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('effAvail').value = 100;
    document.getElementById('effPerf').value = 100;
    document.getElementById('effQual').value = 100;
    openM('effModal');
}

async function saveEfficiency(e) {
    e.preventDefault();
    const mid = document.getElementById('effMachineId').value;
    const body = {
        period: document.getElementById('effPeriod').value.trim(),
        availability_pct: parseFloat(document.getElementById('effAvail').value) || 100,
        performance_pct: parseFloat(document.getElementById('effPerf').value) || 100,
        quality_pct: parseFloat(document.getElementById('effQual').value) || 100,
        notes: document.getElementById('effNotes').value.trim()
    };
    const res = await fetch(`${API}/machines/${mid}/efficiency`, { method: 'POST', headers: getH(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        closeM('effModal');
        toast(`Efficiency saved — OEE: ${data.data.oee_pct}%`);
    } else toast(data.message || 'Error', 'error');
}

// ── MHR CALCULATOR ──
async function loadMHRMachineList() {
    const res = await fetch(`${API}/machines`, { headers: getH() });
    const data = await res.json();
    const sel = document.getElementById('mhrMachineSelect');
    sel.innerHTML = '<option value="">— Select Machine —</option>' +
        (data.data||[]).map(m => `<option value="${m.id}">${esc(m.machine_code)} — ${esc(m.machine_name)}</option>`).join('');
}

async function loadMHR() {
    const mid = document.getElementById('mhrMachineSelect').value;
    const el = document.getElementById('mhrResult');
    if (!mid) { el.innerHTML = ''; return; }
    const res = await fetch(`${API}/machines/${mid}/mhr`, { headers: getH() });
    const data = await res.json();
    if (!data.success) { el.innerHTML = '<div style="color:#e53935">Error loading MHR</div>'; return; }
    const b = data.data;
    el.innerHTML = `<div class="mhr-breakdown">
        <div class="mhr-breakdown-title">MHR Breakdown (₹/hour)</div>
        <div class="mhr-row"><span class="mhr-label">Working Hours / Year</span><span class="mhr-val">${fmtN(b.working_hours_year)} hrs</span></div>
        <div class="mhr-row"><span class="mhr-label">Depreciation / Hour</span><span class="mhr-val">₹${fmtN(b.depreciation_per_hour)}</span></div>
        <div class="mhr-row"><span class="mhr-label">Power Cost / Hour</span><span class="mhr-val">₹${fmtN(b.power_per_hour)}</span></div>
        <div class="mhr-row"><span class="mhr-label">Maintenance / Hour</span><span class="mhr-val">₹${fmtN(b.maintenance_per_hour)}</span></div>
        <div class="mhr-row"><span class="mhr-label">Operator / Hour</span><span class="mhr-val">₹${fmtN(b.operator_per_hour)}</span></div>
        <div class="mhr-row"><span class="mhr-label">Overhead / Hour</span><span class="mhr-val">₹${fmtN(b.overhead_per_hour)}</span></div>
        <div class="mhr-row"><span class="mhr-label">MHR (Total)</span><span class="mhr-val" style="font-size:18px;color:var(--accent)">₹${fmtN(b.mhr)}</span></div>
    </div>`;
}

// ── DELETE ──
function confirmDelete(type, id, name) {
    document.getElementById('deleteMsg').textContent = `Delete ${type} "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const urlMap = { machine: `${API}/machines/${id}`, station: `${API}/stations/${id}` };
        const res = await fetch(urlMap[type], { method: 'DELETE', headers: getH() });
        const data = await res.json();
        if (data.success) {
            closeM('deleteModal'); toast(`${type} deleted`);
            if (type === 'machine') loadMachines();
            if (type === 'station') loadStations();
        } else toast(data.message || 'Error', 'error');
    };
    openM('deleteModal');
}

// ── INIT ──
(async function() {
    await loadStations();
    loadMachines();
})();
