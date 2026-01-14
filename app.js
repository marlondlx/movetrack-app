// app.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const QRCode = require('qrcode');
const path = require('path');

const app = express();
const PORT = 3000;

// Configuração do Banco de Dados (Arquivo físico)
const db = new sqlite3.Database('movetrack.db'); 

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS containers (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, description TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, container_id INTEGER, name TEXT, photo_url TEXT, value REAL, acquisition_date TEXT, FOREIGN KEY(container_id) REFERENCES containers(id))`);
});

// Middlewares
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // Serve os arquivos da pasta public

// Lógica de Depreciação
function calculateCurrentValue(value, dateString) {
    if (!dateString) return value;
    const yearsUsage = (new Date() - new Date(dateString)) / (1000 * 60 * 60 * 24 * 365);
    const depreciationRate = 0.10; // 10% ao ano
    let current = value - (value * depreciationRate * yearsUsage);
    return current > 0 ? current.toFixed(2) : "0.00";
}

// --- ROTAS API ---
app.get('/api/containers', (req, res) => {
    db.all("SELECT * FROM containers", [], (err, rows) => res.json({ data: rows }));
});

app.post('/api/containers', (req, res) => {
    const { name, description } = req.body;
    db.run(`INSERT INTO containers (name, description) VALUES (?, ?)`, [name, description], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        const containerId = this.lastID;
        const qrData = JSON.stringify({ type: 'box', id: containerId });
        QRCode.toDataURL(qrData, (err, url) => res.json({ id: containerId, name, qr_code: url }));
    });
});

app.post('/api/items', (req, res) => {
    const { container_id, name, value, acquisition_date, photo_url } = req.body;
    db.run(`INSERT INTO items (container_id, name, value, acquisition_date, photo_url) VALUES (?, ?, ?, ?, ?)`, 
    [container_id, name, value, acquisition_date, photo_url], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ id: this.lastID, status: 'Item cadastrado!' });
    });
});

app.get('/api/containers/:id/items', (req, res) => {
    db.all(`SELECT * FROM items WHERE container_id = ?`, [req.params.id], (err, rows) => {
        if (err) return res.status(400).json({ error: err.message });
        const enrichedRows = rows.map(item => ({
            ...item,
            current_value: calculateCurrentValue(item.value, item.acquisition_date)
        }));
        res.json({ items: enrichedRows });
    });
});

// --- NOVAS ROTAS PARA EDIÇÃO E REMOÇÃO ---

// 1. Atualizar (Editar) uma Caixa
app.put('/api/containers/:id', (req, res) => {
    const { name, description } = req.body;
    db.run(`UPDATE containers SET name = ?, description = ? WHERE id = ?`, 
    [name, description, req.params.id], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Caixa atualizada com sucesso!" });
    });
});

// 2. Deletar um Item
app.delete('/api/items/:id', (req, res) => {
    db.run(`DELETE FROM items WHERE id = ?`, req.params.id, function(err) {
        if (err) return res.status(400).json({ error: err.message });
        res.json({ message: "Item deletado!" });
    });
});

// Rota para recuperar o QR Code de uma caixa existente
app.get('/api/containers/:id/qrcode', (req, res) => {
    const id = req.params.id;
    
    db.get('SELECT * FROM containers WHERE id = ?', [id], async (err, row) => {
        if (err || !row) return res.status(404).json({ error: "Caixa não encontrada" });

        // Gera o QR Code novamente com os mesmos dados
        const qrData = JSON.stringify({ type: 'box', id: row.id });
        const qrCode = await QRCode.toDataURL(qrData);

        res.json({ 
            id: row.id,
            name: row.name, 
            qr_code: qrCode 
        });
    });
});

// Rota para Deletar uma Caixa inteira (e seus itens)
app.delete('/api/containers/:id', (req, res) => {
    const id = req.params.id;
    
    // O db.serialize garante que uma coisa acontece depois da outra
    db.serialize(() => {
        // 1. Apaga todos os itens dessa caixa
        db.run('DELETE FROM items WHERE container_id = ?', [id]);
        
        // 2. Apaga a caixa
        db.run('DELETE FROM containers WHERE id = ?', [id], function(err) {
            if (err) return res.status(400).json({ error: err.message });
            res.json({ message: "Caixa deletada com sucesso!" });
        });
    });
});

app.listen(PORT, () => console.log(`🚀 MoveTrack rodando na porta ${PORT}`));