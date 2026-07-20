// ─── PROJECT MODULE: AUDIT LOGS ───
let auditPage = 1;
async function loadAuditLogs(page = 1) {
    auditPage = page;
    const tbody = document.getElementById('auditLogsBody');
    try {
        const res = await fetch(API + '/audit-logs?page=' + page + '&limit=20', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.items || data.data.items.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No audit logs</td></tr>'; document.getElementById('auditPagination').innerHTML = ''; return; }
        tbody.innerHTML = data.data.items.map(l => {
            const user = l.user_name || l.user_email || 'System';
            const emailLine = l.user_email ? `<div class="cell-sub">${esc(l.user_email)}</div>` : '';
            return `<tr>
                <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
                <td><div class="cell-main">${esc(l.entity_type)}</div><div class="cell-sub"><code>${esc(l.entity_id)}</code></div></td>
                <td><div class="cell-main">${esc(user)}</div>${emailLine}</td>
                <td><code>${esc(l.ip_address || '-')}</code></td>
                <td>${formatTime(l.created_at)}</td>
            </tr>`;
        }).join('');
        const totalPages = Math.ceil(data.data.total / 20);
        let pag = '';
        if (totalPages > 1) {
            if (page > 1) pag += `<button class="btn-page" onclick="loadAuditLogs(${page-1})">← Prev</button>`;
            pag += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
            if (page < totalPages) pag += `<button class="btn-page" onclick="loadAuditLogs(${page+1})">Next →</button>`;
        }
        document.getElementById('auditPagination').innerHTML = pag;
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading</td></tr>'; }
}
