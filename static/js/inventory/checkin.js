// STOCK CHECK-IN & IQC CONTROL JS
async function loadCheckins() {
    const tbody = document.getElementById('checkinBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/checkins', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(c => `
                <tr style="cursor:pointer;" onclick="window.location.href='/inventory/checkin/${c.id}'">
                    <td><strong>${c.checkin_no}</strong></td>
                    <td>${c.po_no}</td>
                    <td>${c.supplier_name}</td>
                    <td><span class="badge badge-info">${c.part_or_rm_code}</span></td>
                    <td><strong>${c.received_qty}</strong></td>
                    <td>${c.checked_in_by}</td>
                    <td>${c.checkin_time}</td>
                    <td>
                        <span class="badge ${c.iqc_status === 'passed' ? 'badge-success' : c.iqc_status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
                            ${c.iqc_status === 'passed' ? 'Approved by IQC (' + (c.iqc_elapsed_min || 15) + ' mins)' : c.iqc_status === 'rejected' ? 'Rejected by IQC' : 'Pending IQC Inspection'}
                        </span>
                    </td>
                    <td><strong style="color:#2e7d32;">${c.iqc_passed_qty}</strong></td>
                    <td><strong style="color:#c62828;">${c.iqc_rejected_qty}</strong></td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="View Check-In Detail & QR Code" onclick="window.location.href='/inventory/checkin/${c.id}'"><span class="material-icons-outlined">visibility</span></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No stock check-in records found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Error loading check-in records.</td></tr>';
    }
}

function openNewCheckinModal() {
    openModal('Verify Delivery & Check-In Stock (From PO)', `
        <div class="form-group">
            <label>PO Number *</label>
            <input type="text" id="chkPoNo" value="PO-PUR-20260721-01" placeholder="e.g. PO-PUR-20260721-01">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Supplier Code</label>
                <input type="text" id="chkScode" value="SUP-101">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Supplier Name</label>
                <input type="text" id="chkSname" value="Tata Steel Industrial Solutions">
            </div>
        </div>
        <div class="form-group">
            <label>Part / Raw Material Code *</label>
            <input type="text" id="chkCode" value="RM-STEEL-316L" placeholder="e.g. RM-STEEL-316L or 601-0-000001">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Ordered Qty</label>
                <input type="number" id="chkOrdQty" value="50">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Received Qty *</label>
                <input type="number" id="chkRecQty" value="50">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Warehouse</label>
                <input type="text" id="chkWh" value="MAIN">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Bin Location</label>
                <input type="text" id="chkBin" value="RM-A-01">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCheckin()">Verify & Check-In Stock</button>
        </div>
    `);
}

async function submitCheckin() {
    const payload = {
        po_no: document.getElementById('chkPoNo').value,
        supplier_code: document.getElementById('chkScode').value,
        supplier_name: document.getElementById('chkSname').value,
        part_or_rm_code: document.getElementById('chkCode').value,
        ordered_qty: parseFloat(document.getElementById('chkOrdQty').value || 0),
        received_qty: parseFloat(document.getElementById('chkRecQty').value || 0),
        warehouse_code: document.getElementById('chkWh').value,
        bin_code: document.getElementById('chkBin').value
    };

    try {
        const res = await fetch(API + '/checkins', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadCheckins();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating check-in record', 'error'); }
}
