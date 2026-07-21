// STOCK MOVEMENTS JS
async function loadStockMovements() {
    const tbody = document.getElementById('stockMovementsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/stock-movements', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(m => `
                <tr>
                    <td><strong>${m.movement_no}</strong></td>
                    <td><span class="badge ${m.movement_type === 'RECEIPT' ? 'badge-success' : 'badge-info'}">${m.movement_type}</span></td>
                    <td><strong>${m.part_number}</strong></td>
                    <td><strong>${m.qty} ${m.unit}</strong></td>
                    <td>${m.from_bin_code || '-'}</td>
                    <td>${m.to_bin_code || '-'}</td>
                    <td>${m.reference_no || '-'}</td>
                    <td>${m.performed_by}</td>
                    <td>${m.created_at || '-'}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No stock movements.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Error loading movements.</td></tr>';
    }
}

function openNewMovementModal() {
    openModal('Record Stock Movement', `
        <div class="form-group">
            <label>Movement Type</label>
            <select id="movType">
                <option value="RECEIPT">RECEIPT (PO / Inbound)</option>
                <option value="ISSUE">ISSUE (To Production)</option>
                <option value="TRANSFER">TRANSFER (Bin to Bin)</option>
                <option value="ADJUSTMENT">ADJUSTMENT</option>
                <option value="SCRAP">SCRAP / REJECT</option>
            </select>
        </div>
        <div class="form-group">
            <label>Part Number</label>
            <input type="text" id="movPartNo" placeholder="e.g. 601-0-000001">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>From Bin</label>
                <input type="text" id="movFromBin" value="A-01-01">
            </div>
            <div class="form-group" style="flex:1;">
                <label>To Bin</label>
                <input type="text" id="movToBin" value="B-02-01">
            </div>
        </div>
        <div class="form-group">
            <label>Quantity</label>
            <input type="number" id="movQty" value="10">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewMovement()">Record</button>
        </div>
    `);
}

async function submitNewMovement() {
    const payload = {
        movement_type: document.getElementById('movType').value,
        part_number: document.getElementById('movPartNo').value,
        from_bin_code: document.getElementById('movFromBin').value,
        to_bin_code: document.getElementById('movToBin').value,
        qty: parseFloat(document.getElementById('movQty').value || 0)
    };

    try {
        const res = await fetch(API + '/stock-movements', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Movement recorded');
            closeModal();
            loadStockMovements();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error recording movement', 'error'); }
}
