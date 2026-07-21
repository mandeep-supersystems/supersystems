// TRANSFERS JS
async function executeTransfer() {
    const payload = {
        part_number: document.getElementById('trfPartNumber').value,
        from_warehouse_code: document.getElementById('trfFromWh').value,
        to_warehouse_code: document.getElementById('trfToWh').value,
        from_bin_code: document.getElementById('trfFromBin').value,
        to_bin_code: document.getElementById('trfToBin').value,
        qty: parseFloat(document.getElementById('trfQty').value || 0)
    };

    if (!payload.part_number || payload.qty <= 0) {
        showToast('Part number and valid quantity required', 'error');
        return;
    }

    try {
        const res = await fetch(API + '/transfers', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            showSection('stocklevels');
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Transfer failed', 'error'); }
}
