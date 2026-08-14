// ─── PROJECT MODULE: AUDIT LOGS ───
let auditPage = 1;
let _allAuditLogs = [];

async function loadAuditLogs(page = 1) {
    auditPage = page;
    const tbody = document.getElementById('auditLogsBody');
    try {
        const res = await fetch(API + '/audit-logs?page=' + page + '&limit=20', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.items || data.data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No audit logs</td></tr>';
            document.getElementById('auditPagination').innerHTML = '';
            return;
        }
        _allAuditLogs = data.data.items;
        _renderAuditTable(_allAuditLogs);
        const totalPages = Math.ceil(data.data.total / 20);
        let pag = '';
        if (totalPages > 1) {
            if (page > 1) pag += `<button class="btn-page" onclick="loadAuditLogs(${page-1})">← Prev</button>`;
            pag += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
            if (page < totalPages) pag += `<button class="btn-page" onclick="loadAuditLogs(${page+1})">Next →</button>`;
        }
        document.getElementById('auditPagination').innerHTML = pag;
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading</td></tr>'; }
}

function _renderAuditTable(items) {
    const tbody = document.getElementById('auditLogsBody');
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No matching logs</td></tr>'; return; }
    tbody.innerHTML = items.map(l => {
        const user = l.user_name || l.user_email || 'System';
        const emailLine = l.user_email ? `<div class="cell-sub">${esc(l.user_email)}</div>` : '';
        let changesStr = '—';
        if (l.old_values && l.new_values) {
            try {
                const oldObj = typeof l.old_values === 'string' ? JSON.parse(l.old_values) : l.old_values;
                const newObj = typeof l.new_values === 'string' ? JSON.parse(l.new_values) : l.new_values;
                const keys = Object.keys(newObj);
                if (keys.length > 0) changesStr = keys.map(k => {
                    let ov = oldObj[k], nv = newObj[k];
                    if (typeof ov === 'object') ov = JSON.stringify(ov);
                    if (typeof nv === 'object') nv = JSON.stringify(nv);
                    return `<div style="margin-bottom:3px"><strong>${esc(k)}</strong>: <span style="text-decoration:line-through;color:#e53935">${esc(ov||'empty')}</span> → <span style="color:#2e7d32;font-weight:600">${esc(nv||'empty')}</span></div>`;
                }).join('');
            } catch(e) { changesStr = 'Error parsing'; }
        } else if (l.action === 'CREATE') changesStr = '<span style="color:#2e7d32;font-weight:600">Created</span>';
        else if (l.action === 'DELETE' || l.action === 'DELETE_SECURE') changesStr = '<span style="color:#e53935;font-weight:600">Deleted</span>';
        return `<tr><td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td><td><div class="cell-main">${esc(l.entity_type)}</div><div class="cell-sub"><code>${esc(l.entity_id)}</code></div></td><td><div style="font-size:11px">${changesStr}</div></td><td><div class="cell-main">${esc(user)}</div>${emailLine}</td><td><code>${esc(l.ip_address||'-')}</code></td><td>${formatTime(l.created_at)}</td></tr>`;
    }).join('');
}

function filterAuditLogs(val) {
    const q = val.trim().toLowerCase();
    _renderAuditTable(q ? _allAuditLogs.filter(l =>
        (l.action||'').toLowerCase().includes(q) ||
        (l.entity_type||'').toLowerCase().includes(q) ||
        (l.entity_id||'').toLowerCase().includes(q) ||
        (l.user_name||'').toLowerCase().includes(q) ||
        (l.user_email||'').toLowerCase().includes(q)
    ) : _allAuditLogs);
}
