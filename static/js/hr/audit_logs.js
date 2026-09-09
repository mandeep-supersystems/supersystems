// ─── HR AUDIT LOGS PAGE JS ───
let auditLogsList = [];
let currentPage = 1;
const pageSize = 25;
let searchTimer = null;

async function loadAuditLogs() {
    const tbody = document.getElementById('auditTableBody');
    if (!tbody) return;

    const search = document.getElementById('filterSearch')?.value.trim() || '';
    const entityType = document.getElementById('filterEntityType')?.value || '';
    const action = document.getElementById('filterAction')?.value || '';
    const fromDate = document.getElementById('filterFromDate')?.value || '';
    const toDate = document.getElementById('filterToDate')?.value || '';

    let url = `${API}/audit-logs?page=${currentPage}&limit=${pageSize}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
    if (entityType) url += `&entity_type=${encodeURIComponent(entityType)}`;
    if (action) url += `&action=${encodeURIComponent(action)}`;
    if (fromDate) url += `&from_date=${encodeURIComponent(fromDate)}`;
    if (toDate) url += `&to_date=${encodeURIComponent(toDate)}`;

    try {
        const res = await fetch(url, { headers: headers() });
        const resJson = await res.json();
        const data = resJson.data || {};
        auditLogsList = data.items || [];
        const total = data.total || 0;
        const stats = data.stats || {};

        // Update stats
        document.getElementById('statTotal').textContent = stats.total ?? total;
        document.getElementById('statCreates').textContent = stats.creates ?? 0;
        document.getElementById('statUpdates').textContent = stats.updates ?? 0;
        document.getElementById('statDeletes').textContent = stats.deletes ?? 0;
        document.getElementById('statUsers').textContent = stats.unique_users ?? 0;

        // Render table
        if (!auditLogsList.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="empty">No audit logs found matching your criteria</td></tr>';
        } else {
            tbody.innerHTML = auditLogsList.map((item, idx) => {
                const actionClass = getActionBadgeClass(item.action);
                const changesHtml = renderChangesPreview(item);
                const timeStr = item.created_at ? item.created_at.replace('T', ' ').substring(0, 19) : '—';
                const userDisplay = item.user_email ? `<strong>${escapeHtml(item.user_email)}</strong>${item.user_name ? `<br><small style="color:var(--text-secondary)">${escapeHtml(item.user_name)}</small>` : ''}` : '<span style="color:var(--text-secondary)">System</span>';

                return `<tr>
                    <td style="font-size:12px;color:var(--text-secondary)">${timeStr}</td>
                    <td>${userDisplay}</td>
                    <td><span class="badge-action ${actionClass}">${item.action || 'ACTION'}</span></td>
                    <td><strong>${escapeHtml(item.entity_type || '—')}</strong></td>
                    <td><span class="preview-code" style="max-width:180px;display:inline-block;overflow:hidden;text-overflow:ellipsis;vertical-align:middle;">${escapeHtml(item.entity_id || '—')}</span></td>
                    <td>${changesHtml}</td>
                    <td style="font-size:12px;color:var(--text-secondary)">${escapeHtml(item.ip_address || '—')}</td>
                    <td>
                        <button class="btn-icon" title="View Detailed Diff" onclick="viewLogDiff(${idx})">
                            <span class="material-icons-outlined">visibility</span>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }

        // Pagination controls
        const totalPages = Math.ceil(total / pageSize) || 1;
        document.getElementById('pageIndicator').textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('pageCountInfo').textContent = `Showing ${auditLogsList.length ? (currentPage - 1) * pageSize + 1 : 0} - ${(currentPage - 1) * pageSize + auditLogsList.length} of ${total} records`;
        document.getElementById('btnPrev').disabled = (currentPage <= 1);
        document.getElementById('btnNext').disabled = (currentPage >= totalPages);
    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="8" class="empty">Error loading audit logs: ${escapeHtml(e.message)}</td></tr>`;
    }
}

function getActionBadgeClass(act) {
    switch ((act || '').toUpperCase()) {
        case 'CREATE': return 'badge-create';
        case 'UPDATE': return 'badge-update';
        case 'DELETE': return 'badge-delete';
        case 'APPROVE': return 'badge-approve';
        case 'REJECT': return 'badge-reject';
        default: return 'badge-other';
    }
}

function renderChangesPreview(item) {
    const extra = item.extra_data || {};
    const changes = extra.changes || {};
    const changeKeys = Object.keys(changes);

    if (changeKeys.length > 0) {
        const rows = changeKeys.slice(0, 3).map(k => {
            const diff = changes[k] || {};
            const oldVal = diff.old !== null && diff.old !== undefined ? String(diff.old) : 'null';
            const newVal = diff.new !== null && diff.new !== undefined ? String(diff.new) : 'null';
            return `<div class="diff-tag-row">
                <span class="diff-tag-field">${escapeHtml(k)}:</span> 
                <span class="diff-old">${escapeHtml(oldVal)}</span> 
                <span class="diff-new">${escapeHtml(newVal)}</span>
            </div>`;
        });
        if (changeKeys.length > 3) {
            rows.push(`<small style="color:var(--text-secondary)">+ ${changeKeys.length - 3} more change${changeKeys.length - 3 !== 1 ? 's' : ''}</small>`);
        }
        return `<div class="diff-tag-container">${rows.join('')}</div>`;
    }

    if (item.action === 'CREATE' && extra.new) {
        const keys = Object.keys(extra.new);
        return `<div style="font-size:12px;color:var(--text-secondary)">Created with ${keys.length} field${keys.length !== 1 ? 's' : ''}</div>`;
    }
    if (item.action === 'DELETE') {
        return `<div style="font-size:12px;color:#d32f2f">Record deleted</div>`;
    }
    return `<div style="font-size:12px;color:var(--text-secondary)">No field diff recorded</div>`;
}

function viewLogDiff(index) {
    const item = auditLogsList[index];
    if (!item) return;

    document.getElementById('diffModalTitle').textContent = `${item.action} ${item.entity_type}: ${item.entity_id}`;
    
    const timeStr = item.created_at ? item.created_at.replace('T', ' ').substring(0, 19) : '—';
    document.getElementById('diffModalMeta').innerHTML = `
        <div style="display:flex;gap:16px;flex-wrap:wrap">
            <div><strong>User:</strong> ${escapeHtml(item.user_email || 'System')} (${escapeHtml(item.user_name || 'N/A')})</div>
            <div><strong>Time:</strong> ${timeStr}</div>
            <div><strong>IP:</strong> ${escapeHtml(item.ip_address || '—')}</div>
        </div>
    `;

    const extra = item.extra_data || {};
    const changes = extra.changes || {};
    const changeKeys = Object.keys(changes);
    const content = document.getElementById('diffModalContent');

    if (changeKeys.length > 0) {
        content.innerHTML = `
            <table class="diff-table">
                <thead>
                    <tr>
                        <th style="width:30%">Field Name</th>
                        <th style="width:35%">Old Value</th>
                        <th style="width:35%">New Value</th>
                    </tr>
                </thead>
                <tbody>
                    ${changeKeys.map(k => {
                        const d = changes[k] || {};
                        const oldVal = d.old !== null && d.old !== undefined ? String(d.old) : '<em>empty</em>';
                        const newVal = d.new !== null && d.new !== undefined ? String(d.new) : '<em>empty</em>';
                        return `<tr>
                            <td><strong>${escapeHtml(k)}</strong></td>
                            <td><span class="diff-old">${escapeHtml(oldVal)}</span></td>
                            <td><span class="diff-new">${escapeHtml(newVal)}</span></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;
    } else if (extra.new) {
        const entries = Object.entries(extra.new);
        content.innerHTML = `
            <h4 style="margin:8px 0;font-size:13px;color:var(--text-secondary)">Captured Attributes</h4>
            <table class="diff-table">
                <thead><tr><th>Field</th><th>Value</th></tr></thead>
                <tbody>
                    ${entries.map(([k, v]) => `<tr><td><strong>${escapeHtml(k)}</strong></td><td>${escapeHtml(String(v ?? ''))}</td></tr>`).join('')}
                </tbody>
            </table>
        `;
    } else {
        content.innerHTML = `<div class="ovr-empty" style="padding:20px">No additional change values recorded for this action.</div>`;
    }

    openModal('diffModal');
}

function debouncedSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
        currentPage = 1;
        loadAuditLogs();
    }, 300);
}

function resetFilters() {
    ['filterSearch', 'filterEntityType', 'filterAction', 'filterFromDate', 'filterToDate'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    currentPage = 1;
    loadAuditLogs();
}

function changePage(delta) {
    currentPage += delta;
    if (currentPage < 1) currentPage = 1;
    loadAuditLogs();
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    loadAuditLogs();
});
