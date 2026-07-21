// BINS & QR JS
async function loadBins() {
    const container = document.getElementById('binGridContainer');
    try {
        const res = await fetch(API + '/bins', { headers: HEADERS });
        const json = await res.json();
        if (json.success && json.data.length > 0) {
            container.innerHTML = json.data.map(b => `
                <div class="bin-qr-card">
                    <img src="${b.qr_code}" alt="QR">
                    <strong style="font-size:15px; color:var(--text-primary);">${b.bin_code}</strong>
                    <div style="font-size:11px; color:var(--text-muted); margin-top:2px;">Zone: ${b.zone_code} | ${b.warehouse_code}</div>
                    <div style="margin-top:6px; font-size:12px;">Cap: <strong>${b.current_units}/${b.capacity_units}</strong></div>
                    <div style="margin-top:10px; display:flex; gap:6px;">
                        <a href="/warehouse/bin/${b.bin_code}" target="_blank" class="btn-outline" style="font-size:11px; padding:4px 8px;">View Detail</a>
                    </div>
                </div>
            `).join('');
        } else {
            container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px;">No bins created.</div>';
        }
    } catch (e) {
        container.innerHTML = '<div style="grid-column: 1/-1; text-align:center; padding:20px; color:red;">Error loading bins.</div>';
    }
}

function openNewBinModal() {
    openModal('Create Storage Bin with Server QR Code', `
        <div class="form-group">
            <label>Bin Code (e.g. A-01-01)</label>
            <input type="text" id="binCodeInput" placeholder="A-01-01">
        </div>
        <div class="form-group">
            <label>Zone Code</label>
            <input type="text" id="binZoneInput" value="Z1">
        </div>
        <div style="display:flex; gap:10px;">
            <div class="form-group" style="flex:1;">
                <label>Aisle</label>
                <input type="text" id="binAisle" value="A">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Rack</label>
                <input type="text" id="binRack" value="01">
            </div>
            <div class="form-group" style="flex:1;">
                <label>Level</label>
                <input type="text" id="binLevel" value="01">
            </div>
        </div>
        <div class="form-actions">
            <button class="btn-outline" onclick="closeModal()">Cancel</button>
            <button class="btn-primary" onclick="submitNewBin()">Create Bin & QR</button>
        </div>
    `);
}

async function submitNewBin() {
    const payload = {
        bin_code: document.getElementById('binCodeInput').value,
        zone_code: document.getElementById('binZoneInput').value,
        aisle: document.getElementById('binAisle').value,
        rack: document.getElementById('binRack').value,
        level: document.getElementById('binLevel').value
    };

    try {
        const res = await fetch(API + '/bins', {
            method: 'POST', headers: HEADERS, body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (json.success) {
            showToast(json.message);
            closeModal();
            loadBins();
        } else { showToast(json.message, 'error'); }
    } catch (e) { showToast('Error creating bin', 'error'); }
}

function openPrintLabelSheet() {
    window.open('/warehouse/bins', '_blank');
}
