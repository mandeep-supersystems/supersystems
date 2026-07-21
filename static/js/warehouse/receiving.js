// RECEIVING JS
async function loadReceipts() {
    const tbody = document.getElementById('receiptsBody');
    try {
        const res = await fetch(API + '/receipts', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(r => `
                <tr>
                    <td><strong>${r.receipt_no}</strong></td>
                    <td>${r.po_number}</td>
                    <td>${r.supplier_name}</td>
                    <td>${r.receipt_date}</td>
                    <td><span class="badge badge-success">${r.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No receipts recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading receipts.</td></tr>';
    }
}

function openNewReceiptModal() {
    openModal('Receive PO Shipment', `
        <div class="form-group">
            <label>PO Number</label>
            <input type="text" id="recPoNo" value="PO-2026-001">
        </div>
        <div class="form-group">
            <label>Supplier Name</label>
            <input type="text" id="recSupplier" value="Acme Components Ltd">
        </div>
        <div class="form-group">
            <label>Part Number Received</label>
            <input type="text" id="recPartNo" value="601-0-000001">
        </div>
        <div class="form-group">
            <label>Received Qty</label>
            <input type="number" id="recQty" value="100">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewReceipt()">Process Receipt & Putaway</button>
        </div>
    `);
}

async function submitNewReceipt() {
    const payload = {
        po_number: document.getElementById('recPoNo').value,
        supplier_name: document.getElementById('recSupplier').value,
        part_number: document.getElementById('recPartNo').value,
        qty_received: parseFloat(document.getElementById('recQty').value || 0)
    };
    try {
        const res = await fetch(API + '/receipts', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadReceipts(); }
        else showToast(json.message, 'error');
    } catch (e) { showToast('Error creating receipt', 'error'); }
}
