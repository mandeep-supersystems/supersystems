// PURCHASE REQUESTS FROM PLANNING JS
let _prInboxData = [];

async function loadPurchaseRequests() {
    const container = document.getElementById('purchaseRequestsBody');
    if (!container) return;
    container.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);">Loading purchase requests...</div>';

    try {
        const res = await fetch(API + '/pr-inbox', { headers: HEADERS });
        const json = await res.json();

        if (json.success && json.data && json.data.length > 0) {
            _prInboxData = json.data;
            container.innerHTML = json.data.map((pr, idx) => _prInboxCardHtml(pr, idx)).join('');
        } else {
            _prInboxData = [];
            container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-muted);">No purchase requests received from planning.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="padding:24px;text-align:center;color:red;">Error loading purchase requests.</div>';
    }
    updateSelectedPrsCount();
}

function _prInboxParseItems(notes) {
    if (!notes) return [];
    const items = [];
    notes.split('\n').forEach(line => {
        const m = line.match(/^\d+\.\s+(.+?)\s+[—\-]\s+(.+?)\s+\((\d+(?:\.\d+)?)\s+([^)]+)\)/);
        if (m) items.push({ code: m[1].trim(), desc: m[2].trim(), qty: parseFloat(m[3]), uom: m[4].trim() });
    });
    return items;
}

function _prInboxCardHtml(pr, idx) {
    const lines = _prInboxParseItems(pr.notes);
    // Fallback: single item from top-level fields
    const allItems = lines.length
        ? lines
        : [{ code: pr.item_code, desc: pr.item_description || '', qty: pr.required_qty, uom: pr.uom || 'PCS' }];

    const totalItems = allItems.length;
    const boughtItems = pr.status === 'converted_to_po' ? totalItems : 0;
    const pendingItems = totalItems - boughtItems;

    const statusCls = pr.status === 'sent_to_purchaser' ? 'badge-open'
        : pr.status === 'approved' ? 'badge-success'
        : pr.status === 'rejected' ? 'badge-red'
        : 'badge-draft';

    const priorityCls = pr.priority === 'urgent' ? 'badge-red'
        : pr.priority === 'low' ? 'badge-draft' : 'badge-open';

    const reqDate = pr.required_date || '—';
    const createdDate = pr.created_at ? new Date(pr.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

    const itemRows = allItems.map((it, i) => {
        // Per-item status: if PR is converted, all items are "bought"; otherwise all pending
        const itStatus = pr.status === 'converted_to_po'
            ? '<span class="badge badge-success" style="font-size:10px;">Bought</span>'
            : '<span class="badge badge-open" style="font-size:10px;">Pending</span>';
        return `<tr>
            <td style="color:var(--text-muted);font-size:12px;">${i + 1}</td>
            <td><code style="font-size:12px;">${_escPI(it.code)}</code></td>
            <td style="font-size:12px;color:var(--text-secondary);">${_escPI(it.desc)}</td>
            <td style="text-align:right;font-weight:600;font-size:12px;">${it.qty.toLocaleString()}</td>
            <td style="font-size:12px;">${_escPI(it.uom)}</td>
            <td>${itStatus}</td>
        </tr>`;
    }).join('');

    return `<div class="pr-inbox-card ${pr.status === 'converted_to_po' ? 'bought-pr-card' : ''}" id="pr-inbox-card-${idx}">
        <div class="pr-inbox-card-header" onclick="_prInboxToggle(${idx})" style="${pr.status === 'converted_to_po' ? 'background: rgba(46, 125, 50, 0.04);' : ''}">
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <input type="checkbox" class="pr-select-chk" value="${pr.id}"
                    ${pr.status === 'converted_to_po' ? 'disabled title="This request has already been ordered"' : ''}
                    onclick="event.stopPropagation()"
                    onchange="updateSelectedPrsCount()">
                <span class="material-icons-outlined pr-inbox-chevron" style="color:var(--text-muted);font-size:18px;transition:transform .2s;">expand_more</span>
            </div>
            <div style="flex:1;min-width:0;">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <strong style="font-size:14px;">${pr.pr_no}</strong>
                    <span class="badge ${priorityCls}" style="font-size:10px;">${pr.priority}</span>
                    <span class="badge ${statusCls}" style="font-size:10px;">${pr.status.replace(/_/g,' ')}</span>
                </div>
                <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">
                    ${pr.plan_no ? `Plan: ${pr.plan_no} &bull; ` : ''}Created: ${createdDate} &bull; Required: ${reqDate}
                    ${pr.created_by ? ` &bull; By: ${pr.created_by}` : ''}
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-shrink:0;">
                <div style="text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:var(--text-main);">${totalItems}</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Total</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:#2e7d32;">${boughtItems}</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Bought</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:18px;font-weight:700;color:#e65100;">${pendingItems}</div>
                    <div style="font-size:10px;color:var(--text-muted);text-transform:uppercase;">Pending</div>
                </div>
            </div>
        </div>
        <div class="pr-inbox-card-body" id="pr-inbox-body-${idx}" style="display:none;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
                <thead>
                    <tr style="background:var(--bg-secondary);">
                        <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">#</th>
                        <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Item Code</th>
                        <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Description</th>
                        <th style="padding:7px 10px;text-align:right;font-weight:600;color:var(--text-muted);font-size:11px;">Qty Needed</th>
                        <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">UOM</th>
                        <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-muted);font-size:11px;">Status</th>
                    </tr>
                </thead>
                <tbody>${itemRows}</tbody>
            </table>
            ${pr.suggested_supplier_name ? `<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);border-top:1px solid var(--border-color);">
                <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">storefront</span>
                Suggested Supplier: <strong>${_escPI(pr.suggested_supplier_name)}</strong>
                ${pr.estimated_unit_price ? ` &bull; Est. Price: ₹${pr.estimated_unit_price.toLocaleString()}` : ''}
            </div>` : ''}
        </div>
    </div>`;
}

