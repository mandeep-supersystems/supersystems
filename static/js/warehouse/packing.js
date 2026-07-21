// PACKING JS
async function loadPacking() {
    const tbody = document.getElementById('packingBody');
    try {
        const res = await fetch(API + '/packing', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(p => `
                <tr>
                    <td><strong>${p.packing_no}</strong></td>
                    <td>${p.customer_ref || '-'}</td>
                    <td>${p.fg_part_number}</td>
                    <td>${p.qty}</td>
                    <td>${p.box_pallet_details || 'Standard Box'}</td>
                    <td><span class="badge badge-success">${p.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No packing lists found.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading packing data.</td></tr>';
    }
}
