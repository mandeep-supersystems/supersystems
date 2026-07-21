// SHIPPING JS
async function loadShipments() {
    const tbody = document.getElementById('shippingBody');
    try {
        const res = await fetch(API + '/shipments', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            tbody.innerHTML = json.data.map(s => `
                <tr>
                    <td><strong>${s.shipment_no}</strong></td>
                    <td>${s.customer_name}</td>
                    <td>${s.carrier || '-'}</td>
                    <td><code>${s.tracking_no || '-'}</code></td>
                    <td>${s.dispatch_date || '-'}</td>
                    <td><span class="badge badge-info">${s.status}</span></td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">No shipments logged.</td></tr>';
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:red;">Error loading shipments.</td></tr>';
    }
}
