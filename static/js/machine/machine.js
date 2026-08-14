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
        <tr class="mch-row" onclick="openMachinePanel('${m.id}')" style="cursor:pointer;">
            <td><span class="mch-code">${esc(m.machine_code)}</span></td>
            <td><span class="mch-name">${esc(m.machine_name)}</span></td>
            <td>${esc(m.machine_type||'—')}</td>
            <td class="mch-muted">${[m.make, m.model].filter(Boolean).map(esc).join(' · ') || '—'}</td>
            <td class="mch-muted">${m.station_name ? `<span class="mch-station-pill">${esc(m.station_name)}</span>` : '<span style="color:var(--text-muted);font-size:12px;">— Unassigned —</span>'}</td>
            <td class="right mch-muted">${m.power_rating_kw ? fmtN(m.power_rating_kw) : '—'}</td>
            <td class="right"><span class="mch-mhr">₹${fmtN(m.mhr)}</span></td>
            <td>${statusBadge(m.current_status||'active')}</td>
            <td><div class="actions-cell" onclick="event.stopPropagation()">
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

// ── MACHINE SLIDE-OVER PANEL ──
async function openMachinePanel(id) {
    const panel = document.getElementById('machinePanel');
    const overlay = document.getElementById('machinePanelOverlay');
    const content = document.getElementById('machinePanelContent');
    content.innerHTML = `<div style="padding:48px;text-align:center;color:var(--text-muted);">
        <span class="material-icons-outlined" style="font-size:36px;display:block;margin-bottom:8px;animation:mch-spin 1s linear infinite;">autorenew</span>
        Loading machine details…</div>`;
    panel.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    try {
        const res = await fetch(`${API}/machines/${id}`, { headers: getH() });
        const data = await res.json();
        if (!data.success) { content.innerHTML = `<div style="padding:40px;text-align:center;color:red;">${data.message}</div>`; return; }
        renderMachinePanel(data.data);
    } catch(e) {
        content.innerHTML = '<div style="padding:40px;text-align:center;color:red;">Error loading machine.</div>';
    }
}

function closeMachinePanel() {
    document.getElementById('machinePanel').classList.remove('active');
    document.getElementById('machinePanelOverlay').classList.remove('active');
    document.body.style.overflow = '';
}

