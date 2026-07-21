// BATCHES JS
async function loadBatches() {
    const tbody = document.getElementById('batchesBody');
    try {
        const res = await fetch(API + '/batches', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(b => `
                <tr>
                    <td><strong>${b.batch_no}</strong></td>
                    <td>${b.part_number}</td>
                    <td>${b.supplier_lot || '-'}</td>
                    <td>${b.manufacture_date || '-'}</td>
                    <td>${b.expiry_date || '-'}</td>
                    <td><strong>${b.qty_remaining}</strong></td>
                    <td><span class="badge badge-success">${b.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No batches found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading batches.</td></tr>';
    }
}

function openNewBatchModal() {
    openModal('Create New Batch / Lot', `
        <div class="form-group">
            <label>Part Number</label>
            <input type="text" id="batchPartNo" placeholder="e.g. 601-0-000001">
        </div>
        <div class="form-group">
            <label>Supplier Lot Ref</label>
            <input type="text" id="batchLot" placeholder="LOT-2026-X">
        </div>
        <div class="form-group">
            <label>Received Qty</label>
            <input type="number" id="batchQty" value="100">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewBatch()">Save Batch</button>
        </div>
    `);
}

async function submitNewBatch() {
    const payload = {
        part_number: document.getElementById('batchPartNo').value,
        supplier_lot: document.getElementById('batchLot').value,
        qty_received: parseFloat(document.getElementById('batchQty').value || 0)
    };

    try {
        const res = await fetch(API + '/batches', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadBatches();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating batch', 'error'); }
}
