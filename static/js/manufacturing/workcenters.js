// WORK CENTERS & MHR JS
async function loadWorkCenters() {
    const tbody = document.getElementById('workCentersBody');
    try {
        const res = await fetch(API + '/work-centers', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(w => `
                <tr>
                    <td><strong>${w.code}</strong></td>
                    <td>${w.name}</td>
                    <td>${w.capacity_hours_per_day} hrs/day</td>
                    <td>${w.efficiency_pct}%</td>
                    <td>₹${w.cost_rate_per_hour}/hr</td>
                    <td><span class="mhr-badge">₹${w.mhr_rate}/hr MHR</span></td>
                    <td><span class="badge badge-success">${w.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;">No work centers defined.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading work centers.</td></tr>';
    }
}

function openNewWorkCenterModal() {
    openModal('Create Work Center (Calculates Machine Hour Rate MHR)', `
        <div class="form-group">
            <label>Work Center Code</label>
            <input type="text" id="wcCode" placeholder="WC-CNC-01">
        </div>
        <div class="form-group">
            <label>Work Center Name</label>
            <input type="text" id="wcName" placeholder="Vertical Machining Center">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Capacity (hrs/day)</label>
                <input type="number" id="wcCap" value="8">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Efficiency %</label>
                <input type="number" id="wcEff" value="90">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Base Cost/Hr (₹)</label>
                <input type="number" id="wcCost" value="100">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewWorkCenter()">Calculate MHR & Save</button>
        </div>
    `);
}

async function submitNewWorkCenter() {
    const payload = {
        code: document.getElementById('wcCode').value,
        name: document.getElementById('wcName').value,
        capacity_hours_per_day: parseFloat(document.getElementById('wcCap').value || 8),
        efficiency_pct: parseFloat(document.getElementById('wcEff').value || 100),
        cost_rate_per_hour: parseFloat(document.getElementById('wcCost').value || 50)
    };

    try {
        const res = await fetch(API + '/work-centers', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadWorkCenters();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating work center', 'error'); }
}
