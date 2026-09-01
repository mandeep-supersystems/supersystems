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
                    ? `<div style="display:flex;gap:4px;">
                        <button class="btn-outline" style="padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); navigateToBomDetailByPart('${a.part_code}')">Open →</button>
                        <button class="btn-icon" title="BOM History" style="padding:4px 6px; border:1px solid var(--border-color); border-radius:4px; background:var(--bg-secondary);" onclick="event.stopPropagation(); openBomHistoryModal('${a.bom_id}', '${a.part_code}')"><span class="material-icons-outlined" style="font-size:14px;">history</span></button>
                        <button class="btn-icon" title="Delete BOM" style="padding:4px 6px; border:1px solid #fecaca; border-radius:4px; background:#fff5f5; color:#ef4444;" onclick="event.stopPropagation(); openDeleteBomModal('${a.bom_id}', '${a.part_code}')"><span class="material-icons-outlined" style="font-size:14px;">delete</span></button>
                      </div>`
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
    const targetHash = '#bom#' + partCode;
    if (location.hash === targetHash) {
        loadBomDetailByPart(partCode);
    } else {
        location.hash = targetHash;
    }
}

function setupBomDetail(data) {
    bomData = data;
    currentBomId = bomData.id;
    currentSelectedItemId = null;
    treeBreadcrumb = [];

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

    // Render immediately — no recursive pre-fetch needed
    renderStructureTree();
    refreshActiveTab();
}

