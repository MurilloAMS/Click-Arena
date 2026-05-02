const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const app = express();
app.use(cors());
app.use(express.json());

const client = new MercadoPagoConfig({
  accessToken: "siUM0YNkFaqAknXaIHc39kbgW5dXf11R"
});

const payment = new Payment(client);

// 💾 "banco fake"
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

        notification_url: "https://SEU-SITE.com/webhook"
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

        // 👉 AQUI VOCÊ ATUALIZA O SALDO DO USUÁRIO
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
// =============================
// 🚀 INICIAR SERVIDOR
// =============================
app.listen(3000, () => {
  console.log("🔥 Servidor rodando na porta 3000");
});