function renderMachinePanel(m) {
    const b = m.mhr_breakdown || {};
    const statusMap = { active: ['#388e3c','verified'], under_maintenance: ['#f57c00','build'], retired: ['#9e9e9e','archive'] };
    const [sColor, sIcon] = statusMap[m.current_status] || ['#388e3c','verified'];
    const stationOptions = allStations.map(s =>
        `<option value="${s.id}" ${m.station_id === s.id ? 'selected' : ''}>${esc(s.station_name)}</option>`
    ).join('');

    // MHR bar segments
    const mhrTotal = b.mhr || 0;
    const segments = [
        { label: 'Depreciation', val: b.depreciation_per_hour || 0, color: '#1976d2' },
        { label: 'Power',        val: b.power_per_hour || 0,        color: '#f57c00' },
        { label: 'Maintenance',  val: b.maintenance_per_hour || 0,  color: '#7b1fa2' },
        { label: 'Operator',     val: b.operator_per_hour || 0,     color: '#388e3c' },
        { label: 'Overhead',     val: b.overhead_per_hour || 0,     color: '#c62828' },
    ];
    const barHtml = mhrTotal > 0 ? segments.filter(s => s.val > 0).map(s =>
        `<div title="${s.label}: ₹${fmtN(s.val)}/hr" style="height:100%;width:${(s.val/mhrTotal*100).toFixed(1)}%;background:${s.color};transition:width .4s;"></div>`
    ).join('') : '';
    const legendHtml = segments.filter(s => s.val > 0).map(s =>
        `<div style="display:flex;align-items:center;gap:5px;font-size:11px;">
            <span style="width:10px;height:10px;border-radius:2px;background:${s.color};flex-shrink:0;"></span>
            <span style="color:var(--text-muted);">${s.label}</span>
            <span style="font-weight:600;margin-left:auto;">₹${fmtN(s.val)}</span>
        </div>`
    ).join('');

    // Efficiency history
    const effHtml = m.efficiency_history && m.efficiency_history.length
        ? m.efficiency_history.slice(0,5).map(e => {
            const oee = parseFloat(e.oee_pct || 0);
            const oeeColor = oee >= 85 ? '#388e3c' : oee >= 60 ? '#f57c00' : '#c62828';
            return `<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border-color);">
                <div style="flex:1;">
                    <div style="font-size:12px;font-weight:600;">${esc(e.period||'—')}</div>
                    <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">A:${e.availability_pct}% · P:${e.performance_pct}% · Q:${e.quality_pct}%</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:16px;font-weight:700;color:${oeeColor};">${oee}%</div>
                    <div style="font-size:10px;color:var(--text-muted);">OEE</div>
                </div>
            </div>`;
        }).join('')
        : '<div style="padding:12px 0;text-align:center;color:var(--text-muted);font-size:12px;">No efficiency records</div>';

    document.getElementById('machinePanelContent').innerHTML = `
    <div style="padding:20px;">

        <!-- HEADER -->
        <div style="display:flex;align-items:flex-start;gap:14px;margin-bottom:20px;">
            <div style="width:48px;height:48px;border-radius:12px;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <span class="material-icons-outlined" style="color:#fff;font-size:24px;">precision_manufacturing</span>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="font-size:18px;font-weight:700;font-family:monospace;color:var(--accent);">${esc(m.machine_code)}</div>
                <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-top:2px;">${esc(m.machine_name)}</div>
                <div style="display:flex;align-items:center;gap:8px;margin-top:6px;flex-wrap:wrap;">
                    ${m.machine_type ? `<span style="font-size:11px;padding:2px 8px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border-color);color:var(--text-secondary);">${esc(m.machine_type)}</span>` : ''}
                    <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${sColor}18;color:${sColor};font-weight:600;">
                        <span class="material-icons-outlined" style="font-size:11px;vertical-align:middle;">${sIcon}</span>
                        ${m.current_status?.replace('_',' ') || 'active'}
                    </span>
                </div>
            </div>
        </div>

        <!-- QUICK STATS -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:20px;">
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">MHR</div>
                <div style="font-size:20px;font-weight:800;color:var(--accent);">₹${fmtN(b.mhr||0)}</div>
                <div style="font-size:10px;color:var(--text-muted);">per hour</div>
            </div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Working Hrs</div>
                <div style="font-size:20px;font-weight:800;color:var(--text-primary);">${fmtN(b.working_hours_year||0)}</div>
                <div style="font-size:10px;color:var(--text-muted);">hrs / year</div>
            </div>
            <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:12px;text-align:center;">
                <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Power</div>
                <div style="font-size:20px;font-weight:800;color:var(--text-primary);">${m.power_rating_kw ? fmtN(m.power_rating_kw) : '—'}</div>
                <div style="font-size:10px;color:var(--text-muted);">kW</div>
            </div>
        </div>

        <!-- MHR BREAKDOWN BAR -->
        <div style="margin-bottom:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                <span style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;">MHR Breakdown</span>
                <span style="font-size:14px;font-weight:700;color:var(--accent);">₹${fmtN(mhrTotal)}/hr</span>
            </div>
            <div style="height:10px;border-radius:5px;overflow:hidden;background:var(--border-color);display:flex;margin-bottom:10px;">${barHtml}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;">${legendHtml}</div>
        </div>

        <!-- STATION ASSIGN -->
        <div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:8px;padding:14px;margin-bottom:20px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">Station Assignment</div>
            <div style="display:flex;align-items:center;gap:8px;">
                <span class="material-icons-outlined" style="font-size:18px;color:var(--accent);">location_on</span>
                <select id="panelStationSelect" style="flex:1;padding:8px 10px;border:1px solid var(--border-color);border-radius:7px;font-size:13px;background:var(--bg-primary);color:var(--text-primary);outline:none;">
                    <option value="">— Unassigned —</option>
                    ${stationOptions}
                </select>
                <button onclick="assignStationFromPanel('${m.id}')" style="padding:8px 14px;background:var(--accent);color:#fff;border:none;border-radius:7px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;white-space:nowrap;">
                    <span class="material-icons-outlined" style="font-size:15px;">check</span> Assign
                </button>
            </div>
        </div>

        <!-- DETAILS GRID -->
        <div style="margin-bottom:20px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin-bottom:10px;">Machine Details</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${[
                    ['Make', m.make], ['Model', m.model],
                    ['Purchase Cost', m.purchase_cost ? '₹' + fmtN(m.purchase_cost) : null],
                    ['Buying Date', m.buying_date ? m.buying_date.slice(0,10) : null],
                    ['Vendor', m.vendor], ['Invoice Ref', m.invoice_ref],
                    ['Installation', m.installation_date ? m.installation_date.slice(0,10) : null],
                    ['Warranty Expiry', m.warranty_expiry ? m.warranty_expiry.slice(0,10) : null],
                    ['AMC Expiry', m.amc_expiry ? m.amc_expiry.slice(0,10) : null],
                    ['Dep. Life', m.depreciation_life_years ? m.depreciation_life_years + ' yrs' : null],
                    ['Residual Value', m.residual_value ? '₹' + fmtN(m.residual_value) : null],
                    ['Rated Capacity', m.rated_capacity],
                ].filter(([,v]) => v).map(([k,v]) =>
                    `<div style="background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:6px;padding:8px 10px;">
                        <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">${k}</div>
                        <div style="font-size:13px;font-weight:600;margin-top:2px;">${esc(String(v))}</div>
                    </div>`
                ).join('')}
            </div>
        </div>

        <!-- EFFICIENCY HISTORY -->
        <div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
                <span style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;">OEE / Efficiency</span>
                <button onclick="event.stopPropagation();closeMachinePanel();openEffModal('${m.id}')" style="font-size:11px;color:var(--accent);background:none;border:1px solid var(--border-color);border-radius:5px;padding:3px 8px;cursor:pointer;">+ Add Record</button>
            </div>
            ${effHtml}
        </div>

        <!-- FOOTER ACTIONS -->
        <div style="display:flex;gap:8px;margin-top:20px;padding-top:16px;border-top:1px solid var(--border-color);">
            <button onclick="closeMachinePanel();editMachine('${m.id}')" style="flex:1;padding:9px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;">
                <span class="material-icons-outlined" style="font-size:16px;">edit</span> Edit Machine
            </button>
            <button onclick="closeMachinePanel();confirmDelete('machine','${m.id}','${esc(m.machine_name)}')" style="padding:9px 14px;background:none;color:#e53935;border:1px solid rgba(229,57,53,.3);border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;">
                <span class="material-icons-outlined" style="font-size:16px;">delete</span>
            </button>
        </div>

    </div>`;
}

async function assignStationFromPanel(machineId) {
    const stationId = document.getElementById('panelStationSelect').value || null;
    const res = await fetch(`${API}/machines/${machineId}`, {
        method: 'PUT', headers: getH(),
        body: JSON.stringify({ station_id: stationId })
    });
    const data = await res.json();
    if (data.success) {
        toast(stationId ? 'Station assigned' : 'Station unassigned');
        loadMachines();
        // refresh panel
        openMachinePanel(machineId);
    } else toast(data.message || 'Error', 'error');
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
