// ─── RM MASTER ───
let allRmMaster = [];
let rmCriteriaList = [];

async function loadRmMaster() {
    const res = await fetch(RM_API + '/master', { headers: RM_HEADERS });
    const data = await res.json();
    allRmMaster = data.success ? data.data : [];
    renderRmMaster();
    loadCriteriaDropdown();
}

function renderRmMaster() {
    const tbody = document.getElementById('rmMasterTableBody');
    const q = (document.getElementById('rmMasterSearch')?.value || '').toLowerCase();
    let items = allRmMaster;
    if (q) items = items.filter(r => (r.rm_code + ' ' + r.rm_description + ' ' + r.material_category).toLowerCase().includes(q));
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No raw materials found</td></tr>'; return; }
    tbody.innerHTML = items.map(r => `
        <tr>
            <td><span class="part-number-cell">${esc(r.rm_code)}</span></td>
            <td><span class="desc-cell">${esc(r.rm_description)}</span></td>
            <td>${esc(r.material_category)}</td>
            <td><span class="status-badge ${r.is_active ? 'status-active' : 'status-obsolete'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="actions-cell">
                <button class="btn-action" onclick="editRm('${r.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteRm('${r.id}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>
    `).join('');
}

async function loadCriteriaDropdown() {
    const res = await fetch(RM_API + '/criteria', { headers: RM_HEADERS });
    const data = await res.json();
    rmCriteriaList = data.success ? data.data.filter(c => c.is_active !== false) : [];
    const sel = document.getElementById('rmCriteriaSelect');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select Criteria</option>' + rmCriteriaList.map(c =>
        `<option value="${c.id}">${c.material_category}${c.sub_category ? ' / ' + c.sub_category : ''} (${c.series_prefix})</option>`
    ).join('');
}

function onCriteriaChange() {
    const critId = document.getElementById('rmCriteriaSelect').value;
    const container = document.getElementById('rmDynamicCols');
    container.innerHTML = '';
    if (!critId) return;
    const crit = rmCriteriaList.find(c => c.id === critId);
    if (!crit) return;
    const cols = parseCritCols(crit.columns_config);
    if (cols.length) {
        container.innerHTML = '<p class="gen-cols-title">Additional Fields</p>' + cols.map(c => `
            <div class="form-group">
                <label>${esc(c.label || c.name)}</label>
                <input type="text" id="rm_col_${c.name}" placeholder="Enter ${esc(c.label || c.name)}">
            </div>
        `).join('');
    }
}

function parseCritCols(config) {
    if (!config) return [];
    if (Array.isArray(config)) return config;
    if (typeof config === 'string') { try { return JSON.parse(config); } catch(e) { return []; } }
    return [];
}

function openAddRmModal() {
    document.getElementById('rmId').value = '';
    document.getElementById('rmCriteriaSelect').value = '';
    document.getElementById('rmDescription').value = '';
    document.getElementById('rmNotes').value = '';
    document.getElementById('rmDynamicCols').innerHTML = '';
    document.getElementById('rmModalTitle').textContent = 'Create Raw Material';
    document.getElementById('rmCriteriaGroup').style.display = '';
    document.getElementById('rmCodeDisplay').style.display = 'none';
    rmOpenModal('rmMasterModal');
}

async function saveRm(e) {
    e.preventDefault();
    const id = document.getElementById('rmId').value;
    if (id) {
        const payload = {
            rm_description: document.getElementById('rmDescription').value.trim(),
            notes: document.getElementById('rmNotes').value.trim()
        };
        const res = await fetch(`${RM_API}/master/${id}`, { method: 'PUT', headers: RM_HEADERS, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { rmCloseModal('rmMasterModal'); rmToast('Updated'); loadRmMaster(); }
        else { rmToast(data.message || 'Error', 'error'); }
    } else {
        const criteriaId = document.getElementById('rmCriteriaSelect').value;
        if (!criteriaId) { rmToast('Select a criteria to generate RM code', 'error'); return; }
        const crit = rmCriteriaList.find(c => c.id === criteriaId);
        const cols = crit ? parseCritCols(crit.columns_config) : [];
        const col_values = {};
        cols.forEach(c => {
            const input = document.getElementById('rm_col_' + c.name);
            if (input && input.value.trim()) col_values[c.name] = input.value.trim();
        });
        const payload = {
            criteria_id: criteriaId,
            rm_description: document.getElementById('rmDescription').value.trim(),
            notes: document.getElementById('rmNotes').value.trim(),
            col_values: col_values
        };
        const res = await fetch(`${RM_API}/master`, { method: 'POST', headers: RM_HEADERS, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.success) { rmCloseModal('rmMasterModal'); rmToast(`Created: ${data.data.rm_code}`); loadRmMaster(); }
        else { rmToast(data.message || 'Error', 'error'); }
    }
}

function editRm(id) {
    const r = allRmMaster.find(x => x.id === id);
    if (!r) return;
    document.getElementById('rmId').value = r.id;
    document.getElementById('rmDescription').value = r.rm_description || '';
    document.getElementById('rmNotes').value = r.notes || '';
    document.getElementById('rmDynamicCols').innerHTML = '';
    document.getElementById('rmModalTitle').textContent = `Edit: ${r.rm_code}`;
    document.getElementById('rmCriteriaGroup').style.display = 'none';
    document.getElementById('rmCodeDisplay').style.display = '';
    document.getElementById('rmCodeDisplay').querySelector('span').textContent = r.rm_code;
    rmOpenModal('rmMasterModal');
}

async function deleteRm(id) {
    if (!confirm('Delete this raw material?')) return;
    const res = await fetch(`${RM_API}/master/${id}`, { method: 'DELETE', headers: RM_HEADERS });
    const data = await res.json();
    if (data.success) { rmToast('Deleted'); loadRmMaster(); }
    else { rmToast(data.message || 'Error', 'error'); }
}

function filterRmMaster() { renderRmMaster(); }
