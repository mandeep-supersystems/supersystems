// ─── PROCUREMENT MODULE: SHARED ───
const API = '/api/v1/procurement';
const PROJ_API = '/api/v1/projects';
const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant.id || tenant.code || 'TEST', 'X-User-Email': JSON.parse(localStorage.getItem('user') || '{}').email || '', 'X-User-Name': (JSON.parse(localStorage.getItem('user') || '{}').first_name || '') };

let currentPO = null;

function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (link) link.classList.add('active');
    history.pushState(null, '', '/procurement/' + sec);
    if (sec === 'purchaseorders') loadPOs();
    if (sec === 'podetail' && currentPO) renderPODetail(currentPO);
}

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ─── INIT ───
(function() {
    const path = window.location.pathname;
    const section = path.split('/procurement/')[1] || 'purchaseorders';
    const params = new URLSearchParams(window.location.search);
    if (params.get('project_id') && params.get('project_name')) {
        document.getElementById('poProjId').value = params.get('project_id');
        document.getElementById('poProjSelLabel').textContent = params.get('project_name');
        document.getElementById('poProjSelected').style.display = 'flex';
        showSection('addpo');
    } else {
        const valid = ['purchaseorders', 'addpo', 'podetail'];
        if (valid.includes(section)) showSection(section); else showSection('purchaseorders');
    }
})();
window.addEventListener('popstate', () => { const s = window.location.pathname.split('/procurement/')[1] || 'purchaseorders'; showSection(s); });