async function loadBomDetailByPart(partCode, version = '') {
    try {
        let url = API + `/boms/by-part/${partCode}`;
        if (version) url += `?version=${version}`;
        const res = await fetch(url, { headers: HEADERS });
        const json = await res.json();
        if (!json.success) { showToast(json.message, 'error'); return; }
        editMode = false;
        setupBomDetail(json.data);
    } catch (e) {
        showToast('Error loading BOM: ' + e.message, 'error');
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
        editMode = false;
        setupBomDetail(json.data);
    } catch (e) {
        showToast('Error loading BOM: ' + e.message, 'error');
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
    
    renderToolbars();
    
    if (activeBomTab === 'structure') {
        renderStructureGrid();
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
    const assemblies = bomData.items.filter(i => i.child_type === 'assembly' && !i.isSubAssemblyComponent);

    const buildNodes = (parentId, depth) => {
        const children = assemblies.filter(a => a.parent_item_id === parentId);
        if (!children.length) return '';
        let html = '';
        children.forEach(child => {
            const isActive = currentSelectedItemId === child.id;
            const isExpanded = expandedNodeIds.has(child.id);
            const hasKids = assemblies.some(a => a.parent_item_id === child.id);
            const indent = depth * 14;
            html += `
            <div class="tree-node-item">
                <div class="tree-node-row${isActive ? ' active' : ''}" style="padding-left:${indent + 8}px;" onclick="selectTreeNode('${child.id}', '${child.child_part_code}')">
                    <span class="tree-node-toggle" onclick="toggleTreeNode(event,'${child.id}')" style="opacity:${hasKids ? 1 : 0.25};pointer-events:${hasKids ? 'auto' : 'none'}">
                        <span class="material-icons-outlined" style="font-size:15px;">${hasKids ? (isExpanded ? 'expand_more' : 'chevron_right') : 'remove'}</span>
                    </span>
                    <span class="material-icons-outlined" style="font-size:14px;color:#4f46e5;margin-right:4px;">account_tree</span>
                    <span class="tree-node-label" title="${child.child_part_code}">${child.child_part_code}</span>
                    <span class="material-icons-outlined" style="font-size:13px;color:var(--text-muted);margin-left:auto;opacity:0.6;" title="Open sub-assembly BOM">open_in_new</span>
                </div>
                ${hasKids && isExpanded ? buildNodes(child.id, depth + 1) : ''}
            </div>`;
        });
        return html;
    };

    const isRoot = currentSelectedItemId === null;
    treeContainer.innerHTML = `
        <div class="tree-node-item">
            <div class="tree-node-row${isRoot ? ' active' : ''}" onclick="selectTreeNode(null, null)" style="padding-left:8px;">
                <span class="material-icons-outlined" style="font-size:16px;color:var(--accent);margin-right:6px;">precision_manufacturing</span>
                <span class="tree-node-label"><strong>${bomData.fg_part_number}</strong></span>
                <span style="font-size:10px;color:var(--text-muted);margin-left:6px;">Root</span>
            </div>
        </div>
        ${buildNodes(null, 1)}
    `;
}

// Breadcrumb stack: [{id, label}] — root is always index 0
let treeBreadcrumb = [];

function selectTreeNode(nodeId, partCode) {
    if (nodeId === null) {
        // Root clicked — reset breadcrumb
        treeBreadcrumb = [];
        currentSelectedItemId = null;
    } else {
        // Push to breadcrumb if not already the current node
        if (currentSelectedItemId !== nodeId) {
            // If going back up, trim the stack
            const existingIdx = treeBreadcrumb.findIndex(b => b.id === nodeId);
            if (existingIdx >= 0) {
                treeBreadcrumb = treeBreadcrumb.slice(0, existingIdx + 1);
            } else {
                treeBreadcrumb.push({ id: nodeId, label: partCode });
            }
            currentSelectedItemId = nodeId;
        }
    }
    renderStructureTree();
    renderStructureGrid();
    renderBomBreadcrumb();
}

function renderBomBreadcrumb() {
    const el = document.getElementById('bomBreadcrumb');
    if (!el) return;
    if (treeBreadcrumb.length === 0) {
        el.innerHTML = '';
        el.style.display = 'none';
        return;
    }
    el.style.display = 'flex';
    const crumbs = [
        `<span class="bom-crumb" onclick="selectTreeNode(null,null)" style="cursor:pointer;color:var(--accent);font-weight:600;">${bomData.fg_part_number}</span>`
    ];
    treeBreadcrumb.forEach((b, i) => {
        crumbs.push(`<span style="color:var(--text-muted);margin:0 4px;">›</span>`);
        if (i < treeBreadcrumb.length - 1) {
            crumbs.push(`<span class="bom-crumb" onclick="selectTreeNode('${b.id}','${b.label}')" style="cursor:pointer;color:var(--accent);">${b.label}</span>`);
        } else {
            crumbs.push(`<span style="font-weight:700;color:var(--text-primary);">${b.label}</span>`);
        }
    });
    el.innerHTML = crumbs.join('');
}

function toggleTreeNode(event, nodeId) {
    event.stopPropagation();
    if (expandedNodeIds.has(nodeId)) expandedNodeIds.delete(nodeId);
    else expandedNodeIds.add(nodeId);
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

// Level color palette (matches reference project)
const LEVEL_COLORS = ['#1e60c8','#0891b2','#16a34a','#d97706','#dc2626','#7c3aed'];
function getLevelColor(lvl) { return LEVEL_COLORS[Math.min(lvl - 1, LEVEL_COLORS.length - 1)]; }

// Helper to recursively get item level
function getItemLevel(item) {
    if (!item.parent_item_id) return 1;
    const parent = bomData.items.find(i => i.id === item.parent_item_id);
    if (!parent) return 1;
    return getItemLevel(parent) + 1;
}

// Walk the full parent chain in bomData.items to get true depth (1-based)
// Uses a cache per render cycle to avoid repeated traversal
let _depthCache = {};
function computeItemDepth(itemId, _guard = 0) {
    if (_guard > 20) return 1;
    if (_depthCache[itemId] !== undefined) return _depthCache[itemId];
    const item = bomData.items.find(i => i.id === itemId);
    if (!item || !item.parent_item_id) {
        _depthCache[itemId] = 1;
        return 1;
    }
    const depth = computeItemDepth(item.parent_item_id, _guard + 1) + 1;
    _depthCache[itemId] = depth;
    return depth;
}

// Helper to pre-order traverse descendants under a parent
function getDescendantsRecursively(parentId) {
    let result = [];
    const children = bomData.items.filter(i => i.parent_item_id === parentId);
    children.forEach(child => {
        result.push(child);
        if (child.child_type === 'assembly') {
            const descendants = getDescendantsRecursively(child.id);
            result.push(...descendants);
        }
    });
    return result;
}

// Toggle select all checkbox in grid
function toggleSelectAllItems(checked) {
    const checkboxes = document.querySelectorAll('.item-selector-cb');
    checkboxes.forEach(cb => {
        if (!cb.disabled) {
            cb.checked = checked;
        }
    });
    handleCheckboxSelectionChange();
}

// Selection changes to update edit/delete actions toolbar state
function handleCheckboxSelectionChange() {
    const deleteBtn = document.getElementById('btnDeleteSelectedItems');
    const editBtn = document.getElementById('btnEditSelectedItem');

    if (!editMode) {
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
        return;
    }
    const selected = Array.from(document.querySelectorAll('.item-selector-cb:checked'));
    
    if (deleteBtn) {
        deleteBtn.style.display = selected.length > 0 ? 'inline-block' : 'none';
    }
    if (editBtn) {
        editBtn.style.display = selected.length === 1 ? 'inline-block' : 'none';
    }
}

// Delete all checked components
async function deleteSelectedItems() {
    const selected = Array.from(document.querySelectorAll('.item-selector-cb:checked'))
        .map(cb => cb.getAttribute('data-item-id'));
    if (selected.length === 0) return;
    
    if (!confirm(`Are you sure you want to delete the ${selected.length} selected item(s) from the BOM?`)) return;
    
    showToast('Deleting selected items...');
    try {
        for (let itemId of selected) {
            await fetch(API + `/boms/${currentBomId}/remove-item/${itemId}`, { method: 'POST', headers: HEADERS });
        }
        showToast('Items removed successfully');
        loadBomDetail(currentBomId);
    } catch (e) {
        showToast('Error deleting selected items', 'error');
    }
}

// Edit the selected component
function editSelectedItem() {
    const selected = document.querySelector('.item-selector-cb:checked');
    if (!selected) return;
    const itemId = selected.getAttribute('data-item-id');
    openEditBomItemModal(itemId);
}

// ─── GRID / TABLE ITEMS RENDER ───

// Build ordered flat list by pre-order traversal from a root parent
function buildFlatOrderedList(rootParentId) {
    const result = [];
    function walk(parentId) {
        const children = bomData.items.filter(i => i.parent_item_id === parentId);
        children.forEach(child => {
            result.push(child);
            walk(child.id);
        });
    }
    walk(rootParentId);
    return result;
}

function renderStructureGrid() {
    const tbody = document.getElementById('bomItemsTableBody');
    _depthCache = {}; // reset depth cache each render

    // Show full tree from current node downward (pre-order flat)
    const items = buildFlatOrderedList(currentSelectedItemId);

    const selectAllCb = document.getElementById('selectAllItems');
    if (selectAllCb) selectAllCb.checked = false;
    handleCheckboxSelectionChange();

    const thActions = document.getElementById('thActions');
    if (thActions) thActions.innerText = editMode ? 'Actions' : '';

    const label = document.getElementById('currentSelectedNodeLabel');
    if (label) {
        const node = currentSelectedItemId
            ? bomData.items.find(i => i.id === currentSelectedItemId)
            : null;
        label.innerText = `Components — ${node ? node.child_part_code : bomData.fg_part_number}`;
    }
    renderBomBreadcrumb();

    if (items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align:center;padding:36px 20px;">
                    <div style="display:flex;flex-direction:column;align-items:center;gap:8px;opacity:0.55;">
                        <span class="material-icons-outlined" style="font-size:36px;color:var(--text-muted);">inventory_2</span>
                        <span style="font-size:13px;color:var(--text-secondary);">${editMode ? 'Use "Add Component" or "Add Assembly" to begin.' : 'No items. Switch to Edit Mode to add components.'}</span>
                    </div>
                </td>
            </tr>`;
        return;
    }

    // Compute base depth offset so root items always show L1 relative to current view
    const baseDepth = currentSelectedItemId ? computeItemDepth(currentSelectedItemId) : 0;

    tbody.innerHTML = items.map((item) => {
        const totalCost = (item.unit_cost || 0) * (item.quantity || 1);
        const isAssembly = item.child_type === 'assembly';
        const absDepth = computeItemDepth(item.id);
        const level = absDepth - baseDepth;  // relative level: 1 = direct child of current node
        const lvlColor = getLevelColor(level);
        const levelBadge = `<span style="display:inline-block;padding:1px 6px;border-radius:3px;font-size:10px;font-weight:700;color:#fff;background:${lvlColor};min-width:24px;text-align:center;">L${level}</span>`;
        const indent = (level - 1) * 20;

        const typeBadge = isAssembly
            ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#eef2ff;color:#4f46e5;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">
                   <span class="material-icons-outlined" style="font-size:11px;">account_tree</span>Assembly
               </span>`
            : `<span style="display:inline-flex;align-items:center;gap:3px;background:#f0fdf4;color:#16a34a;padding:2px 8px;border-radius:20px;font-size:10px;font-weight:700;white-space:nowrap;">
                   <span class="material-icons-outlined" style="font-size:11px;">settings_input_component</span>Component
               </span>`;

        const partCodeCell = isAssembly
            ? `<a onclick="loadBomDetailByPart('${item.child_part_code}')" href="javascript:void(0)"
                  style="font-weight:700;color:#4f46e5;text-decoration:none;font-size:13px;"
                  title="Open sub-assembly BOM">${item.child_part_code}
                  <span class="material-icons-outlined" style="font-size:11px;vertical-align:middle;opacity:0.7;">open_in_new</span>
               </a>`
            : `<span style="font-weight:600;font-size:13px;">${item.child_part_code}</span>`;

        // Actions cell — always present for consistent column count
        const actionsTd = editMode
            ? `<td style="text-align:center;white-space:nowrap;">
                   <button class="btn-action" title="Edit" onclick="openEditBomItemModal('${item.id}')" style="padding:3px 5px;">
                       <span class="material-icons-outlined" style="font-size:15px;">edit</span>
                   </button>
                   <button class="btn-action" title="Delete" onclick="deleteBomItem('${item.id}')" style="padding:3px 5px;color:#ef4444;">
                       <span class="material-icons-outlined" style="font-size:15px;">delete</span>
                   </button>
               </td>`
            : `<td></td>`;

        return `
            <tr style="transition:background 0.12s;" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background=''">
                <td style="text-align:center;overflow:hidden;">
                    ${item.isSubAssemblyComponent
                        ? `<span title="Belongs to sub-assembly BOM — edit there" style="color:var(--text-muted);cursor:default;">
                               <span class="material-icons-outlined" style="font-size:15px;vertical-align:middle;opacity:0.35;">block</span>
                           </span>`
                        : `<input type="checkbox" class="item-selector-cb" data-item-id="${item.id}" onchange="handleCheckboxSelectionChange()">`
                    }
                </td>
                <td style="text-align:center;overflow:hidden;">${levelBadge}</td>
                <td style="overflow:hidden;padding-left:${indent + 8}px;">${partCodeCell}</td>
                <td style="overflow:hidden;">${typeBadge}</td>
                <td style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.description || ''}">${item.description || '—'}</td>
                <td style="text-align:right;font-weight:700;overflow:hidden;">${item.quantity}</td>
                <td style="font-size:12px;color:var(--text-muted);overflow:hidden;">${item.unit}</td>
                <td style="overflow:hidden;">
                    ${editMode && !item.isSubAssemblyComponent
                        ? `<input type="text" value="${(item.reference || '').replace(/"/g, '&quot;')}" placeholder="—"
                               onblur="inlineUpdateReference('${item.id}', this.value)"
                               onkeydown="if(event.key==='Enter')this.blur()"
                               style="width:100%;padding:3px 6px;border:1px solid var(--border-color);border-radius:3px;font-size:11px;background:var(--bg-primary);color:var(--text-primary);outline:none;">`
                        : `<div style="font-size:11px;line-height:1.5;color:var(--text-secondary);word-break:break-word;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;white-space:normal;" title="${item.reference || ''}">${item.reference || '—'}</div>`
                    }
                </td>
                <td style="text-align:right;font-size:12px;color:var(--text-muted);overflow:hidden;">Rs. ${(item.unit_cost || 0).toFixed(2)}</td>
                <td style="text-align:right;font-weight:700;color:#10b981;overflow:hidden;">Rs. ${totalCost.toFixed(2)}</td>
                ${actionsTd}
            </tr>`;
    }).join('');
}


