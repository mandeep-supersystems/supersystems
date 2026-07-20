// ─── WORKFLOW LIST PAGE ───
const API = '/api/v1/workflow-costing';
let allRoutings = [];
let _partSearchTimer = null;

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
function openM(id) { document.getElementById(id).classList.add('active'); }
function closeM(id) { document.getElementById(id).classList.remove('active'); }
function toast(msg, type='success') {
    const t = document.getElementById('wfToast');
    t.textContent = msg; t.className = `wf-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3200);
}
function showSec(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-sec]').forEach(l => l.classList.remove('active'));
    document.getElementById('sec-' + sec).classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-sec="${sec}"]`);
    if (link) link.classList.add('active');
    trackModule('Process Routings', 'account_tree', '/workflow/routings');
    if (sec === 'routings') loadRoutings();
}

async function loadRoutings() {
    const res = await fetch(`${API}/routings`, { headers: getH() });
    const data = await res.json();
    allRoutings = data.data || [];
    renderRoutings(allRoutings);
}

function filterRoutings(q) {
    const lq = (q||'').toLowerCase();
    const filtered = !lq || lq.length < 2 ? allRoutings : allRoutings.filter(r =>
        (r.part_number||'').toLowerCase().includes(lq) ||
        (r.part_description||'').toLowerCase().includes(lq)
    );
    renderRoutings(filtered);
}

function statusColor(s) {
    const map = { draft:'#e65100', active:'#2e7d32', obsolete:'#c62828' };
    return map[s] || '#555';
}

function renderRoutings(list) {
    const tbody = document.getElementById('routingsBody');
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No routings found.</td></tr>'; return; }
    tbody.innerHTML = list.map(r => {
        const sc = statusColor(r.status);
        return `<tr style="cursor:pointer" onclick="window.location='/workflow/routing/${r.id}'">
            <td><a href="/workflow/routing/${r.id}" onclick="event.stopPropagation()" style="font-family:monospace;font-weight:700;color:var(--accent);text-decoration:none">${esc(r.part_number)}</a></td>
            <td style="font-size:12px">${esc(r.part_description||'—')}</td>
            <td><span style="font-size:11px;background:var(--bg-secondary);padding:2px 8px;border-radius:6px">Rev ${esc(r.revision||'1')}</span></td>
            <td><span style="font-size:11px;font-weight:700;padding:2px 8px;border-radius:10px;background:${sc}22;color:${sc}">${esc(r.status)}</span></td>
            <td style="font-size:12px">${esc(r.created_by||'—')}</td>
            <td style="font-size:12px">${fmtDate(r.updated_at||r.created_at)}</td>
            <td class="actions-cell" onclick="event.stopPropagation()">
                <button class="btn-action" title="Open" onclick="window.location='/workflow/routing/${r.id}'"><span class="material-icons-outlined">open_in_new</span></button>
                <button class="btn-action btn-danger" title="Delete" onclick="confirmDelete('${r.id}','${esc(r.part_number)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
    }).join('');
}

// ── PART SEARCH ──
function searchParts(q) {
    clearTimeout(_partSearchTimer);
    const dd = document.getElementById('partSearchDropdown');
    if (!q || q.length < 2) { dd.style.display = 'none'; return; }
    _partSearchTimer = setTimeout(async () => {
        const res = await fetch(`${API}/search-parts?q=${encodeURIComponent(q)}`, { headers: getH() });
        const data = await res.json();
        const items = data.data || [];
        if (!items.length) { dd.style.display = 'none'; return; }
        dd.innerHTML = items.map(p =>
            `<div class="part-search-option" onclick="selectPart('${esc(p.part_number)}','${esc(p.description||'')}')">
                <span class="part-search-code">${esc(p.part_number)}</span>
                <span class="part-search-desc">${esc(p.description||'')}</span>
                <span style="font-size:10px;background:#e8f5e9;color:#2e7d32;padding:1px 6px;border-radius:6px;font-weight:700">MFG</span>
            </div>`
        ).join('');
        dd.style.display = 'block';
    }, 280);
}

function selectPart(pn, desc) {
    document.getElementById('newRoutingPartNumber').value = pn;
    document.getElementById('newRoutingPartSearch').value = pn;
    document.getElementById('partSearchDropdown').style.display = 'none';
    document.getElementById('newRoutingPartSelected').textContent = `✓ ${pn}${desc ? ' — ' + desc : ''}`;
}

document.addEventListener('click', e => {
    if (!e.target.closest('#newRoutingPartSearch') && !e.target.closest('#partSearchDropdown')) {
        const dd = document.getElementById('partSearchDropdown');
        if (dd) dd.style.display = 'none';
    }
});

// ── CREATE ROUTING ──
function openNewRoutingModal() {
    document.getElementById('newRoutingPartSearch').value = '';
    document.getElementById('newRoutingPartNumber').value = '';
    document.getElementById('newRoutingPartSelected').textContent = '';
    document.getElementById('newRoutingRev').value = '1';
    document.getElementById('newRoutingStatus').value = 'draft';
    document.getElementById('newRoutingNotes').value = '';
    openM('newRoutingModal');
}

async function createRouting(e) {
    e.preventDefault();
    const pn = document.getElementById('newRoutingPartNumber').value || document.getElementById('newRoutingPartSearch').value.trim();
    if (!pn) { toast('Please select or enter a part number', 'error'); return; }
    const body = {
        part_number: pn,
        revision: document.getElementById('newRoutingRev').value.trim() || '1',
        status: document.getElementById('newRoutingStatus').value,
        notes: document.getElementById('newRoutingNotes').value.trim()
    };
    const res = await fetch(`${API}/routings`, { method: 'POST', headers: getH(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        closeM('newRoutingModal');
        toast('Routing created');
        window.location = `/workflow/routing/${data.data.id}`;
    } else if (res.status === 409 && data.data) {
        closeM('newRoutingModal');
        window.location = `/workflow/routing/${data.data.id}`;
    } else toast(data.message || 'Error', 'error');
}

function confirmDelete(rid, pn) {
    document.getElementById('deleteMsg').textContent = `Delete routing for "${pn}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(`${API}/routings/${rid}`, { method: 'DELETE', headers: getH() });
        const data = await res.json();
        if (data.success) { closeM('deleteModal'); toast('Routing deleted'); loadRoutings(); }
        else toast(data.message || 'Error', 'error');
    };
    openM('deleteModal');
}

loadRoutings();
