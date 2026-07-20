// ─── RM VENDORS ───
let allRmVendors = [];

async function loadRmVendors() {
    const res = await fetch(RM_API + '/vendors', { headers: RM_HEADERS });
    const data = await res.json();
    allRmVendors = data.success ? data.data : [];
    renderRmVendors();
}

function renderRmVendors() {
    const tbody = document.getElementById('rmVendorsBody');
    const q = (document.getElementById('rmVendorSearch')?.value || '').toLowerCase();
    let items = allRmVendors;
    if (q) items = items.filter(r => (r.rm_code + ' ' + r.vendor_name + ' ' + r.vendor_code).toLowerCase().includes(q));
    if (!items.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No RM vendors found</td></tr>'; return; }
    tbody.innerHTML = items.map(r => {
        const stars = r.rating ? '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating) : '-';
        return `
        <tr>
            <td><span class="part-number-cell">${esc(r.rm_code)}</span><div class="cell-sub">${esc(r.rm_description)}</div></td>
            <td><span class="cell-main">${esc(r.vendor_name)}</span>${r.vendor_code ? '<div class="cell-sub">' + esc(r.vendor_code) + '</div>' : ''}</td>
            <td>${r.price_per_unit != null ? '₹' + r.price_per_unit.toFixed(2) : '-'}</td>
            <td>${r.moq != null ? r.moq : '-'}</td>
            <td>${r.lead_time_days != null ? r.lead_time_days + ' days' : '-'}</td>
            <td>${esc(r.payment_terms) || '-'}</td>
            <td>${r.is_preferred ? '<span class="preferred-badge">★ Preferred</span>' : '-'}</td>
            <td><span class="rating-stars">${stars}</span></td>
            <td class="actions-cell">
                <button class="btn-action" onclick="editRmVendor('${r.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action btn-danger" onclick="deleteRmVendor('${r.id}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>
    `}).join('');
}

function openAddVendorModal() {
    document.getElementById('vId').value = '';
    document.getElementById('vRmSearch').value = '';
    document.getElementById('vRmCode').value = '';
    document.getElementById('vRmDesc').value = '';
    document.getElementById('vRmSelected').style.display = 'none';
    document.getElementById('vRmSearch').style.display = '';
    document.getElementById('vVendorName').value = '';
    document.getElementById('vVendorCode').value = '';
    document.getElementById('vPrice').value = '';
    document.getElementById('vCurrency').value = 'INR';
    document.getElementById('vMoq').value = '';
    document.getElementById('vLeadTime').value = '';
    document.getElementById('vPayTerms').value = '';
    document.getElementById('vPreferred').checked = false;
    document.getElementById('vRating').value = '';
    document.getElementById('vModalTitle').textContent = 'Add RM Vendor';
    rmOpenModal('rmVendorModal');
}

// Search RM for vendor
let vRmTimeout;
function searchRmForVendor(q) {
    clearTimeout(vRmTimeout);
    const results = document.getElementById('vRmResults');
    if (q.length < 2) { results.innerHTML = ''; return; }
    vRmTimeout = setTimeout(async () => {
        const res = await fetch(`${RM_API}/search-rm?q=${encodeURIComponent(q)}`, { headers: RM_HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="emp-search-empty">No results</div>'; return; }
        results.innerHTML = data.data.map(r => `
            <div class="emp-search-item" onclick="selectRmForVendor('${esc(r.rm_code)}','${esc(r.rm_description)}')">
                <div class="emp-search-main">${esc(r.rm_code)}</div>
                <div class="emp-search-sub">${esc(r.rm_description)}</div>
            </div>
        `).join('');
    }, 300);
}

function selectRmForVendor(code, desc) {
    document.getElementById('vRmCode').value = code;
    document.getElementById('vRmDesc').value = desc;
    document.getElementById('vRmSearch').style.display = 'none';
    document.getElementById('vRmResults').innerHTML = '';
    document.getElementById('vRmSelected').style.display = '';
    document.getElementById('vRmSelLabel').textContent = `${code} — ${desc}`;
}

function clearVRm() {
    document.getElementById('vRmCode').value = '';
    document.getElementById('vRmDesc').value = '';
    document.getElementById('vRmSearch').value = '';
    document.getElementById('vRmSearch').style.display = '';
    document.getElementById('vRmSelected').style.display = 'none';
}

async function saveRmVendor(e) {
    e.preventDefault();
    const id = document.getElementById('vId').value;
    const payload = {
        rm_code: document.getElementById('vRmCode').value,
        rm_description: document.getElementById('vRmDesc').value,
        vendor_name: document.getElementById('vVendorName').value.trim(),
        vendor_code: document.getElementById('vVendorCode').value.trim(),
        price_per_unit: document.getElementById('vPrice').value || null,
        currency: document.getElementById('vCurrency').value,
        moq: document.getElementById('vMoq').value || null,
        lead_time_days: document.getElementById('vLeadTime').value || null,
        payment_terms: document.getElementById('vPayTerms').value.trim(),
        is_preferred: document.getElementById('vPreferred').checked,
        rating: document.getElementById('vRating').value || null
    };
    if (!payload.rm_code || !payload.vendor_name) { rmToast('Select RM and enter Vendor Name', 'error'); return; }
    const url = id ? `${RM_API}/vendors/${id}` : `${RM_API}/vendors`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: RM_HEADERS, body: JSON.stringify(payload) });
    const data = await res.json();
    if (data.success) { rmCloseModal('rmVendorModal'); rmToast(data.message); loadRmVendors(); }
    else { rmToast(data.message || 'Error', 'error'); }
}

function editRmVendor(id) {
    const r = allRmVendors.find(x => x.id === id);
    if (!r) return;
    document.getElementById('vId').value = r.id;
    document.getElementById('vRmCode').value = r.rm_code;
    document.getElementById('vRmDesc').value = r.rm_description || '';
    document.getElementById('vRmSearch').style.display = 'none';
    document.getElementById('vRmSelected').style.display = '';
    document.getElementById('vRmSelLabel').textContent = `${r.rm_code} — ${r.rm_description || ''}`;
    document.getElementById('vVendorName').value = r.vendor_name;
    document.getElementById('vVendorCode').value = r.vendor_code || '';
    document.getElementById('vPrice').value = r.price_per_unit || '';
    document.getElementById('vCurrency').value = r.currency || 'INR';
    document.getElementById('vMoq').value = r.moq || '';
    document.getElementById('vLeadTime').value = r.lead_time_days || '';
    document.getElementById('vPayTerms').value = r.payment_terms || '';
    document.getElementById('vPreferred').checked = r.is_preferred || false;
    document.getElementById('vRating').value = r.rating || '';
    document.getElementById('vModalTitle').textContent = 'Edit RM Vendor';
    rmOpenModal('rmVendorModal');
}

async function deleteRmVendor(id) {
    if (!confirm('Delete this vendor entry?')) return;
    const res = await fetch(`${RM_API}/vendors/${id}`, { method: 'DELETE', headers: RM_HEADERS });
    const data = await res.json();
    if (data.success) { rmToast('Deleted'); loadRmVendors(); }
    else { rmToast(data.message || 'Error', 'error'); }
}

function filterRmVendors() { renderRmVendors(); }
