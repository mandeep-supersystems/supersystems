// ─── PROJECT MODULE: ALL PROJECTS ───
let _allProjects = [];
async function loadProjects() {
    const tbody = document.getElementById('projectsTableBody');
    try {
        const res = await fetch(API + '/projects', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { _allProjects = []; tbody.innerHTML = '<tr><td colspan="8" class="empty">No projects yet. Add one to get started.</td></tr>'; return; }
        _allProjects = data.data;
        _renderProjectsTable(_allProjects);
    } catch (e) { tbody.innerHTML = '<tr><td colspan="8" class="empty">Error loading projects</td></tr>'; }
}

function _renderProjectsTable(rows) {
    const tbody = document.getElementById('projectsTableBody');
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No matching projects</td></tr>'; return; }
    tbody.innerHTML = rows.map(p => `<tr class="tr-clickable" onclick="openProject('${p.id}')">
        <td><strong>${esc(p.project_number)}</strong></td>
        <td>${esc(p.project_name)}</td>
        <td>${esc(p.organization_name)}</td>
        <td>${esc(p.project_type)}</td>
        <td><span class="status-badge status-${p.status}">${esc(p.status)}</span></td>
        <td>${p.start_date||'—'}</td><td>${p.due_date||'—'}</td>
        <td><div class="progress-bar"><div class="progress-fill" style="width:${p.percent_complete}%"></div><span>${p.percent_complete}%</span></div></td>
    </tr>`).join('');
}

function filterProjects(val) {
    const q = val.trim().toLowerCase();
    _renderProjectsTable(q ? _allProjects.filter(p =>
        (p.project_number||'').toLowerCase().includes(q) ||
        (p.project_name||'').toLowerCase().includes(q) ||
        (p.organization_name||'').toLowerCase().includes(q) ||
        (p.project_type||'').toLowerCase().includes(q) ||
        (p.status||'').toLowerCase().includes(q)
    ) : _allProjects);
}

async function deleteProject(id, name) {
    if (!confirm(`Delete project "${name}" and all its tasks?`)) return;
    const res = await fetch(API + '/projects/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadProjects(); else alert(data.message);
}

let cachedProjsLogs = [];
async function showProjsHistoryModal() {
    const tbody = document.getElementById('projsHistoryModalBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading change history...</td></tr>';
    document.getElementById('projsHistorySearch').value = '';
    openModal('projsHistoryModal');
    
    try {
        const res = await fetch(API + '/audit-logs?page=1&limit=250', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.items) {
            cachedProjsLogs = data.data.items.filter(l => l.entity_type === 'Project' || l.entity_type === 'Task' || l.entity_type === 'Customer PO');
            renderProjsHistoryList(cachedProjsLogs);
        } else {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No project logs recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading history logs</td></tr>';
    }
}

function renderProjsHistoryList(logs) {
    const tbody = document.getElementById('projsHistoryModalBody');
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
            <td><strong>${esc(l.entity_id)}</strong><br><small style="color:var(--text-muted)">${esc(l.entity_type)}</small></td>
            <td><div style="font-size:11px">${changesStr}</div></td>
            <td><div class="cell-main">${esc(user)}</div><div class="cell-sub">${esc(l.user_email || '')}</div></td>
            <td><code>${esc(l.ip_address || '-')}</code></td>
            <td>${formatTime(l.created_at)}</td>
        </tr>`;
    }).join('');
}

function filterProjsHistory(val) {
    const q = val.trim().toLowerCase();
    if (!q) {
        renderProjsHistoryList(cachedProjsLogs);
        return;
    }
    const filtered = cachedProjsLogs.filter(l => 
        (l.action || '').toLowerCase().includes(q) ||
        (l.entity_id || '').toLowerCase().includes(q) ||
        (l.entity_type || '').toLowerCase().includes(q) ||
        (l.user_name || '').toLowerCase().includes(q) ||
        (l.user_email || '').toLowerCase().includes(q)
    );
    renderProjsHistoryList(filtered);
}
