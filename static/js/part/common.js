// ─── PART MODULE: SHARED ───
const API = '/api/v1/part';
let HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': 'TEST' };

(function setUserHeaders() {
    try {
        const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
        if (tenant.id || tenant.code) {
            HEADERS['X-Tenant-ID'] = tenant.id || tenant.code;
        }
        const token = localStorage.getItem('access_token') || localStorage.getItem('token');
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            const identity = typeof payload.sub === 'string' ? JSON.parse(payload.sub) : payload.sub;
            if (identity) {
                HEADERS['X-User-Email'] = identity.email || '';
                HEADERS['X-User-Name'] = identity.name || identity.first_name || '';
                if (identity.tenant_id) HEADERS['X-Tenant-ID'] = identity.tenant_id;
            }
        }
    } catch (e) { }
})();

let categories = [];
let subcategories = [];
let pendingDelete = null;

const PART_SECTIONS = [
    { id: 'overview', label: 'Overview', icon: 'dashboard' },
    { id: 'categories', label: 'Categories', icon: 'folder' },
    { id: 'subcategories', label: 'Subcategories', icon: 'folder_open' },
    { id: 'generate', label: 'Generate Part Code', icon: 'bolt' },
    { id: 'allparts', label: 'All Parts', icon: 'view_list' },
    { id: 'partmapping', label: 'Part Mapping', icon: 'swap_horiz' },
    { id: 'auditlogs', label: 'Audit Logs', icon: 'history' },
    { id: 'obsolete', label: 'Obsolete Parts', icon: 'block' },
    { id: 'moduleusers', label: 'User Management', icon: 'manage_accounts' }
];

let myAllowedSections = PART_SECTIONS.map(s => s.id);

function showSection(section) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    document.getElementById('sec-' + section).classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) link.classList.add('active');
    history.pushState(null, '', '/part/' + section);
    if (section === 'overview') loadOverview();
    if (section === 'categories') loadCategories();
    if (section === 'subcategories') loadSubcategories();
    if (section === 'generate') loadGenCategories();
    if (section === 'allparts') loadApCategories();
    if (section === 'partmapping') loadMappings();
    if (section === 'auditlogs') loadAuditLogs();
    if (section === 'obsolete') loadObsoleteParts();
    if (section === 'moduleusers') loadModuleUsers();
    if (section === 'assembly') loadAssembly();
}

