// PURCHASE ORDERS & LEAD TIME TRACKING JS
let _poListData = [];
let _etdPoId = null;
let _etdOriginal = null;
let _currentPoFilter = 'all';

async function loadPurchaseOrders() {
    const tbody = document.getElementById('purchaseOrdersBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/po-list', { headers: HEADERS });
        const json = await res.json();
        if (!json.success) {
            tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:red;">Error: ${json.message}</td></tr>`;
            return;
        }
        _poListData = json.data || [];
        renderFilteredPos();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:red;">Error loading purchase orders.</td></tr>';
    }
}

function filterPoList(type) {
    _currentPoFilter = type;
    document.querySelectorAll('.section-tabs button').forEach(btn => {
        btn.classList.remove('active');
        btn.style.borderColor = 'var(--border-color)';
        btn.style.background = 'none';
        btn.style.color = 'var(--text-main)';
    });
    
    const activeBtn = document.getElementById('tab-po-' + type);
    if (activeBtn) {
        activeBtn.classList.add('active');
        activeBtn.style.borderColor = '#1976d2';
        activeBtn.style.background = '#e3f2fd';
        activeBtn.style.color = '#1565c0';
    }
    
    renderFilteredPos();
}

function renderFilteredPos() {
    const tbody = document.getElementById('purchaseOrdersBody');
    if (!tbody) return;
    
    let filtered = _poListData;
    if (_currentPoFilter === 'sent') {
        filtered = _poListData.filter(po => po.po_status === 'sent_to_supplier' || po.po_status === 'acknowledged' || po.po_status === 'partially_received');
    } else if (_currentPoFilter === 'received') {
        filtered = _poListData.filter(po => po.po_status === 'received');
    } else if (_currentPoFilter === 'draft') {
        filtered = _poListData.filter(po => po.po_status === 'draft' || po.po_status === 'cancelled');
    }
    
    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--text-muted);padding:20px;">No purchase orders found matching this filter.</td></tr>`;
        return;
    }
    
    tbody.innerHTML = filtered.map((po, idx) => _poRowHtml(po, idx)).join('');
}

