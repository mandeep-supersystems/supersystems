// ─── PROJECT MODULE: ADD PROJECT ───
function showApTab(tab) {
    document.querySelectorAll('#sec-addproject .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#sec-addproject .form-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('apTab-' + tab).classList.add('active');
    event.target.classList.add('active');
}

// ─── ORG SEARCH ───
let orgSearchTimeout = null;
function searchOrgsForProject(q) {
    clearTimeout(orgSearchTimeout);
    const results = document.getElementById('apOrgResults');
    if (!q || q.trim().length < 2) { results.innerHTML = ''; return; }
    orgSearchTimeout = setTimeout(async () => {
        const res = await fetch(API + '/organizations/search?q=' + encodeURIComponent(q.trim()), { headers: HEADERS });
        const data = await res.json();
        if (!data.data || !data.data.length) { results.innerHTML = '<div class="org-search-empty">No organizations found</div>'; return; }
        results.innerHTML = data.data.map(o => `<div class="org-search-item" onclick="selectOrgForProject('${o.id}','${esc(o.name)}','${esc(o.code)}')"><strong>${esc(o.code||'—')}</strong> — ${esc(o.name)}</div>`).join('');
    }, 300);
}
function selectOrgForProject(id, name, code) { document.getElementById('apOrgId').value = id; document.getElementById('apOrgSearch').value = ''; document.getElementById('apOrgResults').innerHTML = ''; document.getElementById('apOrgSelLabel').textContent = `${code?code+' — ':''}${name}`; document.getElementById('apOrgSelected').style.display = 'flex'; }
function clearOrgSelection() { document.getElementById('apOrgId').value = ''; document.getElementById('apOrgSelected').style.display = 'none'; }
function openAddOrgInline() { openModal('addOrgModal'); document.getElementById('addOrgModal').dataset.inline = 'true'; }

// ─── ADDRESSES REPEATER ───
let apAddresses = [];
function addApAddress() { apAddresses.push({ type: 'Office', line1: '', line2: '', city: '', state: '', pincode: '', country: 'India' }); renderApAddresses(); }
function removeApAddress(i) { apAddresses.splice(i, 1); renderApAddresses(); }
function renderApAddresses() {
    const el = document.getElementById('apAddressList');
    if (!el) return;
    el.innerHTML = apAddresses.map((a, i) => `<div class="repeater-card"><div class="repeater-card-header"><span>Address ${i+1}</span><button type="button" class="btn-icon danger" onclick="removeApAddress(${i})"><span class="material-icons-outlined">delete</span></button></div>
        <div class="form-row"><div class="form-group"><label>Type</label><select onchange="apAddresses[${i}].type=this.value"><option ${a.type==='Office'?'selected':''}>Office</option><option ${a.type==='Billing'?'selected':''}>Billing</option><option ${a.type==='Shipping'?'selected':''}>Shipping</option><option ${a.type==='Site'?'selected':''}>Site</option></select></div><div class="form-group"><label>Line 1</label><input value="${esc(a.line1)}" onchange="apAddresses[${i}].line1=this.value"></div></div>
        <div class="form-row"><div class="form-group"><label>City</label><input value="${esc(a.city)}" onchange="apAddresses[${i}].city=this.value"></div><div class="form-group"><label>State</label><input value="${esc(a.state)}" onchange="apAddresses[${i}].state=this.value"></div><div class="form-group"><label>Pincode</label><input value="${esc(a.pincode)}" onchange="apAddresses[${i}].pincode=this.value"></div></div>
    </div>`).join('') || '<div class="repeater-empty">No addresses added yet</div>';
}

// ─── CONTACTS REPEATER ───
let apContacts = [];
function addApContact() { apContacts.push({ name: '', designation: '', phone: '', email: '' }); renderApContacts(); }
function removeApContact(i) { apContacts.splice(i, 1); renderApContacts(); }
function renderApContacts() {
    const el = document.getElementById('apContactList');
    if (!el) return;
    el.innerHTML = apContacts.map((c, i) => `<div class="repeater-card"><div class="repeater-card-header"><span>Contact ${i+1}</span><button type="button" class="btn-icon danger" onclick="removeApContact(${i})"><span class="material-icons-outlined">delete</span></button></div>
        <div class="form-row"><div class="form-group"><label>Name</label><input value="${esc(c.name)}" onchange="apContacts[${i}].name=this.value"></div><div class="form-group"><label>Designation</label><input value="${esc(c.designation)}" onchange="apContacts[${i}].designation=this.value"></div></div>
        <div class="form-row"><div class="form-group"><label>Phone</label><input value="${esc(c.phone)}" onchange="apContacts[${i}].phone=this.value"></div><div class="form-group"><label>Email</label><input value="${esc(c.email)}" onchange="apContacts[${i}].email=this.value"></div></div>
    </div>`).join('') || '<div class="repeater-empty">No contacts added yet</div>';
}

// ─── SAVE PROJECT ───
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
        addresses: apAddresses, contacts: apContacts
    };
    const res = await fetch(API + '/projects', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        alert('Project created!');
        document.querySelectorAll('#apTab-overview input, #apTab-overview select').forEach(el => { if (el.type !== 'submit' && el.type !== 'hidden') el.value = ''; });
        clearOrgSelection(); apAddresses = []; apContacts = []; renderApAddresses(); renderApContacts();
        showSection('projects');
    } else { alert(data.message); }
}
