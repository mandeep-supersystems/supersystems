// REQUISITION ORDERS JS
async function loadRequisitions() {
    const tbody = document.getElementById('requisitionsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/requisitions', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(r => `
                <tr style="cursor:pointer;" onclick="window.location.href='/purchase/requisition/${r.id}'">
                    <td><strong>${r.req_no}</strong></td>
                    <td><span class="badge badge-info">${r.part_or_rm_code}</span></td>
                    <td>${r.supplier_name}</td>
                    <td><strong>${r.required_qty}</strong> units <div style="font-size:11px; color:var(--text-muted);">MOQ: ${r.moq} | SQP: ${r.sqp}</div></td>
                    <td>₹${r.unit_price}</td>
                    <td><strong>₹${r.total_amount.toLocaleString()}</strong></td>
                    <td>
                        <span class="badge ${r.status === 'converted_to_po' ? 'badge-success' : 'badge-warning'}">
                            ${r.status === 'converted_to_po' ? 'Converted to PO' : 'Pending PO'}
                        </span>
                    </td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="View Detail Page" onclick="window.location.href='/purchase/requisition/${r.id}'"><span class="material-icons-outlined">visibility</span></button>
                        ${r.status !== 'converted_to_po' ? `<button class="btn-primary" style="padding:3px 8px; font-size:12px; margin-left:4px;" onclick="convertReqToPo('${r.id}', '${r.req_no}')"><span class="material-icons-outlined" style="font-size:14px;">shopping_bag</span>PO</button>` : ''}
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">No requisition orders created.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Error loading requisitions.</td></tr>';
    }
}

function openNewRequisitionModal() {
    openModal('Create Purchase Requisition Order (Req Order)', `
        <input type="hidden" id="reqDemandNo">
        <div class="form-group">
            <label>Part / RM Code</label>
            <input type="text" id="reqCode" placeholder="RM-STEEL-316L">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Supplier Code</label>
                <input type="text" id="reqScode" value="SUP-101">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Supplier Name</label>
                <input type="text" id="reqSname" value="Tata Steel Industrial Solutions">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Required Qty</label>
                <input type="number" id="reqQty" value="100">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Unit Price (₹)</label>
                <input type="number" id="reqPrice" value="180">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Min Order Qty (MOQ)</label>
                <input type="number" id="reqMoq" value="50">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Standard Pack Qty (SQP)</label>
                <input type="number" id="reqSqp" value="10">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitRequisition()">Create Req Order</button>
        </div>
    `);
}

async function submitRequisition() {
    const payload = {
        demand_no: document.getElementById('reqDemandNo').value,
        part_or_rm_code: document.getElementById('reqCode').value,
        supplier_code: document.getElementById('reqScode').value,
        supplier_name: document.getElementById('reqSname').value,
        required_qty: parseFloat(document.getElementById('reqQty').value || 0),
        unit_price: parseFloat(document.getElementById('reqPrice').value || 0),
        moq: parseFloat(document.getElementById('reqMoq').value || 1),
        sqp: parseFloat(document.getElementById('reqSqp').value || 1)
    };

    try {
        const res = await fetch(API + '/requisitions', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadRequisitions();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating requisition', 'error'); }
}

async function convertReqToPo(reqId, reqNo) {
    const leadDays = prompt(`Enter initial lead time in days for ${reqNo}:`, '7');
    if (!leadDays) return;

    try {
        const res = await fetch(API + `/requisitions/${reqId}/convert-po`, {
            method: 'POST', headers: HEADERS, body: JSON.stringify({ lead_time_days: parseInt(leadDays) })
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            loadRequisitions();
            showSection('orders');
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error converting to PO', 'error'); }
}
