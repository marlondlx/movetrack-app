const API_URL = '/api';
let html5QrcodeScanner = null; // Variável global para controle da câmera

// --- FUNÇÕES DE CARREGAMENTO ---

async function loadBoxes() {
    try {
        const res = await fetch(`${API_URL}/containers`);
        const json = await res.json();
        
        // Cria as opções do Select
        const options = '<option value="">Selecione...</option>' + 
            json.data.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
        
        // Atualiza os dois selects da tela
        document.getElementById('boxSelect').innerHTML = options;
        document.getElementById('boxSelectConf').innerHTML = options;
    } catch (e) {
        console.error("Erro ao carregar caixas", e);
    }
}

// --- AÇÕES DO USUÁRIO ---

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
    
    // Mostra o QR Code gerado
    document.getElementById('qr-result').innerHTML = `
        <div class="qr-display">
            <img src="${data.qr_code}">
            <p><strong>${data.name}</strong></p>
            <small>Cole na caixa (ID: ${data.id})</small>
        </div>`;
    
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
    
    alert('Item salvo com sucesso!');
    
    // Limpa campos
    document.getElementById('itemName').value = '';
    document.getElementById('itemValue').value = '';
    
    // Se a caixa da conferência for a mesma, atualiza a lista visualmente
    if(document.getElementById('boxSelectConf').value == container_id) {
        loadItems(container_id);
    }
}

async function loadItems(boxId) {
    if(!boxId) return;
    
    // Sincroniza o select visual (caso venha do QR Code)
    document.getElementById('boxSelectConf').value = boxId;

    const res = await fetch(`${API_URL}/containers/${boxId}/items`);
    const data = await res.json();
    const list = document.getElementById('itemsList');
    
    if(data.items.length === 0) { 
        list.innerHTML = '<p align="center" style="padding:20px;">Esta caixa está vazia.</p>'; 
        return; 
    }

    let total = 0;
    // Monta o HTML da lista
    list.innerHTML = data.items.map(item => {
        total += parseFloat(item.current_value);
        return `
        <div class="item-card">
            <div>
                <strong>${item.name}</strong><br>
                <small>Data: ${item.acquisition_date || '-'}</small>
            </div>
            <div style="text-align:right">
                <div class="badge">Hoje: R$ ${item.current_value}</div>
                <small style="color:#999">Pago: ${item.value}</small>
            </div>
        </div>`;
    }).join('') + 
    `<div style="text-align:right; margin-top:15px; font-weight:bold; border-top:1px solid #ccc; padding-top:10px;">
        Valor Total Atual: R$ ${total.toFixed(2)}
    </div>`;
}

// --- LÓGICA DO QR CODE (CÂMERA) ---

function startScanner() {
    const readerDiv = document.getElementById('reader');
    readerDiv.style.display = 'block'; // Mostra a área da câmera

    if(html5QrcodeScanner) return; // Se já iniciou, não faz nada

    html5QrcodeScanner = new Html5Qrcode("reader");
    
    const config = { fps: 10, qrbox: { width: 250, height: 250 } };
    
    // Tenta usar a câmera traseira ('environment')
    html5QrcodeScanner.start({ facingMode: "environment" }, config, onScanSuccess)
    .catch(err => {
        alert("Erro ao abrir câmera: " + err);
    });
}

function onScanSuccess(decodedText, decodedResult) {
    // Tenta ler o JSON do QR Code
    try {
        const data = JSON.parse(decodedText);
        
        if (data.type === 'box' && data.id) {
            // Vibra o celular se suportado
            if (navigator.vibrate) navigator.vibrate(200);

            alert(`📦 Caixa "${data.id}" encontrada! Carregando itens...`);
            
            // Para a câmera e esconde
            html5QrcodeScanner.stop().then(() => {
                document.getElementById('reader').style.display = 'none';
                html5QrcodeScanner = null;
            });

            // Carrega os itens automaticamente
            loadItems(data.id);
        }
    } catch (e) {
        console.log("QR Code lido não é do sistema MoveTrack");
    }
}

// Inicializa carregando as caixas
loadBoxes();