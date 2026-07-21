// PICK LISTS JS
async function loadPickLists() {
    const tbody = document.getElementById('pickListsBody');
    try {
        const res = await fetch(API + '/pick-lists', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(p => `
                <tr>
                    <td><strong>${p.list_no}</strong></td>
                    <td>${p.reference_no}</td>
                    <td>${p.assigned_to}</td>
                    <td>${p.due_date || '-'}</td>
                    <td><span class="badge ${p.status === 'completed' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                    <td><button class="btn-action" title="View Pick Items"><span class="material-icons-outlined">visibility</span></button></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No pick lists found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading pick lists.</td></tr>';
    }
}

function openNewPickListModal() {
    openModal('Create Pick List', `
        <div class="form-group">
            <label>Reference Order / PO</label>
            <input type="text" id="pickRefNo" placeholder="ORD-2026-001">
        </div>
        <div class="form-group">
            <label>Assigned Picker</label>
            <input type="text" id="pickAssigned" value="Picker 1">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewPickList()">Save Pick List</button>
        </div>
    `);
}

async function submitNewPickList() {
    const payload = {
        reference_no: document.getElementById('pickRefNo').value,
        assigned_to: document.getElementById('pickAssigned').value
    };
    try {
        const res = await fetch(API + '/pick-lists', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) { showToast(json.message); closeModal(); loadPickLists(); }
        else showToast(json.message, 'error');
    } catch (e) { showToast('Error creating pick list', 'error'); }
}