// ─── HELPERS ───
function esc(str) { if (!str) return ''; return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function parseCols(config) { if (!config) return []; if (Array.isArray(config)) return config; if (typeof config === 'string') { try { return JSON.parse(config); } catch (e) { return []; } } return []; }
function formatTime(ts) { if (!ts || ts === 'None') return '-'; try { const d = new Date(ts); return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ts; } }
function partOpenModal(id) { document.getElementById(id).classList.add('active'); }
function partCloseModal(id) { document.getElementById(id).classList.remove('active'); }
function showToast(msg, type = 'success') {
    let toast = document.getElementById('partToast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'partToast'; document.body.appendChild(toast); }
    toast.className = 'part-toast ' + type; toast.textContent = msg; toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

function applySidebarAccess() {
    document.querySelectorAll('.sidebar-link[data-section]').forEach(link => {
        link.style.display = myAllowedSections.includes(link.dataset.section) ? '' : 'none';
    });
}

// Called after any dynamic table render to re-apply button permissions
function applyDynamicPerms() {
    if (!Object.keys(myEntityPerms).length) return;
    document.querySelectorAll('[data-perm-entity]').forEach(el => {
        const entity = el.dataset.permEntity;
        const action = el.dataset.permAction;
        el.style.display = (myEntityPerms[entity] || []).includes(action) ? '' : 'none';
    });
}

// ─── INIT ───
let myEntityPerms = {}; // entity -> [actions]

// Show loading state immediately on the active section
(function () {
    const path = window.location.pathname.split('/');
    const section = path[2] || 'overview';
    // Pre-activate the correct section visually before auth resolves
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('sec-' + section);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${section}"]`);
    if (link) { document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active')); link.classList.add('active'); }
})();

(async function () {
    try {
        const token = localStorage.getItem('access_token') || localStorage.getItem('token') || '';
        const res = await fetch(API + '/my-access', {
            headers: { ...HEADERS, 'Authorization': 'Bearer ' + token }
        });
        const data = await res.json();
        if (data.success) {
            if (Array.isArray(data.data.sections)) {
                myAllowedSections = data.data.sections;
                applySidebarAccess();
                if (myAllowedSections.length === 0) {
                    document.querySelector('.part-content').innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;gap:12px;color:var(--text-secondary)"><span class="material-icons-outlined" style="font-size:48px">lock</span><h3 style="margin:0">No Access</h3><p style="margin:0;font-size:13px">You do not have access to Part Management. Contact your administrator.</p></div>';
                    return;
                }
            }
            if (data.data.entity_permissions) {
                myEntityPerms = data.data.entity_permissions;
            }
            applyButtonPermissions();
        }
    } catch (e) { }
    const path = window.location.pathname.split('/');
    const section = path[2] || 'overview';
    showSection(section);
})();
window.addEventListener('popstate', () => { const section = window.location.pathname.split('/')[2] || 'overview'; showSection(section); });

// ─── EXPORT / IMPORT / TEMPLATE ───
let importTarget = '';

function _csvRow(arr) {
    return arr.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',');
}
function _downloadBlob(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
}

function exportData(section) {
    if (section === 'categories') {
        if (!categories.length) { showToast('No categories to export', 'error'); return; }
        const rows = [['Name', 'Code', 'Series Prefix', 'Separator', 'Description'],
        ...categories.map(c => [c.name, c.code || '', c.series_prefix, c.separator || '-', c.description || ''])];
        _downloadBlob(rows.map(_csvRow).join('\n'), 'categories_export.csv');
        showToast('Categories exported');

    } else if (section === 'subcategories') {
        if (!subcategories.length) { showToast('No subcategories to export', 'error'); return; }
        const rows = [
            ['subcategory_name', 'subcategory_series', 'category_name', 'category_id', 'separator', 'code', 'part_code_format', 'columns'],
            ...subcategories.map(s => {
                const cat = categories.find(c => c.id === s.category_id);
                const sep = cat?.separator || '-';
                const fmt = `${s.cat_series || cat?.series_prefix || '?'}${sep}${s.series_prefix}${sep}000001`;
                const cols = parseCols(s.columns_config).map(c => c.name + ':' + c.type).join(';');
                return [s.name, s.series_prefix, s.category_name || '', s.category_id || '', sep, s.code || '', fmt, cols];
            })
        ];
        _downloadBlob(rows.map(_csvRow).join('\n'), 'subcategories_export.csv');
        showToast('Subcategories exported');

    } else if (section === 'allparts') {
        if (!_allPartsCache || !_allPartsCache.length) { showToast('No parts to export. Load parts first.', 'error'); return; }
        const rows = [['Part Number', 'Description', 'Subcategory', 'Created By', 'Status', 'Created'],
        ..._allPartsCache.map(p => [p.part_number, p.description || '', p.subcategory, p.created_by || '', p.status || 'active', p.created_at || ''])];
        _downloadBlob(rows.map(_csvRow).join('\n'), 'all_parts_export.csv');
        showToast('Parts exported');

    } else if (section === 'auditlogs') {
        const tbody = document.getElementById('auditLogsBody');
        if (!tbody || tbody.querySelector('.empty')) { showToast('No audit logs to export', 'error'); return; }
        let csv = _csvRow(['Action', 'Entity Type', 'Entity ID', 'Performed By', 'Email', 'IP Address', 'Timestamp']) + '\n';
        tbody.querySelectorAll('tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 5) {
                csv += _csvRow([
                    tds[0].textContent.trim(),
                    tds[1].querySelector('.cell-main')?.textContent.trim() || '',
                    tds[1].querySelector('.cell-sub')?.textContent.trim() || '',
                    tds[2].querySelector('.cell-main')?.textContent.trim() || '',
                    tds[2].querySelector('.cell-sub')?.textContent.trim() || '',
                    tds[3].textContent.trim(),
                    tds[4].textContent.trim()
                ]) + '\n';
            }
        });
        _downloadBlob(csv, 'audit_logs_export.csv');
        showToast('Audit logs exported');

    } else if (section === 'obsolete') {
        const tbody = document.getElementById('obsoletePartsBody');
        if (!tbody || tbody.querySelector('.empty')) { showToast('No obsolete parts to export', 'error'); return; }
        let csv = _csvRow(['Part Number', 'Category', 'Subcategory', 'Obsoleted At', 'Reason']) + '\n';
        tbody.querySelectorAll('tr').forEach(tr => {
            const tds = tr.querySelectorAll('td');
            if (tds.length >= 5) csv += _csvRow(Array.from(tds).map(td => td.textContent.trim())) + '\n';
        });
        _downloadBlob(csv, 'obsolete_parts_export.csv');
        showToast('Obsolete parts exported');
    }
    fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'EXPORT', entity_type: section, entity_id: section }) }).catch(() => { });
}

