// ─── MANUFACTURING BOM CONTROLLER JS ───

// Global State
let currentBomId = null;
let currentSelectedItemId = null; // null represents the root BOM node
let editMode = false;
let bomData = null;
let activeBomTab = 'structure';
let partSearchTimer = null;
let expandedNodeIds = new Set();

// ─── SINGLE CLEAN LIST LOADER ───

async function loadAssemblyBomList() {
    const tbody = document.getElementById('bomAssemblyListBody');
    try {
        const res = await fetch(API + '/assembly-boms-list', { headers: HEADERS });
        const json = await res.json();
        
        if (json && json.length > 0) {
            tbody.innerHTML = json.map((a, idx) => {
                const statusHtml = a.has_bom
                    ? `<span class="badge ${a.status === 'Released' || a.status === 'active' ? 'badge-status-released' : 'badge-status-draft'}">${a.status}</span>`
                    : `<span style="font-size:11px; color:var(--text-secondary);">No BOM</span>`;
                const verHtml = a.version
                    ? `<span class="badge" style="background:#e0e7ff; color:#4f46e5; font-weight:700;">${a.version}</span>`
                    : `<span style="font-size:11px; color:var(--text-secondary);">—</span>`;
                const actionHtml = a.has_bom
                    ? `<button class="btn-outline" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); navigateToBomDetailByPart('${a.part_code}')">Open BOM →</button>`
                    : `<button class="btn-primary" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); openNewBomModal('${a.part_code}', '${(a.description || '').replace(/'/g, "\\'")}')">+ Create BOM</button>`;
                
                const desc = a.description || '—';
                const descShort = desc.length > 60 ? desc.substring(0, 60) + '…' : desc;
                
                return `
                    <tr style="cursor:pointer;" onclick="${a.has_bom ? `navigateToBomDetailByPart('${a.part_code}')` : `openNewBomModal('${a.part_code}', '${(a.description || '').replace(/'/g, "\\'")}')`}">
                        <td style="color:var(--text-secondary);font-size:12px;">${idx + 1}</td>
                        <td><code style="font-size:12px;font-weight:700;background:var(--bg-secondary);padding:2px 6px;border-radius:4px;color:var(--accent);">${a.part_code}</code></td>
                        <td style="max-width:320px;" title="${desc}">${descShort}</td>
                        <td>${verHtml}</td>
                        <td>${statusHtml}</td>
                        <td style="text-align:center;"><span class="badge" style="background:#e0e7ff; color:#4f46e5; font-weight:700;">${a.has_bom ? a.item_count : '—'}</span></td>
                        <td>${actionHtml}</td>
                    </tr>
                `;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">No assemblies found in Part Master.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading assemblies list.</td></tr>';
    }
}

// ─── CREATE FLOW ───

function openNewBomModal(preFilledPartCode = '', preFilledDesc = '') {
    const isPreFilled = preFilledPartCode !== '';
    
    openModal('Create Bill of Materials (BOM)', `
        <div class="form-group" id="abiPartSearchGroup" style="display: ${isPreFilled ? 'none' : 'block'};">
            <label>Search Assembly Part *</label>
            <input type="text" id="bomFgSearch" placeholder="Search category 'Assembly' parts..." oninput="searchAssembliesAutocomplete(this.value)" autocomplete="off">
            <input type="hidden" id="bomFgPart" value="${preFilledPartCode}">
            <div id="bomFgSearchResults" class="emp-search-results"></div>
        </div>
        
        <div class="form-group" id="abiPartSelectedState" style="display: ${isPreFilled ? 'block' : 'none'};">
            <label>Assembly Part Code</label>
            <div class="emp-selected-inline">
                <span id="bomFgSelLabel"><strong>${preFilledPartCode}</strong> ${preFilledDesc ? '— ' + preFilledDesc : ''}</span>
                ${isPreFilled ? '' : '<button type="button" class="btn-icon" onclick="clearCreateBomPart()"><span class="material-icons-outlined">close</span></button>'}
            </div>
        </div>

        <div class="form-group" style="margin-top: 10px;">
            <label>BOM Name / Description *</label>
            <input type="text" id="bomName" value="${preFilledDesc || ''}" placeholder="Engine Assembly Base">
        </div>
        <div class="form-group">
            <label>Yield Qty</label>
            <input type="number" id="bomYield" value="1" style="width:100%;">
        </div>
        <div class="form-group">
            <label>UOM / Unit</label>
            <input type="text" id="bomUnit" value="pcs" style="width:100%;">
        </div>
        <div class="form-group">
            <label>Notes</label>
            <textarea id="bomNotes" style="width:100%; min-height:60px; padding:8px; border:1px solid var(--border-color); border-radius:4px; outline:none; font-family:inherit;"></textarea>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewBom()">Save & Edit BOM</button>
        </div>
    `);
}

function searchAssembliesAutocomplete(q) {
    clearTimeout(partSearchTimer);
    const resultsDiv = document.getElementById('bomFgSearchResults');
    if (!q || q.trim().length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    partSearchTimer = setTimeout(async () => {
        try {
            const res = await fetch(API + `/search-assemblies?q=${encodeURIComponent(q)}`, { headers: HEADERS });
            const json = await res.json();
            if (json.success && json.data.length > 0) {
                resultsDiv.innerHTML = json.data.map(p => `
                    <div class="search-result-item" onclick="pickCreateBomPart('${p.part_number}', '${(p.description || '').replace(/'/g, "\\'")}')">
                        <strong>${p.part_number}</strong> — ${p.description || ''}
                    </div>
                `).join('');
            } else {
                resultsDiv.innerHTML = '<div style="padding:8px; font-size:12px; color:var(--text-secondary);">No matching assembly parts found.</div>';
            }
        } catch (e) {
            resultsDiv.innerHTML = '<div style="padding:8px; font-size:12px; color:red;">Error searching assembly parts.</div>';
        }
    }, 300);
}

function pickCreateBomPart(partNumber, desc) {
    document.getElementById('bomFgPart').value = partNumber;
    document.getElementById('bomName').value = desc;
    document.getElementById('abiPartSearchGroup').style.display = 'none';
    document.getElementById('bomFgSearchResults').innerHTML = '';
    
    const selectedState = document.getElementById('abiPartSelectedState');
    document.getElementById('bomFgSelLabel').innerHTML = `<strong>${partNumber}</strong> — ${desc}`;
    selectedState.style.display = 'block';
}

function clearCreateBomPart() {
    document.getElementById('bomFgPart').value = '';
    document.getElementById('bomName').value = '';
    document.getElementById('abiPartSearchGroup').style.display = 'block';
    document.getElementById('bomFgSearch').value = '';
    document.getElementById('abiPartSelectedState').style.display = 'none';
    document.getElementById('bomFgSearchResults').innerHTML = '';
}

async function submitNewBom() {
    let fgPart = document.getElementById('bomFgPart').value.trim();
    let name = document.getElementById('bomName').value.trim();
    if (!fgPart) { showToast('Finished Good part number required', 'error'); return; }
    if (!name) { showToast('BOM Name/Description required', 'error'); return; }
    
    const payload = {
        fg_part_number: fgPart,
        name: name,
        yield_qty: parseFloat(document.getElementById('bomYield').value || 1),
        unit: document.getElementById('bomUnit').value || 'pcs',
        notes: document.getElementById('bomNotes').value || ''
    };
    try {
        const res = await fetch(API + '/boms', { method: 'POST', headers: HEADERS, body: JSON.stringify(payload) });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            location.hash = '#bom#' + fgPart;
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating BOM', 'error'); }
}

// ─── NAVIGATE & INLINE DETAIL TOGGLING ───

function navigateToBomDetail(bomId) {
    currentBomId = bomId;
    currentSelectedItemId = null;
    editMode = false;
    activeBomTab = 'structure';
    
    document.getElementById('bomListPanel').style.display = 'none';
    document.getElementById('bomDetailPanel').style.display = 'block';
    
    document.querySelectorAll('.bom-tabbar .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-btn-structure').classList.add('active');
    
    loadBomDetail(currentBomId);
}

function navigateToBomDetailByPart(partCode) {
    location.hash = '#bom#' + partCode;
}

async function loadBomDetailByPart(partCode, version = '') {
    try {
        let url = API + `/boms/by-part/${partCode}`;
        if (version) url += `?version=${version}`;
        
        const res = await fetch(url, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { showToast(json.message, 'error'); return; }
        
        bomData = json.data;
        currentBomId = bomData.id;
        currentSelectedItemId = null;
        editMode = false;
        
        document.getElementById('bomListPanel').style.display = 'none';
        document.getElementById('bomDetailPanel').style.display = 'block';
        
        document.getElementById('detBomTitle').innerText = bomData.name || bomData.bom_no;
        document.getElementById('detBomNo').innerText = bomData.fg_part_number;
        document.getElementById('detBomVersion').innerText = bomData.current_version;
        document.getElementById('detBomStatus').innerText = bomData.status;
        
        const statusBadge = document.getElementById('detBomStatus');
        if (bomData.status === 'Released' || bomData.status === 'active') {
            statusBadge.className = 'badge badge-status-released';
        } else {
            statusBadge.className = 'badge badge-status-draft';
        }
        
        renderStructureTree();
        refreshActiveTab();
    } catch (e) {
        console.error("Error loading BOM details by part:", e);
        showToast('Error loading BOM details: ' + e.message, 'error');
    }
}

function closeBomDetail() {
    currentBomId = null;
    currentSelectedItemId = null;
    editMode = false;
    
    location.hash = '#bom';
}

async function loadBomDetail(bomId, version = '') {
    try {
        let url = API + `/boms/${bomId}`;
        if (version) url += `?version=${version}`;
        
        const res = await fetch(url, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { showToast(json.message, 'error'); return; }
        
        bomData = json.data;
        
        document.getElementById('detBomTitle').innerText = bomData.name || bomData.bom_no;
        document.getElementById('detBomNo').innerText = bomData.fg_part_number;
        document.getElementById('detBomVersion').innerText = bomData.current_version;
        document.getElementById('detBomStatus').innerText = bomData.status;
        
        const statusBadge = document.getElementById('detBomStatus');
        if (bomData.status === 'Released' || bomData.status === 'active') {
            statusBadge.className = 'badge badge-status-released';
        } else {
            statusBadge.className = 'badge badge-status-draft';
        }
        
        renderStructureTree();
        refreshActiveTab();
    } catch (e) {
        console.error("Error loading BOM details:", e);
        showToast('Error loading BOM details: ' + e.message, 'error');
    }
}

// ─── TABS MANAGEMENT ───

function switchBomTab(tabName) {
    activeBomTab = tabName;
    document.querySelectorAll('.bom-tabbar .tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`tab-btn-${tabName}`).classList.add('active');
    
    document.querySelectorAll('.bom-pane-content').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.bom-pane-content').forEach(p => p.style.display = 'none');
    
    const targetPane = document.getElementById(`pane-${tabName}`);
    if (targetPane) {
        targetPane.classList.add('active');
        targetPane.style.display = 'block';
    }
    
    refreshActiveTab();
}

function refreshActiveTab() {
    if (!bomData) return;
    
    if (activeBomTab === 'structure') {
        renderStructureGrid();
        renderToolbars();
    } else if (activeBomTab === 'costing') {
        loadCostingTab();
    } else if (activeBomTab === 'files') {
        loadFilesTab();
    } else if (activeBomTab === 'versions') {
        loadVersionsTab();
    } else if (activeBomTab === 'history') {
        loadHistoryTab();
    }
}

function renderToolbars() {
    const roToolbar = document.getElementById('toolbar-readonly');
    const editToolbar = document.getElementById('toolbar-edit');
    
    if (editMode) {
        roToolbar.style.display = 'none';
        editToolbar.style.display = 'flex';
    } else {
        roToolbar.style.display = 'flex';
        editToolbar.style.display = 'none';
        
        const startEditBtn = document.getElementById('btnStartEditBom');
        const releaseBtn = document.getElementById('btnReleaseBom');
        if (bomData.status === 'Released' || bomData.status === 'active') {
            startEditBtn.innerHTML = '<span class="material-icons-outlined" style="font-size:16px;">edit</span> New Version';
            releaseBtn.style.display = 'none';
        } else {
            startEditBtn.innerHTML = '<span class="material-icons-outlined" style="font-size:16px;">edit</span> Edit BOM';
            releaseBtn.style.display = 'inline-block';
        }
    }
}

// ─── TREE VISUALIZATION ───

function renderStructureTree() {
    const treeContainer = document.getElementById('bomTreeContainer');
    
    let html = `
        <div class="tree-node-item">
            <div class="tree-node-row ${currentSelectedItemId === null ? 'active' : ''}" onclick="selectTreeNode(null)">
                <span class="material-icons-outlined tree-node-icon" style="color:var(--accent);">precision_manufacturing</span>
                <span class="tree-node-label" title="${bomData.fg_part_number}"><strong>${bomData.fg_part_number}</strong> (Root)</span>
            </div>
        </div>
    `;
    
    const assemblies = bomData.items.filter(i => i.child_type === 'assembly');
    
    const buildTreeNodes = (parentId, indent) => {
        let nodeHtml = '';
        const children = assemblies.filter(a => a.parent_item_id === parentId);
        
        children.forEach(child => {
            const hasKids = assemblies.some(a => a.parent_item_id === child.id);
            const isExpanded = expandedNodeIds.has(child.id);
            
            nodeHtml += `
                <div class="tree-node-item" id="node-item-${child.id}">
                    <div class="tree-node-row ${currentSelectedItemId === child.id ? 'active' : ''}" onclick="selectTreeNode('${child.id}')" style="margin-left: ${indent * 12}px;">
                        <span class="tree-node-toggle" onclick="toggleTreeNode(event, '${child.id}')">
                            <span class="material-icons-outlined" style="font-size:16px;">
                                ${hasKids ? (isExpanded ? 'expand_more' : 'chevron_right') : 'remove'}
                            </span>
                        </span>
                        <span class="material-icons-outlined tree-node-icon" style="color:#4f46e5;">account_tree</span>
                        <span class="tree-node-label" title="${child.child_part_code}">${child.child_part_code}</span>
                    </div>
                </div>
            `;
            
            if (hasKids && isExpanded) {
                nodeHtml += buildTreeNodes(child.id, indent + 1);
            }
        });
        return nodeHtml;
    };
    
    html += buildTreeNodes(null, 1);
    treeContainer.innerHTML = html;
}

function selectTreeNode(nodeId) {
    currentSelectedItemId = nodeId;
    renderStructureTree();
    renderStructureGrid();
    
    const label = document.getElementById('currentSelectedNodeLabel');
    if (nodeId === null) {
        label.innerText = `Active Items List (Root: ${bomData.fg_part_number})`;
    } else {
        const item = bomData.items.find(i => i.id === nodeId);
        label.innerText = `Active Items List (Assembly: ${item ? item.child_part_code : nodeId})`;
    }
}

function toggleTreeNode(event, nodeId) {
    event.stopPropagation();
    if (expandedNodeIds.has(nodeId)) {
        expandedNodeIds.delete(nodeId);
    } else {
        expandedNodeIds.add(nodeId);
    }
    renderStructureTree();
}

function expandAllTreeNodes() {
    bomData.items.filter(i => i.child_type === 'assembly').forEach(a => expandedNodeIds.add(a.id));
    renderStructureTree();
}

function collapseAllTreeNodes() {
    expandedNodeIds.clear();
    renderStructureTree();
}

function toggleTreeSidebarCollapse() {
    const sidebar = document.getElementById('detTreeSidebar');
    const collapseIcon = document.getElementById('sidebarCollapseIcon');
    if (sidebar.style.width === '0px' || sidebar.style.display === 'none') {
        sidebar.style.width = '260px';
        sidebar.style.display = 'block';
        collapseIcon.innerText = 'menu_open';
    } else {
        sidebar.style.width = '0px';
        sidebar.style.display = 'none';
        collapseIcon.innerText = 'menu';
    }
}

// ─── GRID / TABLE ITEMS RENDER ───

function renderStructureGrid() {
    const tbody = document.getElementById('bomItemsTableBody');
    const items = bomData.items.filter(i => i.parent_item_id === currentSelectedItemId);
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" style="text-align:center; color:var(--text-secondary);">No component items added under this assembly. Click "Add Component" or "Add Assembly" to populate.</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map(item => {
        const totalCost = (item.unit_cost || 0) * (item.quantity || 1);
        
        let procBadge = '';
        if (item.child_type === 'assembly') {
            const isMfg = item.procurement_type === 'manufacturing';
            procBadge = `<span class="${isMfg ? 'badge-procurement-manufacturing' : 'badge-procurement-bought_out'}" onclick="toggleItemProcurement('${item.id}', '${item.procurement_type}')">${isMfg ? 'Manufactured' : 'Bought Out'}</span>`;
        } else {
            procBadge = `<span style="font-size:11px; font-weight:700; color:var(--text-secondary);">Bought Out</span>`;
        }
        
        let actions = '';
        if (editMode) {
            actions = `
                <button class="btn-action" title="Edit Item" onclick="openEditBomItemModal('${item.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-action" title="Remove" onclick="deleteBomItem('${item.id}')" style="color:#ef4444;"><span class="material-icons-outlined">delete</span></button>
            `;
        } else {
            actions = `<span style="font-size:11px; color:var(--text-secondary);">Locked</span>`;
        }
        
        return `
            <tr>
                <td><strong>${item.child_part_code}</strong></td>
                <td><span style="font-size:12px; color:var(--text-secondary);">${item.description || '-'}</span></td>
                <td>${procBadge}</td>
                <td><strong>${item.quantity}</strong></td>
                <td>${item.unit}</td>
                <td>Rs. ${(item.unit_cost || 0).toFixed(2)}</td>
                <td><strong style="color:#10b981;">Rs. ${totalCost.toFixed(2)}</strong></td>
                <td>${item.scrap_factor}%</td>
                <td><span class="badge" style="background:var(--bg-secondary); color:var(--text-secondary);">${item.operation_ref || '-'}</span></td>
                <td>
                    <div style="display:flex; gap:4px;">
                        ${actions}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// ─── PROC SOURCE TOGGLING ───

async function toggleItemProcurement(itemId, currentProc) {
    if (!editMode) {
        showToast('BOM must be in Edit Mode to toggle procurement sourcing.', 'error');
        return;
    }
    const newProc = currentProc === 'manufacturing' ? 'bought_out' : 'manufacturing';
    try {
        const res = await fetch(API + `/boms/${currentBomId}/update-item/${itemId}`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ procurement_type: newProc })
        });
        const json = await res.json();
        if (json.success) {
            showToast('Procurement sourcing updated');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error updating sourcing type', 'error'); }
}

// ─── EDIT MODE TRANSITIONS ───

async function startEditingBom() {
    try {
        const res = await fetch(API + `/boms/${currentBomId}/enter-edit`, { method: 'POST', headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            editMode = true;
            showToast('BOM Edit Mode activated');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error entering edit mode', 'error'); }
}

async function cancelEditingBom() {
    try {
        const res = await fetch(API + `/boms/${currentBomId}/cancel-edit`, { method: 'POST', headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            editMode = false;
            showToast('Edits cancelled, draft rolled back');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error reverting edits', 'error'); }
}

function saveEditingBom() {
    openModal('Save BOM Changes', `
        <div class="form-group">
            <label>Save Type *</label>
            <select id="saveBumpType" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border-color);" onchange="onSaveBumpChange()">
                <option value="none">Quick Save (Keep current version ${bomData.current_version})</option>
                <option value="minor">Minor Bump (Increment minor version, e.g. V1.0 to V1.1)</option>
                <option value="major">Major Bump (Increment major version, e.g. V1 to V2)</option>
            </select>
        </div>
        <div class="form-group" id="saveChangeDescGroup" style="display:none;">
            <label>Change Log / Comments *</label>
            <textarea id="saveChangeDesc" placeholder="Describe the changes made in this revision..." style="width:100%; min-height:80px; padding:8px; border:1px solid var(--border-color); border-radius:4px; outline:none; font-family:inherit;"></textarea>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitSaveEditingBom()">Commit Save</button>
        </div>
    `);
}

function onSaveBumpChange() {
    const bumpType = document.getElementById('saveBumpType').value;
    const descGroup = document.getElementById('saveChangeDescGroup');
    if (bumpType === 'none') {
        descGroup.style.display = 'none';
    } else {
        descGroup.style.display = 'block';
    }
}

async function submitSaveEditingBom() {
    const bumpType = document.getElementById('saveBumpType').value;
    const desc = document.getElementById('saveChangeDesc') ? document.getElementById('saveChangeDesc').value.trim() : '';
    
    if (bumpType !== 'none' && !desc) {
        showToast('Change log description is required for version bumps', 'error');
        return;
    }
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/save-edit`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                bump_type: bumpType,
                change_description: desc
            })
        });
        const json = await res.json();
        if (json.success) {
            editMode = false;
            showToast('BOM saved successfully');
            closeModal();
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error saving edits', 'error'); }
}

// ─── RELEASING ───

function openReleaseBomModal() {
    document.getElementById('relBomVersionLabel').innerText = bomData.current_version;
    document.getElementById('relBomChangeDesc').value = '';
    document.getElementById('releaseMfgBomModal').classList.add('active');
}

async function submitReleaseBom(event) {
    event.preventDefault();
    const desc = document.getElementById('relBomChangeDesc').value.trim();
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/release`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ change_description: desc })
        });
        const json = await res.json();
        if (json.success) {
            showToast('BOM version released & locked');
            closeModal('releaseMfgBomModal');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error releasing BOM', 'error'); }
}

// ─── ADDING & EDITING BOM ITEMS MODALS ───

function openAddBomItemModal(type) {
    document.getElementById('addBomItemModalTitle').innerText = type === 'assembly' ? 'Add Assembly to BOM' : 'Add Component to BOM';
    document.getElementById('abiParentId').value = currentSelectedItemId || '';
    document.getElementById('abiChildType').value = type;
    
    document.getElementById('abiSearchLabel').innerText = type === 'assembly' ? 'Search Assembly *' : 'Search Component *';
    document.getElementById('abiPartSearch').value = '';
    document.getElementById('abiSelectedPart').value = '';
    document.getElementById('abiQty').value = '1';
    document.getElementById('abiUnit').value = 'Nos';
    document.getElementById('abiScrap').value = '0';
    document.getElementById('abiOpRef').value = '-01';
    
    const procGroup = document.getElementById('abiProcurementGroup');
    if (type === 'assembly') {
        procGroup.style.display = 'block';
        document.getElementById('abiProcurement').value = 'manufacturing';
    } else {
        procGroup.style.display = 'none';
        document.getElementById('abiProcurement').value = 'bought_out';
    }
    
    clearSelectedBomPart();
    document.getElementById('addMfgBomItemModal').classList.add('active');
}

function searchPartsForBom(q) {
    clearTimeout(partSearchTimer);
    const resultsDiv = document.getElementById('abiPartSearchResults');
    if (!q || q.trim().length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    partSearchTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/v1/part/search-parts?q=${encodeURIComponent(q)}`, { headers: HEADERS });
            const json = await res.json();
            if (json.success && json.data.length > 0) {
                resultsDiv.innerHTML = json.data.map(p => `
                    <div class="search-result-item" onclick="selectBomPart('${p.part_number}', '${(p.description || '').replace(/'/g, "\\'")}')">
                        <strong>${p.part_number}</strong> — ${p.description || ''}
                    </div>
                `).join('');
            } else {
                resultsDiv.innerHTML = '<div style="padding:8px; font-size:12px; color:var(--text-secondary);">No matching parts found.</div>';
            }
        } catch (e) {
            resultsDiv.innerHTML = '<div style="padding:8px; font-size:12px; color:red;">Error searching parts.</div>';
        }
    }, 300);
}

function selectBomPart(partNumber, description) {
    document.getElementById('abiSelectedPart').value = partNumber;
    document.getElementById('abiPartSearch').style.display = 'none';
    document.getElementById('abiPartSearchResults').innerHTML = '';
    
    const inlineSelected = document.getElementById('abiPartSelected');
    document.getElementById('abiPartSelLabel').innerText = `${partNumber} — ${description}`;
    inlineSelected.style.display = 'flex';
}

function clearSelectedBomPart() {
    document.getElementById('abiSelectedPart').value = '';
    document.getElementById('abiPartSearch').value = '';
    document.getElementById('abiPartSearch').style.display = 'block';
    document.getElementById('abiPartSelected').style.display = 'none';
    document.getElementById('abiPartSearchResults').innerHTML = '';
}

async function saveNewBomItem(event) {
    event.preventDefault();
    const cno = document.getElementById('abiSelectedPart').value;
    if (!cno) { showToast('Please select a part from suggestions', 'error'); return; }
    
    const payload = {
        parent_item_id: document.getElementById('abiParentId').value || null,
        child_type: document.getElementById('abiChildType').value,
        child_part_code: cno,
        quantity: parseFloat(document.getElementById('abiQty').value || 1),
        unit: document.getElementById('abiUnit').value || 'Nos',
        level: currentSelectedItemId ? (bomData.items.find(i => i.id === currentSelectedItemId).level + 1) : 1,
        scrap_factor: parseFloat(document.getElementById('abiScrap').value || 0),
        operation_ref: document.getElementById('abiOpRef').value || '-01',
        procurement_type: document.getElementById('abiProcurement').value
    };
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/add-item`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Item added successfully');
            closeModal('addMfgBomItemModal');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error adding item', 'error'); }
}

async function openEditBomItemModal(itemId) {
    const item = bomData.items.find(i => i.id === itemId);
    if (!item) return;
    
    document.getElementById('ebiItemId').value = itemId;
    document.getElementById('ebiPartNo').innerText = item.child_part_code;
    document.getElementById('ebiQty').value = item.quantity;
    document.getElementById('ebiUnit').value = item.unit;
    document.getElementById('ebiScrap').value = item.scrap_factor;
    document.getElementById('ebiOpRef').value = item.operation_ref;
    
    const procGroup = document.getElementById('ebiProcurementGroup');
    if (item.child_type === 'assembly') {
        procGroup.style.display = 'block';
        document.getElementById('ebiProcurement').value = item.procurement_type || 'manufacturing';
    } else {
        procGroup.style.display = 'none';
        document.getElementById('ebiProcurement').value = 'bought_out';
    }
    
    document.getElementById('editMfgBomItemModal').classList.add('active');
}

async function saveEditBomItem(event) {
    event.preventDefault();
    const itemId = document.getElementById('ebiItemId').value;
    
    const payload = {
        quantity: parseFloat(document.getElementById('ebiQty').value || 1),
        unit: document.getElementById('ebiUnit').value || 'Nos',
        scrap_factor: parseFloat(document.getElementById('ebiScrap').value || 0),
        operation_ref: document.getElementById('ebiOpRef').value || '-01',
        procurement_type: document.getElementById('ebiProcurement').value
    };
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/update-item/${itemId}`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast('Item updated successfully');
            closeModal('editMfgBomItemModal');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error updating item', 'error'); }
}

async function deleteBomItem(itemId) {
    if (!confirm('Are you sure you want to delete this item? All nested children will also be deleted recursively.')) return;
    try {
        const res = await fetch(API + `/boms/${currentBomId}/remove-item/${itemId}`, { method: 'POST', headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            showToast('Item removed successfully');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error deleting item', 'error'); }
}

// ─── COSTING TAB IMPLEMENTATION ───

async function loadCostingTab() {
    const tbody = document.getElementById('bomCostingTableBody');
    try {
        const res = await fetch(API + `/boms/${currentBomId}/costing`, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading costing details.</td></tr>'; return; }
        
        document.getElementById('c-total').innerText = 'Rs. ' + bomData.cost.toFixed(2);
        
        if (json.data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No component items found in this BOM.</td></tr>';
            return;
        }
        
        tbody.innerHTML = json.data.map(item => {
            let vendorsHtml = `
                <div style="margin-bottom:6px;">
                    <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                        <input type="radio" name="vendor-radio-${item.part_number}" value="" ${item.selected_vendor_id === null ? 'checked' : ''} onchange="selectVendorCosting('${item.part_number}', '', ${item.default_cost})">
                        <span><strong>Default Stock Cost</strong> (Rs. ${item.default_cost.toFixed(2)})</span>
                    </label>
                </div>
            `;
            
            item.vendors.forEach(v => {
                const isSelected = item.selected_vendor_id === v.vendor_id;
                vendorsHtml += `
                    <div style="margin-bottom:4px; display:flex; align-items:center; gap:8px;">
                        <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
                            <input type="radio" name="vendor-radio-${item.part_number}" value="${v.vendor_id}" ${isSelected ? 'checked' : ''} onchange="onVendorRadioChange('${item.part_number}', '${v.vendor_id}')">
                            <span>${v.vendor_name} (${v.vendor_code})</span>
                        </label>
                        <input type="number" step="0.01" placeholder="Price..." value="${isSelected ? item.selected_cost : ''}" id="price-input-${item.part_number}-${v.vendor_id}" onchange="saveVendorCustomCost('${item.part_number}', '${v.vendor_id}')" style="width:90px; padding:4px 6px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none; display: ${isSelected ? 'block' : 'none'};">
                    </div>
                `;
            });
            
            return `
                <tr>
                    <td><strong>${item.part_number}</strong></td>
                    <td><span style="font-size:12px; color:var(--text-secondary);">${item.description || '-'}</span></td>
                    <td>Rs. ${item.default_cost.toFixed(2)}</td>
                    <td>${vendorsHtml}</td>
                </tr>
            `;
        }).join('');
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error fetching costing data.</td></tr>';
    }
}

function onVendorRadioChange(partNumber, vendorId) {
    document.querySelectorAll(`[id^="price-input-${partNumber}-"]`).forEach(input => {
        input.style.display = 'none';
    });
    
    const input = document.getElementById(`price-input-${partNumber}-${vendorId}`);
    if (input) {
        input.style.display = 'block';
        input.focus();
    }
    
    const cost = parseFloat(input ? input.value : 0) || 0;
    selectVendorCosting(partNumber, vendorId, cost);
}

function saveVendorCustomCost(partNumber, vendorId) {
    const input = document.getElementById(`price-input-${partNumber}-${vendorId}`);
    const cost = parseFloat(input ? input.value : 0) || 0;
    selectVendorCosting(partNumber, vendorId, cost);
}

async function selectVendorCosting(partNumber, vendorId, cost) {
    try {
        const res = await fetch(API + `/boms/${currentBomId}/costing-select`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                part_number: partNumber,
                vendor_id: vendorId || null,
                unit_cost: cost
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast('Sourcing cost selection updated');
            loadBomDetail(currentBomId);
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error saving selection', 'error'); }
}

// ─── FILES TAB IMPLEMENTATION ───

async function loadFilesTab() {
    const tbody = document.getElementById('bomFilesTableBody');
    try {
        const res = await fetch(API + `/boms/${currentBomId}/files`, { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(f => `
                <tr>
                    <td><strong>${f.filename}</strong></td>
                    <td>${f.doc_type}</td>
                    <td><span class="badge" style="background:var(--bg-secondary); color:var(--text-secondary);">${f.revision}</span></td>
                    <td>${(f.file_size / 1024).toFixed(1)} KB</td>
                    <td>${f.uploaded_by}</td>
                    <td>${f.uploaded_at.split('.')[0]}</td>
                    <td>
                        <div style="display:flex; gap:4px;">
                            <button class="btn-action" title="Download" onclick="downloadBomFile('${f.id}')"><span class="material-icons-outlined">download</span></button>
                            <button class="btn-action" title="Delete" onclick="deleteBomFile('${f.id}')" style="color:#ef4444;"><span class="material-icons-outlined">delete</span></button>
                        </div>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-secondary);">No drawing attachments uploaded. Click "Upload File" to add drawings.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Error loading drawings.</td></tr>';
    }
}

function openUploadBomFileModal() {
    document.getElementById('ufFile').value = '';
    document.getElementById('ufDescription').value = '';
    document.getElementById('ufRevision').value = 'A';
    document.getElementById('uploadMfgBomFileModal').classList.add('active');
}

async function submitUploadBomFile(event) {
    event.preventDefault();
    const fileInput = document.getElementById('ufFile');
    if (fileInput.files.length === 0) { showToast('Please select a file to upload', 'error'); return; }
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('doc_type', document.getElementById('ufDocType').value);
    formData.append('revision', document.getElementById('ufRevision').value);
    formData.append('description', document.getElementById('ufDescription').value);
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/upload-file`, {
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '')
            },
            body: formData
        });
        const json = await res.json();
        if (json.success) {
            showToast('File uploaded successfully');
            closeModal('uploadMfgBomFileModal');
            loadFilesTab();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error uploading file', 'error'); }
}

function downloadBomFile(fileId) {
    window.open(API + `/boms/${currentBomId}/download-file/${fileId}?token=` + (localStorage.getItem('access_token') || ''));
}

async function deleteBomFile(fileId) {
    if (!confirm('Are you sure you want to delete this drawing file?')) return;
    try {
        const res = await fetch(API + `/boms/${currentBomId}/delete-file/${fileId}`, { method: 'POST', headers: HEADERS });
        const json = await res.json();
        if (json.success) {
            showToast('File deleted successfully');
            loadFilesTab();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error deleting file', 'error'); }
}

// ─── VERSIONS TAB IMPLEMENTATION ───

async function loadVersionsTab() {
    const tbody = document.getElementById('bomVersionsTableBody');
    try {
        const res = await fetch(API + `/boms/${currentBomId}/versions`, { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(v => `
                <tr>
                    <td><strong>${v.version}</strong></td>
                    <td>${v.version_type}</td>
                    <td><span class="badge ${v.status === 'Released' ? 'badge-status-released' : 'badge-status-draft'}">${v.status}</span></td>
                    <td>${v.change_description}</td>
                    <td>${v.released_at ? v.released_at.split('.')[0] : '-'}</td>
                    <td>
                        <button class="btn-outline" onclick="loadBomDetail('${currentBomId}', '${v.version}')" style="padding:4px 8px; font-size:11px;">
                            View Snapshot
                        </button>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-secondary);">No previous version snapshots stored.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading version snapshots.</td></tr>';
    }
}

// ─── HISTORY TAB IMPLEMENTATION ───

async function loadHistoryTab() {
    const tbody = document.getElementById('bomHistoryTableBody');
    try {
        const res = await fetch(API + `/boms/${currentBomId}/history`, { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(h => `
                <tr>
                    <td><span class="badge" style="background:#e0e7ff; color:#4f46e5; font-weight:700;">${h.action}</span></td>
                    <td>${h.detail}</td>
                    <td><strong>${h.performed_by}</strong></td>
                    <td>${h.performed_at.split('.')[0]}</td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:var(--text-secondary);">No audit log entries recorded.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; color:red;">Error loading history logs.</td></tr>';
    }
}

function filterBomListTable(query) {
    const q = query.toLowerCase().trim();
    const rows = document.querySelectorAll('#bomAssemblyListTable tbody tr');
    rows.forEach(row => {
        if (row.cells.length < 2) return;
        const text = row.innerText.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
    });
}


// Auto-load details if hash contains a part code on script load
(function() {
    let hash = location.hash;
    if (hash) {
        const parts = hash.split('#');
        let section = parts[1] || '';
        let partCode = parts[2] || null;
        if (section === 'bom' && partCode) {
            setTimeout(() => {
                if (typeof navigateToBomDetailByPart === 'function') {
                    navigateToBomDetailByPart(partCode);
                }
            }, 50);
        }
    }
})();
