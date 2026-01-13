const API_URL = '/api';
let html5QrcodeScanner = null;

async function loadBoxes() {
    try {
        const res = await fetch(`${API_URL}/containers`);
        const json = await res.json();
        
        // Guarda a caixa selecionada atualmente (se houver)
        const currentSelection = document.getElementById('boxSelectConf').value;

        const options = '<option value="">Selecione...</option>' + 
            json.data.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        
        document.getElementById('boxSelect').innerHTML = options;
        document.getElementById('boxSelectConf').innerHTML = options;
        
        // Tenta manter a seleção anterior após recarregar
        if(currentSelection) document.getElementById('boxSelectConf').value = currentSelection;
        
    } catch (e) {
        console.error("Erro ao carregar caixas", e);
    }
}

async function createBox() {
    const name = document.getElementById('boxName').value;
    const desc = document.getElementById('boxDesc').value;
    if(!name) return alert('O nome da caixa é obrigatório!');

    const res = await fetch(`${API_URL}/containers`, {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name, description: desc })
    });
    const data = await res.json();
    
    document.getElementById('qr-result').innerHTML = `
        <div class="qr-display">
            <img src="${data.qr_code}">
            <p><strong>${data.name}</strong></p>
            <small>ID: ${data.id}</small>
        </div>`;
    
    loadBoxes();
    document.getElementById('boxName').value = '';
    document.getElementById('boxDesc').value = '';
}

async function addItem() {
    const container_id = document.getElementById('boxSelect').value;
    const name = document.getElementById('itemName').value;
    const value = document.getElementById('itemValue').value;
    const date = document.getElementById('itemDate').value;
    
    if(!container_id || !name) return alert('Selecione a caixa e digite o nome do item!');

    await fetch(`${API_URL}/items`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ container_id, name, value, acquisition_date: date, photo_url: '' })
    });
    
    document.getElementById('itemName').value = '';
    document.getElementById('itemValue').value = '';
    
    // Atualiza a lista se estiver vendo a mesma caixa
    if(document.getElementById('boxSelectConf').value == container_id) {
        loadItems(container_id);
    } else {
        alert('Item salvo!');
    }
}

async function loadItems(boxId) {
    if(!boxId) {
        document.getElementById('itemsList').innerHTML = '';
        return;
    }
    
    document.getElementById('boxSelectConf').value = boxId;

    const res = await fetch(`${API_URL}/containers/${boxId}/items`);
    const data = await res.json();
    const list = document.getElementById('itemsList');
    
    // --- CABEÇALHO DA CAIXA COM BOTÃO DE EDITAR ---
    // Pega o nome da caixa selecionada no select
    const boxSelect = document.getElementById('boxSelectConf');
    const boxName = boxSelect.options[boxSelect.selectedIndex].text;

    let html = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #ddd;">
            <span style="color:#666; font-size:0.9em;">Editando: <strong>${boxName}</strong></span>
            <button onclick="editBox(${boxId}, '${boxName}')" style="width:auto; padding:5px 10px; margin:0; font-size:0.8em; background:#f59e0b;">✏️ Editar Nome</button>
        </div>
    `;

    if(data.items.length === 0) { 
        html += '<p align="center" style="padding:20px; color:#999;">Caixa vazia.</p>'; 
    } else {
        let total = 0;
        html += data.items.map(item => {
            total += parseFloat(item.current_value);
            return `
            <div class="item-card">
                <div>
                    <strong>${item.name}</strong><br>
                    <small>Data: ${item.acquisition_date || '-'}</small>
                </div>
                <div style="text-align:right; display:flex; align-items:center; gap:10px;">
                    <div>
                        <div class="badge">R$ ${item.current_value}</div>
                        <small style="color:#999">Pago: ${item.value}</small>
                    </div>
                    <button onclick="deleteItem(${item.id}, ${boxId})" style="width:auto; padding:8px; margin:0; background:#ef4444;">🗑️</button>
                </div>
            </div>`;
        }).join('');
        
        html += `<div style="text-align:right; margin-top:15px; font-weight:bold; border-top:1px solid #ccc; padding-top:10px;">
            Total: R$ ${total.toFixed(2)}
        </div>`;
    }

    list.innerHTML = html;
}

// --- NOVAS FUNÇÕES: EDITAR E DELETAR ---

async function deleteItem(itemId, boxId) {
    if(!confirm("Tem certeza que quer apagar este item?")) return;

    await fetch(`${API_URL}/items/${itemId}`, { method: 'DELETE' });
    loadItems(boxId); // Recarrega a lista
}

async function editBox(boxId, oldName) {
    // Usamos um prompt simples do navegador para evitar criar modais complexos
    const newName = prompt("Novo nome para a caixa:", oldName);
    if(newName && newName !== oldName) {
        const newDesc = prompt("Nova descrição (opcional):", "");
        
        await fetch(`${API_URL}/containers/${boxId}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ name: newName, description: newDesc })
        });

        alert("Caixa atualizada!");
        await loadBoxes(); // Atualiza os dropdowns com o nome novo
        loadItems(boxId);  // Atualiza o cabeçalho
    }
}

// --- SCANNER ---
function startScanner() {
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block';
    if(html5QrcodeScanner) return;
    html5QrcodeScanner = new Html5Qrcode("reader");
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => alert("Erro câmera: " + err));
}

function onScanSuccess(decodedText) {
    try {
        const data = JSON.parse(decodedText);
        if (data.type === 'box' && data.id) {
            if (navigator.vibrate) navigator.vibrate(200);
            alert(`Caixa encontrada!`);
            html5QrcodeScanner.stop().then(() => {
                document.getElementById('reader').style.display = 'none';
                html5QrcodeScanner = null;
            });
            loadItems(data.id);
        }
    } catch (e) { console.log("QR inválido"); }
}

loadBoxes();