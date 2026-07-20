// ─── AUTH & SECURITY: AUDIT & LOGIN HISTORY ───

let secAuditPage = 1;
let secLoginHistoryPage = 1;
let currentAuditTab = 'logs';

function switchAuditSubtab(type) {
    currentAuditTab = type;
    document.getElementById('subtabAuditLogs').classList.toggle('active', type === 'logs');
    document.getElementById('subtabLoginHistory').classList.toggle('active', type === 'login');
    document.getElementById('auditLogsWrap').style.display = type === 'logs' ? 'block' : 'none';
    document.getElementById('loginHistoryWrap').style.display = type === 'login' ? 'block' : 'none';

    if (type === 'logs') loadSecAuditLogs(1);
    else loadSecLoginHistory(1);
}

async function loadSecAuditLogs(page = 1) {
    secAuditPage = page;
    const tbody = document.getElementById('auditLogsBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading audit logs...</td></tr>';
    try {
        const res = await fetch(SEC_API + '/audit-logs?page=' + page + '&limit=30', { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.items || data.data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No audit logs recorded yet</td></tr>';
            document.getElementById('auditPagination').innerHTML = '';
            return;
        }

        const rowsHtml = data.data.items.map((l, idx) => {
            const user = l.user_name || l.user_email || 'System';
            const emailLine = l.user_email ? `<div class="cell-sub">${esc(l.user_email)}</div>` : '';
            const actionClass = 'action-' + l.action.toLowerCase();
            const summary = _buildChangesSummary(l);

            return `<tr class="audit-row-clickable" onclick="toggleAuditDetail('${idx}')">
                <td><span class="action-badge ${actionClass}">${esc(l.action)}</span></td>
                <td><div class="cell-main">${esc(l.entity_type)}</div><div class="cell-sub"><code>${esc(l.entity_id)}</code></div></td>
                <td><div class="cell-main">${esc(user)}</div>${emailLine}</td>
                <td><code>${esc(l.ip_address || '-')}</code></td>
                <td>${formatTime(l.created_at)}</td>
                <td>
                    <button class="btn-outline btn-sm" onclick="event.stopPropagation(); toggleAuditDetail('${idx}')">
                        <span class="material-icons-outlined" id="audit-icon-${idx}" style="font-size:14px">expand_more</span> View Changes
                    </button>
                </td>
            </tr>
            <tr class="audit-detail-row" id="audit-detail-${idx}" style="display:none">
                <td colspan="6">
                    <div class="audit-detail-card">
                        <div class="audit-detail-title">
                            <span class="material-icons-outlined" style="font-size:16px;color:var(--accent)">info</span>
                            What Changes Were Done
                        </div>
                        ${summary}
                    </div>
                </td>
            </tr>`;
        }).join('');

        tbody.innerHTML = rowsHtml;

        const totalPages = Math.ceil(data.data.total / 30);
        let pag = '';
        if (totalPages > 1) {
            if (page > 1) pag += `<button class="btn-page" onclick="loadSecAuditLogs(${page - 1})">← Prev</button>`;
            pag += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
            if (page < totalPages) pag += `<button class="btn-page" onclick="loadSecAuditLogs(${page + 1})">Next →</button>`;
        }
        document.getElementById('auditPagination').innerHTML = pag;
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading audit logs</td></tr>'; }
}

function toggleAuditDetail(idx) {
    const row = document.getElementById('audit-detail-' + idx);
    const icon = document.getElementById('audit-icon-' + idx);
    if (!row) return;
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
    if (icon) icon.textContent = isHidden ? 'expand_less' : 'expand_more';
}

function _buildChangesSummary(l) {
    let html = '';
    const oldV = l.old_values;
    const newV = l.new_values;
    const extra = l.extra_data;

    if (oldV || newV) {
        html += `<div class="audit-diff-grid">
            <div>
                <strong>Previous State:</strong>
                <div class="audit-diff-box old-val">${oldV ? esc(JSON.stringify(oldV, null, 2)) : '<i>(None)</i>'}</div>
            </div>
            <div>
                <strong>New State / Modifications:</strong>
                <div class="audit-diff-box new-val">${newV ? esc(JSON.stringify(newV, null, 2)) : '<i>(None)</i>'}</div>
            </div>
        </div>`;
    } else if (extra) {
        html += `<div style="margin-top:6px"><strong>Event Context & Data:</strong><div class="audit-diff-box new-val">${esc(JSON.stringify(extra, null, 2))}</div></div>`;
    } else {
        html += `<div style="color:var(--text-muted);font-style:italic">Action: ${esc(l.action)} executed on ${esc(l.entity_type)} (${esc(l.entity_id)})</div>`;
    }
    return html;
}

async function loadSecLoginHistory(page = 1) {
    secLoginHistoryPage = page;
    const tbody = document.getElementById('loginHistoryBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading login history...</td></tr>';
    try {
        const res = await fetch(SEC_API + '/login-history?page=' + page + '&limit=30', { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.items || data.data.items.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No login/logout history recorded yet</td></tr>';
            document.getElementById('loginHistoryPagination').innerHTML = '';
            return;
        }

        tbody.innerHTML = data.data.items.map(lh => {
            const loginStr = lh.login_at ? formatTime(lh.login_at) : '-';
            const logoutStr = lh.logout_at ? formatTime(lh.logout_at) : '<span class="status-badge status-active">Active Session</span>';
            const loginType = lh.login_type ? esc(lh.login_type.toUpperCase()) : 'ORGANIZATION';

            return `<tr>
                <td><div class="cell-main">${esc(lh.email || 'User')}</div><div class="cell-sub"><code>${esc(lh.user_id || '-')}</code></div></td>
                <td>${loginStr}</td>
                <td>${logoutStr}</td>
                <td><span class="role-badge role-editor">${loginType}</span></td>
                <td><code>${esc(lh.ip_address || '-')}</code></td>
            </tr>`;
        }).join('');

        const totalPages = Math.ceil(data.data.total / 30);
        let pag = '';
        if (totalPages > 1) {
            if (page > 1) pag += `<button class="btn-page" onclick="loadSecLoginHistory(${page - 1})">← Prev</button>`;
            pag += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
            if (page < totalPages) pag += `<button class="btn-page" onclick="loadSecLoginHistory(${page + 1})">Next →</button>`;
        }
        document.getElementById('loginHistoryPagination').innerHTML = pag;
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading login history</td></tr>'; }
}

function exportAuditLogs() {
    const isLoginTab = currentAuditTab === 'login';
    const rows = document.querySelectorAll(isLoginTab ? '#loginHistoryBody tr' : '#auditLogsBody tr');
    if (!rows.length || rows[0].querySelector('.empty')) { secToast('No data to export', 'error'); return; }

    let csv = isLoginTab
        ? 'User Email,Login Time,Logout Time,Login Type,IP Address\n'
        : 'Action,Entity Type,Entity ID,Performed By,IP Address,Timestamp\n';

    rows.forEach(tr => {
        if (tr.classList.contains('audit-detail-row')) return;
        const tds = tr.querySelectorAll('td');
        if (tds.length >= 5) {
            if (isLoginTab) {
                const email = tds[0].querySelector('.cell-main')?.textContent.trim() || '';
                const loginTime = tds[1].textContent.trim();
                const logoutTime = tds[2].textContent.trim();
                const type = tds[3].textContent.trim();
                const ip = tds[4].textContent.trim();
                csv += `"${email}","${loginTime}","${logoutTime}","${type}","${ip}"\n`;
            } else {
                const action = tds[0].textContent.trim();
                const entityMain = tds[1].querySelector('.cell-main')?.textContent.trim() || '';
                const entitySub = tds[1].querySelector('.cell-sub')?.textContent.trim() || '';
                const user = tds[2].querySelector('.cell-main')?.textContent.trim() || '';
                const ip = tds[3].textContent.trim();
                const time = tds[4].textContent.trim();
                csv += `"${action}","${entityMain} (${entitySub})","${user}","${ip}","${time}"\n`;
            }
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = isLoginTab ? 'login_logout_history.csv' : 'auth_security_audit_logs.csv';
    link.click();
    secToast('Logs exported');
}
