// ─── PROJECT MODULE: ORGANIZATIONS ───
async function loadOrganizations() {
    const tbody = document.getElementById('orgsTableBody');
    try {
        const res = await fetch(API + '/organizations', { headers: HEADERS });
        const data = await res.json();
        if (!data.success || !data.data.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No organizations yet.</td></tr>'; return; }
        tbody.innerHTML = data.data.map(o => `<tr>
            <td><strong>${esc(o.code)}</strong></td>
            <td><a href="#" class="link-clickable" onclick="openOrgDetail('${o.id}','${esc(o.name)}');return false">${esc(o.name)}</a></td>
            <td>${esc(o.industry)}</td>
            <td>${esc(o.phone)}</td><td>${esc(o.email)}</td><td>${esc(o.gst_number)}</td>
            <td class="actions-cell">
                <button class="btn-icon" title="View" onclick="openOrgDetail('${o.id}','${esc(o.name)}')"><span class="material-icons-outlined">visibility</span></button>
                <button class="btn-icon" title="Edit" onclick="openEditOrg('${o.id}','${esc(o.name)}','${esc(o.code)}','${esc(o.industry)}','${esc(o.website)}','${esc(o.phone)}','${esc(o.email)}','${esc(o.gst_number)}','${esc(o.pan_number)}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete" onclick="deleteOrg('${o.id}','${esc(o.name)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="7" class="empty">Error loading</td></tr>'; }
}

// ─── ORG DETAIL PAGE ───
function openOrgDetail(orgId, orgName) {
    currentOrgId = orgId;
    document.getElementById('odTitle').textContent = orgName;
    showSection('orgdetail');
}

async function loadOrgDetail(orgId) {
    // Load org info
    const res = await fetch(API + '/organizations', { headers: HEADERS });
    const data = await res.json();
    const org = (data.data || []).find(o => o.id === orgId);
    const infoEl = document.getElementById('odInfo');
    if (org) {
        infoEl.innerHTML = `<div class="org-detail-grid">
            <div><strong>Code:</strong> ${esc(org.code)}</div>
            <div><strong>Industry:</strong> ${esc(org.industry)}</div>
            <div><strong>Phone:</strong> ${esc(org.phone)}</div>
            <div><strong>Email:</strong> ${esc(org.email)}</div>
            <div><strong>GST:</strong> ${esc(org.gst_number)}</div>
            <div><strong>PAN:</strong> ${esc(org.pan_number)}</div>
            <div><strong>Website:</strong> ${esc(org.website)}</div>
        </div>`;
    }
    // Load projects for this org
    const pRes = await fetch(API + '/projects', { headers: HEADERS });
    const pData = await pRes.json();
    const projects = (pData.data || []).filter(p => p.organization_id === orgId);
    const tbody = document.getElementById('odProjectsBody');
    if (!projects.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty">No projects in this organization</td></tr>'; return; }
    tbody.innerHTML = projects.map(p => `<tr>
        <td><strong>${esc(p.project_number)}</strong></td>
        <td><a href="#" class="link-clickable" onclick="openProjectDetail('${p.id}','${esc(p.project_name)}');return false">${esc(p.project_name)}</a></td>
        <td><span class="status-badge status-${(p.status||'').replace(/\s/g,'_')}">${esc(p.status)}</span></td>
        <td>${p.start_date || '—'}</td><td>${p.due_date || '—'}</td>
        <td>—</td>
    </tr>`).join('');
}

function openAddOrgModal() { document.querySelectorAll('#addOrgModal input').forEach(el => el.value = ''); document.getElementById('addOrgModal').dataset.inline = 'false'; openModal('addOrgModal'); }

async function saveOrganization(e) {
    e.preventDefault();
    const body = { name: document.getElementById('aoName').value.trim(), code: document.getElementById('aoCode').value.trim(), industry: document.getElementById('aoIndustry').value.trim(), website: document.getElementById('aoWebsite').value.trim(), phone: document.getElementById('aoPhone').value.trim(), email: document.getElementById('aoEmail').value.trim(), gst_number: document.getElementById('aoGST').value.trim(), pan_number: document.getElementById('aoPAN').value.trim() };
    const res = await fetch(API + '/organizations', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('addOrgModal'); if (document.getElementById('addOrgModal').dataset.inline === 'true') selectOrgForProject(data.data.id, data.data.name, body.code); loadOrganizations(); alert('Organization created!'); } else { alert(data.message); }
}

function openEditOrg(id, name, code, industry, website, phone, email, gst, pan) {
    document.getElementById('eoId').value = id; document.getElementById('eoName').value = name; document.getElementById('eoCode').value = code;
    document.getElementById('eoIndustry').value = industry; document.getElementById('eoWebsite').value = website;
    document.getElementById('eoPhone').value = phone; document.getElementById('eoEmail').value = email;
    document.getElementById('eoGST').value = gst; document.getElementById('eoPAN').value = pan;
    openModal('editOrgModal');
}

async function updateOrganization(e) {
    e.preventDefault();
    const id = document.getElementById('eoId').value;
    const body = { name: document.getElementById('eoName').value.trim(), code: document.getElementById('eoCode').value.trim(), industry: document.getElementById('eoIndustry').value.trim(), website: document.getElementById('eoWebsite').value.trim(), phone: document.getElementById('eoPhone').value.trim(), email: document.getElementById('eoEmail').value.trim(), gst_number: document.getElementById('eoGST').value.trim(), pan_number: document.getElementById('eoPAN').value.trim() };
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