function downloadTemplate(section) {
    try {
        let data = [];
        let filename = '';
        let sheetName = '';

        if (section === 'categories') {
            data = [
                { "name": "Sheetmetal", "series_prefix": "601", "code": "SM", "separator": "-", "description": "Sheet metal parts" },
                { "name": "Electronics", "series_prefix": "701", "code": "EL", "separator": "-", "description": "Electronic components" }
            ];
            filename = 'categories_import_template.xlsx';
            sheetName = 'Categories';
        } else if (section === 'subcategories') {
            const catName = categories.length ? categories[0].name : "Resistor";
            data = [
                {
                    "subcategory_name": "SMT",
                    "subcategory_series": "1",
                    "category_name": catName,
                    "code": "SMT",
                    "columns": "value:varchar;tolerance:varchar;package:varchar",
                    "sequence_padding": 4
                }
            ];
            filename = 'subcategories_import_template.xlsx';
            sheetName = 'Subcategories';
        } else if (section === 'parts') {
            const workbook = XLSX.utils.book_new();
            if (subcategories && subcategories.length > 0) {
                // Group subcategories by Category Name
                const subcatsByCat = {};
                subcategories.forEach(sub => {
                    const catName = sub.category_name || 'General';
                    if (!subcatsByCat[catName]) subcatsByCat[catName] = [];
                    subcatsByCat[catName].push(sub);
                });

                // Create a sheet for each Category
                Object.keys(subcatsByCat).forEach(catName => {
                    const subs = subcatsByCat[catName];
                    // 1. Gather the union of all column names across all subcategories in this Category
                    const allColNames = new Set();
                    subs.forEach(sub => {
                        const cols = parseCols(sub.columns_config);
                        cols.forEach(c => {
                            if (c.name) allColNames.add(c.name.toLowerCase().trim());
                        });
                    });

                    // Convert Set to an ordered Array
                    const sortedCols = Array.from(allColNames);

                    // 2. Build worksheet with ONLY the header row
                    const worksheet = XLSX.utils.json_to_sheet([], { header: ["part_number", "subcategory_name", ...sortedCols] });
                    // Sheet names must be <= 31 chars in Excel
                    const safeSheetName = catName.substring(0, 30);
                    XLSX.utils.book_append_sheet(workbook, worksheet, safeSheetName);
                });
                XLSX.writeFile(workbook, 'parts_multi_category_template.xlsx');
                showToast(`Downloaded parts_multi_category_template.xlsx`);
                fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'TEMPLATE_DOWNLOAD', entity_type: 'parts', entity_id: 'multi-category' }) }).catch(() => {});
                return;
            } else {
                data = [];
                filename = 'parts_import_template.xlsx';
                sheetName = 'Parts';
            }
        }

        if (data.length > 0 || (section === 'parts' && data.length === 0)) {
            const worksheet = XLSX.utils.json_to_sheet(data, { header: ["part_number", "subcategory_name"] });
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
            XLSX.writeFile(workbook, filename);
            showToast(`Downloaded ${filename} (Excel)`);
        }
    } catch (err) {
        console.error("Failed to generate Excel template, falling back to CSV", err);
        // Fallback to legacy CSV format
        if (section === 'categories') {
            const csv = [
                _csvRow(['name', 'series_prefix', 'code', 'separator', 'description']),
                _csvRow(['Sheetmetal', '601', 'SM', '-', 'Sheet metal parts']),
                _csvRow(['Electronics', '701', 'EL', '-', 'Electronic components'])
            ].join('\n');
            _downloadBlob(csv, 'categories_import_template.csv');
            showToast('Categories template downloaded');
        } else if (section === 'subcategories') {
            const exRows = [
                _csvRow(['subcategory_name', 'subcategory_series', 'category_name', 'code', 'columns', 'sequence_padding']),
            ];
            if (categories.length) {
                const c = categories[0];
                exRows.push(_csvRow([`SMT`, '1', c.name, 'SMT', 'value:varchar;tolerance:varchar;package:varchar', '4']));
            } else {
                exRows.push(_csvRow(['SMT', '1', 'Resistor', 'SMT', 'value:varchar;tolerance:varchar', '4']));
            }
            const csv = exRows.join('\n');
            _downloadBlob(csv, 'subcategories_import_template.csv');
            showToast('Subcategories template downloaded');
        } else if (section === 'parts') {
            const subSel = document.getElementById('genSubcategory');
            const opt = subSel?.options[subSel?.selectedIndex];
            const cols = (opt && opt.dataset.cols) ? JSON.parse(opt.dataset.cols) : [];
            const colNames = cols.map(c => c.name);
            const csv = [
                _csvRow(['part_number', 'subcategory_name', ...colNames])
            ].join('\n');
            _downloadBlob(csv, 'parts_import_template.csv');
            showToast('Parts template downloaded');
        }
    }
    fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'TEMPLATE_DOWNLOAD', entity_type: section, entity_id: section }) }).catch(() => { });
}

