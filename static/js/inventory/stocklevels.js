// STOCK LEVELS JS
async function loadStockLevels() {
    const search = document.getElementById('stockSearchInput')?.value || '';
    const tbody = document.getElementById('stockLevelsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/stock-levels?search=' + encodeURIComponent(search), { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(item => {
                const pnum = (item.part_number || '').toString();
                const desc = (item.part_description || '').toString();
                const itype = (item.item_type || 'PART').toString();
                const wh = (item.warehouse_code || 'MAIN').toString();
                const bin = (item.bin_code || '-').toString();
                const qoh = item.qty_on_hand !== undefined && item.qty_on_hand !== null ? item.qty_on_hand : 0;
                const qres = item.qty_reserved !== undefined && item.qty_reserved !== null ? item.qty_reserved : 0;
                const qavail = item.qty_available !== undefined && item.qty_available !== null ? item.qty_available : 0;
                const unit = (item.unit || 'pcs').toString();
                const cost = item.unit_cost !== undefined && item.unit_cost !== null ? item.unit_cost : 0;
                const val = item.total_value !== undefined && item.total_value !== null ? item.total_value : (qoh * cost);
                const rp = item.reorder_point || 0;

                return `
                    <tr style="cursor:pointer;" onclick="window.location.href='/inventory/stock-level/${item.id}'">
                        <td><strong>${pnum}</strong><div style="font-size:11px; color:var(--text-muted);">${desc}</div></td>
                        <td><span class="badge badge-info">${itype}</span></td>
                        <td>${wh} / <strong>${bin}</strong></td>
                        <td>${qoh} ${unit}</td>
                        <td>${qres}</td>
                        <td><strong style="color:${qavail <= rp ? '#c62828' : 'var(--text-primary)'}">${qavail}</strong></td>
                        <td>₹${cost}</td>
                        <td><strong>₹${Number(val).toLocaleString()}</strong></td>
                        <td onclick="event.stopPropagation()">
                            <button class="btn-action" title="View Stock Detail & Location Hierarchy" onclick="window.location.href='/inventory/stock-level/${item.id}'"><span class="material-icons-outlined">visibility</span></button>
                            <button class="btn-action" title="Transfer" onclick="quickTransfer('${pnum}', '${wh}', '${bin}')"><span class="material-icons-outlined">move_up</span></button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No stock levels found.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Error loading stock levels.</td></tr>';
    }
}

function openNewStockModal() {
    openModal('Add New Stock Record', `
        <div class="form-group">
            <label>Part Number</label>
            <input type="text" id="newPartNo" placeholder="e.g. 601-0-000001">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="newPartDesc" placeholder="Part description">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Warehouse Code</label>
                <input type="text" id="newWh" value="MAIN">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Bin Code</label>
                <input type="text" id="newBin" value="A-01-01">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Quantity On Hand</label>
                <input type="number" id="newQty" value="100">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Unit Cost (₹)</label>
                <input type="number" id="newCost" value="50">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewStock()">Save Stock</button>
        </div>
    `);
}

async function submitNewStock() {
    const payload = {
        part_number: document.getElementById('newPartNo').value,
        part_description: document.getElementById('newPartDesc').value,
        warehouse_code: document.getElementById('newWh').value,
        bin_code: document.getElementById('newBin').value,
        qty_on_hand: parseFloat(document.getElementById('newQty').value || 0),
        unit_cost: parseFloat(document.getElementById('newCost').value || 0)
    };

    try {
        const res = await fetch(API + '/stock-levels', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Stock record created');
            closeModal();
            loadStockLevels();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating stock record', 'error'); }
}

function quickTransfer(partNo, wh, bin) {
    showSection('transfers');
    document.getElementById('trfPartNumber').value = partNo;
    document.getElementById('trfFromWh').value = wh;
    document.getElementById('trfFromBin').value = bin;
}
