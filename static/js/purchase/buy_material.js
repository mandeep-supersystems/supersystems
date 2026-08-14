// BUY MATERIAL WORKFLOW JS
let _buyMaterialData = []; // holds matched PRs with suppliers list

async function loadBuyMaterialSection() {
    const container = document.getElementById('buyMaterialContainer');
    if (!container) return;

    const ids = window._selectedPrIds || [];
    if (ids.length === 0) {
        container.innerHTML = `
            <div class="cpo-empty-state" style="padding:40px; text-align:center;">
                <span class="material-icons-outlined" style="font-size:48px; color:var(--text-muted); margin-bottom:12px;">shopping_bag</span>
                <h3>No items selected to buy</h3>
                <p style="color:var(--text-muted); margin-bottom:20px; font-size:14px;">Select materials from the Purchase Requests screen first.</p>
                <button class="btn-primary" onclick="showSection('pr-inbox')">Go to Purchase Requests</button>
            </div>
        `;
        return;
    }

    container.innerHTML = '<div style="text-align:center; padding:30px; font-weight:600; color:var(--text-muted);">Matching suppliers for selected parts...</div>';

    try {
        const res = await fetch(API + '/buy-material/match-suppliers', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ pr_ids: ids })
        });
        const json = await res.json();
        if (!json.success) {
            container.innerHTML = `<div class="error-box" style="padding:20px; color:red; font-weight:600;">Error: ${json.message}</div>`;
            return;
        }

        _buyMaterialData = json.data;
        renderBuyMaterialForm();
    } catch (e) {
        container.innerHTML = `<div class="error-box" style="padding:20px; color:red; font-weight:600;">Error connecting to supplier matching engine.</div>`;
    }
}