// ─── INLINE REFERENCE UPDATE ───

async function inlineUpdateReference(itemId, value) {
    const item = bomData.items.find(i => i.id === itemId);
    if (!item || item.reference === value) return;
    try {
        const res = await fetch(API + `/boms/${currentBomId}/update-item/${itemId}`, {
            method: 'POST', headers: HEADERS,
            body: JSON.stringify({ reference: value })
        });
        const json = await res.json();
        if (json.success) {
            item.reference = value; // update local cache silently
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error updating reference', 'error'); }
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

// ─── EDIT MODE TRANSITIONS ───

function startEditingBom() {
    if (bomData && (bomData.status === 'Released' || bomData.status === 'active')) {
        openVersionCopyModal();
        return;
    }
    editMode = true;
    showToast('BOM Edit Mode activated');
    renderToolbars();
    renderStructureGrid();
}

function cancelEditingBom() {
    if (!confirm('Cancel edit mode? Unsaved changes will be lost.')) return;
    editMode = false;
    showToast('Edit mode cancelled');
    loadBomDetail(currentBomId);
}

function saveEditingBom() {
    editMode = false;
    showToast('BOM saved');
    renderToolbars();
    renderStructureGrid();
}

function backToBomList() {
    if (editMode) {
        if (confirm('You have unsaved changes in BOM edit mode. If you leave, your changes will be discarded. Proceed?')) {
            editMode = false;
                        location.hash = '#bom';
        }
    } else {
        location.hash = '#bom';
    }
}

// ─── RELEASING ───

function openReleaseBomModal() {
    document.getElementById('relBomVersionLabel').innerText = bomData.current_version;
    const errEl = document.getElementById('relBomError');
    if (errEl) { errEl.style.display = 'none'; errEl.innerHTML = ''; }
    document.getElementById('releaseMfgBomModal').classList.add('active');
}

async function submitReleaseBom(event) {
    event.preventDefault();
    const errEl = document.getElementById('relBomError');
    if (errEl) { errEl.style.display = 'none'; errEl.innerHTML = ''; }
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/release`, {
            method: 'POST',
            headers: HEADERS
        });
        const json = await res.json();
        if (json.success) {
            showToast('BOM version released successfully');
            closeModal('releaseMfgBomModal');
            loadBomDetail(currentBomId);
        } else {
            if (json.blocking_assemblies) {
                const blockingList = json.blocking_assemblies.map(a => `<li><code>${a.part_code}</code> (${a.status})</li>`).join('');
                if (errEl) {
                    errEl.innerHTML = `<div style="margin-top:10px; padding:10px; background:#fff5f5; border:1px solid #fecaca; color:#ef4444; border-radius:4px; font-size:12px; line-height: 1.4;">
                        <strong>Cannot release BOM. The following sub-assemblies are not released:</strong>
                        <ul style="margin-top:5px; padding-left:18px; text-align: left;">${blockingList}</ul>
                    </div>`;
                    errEl.style.display = 'block';
                } else {
                    showToast('Cannot release BOM: Unreleased sub-assemblies present.', 'error');
                }
            } else {
                showToast(json.message || 'Error releasing BOM', 'error');
            }
        }
    } catch (e) { showToast('Error releasing BOM', 'error'); }
}

// ─── VERSION & COPY (SAVE AS) MODAL ───

let copyPartSearchTimer = null;

function searchCopyAssembliesAutocomplete(q) {
    clearTimeout(copyPartSearchTimer);
    const resultsDiv = document.getElementById('copyBomFgSearchResults');
    if (!q || q.trim().length < 2) {
        resultsDiv.innerHTML = '';
        return;
    }
    
    copyPartSearchTimer = setTimeout(async () => {
        try {
            const res = await fetch(API + `/search-assemblies?q=${encodeURIComponent(q)}`, { headers: HEADERS });
            const json = await res.json();
            if (json.success && json.data.length > 0) {
                resultsDiv.innerHTML = json.data.map(p => `
                    <div class="search-result-item" style="padding:8px 10px; cursor:pointer; border-bottom:1px solid var(--border-color); font-size:12px; transition: background 0.2s;" onclick="pickCopyBomPart('${p.part_number}', '${(p.description || '').replace(/'/g, "\\'")}')" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='none'">
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

function pickCopyBomPart(partNumber, desc) {
    document.getElementById('copyBomFgPart').value = partNumber;
    document.getElementById('copyBomName').value = desc;
    document.getElementById('copyAbiPartSearchGroup').style.display = 'none';
    document.getElementById('copyBomFgSearchResults').innerHTML = '';
    
    const selectedState = document.getElementById('copyAbiPartSelectedState');
    document.getElementById('copyBomFgSelLabel').innerHTML = `<strong>${partNumber}</strong> — ${desc}`;
    selectedState.style.display = 'block';
}

function clearCopyBomPart() {
    document.getElementById('copyBomFgPart').value = '';
    document.getElementById('copyBomName').value = '';
    document.getElementById('copyAbiPartSearchGroup').style.display = 'block';
    document.getElementById('copyBomFgSearch').value = '';
    document.getElementById('copyAbiPartSelectedState').style.display = 'none';
    document.getElementById('copyBomFgSearchResults').innerHTML = '';
}

function openVersionCopyModal() {
    const isReleased = (bomData.status === 'Released' || bomData.status === 'active');
    
    openModal('BOM Versioning & Copy (Save As)', `
        <div style="display:flex; border-bottom:1px solid var(--border-color); margin-bottom:15px; background: var(--bg-secondary); border-radius: 4px; padding: 3px;">
            <button id="tab-version-inc" class="tab-btn active" style="flex:1; padding:6px 12px; font-size:12px; font-weight:600; border-radius:4px; border:none; outline:none; background:none; cursor:pointer;" onclick="switchVersionTab('version-inc')">
                Version Increment
            </button>
            <button id="tab-version-copy" class="tab-btn" style="flex:1; padding:6px 12px; font-size:12px; font-weight:600; border-radius:4px; border:none; outline:none; background:none; cursor:pointer;" onclick="switchVersionTab('version-copy')">
                Copy BOM (Save As)
            </button>
        </div>

        <!-- tab content: Version Increment -->
        <div id="pane-version-inc" style="display:block;">
            ${!isReleased ? `
                <div style="padding:10px; background:#fff8e1; border:1px solid #ffe082; color:#b78103; border-radius:4px; margin-bottom:15px; font-size:12px; line-height: 1.4;">
                    ⚠️ Version Increment is only available for <strong>Released</strong> BOMs. Current status is <strong>Draft</strong>.
                </div>
            ` : ''}
            <div class="form-group">
                <label>Version Bump Type *</label>
                <select id="verBumpType" style="width:100%; padding:6px; border-radius:4px; border:1px solid var(--border-color);" ${!isReleased ? 'disabled' : ''}>
                    <option value="minor">Minor Bump (Increment minor version label, e.g. V1 -> V1.1)</option>
                    <option value="major">Major Bump (Increment major version label, e.g. V1.1 -> V2)</option>
                </select>
            </div>
            <div class="form-group" style="margin-top:10px;">
                <label>Change Description / Comments *</label>
                <textarea id="verChangeDesc" placeholder="Describe the changes for this new draft version..." style="width:100%; min-height:80px; padding:8px; border:1px solid var(--border-color); border-radius:4px; outline:none; font-family:inherit;" ${!isReleased ? 'disabled' : ''}></textarea>
            </div>
            <div class="form-actions" style="margin-top:15px;">
                <button class="btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="submitVersionIncrement()" ${!isReleased ? 'disabled' : ''}>Increment Version</button>
            </div>
        </div>

        <!-- tab content: Copy BOM -->
        <div id="pane-version-copy" style="display:none;">
            <div class="form-group" id="copyAbiPartSearchGroup">
                <label>Search Target Assembly Part *</label>
                <input type="text" id="copyBomFgSearch" placeholder="Search category 'Assembly' parts..." oninput="searchCopyAssembliesAutocomplete(this.value)" autocomplete="off">
                <input type="hidden" id="copyBomFgPart" value="">
                <div id="copyBomFgSearchResults" class="emp-search-results" style="max-height:150px; overflow-y:auto; margin-top:4px;"></div>
            </div>
            
            <div class="form-group" id="copyAbiPartSelectedState" style="display: none; margin-bottom: 10px;">
                <label>Selected Assembly Part Code</label>
                <div class="emp-selected-inline" style="display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:4px;">
                    <span id="copyBomFgSelLabel" style="font-size:12px;"></span>
                    <button type="button" class="btn-icon" style="background:none; border:none; cursor:pointer; color:var(--text-secondary);" onclick="clearCopyBomPart()"><span class="material-icons-outlined" style="font-size:16px;">close</span></button>
                </div>
            </div>

            <div class="form-group" style="margin-top: 10px;">
                <label>New BOM Name / Description *</label>
                <input type="text" id="copyBomName" placeholder="Engine Assembly - Copy">
            </div>

            <div class="form-actions" style="margin-top:15px;">
                <button class="btn-outline" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="submitCopyBom()">Copy BOM</button>
            </div>
        </div>
    `);
    
    // Default to Copy tab if not released
    if (!isReleased) {
        switchVersionTab('version-copy');
    }
}

function switchVersionTab(tab) {
    const tabInc = document.getElementById('tab-version-inc');
    const tabCopy = document.getElementById('tab-version-copy');
    const paneInc = document.getElementById('pane-version-inc');
    const paneCopy = document.getElementById('pane-version-copy');
    
    if (tab === 'version-inc') {
        tabInc.style.background = 'var(--bg-primary)';
        tabInc.style.color = 'var(--text-primary)';
        tabCopy.style.background = 'none';
        tabCopy.style.color = 'var(--text-secondary)';
        paneInc.style.display = 'block';
        paneCopy.style.display = 'none';
    } else {
        tabInc.style.background = 'none';
        tabInc.style.color = 'var(--text-secondary)';
        tabCopy.style.background = 'var(--bg-primary)';
        tabCopy.style.color = 'var(--text-primary)';
        paneInc.style.display = 'none';
        paneCopy.style.display = 'block';
    }
}

async function submitVersionIncrement() {
    const bumpType = document.getElementById('verBumpType').value;
    const desc = document.getElementById('verChangeDesc').value.trim();
    
    if (!desc) {
        showToast('Change description is required', 'error');
        return;
    }
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/version_increment`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                bump_type: bumpType,
                change_description: desc
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast(`Version incremented to ${json.new_version}. Entering edit mode...`);
            closeModal();
            // Auto-enter edit mode for the new draft version
            editMode = true;
            await loadBomDetail(currentBomId);
        } else {
            showToast(json.message, 'error');
        }
    } catch (e) {
        showToast('Error incrementing version', 'error');
    }
}

async function submitCopyBom() {
    const partCode = document.getElementById('copyBomFgPart').value;
    const name = document.getElementById('copyBomName').value.trim();
    
    if (!partCode) {
        showToast('Please search and select a target assembly part', 'error');
        return;
    }
    if (!name) {
        showToast('BOM name is required', 'error');
        return;
    }
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/copy`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({
                new_assembly_part_code: partCode,
                new_name: name
            })
        });
        const json = await res.json();
        if (json.success) {
            showToast('BOM copied successfully!');
            closeModal();
            navigateToBomDetail(json.new_bom_id);
        } else {
            showToast(json.message, 'error');
        }
    } catch (e) {
        showToast('Error copying BOM', 'error');
    }
}

