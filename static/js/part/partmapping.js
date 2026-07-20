// ─── PART MODULE: PART MAPPING ───

let allMappings = [];
let allUnmapped = [];

async function loadMappings() {
    const tbody = document.getElementById('mappingsTableBody');
    try {
        const res = await fetch(API + '/mappings', { headers: HEADERS });
        const data = await res.json();
        allMappings = data.success ? data.data : [];
        renderMappingsTable();
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading mappings</td></tr>'; }
    loadUnmappedCustomerParts();
}

function renderMappingsTable() {
    const tbody = document.getElementById('mappingsTableBody');
    const q = (document.getElementById('mappingSearchInput') || {}).value || '';
    let filtered = allMappings;
    if (q.trim().length >= 2) {
        const s = q.toLowerCase();
        filtered = allMappings.filter(m =>
            (m.internal_part_number || '').toLowerCase().includes(s) ||
            (m.internal_description || '').toLowerCase().includes(s) ||
            (m.customer_part_number || '').toLowerCase().includes(s)
        );
    }
    if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No mappings found.</td></tr>'; return; }
    tbody.innerHTML = filtered.map(m => `<tr>
        <td><strong>${esc(m.internal_part_number)}</strong></td>
        <td><span class="desc-cell">${esc(m.internal_description)}</span></td>
        <td><strong>${esc(m.customer_part_number)}</strong></td>
        <td>${formatTime(m.created_at)}</td>
        <td class="actions-cell">
            <button class="btn-icon" title="Edit" onclick="openEditMapping('${m.id}','${esc(m.internal_part_number)}','${esc(m.internal_description)}','${esc(m.customer_part_number)}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" title="Delete" onclick="deleteMapping('${m.id}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function filterMappings() { renderMappingsTable(); }

// ─── UNMAPPED CUSTOMER PARTS (from POs) ───
async function loadUnmappedCustomerParts() {
    const container = document.getElementById('unmappedPartsContainer');
    const badge = document.getElementById('unmappedCount');
    if (!container) return;
    try {
        const res = await fetch(API + '/unmapped-customer-parts', { headers: HEADERS });
        const data = await res.json();
        allUnmapped = data.success ? data.data : [];
        if (badge) badge.textContent = allUnmapped.length;
        renderUnmappedTable();
    } catch(e) { container.innerHTML = '<div class="empty" style="padding:12px">Error loading</div>'; }
}

function renderUnmappedTable() {
    const container = document.getElementById('unmappedPartsContainer');
    const q = (document.getElementById('unmappedSearchInput') || {}).value || '';
    let filtered = allUnmapped;
    if (q.trim().length >= 2) {
        const s = q.toLowerCase();
        filtered = allUnmapped.filter(u =>
            (u.customer_part_number || '').toLowerCase().includes(s) ||
            (u.po_number || '').toLowerCase().includes(s)
        );
    }
    if (!filtered.length) { container.innerHTML = '<div class="empty" style="padding:12px">All customer part numbers are mapped ✅</div>'; return; }
    container.innerHTML = `<table class="data-table"><thead><tr><th>Customer Part #</th><th>From PO</th><th>Action</th></tr></thead><tbody>` +
        filtered.map(u => `<tr>
            <td><strong>${esc(u.customer_part_number)}</strong></td>
            <td>${esc(u.po_number)}</td>
            <td><button class="btn-outline btn-sm" onclick="openAddMappingWithCust('${esc(u.customer_part_number)}')"><span class="material-icons-outlined">add_link</span> Map</button></td>
        </tr>`).join('') + `</tbody></table>`;
}

function filterUnmapped() { renderUnmappedTable(); }

function openAddMappingWithCust(cpn) {
    openAddMappingModal();
    document.getElementById('mapCustPartNum').value = cpn;
    document.getElementById('mapCustSelLabel').innerHTML = `<strong>${cpn}</strong>`;
    document.getElementById('mapCustSelected').style.display = 'flex';
}

function openAddMappingModal() {
    document.getElementById('mapIntSearch').value = '';
    document.getElementById('mapCustSearch').value = '';
    document.getElementById('mapIntPartNum').value = '';
    document.getElementById('mapIntDesc').value = '';
    document.getElementById('mapCustPartNum').value = '';
    document.getElementById('mapIntSelected').style.display = 'none';
    document.getElementById('mapCustSelected').style.display = 'none';
    document.getElementById('mapIntResults').innerHTML = '';
    document.getElementById('mapCustResults').innerHTML = '';
    partOpenModal('addMappingModal');
}

// ─── SEARCH INTERNAL PARTS ───
let intSearchTimeout = null;
function searchInternalParts(q) {
    clearTimeout(intSearchTimeout);
    const results = document.getElementById('mapIntResults');
    if (!q || q.trim().length < 2) { results.innerHTML = ''; return; }
    intSearchTimeout = setTimeout(async () => {
        const res = await fetch(API + '/search-parts?q=' + encodeURIComponent(q.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="emp-search-empty">No parts found</div>'; return; }
        results.innerHTML = data.data.map(p => `<div class="emp-search-item" onclick="selectInternalPart('${esc(p.part_number)}','${esc(p.description)}')">
            <div class="emp-search-main"><strong>${esc(p.part_number)}</strong></div>
            <div class="emp-search-sub">${esc(p.description)}</div>
        </div>`).join('');
    }, 300);
}

function selectInternalPart(partNum, desc) {
    document.getElementById('mapIntPartNum').value = partNum;
    document.getElementById('mapIntDesc').value = desc;
    document.getElementById('mapIntSearch').value = '';
    document.getElementById('mapIntResults').innerHTML = '';
    document.getElementById('mapIntSelLabel').innerHTML = `<strong>${partNum}</strong> — ${desc}`;
    document.getElementById('mapIntSelected').style.display = 'flex';
}

function clearMapInt() {
    document.getElementById('mapIntPartNum').value = '';
    document.getElementById('mapIntDesc').value = '';
    document.getElementById('mapIntSelected').style.display = 'none';
}

// ─── SEARCH CUSTOMER PARTS ───
let custSearchTimeout = null;
function searchCustomerParts(q) {
    clearTimeout(custSearchTimeout);
    const results = document.getElementById('mapCustResults');
    if (!q || q.trim().length < 2) { results.innerHTML = ''; return; }
    custSearchTimeout = setTimeout(async () => {
        const res = await fetch(API + '/search-customer-parts?q=' + encodeURIComponent(q.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) {
            results.innerHTML = `<div class="emp-search-item" onclick="selectCustomerPart('${esc(q.trim())}')">
                <div class="emp-search-main">Use: <strong>${esc(q.trim())}</strong></div>
                <div class="emp-search-sub">Manual entry</div>
            </div>`;
            return;
        }
        let html = data.data.map(p => `<div class="emp-search-item" onclick="selectCustomerPart('${esc(p.part_number)}')">
            <div class="emp-search-main"><strong>${esc(p.part_number)}</strong></div>
        </div>`).join('');
        html += `<div class="emp-search-item" onclick="selectCustomerPart('${esc(q.trim())}')">
            <div class="emp-search-main">Use: <strong>${esc(q.trim())}</strong></div>
            <div class="emp-search-sub">Manual entry</div>
        </div>`;
        results.innerHTML = html;
    }, 300);
}

function selectCustomerPart(partNum) {
    document.getElementById('mapCustPartNum').value = partNum;
    document.getElementById('mapCustSearch').value = '';
    document.getElementById('mapCustResults').innerHTML = '';
    document.getElementById('mapCustSelLabel').innerHTML = `<strong>${partNum}</strong>`;
    document.getElementById('mapCustSelected').style.display = 'flex';
}

function clearMapCust() {
    document.getElementById('mapCustPartNum').value = '';
    document.getElementById('mapCustSelected').style.display = 'none';
}

// ─── SAVE MAPPING ───
async function saveMapping(e) {
    e.preventDefault();
    const intPart = document.getElementById('mapIntPartNum').value.trim();
    const custPart = document.getElementById('mapCustPartNum').value.trim();
    if (!intPart) { alert('Please search and select an internal part number'); return; }
    if (!custPart) { alert('Please search and select a customer part number'); return; }
    const body = {
        internal_part_number: intPart,
        internal_description: document.getElementById('mapIntDesc').value,
        customer_part_number: custPart
    };
    const res = await fetch(API + '/mappings', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { partCloseModal('addMappingModal'); loadMappings(); alert('Mapping created & synced to POs!'); }
    else { alert(data.message); }
}

// ─── EDIT MAPPING (syncs everywhere) ───
function openEditMapping(id, intPart, intDesc, custPart) {
    document.getElementById('emapId').value = id;
    document.getElementById('emapIntPart').value = intPart;
    document.getElementById('emapIntDesc').value = intDesc;
    document.getElementById('emapCustPart').value = custPart;
    partOpenModal('editMappingModal');
}

async function updateMapping(e) {
    e.preventDefault();
    const id = document.getElementById('emapId').value;
    const body = {
        internal_part_number: document.getElementById('emapIntPart').value.trim(),
        internal_description: document.getElementById('emapIntDesc').value.trim(),
        customer_part_number: document.getElementById('emapCustPart').value.trim(),
        sync_pos: true
    };
    const res = await fetch(API + '/mappings/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { partCloseModal('editMappingModal'); loadMappings(); alert('Mapping updated & synced to POs!'); }
    else { alert(data.message); }
}

// ─── DELETE MAPPING ───
async function deleteMapping(id) {
    if (!confirm('Delete this mapping?')) return;
    const res = await fetch(API + '/mappings/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadMappings(); else alert(data.message);
}

function partOpenModal(id) { document.getElementById(id).classList.add('active'); }
