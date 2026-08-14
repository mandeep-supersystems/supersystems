// ─── PROJECT MODULE: SHARED ───
const API = '/api/v1/projects';
const PROC_API = '/api/v1/procurement';
const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant.id || tenant.code || 'TEST', 'X-User-Email': JSON.parse(localStorage.getItem('user') || '{}').email || '', 'X-User-Name': (JSON.parse(localStorage.getItem('user') || '{}').first_name || '') };

let currentProjectId = null;
let currentOrgId = null;

function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (link) link.classList.add('active');
    
    // Use window.location state formatting
    if (sec === 'projectdetail' && currentProjectId) {
        history.pushState(null, '', '/project/projectdetail/' + currentProjectId);
    } else {
        history.pushState(null, '', '/project/' + sec);
    }

    if (sec === 'overview') loadOverview();
    if (sec === 'projects') loadProjects();
    if (sec === 'organizations') loadOrganizations();
    if (sec === 'auditlogs') loadAuditLogs();
    if (sec === 'moduleusers') loadModuleUsers();
    if (sec === 'orgdetail' && currentOrgId) loadOrgDetail(currentOrgId);
    if (sec === 'addproject') {
        if (typeof loadAddProjectSideData === 'function') loadAddProjectSideData();
    }
}

function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function formatTime(t) { if (!t) return '—'; try { return new Date(t).toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }); } catch(e) { return t; } }
// ─── INIT ───
(function() {
    const parts = window.location.pathname.split('/project/');
    const pathSegment = parts[1] || 'overview';
    const section = pathSegment.split('/')[0];
    const parameterId = pathSegment.split('/')[1] || null;

    const valid = ['overview', 'projects', 'addproject', 'organizations', 'orgdetail', 'projectdetail', 'auditlogs', 'moduleusers'];
    if (valid.includes(section)) {
        if (section === 'projectdetail' && parameterId) {
            if (typeof openProject === 'function') {
                openProject(parameterId);
            } else {
                showSection('projects');
            }
        } else {
            showSection(section);
        }
    } else {
        showSection('overview');
    }
})();
window.addEventListener('popstate', () => { 
    const parts = window.location.pathname.split('/project/');
    const pathSegment = parts[1] || 'overview';
    const section = pathSegment.split('/')[0];
    const parameterId = pathSegment.split('/')[1] || null;
    if (section === 'projectdetail' && parameterId) {
        if (typeof openProject === 'function') openProject(parameterId);
    } else {
        showSection(section);
    }
});
