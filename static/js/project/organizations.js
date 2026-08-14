// ─── PROJECT MODULE: ORGANIZATIONS ───
let cachedOrgsLogs = [];
let _allOrgs = [];
async function showOrgsHistoryModal() {
    const tbody = document.getElementById('orgsHistoryModalBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading change history...</td></tr>';
    document.getElementById('orgsHistorySearch').value = '';
    openModal('orgsHistoryModal');
    
    try {
        const res = await fetch(API + '/audit-logs?page=1&limit=250', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.items) {
            cachedOrgsLogs = data.data.items.filter(l => l.entity_type === 'Organization');
            renderOrgsHistoryList(cachedOrgsLogs);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No organization logs recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading history logs</td></tr>';
    }
}

function renderOrgsHistoryList(logs) {
    const tbody = document.getElementById('orgsHistoryModalBody');
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">No matching history logs.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(l => {
        const user = l.user_name || l.user_email || 'System';
        let changesStr = '—';
        if (l.old_values && l.new_values) {
            try {
                const oldObj = typeof l.old_values === 'string' ? JSON.parse(l.old_values) : l.old_values;
                const newObj = typeof l.new_values === 'string' ? JSON.parse(l.new_values) : l.new_values;
                const keys = Object.keys(newObj);
                if (keys.length > 0) {
                    changesStr = keys.map(k => {
                        let ov = oldObj[k];
                        let nv = newObj[k];
                        if (typeof ov === 'object') ov = JSON.stringify(ov);
                        if (typeof nv === 'object') nv = JSON.stringify(nv);
                        return `<div style="margin-bottom:3px"><strong>${esc(k)}</strong>: <span style="text-decoration:line-through;color:#e53935">${esc(ov || 'empty')}</span> ➔ <span style="color:#2e7d32;font-weight:600">${esc(nv || 'empty')}</span></div>`;
                    }).join('');
                }
            } catch (e) {
                changesStr = 'Error parsing changes';
            }
        } else if (l.action === 'CREATE') {
            changesStr = '<span style="color:#2e7d32;font-weight:600">Created New Record</span>';
        } else if (l.action === 'DELETE' || l.action === 'DELETE_SECURE') {
            changesStr = '<span style="color:#e53935;font-weight:600">Deleted Record</span>';
        }
        return `<tr>
            <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
            <td><strong>${esc(l.entity_id)}</strong></td>
            <td><div style="font-size:11px">${changesStr}</div></td>
            <td><div class="cell-main">${esc(user)}</div><div class="cell-sub">${esc(l.user_email || '')}</div></td>
            <td><code>${esc(l.ip_address || '-')}</code></td>
            <td>${formatTime(l.created_at)}</td>
        </tr>`;
    }).join('');
}

function filterOrgsHistory(val) {
    const q = val.trim().toLowerCase();
    if (!q) {
        renderOrgsHistoryList(cachedOrgsLogs);
        return;
    }
    const filtered = cachedOrgsLogs.filter(l => 
        (l.action || '').toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q) ||
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.user_email || '').toLowerCase().includes(q)
    );
    renderOrgsHistoryList(filtered);
}

