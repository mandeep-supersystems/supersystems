// ─── PART MODULE: AUDIT LOGS ───
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
            
            // Build detailed change logs
            let detailsHtml = '';
            if (l.extra_data && l.extra_data.details) {
                detailsHtml += `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(l.extra_data.details)}</div>`;
            }
            
            if (l.action === 'CREATE' || l.action === 'GENERATE' || l.action === 'GRANT_ACCESS') {
                if (l.new_values) {
                    const dets = [];
                    Object.entries(l.new_values).forEach(([k, v]) => {
                        if (k === 'attributes' && v) {
                            const attrList = Object.entries(v).map(([ak, av]) => `${ak}: ${av}`).join(', ');
                            dets.push(`<strong>attributes</strong>: {${esc(attrList)}}`);
                        } else if (k === 'columns' && Array.isArray(v)) {
                            const colList = v.map(c => `${c.name} (${c.type})`).join(', ');
                            dets.push(`<strong>columns</strong>: [${esc(colList)}]`);
                        } else if (k === 'permissions' && Array.isArray(v)) {
                            dets.push(`<strong>permissions</strong>: [${esc(v.join(', '))}]`);
                        } else if (v !== null && typeof v !== 'object') {
                            dets.push(`<strong>${esc(k)}</strong>: ${esc(String(v))}`);
                        }
                    });
                    if (dets.length) {
                        detailsHtml += `<div style="font-size:11px;color:var(--text-muted);background:var(--bg-secondary);padding:6px;border-radius:6px;margin-top:4px;word-break:break-all;">${dets.join(' | ')}</div>`;
                    }
                }
            } else if (l.action === 'UPDATE' || l.action === 'UPDATE_ACCESS') {
                const changes = [];
                const ch = (l.extra_data && l.extra_data.changes) ? l.extra_data.changes : null;
                if (ch) {
                    Object.entries(ch).forEach(([k, change]) => {
                        let oldVal = change.old;
                        let newVal = change.new;
                        if (typeof oldVal === 'object') oldVal = JSON.stringify(oldVal);
                        if (typeof newVal === 'object') newVal = JSON.stringify(newVal);
                        changes.push(`<strong>${esc(k)}</strong>: from "${esc(String(oldVal || ''))}" to "${esc(String(newVal || ''))}"`);
                    });
                }
                if (changes.length) {
                    detailsHtml += `<div style="font-size:11px;color:var(--accent);background:var(--accent-light);padding:6px;border-radius:6px;margin-top:4px;word-break:break-all;line-height:1.4;">${changes.join('<br>')}</div>`;
                }
            }
            
            return `<tr>
                <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
                <td>
                    <div class="cell-main">${esc(l.entity_type)}</div>
                    <div class="cell-sub"><code>${esc(l.entity_id)}</code></div>
                    ${detailsHtml}
                </td>
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
