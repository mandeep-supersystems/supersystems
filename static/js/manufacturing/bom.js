// BOM JS
async function loadBoms() {
    const tbody = document.getElementById('bomsBody');
    try {
        const res = await fetch(API + '/boms', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(b => `
                <tr>
                    <td><strong>${b.bom_no}</strong></td>
                    <td><span class="badge badge-info">${b.fg_part_number}</span></td>
                    <td>v${b.version}</td>
                    <td>${b.yield_qty} ${b.unit}</td>
                    <td>${b.components ? b.components.length : 0} items</td>
                    <td><span class="badge badge-success">${b.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No BOMs defined.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading BOMs.</td></tr>';
    }
}

function openNewBomModal() {
    openModal('Create Bill of Materials (BOM)', `
        <div class="form-group">
            <label>FG Part Number (Auto-appends -99 suffix)</label>
            <input type="text" id="bomFgPart" placeholder="601-0-000001">
        </div>
        <div class="form-group">
            <label>FG Description</label>
            <input type="text" id="bomFgDesc" placeholder="Engine Assembly Base">
        </div>
        <div class="form-group">
            <label>Yield Qty</label>
            <input type="number" id="bomYield" value="1">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewBom()">Save BOM</button>
        </div>
    `);
}

async function submitNewBom() {
    let fgPart = document.getElementById('bomFgPart').value;
    if (!fgPart.endsWith('-99')) fgPart += '-99';
    const payload = {
        fg_part_number: fgPart,
        fg_description: document.getElementById('bomFgDesc').value,
        yield_qty: parseFloat(document.getElementById('bomYield').value || 1)
    };
    try {
        const res = await fetch(API + '/boms', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadBoms(); }
        else showToast(json.message, 'error');
    } catch (e) { showToast('Error creating BOM', 'error'); }
}