// ─── RENAME & DELETE HELPERS ───

function deleteBomHeader(bomId, partCode) {
    openDeleteBomModal(bomId, partCode);
}

document.addEventListener('dblclick', function(e) {
    if (e.target && e.target.id === 'detBomTitle') {
        renameBomHeader();
    }
});

async function renameBomHeader() {
    if (!currentBomId) return;
    const oldName = document.getElementById('detBomTitle').innerText;
    const newName = prompt('Enter new BOM Name / Description:', oldName);
    if (newName === null) return; // Cancelled
    const trimmed = newName.trim();
    if (!trimmed) {
        showToast('BOM Name cannot be empty', 'error');
        return;
    }
    
    try {
        const res = await fetch(API + `/boms/${currentBomId}/rename`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ name: trimmed })
        });
        const json = await res.json();
        if (json.success) {
            showToast('BOM renamed successfully');
            document.getElementById('detBomTitle').innerText = trimmed;
            loadBomDetail(currentBomId);
        } else {
            showToast(json.message, 'error');
        }
    } catch (e) {
        showToast('Error renaming BOM', 'error');
    }
}

// ─── PAGE UNLOAD & NAVIGATION INTERCEPTORS ───

window.addEventListener('beforeunload', function(e) {
    if (editMode) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in BOM edit mode. Leaving will discard them.';
        return e.returnValue;
    }
});

