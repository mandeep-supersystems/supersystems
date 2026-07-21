// SUPPLIER SELECTION & SOP / SQP RULES JS
async function loadSupplierRules() {
    const tbody = document.getElementById('supplierRulesBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/supplier-rules', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(s => `
                <tr style="cursor:pointer;" onclick="window.location.href='/purchase/supplier/${s.id}'">
                    <td><strong>${s.part_or_rm_code}</strong></td>
                    <td>${s.supplier_name} <div style="font-size:11px; color:var(--text-muted);">${s.supplier_code}</div></td>
                    <td><strong>₹${s.unit_price} / unit</strong></td>
                    <td><span class="lt-badge">${s.lead_time_days} Days Lead Time</span></td>
                    <td>${s.min_order_qty} units (MOQ)</td>
                    <td>${s.sqp_pack} units (SQP Pack)</td>
                    <td onclick="event.stopPropagation()">
                        <button class="btn-action" title="View Detail Page" onclick="window.location.href='/purchase/supplier/${s.id}'"><span class="material-icons-outlined">visibility</span></button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No supplier SOP/SQP rules defined.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading supplier rules.</td></tr>';
    }
}

function openNewSupplierRuleModal() {
    openModal('Add Supplier Rule (SOP Price, Lead Time, MOQ, SQP)', `
        <div class="form-group">
            <label>Part / RM Code</label>
            <input type="text" id="srCode" placeholder="RM-STEEL-316L or 601-0-000001">
        </div>
        <div class="form-group">
            <label>Supplier Name</label>
            <input type="text" id="srSname" placeholder="Tata Steel Industrial Solutions">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Unit Price / SOP (₹)</label>
                <input type="number" id="srPrice" value="180">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Lead Time (Days)</label>
                <input type="number" id="srLead" value="7">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Min Order Qty (MOQ)</label>
                <input type="number" id="srMoq" value="50">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Standard Pack Qty (SQP)</label>
                <input type="number" id="srSqp" value="10">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitSupplierRule()">Save Supplier Rule</button>
        </div>
    `);
}

async function submitSupplierRule() {
    const payload = {
        part_or_rm_code: document.getElementById('srCode').value,
        supplier_name: document.getElementById('srSname').value,
        unit_price: parseFloat(document.getElementById('srPrice').value || 0),
        lead_time_days: parseInt(document.getElementById('srLead').value || 7),
        min_order_qty: parseFloat(document.getElementById('srMoq').value || 1),
        sqp_pack: parseFloat(document.getElementById('srSqp').value || 1)
    };

    try {
        const res = await fetch(API + '/supplier-rules', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadSupplierRules();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error saving supplier rule', 'error'); }
}
