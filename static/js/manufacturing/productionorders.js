// PRODUCTION ORDERS JS
async function loadProductionOrders() {
    const tbody = document.getElementById('ordersBody');
    try {
        const res = await fetch(API + '/production-orders', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(o => `
                <tr>
                    <td><strong>${o.order_no}</strong></td>
                    <td><span class="badge badge-info">${o.fg_part_number}</span></td>
                    <td><strong>${o.planned_qty}</strong></td>
                    <td>${o.produced_qty}</td>
                    <td><strong style="color:${o.rejected_qty > 0 ? '#c62828' : 'var(--text-primary)'}">${o.rejected_qty}</strong></td>
                    <td><span class="badge ${o.status === 'completed' ? 'badge-success' : 'badge-warning'}">${o.status}</span></td>
                    <td>
                        <button class="btn-action" title="Log Shop Floor" onclick="quickLogShopFloor('${o.order_no}', '${o.fg_part_number.replace('-99','')}')"><span class="material-icons-outlined">precision_manufacturing</span></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No production orders created.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading orders.</td></tr>';
    }
}

function openNewProductionOrderModal() {
    openModal('Create Production Order', `
        <div class="form-group">
            <label>Finished Good Part Number (-99 Suffix)</label>
            <input type="text" id="poFgPart" value="601-0-000001-99">
        </div>
        <div class="form-group">
            <label>Planned Qty to Produce</label>
            <input type="number" id="poPlannedQty" value="50">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewProductionOrder()">Release Production Order</button>
        </div>
    `);
}

async function submitNewProductionOrder() {
    const payload = {
        fg_part_number: document.getElementById('poFgPart').value,
        planned_qty: parseFloat(document.getElementById('poPlannedQty').value || 10)
    };

    try {
        const res = await fetch(API + '/production-orders', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadProductionOrders();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating order', 'error'); }
}

function quickLogShopFloor(orderNo, basePart) {
    showSection('shopfloor');
    document.getElementById('sfOrderNo').value = orderNo;
    document.getElementById('sfPartNo').value = basePart;
}