document.addEventListener('click', function(e) {
    const a = e.target.closest('a');
    if (a && editMode) {
        const href = a.getAttribute('href');
        if (href) {
            const currentHash = location.hash;
            const targetHash = href.includes('#') ? '#' + href.split('#')[1] : '';
            
            // If navigating away from the current editing view
            if (targetHash !== currentHash) {
                e.preventDefault();
                e.stopPropagation();
                if (confirm('You have unsaved changes in BOM edit mode. If you leave, your changes will be discarded. Proceed?')) {
                    editMode = false;
                    window.location.href = href;
                }
            }
        }
    }
}, true); // capturing phase

// ─── ADDING & EDITING BOM ITEMS MODALS ───

function openAddBomItemModal(type) {
    if (currentSelectedItemId) {
        const item = bomData.items.find(i => i.id === currentSelectedItemId);
        if (item && item.isSubAssemblyComponent) {
            showToast('You cannot add items to a sub-assembly from this screen. Please open the sub-assembly BOM directly to edit it.', 'error');
            return;
        }
    }

    document.getElementById('addBomItemModalTitle').innerText = type === 'assembly' ? 'Add Assembly to BOM' : 'Add Component to BOM';
    document.getElementById('abiParentId').value = currentSelectedItemId || '';
    document.getElementById('abiChildType').value = type;

    // Show/hide tabs — bulk only for components
    const tabBar = document.getElementById('abiTabBar');
    tabBar.style.display = type === 'component' ? 'flex' : 'none';
    switchAbiTab('manual');

    document.getElementById('abiSearchLabel').innerText = type === 'assembly' ? 'Search Assembly *' : 'Search Component *';
    document.getElementById('abiPartSearch').value = '';
    document.getElementById('abiSelectedPart').value = '';
    document.getElementById('abiQty').value = '1';
    document.getElementById('abiUnit').value = 'Nos';
    document.getElementById('abiReference').value = '';
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
    // Reset bulk table
    document.getElementById('abiBulkRows').innerHTML = '';
    document.getElementById('abiBulkError').style.display = 'none';
    addBulkRow();
    document.getElementById('addMfgBomItemModal').classList.add('active');
}

