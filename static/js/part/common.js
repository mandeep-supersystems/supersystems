// ─── PART MODULE: SHARED ───
const API = '/api/v1/part';
let HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': 'TEST' };

(function setUserHeaders() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            if (identity) {
                HEADERS['X-User-Email'] = identity.email || '';
                HEADERS['X-User-Name'] = identity.name || identity.first_name || '';
                if (identity.tenant_id) HEADERS['X-Tenant-ID'] = identity.tenant_id;
            }
        }
    } catch(e) {}
})();

let categories = [];
let subcategories = [];
let pendingDelete = null;

const PART_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'categories', label: 'Categories', icon: 'folder' },
    { id: 'subcategories', label: 'Subcategories', icon: 'folder_open' },
    { id: 'generate', label: 'Generate Part Code', icon: 'bolt' },
    { id: 'allparts', label: 'All Parts', icon: 'view_list' },
    { id: 'partmapping', label: 'Part Mapping', icon: 'swap_horiz' },
    { id: 'auditlogs', label: 'Audit Logs', icon: 'history' },
    { id: 'obsolete', label: 'Obsolete Parts', icon: 'block' },
    { id: 'moduleusers', label: 'User Management', icon: 'manage_accounts' }
];

let myAllowedSections = PART_SECTIONS.map(s => s.id);

function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');
    history.pushState(null, '', '/part/' + section);
    if (section === 'overview') loadOverview();
    if (section === 'categories') loadCategories();
    if (section === 'subcategories') loadSubcategories();
    if (section === 'generate') loadGenCategories();
    if (section === 'allparts') loadApCategories();
    if (section === 'partmapping') loadMappings();
    if (section === 'auditlogs') loadAuditLogs();
    if (section === 'obsolete') loadObsoleteParts();
    if (section === 'moduleusers') loadModuleUsers();
}

// ─── HELPERS ───
function esc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function parseCols(config) { if (!config) return []; if (Array.isArray(config)) return config; if (typeof config === 'string') { try { return JSON.parse(config); } catch(e) { return []; } } return []; }
function formatTime(ts) { if (!ts || ts === 'None') return '-'; try { const d = new Date(ts); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch(e) { return ts; } }
function partOpenModal(id) { document.getElementById(id).classList.add('active'); }
function partCloseModal(id) { document.getElementById(id).classList.remove('active'); }
function showToast(msg, type = 'success') {
    let toast = document.getElementById('partToast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'partToast'; document.body.appendChild(toast); }
    toast.className = 'part-toast ' + type; toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function applySidebarAccess() {
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
        link.style.display = myAllowedSections.includes(link.dataset.section) ? '' : 'none';
    });
}

// Called after any dynamic table render to re-apply button permissions
function applyDynamicPerms() {
    if (!Object.keys(myEntityPerms).length) return;
    document.querySelectorAll('[data-perm-entity]').forEach(el => {
        const entity = el.dataset.permEntity;
        const action = el.dataset.permAction;
        el.style.display = (myEntityPerms[entity] || []).includes(action) ? '' : 'none';
    });
}

// ─── INIT ───
let myEntityPerms = {}; // entity -> [actions]

(async function() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
        const res = await fetch(API + '/my-access', {
            headers: { ...HEADERS, 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
            if (Array.isArray(data.data.sections)) {
                myAllowedSections = data.data.sections;
                applySidebarAccess();
                if (myAllowedSections.length === 0) {
                    document.querySelector('.part-content').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:12px;color:var(--text-secondary)"><span class="material-icons-outlined" style="font-size:48px">lock</span><h3 style="margin:0">No Access</h3><p style="margin:0;font-size:13px">You do not have access to Part Management. Contact your administrator.</p></div>';
                    return;
                }
            }
            if (data.data.entity_permissions) {
                myEntityPerms = data.data.entity_permissions;
            }
            applyButtonPermissions();
        }
    } catch (e) {}
    const path = window.location.pathname.split('/');
    const section = path[2] || 'overview';
    showSection(section);
})();
window.addEventListener('popstate', () => { const section = window.location.pathname.split('/')[2] || 'overview'; showSection(section); });

// Hide buttons the user doesn't have permission for
// Buttons use: data-perm-entity="categories" data-perm-action="create"
function applyButtonPermissions() {
    // If no entity perms set, user is module_admin — show everything
    if (!Object.keys(myEntityPerms).length) return;
    document.querySelectorAll('[data-perm-entity]').forEach(el => {
        const entity = el.dataset.permEntity;
        const action = el.dataset.permAction;
        const allowed = (myEntityPerms[entity] || []).includes(action);
        el.style.display = allowed ? '' : 'none';
    });
}
