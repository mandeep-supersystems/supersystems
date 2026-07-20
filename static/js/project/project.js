const API = '/api/v1/projects';
const tenant = JSON.parse(localStorage.getItem('tenant') || '{}');
const HEADERS = { 'Content-Type': 'application/json', 'X-Tenant-ID': tenant.id || tenant.code || 'TEST', 'X-User-Email': JSON.parse(localStorage.getItem('user') || '{}').email || '', 'X-User-Name': (JSON.parse(localStorage.getItem('user') || '{}').first_name || '') };

let currentProjectId = null;

const PROJ_SECTIONS = [
    { id: 'projects',      label: 'All Projects',      icon: 'assignment' },
    { id: 'addproject',    label: 'Add Project',        icon: 'add_circle' },
    { id: 'organizations', label: 'Organizations',      icon: 'business' },
];
function showSection(sec) {
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-link[data-section]').forEach(l => l.classList.remove('active'));
    const el = document.getElementById('sec-' + sec);
    if (el) el.classList.add('active');
    const link = document.querySelector(`.sidebar-link[data-section="${sec}"]`);
    if (link) link.classList.add('active');
    history.pushState(null, '', '/project/' + sec);
    const s = PROJ_SECTIONS.find(x => x.id === sec);
    if (s) trackModule(s.label, s.icon, '/project/' + sec);
    if (sec === 'projects') loadProjects();
    if (sec === 'organizations') loadOrganizations();
}

