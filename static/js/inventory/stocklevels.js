// STOCK LEVELS JS
async function loadStockLevels() {
    const search = document.getElementById('stockSearchInput')?.value || '';
    const tbody = document.getElementById('stockLevelsBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/stock-levels?search=' + encodeURIComponent(search), { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(item => {
                const pnum = (item.part_number || '').toString();
                const desc = (item.part_description || '').toString();
                const mpn = (item.mpn || '').toString();
                const mfr = (item.manufacturer || '').toString();
                const itype = (item.item_type || 'PART').toString();
                const wh = (item.warehouse_code || 'MAIN').toString();
                const bin = (item.bin_code || '-').toString();
                const qoh = item.qty_on_hand !== undefined && item.qty_on_hand !== null ? item.qty_on_hand : 0;
                const qres = item.qty_reserved !== undefined && item.qty_reserved !== null ? item.qty_reserved : 0;
                const qavail = item.qty_available !== undefined && item.qty_available !== null ? item.qty_available : 0;
                const unit = (item.unit || 'pcs').toString();
                const cost = item.unit_cost !== undefined && item.unit_cost !== null ? item.unit_cost : 0;
                const val = item.total_value !== undefined && item.total_value !== null ? item.total_value : (qoh * cost);
                const rp = item.reorder_point || 0;

                const mpnBadge = mpn ? `<span style="display:inline-block;background:#e0e7ff;color:#4338ca;padding:1px 6px;border-radius:4px;font-size:10px;font-family:monospace;margin-right:6px;font-weight:600;">MPN: ${mpn}</span>` : '';
                const mfrText = mfr ? `<span style="font-weight:600;color:var(--text-secondary, #4b5563);margin-right:6px;">${mfr}</span>` : '';

                return `
                    <tr style="cursor:pointer;" onclick="window.location.href='/inventory/stock-level/${item.id}'">
                        <td>
                            <strong>${pnum}</strong>
                            <div style="font-size:11px; margin-top:2px;">
                                ${mpnBadge}${mfrText}${desc ? `<span style="color:var(--text-muted);">${desc}</span>` : ''}
                            </div>
                        </td>
                        <td><span class="badge badge-info">${itype}</span></td>
                        <td>${wh} / <strong>${bin}</strong></td>
                        <td>${qoh} ${unit}</td>
                        <td>${qres}</td>
                        <td><strong style="color:${qavail <= rp ? '#c62828' : 'var(--text-primary)'}">${qavail}</strong></td>
                        <td>₹${cost}</td>
                        <td><strong>₹${Number(val).toLocaleString()}</strong></td>
                        <td onclick="event.stopPropagation()">
                            <button class="btn-action" title="View Stock Detail & Location Hierarchy" onclick="window.location.href='/inventory/stock-level/${item.id}'"><span class="material-icons-outlined">visibility</span></button>
                            <button class="btn-action" title="Transfer" onclick="quickTransfer('${pnum}', '${wh}', '${bin}')"><span class="material-icons-outlined">move_up</span></button>
                        </td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No stock levels found.</td></tr>';
        }
    } catch (e) {
        console.error(e);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center; color:red;">Error loading stock levels.</td></tr>';
    }
}

function openNewStockModal() {
    openModal('Add New Stock Record', `
        <div class="form-group">
            <label>Part Number</label>
            <input type="text" id="newPartNo" placeholder="e.g. 601-0-000001">
        </div>
        <div class="form-group">
            <label>Description</label>
            <input type="text" id="newPartDesc" placeholder="Part description">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Warehouse Code</label>
                <input type="text" id="newWh" value="MAIN">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Bin Code</label>
                <input type="text" id="newBin" value="A-01-01">
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Quantity On Hand</label>
                <input type="number" id="newQty" value="100">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Unit Cost (₹)</label>
                <input type="number" id="newCost" value="50">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewStock()">Save Stock</button>
        </div>
    `);
}

async function submitNewStock() {
    const payload = {
        part_number: document.getElementById('newPartNo').value,
        part_description: document.getElementById('newPartDesc').value,
        warehouse_code: document.getElementById('newWh').value,
        bin_code: document.getElementById('newBin').value,
        qty_on_hand: parseFloat(document.getElementById('newQty').value || 0),
        unit_cost: parseFloat(document.getElementById('newCost').value || 0)
    };

    try {
        const res = await fetch(API + '/stock-levels', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Stock record created');
            closeModal();
            loadStockLevels();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating stock record', 'error'); }
}

function quickTransfer(partNo, wh, bin) {
    showSection('transfers');
    document.getElementById('trfPartNumber').value = partNo;
    document.getElementById('trfFromWh').value = wh;
    document.getElementById('trfFromBin').value = bin;
}

// --- INVENTORY EXPORT ---

async function openInventoryExportModal() {
    // Populate category dropdown from stock data
    const catSel = document.getElementById('exportInvCategory');
    const whSel  = document.getElementById('exportInvWarehouse');
    catSel.innerHTML = '<option value="">All Categories</option>';
    whSel.innerHTML  = '<option value="">All Warehouses</option>';

    try {
        const res  = await fetch(API + '/stock-levels', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data) {
            const cats = new Map();   // prefix -> label
            const whs  = new Set();

            json.data.forEach(item => {
                const pn = item.part_number || '';
                const sep = pn.includes('.') ? '.' : '-';
                const prefix = pn.split(sep)[0];
                if (prefix && !cats.has(prefix)) cats.set(prefix, prefix);
                if (item.warehouse_code) whs.add(item.warehouse_code);
            });

            // Sort numerically
            [...cats.keys()].sort((a, b) => {
                const na = parseInt(a), nb = parseInt(b);
                return isNaN(na) || isNaN(nb) ? a.localeCompare(b) : na - nb;
            }).forEach(prefix => {
                const opt = document.createElement('option');
                opt.value = prefix;
                opt.textContent = `Category ${prefix}`;
                catSel.appendChild(opt);
            });

            [...whs].sort().forEach(wh => {
                const opt = document.createElement('option');
                opt.value = wh;
                opt.textContent = wh;
                whSel.appendChild(opt);
            });
        }
    } catch (e) { /* dropdowns stay as All */ }

    document.getElementById('inventoryExportModal').classList.add('active');
}

function doInventoryExportCsv() {
    const category  = document.getElementById('exportInvCategory').value;
    const warehouse = document.getElementById('exportInvWarehouse').value;

    let url = API + '/export-csv';
    const params = [];
    if (category)  params.push('category='  + encodeURIComponent(category));
    if (warehouse) params.push('warehouse=' + encodeURIComponent(warehouse));
    const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
    if (token) params.push('token=' + token);
    if (params.length) url += '?' + params.join('&');

    window.open(url, '_blank');
    closeModal('inventoryExportModal');
}
