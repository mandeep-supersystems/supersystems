// ─── HR USER MANAGEMENT JS ───
let usersList = [];

// openModal/closeModal already defined in common.js

async function loadUsers() {
    try {
        const res = await fetch(`${API}/module-users`, { headers: headers() });
        const d = await res.json();
        usersList = d.data || [];
        const tbody = document.getElementById('usersBody');
        if (!usersList.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No users added to HR module</td></tr>'; return; }
        tbody.innerHTML = usersList.map(u => `<tr>
            <td><strong>${u.user_name || '—'}</strong></td>
            <td>${u.user_email}</td>
            <td><span class="status-badge ${u.hr_role}">${u.hr_role.replace('_',' ')}</span></td>
            <td>${u.emp_code || '—'}</td>
            <td>${u.is_active ? '<span class="status-badge active">Yes</span>' : '<span class="status-badge inactive">No</span>'}</td>
            <td>${u.created_at ? u.created_at.substring(0,10) : '—'}</td>
            <td class="actions-cell">
                <button class="btn-icon" onclick="editUser('${u.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" onclick="removeUser('${u.id}','${u.user_email}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`).join('');
    } catch (e) {
        const tbody = document.getElementById('usersBody');
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" class="empty">Failed to load users. Please run the HR migration SQL first.</td></tr>';
    }
}

function openUserModal() {
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').textContent = 'Add HR User';
    document.getElementById('userEmail').value = '';
    document.getElementById('userName').value = '';
    document.getElementById('userRole').value = 'employee';
    document.getElementById('userActive').value = 'true';
    openModal('userModal');
}

function editUser(id) {
    const u = usersList.find(x => x.id === id);
    if (!u) return;
    document.getElementById('userId').value = u.id;
    document.getElementById('userModalTitle').textContent = 'Edit HR User';
    document.getElementById('userEmail').value = u.user_email;
    document.getElementById('userName').value = u.user_name;
    document.getElementById('userRole').value = u.hr_role;
    document.getElementById('userActive').value = String(u.is_active);
    openModal('userModal');
}

async function saveUser() {
    const id = document.getElementById('userId').value;
    const body = {
        user_email: document.getElementById('userEmail').value.trim(),
        user_name: document.getElementById('userName').value.trim(),
        hr_role: document.getElementById('userRole').value,
        is_active: document.getElementById('userActive').value === 'true'
    };
    if (!body.user_email) { alert('Email required'); return; }
    const url = id ? `${API}/module-users/${id}` : `${API}/module-users`;
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) });
    const d = await res.json();
    if (d.success) { closeModal('userModal'); loadUsers(); } else { alert(d.message); }
}

async function removeUser(id, email) {
    if (!confirm(`Remove "${email}" from HR module?`)) return;
    const res = await fetch(`${API}/module-users/${id}`, { method: 'DELETE', headers: headers() });
    const d = await res.json();
    if (d.success) loadUsers(); else alert(d.message);
}

document.addEventListener('DOMContentLoaded', () => { loadUsers(); });
