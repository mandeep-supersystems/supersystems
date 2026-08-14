// SUPPLIER LEAD TIMES JS
let _ltData = [];

async function loadLeadTimes() {
    const tbody = document.getElementById('leadTimesBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>';
    
    // Set default order date to today
    const orderInput = document.getElementById('ltOrderDateInput');
    if (orderInput && !orderInput.value) {
        orderInput.value = new Date().toISOString().split('T')[0];
    }

    try {
        const res = await fetch(API + '/lead-times', { headers: HEADERS });
        const json = await res.json();
        if (!json.success) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:red;">Error: ${json.message}</td></tr>`;
            return;
        }
        _ltData = json.data || [];
        renderLeadTimes();
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red;">Failed to load lead times.</td></tr>';
    }
}

function renderLeadTimes() {
    const tbody = document.getElementById('leadTimesBody');
    if (!tbody) return;
    if (!_ltData.length) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">No lead times configured. Add supplier rules from Buy Material flow.</td></tr>';
        return;
    }

    const checkDateVal = document.getElementById('ltCheckDate') ? document.getElementById('ltCheckDate').value : '';
    const checkDate = checkDateVal ? new Date(checkDateVal) : null;
    
    const orderDateVal = document.getElementById('ltOrderDateInput') ? document.getElementById('ltOrderDateInput').value : '';
    const today = orderDateVal ? new Date(orderDateVal) : new Date();
    today.setHours(0, 0, 0, 0);

    tbody.innerHTML = _ltData.map((lt, idx) => {
        const orderDate = today;
        const deliveryDate = new Date(orderDate);
        deliveryDate.setDate(deliveryDate.getDate() + lt.lead_time_days);

        const orderStr = orderDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const deliveryStr = deliveryDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

        let feasibilityHtml = '<span style="color:var(--text-muted);font-size:12px;">— set date to check</span>';
        if (checkDate) {
            checkDate.setHours(0, 0, 0, 0);
            const daysLeft = Math.round((checkDate - deliveryDate) / 86400000);
            if (deliveryDate <= checkDate) {
                feasibilityHtml = `<span style="color:#2e7d32;font-weight:600;font-size:12px;">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">check_circle</span>
                    OK &nbsp;<span style="font-weight:400;">(${daysLeft}d buffer)</span>
                </span>`;
            } else {
                const overBy = Math.abs(daysLeft);
                feasibilityHtml = `<span style="color:#c62828;font-weight:600;font-size:12px;">
                    <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">cancel</span>
                    Late by ${overBy}d
                </span>`;
            }
        }

        return `<tr>
            <td><code>${lt.item_code || '—'}</code></td>
            <td>
                <strong>${lt.supplier_name || '—'}</strong>
                ${lt.supplier_code ? `<br><span style="font-size:11px;color:var(--text-muted);">${lt.supplier_code}</span>` : ''}
            </td>
            <td>
                <span id="lt-days-display-${idx}" style="font-weight:600;">${lt.lead_time_days} days</span>
                <span id="lt-days-edit-${idx}" style="display:none;">
                    <input type="number" id="lt-days-input-${idx}" value="${lt.lead_time_days}" min="1" step="1"
                        style="width:70px;padding:3px 6px;border:1px solid var(--border-color);border-radius:4px;font-size:13px;">
                    <button onclick="saveLtDays('${lt.id}',${idx})" style="background:var(--primary);color:#fff;border:none;border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;margin-left:4px;">Save</button>
                    <button onclick="cancelLtEdit(${idx})" style="background:none;border:1px solid var(--border-color);border-radius:4px;padding:3px 8px;cursor:pointer;font-size:12px;margin-left:2px;">✕</button>
                </span>
            </td>
            <td style="font-size:12px;">${orderStr}</td>
            <td style="font-size:12px;font-weight:600;">${deliveryStr}</td>
            <td style="font-size:12px;">${checkDateVal || '—'}</td>
            <td>${feasibilityHtml}</td>
            <td>
                <button class="btn-action" onclick="editLtDays(${idx})" title="Edit lead time">
                    <span class="material-icons-outlined">edit</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function reCheckLeadTimes() {
    renderLeadTimes();
}

function editLtDays(idx) {
    document.getElementById(`lt-days-display-${idx}`).style.display = 'none';
    document.getElementById(`lt-days-edit-${idx}`).style.display = 'inline-flex';
    document.getElementById(`lt-days-input-${idx}`).focus();
}

function cancelLtEdit(idx) {
    document.getElementById(`lt-days-display-${idx}`).style.display = '';
    document.getElementById(`lt-days-edit-${idx}`).style.display = 'none';
}

async function saveLtDays(ltId, idx) {
    const days = parseInt(document.getElementById(`lt-days-input-${idx}`).value);
    if (!days || days < 1) { showToast('Lead time must be at least 1 day', 'error'); return; }
    try {
        const res = await fetch(`${API}/lead-times/${ltId}`, {
            method: 'PUT', headers: HEADERS,
            body: JSON.stringify({ lead_time_days: days })
        });
        const json = await res.json();
        if (!json.success) { showToast(json.message || 'Failed', 'error'); return; }
        _ltData[idx].lead_time_days = days;
        showToast('Lead time updated');
        renderLeadTimes();
    } catch (e) {
        showToast('Error saving', 'error');
    }
}

function openAddLeadTimeModal() {
    document.getElementById('ltModalTitle').textContent = 'Add Supplier Lead Time';
    document.getElementById('ltId').value = '';
    document.getElementById('ltItemCode').value = '';
    document.getElementById('ltSupplierName').value = '';
    document.getElementById('ltDays').value = '';
    document.getElementById('ltOrderDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('addLeadTimeModal').classList.add('active');
}

async function saveLeadTime(e) {
    e.preventDefault();
    const body = {
        part_or_rm_code: document.getElementById('ltItemCode').value.trim(),
        supplier_name: document.getElementById('ltSupplierName').value.trim(),
        supplier_code: '',
        unit_price: 0,
        lead_time_days: parseInt(document.getElementById('ltDays').value) || 7,
        min_order_qty: 1,
        sqp_pack: 1
    };
    try {
        const res = await fetch(`${API}/supplier-rules`, { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
        const json = await res.json();
        if (json.success) {
            document.getElementById('addLeadTimeModal').classList.remove('active');
            showToast('Lead time added');
            loadLeadTimes();
        } else {
            showToast(json.message || 'Failed', 'error');
        }
    } catch (e) {
        showToast('Error saving', 'error');
    }
}