function renderBuyMaterialForm() {
    const container = document.getElementById('buyMaterialContainer');
    if (!container) return;

    if (_buyMaterialData.length === 0) {
        container.innerHTML = '<div style="padding:20px; text-align:center; color:var(--text-muted);">No parts matches found.</div>';
        return;
    }

    let html = `
        <div style="display:flex; flex-direction:column; gap:20px;">
            <div style="background:var(--bg-secondary); padding:12px 16px; border-radius:6px; font-size:13px; font-weight:600; color:var(--text-main); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                <span>Total Items to Process: <strong>${_buyMaterialData.length}</strong></span>
                <div style="display:flex; gap:10px; align-items:center;">
                    <button class="btn-outline btn-sm" onclick="showSection('pr-inbox')"><span class="material-icons-outlined" style="font-size:14px;">arrow_back</span> Add/Remove Items</button>
                    <button class="btn-primary btn-sm" id="btnSubmitGeneratePosTop" onclick="submitGeneratePos()"><span class="material-icons-outlined" style="font-size:14px;">shopping_bag</span> Generate POs</button>
                </div>
            </div>

            <!-- Bulk Actions Panel -->
            <div style="background:var(--bg-secondary); padding:15px; border-radius:6px; border:1px solid var(--border-color); display:flex; gap:15px; align-items:center; flex-wrap:wrap; font-size:13px; margin-top:-10px;">
                <div style="font-weight:600; color:var(--text-main);">Bulk Actions:</div>
                <button class="btn-outline btn-sm" onclick="autoSelectCheapestSupplierForAll()" style="display:flex; align-items:center; gap:4px; padding:6px 12px; cursor:pointer;">
                    <span class="material-icons-outlined" style="font-size:14px;">monetization_on</span> Select Cheapest Supplier for All
                </button>
                <div style="display:flex; align-items:center; gap:6px; margin-left:auto;">
                    <label style="font-weight:500;">Set Promised Date for All:</label>
                    <input type="date" id="bulkPromisedDate" style="padding:5px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; background:var(--bg-main);">
                    <button class="btn-outline btn-sm" onclick="applyBulkPromisedDate()" style="padding:6px 12px; cursor:pointer;">Apply</button>
                </div>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:16px;">
    `;

    _buyMaterialData.forEach((item, index) => {
        // Pre-select best supplier (cheapest per unit price based on required quantity)
        let selectedSupId = '';
        if (item.suppliers && item.suppliers.length > 0) {
            const qty = item.required_qty;
            const sorted = [...item.suppliers].sort((a, b) => {
                const unitPriceA = (qty >= a.moq) ? (a.moq_price / a.moq) : (a.spq_price / a.spq);
                const unitPriceB = (qty >= b.moq) ? (b.moq_price / b.moq) : (b.spq_price / b.spq);
                return unitPriceA - unitPriceB;
            });
            selectedSupId = sorted[0].supplier_id;
        }

        // Render AML chips — one pair per entry
        const validAml = (item.aml || []).filter(m => m.mpn && m.mpn.trim() && m.make && m.make.trim());
        const amlText = validAml.length > 0
            ? validAml.map(m => `<span class="aml-chip-group">
                <span class="aml-chip aml-chip-mpn"><span class="aml-chip-label">MPN</span>${m.mpn}</span>
                <span class="aml-chip aml-chip-make"><span class="aml-chip-label">Make</span>${m.make}</span>
              </span>`).join('')
            : '<span class="aml-chip-empty">No AML defined</span>';

        html += `
            <div class="card buy-material-row-card" data-index="${index}" style="border: 1px solid var(--border-color); padding:16px 20px; position:relative; overflow:visible;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:16px; margin-bottom:12px;">
                    <div>
                        <div style="font-size:11px; color:var(--text-muted); font-weight:600; margin-bottom:2px;">${item.pr_no} ${item.plan_no ? `&bull; Plan: ${item.plan_no}` : ''}</div>
                        <h4 style="margin:0; font-size:16px; color:#1976d2;"><code>${item.item_code}</code></h4>
                        <div style="font-size:13px; color:var(--text-main); margin-top:2px;">${item.item_description}</div>
                    </div>
                    <div>
                        ${amlText}
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; align-items:flex-end;">
                    <!-- Supplier Selection -->
                    <div class="form-group" style="margin:0;">
                        <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Select Supplier *</label>
                        <select class="buy-supplier-select" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); width:100%; font-size:13px;" onchange="onBuySupplierChange(${index}, this.value)">
                            ${item.suppliers && item.suppliers.length > 0 ? '' : '<option value="">-- No Matching Suppliers Found --</option>'}
                            ${item.suppliers.map(s => {
                                const unitPriceMoq = s.moq_price / s.moq;
                                const unitPriceSpq = s.spq_price / s.spq;
                                return `
                                    <option value="${s.supplier_id}" ${s.supplier_id === selectedSupId ? 'selected' : ''}>
                                        ${s.brand_name} (${s.supplier_code}) &bull; MOQ Unit Price: ₹${unitPriceMoq.toFixed(2)} (>= ${s.moq}) | Sample Unit Price: ₹${unitPriceSpq.toFixed(2)} (< ${s.moq})
                                    </option>
                                `;
                            }).join('')}
                            <option value="custom">-- Custom/Unregistered Supplier --</option>
                        </select>
                    </div>

                    <!-- Custom Supplier Search (visible only if custom chosen) -->
                    <div class="form-group custom-supplier-group" id="custom-sup-gp-${index}" style="margin:0; display:none; position:relative;">
                        <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Search Custom Supplier *</label>
                        <input type="text" class="custom-sup-search" placeholder="Search supplier..." oninput="searchSuppliersInPurchase(this.value, 'buy-sup-res-${index}', 'buy-sup-id-${index}', 'buy-sup-sel-${index}', 'buy-sup-lbl-${index}')" autocomplete="off" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); width:100%; font-size:13px;">
                        <div id="buy-sup-res-${index}" style="position:absolute; left:0; right:0; z-index:100; border:1px solid var(--border-color); border-radius:6px; max-height:150px; overflow-y:auto; background:var(--card-bg,#fff);"></div>
                        
                        <div id="buy-sup-sel-${index}" style="display:none; align-items:center; gap:8px; margin-top:6px; padding:6px 10px; background:var(--bg-main,#f5f6fa); border-radius:6px;">
                            <span id="buy-sup-lbl-${index}" style="font-size:12px; font-weight:500;"></span>
                            <button type="button" onclick="clearCustomSupplier(${index})" style="margin-left:auto; background:none; border:none; cursor:pointer;"><span class="material-icons-outlined" style="font-size:15px;">close</span></button>
                        </div>
                        <input type="hidden" class="buy-custom-supplier-id" id="buy-sup-id-${index}">
                    </div>

                    <!-- Qty & Unit Price -->
                    <div style="display:flex; gap:10px; flex:1;">
                        <div class="form-group" style="margin:0; flex:1;">
                            <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Order Qty</label>
                            <input type="number" class="buy-qty-input" value="${item.required_qty}" min="0.01" step="any" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); width:100%; font-size:13px;" oninput="onBuyQuantityChange(${index})">
                        </div>
                        <div class="form-group" style="margin:0; flex:1;">
                            <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Price (₹)</label>
                            <input type="number" class="buy-price-input" value="0" min="0.01" step="any" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); width:100%; font-size:13px;" oninput="updateBuySummary()">
                        </div>
                    </div>

                    <!-- Promised Date & Notes -->
                    <div style="display:flex; gap:10px; flex:1;">
                        <div class="form-group" style="margin:0; flex:1;">
                            <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Promised Date</label>
                            <input type="date" class="buy-date-input" value="${item.required_date || ''}" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); width:100%; font-size:13px;">
                        </div>
                        <div class="form-group" style="margin:0; flex:1;">
                            <label style="font-size:11px; font-weight:700; text-transform:uppercase;">Notes</label>
                            <input type="text" class="buy-notes-input" placeholder="PO Notes" style="padding:8px 10px; border-radius:6px; border:1px solid var(--border-color); width:100%; font-size:13px;">
                        </div>
                    </div>
                </div>
            </div>
        `;
    });

    html += `
            </div>
            
            <!-- Summary Grouping & Suggestions -->
            <div class="card" style="border: 1px solid var(--border-color); padding:20px; background:var(--bg-main);">
                <h3 style="margin:0 0 12px 0; font-size:16px;">PO Generation Summary</h3>
                <div id="buyGroupingSummary" style="font-size:13px; color:var(--text-main); margin-bottom:16px; line-height:1.6;">
                    Loading suggestions...
                </div>
                
                <div style="display:flex; justify-content:flex-end; gap:12px;">
                    <button class="btn-secondary" onclick="showSection('pr-inbox')">Cancel</button>
                    <button class="btn-primary" id="btnSubmitGeneratePos" onclick="submitGeneratePos()"><span class="material-icons-outlined">shopping_bag</span> Generate POs</button>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;

    // Trigger initial setting for unit prices based on matched suppliers
    _buyMaterialData.forEach((item, index) => {
        onBuySupplierChange(index, '');
    });
}

function onBuySupplierChange(index, value) {
    const card = document.querySelector(`.buy-material-row-card[data-index="${index}"]`);
    if (!card) return;

    const select = card.querySelector('.buy-supplier-select');
    const val = value || select.value;
    
    const customGrp = card.querySelector('.custom-supplier-group');
    const priceInput = card.querySelector('.buy-price-input');
    const qtyInput = card.querySelector('.buy-qty-input');
    
    const item = _buyMaterialData[index];

    if (val === 'custom') {
        if (customGrp) customGrp.style.display = 'block';
        priceInput.value = '0';
    } else {
        if (customGrp) customGrp.style.display = 'none';
        
        // Find supplier price based on quantity vs MOQ check
        const supplier = item.suppliers.find(s => s.supplier_id === val);
        if (supplier) {
            const qty = parseFloat(qtyInput.value) || 0;
            const unitPrice = (qty >= supplier.moq) 
                ? (supplier.moq_price / supplier.moq) 
                : (supplier.spq_price / supplier.spq);
            priceInput.value = unitPrice.toFixed(2);
        } else {
            priceInput.value = '0';
        }
    }
    
    updateBuySummary();
}

function onBuyQuantityChange(index) {
    const card = document.querySelector(`.buy-material-row-card[data-index="${index}"]`);
    if (!card) return;

    const select = card.querySelector('.buy-supplier-select');
    const val = select.value;
    const qtyInput = card.querySelector('.buy-qty-input');
    const priceInput = card.querySelector('.buy-price-input');
    
    if (val !== 'custom') {
        const item = _buyMaterialData[index];
        const supplier = item.suppliers.find(s => s.supplier_id === val);
        if (supplier) {
            const qty = parseFloat(qtyInput.value) || 0;
            const unitPrice = (qty >= supplier.moq) 
                ? (supplier.moq_price / supplier.moq) 
                : (supplier.spq_price / supplier.spq);
            priceInput.value = unitPrice.toFixed(2);
        }
    }
    
    updateBuySummary();
}

function clearCustomSupplier(index) {
    const card = document.querySelector(`.buy-material-row-card[data-index="${index}"]`);
    if (!card) return;
    
    card.querySelector('.buy-custom-supplier-id').value = '';
    card.querySelector('.buy-sup-lbl-' + index).textContent = '';
    card.querySelector('#buy-sup-sel-' + index).style.display = 'none';
    card.querySelector('.custom-sup-search').value = '';
    card.querySelector('.custom-sup-search').focus();
    updateBuySummary();
}

function updateBuySummary() {
    const summaryDiv = document.getElementById('buyGroupingSummary');
    if (!summaryDiv) return;

    const cards = document.querySelectorAll('.buy-material-row-card');
    const groupings = {}; // supplierId -> {name, items: []}

    let allAssigned = true;
    let totalAmt = 0;

    cards.forEach(card => {
        const index = parseInt(card.getAttribute('data-index'));
        const item = _buyMaterialData[index];

        const selectVal = card.querySelector('.buy-supplier-select').value;
        const qty = parseFloat(card.querySelector('.buy-qty-input').value) || 0;
        const price = parseFloat(card.querySelector('.buy-price-input').value) || 0;
        
        let supplierId = '';
        let supplierName = '';

        if (selectVal === 'custom') {
            supplierId = card.querySelector('.buy-custom-supplier-id').value;
            const labelEl = card.querySelector(`#buy-sup-lbl-${index}`);
            supplierName = labelEl ? labelEl.textContent : '';
            if (!supplierId || !supplierName) {
                allAssigned = false;
                supplierName = 'Custom Unregistered (Not Selected)';
            }
        } else if (selectVal) {
            supplierId = selectVal;
            const supplier = item.suppliers.find(s => s.supplier_id === selectVal);
            supplierName = supplier ? supplier.brand_name : 'Unknown';
        } else {
            allAssigned = false;
            supplierName = 'No Supplier Assigned';
        }

        const cost = qty * price;
        totalAmt += cost;

        const supKey = supplierId || `unassigned-${index}`;
        if (!groupings[supKey]) {
            groupings[supKey] = {
                name: supplierName,
                isUnassigned: !supplierId,
                total: 0,
                linesCount: 0
            };
        }

        groupings[supKey].total += cost;
        groupings[supKey].linesCount += 1;
    });

    // Generate output summary list
    let summaryHtml = '<ul style="margin:0; padding-left:20px; margin-bottom:12px;">';
    let poCount = 0;
    
    for (const key in groupings) {
        const gp = groupings[key];
        if (gp.isUnassigned) {
            summaryHtml += `<li style="color:#d32f2f;"><strong>${gp.linesCount} item(s)</strong> have no supplier selected or completed.</li>`;
        } else {
            poCount++;
            summaryHtml += `<li>Will generate <strong>1 PO</strong> for <strong>${gp.name}</strong> containing <strong>${gp.linesCount} item(s)</strong>. Total: <strong>₹${gp.total.toLocaleString()}</strong></li>`;
        }
    }
    summaryHtml += '</ul>';

    if (poCount > 0) {
        summaryHtml += `<div style="font-weight:600; font-size:14px; margin-top:8px;">Total estimated buy value across ${poCount} POs: <span style="color:#2e7d32;">₹${totalAmt.toLocaleString()}</span></div>`;
    }

    summaryDiv.innerHTML = summaryHtml;

    // Enable/disable submit buttons
    const isDisabled = !allAssigned || totalAmt <= 0;
    const submitBtn = document.getElementById('btnSubmitGeneratePos');
    if (submitBtn) {
        submitBtn.disabled = isDisabled;
    }
    const submitBtnTop = document.getElementById('btnSubmitGeneratePosTop');
    if (submitBtnTop) {
        submitBtnTop.disabled = isDisabled;
    }
}

