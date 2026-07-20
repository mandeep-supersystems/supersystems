// ─── RAW MATERIAL MODULE: SHARED ───
const RM_API = '/api/v1/rawmaterial';
let RM_HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': 'TEST' };

(function setRmHeaders() {
    try {
        const token = localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            if (identity) { RM_HEADERS['X-User-Email'] = identity.email || ''; RM_HEADERS['X-User-Name'] = identity.name || identity.first_name || ''; }
        }
    } catch(e) {}
})();

const RM_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'criteria', label: 'RM Code Criteria', icon: 'rule' },
    { id: 'master', label: 'RM Master', icon: 'inventory_2' },
    { id: 'partmapping', label: 'RM-Part Mapping', icon: 'link' },
    { id: 'inventory', label: 'RM Inventory', icon: 'warehouse' }
];

let rmAllowedSections = RM_SECTIONS.map(s => s.id);

function rmShowSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const sec = document.getElementById('sec-' + section);
    if (sec) sec.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');
    history.pushState(null, '', '/rawmaterial/' + section);
    const s = RM_SECTIONS.find(x => x.id === section);
    if (s) trackModule(s.label, s.icon, '/rawmaterial/' + section);
    if (section === 'overview') loadRmOverview();
    if (section === 'criteria') loadCriteria();
    if (section === 'master') loadRmMaster();
    if (section === 'partmapping') loadRmPartMappings();
}

function esc(str) { if (!str) return ''; return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatTime(ts) { if (!ts || ts === 'None') return '-'; try { const d = new Date(ts); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); } catch(e) { return ts; } }
function rmOpenModal(id) { document.getElementById(id).classList.add('active'); }
function rmCloseModal(id) { document.getElementById(id).classList.remove('active'); }
function rmToast(msg, type = 'success') {
    let toast = document.getElementById('rmToast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'rmToast'; toast.className = 'part-toast'; document.body.appendChild(toast); }
    toast.className = 'part-toast ' + type; toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── INIT ───
(async function() {
    try {
        const res = await fetch(RM_API + '/my-access', { headers: RM_HEADERS });
        const data = await res.json();
        if (data.success && data.data.sections) {
            rmAllowedSections = data.data.sections;
            document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
                link.style.display = rmAllowedSections.includes(link.dataset.section) ? '' : 'none';
            });
        }
    } catch (e) {}
    const path = window.location.pathname.split('/');
    const section = path[2] || 'overview';
    rmShowSection(section);
})();
window.addEventListener('popstate', () => { const section = window.location.pathname.split('/')[2] || 'overview'; rmShowSection(section); });
