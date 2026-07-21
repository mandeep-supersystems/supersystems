// ZONES JS
async function loadZones() {
    const tbody = document.getElementById('zonesBody');
    try {
        const res = await fetch(API + '/zones', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(z => `
                <tr>
                    <td><strong>${z.zone_code}</strong></td>
                    <td>${z.name}</td>
                    <td><span class="badge badge-info">${z.zone_type}</span></td>
                    <td>${z.warehouse_code}</td>
                    <td>${z.capacity_units} units</td>
                    <td><span class="badge badge-success">${z.is_active ? 'Active' : 'Inactive'}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No zones found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading zones.</td></tr>';
    }
}

function openNewZoneModal() {
    openModal('Create New Warehouse Zone', `
        <div class="form-group">
            <label>Zone Code</label>
            <input type="text" id="zoneCode" placeholder="e.g. Z-RM-01">
        </div>
        <div class="form-group">
            <label>Zone Name</label>
            <input type="text" id="zoneName" placeholder="Raw Material Staging">
        </div>
        <div class="form-group">
            <label>Zone Type</label>
            <select id="zoneType">
                <option value="RM">Raw Material (RM)</option>
                <option value="WIP">Work in Progress (WIP)</option>
                <option value="FG">Finished Goods (FG)</option>
                <option value="QC">Quarantine (QC)</option>
                <option value="STAGING">Staging Area</option>
            </select>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewZone()">Save Zone</button>
        </div>
    `);
}

async function submitNewZone() {
    const payload = {
        zone_code: document.getElementById('zoneCode').value,
        name: document.getElementById('zoneName').value,
        zone_type: document.getElementById('zoneType').value
    };

    try {
        const res = await fetch(API + '/zones', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Zone created');
            closeModal();
            loadZones();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating zone', 'error'); }
}
