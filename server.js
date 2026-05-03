require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new Payment(client);

let jogadores = {};
let usuarios = {};
let pagamentosProcessados = new Set();
let historico = {};
let saques = [];

// =============================
// 💰 CRIAR PAGAMENTO (PIX)
// =============================
app.post("/criar-pagamento", async (req, res) => {
  const { valor, userId } = req.body;

  try {
    const pagamento = await payment.create({
      body: {
        transaction_amount: Number(valor),
        description: "Deposito Click Arena",
        payment_method_id: "pix",

        payer: {
          email: "usuario@seudominio.com"
        },

        external_reference: userId,

        notification_url: "https://clique-arena.up.railway.app/webhook"
      }
    });

    res.json({
      id: pagamento.id,
      qr_code: pagamento.point_of_interaction.transaction_data.qr_code,
      qr_base64: pagamento.point_of_interaction.transaction_data.qr_code_base64
    });

  } catch (err) {
    console.log(err);
    res.status(500).json({ erro: err.message });
  }
});

// =============================
// 🔔 WEBHOOK (CONFIRMA PAGAMENTO)
// =============================
app.post("/webhook", async (req, res) => {
  try {
    const data = req.body;

    if (data.type === "payment") {
      const paymentId = data.data.id;

      const pagamento = await payment.get({ id: paymentId });

      if (pagamento.status === "approved") {
        const userId = pagamento.external_reference;
        const valor = pagamento.transaction_amount;

        console.log("💰 PAGAMENTO APROVADO:", userId, valor);

        if (!usuarios[userId]) {
          usuarios[userId] = { saldo: 0 };
        }

        usuarios[userId].saldo += valor;
      }
    }

    res.sendStatus(200);

  } catch (err) {
    console.log("Erro webhook:", err);
    res.sendStatus(500);
  }
});

// =============================
// 💸 SACAR DINHEIRO
// =============================
app.post("/sacar", (req, res) => {
  const { valor, userId } = req.body;

  if (!usuarios[userId]) {
    return res.status(404).send("Usuário não encontrado");
  }

  if (usuarios[userId].saldo < valor) {
    return res.status(400).send("Saldo insuficiente");
  }

  usuarios[userId].saldo -= valor;

  saques.push({
    userId,
    valor,
    status: "pendente",
    data: new Date()
  });

  historico[userId].push({
  tipo: "Saque",
  valor,
  data: new Date()
});

  console.log("📤 Saque solicitado:", valor);

  res.send("Saque solicitado com sucesso");
});

app.get("/historico/:userId", (req, res) => {
  const { userId } = req.params;
  res.json(historico[userId] || []);
});

// =============================
// 📊 CONSULTAR SALDO
// =============================
app.get("/saldo/:userId", (req, res) => {
  const { userId } = req.params;

  // 🔥 cria usuário automaticamente se não existir
  if (!usuarios[userId]) {
    usuarios[userId] = { saldo: 0 };
  }

  res.json({ saldo: usuarios[userId].saldo });
});

app.post("/click", (req, res) => {
  const { userId, timestamp } = req.body;

  if (!jogadores[userId]) {
    jogadores[userId] = {
      cliques: 0,
      ultimoClique: 0,
      historico: []
    };
  }

  let jogador = jogadores[userId];

  // 🚫 bloqueia clique muito rápido
  if (timestamp - jogador.ultimoClique < 80) {
    return res.json({ ok: false });
  }

  jogador.ultimoClique = timestamp;
  jogador.cliques++;

  // 🧠 histórico anti-bot
  jogador.historico.push(timestamp);

  if (jogador.historico.length > 10) {
    jogador.historico.shift();
  }

  // 🚨 detectar padrão robótico
  if (jogador.historico.length === 10) {
    let intervalos = [];

    for (let i = 1; i < jogador.historico.length; i++) {
      intervalos.push(jogador.historico[i] - jogador.historico[i - 1]);
    }

    let variacao = Math.max(...intervalos) - Math.min(...intervalos);

    if (variacao < 10) {
      console.log("🚨 BOT DETECTADO:", userId);
    }
  }

  res.json({ ok: true, cliques: jogador.cliques });
});

// 🔥 caminho correto para frontend
const frontendPath = process.cwd();

app.use(express.static(frontendPath));

app.get("/", (req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});
// 🔥 teste
app.get("/ping", (req, res) => {
  res.send("pong");
});

// 🔥 porta (Railway usa PORT automático)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});