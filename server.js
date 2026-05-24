require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const nodemailer = require("nodemailer");
const { MercadoPagoConfig, Payment } = require("mercadopago");
const { createClient } = require("@supabase/supabase-js");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const payment = new Payment(client);
let jogadores = {};

// =============================
// ⏱️ TIMER SINCRONIZADO
// =============================
app.get("/tempo-global", (req, res) => {
  const tempo = 30 - (Math.floor(Date.now() / 1000) % 30);
  res.json({ tempo, timestamp: Date.now() });
});

// =============================
// 📧 NODEMAILER
// =============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

async function enviarEmailSaque(usuario, valor, chave_pix) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await transporter.sendMail({
    from: `"Click Arena" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `💸 Saque — R$ ${Number(valor).toFixed(2)}`,
    html: `
      <div style="font-family:Arial; max-width:500px; margin:auto; background:#0f172a; color:white; padding:30px; border-radius:12px;">
        <h2 style="color:#22c55e;">💸 Pedido de Saque</h2>
        <table style="width:100%; border-collapse:collapse;">
          <tr><td style="padding:8px 0; color:#9ca3af;">Usuário</td><td style="padding:8px 0; font-weight:bold;">${usuario.nome}</td></tr>
          <tr><td style="padding:8px 0; color:#9ca3af;">E-mail</td><td style="padding:8px 0;">${usuario.email}</td></tr>
          <tr><td style="padding:8px 0; color:#9ca3af;">Valor</td><td style="padding:8px 0; font-weight:bold; color:#22c55e; font-size:20px;">R$ ${Number(valor).toFixed(2)}</td></tr>
          <tr><td style="padding:8px 0; color:#9ca3af;">Chave PIX</td><td style="padding:8px 0; font-weight:bold;">${chave_pix}</td></tr>
          <tr><td style="padding:8px 0; color:#9ca3af;">Data/Hora</td><td style="padding:8px 0;">${agora}</td></tr>
        </table>
      </div>
    `
  });
}

async function enviarEmailReclamacao(nomeUsuario, emailUsuario, mensagem) {
  await transporter.sendMail({
    from: `"Click Arena" <${process.env.EMAIL_USER}>`,
    to: "reclameaqui.click@gmail.com",
    subject: `🚨 Nova Reclamação — ${nomeUsuario}`,
    html: `
      <div style="font-family:Arial; max-width:500px; margin:auto; background:#0f172a; color:white; padding:30px; border-radius:12px;">
        <h2 style="color:#ef4444;">🚨 Nova Reclamação</h2>
        <p><strong>Usuário:</strong> ${nomeUsuario}</p>
        <p><strong>E-mail:</strong> ${emailUsuario}</p>
        <p><strong>Mensagem:</strong></p>
        <p style="background:#1f2937; padding:15px; border-radius:8px;">${mensagem}</p>
      </div>
    `
  });
}

// =============================
// 👤 CADASTRO
// =============================
app.post("/cadastro", async (req, res) => {
  const { nome, email, senha, foto_base64, codigo_convite } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos" });

  const { data: existe } = await supabase.from("usuarios").select("id").eq("email", email).single();
  if (existe) return res.status(400).json({ erro: "E-mail já cadastrado" });

  let foto_url = null;
  if (foto_base64) {
    const buffer = Buffer.from(foto_base64.split(",")[1], "base64");
    const filename = `${Date.now()}-${email}.jpg`;
    const { error: uploadError } = await supabase.storage.from("fotos").upload(filename, buffer, { contentType: "image/jpeg" });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(filename);
      foto_url = urlData.publicUrl;
    }
  }

  // ✅ bônus vai para quem GEROU o link (quem convidou), não para quem entrou
  let indicado_por = null;
  if (codigo_convite) {
    const { data: convite } = await supabase.from("convites").select("*").eq("codigo", codigo_convite).single();
    if (convite) {
      indicado_por = convite.user_id;
      await supabase.from("convites").update({ usos: (convite.usos || 0) + 1 }).eq("id", convite.id);

      // dá bônus de R$10 para quem convidou
      const { data: convidador } = await supabase.from("usuarios").select("bonus").eq("id", convite.user_id).single();
      if (convidador) {
        await supabase.from("usuarios").update({ bonus: (convidador.bonus || 0) + 10 }).eq("id", convite.user_id);
      }
    }
  }

  const { data: novoUser, error } = await supabase
    .from("usuarios")
    .insert([{ nome, email, senha, foto_url, saldo: 0, bonus: 0, partidas: 0, vitorias: 0, derrotas: 0, indicado_por }])
    .select().single();

  if (error) return res.status(500).json({ erro: error.message });

  res.json({ ok: true, usuario: { id: novoUser.id, nome: novoUser.nome, email: novoUser.email, foto_url: novoUser.foto_url, saldo: novoUser.saldo, bonus: novoUser.bonus || 0, partidas: novoUser.partidas, vitorias: novoUser.vitorias, derrotas: novoUser.derrotas || 0 } });
});

// =============================
// 🔐 LOGIN
// =============================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha" });

  const { data: usuario, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("senha", senha).single();
  if (error || !usuario) return res.status(401).json({ erro: "E-mail ou senha incorretos" });

  res.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, foto_url: usuario.foto_url, saldo: usuario.saldo, bonus: usuario.bonus || 0, partidas: usuario.partidas, vitorias: usuario.vitorias, derrotas: usuario.derrotas || 0 } });
});

// =============================
// 🏆 CREDITAR VITÓRIA — sem duplicatas
// =============================
app.post("/creditar-vitoria", async (req, res) => {
  const { userId, valor } = req.body;

  const { data: usuario } = await supabase.from("usuarios").select("saldo, vitorias, partidas").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

  await supabase.from("usuarios").update({
    saldo: (usuario.saldo || 0) + valor,
    vitorias: (usuario.vitorias || 0) + 1,
    partidas: (usuario.partidas || 0) + 1
  }).eq("id", userId);

  await supabase.from("historico").insert([{ user_id: userId, tipo: "Vitória", valor }]);

  // ✅ UPSERT no ranking — nunca cria duplicata
  const hoje = new Date().toISOString().split("T")[0];
  const { data: rankExiste } = await supabase.from("ranking_diario").select("*").eq("user_id", userId).eq("dia", hoje).single();

  if (rankExiste) {
    await supabase.from("ranking_diario").update({
      vitorias: (rankExiste.vitorias || 0) + 1,
      ganho: (rankExiste.ganho || 0) + valor
    }).eq("id", rankExiste.id);
  } else {
    const { data: u } = await supabase.from("usuarios").select("nome, foto_url").eq("id", userId).single();
    await supabase.from("ranking_diario").insert([{ user_id: userId, nome: u.nome, foto_url: u.foto_url, vitorias: 1, cliques: 0, ganho: valor, dia: hoje }]);
  }

  res.json({ ok: true });
});

// =============================
// 📊 REGISTRAR PARTIDA
// =============================
app.post("/registrar-partida", async (req, res) => {
  const { userId, venceu, cliques } = req.body;

  const { data: usuario } = await supabase.from("usuarios").select("partidas, derrotas").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Não encontrado" });

  const update = { partidas: (usuario.partidas || 0) + 1 };
  if (!venceu) update.derrotas = (usuario.derrotas || 0) + 1;
  await supabase.from("usuarios").update(update).eq("id", userId);

  // ✅ atualiza cliques no ranking — nunca duplica
  const hoje = new Date().toISOString().split("T")[0];
  const { data: rankExiste } = await supabase.from("ranking_diario").select("*").eq("user_id", userId).eq("dia", hoje).single();

  if (rankExiste) {
    await supabase.from("ranking_diario").update({
      cliques: (rankExiste.cliques || 0) + cliques
    }).eq("id", rankExiste.id);
  } else {
    const { data: u } = await supabase.from("usuarios").select("nome, foto_url").eq("id", userId).single();
    await supabase.from("ranking_diario").insert([{ user_id: userId, nome: u.nome, foto_url: u.foto_url, vitorias: 0, cliques, ganho: 0, dia: hoje }]);
  }

  res.json({ ok: true });
});

// =============================
// 🚨 RECLAMAÇÕES
// =============================
app.post("/reclamacao", async (req, res) => {
  const { userId, nomeUsuario, emailUsuario, mensagem } = req.body;
  if (!mensagem || !mensagem.trim()) return res.status(400).json({ erro: "Mensagem vazia" });

  try {
    await enviarEmailReclamacao(nomeUsuario, emailUsuario, mensagem);
    res.json({ ok: true });
  } catch(e) {
    console.log("Erro email reclamação:", e.message);
    res.status(500).json({ erro: "Erro ao enviar reclamação" });
  }
});

// =============================
// 💬 CHAT
// =============================
app.get("/chat", async (req, res) => {
  const { data, error } = await supabase.from("chat_global").select("*").order("created_at", { ascending: true }).limit(50);
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data || []);
});

app.post("/chat", async (req, res) => {
  const { userId, nome, foto_url, mensagem } = req.body;
  if (!mensagem || !mensagem.trim()) return res.status(400).json({ erro: "Mensagem vazia" });
  const { error } = await supabase.from("chat_global").insert([{ user_id: userId, nome, foto_url: foto_url || null, mensagem: mensagem.trim() }]);
  if (error) return res.status(500).json({ erro: error.message });
  const { data: todas } = await supabase.from("chat_global").select("id").order("created_at", { ascending: true });
  if (todas && todas.length > 100) {
    const ids = todas.slice(0, todas.length - 100).map(m => m.id);
    await supabase.from("chat_global").delete().in("id", ids);
  }
  res.json({ ok: true });
});

// =============================
// 🏋️ RECORDES TREINO
// =============================
app.post("/recorde-treino", async (req, res) => {
  const { userId, cliques } = req.body;
  await supabase.from("recordes_treino").insert([{ user_id: userId, cliques }]);
  res.json({ ok: true });
});

app.get("/recordes-treino/:userId", async (req, res) => {
  const { data } = await supabase.from("recordes_treino").select("*").eq("user_id", req.params.userId).order("cliques", { ascending: false }).limit(3);
  res.json(data || []);
});

// =============================
// 🔗 CONVITES
// =============================
app.post("/criar-convite", async (req, res) => {
  const { userId, nomeUsuario } = req.body;
  const { data: existente } = await supabase.from("convites").select("*").eq("user_id", userId).single();
  if (existente) return res.json({ ok: true, codigo: existente.codigo, link: `${process.env.APP_URL}/?convite=${existente.codigo}` });

  const codigo = nomeUsuario.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") + "-" + Math.random().toString(36).substr(2, 4);
  const { data: novoConvite, error } = await supabase.from("convites").insert([{ user_id: userId, codigo }]).select().single();
  if (error) return res.status(500).json({ erro: error.message });

  res.json({ ok: true, codigo: novoConvite.codigo, link: `${process.env.APP_URL}/?convite=${novoConvite.codigo}` });
});

// =============================
// 🏟️ SALAS DE USUÁRIOS
// =============================
app.post("/criar-sala", async (req, res) => {
  const { userId, nomeUsuario, valorEntrada } = req.body;
  if (!valorEntrada || valorEntrada < 1) return res.status(400).json({ erro: "Valor mínimo é R$ 1" });

  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

  const saldoTotal = (usuario.saldo || 0) + (usuario.bonus || 0);
  if (saldoTotal < valorEntrada) return res.status(400).json({ erro: "Saldo insuficiente para criar a sala" });

  let novoBonus = usuario.bonus || 0;
  let novoSaldo = usuario.saldo || 0;
  if (novoBonus >= valorEntrada) { novoBonus -= valorEntrada; }
  else { novoSaldo -= (valorEntrada - novoBonus); novoBonus = 0; }

  await supabase.from("usuarios").update({ saldo: novoSaldo, bonus: novoBonus }).eq("id", userId);

  const codigo = Math.random().toString(36).substr(2, 6).toUpperCase();
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { data: sala, error } = await supabase.from("salas_usuarios").insert([{
    criador_id: userId, nome: `Sala de ${nomeUsuario}`, valor_entrada: valorEntrada,
    codigo, status: "aguardando", jogadores: 1, max_jogadores: 50,
    premio_acumulado: valorEntrada, expires_at
  }]).select().single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true, sala });
});

app.get("/salas-usuarios", async (req, res) => {
  const { data } = await supabase.from("salas_usuarios").select("*, usuarios(nome)").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  res.json(data || []);
});

// =============================
// 🎮 DESCONTAR ENTRADA
// =============================
app.post("/descontar-entrada", async (req, res) => {
  const { userId, valor } = req.body;
  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });

  const saldoTotal = (usuario.saldo || 0) + (usuario.bonus || 0);
  if (saldoTotal < valor) return res.status(400).json({ erro: "Saldo insuficiente" });

  let novoBonus = usuario.bonus || 0;
  let novoSaldo = usuario.saldo || 0;
  if (novoBonus >= valor) { novoBonus -= valor; }
  else { novoSaldo -= (valor - novoBonus); novoBonus = 0; }

  await supabase.from("usuarios").update({ saldo: novoSaldo, bonus: novoBonus }).eq("id", userId);
  res.json({ ok: true });
});

// =============================
// 💰 PIX
// =============================
app.post("/criar-pagamento", async (req, res) => {
  const { valor, userId } = req.body;
  try {
    const pagamento = await payment.create({
      body: {
        transaction_amount: Number(valor),
        description: "Deposito Click Arena",
        payment_method_id: "pix",
        payer: { email: "pagador@clickarena.com" },
        external_reference: userId,
        notification_url: `${process.env.APP_URL}/webhook`
      }
    });
    res.json({ id: pagamento.id, qr_code: pagamento.point_of_interaction.transaction_data.qr_code, qr_base64: pagamento.point_of_interaction.transaction_data.qr_code_base64 });
  } catch (err) {
    console.log("Erro PIX:", err.message);
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
      const pagamento = await payment.get({ id: data.data.id });
      if (pagamento.status === "approved") {
        const userId = pagamento.external_reference;
        const valor = pagamento.transaction_amount;
        const { data: usuario } = await supabase.from("usuarios").select("saldo").eq("id", userId).single();
        if (usuario) {
          await supabase.from("usuarios").update({ saldo: (usuario.saldo || 0) + valor }).eq("id", userId);
          await supabase.from("historico").insert([{ user_id: userId, tipo: "Depósito", valor }]);
        }
      }
    }
    res.sendStatus(200);
  } catch (err) { res.sendStatus(500); }
});

// =============================
// 💸 SACAR — nunca zera saldo
// =============================
app.post("/sacar", async (req, res) => {
  const { valor, userId, chave_pix } = req.body;
  if (!chave_pix) return res.status(400).json({ erro: "Informe sua chave PIX" });
  if (!valor || valor <= 0) return res.status(400).json({ erro: "Valor inválido" });

  const { data: usuario } = await supabase.from("usuarios").select("saldo, nome, email, id").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Usuário não encontrado" });
  if ((usuario.saldo || 0) < valor) return res.status(400).json({ erro: "Saldo insuficiente. O bônus não pode ser sacado." });

  const { error: updateError } = await supabase.from("usuarios").update({ saldo: usuario.saldo - valor }).eq("id", userId);
  if (updateError) return res.status(500).json({ erro: "Erro ao processar saque" });

  await supabase.from("historico").insert([{ user_id: userId, tipo: "Saque", valor }]);
  try { await enviarEmailSaque(usuario, valor, chave_pix); } catch(e) {}

  res.json({ ok: true, mensagem: "Pedido de saque realizado com sucesso, em até 48h o saque será realizado" });
});

// =============================
// 📋 HISTÓRICO
// =============================
app.get("/historico/:userId", async (req, res) => {
  const { data } = await supabase.from("historico").select("*").eq("user_id", req.params.userId).order("data", { ascending: false });
  res.json(data || []);
});

// =============================
// 📊 SALDO
// =============================
app.get("/saldo/:userId", async (req, res) => {
  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus").eq("id", req.params.userId).single();
  res.json({ saldo: usuario ? usuario.saldo : 0, bonus: usuario ? (usuario.bonus || 0) : 0 });
});

// =============================
// 🏆 RANKING
// =============================
app.get("/ranking", async (req, res) => {
  const hoje = new Date().toISOString().split("T")[0];
  const { data } = await supabase.from("ranking_diario").select("*").eq("dia", hoje).order("ganho", { ascending: false }).limit(50);
  res.json(data || []);
});

// =============================
// 🖼️ ATUALIZAR FOTO
// =============================
app.post("/atualizar-foto", async (req, res) => {
  const { userId, foto_base64 } = req.body;
  const buffer = Buffer.from(foto_base64.split(",")[1], "base64");
  const filename = `${Date.now()}-${userId}.jpg`;
  const { error } = await supabase.storage.from("fotos").upload(filename, buffer, { contentType: "image/jpeg" });
  if (error) return res.status(500).json({ erro: error.message });
  const { data: urlData } = supabase.storage.from("fotos").getPublicUrl(filename);
  await supabase.from("usuarios").update({ foto_url: urlData.publicUrl }).eq("id", userId);
  res.json({ ok: true, foto_url: urlData.publicUrl });
});

// =============================
// 🖱️ CLIQUE
// =============================
app.post("/click", (req, res) => {
  const { userId, timestamp } = req.body;
  if (!jogadores[userId]) jogadores[userId] = { cliques: 0, ultimoClique: 0, historico: [] };
  const jogador = jogadores[userId];
  if (timestamp - jogador.ultimoClique < 80) return res.json({ ok: false });
  jogador.ultimoClique = timestamp;
  jogador.cliques++;
  jogador.historico.push(timestamp);
  if (jogador.historico.length > 10) jogador.historico.shift();
  res.json({ ok: true, cliques: jogador.cliques });
});

// =============================
// 📁 ESTÁTICOS
// =============================
app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Servidor rodando na porta " + PORT));