function switchAbiTab(tab) {
    document.getElementById('abiPaneManual').style.display = tab === 'manual' ? 'block' : 'none';
    document.getElementById('abiPaneBulk').style.display = tab === 'bulk' ? 'block' : 'none';
    document.getElementById('abiTabManual').classList.toggle('active', tab === 'manual');
    document.getElementById('abiTabBulk').classList.toggle('active', tab === 'bulk');
}

let bulkRowCounter = 0;
function addBulkRow(partCode = '', qty = 1, unit = 'Nos', scrap = 0, opRef = '-01', reference = '') {
    const id = bulkRowCounter++;
    const tbody = document.getElementById('abiBulkRows');
    const tr = document.createElement('tr');
    tr.id = `bulkRow_${id}`;
    tr.innerHTML = `
        <td style="padding:4px 6px;">
            <div style="position:relative;">
                <input type="text" placeholder="Search part..." value="${partCode}" id="bulkSearch_${id}"
                    oninput="searchBulkPart(${id}, this.value)"
                    style="width:100%; padding:5px 8px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none;">
                <input type="hidden" id="bulkPart_${id}" value="${partCode}">
                <div id="bulkResults_${id}" class="emp-search-results" style="position:absolute; z-index:999; width:100%;"></div>
            </div>
        </td>
        <td style="padding:4px 6px;"><input type="number" step="0.0001" value="${qty}" id="bulkQty_${id}" style="width:100%; padding:5px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none;"></td>
        <td style="padding:4px 6px;"><input type="text" value="${unit}" id="bulkUnit_${id}" style="width:100%; padding:5px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none;"></td>
        <td style="padding:4px 6px;"><input type="number" step="0.1" value="${scrap}" id="bulkScrap_${id}" style="width:100%; padding:5px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none;"></td>
        <td style="padding:4px 6px;"><input type="text" value="${opRef}" id="bulkOpRef_${id}" style="width:100%; padding:5px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none;"></td>
        <td style="padding:4px 6px;"><input type="text" value="${reference}" id="bulkRef_${id}" placeholder="C1, R1..." style="width:100%; padding:5px; border:1px solid var(--border-color); border-radius:4px; font-size:12px; outline:none;"></td>
        <td style="padding:4px 6px; text-align:center;">
            <button type="button" onclick="document.getElementById('bulkRow_${id}').remove()" style="background:none; border:none; cursor:pointer; color:#ef4444;">
                <span class="material-icons-outlined" style="font-size:16px;">delete</span>
            </button>
        </td>
    `;
    tbody.appendChild(tr);
}

