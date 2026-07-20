// ─── AUTH & SECURITY: MAIN (Navigation, Helpers, Init) ───
const SEC_API = '/api/v1/security';
let SEC_HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': 'TEST' };

// Set user headers from JWT
(function setSecHeaders() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            if (identity) {
                SEC_HEADERS['X-User-Email'] = identity.email || '';
                SEC_HEADERS['X-User-Name'] = identity.name || identity.first_name || '';
                if (identity.tenant_id) SEC_HEADERS['X-Tenant-ID'] = identity.tenant_id;
            }
        }
    } catch (e) {}
})();

let secPendingDelete = null;

const SEC_SECTIONS = [
    { id: 'overview',    label: 'Overview',          icon: 'dashboard' },
    { id: 'users',       label: 'Users',              icon: 'people' },
    { id: 'permissions', label: 'User Permissions',   icon: 'manage_accounts' },
    { id: 'modules',     label: 'Module Access',      icon: 'apps' },
    { id: 'roles',       label: 'Roles & Permissions',icon: 'admin_panel_settings' },
    { id: 'matrix',      label: 'Permission Matrix',  icon: 'grid_on' },
    { id: 'auditlogs',   label: 'Audit Logs',         icon: 'history' },
];

// ─── SECTION NAVIGATION ───
function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const secEl = document.getElementById('sec-' + section);
    if (secEl) secEl.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');

    history.pushState(null, '', '/auth/' + section);

    const sec = SEC_SECTIONS.find(s => s.id === section);
    if (sec && typeof trackModule === 'function') trackModule(sec.label, sec.icon, '/auth/' + section);

    if (section === 'overview' && typeof loadSecOverview === 'function') loadSecOverview();
    if (section === 'users' && typeof loadUsers === 'function') loadUsers();
    if (section === 'permissions' && typeof loadPermUsers === 'function') loadPermUsers();
    if (section === 'modules' && typeof loadModuleAccess === 'function') loadModuleAccess();
    if (section === 'roles' && typeof loadRoles === 'function') loadRoles();
    if (section === 'matrix' && typeof initMatrix === 'function') initMatrix();
    if (section === 'auditlogs' && typeof loadSecAuditLogs === 'function') loadSecAuditLogs();
}

// ─── OVERVIEW ───
async function loadSecOverview() {
    try {
        const res = await fetch(SEC_API + '/overview', { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success) return;
        const d = data.data;
        document.getElementById('statUsers').textContent = d.total_users;
        document.getElementById('statRoles').textContent = d.total_roles;
        document.getElementById('statAssignments').textContent = d.module_assignments;
        document.getElementById('statModules').textContent = d.active_modules;
    } catch (e) { console.error('Overview error:', e); }
}

// ─── DELETE WITH PASSWORD CONFIRMATION ───
async function executeSecDelete() {
    const password = document.getElementById('deleteConfirmPassword').value;
    if (!password) { showSecDeleteError('Password is required'); return; }

    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';

    try {
        const verifyRes = await fetch('/api/v1/auth/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '') },
            body: JSON.stringify({ password })
        });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) {
            showSecDeleteError(verifyData.message || 'Incorrect password');
            btn.disabled = false; btn.textContent = 'Confirm'; return;
        }
    } catch (e) {
        showSecDeleteError('Failed to verify password');
        btn.disabled = false; btn.textContent = 'Confirm'; return;
    }

    // Password verified — execute action
    try {
        if (secPendingDelete.type === 'user') {
            const res = await fetch(SEC_API + '/users/' + secPendingDelete.id, { method: 'DELETE', headers: SEC_HEADERS });
            const data = await res.json();
            if (data.success) { secToast('User deleted'); if (typeof loadUsers === 'function') loadUsers(); }
            else secToast(data.message || 'Failed', 'error');
        } else if (secPendingDelete.type === 'revoke_access') {
            const res = await fetch(SEC_API + '/module-access/' + secPendingDelete.id, { method: 'DELETE', headers: SEC_HEADERS });
            const data = await res.json();
            if (data.success) { secToast('Access revoked'); if (typeof loadModuleAccess === 'function') loadModuleAccess(); }
            else secToast(data.message || 'Failed', 'error');
        } else if (secPendingDelete.type === 'role') {
            const res = await fetch(SEC_API + '/roles/' + secPendingDelete.id, { method: 'DELETE', headers: SEC_HEADERS });
            const data = await res.json();
            if (data.success) { secToast('Role deleted'); if (typeof loadRoles === 'function') loadRoles(); }
            else secToast(data.message || 'Failed', 'error');
        }
    } catch (e) { secToast('Network error', 'error'); }

    secCloseModal('deleteConfirmModal');
    secPendingDelete = null;
    btn.disabled = false; btn.textContent = 'Confirm';
}

function showSecDeleteError(msg) {
    const el = document.getElementById('deleteError');
    el.textContent = msg;
    el.style.display = 'block';
}

// ─── SHARED HELPERS ───
function secOpenModal(id) { document.getElementById(id).classList.add('active'); }
function secCloseModal(id) { document.getElementById(id).classList.remove('active'); }

function secToast(msg, type = 'success') {
    let toast = document.getElementById('secToast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'secToast'; document.body.appendChild(toast); }
    toast.className = 'sec-toast ' + type;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function esc(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function formatTime(ts) {
    if (!ts || ts === 'None') return '-';
    try {
        const d = new Date(ts);
        return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return ts; }
}

function confirmSecDelete(type, id, msg) {
    secPendingDelete = { type, id };
    document.getElementById('deleteConfirmMsg').textContent = msg;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    secOpenModal('deleteConfirmModal');
}

// ─── URL-BASED SECTION ROUTING ───
function initSecRouting() {
    const path = window.location.pathname;
    const section = path.split('/auth/')[1] || 'overview';
    const validSections = ['overview', 'users', 'permissions', 'modules', 'roles', 'matrix', 'auditlogs'];
    if (validSections.includes(section)) {
        showSection(section);
    } else {
        showSection('overview');
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSecRouting);
} else {
    initSecRouting();
}

// Handle browser back/forward
window.addEventListener('popstate', () => {
    const path = window.location.pathname;
    const section = path.split('/auth/')[1] || 'overview';
    showSection(section);
});
