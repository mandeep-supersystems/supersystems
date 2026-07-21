// QUALITY MANAGEMENT MODULE USERS JS
const QTY_SECTIONS = [
    { id: 'overview',     label: 'Overview',                icon: 'dashboard' },
    { id: 'iqc',          label: 'Incoming Quality Control (IQC)', icon: 'fact_check' },
    { id: 'criteria',     label: 'IQC Criteria Master',     icon: 'tune' },
    { id: 'ncr',          label: 'Non-Conformance Reports', icon: 'report_problem' },
    { id: 'auditlogs',    label: 'Audit Logs',              icon: 'history' },
    { id: 'moduleusers',  label: 'Module Users',            icon: 'people' }
];

async function loadModuleUsers() {
    const tbody = document.getElementById('moduleUsersBody');
    if (!tbody) return;
    try {
        const res = await fetch(API + '/users', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
            tbody.innerHTML = json.data.map(u => `
                <tr>
                    <td><strong>${u.first_name} ${u.last_name}</strong></td>
                    <td>${u.email}</td>
                    <td><span class="badge badge-info">${u.role}</span></td>
                    <td><span class="badge badge-success">Full Quality Access</span></td>
                    <td>${u.created_at || '-'}</td>
                    <td><button class="btn-action" title="Edit Access"><span class="material-icons-outlined">edit</span></button></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No custom user access granted.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading module users.</td></tr>';
    }
}
