// ─── SUPPLIER LIST PAGE ───
let allSuppliers = [];

async function loadSuppliers() {
    const res = await fetch(`${API}/suppliers`, { headers: getHeaders() });
    const data = await res.json();
    allSuppliers = data.data || [];
    renderTable(allSuppliers);
}

function filterSuppliers(q) {
    const lq = q.toLowerCase();
    const filtered = q.length < 2 ? allSuppliers : allSuppliers.filter(s =>
        (s.supplier_code || '').toLowerCase().includes(lq) ||
        (s.brand_name || '').toLowerCase().includes(lq) ||
        (s.registered_name || '').toLowerCase().includes(lq) ||
        (s.gst_no || '').toLowerCase().includes(lq)
    );
    renderTable(filtered);
}

function renderTable(list) {
    const tbody = document.getElementById('suppliersBody');
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="9" class="empty">No suppliers found.</td></tr>';
        return;
    }
    tbody.innerHTML = list.map(s => {
        const detailUrl = `/supplier/detail/${s.id}`;
        return `
        <tr onclick="window.location='${detailUrl}'" style="cursor:pointer">
            <td><a class="sup-code-link" href="${detailUrl}" onclick="event.stopPropagation()">${esc(s.supplier_code)}</a></td>
            <td><strong>${esc(s.brand_name)}</strong></td>
            <td>${esc(s.company_type || '—')}</td>
            <td>${esc(s.registered_name || '—')}</td>
            <td><span style="font-family:monospace;font-size:12px">${esc(s.gst_no || '—')}</span></td>
            <td>${statusBadge(s.status)}</td>
            <td><span class="rating-stars">${stars(s.rating)}</span></td>
            <td><span style="font-size:12px;font-weight:600">${esc(s.currency)}</span></td>
            <td class="actions-cell" onclick="event.stopPropagation()">
                <button class="btn-action" title="View" onclick="window.location='${detailUrl}'">
                    <span class="material-icons-outlined">open_in_new</span>
                </button>
                <button class="btn-action btn-danger" title="Delete" onclick="confirmDelete('${s.id}','${esc(s.brand_name)}')">
                    <span class="material-icons-outlined">delete</span>
                </button>
            </td>
        </tr>`;
    }).join('');
}

function openAddModal() {
    document.getElementById('addModalTitle').textContent = 'New Supplier';
    openModal('addSupplierModal');
}

async function saveSupplier(e) {
    e.preventDefault();
    const body = {
        supplier_code: document.getElementById('asCode').value.trim(),
        brand_name: document.getElementById('asBrand').value.trim(),
        company_type: document.getElementById('asType').value,
        registered_name: document.getElementById('asRegName').value.trim(),
        gst_no: document.getElementById('asGST').value.trim(),
        currency: document.getElementById('asCurrency').value,
        status: document.getElementById('asStatus').value,
        rating: parseFloat(document.getElementById('asRating').value) || 0,
        website: document.getElementById('asWebsite').value.trim(),
        notes: document.getElementById('asNotes').value.trim()
    };
    const res = await fetch(API + '/suppliers', { method: 'POST', headers: getHeaders(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        closeModal('addSupplierModal');
        showToast('Supplier created: ' + data.data.supplier_code);
        loadSuppliers();
        document.getElementById('addSupplierModal').querySelectorAll('input,select,textarea').forEach(el => {
            if (el.tagName === 'SELECT') el.selectedIndex = 0;
            else el.value = el.id === 'asRating' ? '0' : '';
        });
    } else {
        showToast(data.message || 'Error creating supplier', 'error');
    }
}

function confirmDelete(id, name) {
    document.getElementById('deleteMsg').textContent = `Delete supplier "${name}"? This cannot be undone.`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(API + '/suppliers/' + id, { method: 'DELETE', headers: getHeaders() });
        const data = await res.json();
        if (data.success) { closeModal('deleteModal'); showToast('Supplier deleted'); loadSuppliers(); }
        else showToast(data.message || 'Error', 'error');
    };
    openModal('deleteModal');
}

// Init
loadSuppliers();
