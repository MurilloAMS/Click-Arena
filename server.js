require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const { createClient } = require("@supabase/supabase-js");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new Payment(client);

let jogadores = {};

// =============================
// 👤 CADASTRO
// =============================
app.post("/cadastro", async (req, res) => {
  const { nome, email, senha, foto_base64 } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Preencha todos os campos" });
  }

  const { data: existe } = await supabase
    .from("usuarios")
    .select("id")
    .eq("email", email)
    .single();

  if (existe) {
    return res.status(400).json({ erro: "E-mail já cadastrado" });
  }

  let foto_url = null;

  if (foto_base64) {
    const buffer = Buffer.from(foto_base64.split(",")[1], "base64");
    const filename = `${Date.now()}-${email}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("fotos")
      .upload(filename, buffer, { contentType: "image/jpeg" });

    if (!uploadError) {
      const { data: urlData } = supabase.storage
        .from("fotos")
        .getPublicUrl(filename);
      foto_url = urlData.publicUrl;
    }
  }

  const { data: novoUser, error } = await supabase
    .from("usuarios")
    .insert([{ nome, email, senha, foto_url, saldo: 0, partidas: 0, vitorias: 0 }])
    .select()
    .single();

  if (error) {
    return res.status(500).json({ erro: error.message });
  }

  res.json({
    ok: true,
    usuario: {
      id: novoUser.id,
      nome: novoUser.nome,
      email: novoUser.email,
      foto_url: novoUser.foto_url,
      saldo: novoUser.saldo,
      partidas: novoUser.partidas,
      vitorias: novoUser.vitorias
    }
  });
});

// =============================
// 🔐 LOGIN
// =============================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Preencha e-mail e senha" });
  }

  const { data: usuario, error } = await supabase
    .from("usuarios")
    .select("*")
    .eq("email", email)
    .eq("senha", senha)
    .single();

  if (error || !usuario) {
    return res.status(401).json({ erro: "E-mail ou senha incorretos" });
  }

  res.json({
    ok: true,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      foto_url: usuario.foto_url,
      saldo: usuario.saldo,
      partidas: usuario.partidas,
      vitorias: usuario.vitorias
    }
  });
});

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
        payer: { email: "usuario@seudominio.com" },
        external_reference: userId,
        notification_url: "https://click-arena-ypsh.onrender.com/webhook"
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
// 🔔 WEBHOOK
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

        const { data: usuario } = await supabase
          .from("usuarios")
          .select("saldo")
          .eq("id", userId)
          .single();

        if (usuario) {
          await supabase
            .from("usuarios")
            .update({ saldo: (usuario.saldo || 0) + valor })
            .eq("id", userId);

          await supabase
            .from("historico")
            .insert([{ user_id: userId, tipo: "Depósito", valor }]);
        }
      }
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("Erro webhook:", err);
    res.sendStatus(500);
  }
});

// =============================
// 💸 SACAR
// =============================
app.post("/sacar", async (req, res) => {
  const { valor, userId } = req.body;

  const { data: usuario } = await supabase
    .from("usuarios")
    .select("saldo, nome, email")
    .eq("id", userId)
    .single();

  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
  if (usuario.saldo < valor) return res.status(400).json({ erro: "Saldo insuficiente" });

  await supabase
    .from("usuarios")
    .update({ saldo: usuario.saldo - valor })
    .eq("id", userId);

  await supabase
    .from("historico")
    .insert([{ user_id: userId, tipo: "Saque", valor }]);

  res.json({ ok: true, mensagem: "Pedido de saque realizado com sucesso, em até 48h o saque será realizado" });
});

// =============================
// 📋 HISTÓRICO
// =============================
app.get("/historico/:userId", async (req, res) => {
  const { data } = await supabase
    .from("historico")
    .select("*")
    .eq("user_id", req.params.userId)
    .order("data", { ascending: false });

  res.json(data || []);
});

// =============================
// 📊 SALDO
// =============================
app.get("/saldo/:userId", async (req, res) => {
  const { data: usuario } = await supabase
    .from("usuarios")
    .select("saldo")
    .eq("id", req.params.userId)
    .single();

  res.json({ saldo: usuario ? usuario.saldo : 0 });
});

// =============================
// 🏆 RANKING
// =============================
app.get("/ranking", async (req, res) => {
  const hoje = new Date().toISOString().split("T")[0];

  const { data } = await supabase
    .from("ranking_diario")
    .select("*")
    .eq("dia", hoje)
    .order("ganho", { ascending: false })
    .limit(10);

  res.json(data || []);
});

// =============================
// 🖼️ ATUALIZAR FOTO
// =============================
app.post("/atualizar-foto", async (req, res) => {
  const { userId, foto_base64 } = req.body;

  const buffer = Buffer.from(foto_base64.split(",")[1], "base64");
  const filename = `${Date.now()}-${userId}.jpg`;

  const { error } = await supabase.storage
    .from("fotos")
    .upload(filename, buffer, { contentType: "image/jpeg" });

  if (error) return res.status(500).json({ erro: error.message });

  const { data: urlData } = supabase.storage
    .from("fotos")
    .getPublicUrl(filename);

  await supabase
    .from("usuarios")
    .update({ foto_url: urlData.publicUrl })
    .eq("id", userId);

  res.json({ ok: true, foto_url: urlData.publicUrl });
});

// =============================
// 🖱️ CLIQUE
// =============================
app.post("/click", (req, res) => {
  const { userId, timestamp } = req.body;

  if (!jogadores[userId]) {
    jogadores[userId] = { cliques: 0, ultimoClique: 0, historico: [] };
  }

  const jogador = jogadores[userId];

  if (timestamp - jogador.ultimoClique < 80) return res.json({ ok: false });

  jogador.ultimoClique = timestamp;
  jogador.cliques++;
  jogador.historico.push(timestamp);
  if (jogador.historico.length > 10) jogador.historico.shift();

  if (jogador.historico.length === 10) {
    const intervalos = jogador.historico.slice(1).map((t, i) => t - jogador.historico[i]);
    const variacao = Math.max(...intervalos) - Math.min(...intervalos);
    if (variacao < 10) console.log("🚨 BOT:", userId);
  }

  res.json({ ok: true, cliques: jogador.cliques });
});

// =============================
// 📁 ESTÁTICOS + ROTA PRINCIPAL
// =============================
app.use(express.static(path.join(__dirname)));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// =============================
// 🚀 SERVIDOR
// =============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));