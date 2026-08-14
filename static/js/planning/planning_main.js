const API = '/api/v1/planning';
const PURCHASE_API = '/api/v1/purchase';
const token = () => localStorage.getItem('access_token');
const tenant = () => JSON.parse(localStorage.getItem('tenant') || '{}');
const user = () => JSON.parse(localStorage.getItem('user') || '{}');
const H = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token(),
    'X-Tenant-ID': tenant().id || tenant().code || '',
    'X-User-Email': user().email || '',
    'X-User-Name': ((user().first_name || '') + ' ' + (user().last_name || '')).trim()
});

const VALID_SECTIONS = ['overview','customer-orders','generate-pr','purchase-requests','history','auditlogs','moduleusers','notifications'];

function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const lnk = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (lnk) lnk.classList.add('active');
    if (location.hash !== '#' + sec) location.hash = sec;
    if (sec === 'overview') loadOverview();
    if (sec === 'customer-orders') loadCustomerOrders();
    if (sec === 'purchase-requests') loadPRs();
    if (sec === 'history') loadPlanningHistory();
    if (sec === 'auditlogs') loadAuditLogs();
    if (sec === 'moduleusers') loadModuleUsers();
    if (sec === 'notifications') loadNotifications();
}

window.addEventListener('hashchange', () => {
    const h = location.hash.replace('#','') || 'overview';
    showSection(VALID_SECTIONS.includes(h) ? h : 'overview');
});
document.addEventListener('DOMContentLoaded', () => {
    const h = location.hash.replace('#','') || 'overview';
    showSection(VALID_SECTIONS.includes(h) ? h : 'overview');
    refreshNotifBadge();
});

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function badge(status) {
    const map = {
        draft:'badge-draft', open:'badge-open', sent_to_purchaser:'badge-sent',
        converted_to_po:'badge-converted', rejected:'badge-rejected',
        pending:'badge-pending', passed:'badge-passed', partial_pass:'badge-partial',
        acknowledged:'badge-acknowledged', received:'badge-received'
    };
    const label = { sent_to_purchaser:'Sent to Purchaser', converted_to_po:'Converted to PO',
        partial_pass:'Partial Pass' };
    return `<span class="badge ${map[status]||'badge-draft'}">${label[status]||status}</span>`;
}

// ─── OVERVIEW ───
async function loadOverview() {
    const r = await fetch(API + '/overview', { headers: H() });
    const d = await r.json();
    if (!d.success) return;
    const s = d.data;
    document.getElementById('kpi-co-lines').textContent = s.total_co_lines;
    document.getElementById('kpi-co-needs-pr').textContent = s.needs_pr_lines;
    document.getElementById('kpi-prs').textContent = s.total_prs;
    document.getElementById('kpi-pending-prs').textContent = s.pending_prs;
    document.getElementById('kpi-sent').textContent = s.sent_prs;
    document.getElementById('kpi-converted').textContent = s.converted_prs;
    document.getElementById('kpi-active-pos').textContent = s.active_pos;
    document.getElementById('kpi-delay-days').textContent = s.total_delay_days;
    document.getElementById('kpi-rescheduled').textContent = s.total_rescheduled;
    document.getElementById('kpi-notifs').textContent = s.unread_notifications;
}

