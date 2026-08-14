// IQC INSPECTION CRITERIA MASTER JS
async function loadCriteria() {
    const container = document.getElementById('criteriaContainer');
    if (!container) return;
    try {
        const res  = await fetch(API + '/criteria', { headers: HEADERS });
        const json = await res.json();
        if (!json.success || !json.data || !json.data.length) {
            container.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">No inspection criteria defined. Click <strong>Add Criterion</strong> to get started.</div>';
            return;
        }
        const grouped = {};
        json.data.forEach(c => {
            if (!grouped[c.part_or_rm_code]) grouped[c.part_or_rm_code] = [];
            grouped[c.part_or_rm_code].push(c);
        });
        container.innerHTML = Object.entries(grouped).map(([code, criteria]) => `
            <div class="criteria-card" style="background:var(--bg-primary);border:1px solid var(--border-color);border-radius:10px;margin-bottom:16px;overflow:hidden;">
                <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);">
                    <div style="display:flex;align-items:center;gap:10px;">
                        <span class="material-icons-outlined" style="color:var(--accent);font-size:20px;">inventory_2</span>
                        <div>
                            <div style="font-weight:600;font-size:14px;">${code}</div>
                            <div style="font-size:12px;color:var(--text-muted);">${criteria.length} inspection criterion${criteria.length !== 1 ? 'a' : ''}</div>
                        </div>
                    </div>
                    <button class="btn-outline" style="font-size:12px;padding:5px 12px;" onclick="openNewCriterionModal('${code}')">
                        <span class="material-icons-outlined" style="font-size:14px;">add</span> Add Criteria
                    </button>
                </div>
                <table class="data-table" style="margin:0;">
                    <thead>
                        <tr>
                            <th>Criterion Name</th>
                            <th>Target Specification</th>
                            <th>Min Tolerance</th>
                            <th>Max Tolerance</th>
                            <th>Inspection Method</th>
                            <th>Mandatory</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${criteria.map(c => `
                        <tr>
                            <td><strong>${c.criterion_name}</strong></td>
                            <td>${c.spec_target || '-'}</td>
                            <td style="font-family:monospace;">${c.tolerance_min || '-'}</td>
                            <td style="font-family:monospace;">${c.tolerance_max || '-'}</td>
                            <td>${c.inspection_method || '-'}</td>
                            <td><span class="badge ${c.is_mandatory ? 'badge-danger' : 'badge-info'}">${c.is_mandatory ? 'Mandatory' : 'Optional'}</span></td>
                        </tr>`).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');
    } catch(e) {
        container.innerHTML = '<div style="text-align:center;padding:40px;color:red;">Error loading criteria.</div>';
    }
}

function _criterionRowHtml(index, prefillCode = '') {
    return `
    <div class="cr-row" id="cr-row-${index}" style="border:1px solid var(--border-color);border-radius:8px;padding:14px;margin-bottom:10px;position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <span style="font-size:12px;font-weight:600;color:var(--text-muted);">CRITERION ${index + 1}</span>
            ${index > 0 ? `<button type="button" onclick="removeCriterionRow(${index})" style="background:none;border:none;cursor:pointer;color:var(--coming-soon-text);display:flex;align-items:center;"><span class="material-icons-outlined" style="font-size:18px;">delete</span></button>` : ''}
        </div>
        <div class="form-group">
            <label>Part / RM Code *</label>
            <input type="text" class="cr-code" value="${prefillCode}" placeholder="e.g. RM-STEEL-316L or 101.7.0001" style="width:100%;">
        </div>
        <div class="form-group">
            <label>Criterion Name *</label>
            <input type="text" class="cr-name" placeholder="e.g. Outer Diameter, Hardness, Surface Finish" style="width:100%;">
        </div>
        <div style="display:flex;gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Target Spec</label>
                <input type="text" class="cr-target" placeholder="e.g. 50.0 mm">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Min Tolerance</label>
                <input type="text" class="cr-min" placeholder="e.g. 49.95 mm">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Max Tolerance</label>
                <input type="text" class="cr-max" placeholder="e.g. 50.05 mm">
            </div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-end;">
            <div class="form-group" style="flex:1;margin-bottom:0;">
                <label>Inspection Method / Gauge</label>
                <input type="text" class="cr-method" value="Digital Vernier Caliper">
            </div>
            <div class="form-group" style="margin-bottom:0;">
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;white-space:nowrap;">
                    <input type="checkbox" class="cr-mandatory" checked style="width:15px;height:15px;">
                    Mandatory
                </label>
            </div>
        </div>
    </div>`;
}

let _crRowCount = 1;

function openNewCriterionModal(prefillCode = '') {
    _crRowCount = 1;
    openModal('Add IQC Inspection Criteria', `
        <div id="crRowsContainer">
            ${_criterionRowHtml(0, prefillCode)}
        </div>
        <button type="button" onclick="addCriterionRow()" style="display:flex;align-items:center;gap:6px;background:none;border:1px dashed var(--border-color);border-radius:6px;padding:8px 14px;width:100%;justify-content:center;cursor:pointer;color:var(--accent);font-size:13px;margin-bottom:16px;">
            <span class="material-icons-outlined" style="font-size:16px;">add</span> Add Another Criterion
        </button>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCriteria()">
                <span class="material-icons-outlined" style="font-size:16px;">save</span> Save All Criteria
            </button>
        </div>
    `);
}

function addCriterionRow() {
    const container = document.getElementById('crRowsContainer');
    // Inherit part code from first row
    const firstCode = container.querySelector('.cr-code')?.value || '';
    const div = document.createElement('div');
    div.innerHTML = _criterionRowHtml(_crRowCount, firstCode);
    container.appendChild(div.firstElementChild);
    _crRowCount++;
    // Re-number labels
    container.querySelectorAll('.cr-row').forEach((row, i) => {
        row.querySelector('span[style*="CRITERION"]').textContent = `CRITERION ${i + 1}`;
    });
}

function removeCriterionRow(index) {
    const row = document.getElementById(`cr-row-${index}`);
    if (row) row.remove();
    // Re-number remaining
    document.querySelectorAll('.cr-row').forEach((row, i) => {
        const label = row.querySelector('span[style*="CRITERION"]');
        if (label) label.textContent = `CRITERION ${i + 1}`;
    });
}

async function submitCriteria() {
    const rows = document.querySelectorAll('.cr-row');
    const payload = [];
    let hasError = false;

    rows.forEach((row, i) => {
        const code  = row.querySelector('.cr-code').value.trim();
        const cname = row.querySelector('.cr-name').value.trim();
        if (!code || !cname) { hasError = true; return; }
        payload.push({
            part_or_rm_code:   code,
            criterion_name:    cname,
            spec_target:       row.querySelector('.cr-target').value.trim(),
            tolerance_min:     row.querySelector('.cr-min').value.trim(),
            tolerance_max:     row.querySelector('.cr-max').value.trim(),
            inspection_method: row.querySelector('.cr-method').value.trim(),
            is_mandatory:      row.querySelector('.cr-mandatory').checked
        });
    });

    if (hasError || !payload.length) {
        showQToast('Part code and criterion name are required for each row', 'error');
        return;
    }

    try {
        const res  = await fetch(API + '/criteria', {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) { closeModal(); showQToast(json.message); loadCriteria(); }
        else { showQToast(json.message, 'error'); }
    } catch(e) { showQToast('Error saving criteria', 'error'); }
}
