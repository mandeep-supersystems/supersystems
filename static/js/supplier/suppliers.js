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

// ─── EXPORT / IMPORT ───

function exportSuppliers() {
    if (!allSuppliers.length) { showToast('No suppliers to export', 'error'); return; }
    
    // Build CSV
    const headers = ['Code', 'Brand Name', 'Company Type', 'Registered Name', 'GST No', 'Contact Person', 'Email', 'Phone', 'Address'];
    let csv = '"' + headers.join('","') + '"\\n';
    
    for (const sup of allSuppliers) {
        const row = [
            sup.supplier_code,
            sup.brand_name,
            sup.company_type,
            sup.registered_name,
            sup.gst_number,
            sup.primary_contact_name,
            sup.primary_contact_email,
            sup.primary_contact_phone,
            sup.registered_address
        ].map(v => '"' + String(v || '').replace(/"/g, '""') + '"');
        csv += row.join(',') + '\\n';
    }
    
    // Download Blob
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'suppliers_export.csv';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Suppliers exported');
    fetch(API + '/log-action', { method: 'POST', headers: getHeaders(), body: JSON.stringify({ action: 'EXPORT', entity_type: 'Suppliers', entity_id: 'suppliers_export.csv' }) }).catch(() => {});
}

function triggerImport() {
    document.getElementById('importFileInput').value = '';
    document.getElementById('importFileInput').click();
}

async function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;

    let headers = [];
    let rows = [];

    try {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (isExcel) {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            if (jsonData.length < 2) { showToast('Excel file is empty or has no data rows', 'error'); return; }
            headers = jsonData[0].map(h => String(h || '').trim());
            rows = jsonData.slice(1).map(row => row.map(v => String(v !== undefined && v !== null ? v : '').trim()));
        } else {
            const text = await file.text();
            const lines = text.trim().split('\\n');
            if (lines.length < 2) { showToast('CSV file is empty or has no data rows', 'error'); return; }
            headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
            rows = lines.slice(1).map(line => {
                const vals = line.match(/("[^"]*"|[^,]+)/g) || [];
                return vals.map(v => v.trim().replace(/^"|"$/g, ''));
            });
        }

        let imported = 0;
        let errors = [];

        // Helper to find column index cleanly
        const getColVal = (row, fieldNames, defaultIdx) => {
            const idx = headers.findIndex(h => {
                const clean = h.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                return fieldNames.some(fn => clean.includes(fn.toLowerCase()));
            });
            return idx >= 0 ? row[idx] : row[defaultIdx];
        };

        for (const row of rows) {
            if (row.length === 0 || !row.join('').trim()) continue;
            
            const brand_name = getColVal(row, ['brandname', 'brand'], 1);
            if (!brand_name) { errors.push(`Skipped row: missing brand name`); continue; }
            
            const supplier_code = getColVal(row, ['code', 'suppliercode'], 0) || '';
            const company_type = getColVal(row, ['companytype', 'type'], 2) || '';
            const registered_name = getColVal(row, ['registeredname', 'name'], 3) || '';
            const gst_number = getColVal(row, ['gst'], 4) || '';
            const primary_contact_name = getColVal(row, ['contactperson', 'contactname'], 5) || '';
            const primary_contact_email = getColVal(row, ['email'], 6) || '';
            const primary_contact_phone = getColVal(row, ['phone', 'contactnumber'], 7) || '';
            const registered_address = getColVal(row, ['address'], 8) || '';
            
            try {
                const res = await fetch(API + '/suppliers', {
                    method: 'POST',
                    headers: getHeaders(),
                    body: JSON.stringify({ 
                        brand_name, supplier_code, company_type, registered_name, 
                        gst_number, primary_contact_name, primary_contact_email, 
                        primary_contact_phone, registered_address 
                    })
                });
                const data = await res.json();
                if (data.success) {
                    imported++;
                } else {
                    errors.push(`Failed for ${brand_name}: ${data.message}`);
                }
            } catch (e) {
                errors.push(`Network error for ${brand_name}`);
            }
        }
        
        loadSuppliers();
        if (errors.length) {
            console.error('Import Errors:', errors);
            showToast(`Imported ${imported}. Failed ${errors.length}. See console.`, 'error');
        } else {
            showToast(`Successfully imported ${imported} suppliers`);
        }
        
    } catch (e) {
        console.error(e);
        showToast('Error processing file', 'error');
    }
}

