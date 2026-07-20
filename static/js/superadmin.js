const API = '/superadmin/api';

// ── URL-BASED ROUTING ──────────────────────────────────────────
const SECTIONS = ['overview','organizations','modules','licenses','monitoring','audit','settings'];

function navigateTo(section) {
    if (!SECTIONS.includes(section)) section = 'overview';
    history.pushState({section}, '', '/superadmin/' + section);
    activateSection(section);
}

function activateSection(section) {
    document.querySelectorAll('.nav-link[data-section]').forEach(l => {
        l.classList.toggle('active', l.dataset.section === section);
    });
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('sec-' + section);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.nav-link[data-section="${section}"]`);
    document.getElementById('pageTitle').textContent = link ? link.textContent.trim() : section;
    if (section === 'overview')       loadOverview();
    if (section === 'organizations')  loadOrganizations();
    if (section === 'modules')        loadModules();
    if (section === 'monitoring')     loadMonitoring();
    if (section === 'audit')          loadAuditLogs();
}

document.querySelectorAll('.nav-link[data-section]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(link.dataset.section);
    });
});

window.addEventListener('popstate', e => {
    const section = (e.state && e.state.section) || currentSection();
    activateSection(section);
});

function currentSection() {
    const parts = location.pathname.split('/');
    const s = parts[parts.length - 1];
    return SECTIONS.includes(s) ? s : 'overview';
}

// Init on load
(function() {
    const saved = localStorage.getItem('sa_theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);
    const section = currentSection();
    activateSection(section);
})();


// ── THEME ──────────────────────────────────────────────────────
function toggleTheme() {
    const html = document.documentElement;
    const theme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', theme);
    localStorage.setItem('sa_theme', theme);
}

// ── MODAL ──────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ── API HELPERS ────────────────────────────────────────────────
async function apiGet(path) {
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(res.status);
    return res.json();
}

async function apiPost(path, body) {
    const res = await fetch(API + path, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
    return res.json();
}

// ── OVERVIEW ───────────────────────────────────────────────────
async function loadOverview() {
    try {
        const res = await apiGet('/overview');
        if (res.success) {
            document.getElementById('statOrgs').textContent    = res.data.total_tenants || 0;
            document.getElementById('statUsers').textContent   = res.data.total_users || 0;
            document.getElementById('statLicenses').textContent = res.data.active_licenses || 0;
            document.getElementById('statSubs').textContent    = res.data.active_subscriptions || 0;
        }
    } catch(e) {}
}

// ── ORGANIZATIONS ──────────────────────────────────────────────
let organizations = [];
let editingOrgId = null;

async function loadOrganizations() {
    try {
        const res = await apiGet('/organizations');
        if (res.success) {
            organizations = res.data.items || res.data || [];
            renderOrganizations();
        }
    } catch(e) { renderOrganizations(); }
}

function renderOrganizations() {
    const tbody = document.getElementById('orgsTableBody');
    if (!organizations.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No organizations yet. Click "Add Organization" to create one.</td></tr>';
        return;
    }
    tbody.innerHTML = organizations.map(org => `
        <tr class="org-row" onclick="editOrg('${org.id}')">
            <td><strong>${org.name}</strong><br><small style="color:var(--text-muted)">${org.email || ''}</small></td>
            <td>${org.code || ''}</td>
            <td>${org.pan || '-'}</td>
            <td>${org.city || '-'}${org.state ? ', ' + org.state : ''}</td>
            <td>${org.industry || '-'}</td>
            <td>
                <span class="status-${org.is_active !== false ? 'active' : 'suspended'}">${org.is_active !== false ? 'Active' : 'Suspended'}</span>
                <button class="icon-btn" title="${org.is_active !== false ? 'Suspend' : 'Activate'}" onclick="event.stopPropagation(); ${org.is_active !== false ? `suspendOrg('${org.id}')` : `activateOrg('${org.id}')`}">
                    <span class="material-icons-outlined">${org.is_active !== false ? 'pause_circle' : 'play_circle'}</span>
                </button>
            </td>
        </tr>
    `).join('');
}

async function createOrganization(e) {
    e.preventDefault();
    const data = {
        name:                 document.getElementById('orgName').value.trim(),
        code:                 document.getElementById('orgCode').value.trim().toUpperCase(),
        domain:               document.getElementById('orgDomain').value.trim(),
        industry:             document.getElementById('orgIndustry').value,
        employee_count:       document.getElementById('orgEmpCount').value,
        pan:                  document.getElementById('orgPan').value.trim().toUpperCase(),
        gst:                  document.getElementById('orgGst').value.trim().toUpperCase(),
        cin:                  document.getElementById('orgCin').value.trim().toUpperCase(),
        email:                document.getElementById('orgEmail').value.trim(),
        phone:                document.getElementById('orgPhone').value.trim(),
        address_line1:        document.getElementById('orgAddr1').value.trim(),
        address_line2:        document.getElementById('orgAddr2').value.trim(),
        city:                 document.getElementById('orgCity').value.trim(),
        state:                document.getElementById('orgState').value.trim(),
        pincode:              document.getElementById('orgPincode').value.trim(),
        country:              document.getElementById('orgCountry').value.trim(),
        contact_person:       document.getElementById('orgContactPerson').value.trim(),
        contact_designation:  document.getElementById('orgContactDesignation').value.trim(),
        contact_phone:        document.getElementById('orgContactPhone').value.trim(),
        contact_email:        document.getElementById('orgContactEmail').value.trim()
    };

    const btn = document.querySelector('#addOrgForm .btn-primary');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        let res;
        if (editingOrgId) {
            res = await apiPost('/organizations/' + editingOrgId + '/update', data);
        } else {
            res = await apiPost('/organizations', data);
        }
        if (res.success) {
            closeModal('addOrgModal');
            resetOrgForm();
            await loadOrganizations();
            await loadOverview();
        } else {
            alert(res.message || 'Failed to save organization');
        }
    } catch(e) {
        alert('Network error. Please try again.');
    } finally {
        btn.disabled = false;
        btn.textContent = editingOrgId ? 'Update Organization' : 'Create Organization';
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
    else alert(res.message || 'Failed');
}

async function activateOrg(id) {
    const res = await apiPost('/organizations/' + id + '/activate', {});
    if (res.success) loadOrganizations();
    else alert(res.message || 'Failed');
}

async function editOrg(id) {
    try {
        const res = await apiGet('/organizations/' + id);
        if (!res.success) return alert('Failed to load organization');
        const org = res.data;
        document.getElementById('orgName').value                = org.name || '';
        document.getElementById('orgCode').value                = org.code || '';
        document.getElementById('orgIndustry').value            = org.industry || '';
        document.getElementById('orgEmpCount').value            = org.employee_count || '';
        document.getElementById('orgPan').value                 = org.pan || '';
        document.getElementById('orgGst').value                 = org.gst || '';
        document.getElementById('orgCin').value                 = org.cin || '';
        document.getElementById('orgDomain').value              = org.domain || '';
        document.getElementById('orgEmail').value               = org.email || '';
        document.getElementById('orgPhone').value               = org.phone || '';
        document.getElementById('orgAddr1').value               = org.address_line1 || '';
        document.getElementById('orgAddr2').value               = org.address_line2 || '';
        document.getElementById('orgCity').value                = org.city || '';
        document.getElementById('orgState').value               = org.state || '';
        document.getElementById('orgPincode').value             = org.pincode || '';
        document.getElementById('orgCountry').value             = org.country || 'India';
        document.getElementById('orgContactPerson').value       = org.contact_person || '';
        document.getElementById('orgContactDesignation').value  = org.contact_designation || '';
        document.getElementById('orgContactPhone').value        = org.contact_phone || '';
        document.getElementById('orgContactEmail').value        = org.contact_email || '';
        editingOrgId = id;
        document.querySelector('#addOrgModal .modal-header h3').textContent = 'Edit Organization';
        document.querySelector('#addOrgForm .btn-primary').textContent = 'Update Organization';
        openModal('addOrgModal');
    } catch(e) { alert('Failed to load organization'); }
}

// ── MODULES ────────────────────────────────────────────────────
async function loadModules() {
    try {
        const res = await apiGet('/modules');
        const modules = (res.success && res.data) ? res.data : [];
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
    } catch(e) {}
}

// ── MONITORING ─────────────────────────────────────────────────
async function loadMonitoring() {
    const tbody = document.getElementById('monitoringTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';
    try {
        const res = await apiGet('/monitoring');
        const data = (res.success && res.data) ? res.data : [];
        if (!data.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No organizations found</td></tr>';
            return;
        }
        tbody.innerHTML = data.map(r => `
            <tr class="mon-row" onclick="openMonitorDetail('${r.id}')">
                <td><strong>${r.name}</strong><br><small style="color:var(--text-muted)">${r.code}</small></td>
                <td>${r.user_count}</td>
                <td>${r.active_users || 0}</td>
                <td>${r.module_count || 0}</td>
                <td><span class="status-${r.is_active ? 'active' : 'suspended'}">${r.is_active ? 'Active' : 'Suspended'}</span></td>
                <td><small>${r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}</small></td>
            </tr>
        `).join('');
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Failed to load monitoring data</td></tr>';
    }
}

async function openMonitorDetail(orgId) {
    const panel = document.getElementById('monitorPanel');
    panel.classList.add('active');
    document.getElementById('monitorPanelBody').innerHTML = '<div class="monitor-loading"><span class="material-icons-outlined spin">sync</span> Loading...</div>';
    try {
        const [orgRes, monRes] = await Promise.all([
            apiGet('/organizations/' + orgId),
            apiGet('/monitoring/' + orgId)
        ]);
        const org = orgRes.success ? orgRes.data : {};
        const mon = monRes.success ? monRes.data : {};
        document.getElementById('monitorPanelTitle').textContent = org.name || 'Organization';
        document.getElementById('monitorPanelBody').innerHTML = `
            <div class="mon-detail-grid">
                <div class="mon-stat-card">
                    <span class="material-icons-outlined">people</span>
                    <div><h4>${mon.user_count || 0}</h4><p>Total Users</p></div>
                </div>
                <div class="mon-stat-card">
                    <span class="material-icons-outlined">person_check</span>
                    <div><h4>${mon.active_users || 0}</h4><p>Active Users</p></div>
                </div>
                <div class="mon-stat-card">
                    <span class="material-icons-outlined">extension</span>
                    <div><h4>${mon.module_count || 0}</h4><p>Modules</p></div>
                </div>
                <div class="mon-stat-card">
                    <span class="material-icons-outlined">history</span>
                    <div><h4>${mon.audit_count || 0}</h4><p>Audit Events</p></div>
                </div>
            </div>

            <div class="mon-section">
                <h5><span class="material-icons-outlined">business</span> Organization Info</h5>
                <div class="mon-info-grid">
                    <div><label>Code</label><span>${org.code || '-'}</span></div>
                    <div><label>Industry</label><span>${org.industry || '-'}</span></div>
                    <div><label>Email</label><span>${org.email || '-'}</span></div>
                    <div><label>Phone</label><span>${org.phone || '-'}</span></div>
                    <div><label>City</label><span>${org.city || '-'}${org.state ? ', ' + org.state : ''}</span></div>
                    <div><label>PAN</label><span>${org.pan || '-'}</span></div>
                    <div><label>GST</label><span>${org.gst || '-'}</span></div>
                    <div><label>Status</label><span class="status-${org.is_active ? 'active' : 'suspended'}">${org.is_active ? 'Active' : 'Suspended'}</span></div>
                </div>
            </div>

            <div class="mon-section">
                <h5><span class="material-icons-outlined">wifi</span> Connectivity</h5>
                <div class="mon-conn-grid">
                    <div class="mon-conn-item conn-ok">
                        <span class="material-icons-outlined">check_circle</span>
                        <div><strong>API</strong><small>Connected</small></div>
                    </div>
                    <div class="mon-conn-item ${mon.db_connected !== false ? 'conn-ok' : 'conn-err'}">
                        <span class="material-icons-outlined">${mon.db_connected !== false ? 'check_circle' : 'error'}</span>
                        <div><strong>Database</strong><small>${mon.db_connected !== false ? 'Connected' : 'Error'}</small></div>
                    </div>
                    <div class="mon-conn-item conn-ok">
                        <span class="material-icons-outlined">check_circle</span>
                        <div><strong>Auth</strong><small>Operational</small></div>
                    </div>
                    <div class="mon-conn-item ${mon.last_login ? 'conn-ok' : 'conn-warn'}">
                        <span class="material-icons-outlined">${mon.last_login ? 'check_circle' : 'warning'}</span>
                        <div><strong>Last Login</strong><small>${mon.last_login ? new Date(mon.last_login).toLocaleString() : 'Never'}</small></div>
                    </div>
                </div>
            </div>

            ${mon.recent_activity && mon.recent_activity.length ? `
            <div class="mon-section">
                <h5><span class="material-icons-outlined">timeline</span> Recent Activity</h5>
                <div class="mon-activity-list">
                    ${mon.recent_activity.map(a => `
                        <div class="mon-activity-item">
                            <span class="action-badge action-${(a.action||'').toLowerCase()}">${a.action}</span>
                            <span>${a.module || '-'} &mdash; ${a.entity_type || ''}</span>
                            <small>${a.created_at ? new Date(a.created_at).toLocaleString() : ''}</small>
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}

            ${mon.modules && mon.modules.length ? `
            <div class="mon-section">
                <h5><span class="material-icons-outlined">extension</span> Module Access</h5>
                <div class="mon-modules-grid">
                    ${mon.modules.map(m => `
                        <div class="mon-module-chip ${m.is_enabled ? 'chip-on' : 'chip-off'}">
                            <span class="material-icons-outlined">${m.is_enabled ? 'check' : 'close'}</span>${m.module_name || m.module_code}
                        </div>
                    `).join('')}
                </div>
            </div>` : ''}
        `;
    } catch(e) {
        document.getElementById('monitorPanelBody').innerHTML = '<div class="monitor-loading">Failed to load details</div>';
    }
}

function closeMonitorPanel() {
    document.getElementById('monitorPanel').classList.remove('active');
}

// ── AUDIT LOGS ─────────────────────────────────────────────────
let auditPage = 1;

async function loadAuditLogs(page = 1) {
    auditPage = page;
    const module = document.getElementById('auditModuleFilter').value;
    const action = document.getElementById('auditActionFilter').value;
    let url = `/audit-logs?page=${page}&limit=50`;
    if (module) url += `&module=${encodeURIComponent(module)}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    const tbody = document.getElementById('auditTableBody');
    tbody.innerHTML = '<tr><td colspan="7" class="empty">Loading...</td></tr>';
    try {
        const res = await apiGet(url);
        if (res.success) {
            const logs = res.data.items || [];
            if (!logs.length) {
                tbody.innerHTML = '<tr><td colspan="7" class="empty">No audit logs found</td></tr>';
            } else {
                tbody.innerHTML = logs.map(l => `
                    <tr>
                        <td><small>${l.created_at ? new Date(l.created_at).toLocaleString() : '-'}</small></td>
                        <td><span class="action-badge action-${(l.action||'').toLowerCase()}">${l.action || '-'}</span></td>
                        <td>${l.module || '-'}</td>
                        <td>${l.entity_type || '-'}${l.entity_id ? ' <small>#' + String(l.entity_id).slice(0,8) + '</small>' : ''}</td>
                        <td><small>${l.user_name || l.user_email || 'System'}</small></td>
                        <td><small>${l.ip_address || '-'}</small></td>
                        <td><small>${l.tenant_id || '-'}</small></td>
                    </tr>
                `).join('');
            }
            const total = res.data.total || 0;
            const pages = Math.ceil(total / 50);
            const pag = document.getElementById('auditPagination');
            pag.innerHTML = pages > 1
                ? `<span class="pag-info">Page ${page} of ${pages} (${total} records)</span>` +
                  (page > 1 ? `<button class="btn-secondary" onclick="loadAuditLogs(${page-1})">Prev</button>` : '') +
                  (page < pages ? `<button class="btn-secondary" onclick="loadAuditLogs(${page+1})">Next</button>` : '')
                : (total ? `<span class="pag-info">${total} records</span>` : '');
        }
    } catch(e) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty">Failed to load audit logs</td></tr>';
    }
}
