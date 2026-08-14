// ─── PROJECT MODULE: ADD PROJECT ───
function showApTab(tab) {
    document.querySelectorAll('#sec-addproject .tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('#sec-addproject .form-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('apTab-' + tab).classList.add('active');
    event.target.classList.add('active');
}

// ─── LOAD SIDE PANEL DATA ───
async function loadAddProjectSideData() {
    const projList = document.getElementById('apAddedProjectsList');
    const actList = document.getElementById('apSideActivityList');
    
    // Load projects
    try {
        const res = await fetch(API + '/projects', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.length) {
            // Take top 5 latest
            projList.innerHTML = data.data.slice(0, 5).map(p => `
                <div class="added-project-item">
                    <div class="ap-item-header">
                        <strong>${esc(p.project_number)}</strong>
                        <span class="status-badge status-${p.status}">${esc(p.status)}</span>
                    </div>
                    <div style="font-weight: 500; margin-bottom: 2px;">${esc(p.project_name)}</div>
                    <div class="ap-item-sub">Created: ${formatTime(p.created_at)}</div>
                    <div class="ap-item-sub">Org: ${esc(p.organization_name || '—')}</div>
                </div>
            `).join('');
        } else {
            projList.innerHTML = '<div class="empty">No projects added yet</div>';
        }
    } catch (e) {
        projList.innerHTML = '<div class="empty">Error loading</div>';
    }

    // Load recent activity
    try {
        const res = await fetch(API + '/overview', { headers: HEADERS });
        const data = await res.json();
        if (data.success && data.data.recent_activity && data.data.recent_activity.length) {
            actList.innerHTML = data.data.recent_activity.slice(0, 5).map(a => `
                <div class="activity-item" style="padding: 6px 0;">
                    <span class="activity-action action-${a.action.toLowerCase()}" style="font-size: 10px; padding: 1px 6px;">${esc(a.action)}</span>
                    <span class="activity-entity">${esc(a.entity_type)}</span>
                    <span class="activity-time">${formatTime(a.created_at)}</span>
                </div>
            `).join('');
        } else {
            actList.innerHTML = '<div class="empty">No recent history logs</div>';
        }
    } catch (e) {
        actList.innerHTML = '<div class="empty">Error loading</div>';
    }
}

// Hook into section display
const originalShowSection = window.showSection;
window.showSection = function(sec) {
    if (typeof originalShowSection === 'function') {
        originalShowSection(sec);
    }
    if (sec === 'addproject') {
        loadAddProjectSideData();
    }
};

// ─── ORG SEARCH ───
let orgSearchTimeout = null;
function searchOrgsForProject(q) {
    clearTimeout(orgSearchTimeout);
    const results = document.getElementById('apOrgResults');
    if (!q || q.trim().length < 2) { results.innerHTML = ''; return; }
    orgSearchTimeout = setTimeout(async () => {
        try {
            const res = await fetch(API + '/organizations/search?q=' + encodeURIComponent(q.trim()), { headers: HEADERS });
            const data = await res.json();
            if (!data.data || !data.data.length) {
                results.innerHTML = '<div class="org-picker-empty">No organizations found</div>';
                return;
            }
            results.innerHTML = data.data.map(o => `
                <div class="org-picker-item" onclick="selectOrgForProject('${o.id}','${esc(o.name)}','${esc(o.code||'')}','${esc(o.industry||'')}','${esc(o.phone||'')}')">
                    <div class="org-picker-item-icon"><span class="material-icons-outlined">business</span></div>
                    <div class="org-picker-item-body">
                        <div class="org-picker-item-name">${esc(o.name)}</div>
                        <div class="org-picker-item-meta">${[o.industry, o.phone].filter(Boolean).map(esc).join(' &bull; ') || '&mdash;'}</div>
                    </div>
                    ${o.code ? `<span class="org-picker-code-badge">${esc(o.code)}</span>` : ''}
                </div>`).join('');
        } catch(e) { results.innerHTML = ''; }
    }, 280);
}

function selectOrgForProject(id, name, code, industry, phone) {
    document.getElementById('apOrgId').value = id;
    document.getElementById('apOrgSearch').value = '';
    document.getElementById('apOrgResults').innerHTML = '';
    document.getElementById('apOrgSelName').textContent = name;
    const meta = [code, industry, phone].filter(Boolean).join(' · ');
    document.getElementById('apOrgSelMeta').textContent = meta || '';
    document.getElementById('apOrgSelected').style.display = 'flex';
}

function clearOrgSelection() {
    document.getElementById('apOrgId').value = '';
    document.getElementById('apOrgSearch').value = '';
    document.getElementById('apOrgSelected').style.display = 'none';
}
function openAddOrgInline() { openModal('addOrgModal'); document.getElementById('addOrgModal').dataset.inline = 'true'; }

// Close org picker dropdown on outside click
document.addEventListener('click', e => {
    const wrap = document.getElementById('apOrgPickerWrap');
    if (wrap && !wrap.contains(e.target)) {
        document.getElementById('apOrgResults').innerHTML = '';
    }
});

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
        addresses: [], contacts: []
    };
    const res = await fetch(API + '/projects', { method: 'POST', headers: HEADERS, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) {
        alert('Project created!');
        document.querySelectorAll('#sec-addproject input:not([type=hidden]), #sec-addproject select').forEach(el => { el.value = el.tagName === 'SELECT' ? el.options[0].value : ''; });
        clearOrgSelection();
        loadAddProjectSideData();
        showSection('projects');
    } else { alert(data.message); }
}
