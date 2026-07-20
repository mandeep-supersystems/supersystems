// ─── RM-PART MAPPING ───
let allRmPartMappings = [];

async function loadRmPartMappings() {
    const res = await fetch(RM_API + '/part-mappings', { headers: RM_HEADERS });
    const data = await res.json();
    allRmPartMappings = data.success ? data.data : [];
    renderRmPartMappings();
}

function renderRmPartMappings() {
    const tbody = document.getElementById('rmPartMappingBody');
    const q = (document.getElementById('rmPmSearch')?.value || '').toLowerCase();
    let items = allRmPartMappings;
    if (q) items = items.filter(r => (r.rm_code + ' ' + r.part_number + ' ' + r.rm_description + ' ' + r.part_description).toLowerCase().includes(q));
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No RM-Part mappings found</td></tr>'; return; }
    tbody.innerHTML = items.map(r => `
        <tr>
            <td><span class="part-number-cell">${esc(r.rm_code)}</span><div class="cell-sub">${esc(r.rm_description)}</div></td>
            <td><span class="part-number-cell">${esc(r.part_number)}</span><div class="cell-sub">${esc(r.part_description)}</div></td>
            <td>${r.quantity_required != null ? r.quantity_required : '-'}</td>
            <td>${esc(r.unit) || '-'}</td>
            <td>${r.wastage_percent != null ? r.wastage_percent + '%' : '-'}</td>
            <td><span class="eff-qty">${r.effective_quantity != null ? r.effective_quantity.toFixed(2) : '-'}</span></td>
            <td>${esc(r.process_notes) || '-'}</td>
            <td class="actions-cell">
                <button class="btn-action" onclick="editRmPm('${r.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteRmPm('${r.id}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>
    `).join('');
}

function openAddRmPmModal() {
    document.getElementById('pmId').value = '';
    document.getElementById('pmRmSearch').value = '';
    document.getElementById('pmRmCode').value = '';
    document.getElementById('pmRmDesc').value = '';
    document.getElementById('pmRmSelected').style.display = 'none';
    document.getElementById('pmPartSearch').value = '';
    document.getElementById('pmPartNum').value = '';
    document.getElementById('pmPartDesc').value = '';
    document.getElementById('pmPartSelected').style.display = 'none';
    document.getElementById('pmQty').value = '';
    document.getElementById('pmUnit').value = '';
    document.getElementById('pmWastage').value = '';
    document.getElementById('pmNotes').value = '';
    document.getElementById('pmModalTitle').textContent = 'Add RM-Part Mapping';
    rmOpenModal('rmPmModal');
}

