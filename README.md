# 📦 MoveTrack

Aplicativo Full-Stack para gestão de mudanças e inventário pessoal. O sistema permite criar caixas, gerar etiquetas QR Code e catalogar itens, calculando automaticamente a depreciação do valor.

## 🚀 Funcionalidades

- **Gerar Etiquetas:** Criação automática de QR Codes para colar nas caixas.
- **Leitura via Câmera:** Scanner integrado para ler o QR Code e listar o conteúdo da caixa instantaneamente.
- **Cálculo de Depreciação:** Algoritmo que calcula quanto o item vale hoje baseado na data de compra.
- **Banco de Dados:** Persistência de dados com SQLite.

## 🛠 Tecnologias

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla).
- **Backend:** Node.js, Express.
- **Banco de Dados:** SQLite3.
- **Libs:** html5-qrcode, qrcode, body-parser.

## 📦 Como rodar

1. Clone o repositório.
2. Instale as dependências: `npm install`
3. Rode o servidor: `node app.js`
4. Acesse: `http://localhost:3000`
