// ─── QUALITY MANAGEMENT MODULE COMMON JS ───
const API = '/api/v1/quality';
let HEADERS = {
    'Content-Type': 'application/json',
    'X-Tenant-ID': 'TEST'
};

// Pull JWT identity into headers
(function setUserHeaders() {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            if (identity) {
                HEADERS['Authorization'] = 'Bearer ' + token;
                HEADERS['X-User-Email'] = identity.email || '';
                HEADERS['X-User-Name'] = identity.name || identity.first_name || '';
                if (identity.tenant_id) HEADERS['X-Tenant-ID'] = identity.tenant_id;
            }
        }
    } catch(e) {}
})();

// ─── SECTION NAVIGATION ───
function showSection(sectionId, pushState = true) {
    if (!sectionId) sectionId = 'overview';
    if (!document.getElementById('sec-' + sectionId)) sectionId = 'overview';

    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));

    document.getElementById('sec-' + sectionId).classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sectionId}"]`);
    if (link) link.classList.add('active');

    if (pushState && window.location.pathname !== '/quality/' + sectionId) {
        history.pushState(null, '', '/quality/' + sectionId);
    }

    if (sectionId === 'overview')    loadOverviewStats();
    else if (sectionId === 'iqc')    loadIqcInspections();
    else if (sectionId === 'criteria') loadCriteria();
    else if (sectionId === 'ipqc')   loadIpqcInspections();
    else if (sectionId === 'fqa')    loadFqaInspections();
    else if (sectionId === 'ncr')    loadNcrs();
    else if (sectionId === 'moduleusers') loadModuleUsers();
}

window.addEventListener('popstate', () => {
    const section = window.location.pathname.split('/')[2] || 'overview';
    showSection(section, false);
});

// ─── MODAL HELPERS ───
function openModal(title, htmlContent) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = htmlContent;
    document.getElementById('globalModal').classList.add('active');
}

function closeModal() {
    document.getElementById('globalModal').classList.remove('active');
}

function qCloseModal(id) {
    document.getElementById(id).classList.remove('active');
}

function qOpenModal(id) {
    document.getElementById(id).classList.add('active');
}

// ─── PROFILE / ACCOUNT ───
function openProfile() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
    document.getElementById('profileName').textContent = ((user.first_name || '') + ' ' + (user.last_name || '')).trim() || user.email || '-';
    document.getElementById('profileEmail').textContent = user.email || '-';
    document.getElementById('profileRole').textContent = localStorage.getItem('user_type') === 'super_admin' ? 'Super Admin' : 'Organization User';
    document.getElementById('profileOrg').textContent = tenant.name || '-';
    document.getElementById('userDropdown').classList.remove('active');
    qOpenModal('profileModal');
}

function openAccount() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    document.getElementById('accFirstName').value = user.first_name || '';
    document.getElementById('accLastName').value = user.last_name || '';
    document.getElementById('accPhone').value = user.phone || '';
    document.getElementById('userDropdown').classList.remove('active');
    qOpenModal('accountModal');
}

async function updateAccount(e) {
    e.preventDefault();
    const token = localStorage.getItem('access_token');
    const data = {
        first_name: document.getElementById('accFirstName').value.trim(),
        last_name: document.getElementById('accLastName').value.trim(),
        phone: document.getElementById('accPhone').value.trim()
    };
    const cp = document.getElementById('accCurrentPwd').value;
    const np = document.getElementById('accNewPwd').value;
    if (cp && np) { data.current_password = cp; data.new_password = np; }
    try {
        const res = await fetch('/api/v1/auth/account', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
            body: JSON.stringify(data)
        });
        const result = await res.json();
        if (result.success) {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            Object.assign(user, { first_name: data.first_name, last_name: data.last_name, phone: data.phone });
            localStorage.setItem('user', JSON.stringify(user));
            qCloseModal('accountModal');
            showQToast('Account updated');
        } else {
            showQToast(result.message || 'Update failed', 'error');
        }
    } catch(err) { showQToast('Failed to update account', 'error'); }
}

// ─── TOAST ───
function showQToast(msg, type = 'success') {
    let toast = document.getElementById('qToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'qToast';
        document.body.appendChild(toast);
    }
    toast.className = 'q-toast ' + type;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
    const section = window.location.pathname.split('/')[2] || 'overview';
    showSection(section, false);
});