function _escPI(s) {
    return s ? String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';
}

function _prInboxToggle(idx) {
    const card = document.getElementById(`pr-inbox-card-${idx}`);
    const body = document.getElementById(`pr-inbox-body-${idx}`);
    const chevron = card.querySelector('.pr-inbox-chevron');
    const open = body.style.display === 'none';
    body.style.display = open ? '' : 'none';
    chevron.style.transform = open ? 'rotate(180deg)' : '';
}

function prsSelectAll(checked) {
    document.querySelectorAll('.pr-select-chk:not(:disabled)').forEach(c => c.checked = checked);
    updateSelectedPrsCount();
}

function updateSelectedPrsCount() {
    const checked = document.querySelectorAll('.pr-select-chk:checked');
    const btn = document.getElementById('btnProceedToBuy');
    if (btn) {
        btn.disabled = checked.length === 0;
        btn.textContent = `Proceed to Buy Selected (${checked.length})`;
    }
}

function proceedToBuyMaterial() {
    const checked = document.querySelectorAll('.pr-select-chk:checked');
    const ids = [];
    checked.forEach(chk => ids.push(chk.value));
    if (ids.length === 0) {
        showToast('Please select at least one purchase request to buy', 'error');
        return;
    }
    window._selectedPrIds = ids;
    showSection('buy-material');
}

function buyAllPendingPRs() {
    const pendingIds = _prInboxData
        .filter(pr => pr.status !== 'converted_to_po')
        .map(pr => pr.id);
    
    if (pendingIds.length === 0) {
        showToast('No pending purchase requests to buy', 'error');
        return;
    }
    window._selectedPrIds = pendingIds;
    showSection('buy-material');
}

async function openPrHistoryModal() {
    openModal('prHistoryModal');
    const tbody = document.getElementById('prHistoryBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading history...</td></tr>';
    try {
        const res = await fetch(API + '/audit-logs', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.items && json.data.items.length > 0) {
            const prLogs = json.data.items.filter(log => 
                log.entity_type === 'Purchase Request' || 
                (log.new_value && log.new_value.pr_no) || 
                (log.old_value && log.old_value.pr_no)
            );
            if (prLogs.length > 0) {
                tbody.innerHTML = prLogs.map(log => {
                    let details = '';
                    if (log.action === 'CREATE' && log.new_value) {
                        let parts = [];
                        for (let k in log.new_value) {
                            if (log.new_value[k] !== null && log.new_value[k] !== '') {
                                parts.push(`${k}: ${log.new_value[k]}`);
                            }
                        }
                        details = parts.join(' | ');
                    } else if (log.action === 'DELETE' && log.old_value) {
                        let parts = [];
                        for (let k in log.old_value) {
                            if (log.old_value[k] !== null && log.old_value[k] !== '') {
                                parts.push(`${k}: ${log.old_value[k]}`);
                            }
                        }
                        details = parts.join(' | ');
                    } else if (log.action === 'UPDATE' && log.new_value && log.old_value) {
                        let changes = [];
                        for (let k in log.new_value) {
                            if (String(log.new_value[k]) !== String(log.old_value[k])) {
                                changes.push(`${k}: ${log.old_value[k]} &rarr; ${log.new_value[k]}`);
                            }
                        }
                        details = changes.join(', ');
                    }

                    const prNo = (log.new_value && log.new_value.pr_no) || (log.old_value && log.old_value.pr_no) || log.entity_id || '—';

                    return `<tr>
                        <td><span class="badge badge-info">${log.action}</span></td>
                        <td><strong>${prNo}</strong></td>
                        <td style="font-size:11px; font-family:monospace; color:var(--text-secondary); background:var(--bg-secondary); border-radius:4px; padding:6px 10px; line-height:1.4;">${details || '—'}</td>
                        <td>${log.user_name} <div style="font-size:11px; color:var(--text-muted);">${log.user_email}</div></td>
                        <td style="font-size:12px; color:var(--text-muted);">${log.created_at}</td>
                    </tr>`;
                }).join('');
            } else {
                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No Purchase Request history found.</td></tr>';
            }
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:var(--text-muted);">No history logs recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading history.</td></tr>';
    }
}
