const API_URL = '/api';
let html5QrcodeScanner = null;

async function loadBoxes() {
    try {
        const res = await fetch(`${API_URL}/containers`);
        const json = await res.json();
        
        // Guarda seleção atual
        const currentConf = document.getElementById('boxSelectConf').value;

        const options = '<option value="">Selecione...</option>' + 
            json.data.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        
        // Atualiza TODOS os selects (agora são 3)
        document.getElementById('boxSelect').innerHTML = options;      // Cadastro de Item
        document.getElementById('boxSelectConf').innerHTML = options;  // Conferência
        document.getElementById('boxSelectPrint').innerHTML = options; // NOVO: Impressão
        
        if(currentConf) document.getElementById('boxSelectConf').value = currentConf;
        
    } catch (e) { console.error("Erro ao carregar caixas", e); }
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
    
    // --- AQUI ESTÁ A MUDANÇA ---
    // Substitua a parte antiga por esta nova que tem o botão:
    document.getElementById('qr-result').innerHTML = `
        <div class="qr-display">
            <img src="${data.qr_code}">
            <p><strong>${data.name}</strong></p>
            <small>Cole na caixa (ID: ${data.id})</small>
            <br>
            <button onclick="downloadImage('${data.qr_code}', 'Etiqueta-${data.name}')" 
            style="margin-top:10px; padding:8px; font-size:0.9em; width:auto; background-color: #334155;">⬇️ Baixar</button>
        </div>`;
    // ---------------------------
    
    loadBoxes(); // Atualiza a lista
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
            <span style="color:#666; font-size:0.9em;">Caixa: <strong>${boxName}</strong></span>
            
            <div style="display:flex; gap: 5px;">
                <button onclick="editBox(${boxId}, '${boxName}')" 
                style="width:auto; padding:6px 10px; margin:0; font-size:0.8em; background:#f59e0b;">✏️ Editar</button>
                
                <button onclick="deleteBox(${boxId})" 
                style="width:auto; padding:6px 10px; margin:0; font-size:0.8em; background:#ef4444;" title="Apagar Caixa">🗑️ Caixa</button>
            </div>
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
// --- FUNÇÕES DE ETIQUETA E DOWNLOAD ---

async function showSavedQR(boxId) {
    if(!boxId) {
        document.getElementById('print-result').style.display = 'none';
        return;
    }

    // Busca os dados no backend
    const res = await fetch(`${API_URL}/containers/${boxId}/qrcode`);
    const data = await res.json();

    if(data.error) return alert(data.error);

    // Preenche a tela
    const img = document.getElementById('qrImageDisplay');
    img.src = data.qr_code;
    
    document.getElementById('qrNameDisplay').innerText = data.name;
    document.getElementById('qrIdDisplay').innerText = data.id;
    document.getElementById('print-result').style.display = 'block';

    // Configura o botão de download
    const btn = document.getElementById('btnDownload');
    btn.onclick = () => downloadImage(data.qr_code, `Etiqueta-${data.name}`);
}

function downloadImage(dataUrl, fileName) {
    // Cria um link invisível e clica nele para forçar o download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName + '.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
async function deleteBox(id) {
    // Pergunta de segurança para não apagar sem querer
    const confirmacao = confirm("PERIGO! ⚠️\n\nIsso vai apagar a CAIXA e TODOS OS ITENS dentro dela.\n\nTem certeza?");
    
    if(confirmacao) {
        await fetch(`${API_URL}/containers/${id}`, { method: 'DELETE' });
        
        alert("Caixa apagada com sucesso!");
        
        // Limpa a tela
        document.getElementById('itemsList').innerHTML = '';
        
        // Atualiza os menus para a caixa sumir da lista
        loadBoxes();
    }
}


loadBoxes();