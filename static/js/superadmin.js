const API = '/superadmin/api';

// NAV
document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        const section = link.dataset.section;
        document.querySelectorAll('.nav-link[data-section]').forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        document.getElementById('sec-' + section).classList.add('active');
        document.getElementById('pageTitle').textContent = link.textContent.trim();
        if (section === 'organizations') loadOrganizations();
        if (section === 'modules') loadModules();
        if (section === 'overview') loadOverview();
        if (section === 'audit') loadAuditLogs();
    });
});

// THEME
function toggleTheme() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('sa_theme', theme);
}

(function() {
    const saved = localStorage.getItem('sa_theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
})();

// MODAL
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// API HELPERS
async function apiGet(path) {
    const res = await fetch(API + path);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(API + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    return res.json();
}

// OVERVIEW
async function loadOverview() {
    try {
        const res = await apiGet('/overview');
        if (res.success) {
            document.getElementById('statOrgs').textContent = res.data.total_tenants || 0;
            document.getElementById('statUsers').textContent = res.data.total_users || 0;
            document.getElementById('statLicenses').textContent = res.data.active_licenses || 0;
            document.getElementById('statSubs').textContent = res.data.active_subscriptions || 0;
        }
    } catch(e) {}
}

// ORGANIZATIONS
let organizations = [];

async function loadOrganizations() {
    try {
        const res = await apiGet('/organizations');
        if (res.success) {
            organizations = res.data.items || res.data || [];
            renderOrganizations();
        }
    } catch(e) {
        renderOrganizations();
    }
}

function renderOrganizations() {
    const tbody = document.getElementById('orgsTableBody');
    if (!organizations.length) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">No organizations yet. Click "Add Organization" to create one.</td></tr>';
        return;
    }
    tbody.innerHTML = organizations.map(org => `
        <tr>
            <td><strong>${org.name}</strong><br><small style="color:var(--text-muted)">${org.email || ''}</small></td>
            <td>${org.code || ''}</td>
            <td>${org.pan || '-'}</td>
            <td>${org.city || '-'}${org.state ? ', ' + org.state : ''}</td>
            <td>${org.industry || '-'}</td>
            <td><span class="status-${org.is_active !== false ? 'active' : 'suspended'}">${org.is_active !== false ? 'Active' : 'Suspended'}</span></td>
            <td>
                <button class="btn-edit" onclick="editOrg('${org.id}')">Edit</button>
                ${org.is_active !== false
                    ? `<button class="btn-danger" onclick="suspendOrg('${org.id}')">Suspend</button>`
                    : `<button class="btn-success" onclick="activateOrg('${org.id}')">Activate</button>`}
            </td>
        </tr>
    `).join('');
}

async function createOrganization(e) {
    e.preventDefault();
    const data = {
        name: document.getElementById('orgName').value.trim(),
        code: document.getElementById('orgCode').value.trim().toUpperCase(),
        domain: document.getElementById('orgDomain').value.trim(),
        industry: document.getElementById('orgIndustry').value,
        employee_count: document.getElementById('orgEmpCount').value,
        pan: document.getElementById('orgPan').value.trim().toUpperCase(),
        gst: document.getElementById('orgGst').value.trim().toUpperCase(),
        cin: document.getElementById('orgCin').value.trim().toUpperCase(),
        email: document.getElementById('orgEmail').value.trim(),
        phone: document.getElementById('orgPhone').value.trim(),
        address_line1: document.getElementById('orgAddr1').value.trim(),
        address_line2: document.getElementById('orgAddr2').value.trim(),
        city: document.getElementById('orgCity').value.trim(),
        state: document.getElementById('orgState').value.trim(),
        pincode: document.getElementById('orgPincode').value.trim(),
        country: document.getElementById('orgCountry').value.trim(),
        contact_person: document.getElementById('orgContactPerson').value.trim(),
        contact_designation: document.getElementById('orgContactDesignation').value.trim(),
        contact_phone: document.getElementById('orgContactPhone').value.trim(),
        contact_email: document.getElementById('orgContactEmail').value.trim()
    };

    let res;
    if (editingOrgId) {
        res = await apiPost('/organizations/' + editingOrgId + '/update', data);
    } else {
        res = await apiPost('/organizations', data);
    }
    if (res.success) {
        closeModal('addOrgModal');
        resetOrgForm();
        loadOrganizations();
    } else {
        alert(res.message || 'Failed to save organization');
    }
}

function resetOrgForm() {
    document.getElementById('addOrgForm').reset();
    document.getElementById('orgCountry').value = 'India';
    editingOrgId = null;
    document.querySelector('#addOrgModal .modal-header h3').textContent = 'Add Organization';
    document.querySelector('#addOrgForm .btn-primary').textContent = 'Create Organization';
}

async function suspendOrg(id) {
    if (!confirm('Suspend this organization?')) return;
    const res = await apiPost('/organizations/' + id + '/suspend', {});
    if (res.success) loadOrganizations();
}

async function activateOrg(id) {
    const res = await apiPost('/organizations/' + id + '/activate', {});
    if (res.success) loadOrganizations();
}

// EDIT ORGANIZATION
async function editOrg(id) {
    const res = await apiGet('/organizations/' + id);
    if (!res.success) return alert('Failed to load organization');
    const org = res.data;
    document.getElementById('orgName').value = org.name || '';
    document.getElementById('orgCode').value = org.code || '';
    document.getElementById('orgIndustry').value = org.industry || '';
    document.getElementById('orgEmpCount').value = org.employee_count || '';
    document.getElementById('orgPan').value = org.pan || '';
    document.getElementById('orgGst').value = org.gst || '';
    document.getElementById('orgCin').value = org.cin || '';
    document.getElementById('orgDomain').value = org.domain || '';
    document.getElementById('orgEmail').value = org.email || '';
    document.getElementById('orgPhone').value = org.phone || '';
    document.getElementById('orgAddr1').value = org.address_line1 || '';
    document.getElementById('orgAddr2').value = org.address_line2 || '';
    document.getElementById('orgCity').value = org.city || '';
    document.getElementById('orgState').value = org.state || '';
    document.getElementById('orgPincode').value = org.pincode || '';
    document.getElementById('orgCountry').value = org.country || 'India';
    document.getElementById('orgContactPerson').value = org.contact_person || '';
    document.getElementById('orgContactDesignation').value = org.contact_designation || '';
    document.getElementById('orgContactPhone').value = org.contact_phone || '';
    document.getElementById('orgContactEmail').value = org.contact_email || '';
    editingOrgId = id;
    document.querySelector('#addOrgModal .modal-header h3').textContent = 'Edit Organization';
    document.querySelector('#addOrgForm .btn-primary').textContent = 'Update Organization';
    openModal('addOrgModal');
}

let editingOrgId = null;

// MODULES
async function loadModules() {
    try {
        const res = await apiGet('/modules');
        if (res.success) {
            const modules = res.data || [];
            const tbody = document.getElementById('modulesTableBody');
            if (!modules.length) {
                tbody.innerHTML = '<tr><td colspan="4" class="empty">No modules registered</td></tr>';
                return;
            }
            tbody.innerHTML = modules.map(m => `
                <tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.code}</td>
                    <td>${m.category || '-'}</td>
                    <td><span class="status-${m.is_available ? 'active' : 'suspended'}">${m.is_available ? 'Available' : 'Disabled'}</span></td>
                </tr>
            `).join('');
        }
    } catch(e) {}
}

// INIT
loadOverview();

// AUDIT LOGS
let auditPage = 1;

async function loadAuditLogs(page = 1) {
    auditPage = page;
    const module = document.getElementById('auditModuleFilter').value;
    const action = document.getElementById('auditActionFilter').value;
    let url = `/audit-logs?page=${page}&limit=50`;
    if (module) url += `&module=${module}`;
    if (action) url += `&action=${action}`;
    try {
        const res = await apiGet(url);
        if (res.success) {
            const logs = res.data.items || [];
            const tbody = document.getElementById('auditTableBody');
            if (!logs.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty">No audit logs found</td></tr>';
            } else {
                tbody.innerHTML = logs.map(l => `
                    <tr>
                        <td><small>${l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</small></td>
                        <td><span class="action-badge action-${(l.action||'').toLowerCase()}">${l.action || '-'}</span></td>
                        <td>${l.module || '-'}</td>
                        <td>${l.entity_type || '-'}${l.entity_id ? ' <small>#' + l.entity_id.slice(0,8) + '</small>' : ''}</td>
                        <td><small>${l.user_id ? l.user_id.slice(0,8) + '...' : 'System'}</small></td>
                        <td><small>${l.ip_address || '-'}</small></td>
                        <td><small>${l.tenant_id || '-'}</small></td>
                    </tr>
                `).join('');
            }
            // Pagination
            const total = res.data.total || 0;
            const pages = Math.ceil(total / 50);
            const pag = document.getElementById('auditPagination');
            if (pages > 1) {
                pag.innerHTML = `<span class="pag-info">Page ${page} of ${pages} (${total} records)</span>` +
                    (page > 1 ? `<button class="btn-secondary" onclick="loadAuditLogs(${page-1})">Prev</button>` : '') +
                    (page < pages ? `<button class="btn-secondary" onclick="loadAuditLogs(${page+1})">Next</button>` : '');
            } else {
                pag.innerHTML = total ? `<span class="pag-info">${total} records</span>` : '';
            }
        }
    } catch(e) {}
}
