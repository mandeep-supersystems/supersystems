// INCOMING QUALITY CONTROL (IQC) JS
function _iqcPlacement(g) {
    const parts = [];
    if (g.warehouse_code) parts.push(`Wh: ${g.warehouse_code}`);
    if (g.location_code)  parts.push(`Loc: ${g.location_code}`);
    return parts.length ? parts.join(' • ') : 'Not assigned';
}

function _iqcBadge(status) {
    const s = (status || '').toLowerCase();
    if (s === 'iqc_passed')   return ['badge-success', 'IQC Passed'];
    if (s === 'iqc_rejected') return ['badge-danger',  'Rejected'];
    if (s === 'iqc_partial')  return ['badge-warning',  'Partial Pass'];
    return ['badge-info', 'Awaiting IQC'];
}

async function loadIqcInspections() {
    const tbody = document.getElementById('iqcBody');
    if (!tbody) return;
    try {
        const res  = await fetch(API + '/grn-pending-iqc', { headers: HEADERS });
        const json = await res.json();
        if (!json.success || !json.data || !json.data.length) {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No GRNs awaiting IQC.</td></tr>';
            return;
        }
        tbody.innerHTML = json.data.map(g => {
            const [cls, label] = _iqcBadge(g.grn_status);
            const done = g.grn_status.startsWith('iqc_');
            const okQty = g.ok_qty || 0;
            const ngQty = g.ng_qty || 0;
            return `
            <tr style="cursor:pointer;" onclick="window.location.href='/quality/iqc/${g.id}'">
                <td><strong>${g.grn_no}</strong></td>
                <td>${g.po_no || '-'}</td>
                <td>${g.supplier_name || '-'}</td>
                <td><span class="badge badge-info">${g.item_code}</span></td>
                <td><span style="font-size:12px;color:var(--text-muted);">${_iqcPlacement(g)}</span></td>
                <td><strong>${g.received_qty}</strong></td>
                <td style="font-size:12px;">${(g.created_at || '').replace('T', ' ').slice(0, 19)}</td>
                <td><span class="badge ${cls}">${label}</span></td>
                <td><strong style="color:var(--accent);">${okQty || '-'}</strong></td>
                <td><strong style="color:var(--coming-soon-text);">${ngQty || '-'}</strong></td>
                <td onclick="event.stopPropagation()">
                    ${done
                        ? `<button class="btn-action" title="View IQC Result" onclick="viewIqcResult('${g.id}')"><span class="material-icons-outlined">visibility</span></button>`
                        : `<button class="btn-action" title="Perform IQC Inspection" onclick="openIqcInspectModal('${g.id}','${g.grn_no}','${g.item_code}',${g.received_qty})"><span class="material-icons-outlined">fact_check</span></button>`
                    }
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:red;">Error loading IQC records.</td></tr>';
    }
}

function openIqcInspectModal(id, grnNo, itemCode, recQty) {
    openModal(`IQC Inspection — ${grnNo}`, `
        <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted);">
            Item: <strong>${itemCode}</strong> &nbsp;|&nbsp; Received Qty: <strong>${recQty}</strong>
        </div>
        <div class="form-group">
            <label>Accepted Qty (OK)</label>
            <input type="number" id="iqcAccepted" min="0" max="${recQty}" value="${recQty}" style="width:100%;">
        </div>
        <div class="form-group">
            <label>Rejected Qty (NG)</label>
            <input type="number" id="iqcRejected" min="0" max="${recQty}" value="0" style="width:100%;">
        </div>
        <div class="form-group">
            <label>Failure Reason / Remarks</label>
            <textarea id="iqcReason" rows="3" style="width:100%;resize:vertical;"></textarea>
        </div>
        <div class="form-actions" style="margin-top:16px;">
            <button class="btn-secondary" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitIqcInspect('${id}',${recQty})">Submit IQC</button>
        </div>
    `);
}

async function submitIqcInspect(grnId, recQty) {
    const accepted = parseFloat(document.getElementById('iqcAccepted').value) || 0;
    const rejected = parseFloat(document.getElementById('iqcRejected').value) || 0;
    if (accepted + rejected > recQty) {
        showQToast('Accepted + Rejected cannot exceed received qty', 'error'); return;
    }
    try {
        const res = await fetch(`${API}/grn-iqc/${grnId}/inspect`, {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({
                accepted_qty: accepted, rejected_qty: rejected,
                failure_reason: document.getElementById('iqcReason').value.trim()
            })
        });
        const json = await res.json();
        if (json.success) {
            closeModal();
            showQToast(json.message || 'IQC submitted');
            loadIqcInspections();
        } else {
            showQToast(json.message || 'IQC failed', 'error');
        }
    } catch(e) { showQToast('Network error', 'error'); }
}

function viewIqcResult(grnId) {
    window.location.href = `/quality/iqc/${grnId}`;
}