function _fmtDate(d) {
    if (!d) return '—';
    try {
        return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch { return d; }
}

function _delayBadge(delayDays, originalEtd, currentEtd) {
    // If no update yet, no delay
    if (!originalEtd || originalEtd === currentEtd || delayDays === 0) {
        return '<span style="color:var(--text-muted);font-size:12px;">—</span>';
    }
    if (delayDays > 0) {
        return `<span style="background:#fff3e0;color:#e65100;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">
            <span class="material-icons-outlined" style="font-size:12px;vertical-align:middle;">schedule</span>
            +${delayDays}d late
        </span>`;
    }
    return `<span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">
        <span class="material-icons-outlined" style="font-size:12px;vertical-align:middle;">check_circle</span>
        ${Math.abs(delayDays)}d early
    </span>`;
}

function _poRowHtml(po, idx) {
    const supplierCell = po.supplier_id
        ? `<a href="/supplier/detail/${po.supplier_id}" style="color:#1976d2;font-weight:600;" onclick="event.stopPropagation()">${po.supplier_brand || po.supplier_name}</a><br><span style="font-size:11px;color:var(--text-muted);">${po.supplier_code}</span>`
        : (po.supplier_name || '—');

    const statusBg = po.po_status === 'sent_to_supplier' ? '#e3f2fd'
        : po.po_status === 'acknowledged' ? '#e8f5e9' : '#f5f5f5';
    const statusColor = po.po_status === 'sent_to_supplier' ? '#1565c0'
        : po.po_status === 'acknowledged' ? '#2e7d32' : '#555';

    const lines = po.lines || [];
    const originalEtd = po.original_promised_date || po.promised_date || '';
    const currentEtd  = po.promised_date || '';
    const delayDays   = po.delay_days || 0;

    // Current ETD cell — highlight if changed
    const etdChanged = originalEtd && currentEtd && originalEtd !== currentEtd;
    const currentEtdCell = etdChanged
        ? `<span style="font-weight:600;color:#e65100;">${_fmtDate(currentEtd)}</span>`
        : `<span>${_fmtDate(currentEtd)}</span>`;

    // Lines expand
    let linesHtml = '';
    if (lines.length > 0) {
        const lineRows = lines.map(l => {
            const validAml = (l.aml || []).filter(m => m.mpn && m.mpn.trim() && m.make && m.make.trim());
            const amlCell = validAml.length > 0
                ? validAml.map(m => `<span style="display:inline-block;background:#e3f2fd;color:#1565c0;border-radius:3px;padding:1px 6px;font-size:10px;margin-right:3px;font-weight:600;">MPN: ${m.mpn} &nbsp;|&nbsp; Make: ${m.make}</span>`).join('')
                : '<span style="color:var(--text-muted);font-size:11px;font-style:italic;">—</span>';
            return `<tr style="background:var(--bg-main);">
                <td style="padding:6px 12px;font-size:12px;"><code>${l.item_code || '—'}</code></td>
                <td style="padding:6px 12px;font-size:12px;color:var(--text-secondary);">${l.item_description || '—'}</td>
                <td style="padding:6px 12px;font-size:12px;text-align:right;font-weight:600;">${(l.order_qty || 0).toLocaleString()} ${l.uom || ''}</td>
                <td style="padding:6px 12px;font-size:12px;text-align:right;">₹${(l.unit_price || 0).toLocaleString()}</td>
                <td style="padding:6px 12px;font-size:12px;text-align:right;font-weight:600;">₹${(l.total_amount || 0).toLocaleString()}</td>
                <td style="padding:6px 12px;">${amlCell}</td>
            </tr>`;
        }).join('');

        linesHtml = `<tr id="po-lines-${idx}" style="display:none;">
            <td colspan="11" style="padding:0;border-top:2px solid var(--border-color);">
                <table style="width:100%;border-collapse:collapse;">
                    <thead><tr style="background:var(--bg-secondary);">
                        <th style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-align:left;">Item Code</th>
                        <th style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-align:left;">Description</th>
                        <th style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-align:right;">Qty</th>
                        <th style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-align:right;">Unit Price</th>
                        <th style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-align:right;">Total</th>
                        <th style="padding:6px 12px;font-size:11px;font-weight:600;color:var(--text-muted);text-align:left;">MPN / Make</th>
                    </tr></thead>
                    <tbody>${lineRows}</tbody>
                </table>
            </td>
        </tr>`;
    }

    const expandBtn = lines.length > 0
        ? `<span class="material-icons-outlined" id="po-chevron-${idx}" style="font-size:16px;color:var(--text-muted);cursor:pointer;vertical-align:middle;transition:transform .2s;" onclick="togglePoLines(${idx})">expand_more</span>`
        : '';

    return `<tr style="cursor:${lines.length > 0 ? 'pointer' : 'default'};" onclick="${lines.length > 0 ? `togglePoLines(${idx})` : ''}">
        <td><strong>${po.po_no}</strong> ${expandBtn}</td>
        <td>${po.pr_no || '—'}</td>
        <td>${supplierCell}</td>
        <td>
            <code>${po.item_code || '—'}</code>
            ${lines.length > 1 ? `<span style="font-size:10px;color:var(--text-muted);margin-left:4px;">(+${lines.length - 1} more)</span>` : ''}
        </td>
        <td>${po.order_qty}</td>
        <td><strong>₹${po.total_amount.toLocaleString()}</strong></td>
        <td style="font-size:12px;color:var(--text-muted);">${_fmtDate(originalEtd)}</td>
        <td style="font-size:12px;">${currentEtdCell}</td>
        <td>${_delayBadge(delayDays, originalEtd, currentEtd)}</td>
        <td>
            <span style="background:${statusBg};color:${statusColor};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">
                ${po.po_status || 'draft'}
            </span>
        </td>
        <td onclick="event.stopPropagation()">
            <button class="btn-outline" style="font-size:12px;padding:4px 10px;" onclick="openUpdateEtdModal('${po.id}','${po.po_no}','${originalEtd}','${currentEtd}')">
                <span class="material-icons-outlined" style="font-size:13px;">edit_calendar</span> ETD
            </button>
            ${po.po_status === 'draft' ? `
            <button class="btn-primary" style="font-size:12px;padding:4px 10px;" onclick="sendPoToSupplier('${po.id}','${po.po_no}')">
                <span class="material-icons-outlined" style="font-size:13px;">send</span> Send
            </button>` : ''}
            <button class="btn-outline" style="font-size:12px;padding:4px 10px;" onclick="openAddInvoiceModal('${po.id}','${po.po_no}','${po.supplier_brand||po.supplier_name||''}')">
                <span class="material-icons-outlined" style="font-size:13px;">receipt</span> Invoice
            </button>
        </td>
    </tr>${linesHtml}`;
}

function togglePoLines(idx) {
    const row = document.getElementById(`po-lines-${idx}`);
    const chevron = document.getElementById(`po-chevron-${idx}`);
    if (!row) return;
    const open = row.style.display === 'none';
    row.style.display = open ? '' : 'none';
    if (chevron) chevron.style.transform = open ? 'rotate(180deg)' : '';
}

// ── UPDATE ETD MODAL ──
function openUpdateEtdModal(poId, poNo, originalEtd, currentEtd) {
    _etdPoId = poId;
    _etdOriginal = originalEtd || currentEtd;
    document.getElementById('etdPoNo').textContent = poNo;
    document.getElementById('etdOriginal').textContent = _fmtDate(_etdOriginal) + (_etdOriginal ? ` (${_etdOriginal})` : '—');
    document.getElementById('etdNewDate').value = currentEtd || '';
    document.getElementById('etdDelayPreview').style.display = 'none';
    calcEtdDelay();
    document.getElementById('updateEtdModal').classList.add('active');
}

function calcEtdDelay() {
    const newVal = document.getElementById('etdNewDate').value;
    const preview = document.getElementById('etdDelayPreview');
    if (!newVal || !_etdOriginal) { preview.style.display = 'none'; return; }
    try {
        const orig = new Date(_etdOriginal);
        const newD = new Date(newVal);
        const days = Math.round((newD - orig) / 86400000);
        if (days === 0) {
            preview.style.cssText = 'display:block;background:#e8f5e9;color:#2e7d32;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px;';
            preview.innerHTML = '<span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">check_circle</span> Same as original ETD — no delay.';
        } else if (days > 0) {
            preview.style.cssText = 'display:block;background:#fff3e0;color:#e65100;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px;';
            preview.innerHTML = `<span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">schedule</span>
                <strong>${days} day${days > 1 ? 's' : ''} late</strong> from original ETD (${_fmtDate(_etdOriginal)} → ${_fmtDate(newVal)})`;
        } else {
            preview.style.cssText = 'display:block;background:#e8f5e9;color:#2e7d32;border-radius:6px;padding:10px 14px;font-size:13px;margin-bottom:16px;';
            preview.innerHTML = `<span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">check_circle</span>
                <strong>${Math.abs(days)} day${Math.abs(days) > 1 ? 's' : ''} earlier</strong> than original ETD`;
        }
    } catch { preview.style.display = 'none'; }
}

async function saveEtd() {
    const newDate = document.getElementById('etdNewDate').value;
    if (!newDate) { showToast('Please select a date', 'error'); return; }
    try {
        const res = await fetch(`${API}/po-list/${_etdPoId}/etd`, {
            method: 'PUT', headers: HEADERS,
            body: JSON.stringify({ promised_date: newDate })
        });
        const json = await res.json();
        if (!json.success) { showToast(json.message || 'Failed', 'error'); return; }
        showToast(json.message);
        closeModal('updateEtdModal');
        loadPurchaseOrders();
    } catch (e) {
        showToast('Error saving ETD', 'error');
    }
}

async function sendPoToSupplier(poId, poNo) {
    if (!confirm(`Send PO "${poNo}" to supplier?`)) return;
    try {
        const res = await fetch(`${API}/po-list/${poId}/send-to-supplier`, { method: 'POST', headers: HEADERS });
        const json = await res.json();
        if (json.success) { showToast(json.message); loadPurchaseOrders(); }
        else showToast(json.message || 'Failed', 'error');
    } catch (e) {
        showToast('Error sending PO', 'error');
    }
}