// Search RM
let rmSearchTimeout;
function searchRmForMapping(q) {
    clearTimeout(rmSearchTimeout);
    const results = document.getElementById('pmRmResults');
    if (q.length < 2) { results.innerHTML = ''; return; }
    rmSearchTimeout = setTimeout(async () => {
        const res = await fetch(`${RM_API}/search-rm?q=${encodeURIComponent(q)}`, { headers: RM_HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="emp-search-empty">No results</div>'; return; }
        results.innerHTML = data.data.map(r => `
            <div class="emp-search-item" onclick="selectRmForPm('${esc(r.rm_code)}','${esc(r.rm_description)}')">
                <div class="emp-search-main">${esc(r.rm_code)}</div>
                <div class="emp-search-sub">${esc(r.rm_description)}</div>
            </div>
        `).join('');
    }, 300);
}

function selectRmForPm(code, desc) {
    document.getElementById('pmRmCode').value = code;
    document.getElementById('pmRmDesc').value = desc;
    document.getElementById('pmRmSearch').style.display = 'none';
    document.getElementById('pmRmResults').innerHTML = '';
    document.getElementById('pmRmSelected').style.display = '';
    document.getElementById('pmRmSelLabel').textContent = `${code} — ${desc}`;
}

function clearPmRm() {
    document.getElementById('pmRmCode').value = '';
    document.getElementById('pmRmDesc').value = '';
    document.getElementById('pmRmSearch').value = '';
    document.getElementById('pmRmSearch').style.display = '';
    document.getElementById('pmRmSelected').style.display = 'none';
}

// Search Part
let partSearchTimeout;
function searchPartForRm(q) {
    clearTimeout(partSearchTimeout);
    const results = document.getElementById('pmPartResults');
    if (q.length < 2) { results.innerHTML = ''; return; }
    partSearchTimeout = setTimeout(async () => {
        const res = await fetch(`/api/v1/part/search-parts?q=${encodeURIComponent(q)}`, { headers: RM_HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="emp-search-empty">No results</div>'; return; }
        results.innerHTML = data.data.map(r => `
            <div class="emp-search-item" onclick="selectPartForPm('${esc(r.part_number)}','${esc(r.description)}')">
                <div class="emp-search-main">${esc(r.part_number)}</div>
                <div class="emp-search-sub">${esc(r.description)}</div>
            </div>
        `).join('');
    }, 300);
}

function selectPartForPm(pn, desc) {
    document.getElementById('pmPartNum').value = pn;
    document.getElementById('pmPartDesc').value = desc;
    document.getElementById('pmPartSearch').style.display = 'none';
    document.getElementById('pmPartResults').innerHTML = '';
    document.getElementById('pmPartSelected').style.display = '';
    document.getElementById('pmPartSelLabel').textContent = `${pn} — ${desc}`;
}

function clearPmPart() {
    document.getElementById('pmPartNum').value = '';
    document.getElementById('pmPartDesc').value = '';
    document.getElementById('pmPartSearch').value = '';
    document.getElementById('pmPartSearch').style.display = '';
    document.getElementById('pmPartSelected').style.display = 'none';
}

async function saveRmPm(e) {
    e.preventDefault();
    const id = document.getElementById('pmId').value;
    const payload = {
        rm_code: document.getElementById('pmRmCode').value,
        rm_description: document.getElementById('pmRmDesc').value,
        part_number: document.getElementById('pmPartNum').value,
        part_description: document.getElementById('pmPartDesc').value,
        quantity_required: document.getElementById('pmQty').value || null,
        unit: document.getElementById('pmUnit').value,
        wastage_percent: document.getElementById('pmWastage').value || null,
        process_notes: document.getElementById('pmNotes').value
    };
    if (!payload.rm_code || !payload.part_number) { rmToast('Select both RM and Part', 'error'); return; }
    const url = id ? `${RM_API}/part-mappings/${id}` : `${RM_API}/part-mappings`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: RM_HEADERS, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { rmCloseModal('rmPmModal'); rmToast(data.message); loadRmPartMappings(); }
    else { rmToast(data.message || 'Error', 'error'); }
}

function editRmPm(id) {
    const r = allRmPartMappings.find(x => x.id === id);
    if (!r) return;
    document.getElementById('pmId').value = r.id;
    document.getElementById('pmRmCode').value = r.rm_code;
    document.getElementById('pmRmDesc').value = r.rm_description || '';
    document.getElementById('pmRmSearch').style.display = 'none';
    document.getElementById('pmRmSelected').style.display = '';
    document.getElementById('pmRmSelLabel').textContent = `${r.rm_code} — ${r.rm_description || ''}`;
    document.getElementById('pmPartNum').value = r.part_number;
    document.getElementById('pmPartDesc').value = r.part_description || '';
    document.getElementById('pmPartSearch').style.display = 'none';
    document.getElementById('pmPartSelected').style.display = '';
    document.getElementById('pmPartSelLabel').textContent = `${r.part_number} — ${r.part_description || ''}`;
    document.getElementById('pmQty').value = r.quantity_required || '';
    document.getElementById('pmUnit').value = r.unit || '';
    document.getElementById('pmWastage').value = r.wastage_percent || '';
    document.getElementById('pmNotes').value = r.process_notes || '';
    document.getElementById('pmModalTitle').textContent = 'Edit RM-Part Mapping';
    rmOpenModal('rmPmModal');
}

async function deleteRmPm(id) {
    if (!confirm('Delete this mapping?')) return;
    const res = await fetch(`${RM_API}/part-mappings/${id}`, { method: 'DELETE', headers: RM_HEADERS });
    const data = await res.json();
    if (data.success) { rmToast('Deleted'); loadRmPartMappings(); }
    else { rmToast(data.message || 'Error', 'error'); }
}

function filterRmPm() { renderRmPartMappings(); }
