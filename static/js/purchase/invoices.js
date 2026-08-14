// ─── PURCHASE: SUPPLIER INVOICES JS ───

async function loadAllInvoices() {
    const tbody = document.getElementById('invoicesBody');
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>';
    try {
        // Load all POs then fetch invoices for each that has one
        const res = await fetch(API + '/po-list', { headers: HEADERS });
        const json = await res.json();
        const pos = (json.data || []);

        // Show POs that have invoices OR all POs with an "Add Invoice" button
        if (!pos.length) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);">No purchase orders found.</td></tr>';
            return;
        }

        tbody.innerHTML = pos.map(po => {
            const hasInvoice = !!po.supplier_invoice_no;
            return `<tr>
                <td><strong>${po.po_no}</strong></td>
                <td>
                    ${po.supplier_id
                        ? `<a href="/supplier/detail/${po.supplier_id}" style="color:#1976d2;font-weight:600;">${po.supplier_brand || po.supplier_name}</a>
                           <br><span style="font-size:11px;color:var(--text-muted);">${po.supplier_code}</span>`
                        : (po.supplier_name || '—')}
                </td>
                <td><code>${po.item_code || '—'}</code><br><span style="font-size:11px;">${po.item_description || ''}</span></td>
                <td>${hasInvoice ? `<strong>${po.supplier_invoice_no}</strong>` : '<span style="color:var(--text-muted);">—</span>'}</td>
                <td>${po.supplier_invoice_date || '—'}</td>
                <td>${hasInvoice ? `<strong>₹${parseFloat(po.supplier_invoice_amount||0).toLocaleString()}</strong>` : '—'}</td>
                <td>
                    ${hasInvoice ? `
                    <span style="background:#e8f5e9;color:#2e7d32;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">
                        Uploaded
                    </span>` : `
                    <span style="background:#ffebee;color:#c62828;border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">
                        Pending Invoice
                    </span>`}
                </td>
                <td>
                    <button class="btn-outline" style="font-size:12px;padding:3px 10px;"
                        onclick="openAddInvoiceModal('${po.id}','${po.po_no}','${po.supplier_brand||po.supplier_name||''}')">
                        <span class="material-icons-outlined" style="font-size:13px;">add</span>
                        ${hasInvoice ? 'Add Another' : 'Add Invoice'}
                    </button>
                    ${hasInvoice ? `
                    <button class="btn-outline" style="font-size:12px;padding:3px 10px;margin-left:4px;"
                        onclick="viewPoInvoices('${po.id}','${po.po_no}')">
                        <span class="material-icons-outlined" style="font-size:13px;">visibility</span> View
                    </button>` : ''}
                </td>
            </tr>`;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:red;">Error loading invoices.</td></tr>';
    }
}

function openAddInvoiceModal(poId, poNo, supplierName) {
    openModal(`Add Supplier Invoice — ${poNo}`, `
        <div style="background:var(--bg-main,#f5f6fa);border-radius:8px;padding:12px;margin-bottom:16px;font-size:13px;">
            <strong>PO:</strong> ${poNo} &nbsp;|&nbsp; <strong>Supplier:</strong> ${supplierName || '—'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
            <div class="form-group">
                <label>Invoice Number *</label>
                <input type="text" id="invNo" placeholder="INV-2026-001">
            </div>
            <div class="form-group">
                <label>Invoice Date</label>
                <input type="date" id="invDate">
            </div>
            <div class="form-group">
                <label>Invoice Amount (₹) *</label>
                <input type="number" id="invAmount" placeholder="0.00" min="0" step="0.01">
            </div>
            <div class="form-group">
                <label>Currency</label>
                <select id="invCurrency">
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea id="invNotes" rows="2" placeholder="Any notes about this invoice..."></textarea>
        </div>
        <div class="form-actions" style="margin-top:14px;">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitInvoice('${poId}','${poNo}')">
                <span class="material-icons-outlined" style="font-size:15px;">save</span> Save Invoice
            </button>
        </div>
    `);
}

async function submitInvoice(poId, poNo) {
    const invoiceNo = document.getElementById('invNo').value.trim();
    const amount    = parseFloat(document.getElementById('invAmount').value || 0);
    if (!invoiceNo) { showToast('Invoice number is required', 'error'); return; }
    if (amount <= 0) { showToast('Invoice amount must be > 0', 'error'); return; }

    try {
        const res = await fetch(`${API}/po-list/${poId}/invoices`, {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({
                invoice_no:     invoiceNo,
                invoice_date:   document.getElementById('invDate').value || null,
                invoice_amount: amount,
                currency:       document.getElementById('invCurrency').value,
                notes:          document.getElementById('invNotes').value.trim()
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message || `Invoice ${invoiceNo} saved. Logistics notified.`);
            closeModal();
            loadAllInvoices();
        } else {
            showToast(json.message || 'Failed to save invoice', 'error');
        }
    } catch (e) {
        showToast('Error saving invoice', 'error');
    }
}

async function viewPoInvoices(poId, poNo) {
    try {
        const res = await fetch(`${API}/po-list/${poId}/invoices`, { headers: HEADERS });
        const json = await res.json();
        const invs = json.data || [];
        const rows = invs.length
            ? invs.map(i => `
                <tr>
                    <td><strong>${i.invoice_no}</strong></td>
                    <td>${i.invoice_date || '—'}</td>
                    <td><strong>₹${i.invoice_amount.toLocaleString()}</strong> ${i.currency}</td>
                    <td><span style="background:${i.status==='verified'?'#e8f5e9':'#fff3e0'};color:${i.status==='verified'?'#2e7d32':'#e65100'};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">${i.status}</span></td>
                    <td>${i.received_by || '—'}</td>
                    <td>
                        ${i.status !== 'verified' ? `
                        <button class="btn-outline" style="font-size:12px;padding:3px 10px;"
                            onclick="verifyInvoice('${poId}','${i.id}')">
                            <span class="material-icons-outlined" style="font-size:13px;">verified</span> Verify
                        </button>` : '<span style="color:#2e7d32;font-size:12px;">✓ Verified</span>'}
                    </td>
                </tr>`).join('')
            : '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);">No invoices yet.</td></tr>';

        openModal(`Invoices for PO: ${poNo}`, `
            <table class="data-table" style="width:100%;">
                <thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th><th>Received By</th><th>Action</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
            <div style="margin-top:14px;">
                <button class="btn-primary" onclick="openAddInvoiceModal('${poId}','${poNo}','')">
                    <span class="material-icons-outlined" style="font-size:14px;">add</span> Add Another Invoice
                </button>
            </div>
        `);
    } catch (e) {
        showToast('Error loading invoices', 'error');
    }
}

async function verifyInvoice(poId, invId) {
    try {
        const res = await fetch(`${API}/po-list/${poId}/invoices/${invId}/verify`, {
            method: 'POST', headers: HEADERS
        });
        const json = await res.json();
        if (json.success) { showToast('Invoice verified'); loadAllInvoices(); closeModal(); }
        else showToast(json.message || 'Failed', 'error');
    } catch (e) {
        showToast('Error verifying invoice', 'error');
    }
}