// ─── ADD PROJECT TABS ───
function showApTab(tab) {
    document.querySelectorAll('#sec-addproject .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#sec-addproject .form-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('apTab-' + tab).classList.add('active');
    event.target.classList.add('active');
}

// ─── ORGANIZATION SEARCH (in Add Project) ───
let orgSearchTimeout = null;
function searchOrgsForProject(q) {
    clearTimeout(orgSearchTimeout);
    const results = document.getElementById('apOrgResults');
    if (!q || q.trim().length < 2) { results.innerHTML = ''; return; }
    orgSearchTimeout = setTimeout(async () => {
        const res = await fetch(API + '/organizations/search?q=' + encodeURIComponent(q.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="org-search-empty">No organizations found</div>'; return; }
        results.innerHTML = data.data.map(o => `
            <div class="org-search-item" onclick="selectOrgForProject('${o.id}','${esc(o.name)}','${esc(o.code)}')">
                <strong>${esc(o.code || '—')}</strong> — ${esc(o.name)}
                <span class="org-search-sub">${esc(o.industry || '')}</span>
            </div>
        `).join('');
    }, 300);
}

function selectOrgForProject(id, name, code) {
    document.getElementById('apOrgId').value = id;
    document.getElementById('apOrgSearch').value = '';
    document.getElementById('apOrgResults').innerHTML = '';
    document.getElementById('apOrgSelLabel').textContent = `${code ? code + ' — ' : ''}${name}`;
    document.getElementById('apOrgSelected').style.display = 'flex';
}

function clearOrgSelection() {
    document.getElementById('apOrgId').value = '';
    document.getElementById('apOrgSelected').style.display = 'none';
    document.getElementById('apOrgSelLabel').textContent = '';
}

function openAddOrgInline() {
    openModal('addOrgModal');
    // After save, it will auto-select the new org
    document.getElementById('addOrgModal').dataset.inline = 'true';
}

// ─── ADDRESSES REPEATER ───
let apAddresses = [];
function addApAddress() {
    apAddresses.push({ type: 'Office', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' });
    renderApAddresses();
}
function removeApAddress(i) { apAddresses.splice(i, 1); renderApAddresses(); }
function renderApAddresses() {
    document.getElementById('apAddressList').innerHTML = apAddresses.map((a, i) => `
        <div class="repeater-card">
            <div class="repeater-card-header"><span>Address ${i + 1}</span><button type="button" class="btn-icon danger" onclick="removeApAddress(${i})"><span class="material-icons-outlined">delete</span></button></div>
            <div class="form-row">
                <div class="form-group"><label>Type</label><select onchange="apAddresses[${i}].type=this.value"><option ${a.type==='Office'?'selected':''}>Office</option><option ${a.type==='Billing'?'selected':''}>Billing</option><option ${a.type==='Shipping'?'selected':''}>Shipping</option><option ${a.type==='Site'?'selected':''}>Site</option></select></div>
                <div class="form-group"><label>Line 1</label><input value="${esc(a.line1)}" onchange="apAddresses[${i}].line1=this.value"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Line 2</label><input value="${esc(a.line2)}" onchange="apAddresses[${i}].line2=this.value"></div>
                <div class="form-group"><label>City</label><input value="${esc(a.city)}" onchange="apAddresses[${i}].city=this.value"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>State</label><input value="${esc(a.state)}" onchange="apAddresses[${i}].state=this.value"></div>
                <div class="form-group"><label>Pincode</label><input value="${esc(a.pincode)}" onchange="apAddresses[${i}].pincode=this.value"></div>
                <div class="form-group"><label>Country</label><input value="${esc(a.country)}" onchange="apAddresses[${i}].country=this.value"></div>
            </div>
        </div>
    `).join('') || '<div class="repeater-empty">No addresses added yet</div>';
}

// ─── CONTACTS REPEATER ───
let apContacts = [];
function addApContact() {
    apContacts.push({ name: '', designation: '', phone: '', email: '' });
    renderApContacts();
}
function removeApContact(i) { apContacts.splice(i, 1); renderApContacts(); }
function renderApContacts() {
    document.getElementById('apContactList').innerHTML = apContacts.map((c, i) => `
        <div class="repeater-card">
            <div class="repeater-card-header"><span>Contact ${i + 1}</span><button type="button" class="btn-icon danger" onclick="removeApContact(${i})"><span class="material-icons-outlined">delete</span></button></div>
            <div class="form-row">
                <div class="form-group"><label>Name</label><input value="${esc(c.name)}" onchange="apContacts[${i}].name=this.value"></div>
                <div class="form-group"><label>Designation</label><input value="${esc(c.designation)}" onchange="apContacts[${i}].designation=this.value"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Phone</label><input value="${esc(c.phone)}" onchange="apContacts[${i}].phone=this.value"></div>
                <div class="form-group"><label>Email</label><input value="${esc(c.email)}" onchange="apContacts[${i}].email=this.value"></div>
            </div>
        </div>
    `).join('') || '<div class="repeater-empty">No contacts added yet</div>';
}

// ─── POs REPEATER ───
let apPOs = [];
function addApPO() {
    apPOs.push({ po_number: '', po_date: '', amount: '', description: '', status: 'Active' });
    renderApPOs();
}
function removeApPO(i) { apPOs.splice(i, 1); renderApPOs(); }
function renderApPOs() {
    document.getElementById('apPOList').innerHTML = apPOs.map((p, i) => `
        <div class="repeater-card">
            <div class="repeater-card-header"><span>PO ${i + 1}</span><button type="button" class="btn-icon danger" onclick="removeApPO(${i})"><span class="material-icons-outlined">delete</span></button></div>
            <div class="form-row">
                <div class="form-group"><label>PO Number</label><input value="${esc(p.po_number)}" onchange="apPOs[${i}].po_number=this.value"></div>
                <div class="form-group"><label>PO Date</label><input type="date" value="${p.po_date}" onchange="apPOs[${i}].po_date=this.value"></div>
            </div>
            <div class="form-row">
                <div class="form-group"><label>Amount</label><input type="number" step="0.01" value="${p.amount}" onchange="apPOs[${i}].amount=this.value"></div>
                <div class="form-group"><label>Status</label><select onchange="apPOs[${i}].status=this.value"><option ${p.status==='Active'?'selected':''}>Active</option><option ${p.status==='Closed'?'selected':''}>Closed</option><option ${p.status==='Cancelled'?'selected':''}>Cancelled</option></select></div>
            </div>
            <div class="form-group"><label>Description</label><input value="${esc(p.description)}" onchange="apPOs[${i}].description=this.value"></div>
        </div>
    `).join('') || '<div class="repeater-empty">No purchase orders added yet</div>';
}

// ─── PROJECTS ───
async function loadProjects() {
    const tbody = document.getElementById('projectsTableBody');
    try {
        const res = await fetch(API + '/projects', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="9" class="empty">No projects yet. Add one to get started.</td></tr>'; return; }
        tbody.innerHTML = data.data.map(p => `<tr>
            <td><strong>${esc(p.project_number)}</strong></td>
            <td><a href="#" class="project-link" onclick="openProject('${p.id}')">${esc(p.project_name)}</a></td>
            <td>${esc(p.organization_name)}</td>
            <td>${esc(p.project_type)}</td>
            <td><span class="status-badge status-${p.status}">${esc(p.status)}</span></td>
            <td>${p.start_date}</td>
            <td>${p.due_date}</td>
            <td><div class="progress-bar"><div class="progress-fill" style="width:${p.percent_complete}%"></div><span>${p.percent_complete}%</span></div></td>
            <td class="actions-cell">
                <button class="btn-icon" title="View" onclick="openProject('${p.id}')"><span class="material-icons-outlined">visibility</span></button>
                <button class="btn-icon danger" title="Delete" onclick="deleteProject('${p.id}','${esc(p.project_name)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9" class="empty">Error loading projects</td></tr>'; }
}

async function saveProject(e) {
    e.preventDefault();
    const body = {
        project_name: document.getElementById('apName').value.trim(),
        project_number: document.getElementById('apNumber').value.trim(),
        organization_id: document.getElementById('apOrgId').value || null,
        project_type: document.getElementById('apType').value.trim(),
        status: document.getElementById('apStatus').value,
        start_date: document.getElementById('apStart').value || null,
        due_date: document.getElementById('apDue').value || null,
        closing_date: document.getElementById('apClosing').value || null,
        territory: document.getElementById('apTerritory').value.trim(),
        sales_employee: document.getElementById('apSales').value.trim(),
        owner: document.getElementById('apOwner').value.trim(),
        addresses: apAddresses,
        contacts: apContacts,
        purchase_orders: apPOs
    };
    const res = await fetch(API + '/projects', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        alert('Project created!');
        // Reset form
        document.querySelectorAll('#apTab-overview input, #apTab-overview select').forEach(el => { if (el.type !== 'submit' && el.type !== 'hidden') el.value = ''; });
        clearOrgSelection();
        apAddresses = []; apContacts = []; apPOs = [];
        renderApAddresses(); renderApContacts(); renderApPOs();
        showSection('projects');
    } else { alert(data.message); }
}

async function openProject(id) {
    currentProjectId = id;
    const res = await fetch(API + '/projects/' + id, { headers: HEADERS });
    const data = await res.json();
    if (!data.success) { alert(data.message); return; }
    const p = data.data;
    document.getElementById('pdTitle').textContent = `${p.project_number} — ${p.project_name}`;
    document.getElementById('pdCards').innerHTML = `
        <div class="detail-cards-grid">
            <div class="d-card"><span class="d-label">Status</span><span class="status-badge status-${p.status}">${p.status}</span></div>
            <div class="d-card"><span class="d-label">% Complete</span><span class="d-value">${p.percent_complete}%</span></div>
            <div class="d-card"><span class="d-label">Organization</span><span class="d-value">${p.organization_name || '—'}</span></div>
            <div class="d-card"><span class="d-label">Start</span><span class="d-value">${p.start_date || '—'}</span></div>
            <div class="d-card"><span class="d-label">Due</span><span class="d-value">${p.due_date || '—'}</span></div>
            <div class="d-card"><span class="d-label">Closing</span><span class="d-value">${p.closing_date || '—'}</span></div>
            <div class="d-card"><span class="d-label">Type</span><span class="d-value">${p.project_type || '—'}</span></div>
            <div class="d-card"><span class="d-label">Territory</span><span class="d-value">${p.territory || '—'}</span></div>
            <div class="d-card"><span class="d-label">Sales Employee</span><span class="d-value">${p.sales_employee || '—'}</span></div>
            <div class="d-card"><span class="d-label">Owner</span><span class="d-value">${p.owner || '—'}</span></div>
            <div class="d-card"><span class="d-label">Open Tasks</span><span class="d-value">${p.open_tasks} / ${p.total_tasks}</span></div>
        </div>
        ${(p.contacts && p.contacts.length) ? '<h4 style="margin:16px 0 8px;font-size:13px">Contacts</h4><div class="detail-cards-grid">' + p.contacts.map(c => `<div class="d-card"><span class="d-label">${esc(c.designation||'Contact')}</span><span class="d-value">${esc(c.name)}</span><div style="font-size:11px;color:var(--text-secondary)">${esc(c.phone||'')} ${esc(c.email||'')}</div></div>`).join('') + '</div>' : ''}
        ${(p.purchase_orders && p.purchase_orders.length) ? '<h4 style="margin:16px 0 8px;font-size:13px">Purchase Orders</h4><div class="detail-cards-grid">' + p.purchase_orders.map(po => `<div class="d-card"><span class="d-label">${esc(po.po_number)}</span><span class="d-value">₹${Number(po.amount||0).toLocaleString()}</span><div style="font-size:11px;color:var(--text-secondary)">${po.po_date||''} · ${esc(po.status||'')}</div></div>`).join('') + '</div>' : ''}
    `;
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    document.getElementById('sec-projectdetail').classList.add('active');
    loadTasks(id);
}

async function deleteProject(id, name) {
    if (!confirm(`Delete project "${name}" and all its tasks?`)) return;
    const res = await fetch(API + '/projects/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadProjects(); else alert(data.message);
}

// ─── ORGANIZATIONS ───
async function loadOrganizations() {
    const tbody = document.getElementById('orgsTableBody');
    try {
        const res = await fetch(API + '/organizations', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No organizations yet.</td></tr>'; return; }
        tbody.innerHTML = data.data.map(o => `<tr>
            <td><strong>${esc(o.code)}</strong></td>
            <td>${esc(o.name)}</td>
            <td>${esc(o.industry)}</td>
            <td>${esc(o.phone)}</td>
            <td>${esc(o.email)}</td>
            <td>${esc(o.gst_number)}</td>
            <td class="actions-cell">
                <button class="btn-icon" title="Edit" onclick="openEditOrg('${o.id}','${esc(o.name)}','${esc(o.code)}','${esc(o.industry)}','${esc(o.website)}','${esc(o.phone)}','${esc(o.email)}','${esc(o.gst_number)}','${esc(o.pan_number)}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete" onclick="deleteOrg('${o.id}','${esc(o.name)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading</td></tr>'; }
}

function openAddOrgModal() {
    document.querySelectorAll('#addOrgModal input').forEach(el => el.value = '');
    document.getElementById('addOrgModal').dataset.inline = 'false';
    openModal('addOrgModal');
}

async function saveOrganization(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('aoName').value.trim(),
        code: document.getElementById('aoCode').value.trim(),
        industry: document.getElementById('aoIndustry').value.trim(),
        website: document.getElementById('aoWebsite').value.trim(),
        phone: document.getElementById('aoPhone').value.trim(),
        email: document.getElementById('aoEmail').value.trim(),
        gst_number: document.getElementById('aoGST').value.trim(),
        pan_number: document.getElementById('aoPAN').value.trim()
    };
    const res = await fetch(API + '/organizations', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        closeModal('addOrgModal');
        // If inline (from Add Project), auto-select the new org
        if (document.getElementById('addOrgModal').dataset.inline === 'true') {
            selectOrgForProject(data.data.id, data.data.name, body.code);
        }
        loadOrganizations();
        alert('Organization created!');
    } else { alert(data.message); }
}

function openEditOrg(id, name, code, industry, website, phone, email, gst, pan) {
    document.getElementById('eoId').value = id;
    document.getElementById('eoName').value = name;
    document.getElementById('eoCode').value = code;
    document.getElementById('eoIndustry').value = industry;
    document.getElementById('eoWebsite').value = website;
    document.getElementById('eoPhone').value = phone;
    document.getElementById('eoEmail').value = email;
    document.getElementById('eoGST').value = gst;
    document.getElementById('eoPAN').value = pan;
    openModal('editOrgModal');
}

async function updateOrganization(e) {
    e.preventDefault();
    const id = document.getElementById('eoId').value;
    const body = {
        name: document.getElementById('eoName').value.trim(),
        code: document.getElementById('eoCode').value.trim(),
        industry: document.getElementById('eoIndustry').value.trim(),
        website: document.getElementById('eoWebsite').value.trim(),
        phone: document.getElementById('eoPhone').value.trim(),
        email: document.getElementById('eoEmail').value.trim(),
        gst_number: document.getElementById('eoGST').value.trim(),
        pan_number: document.getElementById('eoPAN').value.trim()
    };
    const res = await fetch(API + '/organizations/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editOrgModal'); loadOrganizations(); } else { alert(data.message); }
}

async function deleteOrg(id, name) {
    if (!confirm(`Delete organization "${name}"?`)) return;
    const res = await fetch(API + '/organizations/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadOrganizations(); else alert(data.message);
}

// ─── TASKS ───
async function loadTasks(pid) {
    const tbody = document.getElementById('tasksTableBody');
    const res = await fetch(API + '/projects/' + pid + '/tasks', { headers: HEADERS });
    const data = await res.json();
    if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="10" class="empty">No tasks assigned yet</td></tr>'; return; }
    tbody.innerHTML = data.data.map(t => `<tr>
        <td><strong>${esc(t.task_name)}</strong>${t.description ? '<div class="cell-sub">' + esc(t.description.substring(0,50)) + '</div>' : ''}</td>
        <td>${esc(t.stage)}</td>
        <td>${esc(t.owner)}</td>
        <td>${t.start_date}</td>
        <td>${t.due_date}</td>
        <td>${t.planned_cost ? '₹' + t.planned_cost.toLocaleString() : '—'}</td>
        <td>${t.invoiced_amount ? '₹' + t.invoiced_amount.toLocaleString() : '—'}</td>
        <td><div class="progress-bar sm"><div class="progress-fill" style="width:${t.percent_complete}%"></div><span>${t.percent_complete}%</span></div></td>
        <td><span class="status-badge status-${t.status}">${t.status}</span></td>
        <td class="actions-cell">
            <button class="btn-icon" title="Edit" onclick="openEditTask('${t.id}','${esc(t.task_name)}','${esc(t.description||'')}','${esc(t.stage)}','${esc(t.owner)}','${t.start_date}','${t.end_date}','${t.due_date}','${t.planned_cost}','${t.invoiced_amount}','${t.percent_complete}','${esc(t.dependencies)}','${t.status}')"><span class="material-icons-outlined">edit</span></button>
            <button class="btn-icon danger" title="Delete" onclick="deleteTask('${t.id}')"><span class="material-icons-outlined">delete</span></button>
        </td>
    </tr>`).join('');
}

function openAddTaskModal() {
    document.querySelectorAll('#addTaskModal input, #addTaskModal textarea, #addTaskModal select').forEach(el => { if (el.type !== 'submit' && el.type !== 'button') el.value = el.type === 'number' ? '0' : ''; });
    openModal('addTaskModal');
}

async function saveTask(e) {
    e.preventDefault();
    const body = {
        task_name: document.getElementById('atName').value.trim(),
        description: document.getElementById('atDesc').value.trim(),
        stage: document.getElementById('atStage').value.trim(),
        owner: document.getElementById('atOwner').value.trim(),
        start_date: document.getElementById('atStart').value || null,
        end_date: document.getElementById('atEnd').value || null,
        due_date: document.getElementById('atDue').value || null,
        planned_cost: parseFloat(document.getElementById('atCost').value) || 0,
        invoiced_amount: parseFloat(document.getElementById('atInvoiced').value) || 0,
        percent_complete: parseFloat(document.getElementById('atPct').value) || 0,
        dependencies: document.getElementById('atDeps').value.trim()
    };
    const res = await fetch(API + '/projects/' + currentProjectId + '/tasks', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addTaskModal'); loadTasks(currentProjectId); } else { alert(data.message); }
}

function openEditTask(id, name, desc, stage, owner, start, end, due, cost, invoiced, pct, deps, status) {
    document.getElementById('etId').value = id;
    document.getElementById('etName').value = name;
    document.getElementById('etDesc').value = desc;
    document.getElementById('etStage').value = stage;
    document.getElementById('etOwner').value = owner;
    document.getElementById('etStart').value = start;
    document.getElementById('etEnd').value = end;
    document.getElementById('etDue').value = due;
    document.getElementById('etCost').value = cost;
    document.getElementById('etInvoiced').value = invoiced;
    document.getElementById('etPct').value = pct;
    document.getElementById('etDeps').value = deps;
    document.getElementById('etStatus').value = status;
    openModal('editTaskModal');
}

async function updateTask(e) {
    e.preventDefault();
    const id = document.getElementById('etId').value;
    const body = {
        task_name: document.getElementById('etName').value.trim(),
        description: document.getElementById('etDesc').value.trim(),
        stage: document.getElementById('etStage').value.trim(),
        owner: document.getElementById('etOwner').value.trim(),
        start_date: document.getElementById('etStart').value || null,
        end_date: document.getElementById('etEnd').value || null,
        due_date: document.getElementById('etDue').value || null,
        planned_cost: parseFloat(document.getElementById('etCost').value) || 0,
        invoiced_amount: parseFloat(document.getElementById('etInvoiced').value) || 0,
        percent_complete: parseFloat(document.getElementById('etPct').value) || 0,
        dependencies: document.getElementById('etDeps').value.trim(),
        status: document.getElementById('etStatus').value
    };
    const res = await fetch(API + '/tasks/' + id, { method: 'PUT', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editTaskModal'); loadTasks(currentProjectId); } else { alert(data.message); }
}

async function deleteTask(id) {
    if (!confirm('Delete this task?')) return;
    const res = await fetch(API + '/tasks/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadTasks(currentProjectId); else alert(data.message);
}

// ─── HELPERS ───
function esc(s) { if (!s) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// ─── INIT ───
(function() {
    const path = window.location.pathname;
    const section = path.split('/project/')[1] || 'projects';
    const valid = ['projects', 'addproject', 'organizations'];
    if (valid.includes(section)) showSection(section); else showSection('projects');
    renderApAddresses(); renderApContacts(); renderApPOs();
})();
window.addEventListener('popstate', () => { const s = window.location.pathname.split('/project/')[1] || 'projects'; showSection(s); });
