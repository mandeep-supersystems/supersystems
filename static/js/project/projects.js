// ─── PROJECT MODULE: ALL PROJECTS ───
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
            <td>${p.start_date}</td><td>${p.due_date}</td>
            <td><div class="progress-bar"><div class="progress-fill" style="width:${p.percent_complete}%"></div><span>${p.percent_complete}%</span></div></td>
            <td class="actions-cell">
                <button class="btn-icon" title="View" onclick="openProject('${p.id}')"><span class="material-icons-outlined">visibility</span></button>
                <button class="btn-icon danger" title="Delete" onclick="deleteProject('${p.id}','${esc(p.project_name)}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch (e) { tbody.innerHTML = '<tr><td colspan="9" class="empty">Error loading projects</td></tr>'; }
}

async function deleteProject(id, name) {
    if (!confirm(`Delete project "${name}" and all its tasks?`)) return;
    const res = await fetch(API + '/projects/' + id, { method: 'DELETE', headers: HEADERS });
    const data = await res.json();
    if (data.success) loadProjects(); else alert(data.message);
}