function importData(section) {
    importTarget = section;
    document.getElementById('importFileInput').value = '';
    document.getElementById('importFileInput').click();
}

function _parseCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
            if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
            else inQ = !inQ;
        } else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
        else cur += ch;
    }
    result.push(cur.trim());
    return result;
}

async function handleImportFile(input) {
    const file = input.files[0];
    if (!file) return;

    let headers = [];
    let dataRows = [];
    let ok = 0, fail = 0, skipped = 0, failMsgs = [];

    try {
        const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
        if (isExcel) {
            const buffer = await file.arrayBuffer();
            const workbook = XLSX.read(buffer, { type: 'array' });
            
            if (importTarget === 'parts') {
                // Multi-sheet import support: process every sheet in the workbook
                for (const sheetName of workbook.SheetNames) {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    if (jsonData.length < 2) continue;
                    
                    const localHeaders = jsonData[0].map(h => String(h || '').toLowerCase().trim());
                    const localDataRows = jsonData.slice(1)
                        .filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
                        .map(row => row.map(v => v !== undefined && v !== null ? String(v).trim() : ''));
                        
                    const iSubName = localHeaders.indexOf('subcategory_name');
                    const iPartNum = localHeaders.indexOf('part_number');
                    const colHeaders = localHeaders.filter((h, i) => i !== iSubName && i !== iPartNum && h !== 'subcategory_id');
                    
                    for (const row of localDataRows) {
                        const subName = row[iSubName >= 0 ? iSubName : 0]?.trim();
                        if (!subName) { fail++; failMsgs.push(`[Sheet: ${sheetName}] Skipped: missing subcategory_name`); continue; }
                        
                        // Look up subcategory ID using subcategory_name and sheetName (category name)
                        const sub = subcategories.find(s => 
                            s.name.toLowerCase().trim() === subName.toLowerCase().trim() &&
                            (s.category_name || '').toLowerCase().trim() === sheetName.toLowerCase().trim()
                        );
                        
                        if (!sub) {
                            fail++;
                            failMsgs.push(`[Sheet: ${sheetName}] Skipped: subcategory "${subName}" not found under category "${sheetName}"`);
                            continue;
                        }
                        const subId = sub.id;
                        
                        const partNum = iPartNum >= 0 && row[iPartNum] !== undefined && row[iPartNum] !== null ? String(row[iPartNum]).trim() : '';
                        
                        const values = {};
                        colHeaders.forEach(h => {
                            const realIdx = localHeaders.indexOf(h);
                            if (realIdx >= 0 && row[realIdx]?.trim()) {
                                values[h] = row[realIdx].trim();
                            }
                        });
                        
                        const body = { subcategory_id: subId, values };
                        if (partNum) body.part_number = partNum;
                        
                        try {
                            const res = await fetch(API + '/generate', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
                            const d = await res.json();
                            if (res.status === 409 || d.already_exists) {
                                skipped++;
                            } else if (d.success) {
                                ok++;
                            } else {
                                fail++;
                                failMsgs.push(`[Sheet: ${sheetName}]: ${d.message}`);
                            }
                        } catch { fail++; failMsgs.push(`[Sheet: ${sheetName}]: network error`); }
                    }
                }
            } else {
                // Legacy single first sheet import for Categories / Subcategories
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                if (jsonData.length < 2) {
                    showToast('Excel file is empty or has no data rows', 'error');
                    return;
                }
                headers = jsonData[0].map(h => String(h || '').toLowerCase().trim());
                dataRows = jsonData.slice(1)
                    .filter(row => row && row.length > 0 && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
                    .map(row => row.map(v => v !== undefined && v !== null ? String(v).trim() : ''));
            }
        } else {
            const text = await file.text();
            const lines = text.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
            if (lines.length < 2) { showToast('CSV has no data rows', 'error'); return; }
            headers = _parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
            dataRows = lines.slice(1).map(l => _parseCSVLine(l));
        }
    } catch (e) {
        showToast('Error reading spreadsheet: ' + e.message, 'error');
        return;
    }



    if (importTarget === 'categories') {
        // Expected: name, series_prefix, code, separator, description
        const iName = headers.indexOf('name'), iSeries = headers.indexOf('series_prefix'),
            iCode = headers.indexOf('code'), iSep = headers.indexOf('separator'), iDesc = headers.indexOf('description');
        for (const row of dataRows) {
            const name = row[iName >= 0 ? iName : 0]?.trim();
            const series = row[iSeries >= 0 ? iSeries : 1]?.trim();
            if (!name || !series) { fail++; failMsgs.push(`Skipped: missing name or series_prefix`); continue; }
            const body = {
                name, series_prefix: series,
                code: (iCode >= 0 ? row[iCode] : row[2])?.trim() || '',
                separator: (iSep >= 0 ? row[iSep] : row[3])?.trim() || '-',
                description: (iDesc >= 0 ? row[iDesc] : row[4])?.trim() || ''
            };
            try {
                const res = await fetch(API + '/categories', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
                const d = await res.json();
                if (d.success) ok++; else { fail++; failMsgs.push(`${name}: ${d.message}`); }
            } catch { fail++; failMsgs.push(`${name}: network error`); }
        }
        loadCategories();

    } else if (importTarget === 'subcategories') {
        // Accepts: subcategory_name, subcategory_series, category_name (or category_id), code, columns
        // columns format: "value:varchar;tolerance:varchar;package:varchar"
        const iName = headers.findIndex(h => h === 'subcategory_name' || h === 'name');
        const iSeries = headers.findIndex(h => h === 'subcategory_series' || h === 'series_prefix');
        const iCatName = headers.findIndex(h => h === 'category_name');
        const iCatId = headers.findIndex(h => h === 'category_id');
        const iCode = headers.findIndex(h => h === 'code');
        const iCols = headers.findIndex(h => h === 'columns');
        const iSeqPad = headers.findIndex(h => h === 'sequence_padding');

        // Build name→id lookup from loaded categories
        const catByName = {};
        categories.forEach(c => { catByName[c.name.toLowerCase().trim()] = c.id; });

        for (const row of dataRows) {
            const name = row[iName >= 0 ? iName : 0]?.trim();
            const series = row[iSeries >= 0 ? iSeries : 1]?.trim();
            // Resolve category: prefer name lookup, fall back to id column
            let catId = '';
            if (iCatName >= 0 && row[iCatName]?.trim()) {
                catId = catByName[row[iCatName].trim().toLowerCase()] || '';
                if (!catId) { fail++; failMsgs.push(`"${name}": category "${row[iCatName]}" not found`); continue; }
            } else if (iCatId >= 0 && row[iCatId]?.trim() && !row[iCatId].startsWith('<')) {
                catId = row[iCatId].trim();
            }
            if (!name || !series || !catId) { fail++; failMsgs.push(`Skipped: missing subcategory_name, subcategory_series, or category_name`); continue; }

            // Parse columns: "value:varchar;tolerance:varchar;package:varchar"
            const colsRaw = (iCols >= 0 ? row[iCols] : '')?.trim() || '';
            const builtin_fields = new Set(["id", "part_number", "description", "created_by", "is_bought_out", "is_manufactured", "status", "obsoleted_at", "obsolete_reason", "created_at"]);
            const columns = colsRaw
                ? colsRaw.split(';').map(c => {
                    const [n, t] = c.trim().split(':');
                    const cname = n?.trim().toLowerCase();
                    if (cname && !builtin_fields.has(cname)) {
                        return { name: cname, type: (t || 'varchar').trim(), label: n.trim() };
                    }
                    return null;
                  }).filter(Boolean)
                : [{ name: 'details', type: 'varchar', label: 'Details' }];

            const seqPad = (iSeqPad >= 0 && row[iSeqPad]) ? String(row[iSeqPad]).trim() : '4';

            const body = {
                name, series_prefix: series, category_id: catId,
                code: (iCode >= 0 ? row[iCode] : '')?.trim() || '',
                columns,
                sequence_padding: parseInt(seqPad) || 4
            };
            try {
                const res = await fetch(API + '/subcategories', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
                const d = await res.json();
                if (d.success) ok++; else { fail++; failMsgs.push(`"${name}": ${d.message}`); }
            } catch { fail++; failMsgs.push(`"${name}": network error`); }
        }
        loadSubcategories();

    } else if (importTarget === 'parts' && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        // Fallback for CSV parts import
        const iSubName = headers.indexOf('subcategory_name');
        const iPartNum = headers.indexOf('part_number');
        const colHeaders = headers.filter((h, i) => i !== iSubName && i !== iPartNum && h !== 'subcategory_id');
        for (const row of dataRows) {
            const subName = row[iSubName >= 0 ? iSubName : 0]?.trim();
            if (!subName) { fail++; failMsgs.push('Skipped: missing subcategory_name'); continue; }
            
            // Find the subcategory by name in global subcategories
            const sub = subcategories.find(s => s.name.toLowerCase().trim() === subName.toLowerCase().trim());
            if (!sub) { fail++; failMsgs.push(`Skipped: subcategory "${subName}" not found`); continue; }
            const subId = sub.id;
            
            const partNum = iPartNum >= 0 && row[iPartNum] !== undefined && row[iPartNum] !== null ? String(row[iPartNum]).trim() : '';
            
            const values = {};
            colHeaders.forEach(h => {
                const realIdx = headers.indexOf(h);
                if (realIdx >= 0 && row[realIdx]?.trim()) values[h] = row[realIdx].trim();
            });
            
            const body = { subcategory_id: subId, values };
            if (partNum) body.part_number = partNum;
            
            try {
                const res = await fetch(API + '/generate', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
                const d = await res.json();
                if (res.status === 409 || d.already_exists) {
                    skipped++;
                } else if (d.success) {
                    ok++;
                } else {
                    fail++;
                    failMsgs.push(`Row: ${d.message}`);
                }
            } catch { fail++; failMsgs.push('Row: network error'); }
        }
    }

    fetch(API + '/log-action', { method: 'POST', headers: HEADERS, body: JSON.stringify({ action: 'IMPORT', entity_type: importTarget, entity_id: `${ok} records from ${file.name}` }) }).catch(() => { });
    if (fail > 0) {
        showToast(`Imported ${ok}, skipped ${skipped} duplicates, failed ${fail}. ${failMsgs[0] || ''}`, 'error');
    } else if (skipped > 0) {
        showToast(`Imported ${ok} rows, skipped ${skipped} duplicates`);
    } else {
        showToast(`Successfully imported ${ok} rows`);
    }

    if (importTarget === 'parts') {
        if (typeof _selSub !== 'undefined' && _selSub && _selSub.id) {
            loadGeneratedParts(_selSub.id);
        }
        if (typeof loadAllParts === 'function') {
            loadAllParts();
        }
    }
}

// ─── DELETE WITH PASSWORD CONFIRMATION ───
async function executeDelete() {
    const password = document.getElementById('deleteConfirmPassword').value;
    if (!password) { showDeleteError('Password is required'); return; }
    const btn = document.getElementById('deleteConfirmBtn');
    btn.disabled = true; btn.textContent = 'Verifying...';
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const verifyRes = await fetch('/api/v1/auth/verify-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (localStorage.getItem('access_token') || localStorage.getItem('token') || '') },
            body: JSON.stringify({ email: user.email || '', password })
        });
        const vd = await verifyRes.json();
        if (!vd.success) { showDeleteError(vd.message || 'Incorrect password'); btn.disabled = false; btn.textContent = 'Delete'; return; }
    } catch { showDeleteError('Failed to verify password'); btn.disabled = false; btn.textContent = 'Delete'; return; }

    try {
        if (pendingDelete.type === 'category') {
            const res = await fetch(API + '/categories/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS });
            const d = await res.json();
            if (d.success) { showToast('Category deleted'); loadCategories(); }
            else { showDeleteError(d.message || 'Delete failed'); btn.disabled = false; btn.textContent = 'Delete'; return; }
        } else if (pendingDelete.type === 'subcategory') {
            const res = await fetch(API + '/subcategories/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS });
            const d = await res.json();
            if (d.success) { showToast('Subcategory deleted'); loadSubcategories(); }
            else { showDeleteError(d.message || 'Delete failed'); btn.disabled = false; btn.textContent = 'Delete'; return; }
        } else if (pendingDelete.type === 'obsolete') {
            const res = await fetch(API + '/obsolete', { method: 'POST', headers: HEADERS, body: JSON.stringify({ subcategory_id: pendingDelete.subId, part_number: pendingDelete.partNumber }) });
            const d = await res.json();
            if (d.success) { showToast(`Part ${pendingDelete.partNumber} marked obsolete`); loadGeneratedParts(pendingDelete.subId); }
            else showToast(d.message || 'Failed', 'error');
        } else if (pendingDelete.type === 'revoke_access') {
            const res = await fetch(API + '/users/' + pendingDelete.id, { method: 'DELETE', headers: HEADERS });
            const d = await res.json();
            if (d.success) { showToast('Access revoked'); loadModuleUsers(); }
            else showToast(d.message || 'Failed', 'error');
        }
    } catch { showToast('Network error', 'error'); }
    partCloseModal('deleteConfirmModal');
    pendingDelete = null;
    btn.disabled = false; btn.textContent = 'Delete';
}

function showDeleteError(msg) {
    const el = document.getElementById('deleteError');
    el.textContent = msg; el.style.display = 'block';
}

// ─── OBSOLETE PARTS ───
async function obsoletePart(subId, partNumber) {
    pendingDelete = { type: 'obsolete', subId, partNumber };
    document.getElementById('deleteConfirmMsg').textContent = `Mark part "${partNumber}" as obsolete? Enter your password to confirm.`;
    document.getElementById('deleteConfirmPassword').value = '';
    document.getElementById('deleteError').style.display = 'none';
    partOpenModal('deleteConfirmModal');
}

async function loadObsoleteParts() {
    const tbody = document.getElementById('obsoletePartsBody');
    try {
        const res = await fetch(API + '/obsolete-parts', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || !data.data.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">No obsolete parts</td></tr>'; return; }
        tbody.innerHTML = data.data.map(p => `<tr class="obsolete-row">
            <td><strong>${esc(p.part_number)}</strong></td>
            <td>${esc(p.category || '-')}</td>
            <td>${esc(p.subcategory || '-')}</td>
            <td>${formatTime(p.obsoleted_at)}</td>
            <td>${esc(p.reason || '-')}</td>
        </tr>`).join('');
    } catch { tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading</td></tr>'; }
}

// ─── BUTTON PERMISSIONS ───
function applyButtonPermissions() {
    if (!Object.keys(myEntityPerms).length) return;
    document.querySelectorAll('[data-perm-entity]').forEach(el => {
        const entity = el.dataset.permEntity;
        const action = el.dataset.permAction;
        el.style.display = (myEntityPerms[entity] || []).includes(action) ? '' : 'none';
    });
}

// ─── POPUP HISTORY MODAL ───
let loadedHistoryLogs = [];

async function showHistoryModal(entityType) {
    document.getElementById('historyModalTitle').textContent = `${entityType} History`;
    document.getElementById('historyModalSearch').value = '';
    const tbody = document.getElementById('historyModalTableBody');
    tbody.innerHTML = '<tr><td colspan="5" class="empty">Loading...</td></tr>';
    partOpenModal('historyModal');
    try {
        const res = await fetch(API + `/audit-logs?limit=100`, { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data || !data.data.items) {
            tbody.innerHTML = '<tr><td colspan="5" class="empty">No history logs</td></tr>';
            return;
        }
        
        // Filter by entity type
        loadedHistoryLogs = data.data.items.filter(l => {
            if (entityType === 'Category') return l.entity_type === 'Category';
            if (entityType === 'Subcategory') return l.entity_type === 'Subcategory';
            if (entityType === 'Part') return l.entity_type === 'Part';
            if (entityType === 'Part Mapping') return l.entity_type === 'Part Mapping';
            if (entityType === 'Module User') return l.entity_type === 'Module User' || l.entity_type === 'User';
            return true;
        });
        
        renderHistoryModalTable(loadedHistoryLogs);
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">Error loading history</td></tr>';
    }
}

function renderHistoryModalTable(items) {
    const tbody = document.getElementById('historyModalTableBody');
    if (!items || items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="empty">No history logs found</td></tr>';
        return;
    }
    
    tbody.innerHTML = items.map(l => {
        const user = l.user_name || l.user_email || 'System';
        const emailLine = l.user_email ? `<div class="cell-sub">${esc(l.user_email)}</div>` : '';
        
        let detailsHtml = '';
        if (l.extra_data && l.extra_data.details) {
            detailsHtml += `<div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${esc(l.extra_data.details)}</div>`;
        }
        
        if (l.action === 'CREATE' || l.action === 'GENERATE' || l.action === 'GRANT_ACCESS') {
            if (l.new_values) {
                const dets = [];
                Object.entries(l.new_values).forEach(([k, v]) => {
                    if (k === 'attributes' && v) {
                        const attrList = Object.entries(v).map(([ak, av]) => `${ak}: ${av}`).join(', ');
                        dets.push(`<strong>attributes</strong>: {${esc(attrList)}}`);
                    } else if (k === 'columns' && Array.isArray(v)) {
                        const colList = v.map(c => `${c.name} (${c.type})`).join(', ');
                        dets.push(`<strong>columns</strong>: [${esc(colList)}]`);
                    } else if (k === 'permissions' && Array.isArray(v)) {
                        dets.push(`<strong>permissions</strong>: [${esc(v.join(', '))}]`);
                    } else if (v !== null && typeof v !== 'object') {
                        dets.push(`<strong>${esc(k)}</strong>: ${esc(String(v))}`);
                    }
                });
                if (dets.length) {
                    detailsHtml += `<div style="font-size:11px;color:var(--text-muted);background:var(--bg-secondary);padding:6px;border-radius:6px;margin-top:4px;word-break:break-all;">${dets.join(' | ')}</div>`;
                }
            }
        } else if (l.action === 'UPDATE' || l.action === 'UPDATE_ACCESS') {
            const changes = [];
            const ch = (l.extra_data && l.extra_data.changes) ? l.extra_data.changes : null;
            if (ch) {
                Object.entries(ch).forEach(([k, change]) => {
                    let oldVal = change.old;
                    let newVal = change.new;
                    if (typeof oldVal === 'object') oldVal = JSON.stringify(oldVal);
                    if (typeof newVal === 'object') newVal = JSON.stringify(newVal);
                    changes.push(`<strong>${esc(k)}</strong>: from "${esc(String(oldVal || ''))}" to "${esc(String(newVal || ''))}"`);
                });
            }
            if (changes.length) {
                detailsHtml += `<div style="font-size:11px;color:var(--accent);background:var(--accent-light);padding:6px;border-radius:6px;margin-top:4px;word-break:break-all;line-height:1.4;">${changes.join('<br>')}</div>`;
            }
        }
        
        return `<tr>
            <td><span class="action-badge action-${l.action.toLowerCase()}">${esc(l.action)}</span></td>
            <td>
                <div class="cell-main">${esc(l.entity_type)}</div>
                <div class="cell-sub"><code>${esc(l.entity_id)}</code></div>
                ${detailsHtml}
            </td>
            <td><div class="cell-main">${esc(user)}</div>${emailLine}</td>
            <td><code>${esc(l.ip_address || '-')}</code></td>
            <td>${formatTime(l.created_at)}</td>
        </tr>`;
    }).join('');
}

function filterHistoryModalTable(query) {
    const q = query.toLowerCase().trim();
    if (!q) {
        renderHistoryModalTable(loadedHistoryLogs);
        return;
    }
    const filtered = loadedHistoryLogs.filter(l => {
        const action = (l.action || '').toLowerCase();
        const entityType = (l.entity_type || '').toLowerCase();
        const entityId = (l.entity_id || '').toLowerCase();
        const userName = (l.user_name || '').toLowerCase();
        const userEmail = (l.user_email || '').toLowerCase();
        const ip = (l.ip_address || '').toLowerCase();
        const details = (l.extra_data && l.extra_data.details ? l.extra_data.details : '').toLowerCase();
        
        return action.includes(q) || 
               entityType.includes(q) || 
               entityId.includes(q) || 
               userName.includes(q) || 
               userEmail.includes(q) || 
               ip.includes(q) || 
               details.includes(q);
    });
    renderHistoryModalTable(filtered);
}