function searchBulkPart(rowId, q) {
    clearTimeout(partSearchTimer);
    const resultsDiv = document.getElementById(`bulkResults_${rowId}`);
    if (!q || q.trim().length < 2) { resultsDiv.innerHTML = ''; return; }
    partSearchTimer = setTimeout(async () => {
        try {
            const res = await fetch(`/api/v1/part/search-parts?q=${encodeURIComponent(q)}`, { headers: HEADERS });
            const json = await res.json();
            if (json.success && json.data.length > 0) {
                resultsDiv.innerHTML = json.data.map(p => `
                    <div class="search-result-item" onclick="pickBulkPart(${rowId}, '${p.part_number}', '${(p.description||'').replace(/'/g,"\\'")}')">
                        <strong>${p.part_number}</strong> — ${p.description || ''}
                    </div>
                `).join('');
            } else {
                resultsDiv.innerHTML = '<div style="padding:6px 8px; font-size:12px; color:var(--text-secondary);">No parts found.</div>';
            }
        } catch(e) { resultsDiv.innerHTML = ''; }
    }, 300);
}

function pickBulkPart(rowId, partNumber, desc) {
    document.getElementById(`bulkSearch_${rowId}`).value = `${partNumber} — ${desc}`;
    document.getElementById(`bulkPart_${rowId}`).value = partNumber;
    document.getElementById(`bulkResults_${rowId}`).innerHTML = '';
}

function parseBulkCsv(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const lines = e.target.result.split('\n').filter(l => l.trim());
        // Skip header row
        const dataLines = lines[0].toLowerCase().includes('part_code') ? lines.slice(1) : lines;
        document.getElementById('abiBulkRows').innerHTML = '';
        bulkRowCounter = 0;
        dataLines.forEach(line => {
            const cols = line.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            if (!cols[0]) return;
            addBulkRow(cols[0], cols[1] || 1, cols[2] || 'Nos', cols[3] || 0, cols[4] || '-01', cols[5] || '');
        });
    };
    reader.readAsText(file);
    input.value = '';
}

function downloadBulkCsvTemplate() {
    const csv = 'part_code,qty,unit,scrap_factor,op_ref,reference\n901.1.0001,2,Nos,0,-01,C1\n901.1.0002,1,Nos,0,-01,C2';
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
    a.download = 'bom_bulk_template.csv';
    a.click();
}

