// ─── LOGISTICS COMMON JS ───
const API = '/api/v1/logistics';
const WH_API = '/api/v1/warehouse';
const INV_API = '/api/v1/inventory';
const HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || ''),
    'X-Tenant-ID': 'TEST'
};
try {
    const token = localStorage.getItem('access_token');
    if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
        if (identity.tenant_id) HEADERS['X-Tenant-ID'] = identity.tenant_id;
    }
} catch(e) {}

let currentLgSection = '';

function showLgSection(sectionId) {
    if (!sectionId) sectionId = 'overview';
    if (!document.getElementById('sec-' + sectionId)) sectionId = 'overview';

    if (currentLgSection === sectionId) return;
    currentLgSection = sectionId;

    if (location.hash !== '#' + sectionId) {
        location.hash = sectionId;
    }

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));

    document.getElementById('sec-' + sectionId).classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
    if (link) link.classList.add('active');

    if (sectionId === 'overview')     loadLgOverview();
    else if (sectionId === 'pending-pos') loadPendingPos();
    else if (sectionId === 'grn')     loadGrnList();
    else if (sectionId === 'handover') loadHandoverGrns();
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.style.background = type === 'error' ? '#c62828' : '#323232';
    t.style.display = 'block';
    setTimeout(() => { t.style.display = 'none'; }, 3500);
}

function openLgModal(title, html) {
    document.getElementById('lgModalTitle').innerText = title;
    document.getElementById('lgModalBody').innerHTML = html;
    document.getElementById('lgModalOverlay').classList.add('active');
}

function closeLgModal() {
    document.getElementById('lgModalOverlay').classList.remove('active');
}

function closeGrnDetail() {
    document.getElementById('grnDetailModal').classList.remove('active');
}

function closeHandoverModal() {
    document.getElementById('handoverModal').classList.remove('active');
}

function statusBadge(status) {
    const map = {
        pending_iqc:           ['var(--coming-soon-bg)','var(--coming-soon-text)','Pending IQC'],
        partially_handed_over: ['var(--accent-light)','var(--accent)','Partially Handed Over'],
        handed_over:           ['var(--accent-light)','var(--accent)','Handed Over'],
        verified:              ['var(--accent-light)','var(--accent)','Verified'],
        discrepancy:           ['var(--coming-soon-bg)','var(--coming-soon-text)','Discrepancy'],
        sent_to_supplier:      ['var(--accent-light)','var(--accent)','Sent to Supplier'],
        acknowledged:          ['var(--accent-light)','var(--accent)','Acknowledged'],
        partially_received:    ['var(--coming-soon-bg)','var(--coming-soon-text)','Partial'],
        received:              ['var(--accent-light)','var(--accent)','Received'],
    };
    const [bg, color, label] = map[status] || ['var(--bg-secondary)','var(--text-muted)', status || '—'];
    return `<span style="background:${bg};color:${color};border:1px solid ${color};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">${label}</span>`;
}

document.addEventListener('DOMContentLoaded', () => {
    const sec = location.hash.replace('#', '') || 'overview';
    showLgSection(sec);
});

window.addEventListener('hashchange', () => {
    const sec = location.hash.replace('#', '') || 'overview';
    showLgSection(sec);
});
