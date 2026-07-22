// ─── HR MODULE: SHARED ───
const API = '/api/v1/hr';
const token = localStorage.getItem('access_token');
const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
const headers = () => ({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token,
    'X-Tenant-ID': tenant.id || tenant.code || '',
    'X-User-Email': JSON.parse(localStorage.getItem('user') || '{}').email || '',
    'X-User-Name': (JSON.parse(localStorage.getItem('user') || '{}').first_name || '') + ' ' + (JSON.parse(localStorage.getItem('user') || '{}').last_name || '')
});

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
    if (sec === 'overview') loadHROverview();
    if (sec === 'codecriteria') loadCriteria();
    if (sec === 'employees') loadEmployees();
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
(function() {
    const valid = ['overview', 'codecriteria', 'employees'];
    const hash = location.hash.replace('#', '') || 'overview';
    showSection(valid.includes(hash) ? hash : 'overview');
})();
window.addEventListener('hashchange', () => {
    const valid = ['overview', 'codecriteria', 'employees'];
    const hash = location.hash.replace('#', '') || 'overview';
    showSection(valid.includes(hash) ? hash : 'overview');
});
