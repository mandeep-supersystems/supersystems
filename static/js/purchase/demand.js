// DEMAND & STOCK RESERVATION CALCULATOR JS
async function loadCustomerDemands() {
    const tbody = document.getElementById('demandsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/customer-demands', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(d => `
                <tr style="cursor:pointer;" onclick="window.location.href='/purchase/demand/${d.id}'">
                    <td><strong>${d.demand_no}</strong></td>
                    <td>${d.customer_name}</td>
                    <td><span class="badge badge-info">${d.part_or_rm_code}</span><div style="font-size:11px; color:var(--text-muted);">${d.item_description}</div></td>
                    <td><span class="badge badge-warning" style="background:#e8f5e9; color:#2e7d32; border:1px solid #a5d6a7;">${d.rm_code || 'RM-STEEL-316L'}</span><div style="font-size:11px; color:var(--text-muted);">${d.rm_description || 'Forged Alloy Steel Bar 316L'}</div></td>
                    <td><strong>${d.ordered_qty}</strong></td>
                    <td>${d.available_stock}</td>
                    <td>
                        <span class="badge ${d.occupy_option === 'occupy' ? 'badge-success' : 'badge-warning'}">
                            ${d.occupy_option === 'occupy' ? 'Occupied' : 'Do Not Occupy'}
                        </span>
                    </td>
                    <td><strong>${d.occupied_qty}</strong></td>
                    <td>${d.remaining_stock}</td>
                    <td><strong style="color:${d.qty_to_buy > 0 ? '#c62828' : 'var(--text-primary)'}">${d.qty_to_buy}</strong></td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="View Demand Detail" onclick="window.location.href='/purchase/demand/${d.id}'"><span class="material-icons-outlined">visibility</span></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;">No customer demands logged.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="11" style="text-align:center; color:red;">Error loading customer demands.</td></tr>';
    }
}

function openNewDemandModal() {
    openModal('Log Customer Order Demand & Map Raw Material (RM)', `
        <div class="form-group">
            <label>Customer Name *</label>
            <input type="text" id="cdCustomer" placeholder="e.g. Bosch Motor Works">
        </div>
        <div class="form-group">
            <label>Ordered Part Code * (Customer Orders Finished Parts Only)</label>
            <input type="text" id="cdCode" placeholder="e.g. 601-0-000001-99 or 601-0-000001">
            <span style="font-size:11px; color:var(--text-muted);">System automatically maps the required Raw Material (RM) from BOM</span>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Ordered Quantity by Customer *</label>
                <input type="number" id="cdOrderedQty" value="10" oninput="calculateDemandPreview()">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Stock Occupation Option</label>
                <select id="cdOccupyOption" onchange="calculateDemandPreview()">
                    <option value="do_not_occupy">Do Not Occupy (Keep stock untouched, queue full RM to buy)</option>
                    <option value="occupy">Occupy Stock (Reserve available stock, buy net RM shortage)</option>
                </select>
            </div>
        </div>
        <div class="form-group" id="grpOccupiedQty" style="display:none;">
            <label>Quantity to Occupy / Reserve from Stock</label>
            <input type="number" id="cdOccupiedQty" value="8" oninput="calculateDemandPreview()">
        </div>
        <div style="background:var(--hover-bg); padding:12px; border-radius:6px; margin-bottom:12px; font-size:13px;" id="cdPreviewBox">
            Select options to calculate stock reservation & net RM buy quantity.
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCustomerDemand()">Save & Calculate RM Shortage</button>
        </div>
    `);
}

function calculateDemandPreview() {
    const opt = document.getElementById('cdOccupyOption')?.value;
    const grp = document.getElementById('grpOccupiedQty');
    if (grp) grp.style.display = opt === 'occupy' ? 'block' : 'none';

    const ordQty = parseFloat(document.getElementById('cdOrderedQty')?.value || 0);
    const occQty = opt === 'occupy' ? parseFloat(document.getElementById('cdOccupiedQty')?.value || 0) : 0;
    const toBuy = Math.max(0, ordQty - occQty);

    const box = document.getElementById('cdPreviewBox');
    if (box) {
        box.innerHTML = `
            <strong>Order Part Qty:</strong> ${ordQty} units | 
            <strong>Occupied Stock:</strong> ${occQty} units | 
            <strong>Net RM Shortage to Buy:</strong> <span style="color:#c62828; font-weight:bold;">${toBuy} units RM</span>
        `;
    }
}

async function submitCustomerDemand() {
    const payload = {
        customer_name: document.getElementById('cdCustomer').value,
        part_or_rm_code: document.getElementById('cdCode').value,
        ordered_qty: parseFloat(document.getElementById('cdOrderedQty').value || 0),
        occupy_option: document.getElementById('cdOccupyOption').value,
        occupied_qty: parseFloat(document.getElementById('cdOccupiedQty').value || 0)
    };

    try {
        const res = await fetch(API + '/customer-demands', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadCustomerDemands();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error saving demand', 'error'); }
}
