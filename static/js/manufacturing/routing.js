// ROUTING JS (-01 to -80 process steps)
async function loadRoutings() {
    const tbody = document.getElementById('routingsBody');
    try {
        const res = await fetch(API + '/routings', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(r => `
                <tr>
                    <td><strong>${r.routing_no}</strong></td>
                    <td>${r.part_number}</td>
                    <td>v${r.version}</td>
                    <td>
                        ${r.steps ? r.steps.map(s => `<span class="badge badge-info" style="margin-right:4px;">${s.operation_code}: ${s.operation_name}</span>`).join('') : 'No steps'}
                    </td>
                    <td><span class="badge badge-success">${r.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No process routings defined.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Error loading routings.</td></tr>';
    }
}

function openNewRoutingModal() {
    openModal('Create Process Routing (-01 to -80)', `
        <div class="form-group">
            <label>Base Part Number</label>
            <input type="text" id="rtgPartNo" placeholder="601-0-000001">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="rtgDesc" placeholder="Engine Housing Process Sequence">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewRouting()">Generate Operation Steps (-01, -02)</button>
        </div>
    `);
}

async function submitNewRouting() {
    const payload = {
        part_number: document.getElementById('rtgPartNo').value,
        part_description: document.getElementById('rtgDesc').value
    };

    try {
        const res = await fetch(API + '/routings', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadRoutings();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating routing', 'error'); }
}