async function submitGeneratePos() {
    const cards = document.querySelectorAll('.buy-material-row-card');
    const assignments = [];

    let hasError = false;

    cards.forEach(card => {
        const index = parseInt(card.getAttribute('data-index'));
        const item = _buyMaterialData[index];

        const selectVal = card.querySelector('.buy-supplier-select').value;
        const qty = parseFloat(card.querySelector('.buy-qty-input').value) || 0;
        const price = parseFloat(card.querySelector('.buy-price-input').value) || 0;
        const date = card.querySelector('.buy-date-input').value || null;
        const notes = card.querySelector('.buy-notes-input').value.trim();
        
        let supplierId = '';

        if (selectVal === 'custom') {
            supplierId = card.querySelector('.buy-custom-supplier-id').value;
        } else {
            supplierId = selectVal;
        }

        if (!supplierId) {
            hasError = true;
            card.style.borderColor = '#d32f2f';
        } else {
            card.style.borderColor = 'var(--border-color)';
        }

        assignments.push({
            pr_id: item.pr_id,
            item_code: item.item_code,
            item_description: item.item_description,
            order_qty: qty,
            unit_price: price,
            promised_date: date,
            notes: notes,
            supplier_id: supplierId,
            aml: (item.aml || []).filter(m => m.mpn && m.mpn.trim() && m.make && m.make.trim())
        });
    });

    if (hasError) {
        showToast('Please specify a supplier for all material lines.', 'error');
        return;
    }

    const btn = document.getElementById('btnSubmitGeneratePos');
    const btnTop = document.getElementById('btnSubmitGeneratePosTop');
    
    const setButtonsLoading = (loading) => {
        if (btn) {
            btn.disabled = loading;
            btn.innerHTML = loading ? 'Generating Purchase Orders...' : '<span class="material-icons-outlined">shopping_bag</span> Generate POs';
        }
        if (btnTop) {
            btnTop.disabled = loading;
            btnTop.innerHTML = loading ? 'Generating POs...' : '<span class="material-icons-outlined" style="font-size:14px;">shopping_bag</span> Generate POs';
        }
    };

    setButtonsLoading(true);

    try {
        const res = await fetch(API + '/buy-material/generate-pos', {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ assignments })
        });
        const json = await res.json();
        
        if (json.success) {
            showToast(json.message);
            window._selectedPrIds = []; // reset selection
            showSection('orders'); // show Supplier POs list
        } else {
            showToast(json.message || 'Failed to generate POs', 'error');
            setButtonsLoading(false);
        }
    } catch (e) {
        showToast('Error generating POs', 'error');
        setButtonsLoading(false);
    }
}

function autoSelectCheapestSupplierForAll() {
    _buyMaterialData.forEach((item, index) => {
        const card = document.querySelector(`.buy-material-row-card[data-index="${index}"]`);
        if (!card) return;
        const select = card.querySelector('.buy-supplier-select');
        const qtyInput = card.querySelector('.buy-qty-input');
        const qty = parseFloat(qtyInput.value) || 0;
        
        if (item.suppliers && item.suppliers.length > 0) {
            const sorted = [...item.suppliers].sort((a, b) => {
                const priceA = (qty >= a.moq) ? a.moq_price : a.spq_price;
                const priceB = (qty >= b.moq) ? b.moq_price : b.spq_price;
                return priceA - priceB;
            });
            select.value = sorted[0].supplier_id;
            onBuySupplierChange(index, sorted[0].supplier_id);
        }
    });
    showToast('Cheapest supplier selected for all items based on order quantity');
}

function applyBulkPromisedDate() {
    const val = document.getElementById('bulkPromisedDate').value;
    if (!val) {
        showToast('Please select a date first', 'error');
        return;
    }
    document.querySelectorAll('.buy-date-input').forEach(input => {
        input.value = val;
    });
    showToast('Promised date applied to all items');
}