async function loadOrganizations() {
    const tbody = document.getElementById('orgsTableBody');
    try {
        const res = await fetch(API + '/organizations', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { _allOrgs = []; tbody.innerHTML = '<tr><td colspan="6" class="empty">No organizations yet.</td></tr>'; return; }
        _allOrgs = data.data;
        _renderOrgsTable(_allOrgs);
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading</td></tr>'; }
}

function _renderOrgsTable(rows) {
    const tbody = document.getElementById('orgsTableBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No matching organizations</td></tr>'; return; }
    tbody.innerHTML = rows.map(o => `<tr class="tr-clickable" onclick="openOrgDetail('${o.id}','${esc(o.name)}')"><td><strong>${esc(o.code)}</strong></td><td>${esc(o.name)}</td><td>${esc(o.industry)}</td><td>${esc(o.phone)}</td><td>${esc(o.email)}</td><td>${esc(o.gst_number)}</td></tr>`).join('');
}

function filterOrganizations(val) {
    const q = val.trim().toLowerCase();
    _renderOrgsTable(q ? _allOrgs.filter(o =>
        (o.name||'').toLowerCase().includes(q) ||
        (o.code||'').toLowerCase().includes(q) ||
        (o.industry||'').toLowerCase().includes(q) ||
        (o.email||'').toLowerCase().includes(q)
    ) : _allOrgs);
}

// ─── ORG DETAIL PAGE ───
function openOrgDetail(orgId, orgName) {
    currentOrgId = orgId;
    document.getElementById('odTitle').textContent = orgName;
    showSection('orgdetail');
}

let lastFetchedOrg = null;
let cachedOrgLogs = [];

async function showOrgHistoryModal() {
    const tbody = document.getElementById('orgHistoryModalBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading history...</td></tr>';
    document.getElementById('orgHistorySearch').value = '';
    openModal('orgHistoryModal');
    
    if (!lastFetchedOrg) return;
    
    try {
        const res = await fetch(API + '/audit-logs?page=1&limit=250', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.items) {
            cachedOrgLogs = data.data.items.filter(l => 
                (l.entity_type === 'Organization' && (l.entity_id === currentOrgId || l.entity_id === lastFetchedOrg.name || l.entity_id === lastFetchedOrg.code)) ||
                (l.entity_type === 'Project' && l.user_email && l.action === 'CREATE' && l.entity_id.toLowerCase().includes(lastFetchedOrg.code.toLowerCase()))
            );
            renderOrgHistoryList(cachedOrgLogs);
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No history logs for this organization.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading history logs</td></tr>';
    }
}

function renderOrgHistoryList(logs) {
    const tbody = document.getElementById('orgHistoryModalBody');
    if (!logs || logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No matching history logs.</td></tr>';
        return;
    }
    tbody.innerHTML = logs.map(l => {
        const user = l.user_name || l.user_email || 'System';
        let changesStr = '—';
        if (l.old_values && l.new_values) {
            try {
                const oldObj = typeof l.old_values === 'string' ? JSON.parse(l.old_values) : l.old_values;
                const newObj = typeof l.new_values === 'string' ? JSON.parse(l.new_values) : l.new_values;
                const keys = Object.keys(newObj);
                if (keys.length > 0) {
                    changesStr = keys.map(k => {
                        let ov = oldObj[k];
                        let nv = newObj[k];
                        if (typeof ov === 'object') ov = JSON.stringify(ov);
                        if (typeof nv === 'object') nv = JSON.stringify(nv);
                        return `<div style="margin-bottom:3px"><strong>${esc(k)}</strong>: <span style="text-decoration:line-through;color:#e53935">${esc(ov || 'empty')}</span> ➔ <span style="color:#2e7d32;font-weight:600">${esc(nv || 'empty')}</span></div>`;
                    }).join('');
                }
            } catch (e) {
                changesStr = 'Error parsing changes';
            }
        } else if (l.action === 'CREATE') {
            changesStr = '<span style="color:#2e7d32;font-weight:600">Created New Record</span>';
        } else if (l.action === 'DELETE' || l.action === 'DELETE_SECURE') {
            changesStr = '<span style="color:#e53935;font-weight:600">Deleted Record</span>';
        }
        return `<tr>
            <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
            <td><div style="font-size:11px">${changesStr}</div></td>
            <td><div class="cell-main">${esc(user)}</div><div class="cell-sub">${esc(l.user_email || '')}</div></td>
            <td><code>${esc(l.ip_address || '-')}</code></td>
            <td>${formatTime(l.created_at)}</td>
        </tr>`;
    }).join('');
}

function filterOrgHistory(val) {
    const q = val.trim().toLowerCase();
    if (!q) {
        renderOrgHistoryList(cachedOrgLogs);
        return;
    }
    const filtered = cachedOrgLogs.filter(l => 
        (l.action || '').toLowerCase().includes(q) ||
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.user_email || '').toLowerCase().includes(q)
    );
    renderOrgHistoryList(filtered);
}

async function loadOrgDetail(orgId) {
    // Load org info
    const res = await fetch(API + '/organizations', { headers: HEADERS });
    const data = await res.json();
    const org = (data.data || []).find(o => o.id === orgId);
    lastFetchedOrg = org;
    const infoEl = document.getElementById('odInfo');
    if (org) {
        infoEl.innerHTML = `<div class="org-detail-grid">
            <div><strong>Code:</strong> ${esc(org.code)}</div>
            <div><strong>Industry:</strong> ${esc(org.industry)}</div>
            <div><strong>Phone:</strong> ${esc(org.phone)}</div>
            <div><strong>Email:</strong> ${esc(org.email)}</div>
            <div><strong>GST:</strong> ${esc(org.gst_number)}</div>
            <div><strong>PAN:</strong> ${esc(org.pan_number)}</div>
            <div><strong>Website:</strong> ${esc(org.website)}</div>
        </div>`;
    }
    // Load projects for this org
    const pRes = await fetch(API + '/projects', { headers: HEADERS });
    const pData = await pRes.json();
    const projects = (pData.data || []).filter(p => p.organization_id === orgId);
    const tbody = document.getElementById('odProjectsBody');
    if (!projects.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No projects in this organization</td></tr>'; return; }
    tbody.innerHTML = projects.map(p => `<tr>
        <td><strong>${esc(p.project_number)}</strong></td>
        <td><a href="#" class="link-clickable" onclick="openProject('${p.id}');return false">${esc(p.project_name)}</a></td>
        <td><span class="status-badge status-${(p.status||'').replace(/\s/g,'_')}">${esc(p.status)}</span></td>
        <td>${p.start_date || '—'}</td><td>${p.due_date || '—'}</td>
        <td>${p.open_tasks} / ${p.total_tasks}</td>
    </tr>`).join('');
}

function addProjectFromOrg() {
    if (!lastFetchedOrg) return;
    showSection('addproject');
    selectOrgForProject(lastFetchedOrg.id, lastFetchedOrg.name, lastFetchedOrg.code);
}

function editOrgFromDetail() {
    if (!lastFetchedOrg) return;
    openEditOrg(lastFetchedOrg.id, lastFetchedOrg.name, lastFetchedOrg.code, lastFetchedOrg.industry, lastFetchedOrg.website, lastFetchedOrg.phone, lastFetchedOrg.email, lastFetchedOrg.gst_number, lastFetchedOrg.pan_number);
}

async function deleteOrgFromDetail() {
    if (!lastFetchedOrg) return;
    const pwd = prompt("Please enter password to confirm deletion of this organization:");
    if (pwd === null) return; // user cancelled
    if (!pwd) {
        alert("Password verification is required.");
        return;
    }
    
    // Call server with password header or verification payload
    const res = await fetch(API + '/organizations/' + lastFetchedOrg.id + '/delete-secure', { 
        method: 'DELETE', 
        headers: {
            ...HEADERS,
            'X-Confirmation-Password': pwd
        }
    });
    const data = await res.json();
    if (data.success) {
        alert("Organization deleted successfully.");
        showSection('organizations');
    } else {
        alert(data.message || "Failed to delete organization. Incorrect password.");
    }
}

function openAddOrgModal() { document.querySelectorAll('#addOrgModal input').forEach(el => el.value = ''); document.getElementById('addOrgModal').dataset.inline = 'false'; openModal('addOrgModal'); }

async function saveOrganization(e) {
    e.preventDefault();
    const body = { name: document.getElementById('aoName').value.trim(), code: document.getElementById('aoCode').value.trim(), industry: document.getElementById('aoIndustry').value.trim(), website: document.getElementById('aoWebsite').value.trim(), phone: document.getElementById('aoPhone').value.trim(), email: document.getElementById('aoEmail').value.trim(), gst_number: document.getElementById('aoGST').value.trim(), pan_number: document.getElementById('aoPAN').value.trim() };
    const res = await fetch(API + '/organizations', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addOrgModal'); if (document.getElementById('addOrgModal').dataset.inline === 'true') selectOrgForProject(data.data.id, data.data.name, body.code); loadOrganizations(); alert('Organization created!'); } else { alert(data.message); }
}

function openEditOrg(id, name, code, industry, website, phone, email, gst, pan) {
    document.getElementById('eoId').value = id; document.getElementById('eoName').value = name; document.getElementById('eoCode').value = code;
    document.getElementById('eoIndustry').value = industry; document.getElementById('eoWebsite').value = website;
    document.getElementById('eoPhone').value = phone; document.getElementById('eoEmail').value = email;
    document.getElementById('eoGST').value = gst; document.getElementById('eoPAN').value = pan;
    openModal('editOrgModal');
}

async function updateOrganization(e) {
    e.preventDefault();
    const id = document.getElementById('eoId').value;
    const body = { name: document.getElementById('eoName').value.trim(), code: document.getElementById('eoCode').value.trim(), industry: document.getElementById('eoIndustry').value.trim(), website: document.getElementById('eoWebsite').value.trim(), phone: document.getElementById('eoPhone').value.trim(), email: document.getElementById('eoEmail').value.trim(), gst_number: document.getElementById('eoGST').value.trim(), pan_number: document.getElementById('eoPAN').value.trim() };
    const res = await fetch(API + '/organizations/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { 
        closeModal('editOrgModal'); 
        if (currentOrgId === id) {
            loadOrgDetail(id);
        } else {
            loadOrganizations(); 
        }
    } else { alert(data.message); }
}


async function deleteOrg(id, name) {
    if (!confirm(`Delete organization "${name}"?`)) return;
    const res = await fetch(API + '/organizations/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadOrganizations(); else alert(data.message);
}
