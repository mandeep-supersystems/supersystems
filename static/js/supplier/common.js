// ─── SUPPLIER MODULE: SHARED ───
const API = '/api/v1/suppliers';

function getHeaders() {
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';
    const tenant = localStorage.getItem('tenant_id') || sessionStorage.getItem('tenant_id') ||
        (JSON.parse(localStorage.getItem('tenant') || '{}').id) ||
        (JSON.parse(localStorage.getItem('tenant') || '{}').code) || 'TEST';
    const email = localStorage.getItem('user_email') || sessionStorage.getItem('user_email') ||
        (JSON.parse(localStorage.getItem('user') || '{}').email) || '';
    const name = localStorage.getItem('user_name') || sessionStorage.getItem('user_name') || '';
    return {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-ID': tenant,
        'X-User-Email': email,
        'X-User-Name': name
    };
}

function esc(s) {
    if (s == null) return '';
    const d = document.createElement('div');
    d.textContent = String(s);
    return d.innerHTML;
}

function fmtDate(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return s; }
}

function fmtDateTime(s) {
    if (!s) return '—';
    try { return new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return s; }
}

function fmtNum(n) {
    if (!n && n !== 0) return '—';
    return parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function stars(rating) {
    const r = parseFloat(rating) || 0;
    const full = Math.floor(r);
    const half = r - full >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty) + ` (${r})`;
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showToast(msg, type = 'success') {
    const t = document.getElementById('supToast');
    if (!t) return;
    t.textContent = msg;
    t.className = `sup-toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3200);
}

function statusBadge(status) {
    const normalized = String(status || '').toLowerCase();
    const map = {
        active: 'status-active',
        inactive: 'status-inactive',
        blocked: 'status-blocked',
        approved: 'status-approved',
        pending: 'status-pending',
        conditional: 'status-conditional',
        rejected: 'status-rejected',
        draft: 'status-draft'
    };
    return `<span class="status-badge ${map[normalized] || ''}">${esc(status || '—')}</span>`;
}
