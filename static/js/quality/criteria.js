// IQC INSPECTION CRITERIA MASTER JS
async function loadCriteria() {
    const tbody = document.getElementById('criteriaBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/criteria', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(c => `
                <tr>
                    <td><span class="badge badge-info">${c.part_or_rm_code}</span></td>
                    <td><strong>${c.criterion_name}</strong></td>
                    <td>${c.spec_target || '-'}</td>
                    <td>${c.tolerance_min || '-'} to ${c.tolerance_max || '-'}</td>
                    <td>${c.inspection_method || 'Vernier Caliper'}</td>
                    <td><span class="badge ${c.is_mandatory ? 'badge-danger' : 'badge-info'}">${c.is_mandatory ? 'Mandatory' : 'Optional'}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No inspection criteria defined.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading inspection criteria.</td></tr>';
    }
}

function openNewCriterionModal() {
    openModal('Add IQC Inspection Criterion Master', `
        <div class="form-group">
            <label>Part / Raw Material Code *</label>
            <input type="text" id="crCode" value="RM-STEEL-316L" placeholder="e.g. RM-STEEL-316L or 601-0-000001">
        </div>
        <div class="form-group">
            <label>Criterion Name *</label>
            <input type="text" id="crName" placeholder="e.g. Outer Diameter (OD) or Hardness Test">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Target Spec</label>
                <input type="text" id="crTarget" value="50.0 mm">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Min Tolerance</label>
                <input type="text" id="crMin" value="49.95 mm">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Max Tolerance</label>
                <input type="text" id="crMax" value="50.05 mm">
            </div>
        </div>
        <div class="form-group">
            <label>Inspection Method / Gauge</label>
            <input type="text" id="crMethod" value="Digital Vernier Caliper">
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCriterion()">Save Criterion</button>
        </div>
    `);
}

async function submitCriterion() {
    const payload = {
        part_or_rm_code: document.getElementById('crCode').value,
        criterion_name: document.getElementById('crName').value,
        spec_target: document.getElementById('crTarget').value,
        tolerance_min: document.getElementById('crMin').value,
        tolerance_max: document.getElementById('crMax').value,
        inspection_method: document.getElementById('crMethod').value
    };

    try {
        const res = await fetch(API + '/criteria', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            alert(json.message);
            closeModal();
            loadCriteria();
        } else { alert(json.message); }
    } catch (e) { alert('Error saving criterion'); }
}
