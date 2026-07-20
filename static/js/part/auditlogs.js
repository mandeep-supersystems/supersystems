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

// ─── OBSOLETE PARTS ───
async function obsoletePart(subId, partNumber) {
    pendingDelete = { type: 'obsolete', subId, partNumber };
    document.getElementById('deleteConfirmMsg').textContent = `Mark part "${partNumber}" as obsolete? Enter your password to confirm.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

async function loadObsoleteParts() {
    const tbody = document.getElementById('obsoletePartsBody');
    try {
        const res = await fetch(API + '/obsolete-parts', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || data.data.length === 0) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No obsolete parts</td></tr>'; return; }
        tbody.innerHTML = data.data.map(p => `<tr class="obsolete-row">
            <td><strong>${esc(p.part_number)}</strong></td>
            <td>${esc(p.category || '-')}</td>
            <td>${esc(p.subcategory || '-')}</td>
            <td>${formatTime(p.obsoleted_at)}</td>
            <td>${esc(p.reason || '-')}</td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading</td></tr>'; }
}

// ─── DELETE WITH PASSWORD ───
async function executeDelete() {
    const password = document.getElementById('deleteConfirmPassword').value;
    if (!password) { showDeleteError('Password is required'); return; }
    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true; btn.textContent = 'Verifying...';
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    try {
        const verifyRes = await fetch('/api/v1/auth/verify-password', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '') }, body: JSON.stringify({ email: user.email || '', password }) });
        const verifyData = await verifyRes.json();
        if (!verifyData.success) { showDeleteError(verifyData.message || 'Incorrect password'); btn.disabled = false; btn.textContent = 'Delete'; return; }
    } catch (e) { showDeleteError('Failed to verify password'); btn.disabled = false; btn.textContent = 'Delete'; return; }
    try {
        if (pendingDelete.type === 'category') { const res = await fetch(API + '/categories/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS }); const data = await res.json(); if (data.success) { showToast('Category deleted'); loadCategories(); } else showToast(data.message, 'error'); }
        else if (pendingDelete.type === 'subcategory') { const res = await fetch(API + '/subcategories/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS }); const data = await res.json(); if (data.success) { showToast('Subcategory deleted'); loadSubcategories(); } else showToast(data.message, 'error'); }
        else if (pendingDelete.type === 'obsolete') { const res = await fetch(API + '/obsolete', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: pendingDelete.subId, part_number: pendingDelete.partNumber }) }); const data = await res.json(); if (data.success) { showToast(`Part ${pendingDelete.partNumber} marked as obsolete`); loadGeneratedParts(pendingDelete.subId); } else showToast(data.message, 'error'); }
        else if (pendingDelete.type === 'revoke_access') { const res = await fetch(API + '/users/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS }); const data = await res.json(); if (data.success) { showToast('Access revoked'); loadModuleUsers(); } else showToast(data.message, 'error'); }
    } catch (e) { showToast('Network error', 'error'); }
    partCloseModal('deleteConfirmModal'); pendingDelete = null; btn.disabled = false; btn.textContent = 'Delete';
}

function showDeleteError(msg) { const el = document.getElementById('deleteError'); el.textContent = msg; el.style.display = 'block'; }
