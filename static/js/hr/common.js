// ─── HR MODULE: SHARED ───
const API = '/api/v1/hr';
const headers = () => {
    let tid = '';
    let userEmail = '';
    let userName = '';
    try {
        const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
        tid = tenant.id || tenant.code || '';
    } catch(e) {}
    if (!tid) {
        tid = localStorage.getItem('tenant_id') || 'b424df0e-f766-4e94-b3fd-05777e158958';
    }
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        userEmail = user.email || localStorage.getItem('user_email') || '';
        userName = (((user.first_name || '') + ' ' + (user.last_name || '')).trim()) || localStorage.getItem('user_name') || '';
    } catch(e) {}
    const token = localStorage.getItem('access_token') || '';
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
        'X-Tenant-ID': tid,
        'X-User-Email': userEmail,
        'X-User-Name': userName
    };
};

let criteriaList = [];
let employeesList = [];

function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (link) link.classList.add('active');
    if (location.hash !== '#' + sec) location.hash = sec;
    if (sec === 'overview' && typeof loadHROverview === 'function') loadHROverview();
    if (sec === 'codecriteria' && typeof loadCriteria === 'function') loadCriteria();
    if (sec === 'employees' && typeof loadEmployees === 'function') loadEmployees();
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function buildPreview(prefix, psep, num, ssep, suffix) {
    let code = String(num);
    if (prefix) code = prefix + (psep || '') + code;
    if (suffix) code = code + (ssep || '') + suffix;
    return code;
}

// ─── INIT ───
// Only activate hash-based section routing on pages that have .content-section elements
const _HR_VALID = ['overview', 'codecriteria', 'employees'];
window.addEventListener('hashchange', () => {
    if (!document.querySelector('.content-section')) return;
    const hash = location.hash.replace('#', '') || 'overview';
    showSection(_HR_VALID.includes(hash) ? hash : 'overview');
});
document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.content-section')) return;
    const hash = location.hash.replace('#', '') || 'overview';
    showSection(_HR_VALID.includes(hash) ? hash : 'overview');
});
