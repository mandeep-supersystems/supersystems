// ─── HR MODULE: CODE CRITERIA ───
async function loadCriteria() {
    const res = await fetch(API + '/code-criteria', { headers: headers() });
    const data = await res.json();
    criteriaList = data.data || [];
    renderCriteriaTable();
}

function renderCriteriaTable() {
    const tbody = document.getElementById('criteriaTableBody');
    if (!criteriaList.length) { tbody.innerHTML = '<tr><td colspan="8" class="empty">No code criteria defined yet</td></tr>'; return; }
    tbody.innerHTML = criteriaList.map(c => {
        const next = c.current_sequence + 1;
        const preview = buildPreview(c.prefix, c.prefix_separator, next, c.suffix_separator, c.suffix);
        return `<tr>
            <td><strong>${c.name}</strong></td>
            <td><span class="preview-code">${preview}</span></td>
            <td>${c.prefix || '—'}</td><td>${c.prefix_separator || '—'}</td>
            <td>${next}</td><td>${c.suffix_separator || '—'}</td><td>${c.suffix || '—'}</td>
            <td class="actions-cell">
                <button class="btn-icon" title="Edit" onclick="openEditCriteria('${c.id}')"><span class="material-icons-outlined">edit</span></button>
                <button class="btn-icon danger" title="Delete" onclick="confirmDeleteCriteria('${c.id}','${c.name}')"><span class="material-icons-outlined">delete</span></button>
            </td>
        </tr>`;
    }).join('');
}

function openCreateCriteriaModal() {
    document.getElementById('ccName').value = '';
    document.getElementById('ccPrefix').value = '';
    document.getElementById('ccPrefixSep').value = '';
    document.getElementById('ccCodeStart').value = '1';
    document.getElementById('ccSuffixSep').value = '';
    document.getElementById('ccSuffix').value = '';
    updateCreatePreview();
    openModal('createCriteriaModal');
}

function updateCreatePreview() {
    document.getElementById('ccPreview').textContent = buildPreview(
        document.getElementById('ccPrefix').value, document.getElementById('ccPrefixSep').value,
        document.getElementById('ccCodeStart').value || '1',
        document.getElementById('ccSuffixSep').value, document.getElementById('ccSuffix').value
    );
}

async function saveCriteria(e) {
    e.preventDefault();
    const body = {
        name: document.getElementById('ccName').value.trim(),
        prefix: document.getElementById('ccPrefix').value.trim(),
        prefix_separator: document.getElementById('ccPrefixSep').value,
        code_start: parseInt(document.getElementById('ccCodeStart').value),
        suffix_separator: document.getElementById('ccSuffixSep').value,
        suffix: document.getElementById('ccSuffix').value.trim()
    };
    const res = await fetch(API + '/code-criteria', { method: 'POST', headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('createCriteriaModal'); loadCriteria(); } else { alert(data.message); }
}

function openEditCriteria(id) {
    const c = criteriaList.find(x => x.id === id);
    if (!c) return;
    document.getElementById('ecId').value = c.id;
    document.getElementById('ecName').value = c.name;
    document.getElementById('ecPrefix').value = c.prefix || '';
    document.getElementById('ecPrefixSep').value = c.prefix_separator || '';
    document.getElementById('ecCodeStart').value = c.code_start;
    document.getElementById('ecSuffixSep').value = c.suffix_separator || '';
    document.getElementById('ecSuffix').value = c.suffix || '';
    updateEditPreview();
    openModal('editCriteriaModal');
}

function updateEditPreview() {
    document.getElementById('ecPreview').textContent = buildPreview(
        document.getElementById('ecPrefix').value, document.getElementById('ecPrefixSep').value,
        document.getElementById('ecCodeStart').value || '1',
        document.getElementById('ecSuffixSep').value, document.getElementById('ecSuffix').value
    );
}

async function updateCriteria(e) {
    e.preventDefault();
    const id = document.getElementById('ecId').value;
    const body = {
        name: document.getElementById('ecName').value.trim(),
        prefix: document.getElementById('ecPrefix').value.trim(),
        prefix_separator: document.getElementById('ecPrefixSep').value,
        code_start: parseInt(document.getElementById('ecCodeStart').value),
        suffix_separator: document.getElementById('ecSuffixSep').value,
        suffix: document.getElementById('ecSuffix').value.trim()
    };
    const res = await fetch(API + '/code-criteria/' + id, { method: 'PUT', headers: headers(), body: JSON.stringify(body) });
    const data = await res.json();
    if (data.success) { closeModal('editCriteriaModal'); loadCriteria(); } else { alert(data.message); }
}

function confirmDeleteCriteria(id, name) {
    document.getElementById('deleteMsg').textContent = `Are you sure you want to delete criteria "${name}"?`;
    document.getElementById('deleteConfirmBtn').onclick = async () => {
        const res = await fetch(API + '/code-criteria/' + id, { method: 'DELETE', headers: headers() });
        const data = await res.json();
        if (data.success) { closeModal('deleteConfirmModal'); loadCriteria(); } else { alert(data.message); }
    };
    openModal('deleteConfirmModal');
}

// Live preview listeners
['ccPrefix','ccPrefixSep','ccCodeStart','ccSuffixSep','ccSuffix'].forEach(id => { const el = document.getElementById(id); if (el) { el.addEventListener('input', updateCreatePreview); } });
['ecPrefix','ecPrefixSep','ecCodeStart','ecSuffixSep','ecSuffix'].forEach(id => { const el = document.getElementById(id); if (el) { el.addEventListener('input', updateEditPreview); } });