async function submitBulkBomItems() {
    const rows = document.querySelectorAll('#abiBulkRows tr');
    const errEl = document.getElementById('abiBulkError');
    errEl.style.display = 'none';

    const items = [];
    for (const row of rows) {
        const id = row.id.replace('bulkRow_', '');
        const partCode = document.getElementById(`bulkPart_${id}`).value.trim();
        if (!partCode) { errEl.textContent = 'All rows must have a part selected.'; errEl.style.display = 'block'; return; }
        items.push({
            child_type: 'component',
            child_part_code: partCode,
            quantity: parseFloat(document.getElementById(`bulkQty_${id}`).value || 1),
            unit: document.getElementById(`bulkUnit_${id}`).value || 'Nos',
            scrap_factor: parseFloat(document.getElementById(`bulkScrap_${id}`).value || 0),
            operation_ref: document.getElementById(`bulkOpRef_${id}`).value || '-01',
            reference: document.getElementById(`bulkRef_${id}`).value || '',
            procurement_type: 'bought_out',
            parent_item_id: document.getElementById('abiParentId').value || null,
            level: currentSelectedItemId ? (bomData.items.find(i => i.id === currentSelectedItemId)?.level + 1 || 1) : 1
        });
    }

    if (items.length === 0) { errEl.textContent = 'Add at least one row.'; errEl.style.display = 'block'; return; }

    // Duplicate check within the batch itself
    const batchCodes = items.map(i => i.child_part_code);
    const batchDup = batchCodes.find((c, idx) => batchCodes.indexOf(c) !== idx);
    if (batchDup) { errEl.textContent = `Duplicate in list: ${batchDup}. Each part must appear once per level.`; errEl.style.display = 'block'; return; }

    // Duplicate check against existing BOM items at same level
    const parentId = document.getElementById('abiParentId').value || null;
    const existingAtLevel = bomData.items
        .filter(i => i.parent_item_id === parentId || (i.parent_item_id === null && parentId === null))
        .map(i => i.child_part_code);
    const existingDup = items.find(i => existingAtLevel.includes(i.child_part_code));
    if (existingDup) { errEl.textContent = `${existingDup.child_part_code} already exists at this level. Add it at a different level.`; errEl.style.display = 'block'; return; }

    let failed = 0;
    for (const item of items) {
        try {
            const res = await fetch(API + `/boms/${currentBomId}/add-item`, {
                method: 'POST', headers: HEADERS, body: JSON.stringify(item)
            });
            const json = await res.json();
            if (!json.success) failed++;
        } catch(e) { failed++; }
    }

    if (failed > 0) {
        showToast(`${items.length - failed} added, ${failed} failed.`, 'error');
    } else {
        showToast(`${items.length} component(s) added successfully`);
    }
    closeModal('addMfgBomItemModal');
    loadBomDetail(currentBomId);
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

    const parentId = document.getElementById('abiParentId').value || null;
    const isDuplicate = bomData.items.some(i =>
        i.child_part_code === cno &&
        (i.parent_item_id === parentId || (i.parent_item_id === null && parentId === null))
    );
    if (isDuplicate) { showToast(`${cno} already exists at this level. Add it at a different level.`, 'error'); return; }

    const payload = {
        parent_item_id: parentId,
        child_type: document.getElementById('abiChildType').value,
        child_part_code: cno,
        quantity: parseFloat(document.getElementById('abiQty').value || 1),
        unit: document.getElementById('abiUnit').value || 'Nos',
        level: currentSelectedItemId ? (bomData.items.find(i => i.id === currentSelectedItemId).level + 1) : 1,
        reference: document.getElementById('abiReference').value || '',
        scrap_factor: parseFloat(document.getElementById('abiScrap').value || 0),
        operation_ref: document.getElementById('abiOpRef').value || '-01',
        procurement_type: document.getElementById('abiProcurement').value
    };

    try {
        const res = await fetch(API + `/boms/${currentBomId}/add-item`, {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
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
    
    if (item.isSubAssemblyComponent) {
        showToast('You cannot perform any task in a sub-assembly from this screen. Please open the sub-assembly BOM directly to edit it.', 'error');
        return;
    }
    
    document.getElementById('ebiItemId').value = itemId;
    document.getElementById('ebiPartNo').innerText = item.child_part_code;
    document.getElementById('ebiQty').value = item.quantity;
    document.getElementById('ebiUnit').value = item.unit;
    if (document.getElementById('ebiReference')) document.getElementById('ebiReference').value = item.reference || '';
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
        reference: document.getElementById('ebiReference').value || '',
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
    const item = bomData.items.find(i => i.id === itemId);
    if (item && item.isSubAssemblyComponent) {
        showToast('You cannot delete items from a sub-assembly from this screen. Please open the sub-assembly BOM directly to edit it.', 'error');
        return;
    }
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
                    <td>${v.change_description || '-'}</td>
                    <td>${v.released_at ? v.released_at.split('.')[0] : '-'}</td>
                    <td>
                        <button class="btn-outline" onclick="viewVersionSnapshot('${v.version}')" style="padding:4px 8px; font-size:11px;">
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

function viewVersionSnapshot(version) {
    switchBomTab('structure');
    loadBomDetail(currentBomId, version);
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

function openDeleteBomModal(bomId, partCode) {
    document.getElementById('delBomId').value = bomId;
    document.getElementById('delBomPartLabel').innerText = partCode;
    document.getElementById('delBomPassword').value = '';
    document.getElementById('delBomError').style.display = 'none';
    document.getElementById('deleteBomModal').classList.add('active');
}

async function submitDeleteBom() {
    const bomId = document.getElementById('delBomId').value;
    const password = document.getElementById('delBomPassword').value.trim();
    const errEl = document.getElementById('delBomError');
    if (!password) { errEl.textContent = 'Password is required.'; errEl.style.display = 'block'; return; }

    try {
        const res = await fetch(API + `/boms/${bomId}/delete`, {
            method: 'POST',
            headers: HEADERS,
            body: JSON.stringify({ password })
        });
        const json = await res.json();
        if (json.success) {
            showToast('BOM deleted successfully');
            closeModal('deleteBomModal');
            loadAssemblyBomList();
        } else {
            errEl.textContent = json.message || 'Incorrect password.';
            errEl.style.display = 'block';
        }
    } catch (e) { errEl.textContent = 'Error deleting BOM.'; errEl.style.display = 'block'; }
}

async function openBomHistoryModal(bomId, partCode) {
    document.getElementById('histBomPartLabel').innerText = partCode;
    document.getElementById('histBomBody').innerHTML = '<tr><td colspan="4" style="text-align:center;">Loading...</td></tr>';
    document.getElementById('bomHistoryModal').classList.add('active');
    try {
        const res = await fetch(API + `/boms/${bomId}/history`, { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            document.getElementById('histBomBody').innerHTML = json.data.map(h => `
                <tr>
                    <td><span class="badge" style="background:#e0e7ff;color:#4f46e5;font-weight:700;">${h.action}</span></td>
                    <td style="font-size:12px;max-width:300px;">${h.detail || '-'}</td>
                    <td><strong>${h.performed_by}</strong></td>
                    <td style="font-size:11px;color:var(--text-secondary);">${h.performed_at.split('.')[0]}</td>
                </tr>
            `).join('');
        } else {
            document.getElementById('histBomBody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-secondary);">No history found.</td></tr>';
        }
    } catch (e) {
        document.getElementById('histBomBody').innerHTML = '<tr><td colspan="4" style="text-align:center;color:red;">Error loading history.</td></tr>';
    }
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
