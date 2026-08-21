// ─── AUTH & SECURITY: AUDIT & LOGIN HISTORY ───

let secAuditPage = 1;
let secLoginHistoryPage = 1;
let secAccessLogPage = 1;
let currentAuditTab = 'logs';
let _accessLogCache = [];

function switchAuditSubtab(type) {
    currentAuditTab = type;
    document.getElementById('subtabAuditLogs').classList.toggle('active', type === 'logs');
    document.getElementById('subtabLoginHistory').classList.toggle('active', type === 'login');
    document.getElementById('subtabAccessLog').classList.toggle('active', type === 'access');
    document.getElementById('auditLogsWrap').style.display = type === 'logs' ? 'block' : 'none';
    document.getElementById('loginHistoryWrap').style.display = type === 'login' ? 'block' : 'none';
    document.getElementById('accessLogWrap').style.display = type === 'access' ? 'block' : 'none';

    if (type === 'logs') loadSecAuditLogs(1);
    else if (type === 'login') loadSecLoginHistory(1);
    else loadAccessLog(1);
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
    const isAccessTab = currentAuditTab === 'access';
    const rows = document.querySelectorAll(isLoginTab ? '#loginHistoryBody tr' : isAccessTab ? '#accessLogBody tr' : '#auditLogsBody tr');
    if (!rows.length || rows[0].querySelector('.empty')) { secToast('No data to export', 'error'); return; }

    let csv = isLoginTab
        ? 'User Email,Login Time,Logout Time,Login Type,IP Address\n'
        : isAccessTab
        ? 'User,Action,Module,Entity / Section,IP Address,Timestamp\n'
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
            } else if (isAccessTab) {
                const user = tds[0].querySelector('.cell-main')?.textContent.trim() || '';
                const action = tds[1].textContent.trim();
                const module = tds[2].textContent.trim();
                const entity = tds[3].textContent.trim();
                const ip = tds[4].textContent.trim();
                const time = tds[5].textContent.trim();
                csv += `"${user}","${action}","${module}","${entity}","${ip}","${time}"\n`;
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
    link.download = isLoginTab ? 'login_logout_history.csv' : isAccessTab ? 'who_accessed_log.csv' : 'auth_security_audit_logs.csv';
    link.click();
    secToast('Logs exported');
}

// ─── WHO ACCESSED ───
async function loadAccessLog(page = 1) {
    secAccessLogPage = page;
    const tbody = document.getElementById('accessLogBody');
    tbody.innerHTML = '<tr><td colspan="6" class="empty">Loading...</td></tr>';
    const moduleFilter = document.getElementById('accessLogModuleFilter')?.value || '';
    try {
        let url = SEC_API + '/access-log?page=' + page + '&limit=50';
        if (moduleFilter) url += '&module=' + encodeURIComponent(moduleFilter);
        const res = await fetch(url, { headers: SEC_HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.items || !data.data.items.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty">No access records found</td></tr>';
            document.getElementById('accessLogPagination').innerHTML = '';
            return;
        }
        _accessLogCache = data.data.items;
        _renderAccessLog(_accessLogCache);
        const totalPages = Math.ceil(data.data.total / 50);
        let pag = '';
        if (totalPages > 1) {
            if (page > 1) pag += `<button class="btn-page" onclick="loadAccessLog(${page - 1})">← Prev</button>`;
            pag += `<span class="page-info">Page ${page} of ${totalPages}</span>`;
            if (page < totalPages) pag += `<button class="btn-page" onclick="loadAccessLog(${page + 1})">Next →</button>`;
        }
        document.getElementById('accessLogPagination').innerHTML = pag;

        // Populate module filter dropdown once
        const sel = document.getElementById('accessLogModuleFilter');
        if (sel && sel.options.length <= 1) {
            const modules = [...new Set(data.data.items.map(r => r.module).filter(Boolean))];
            modules.sort().forEach(m => {
                const opt = document.createElement('option');
                opt.value = m; opt.textContent = m;
                sel.appendChild(opt);
            });
        }
    } catch (e) { tbody.innerHTML = '<tr><td colspan="6" class="empty">Error loading access log</td></tr>'; }
}

function _renderAccessLog(items) {
    const tbody = document.getElementById('accessLogBody');
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No records found</td></tr>'; return; }
    tbody.innerHTML = items.map(r => {
        const user = r.user_name || r.user_email || 'System';
        const emailLine = r.user_email ? `<div class="cell-sub">${esc(r.user_email)}</div>` : '';
        const actionClass = 'action-' + (r.action || '').toLowerCase();
        return `<tr>
            <td><div class="cell-main">${esc(user)}</div>${emailLine}</td>
            <td><span class="action-badge ${actionClass}">${esc(r.action || '-')}</span></td>
            <td>${esc(r.module || '-')}</td>
            <td><div class="cell-main">${esc(r.entity_type || '-')}</div><div class="cell-sub"><code>${esc(r.entity_id || '')}</code></div></td>
            <td><code>${esc(r.ip_address || '-')}</code></td>
            <td>${formatTime(r.created_at)}</td>
        </tr>`;
    }).join('');
}

function filterAccessLog(query) {
    if (!query.trim()) { _renderAccessLog(_accessLogCache); return; }
    const q = query.toLowerCase();
    _renderAccessLog(_accessLogCache.filter(r =>
        (r.user_email || '').toLowerCase().includes(q) ||
        (r.user_name || '').toLowerCase().includes(q) ||
        (r.action || '').toLowerCase().includes(q) ||
        (r.module || '').toLowerCase().includes(q) ||
        (r.entity_type || '').toLowerCase().includes(q) ||
        (r.entity_id || '').toLowerCase().includes(q)
    ));
}
