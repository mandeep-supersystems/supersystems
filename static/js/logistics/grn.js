// ─── LOGISTICS GRN JS ───

// ─── LOGISTICS GRN JS ───

let allGrns = [];

async function loadGrnList() {
    const container = document.getElementById('grnListContainer');
    container.innerHTML = '<div class="empty-state"><span class="material-icons-outlined" style="animation:spin 1s linear infinite;">sync</span>Loading GRNs...</div>';
    try {
        const res = await fetch(API + '/grn', { headers: HEADERS });
        const json = await res.json();
        if (!json.success) {
            container.innerHTML = '<div class="empty-state" style="color:red;">Error loading GRNs.</div>';
            return;
        }
        allGrns = json.data || [];
        renderGrnListTable(allGrns);
    } catch (e) {
        container.innerHTML = '<div class="empty-state" style="color:red;">Error loading GRNs.</div>';
    }
}

function renderGrnListTable(list) {
    const container = document.getElementById('grnListContainer');
    if (!container) return;
    
    if (!list.length) {
        container.innerHTML = '<div class="empty-state"><span class="material-icons-outlined">receipt_long</span>No matching GRNs found.</div>';
        return;
    }
    
    const rowsHtml = list.map(g => {
        let dateStr = '—';
        if (g.created_at) {
            const d = new Date(g.created_at);
            dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }
        
        const partLabel = g.lines && g.lines.length > 0 
            ? `<code>${g.lines[0].item_code}</code>${g.lines.length > 1 ? ` (+${g.lines.length - 1} more)` : ''}`
            : `<code>${g.item_code || '—'}</code>`;
            
        const invoiceLink = g.invoice_file_path 
            ? `<a href="${g.invoice_file_path}" target="_blank" style="display:inline-flex;align-items:center;gap:3px;text-decoration:none;font-weight:600;color:var(--primary-color);" onclick="event.stopPropagation();"><span class="material-icons-outlined" style="font-size:14px;">download</span>${g.invoice_no}</a>`
            : (g.invoice_no || '—');

        return `
            <tr onclick="openGrnDetail('${g.id}')" style="cursor:pointer;" class="hover-row">
                <td style="font-weight:600;color:var(--primary-color);"># ${g.grn_no}</td>
                <td><code>${g.po_no || g.po_id}</code></td>
                <td>${g.supplier_name || '—'}</td>
                <td>${partLabel}</td>
                <td style="text-align:right;font-weight:600;">${g.received_qty}</td>
                <td><code>${g.batch_no || '—'}</code></td>
                <td>${invoiceLink}</td>
                <td>
                    <div style="font-size:11px;font-weight:500;">${g.created_by || 'system'}</div>
                    <div style="font-size:10px;color:var(--text-muted);">${dateStr}</div>
                </td>
                <td style="text-align:center;">${statusBadge(g.grn_status)}</td>
                <td style="text-align:center;">
                    <button class="btn-outline" style="padding:4px 8px;font-size:11px;border-radius:4px;" onclick="event.stopPropagation();openGrnDetail('${g.id}')">
                        View
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    container.innerHTML = `
        <div class="table-responsive" style="border:1px solid var(--border-color);border-radius:8px;background:var(--card-bg);">
            <table class="data-table" style="width:100%;font-size:13px;">
                <thead>
                    <tr style="background:var(--bg-secondary);">
                        <th style="text-align:left;">GRN No</th>
                        <th style="text-align:left;">PO No</th>
                        <th style="text-align:left;">Supplier</th>
                        <th style="text-align:left;">Part(s)</th>
                        <th style="text-align:right;">Rec. Qty</th>
                        <th style="text-align:left;">Batch No</th>
                        <th style="text-align:left;">Invoice</th>
                        <th style="text-align:left;">Created By/At</th>
                        <th style="text-align:center;">Status</th>
                        <th style="text-align:center;width:80px;">Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

function filterGrnList() {
    const query = (document.getElementById('grnSearchInput').value || '').toLowerCase().trim();
    const status = document.getElementById('grnStatusFilterSelect').value;
    
    const filtered = allGrns.filter(g => {
        if (status && g.grn_status !== status) return false;
        
        if (query) {
            const inGrn = (g.grn_no || '').toLowerCase().includes(query);
            const inPo = (g.po_no || g.po_id || '').toLowerCase().includes(query);
            const inSupplier = (g.supplier_name || '').toLowerCase().includes(query);
            
            let inParts = (g.item_code || '').toLowerCase().includes(query);
            if (g.lines && g.lines.length > 0) {
                const matchedLine = g.lines.some(l => 
                    (l.item_code || '').toLowerCase().includes(query) ||
                    (l.item_description || '').toLowerCase().includes(query)
                );
                if (matchedLine) inParts = true;
            }
            
            return inGrn || inPo || inSupplier || inParts;
        }
        return true;
    });
    
    renderGrnListTable(filtered);
}

// Open create GRN modal — can be called from pending POs or standalone
async function openCreateGrnModal(poId = '', poNo = '', supplierName = '', itemCode = '', orderQty = 0, receivedQty = 0, pendingQty = 0, unitPrice = 0, totalAmount = 0) {
    const autoBatchNo = Math.floor(10000000 + Math.random() * 90000000); // Auto-generate 8-digit batch number

    // Render loading indicator inside modal
    openLgModal('Create Goods Receipt Note (GRN)', `
        <div id="grnModalContentContainer">
            <div style="text-align:center;padding:30px;color:var(--text-muted);font-weight:500;">
                <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;animation:spin 1s linear infinite;">sync</span>
                Loading PO lines and parts details...
            </div>
        </div>
    `);

    let poDetails = null;
    if (poId) {
        try {
            const res = await fetch(API + '/po/' + poId, { headers: HEADERS });
            const json = await res.json();
            if (json.success) poDetails = json.data;
        } catch (e) {}
    }

    if (!poDetails) {
        poDetails = {
            id: poId,
            po_no: poNo,
            supplier_name: supplierName,
            po_status: 'sent_to_supplier',
            lines: [{
                item_code: itemCode,
                item_description: '',
                order_qty: orderQty,
                received_qty: receivedQty,
                pending_qty: pendingQty,
                unit_price: unitPrice,
                aml: []
            }]
        };
    }

    renderGrnForm(poDetails, autoBatchNo);
}

function renderGrnForm(po, autoBatchNo) {
    const container = document.getElementById('grnModalContentContainer');
    if (!container) return;

    container.innerHTML = `
        <div class="supplier-info-box" id="grnPoInfoBox" style="${po.id ? 'display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));' : 'display:none;'} margin-bottom:15px;">
            <div class="si-field"><label>PO Number</label><div class="val" id="grnPoNoDisplay">${po.po_no || ''}</div></div>
            <div class="si-field"><label>Supplier</label><div class="val" id="grnSupplierDisplay">${po.supplier_name || ''}</div></div>
            <div class="si-field"><label>Total Items</label><div class="val" id="grnItemsCountDisplay">${po.lines.length}</div></div>
            <div class="si-field"><label>PO Status</label><div class="val" id="grnPoStatusDisplay">${statusBadge(po.po_status)}</div></div>
        </div>

        <div class="form-group" id="poSelectGroup" style="${po.id ? 'display:none' : ''}">
            <label>Select Purchase Order *</label>
            <select id="grnPoSelect" onchange="onGrnPoChange(this)">
                <option value="">— Select PO —</option>
            </select>
        </div>
        <input type="hidden" id="grnPoId" value="${po.id || ''}">

        <div id="grnPartsTableContainer" style="${po.id ? 'display:block;' : 'display:none;'}">
            <div style="font-weight:600;font-size:13px;margin:10px 0 6px;">Received Parts Details</div>
            <div class="table-responsive" style="margin-bottom:15px;max-height:220px;overflow-y:auto;border:1px solid var(--border-color);border-radius:6px;">
                <table class="data-table" style="width:100%;font-size:12px;">
                    <thead>
                        <tr style="background:var(--bg-secondary);">
                            <th style="text-align:left;">Part Code</th>
                            <th style="text-align:left;">MPN / Make</th>
                            <th style="text-align:right;">Ordered</th>
                            <th style="text-align:right;">Pending</th>
                            <th style="text-align:right;width:90px;">Incoming Qty</th>
                            <th style="text-align:right;">PO Price</th>
                            <th style="text-align:right;width:110px;">Invoice Unit Price (₹)</th>
                            <th style="text-align:right;width:120px;">Invoice Line Cost (₹)</th>
                            <th style="text-align:center;">Status</th>
                        </tr>
                    </thead>
                    <tbody id="grnPartsTableBody">
                    </tbody>
                </table>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:10px;">
            <div class="form-group">
                <label>Invoice Number *</label>
                <input type="text" id="grnInvoiceNo" placeholder="INV-2026-001">
            </div>
            <div class="form-group">
                <label>Invoice Amount (₹)</label>
                <input type="number" id="grnInvoiceAmt" placeholder="0.00" min="0">
            </div>
            <div class="form-group">
                <label>Batch / Lot Number (Auto-Generated) *</label>
                <input type="text" id="grnBatchNo" value="${autoBatchNo}" readonly style="background:#f5f6fa; font-weight:bold; color:var(--text-color);">
            </div>
            <div class="form-group">
                <label>Supplier Lot / DC No</label>
                <input type="text" id="grnSupplierLot" placeholder="Supplier delivery challan no">
            </div>
            <div class="form-group" style="grid-column: span 2;">
                <label>Upload Invoice Document (PDF, Image) *</label>
                <input type="file" id="grnInvoiceFile" accept=".pdf,image/*" style="padding:6px; border:1px dashed var(--border-color); border-radius:6px; width:100%;">
            </div>
        </div>

        <div style="margin:16px 0 8px;font-weight:600;font-size:13px;">Physical Verification Checklist</div>
        <div style="background:var(--bg-main,#f5f6fa);border-radius:8px;padding:12px;">
            <div class="check-row">
                <input type="checkbox" id="chkPoMatch">
                <label for="chkPoMatch">PO document matches delivery — Part code, description, and supplier verified</label>
            </div>
            <div class="check-row">
                <input type="checkbox" id="chkInvoiceMatch">
                <label for="chkInvoiceMatch">Invoice matches PO — Invoice number, amount, and quantities verified</label>
            </div>
            <div class="check-row">
                <input type="checkbox" id="chkPhysicalCount">
                <label for="chkPhysicalCount">Physical count done — Goods counted and match received quantity</label>
            </div>
            <div class="check-row">
                <input type="checkbox" id="chkPackaging">
                <label for="chkPackaging">Packaging condition OK — No visible damage, correct labelling</label>
            </div>
            <div class="check-row">
                <input type="checkbox" id="chkBatchLabel">
                <label for="chkBatchLabel">Batch / Lot label present and legible on all packages</label>
            </div>
        </div>

        <div class="form-group" style="margin-top:14px;">
            <label>Discrepancy / Remarks</label>
            <textarea id="grnRemarks" rows="2" placeholder="Note any discrepancies, damages, or observations..."></textarea>
        </div>

        <!-- Total Material Cost Indicator -->
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--accent-light); border-radius:8px; padding:12px 18px; margin-top:14px; border:1px solid var(--border-color);">
            <strong style="color:var(--accent); font-size:14px;">Total Materials Cost Summary</strong>
            <span id="grnTotalMaterialsCost" style="color:var(--accent); font-size:18px; font-weight:800;">₹0.00</span>
        </div>

        <div class="form-actions" style="margin-top:16px;">
            <button class="btn-outline" onclick="closeLgModal()">Cancel</button>
            <button class="btn-primary" onclick="submitCreateGrn()">
                <span class="material-icons-outlined" style="font-size:16px;">save</span> Save GRN
            </button>
        </div>
    `;

    // Render items if already pre-selected
    if (po.id) {
        renderGrnPartsTable(po.lines);
    } else {
        _loadPoDropdown();
    }
}

function renderGrnPartsTable(lines) {
    const tbody = document.getElementById('grnPartsTableBody');
    if (!tbody) return;

    tbody.innerHTML = lines.map((l, index) => {
        const amlText = (l.aml || []).map(a => `${a.mpn} (${a.make})`).join(', ') || '—';
        return `
            <tr class="grn-part-row" data-code="${l.item_code}">
                <td><code>${l.item_code}</code></td>
                <td style="font-size:11px;color:var(--text-muted);">${amlText}</td>
                <td style="text-align:right;">${l.order_qty}</td>
                <td style="text-align:right;color:var(--coming-soon-text);font-weight:600;">${l.pending_qty}</td>
                <td>
                    <input type="number" class="grn-incoming-qty form-control" style="width:90px;padding:4px;text-align:right;border:1px solid var(--border-color);border-radius:4px;"
                        value="${l.pending_qty}" min="0"
                        data-code="${l.item_code}" data-desc="${l.item_description || ''}"
                        data-price="${l.unit_price}" data-pending="${l.pending_qty}"
                        data-mpn="${(l.aml && l.aml[0] && l.aml[0].mpn) || ''}"
                        data-make="${(l.aml && l.aml[0] && l.aml[0].make) || ''}"
                        oninput="calcMultiGrnCosts('qty')">
                </td>
                <td style="text-align:right;">₹${l.unit_price.toLocaleString()}</td>
                <td>
                    <input type="number" class="grn-incoming-unit-price form-control" style="width:110px;padding:4px;text-align:right;border:1px solid var(--border-color);border-radius:4px;"
                        value="${l.unit_price.toFixed(2)}" min="0" step="0.01"
                        oninput="calcMultiGrnCosts('unit_price')">
                </td>
                <td>
                    <input type="number" class="grn-incoming-cost form-control" style="width:110px;padding:4px;text-align:right;border:1px solid var(--border-color);border-radius:4px;"
                        value="${(l.pending_qty * l.unit_price).toFixed(2)}" min="0" step="0.01"
                        oninput="calcMultiGrnCosts('cost')">
                </td>
                <td style="text-align:center;">
                    <span class="match-status-badge ok-badge" style="background:var(--accent-light);color:var(--accent);border:1px solid var(--accent);border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">Matched</span>
                </td>
            </tr>
        `;
    }).join('');

    calcMultiGrnCosts();
}

function calcMultiGrnCosts(source) {
    let totalMaterialCost = 0;
    const rows = document.querySelectorAll('.grn-part-row');
    rows.forEach(row => {
        const qtyInput = row.querySelector('.grn-incoming-qty');
        const unitPriceInput = row.querySelector('.grn-incoming-unit-price');
        const costInput = row.querySelector('.grn-incoming-cost');
        if (!qtyInput || !unitPriceInput || !costInput) return;
        
        const poUnitPrice = parseFloat(qtyInput.dataset.price || 0);
        const qty = parseFloat(qtyInput.value || 0);
        
        let calcUnitPrice = parseFloat(unitPriceInput.value || 0);
        let lineCost = parseFloat(costInput.value || 0);

        if (source === 'qty' || source === 'unit_price') {
            // Update line cost based on qty and unit price
            lineCost = qty * calcUnitPrice;
            costInput.value = lineCost.toFixed(2);
        } else if (source === 'cost') {
            // Update unit price based on line cost and qty
            calcUnitPrice = qty > 0 ? (lineCost / qty) : 0;
            unitPriceInput.value = calcUnitPrice.toFixed(2);
        }

        totalMaterialCost += lineCost;

        const statusBadge = row.querySelector('.match-status-badge');
        if (statusBadge) {
            const diff = calcUnitPrice - poUnitPrice;
            if (Math.abs(diff) < 0.01) {
                statusBadge.textContent = 'Matched';
                statusBadge.style.background = 'var(--accent-light)';
                statusBadge.style.color = 'var(--accent)';
                statusBadge.style.border = '1px solid var(--accent)';
            } else {
                const diffSign = diff > 0 ? '+' : '';
                statusBadge.textContent = `Mismatch (${diffSign}₹${diff.toFixed(2)})`;
                statusBadge.style.background = 'var(--coming-soon-bg)';
                statusBadge.style.color = 'var(--coming-soon-text)';
                statusBadge.style.border = '1px solid var(--coming-soon-text)';
            }
        }
    });

    const totalDisplay = document.getElementById('grnTotalMaterialsCost');
    if (totalDisplay) {
        totalDisplay.textContent = '₹' + totalMaterialCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    }
    
    // Auto-update the main Invoice Amount input field
    const invoiceAmtInput = document.getElementById('grnInvoiceAmt');
    if (invoiceAmtInput) {
        invoiceAmtInput.value = totalMaterialCost.toFixed(2);
    }
}

async function _loadPoDropdown() {
    const sel = document.getElementById('grnPoSelect');
    if (!sel) return;
    try {
        const res = await fetch(API + '/pending-pos', { headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            sel.innerHTML = '<option value="">— Select PO —</option>' +
                json.data.map(p => `<option value="${p.id}">${p.po_no} — ${p.supplier_name} — ${p.item_code} (Pending: ${p.pending_qty})</option>`).join('');
        }
    } catch (e) {}
}

async function onGrnPoChange(sel) {
    const poId = sel.value;
    document.getElementById('grnPoId').value = poId;

    const infoBox = document.getElementById('grnPoInfoBox');
    const tableContainer = document.getElementById('grnPartsTableContainer');

    if (!poId) {
        if (infoBox) infoBox.style.display = 'none';
        if (tableContainer) tableContainer.style.display = 'none';
        return;
    }

    try {
        const res = await fetch(API + '/po/' + poId, { headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            const po = json.data;

            if (infoBox) {
                document.getElementById('grnPoNoDisplay').textContent = po.po_no || '';
                document.getElementById('grnSupplierDisplay').textContent = po.supplier_name || '';
                document.getElementById('grnItemsCountDisplay').textContent = po.lines.length;
                document.getElementById('grnPoStatusDisplay').innerHTML = statusBadge(po.po_status);
                infoBox.style.display = 'grid';
                infoBox.style.gridTemplateColumns = 'repeat(auto-fit, minmax(130px, 1fr))';
            }

            renderGrnPartsTable(po.lines);
            if (tableContainer) tableContainer.style.display = 'block';
        }
    } catch (e) {
        showToast('Error loading PO details', 'error');
    }
}

async function submitCreateGrn() {
    const poId       = document.getElementById('grnPoId').value.trim();
    const invoiceNo  = document.getElementById('grnInvoiceNo').value.trim();
    const batchNo    = document.getElementById('grnBatchNo').value.trim();
    const invAmt     = parseFloat(document.getElementById('grnInvoiceAmt').value || 0);
    const supplierLot = document.getElementById('grnSupplierLot').value.trim();
    const remarks    = document.getElementById('grnRemarks').value.trim();
    const fileInput  = document.getElementById('grnInvoiceFile');
    const file       = fileInput ? fileInput.files[0] : null;

    const checks = {
        po_match:       document.getElementById('chkPoMatch').checked,
        invoice_match:  document.getElementById('chkInvoiceMatch').checked,
        physical_count: document.getElementById('chkPhysicalCount').checked,
        packaging_ok:   document.getElementById('chkPackaging').checked,
        batch_label_ok: document.getElementById('chkBatchLabel').checked,
    };

    if (!poId)      { showToast('Select a Purchase Order', 'error'); return; }
    if (!invoiceNo) { showToast('Invoice number is required', 'error'); return; }
    if (!batchNo)   { showToast('Batch / Lot number is required', 'error'); return; }

    const lines = [];
    const rows = document.querySelectorAll('.grn-part-row');
    rows.forEach(row => {
        const qtyInput = row.querySelector('.grn-incoming-qty');
        const costInput = row.querySelector('.grn-incoming-cost');
        if (!qtyInput || !costInput) return;
        const code = qtyInput.dataset.code;
        const desc = qtyInput.dataset.desc;
        const price = parseFloat(qtyInput.dataset.price || 0);
        const qty = parseFloat(qtyInput.value || 0);
        const lineCost = parseFloat(costInput.value || 0);
        const mpn = qtyInput.dataset.mpn || '';
        const make = qtyInput.dataset.make || '';

        lines.push({
            item_code: code,
            item_description: desc,
            received_qty: qty,
            unit_price: price,
            calculated_unit_price: qty > 0 ? (lineCost / qty) : 0,
            total_amount: lineCost,
            mpn: mpn,
            make: make
        });
    });

    const totalReceivedQty = lines.reduce((acc, curr) => acc + curr.received_qty, 0);
    if (totalReceivedQty <= 0) {
        showToast('At least one item must have a received quantity > 0', 'error');
        return;
    }

    const failedChecks = Object.entries(checks).filter(([,v]) => !v).map(([k]) => k);

    const formData = new FormData();
    formData.append('po_id', poId);
    formData.append('invoice_no', invoiceNo);
    formData.append('batch_no', batchNo);
    formData.append('invoice_amount', invAmt);
    formData.append('supplier_lot', supplierLot);
    formData.append('remarks', remarks);
    formData.append('physical_checks', JSON.stringify(checks));
    formData.append('failed_checks', JSON.stringify(failedChecks));
    formData.append('lines', JSON.stringify(lines));
    if (file) {
        formData.append('file', file);
    }

    try {
        const res = await fetch(API + '/grn', {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || ''),
                'X-Tenant-ID': HEADERS['X-Tenant-ID'] || 'TEST'
            },
            body: formData
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message || 'GRN created successfully');
            closeLgModal();
            loadGrnList();
            loadLgOverview();
        } else {
            showToast(json.message || 'Failed to create GRN', 'error');
        }
    } catch (e) {
        showToast('Error creating GRN', 'error');
    }
}

async function openGrnDetail(grnId) {
    const modal = document.getElementById('grnDetailModal');
    const body  = document.getElementById('grnDetailBody');
    const title = document.getElementById('grnDetailTitle');
    body.innerHTML = '<div style="text-align:center;padding:30px;">Loading...</div>';
    modal.classList.add('active');

    try {
        const res = await fetch(API + '/grn/' + grnId, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { body.innerHTML = '<p style="color:red;">Failed to load GRN.</p>'; return; }
        const g = json.data;
        title.textContent = `GRN: ${g.grn_no}`;

        let dateStr = '—';
        if (g.created_at) {
            const d = new Date(g.created_at);
            dateStr = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        }

        const checks = g.physical_checks || {};
        const checkHtml = Object.entries({
            po_match: 'PO document verified', invoice_match: 'Invoice verified',
            physical_count: 'Physical count done', packaging_ok: 'Packaging OK',
            batch_label_ok: 'Batch label present'
        }).map(([k, label]) => `
            <div class="check-row">
                <span class="material-icons-outlined" style="color:${checks[k] ? 'var(--accent)' : 'var(--coming-soon-text)'};font-size:18px;">
                    ${checks[k] ? 'check_circle' : 'cancel'}
                </span>
                <label>${label}</label>
            </div>
        `).join('');

        let linesHtml = '';
        if (g.lines && g.lines.length > 0) {
            const rows = g.lines.map(l => `
                <tr>
                    <td><code>${l.item_code}</code></td>
                    <td>${l.item_description || '—'}</td>
                    <td style="text-align:right;font-weight:600;">${l.received_qty}</td>
                    <td style="text-align:right;">₹${(l.unit_price || 0).toLocaleString()}</td>
                    <td style="text-align:right;font-weight:600;">₹${(l.total_amount || 0).toLocaleString()}</td>
                </tr>
            `).join('');
            
            linesHtml = `
                <div style="font-weight:600;font-size:13px;margin:12px 0 6px;color:var(--text-primary);">Received Parts Breakdown</div>
                <div class="table-responsive" style="border:1px solid var(--border-color);border-radius:6px;margin-bottom:16px;max-height:180px;overflow-y:auto;">
                    <table class="data-table" style="width:100%;font-size:12px;">
                        <thead>
                            <tr>
                                <th style="text-align:left;">Part Code</th>
                                <th style="text-align:left;">Description</th>
                                <th style="text-align:right;">Received Qty</th>
                                <th style="text-align:right;">Unit Price</th>
                                <th style="text-align:right;">Total Amount</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }

        body.innerHTML = `
            <div class="supplier-info-box" style="grid-template-columns:1fr 1fr 1fr 1fr;">
                <div class="si-field"><label>PO Number</label><div class="val">${g.po_no || g.po_id}</div></div>
                <div class="si-field"><label>Supplier</label><div class="val">${g.supplier_name}</div></div>
                <div class="si-field"><label>Total Parts in GRN</label><div class="val">${(g.lines && g.lines.length) || 1}</div></div>
                <div class="si-field"><label>Status</label><div class="val">${statusBadge(g.grn_status)}</div></div>
            </div>
            <div class="detail-grid">
                <div class="detail-field"><label>Invoice No</label><div class="val">${g.invoice_no || '—'}</div></div>
                <div class="detail-field"><label>Invoice Amount</label><div class="val">₹${(g.invoice_amount||0).toLocaleString()}</div></div>
                <div class="detail-field"><label>Batch / Lot No</label><div class="val"><strong>${g.batch_no || '—'}</strong></div></div>
                <div class="detail-field"><label>Supplier Lot / DC</label><div class="val">${g.supplier_lot || '—'}</div></div>
                <div class="detail-field"><label>Total Received Qty</label><div class="val" style="font-weight:700;color:var(--accent);"><strong>${g.received_qty}</strong></div></div>
                <div class="detail-field"><label>Created By</label><div class="val">${g.created_by || 'system'}</div></div>
                <div class="detail-field"><label>Created At</label><div class="val">${dateStr}</div></div>
                <div class="detail-field"><label>Invoice Document</label><div class="val">
                    ${g.invoice_file_path ? `<a href="${g.invoice_file_path}" target="_blank" class="btn-outline" style="padding:2px 8px;font-size:11px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;"><span class="material-icons-outlined" style="font-size:12px;">download</span> View Invoice</a>` : '<span style="color:var(--text-muted);font-style:italic;">No file uploaded</span>'}
                </div></div>
            </div>
            ${linesHtml}
            ${g.discrepancy_notes ? `<div class="discrepancy-badge" style="margin-bottom:12px;display:inline-block;">⚠ Discrepancy: ${g.discrepancy_notes}</div>` : ''}
            ${g.remarks ? `<div style="margin-bottom:12px;font-size:13px;color:var(--text-muted);">Remarks: ${g.remarks}</div>` : ''}
            <div style="font-weight:600;font-size:13px;margin-bottom:8px;color:var(--text-primary);">Physical Verification Checklist</div>
            <div style="background:var(--bg-secondary);border-radius:8px;padding:12px;margin-bottom:16px;">${checkHtml}</div>
            ${g.grn_status === 'pending_iqc' ? `
            <div class="form-actions">
                <button class="btn-primary" onclick="closeGrnDetail();openHandoverFromGrn('${g.id}','${g.grn_no}','${g.item_code}',${g.received_qty},'${g.batch_no||''}')">
                    <span class="material-icons-outlined" style="font-size:16px;">move_to_inbox</span> Handover to Inventory
                </button>
            </div>` : `<div style="color:var(--text-muted);font-size:13px;">Status: ${g.grn_status} — no further action needed here.</div>`}
        `;
    } catch (e) {
        body.innerHTML = '<p style="color:red;">Error loading GRN detail.</p>';
    }
}
