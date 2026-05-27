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

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
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
// 🔄 RESET DIÁRIO ÀS 00:00
// =============================
function agendarResetDiario() {
  const agora = new Date();
  const amanha = new Date(agora);
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(0, 0, 0, 0);
  const msAteAmanha = amanha - agora;

  setTimeout(async () => {
    const hoje = new Date().toISOString().split("T")[0];
    const ontem = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    await supabase.from("ranking_diario").delete().eq("dia", ontem);
    console.log("✅ Ranking diário resetado às 00:00");
    agendarResetDiario();
  }, msAteAmanha);
}
agendarResetDiario();

// =============================
// 📧 NODEMAILER
// =============================
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

transporter.verify((error) => {
  if (error) console.log("❌ Erro no e-mail:", error.message);
  else console.log("✅ E-mail configurado");
});

async function enviarEmailSaque(usuario, valor, chave_pix) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await transporter.sendMail({
    from: `"Click Arena" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `💸 Saque — R$ ${Number(valor).toFixed(2)}`,
    html: `
      <div style="font-family:Arial;max-width:500px;margin:auto;background:#0f172a;color:white;padding:30px;border-radius:12px;">
        <h2 style="color:#22c55e;">💸 Pedido de Saque</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr><td style="padding:8px 0;color:#9ca3af;">👤 Usuário</td><td style="font-weight:bold;">${usuario.nome}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af;">📧 E-mail</td><td>${usuario.email}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af;">💰 Valor</td><td style="color:#22c55e;font-size:22px;font-weight:bold;">R$ ${Number(valor).toFixed(2)}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af;">🔑 Chave PIX</td><td style="font-weight:bold;font-size:16px;">${chave_pix}</td></tr>
          <tr><td style="padding:8px 0;color:#9ca3af;">📅 Data/Hora</td><td>${agora}</td></tr>
        </table>
      </div>
    `
  });
  console.log("✅ E-mail saque enviado");
}

async function enviarEmailReclamacao(nomeUsuario, emailUsuario, mensagem) {
  await transporter.sendMail({
    from: `"Click Arena" <${process.env.EMAIL_USER}>`,
    to: "reclameaqui.click@gmail.com",
    subject: `🚨 Reclamação — ${nomeUsuario}`,
    html: `<div style="font-family:Arial;max-width:500px;margin:auto;background:#0f172a;color:white;padding:30px;border-radius:12px;">
      <h2 style="color:#ef4444;">🚨 Nova Reclamação</h2>
      <p><strong>Usuário:</strong> ${nomeUsuario}</p>
      <p><strong>E-mail:</strong> ${emailUsuario}</p>
      <p><strong>Mensagem:</strong></p>
      <p style="background:#1f2937;padding:15px;border-radius:8px;">${mensagem}</p>
    </div>`
  });
  console.log("✅ E-mail reclamação enviado");
}

// =============================
// ⭐ SISTEMA DE XP E NÍVEIS
// =============================
const NIVEIS = [
  { nome: "Iniciante",         cor: "#9ca3af", vitorias: 5  },
  { nome: "Essencial",         cor: "#60a5fa", vitorias: 5  },
  { nome: "Intermediário",     cor: "#facc15", vitorias: 6  },
  { nome: "Avançado",          cor: "#22c55e", vitorias: 8  },
  { nome: "Especialista",      cor: "#3b82f6", vitorias: 10 },
  { nome: "Mestre",            cor: "#991b1b", vitorias: 12 },
  { nome: "Jogador de Elite",  cor: "#7c3aed", vitorias: 99 },
];

function calcularXP(nivel, vitoriasNivel) {
  const nivelAtual = NIVEIS.find(n => n.nome === nivel) || NIVEIS[0];
  const xpPorVitoria = 100 / nivelAtual.vitorias;
  return Math.min((vitoriasNivel * xpPorVitoria), 100);
}

async function atualizarXPNivel(userId, vitorias_nivel_atual, nivel_atual) {
  const idxAtual = NIVEIS.findIndex(n => n.nome === nivel_atual);
  const nivelObj = NIVEIS[idxAtual] || NIVEIS[0];
  let novas_vitorias = vitorias_nivel_atual + 1;
  let novoNivel = nivel_atual;
  let novasVitoriasNivel = novas_vitorias;

  if (novas_vitorias >= nivelObj.vitorias && idxAtual < NIVEIS.length - 1) {
    novoNivel = NIVEIS[idxAtual + 1].nome;
    novasVitoriasNivel = 0;
  }

  const novoXP = calcularXP(novoNivel === nivel_atual ? novoNivel : nivel_atual, novas_vitorias >= nivelObj.vitorias ? nivelObj.vitorias : novas_vitorias);
  const xpGanho = 100 / nivelObj.vitorias;

  await supabase.from("usuarios").update({
    xp: novoXP,
    nivel: novoNivel,
    vitorias_nivel: novasVitoriasNivel
  }).eq("id", userId);

  return { novoNivel, novoXP, xpGanho: Math.round(xpGanho * 10) / 10, subiu: novoNivel !== nivel_atual };
}

// =============================
// 👤 CADASTRO
// =============================
app.post("/cadastro", async (req, res) => {
  const { nome, email, senha, codigo_convite, avatar } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: "Preencha todos os campos" });

  const { data: existe } = await supabase.from("usuarios").select("id").eq("email", email).single();
  if (existe) return res.status(400).json({ erro: "E-mail já cadastrado" });

  let indicado_por = null;
  if (codigo_convite) {
    const { data: convite } = await supabase.from("convites").select("*").eq("codigo", codigo_convite).single();
    if (convite) {
      indicado_por = convite.user_id;
      await supabase.from("convites").update({ usos: (convite.usos || 0) + 1 }).eq("id", convite.id);
      const { data: convidador } = await supabase.from("usuarios").select("bonus").eq("id", convite.user_id).single();
      if (convidador) await supabase.from("usuarios").update({ bonus: (convidador.bonus || 0) + 10 }).eq("id", convite.user_id);
    }
  }

  const avatarEscolhido = avatar || "avatar1";
  const { data: novoUser, error } = await supabase.from("usuarios")
    .insert([{ nome, email, senha, saldo: 0, bonus: 0, partidas: 0, vitorias: 0, derrotas: 0, indicado_por, avatar: avatarEscolhido, xp: 0, nivel: "Iniciante", vitorias_nivel: 0, tentativas_fraude: 0, bloqueado: false }])
    .select().single();

  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true, usuario: { id: novoUser.id, nome: novoUser.nome, email: novoUser.email, avatar: novoUser.avatar, saldo: 0, bonus: 0, partidas: 0, vitorias: 0, derrotas: 0, xp: 0, nivel: "Iniciante", vitorias_nivel: 0, bloqueado: false } });
});

// =============================
// 🔐 LOGIN
// =============================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha" });
  const { data: usuario, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("senha", senha).single();
  if (error || !usuario) return res.status(401).json({ erro: "E-mail ou senha incorretos" });
  res.json({ ok: true, usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, avatar: usuario.avatar || "avatar1", saldo: usuario.saldo, bonus: usuario.bonus || 0, partidas: usuario.partidas, vitorias: usuario.vitorias, derrotas: usuario.derrotas || 0, xp: usuario.xp || 0, nivel: usuario.nivel || "Iniciante", vitorias_nivel: usuario.vitorias_nivel || 0, bloqueado: usuario.bloqueado || false } });
});

// =============================
// 🚨 ANTI-FRAUDE
// =============================
app.post("/reportar-fraude", async (req, res) => {
  const { userId, cliques } = req.body;
  const { data: usuario } = await supabase.from("usuarios").select("tentativas_fraude, nome, email").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Não encontrado" });

  const novasTentativas = (usuario.tentativas_fraude || 0) + 1;
  const bloqueado = novasTentativas >= 3;

  await supabase.from("usuarios").update({ tentativas_fraude: novasTentativas, bloqueado }).eq("id", userId);

  console.log(`🚨 FRAUDE: ${usuario.nome} — ${cliques} cliques — tentativa ${novasTentativas}${bloqueado ? " — BLOQUEADO" : ""}`);

  res.json({ ok: true, bloqueado, tentativas: novasTentativas });
});

// =============================
// 🏆 CREDITAR VITÓRIA + XP
// =============================
app.post("/creditar-vitoria", async (req, res) => {
  const { userId, valor } = req.body;
  const { data: usuario } = await supabase.from("usuarios").select("saldo, vitorias, partidas, xp, nivel, vitorias_nivel").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Não encontrado" });

  await supabase.from("usuarios").update({
    saldo: (usuario.saldo || 0) + valor,
    vitorias: (usuario.vitorias || 0) + 1,
    partidas: (usuario.partidas || 0) + 1
  }).eq("id", userId);

  const xpResult = await atualizarXPNivel(userId, usuario.vitorias_nivel || 0, usuario.nivel || "Iniciante");

  await supabase.from("historico").insert([{ user_id: userId, tipo: "Vitória", valor, data: new Date().toISOString() }]);

  // ranking diário
  const hoje = new Date().toISOString().split("T")[0];
  const { data: rankExiste } = await supabase.from("ranking_diario").select("*").eq("user_id", userId).eq("dia", hoje).single();
  if (rankExiste) {
    await supabase.from("ranking_diario").update({ vitorias: (rankExiste.vitorias || 0) + 1, ganho: (rankExiste.ganho || 0) + valor }).eq("id", rankExiste.id);
  } else {
    const { data: u } = await supabase.from("usuarios").select("nome, avatar").eq("id", userId).single();
    await supabase.from("ranking_diario").insert([{ user_id: userId, nome: u.nome, foto_url: u.avatar, vitorias: 1, cliques: 0, ganho: valor, dia: hoje }]);
  }

  // ranking global
  const { data: globalExiste } = await supabase.from("ranking_global").select("*").eq("user_id", userId).single();
  const { data: uAtual } = await supabase.from("usuarios").select("nome, avatar, vitorias, xp, nivel").eq("id", userId).single();
  if (globalExiste) {
    await supabase.from("ranking_global").update({ vitorias: (globalExiste.vitorias || 0) + 1, xp: uAtual.xp, nivel: uAtual.nivel, nome: uAtual.nome, avatar: uAtual.avatar, updated_at: new Date().toISOString() }).eq("id", globalExiste.id);
  } else {
    await supabase.from("ranking_global").insert([{ user_id: userId, nome: uAtual.nome, avatar: uAtual.avatar, vitorias: 1, cliques: 0, xp: uAtual.xp, nivel: uAtual.nivel }]);
  }

  res.json({ ok: true, xpGanho: xpResult.xpGanho, novoNivel: xpResult.novoNivel, subiu: xpResult.subiu });
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

  const hoje = new Date().toISOString().split("T")[0];
  const { data: rankExiste } = await supabase.from("ranking_diario").select("*").eq("user_id", userId).eq("dia", hoje).single();
  if (rankExiste) {
    await supabase.from("ranking_diario").update({ cliques: (rankExiste.cliques || 0) + cliques }).eq("id", rankExiste.id);
  } else {
    const { data: u } = await supabase.from("usuarios").select("nome, avatar").eq("id", userId).single();
    await supabase.from("ranking_diario").insert([{ user_id: userId, nome: u.nome, foto_url: u.avatar, vitorias: 0, cliques, ganho: 0, dia: hoje }]);
  }

  // ranking global — atualiza cliques
  const { data: globalExiste } = await supabase.from("ranking_global").select("*").eq("user_id", userId).single();
  if (globalExiste) {
    await supabase.from("ranking_global").update({ cliques: (globalExiste.cliques || 0) + cliques }).eq("id", globalExiste.id);
  }

  res.json({ ok: true });
});

// =============================
// 🎭 ATUALIZAR AVATAR
// =============================
app.post("/atualizar-avatar", async (req, res) => {
  const { userId, avatar } = req.body;
  await supabase.from("usuarios").update({ avatar }).eq("id", userId);
  res.json({ ok: true, avatar });
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
    console.log("❌ Erro email reclamação:", e.message);
    res.status(500).json({ erro: "Erro ao enviar: " + e.message });
  }
});

// =============================
// 💬 CHAT
// =============================
app.post("/chat", async (req, res) => {
  const { userId, nome, avatar, mensagem } = req.body;
  if (!mensagem || !mensagem.trim()) return res.status(400).json({ erro: "Mensagem vazia" });
  await supabase.from("chat_global").insert([{ user_id: userId, nome, foto_url: avatar || null, mensagem: mensagem.trim() }]);

  // ✅ apaga mensagens com mais de 24h
  const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("chat_global").delete().lt("created_at", limite24h);

  res.json({ ok: true });
});

app.post("/chat", async (req, res) => {
  const { userId, nome, avatar, mensagem } = req.body;
  if (!mensagem || !mensagem.trim()) return res.status(400).json({ erro: "Mensagem vazia" });
  await supabase.from("chat_global").insert([{ user_id: userId, nome, foto_url: avatar || null, mensagem: mensagem.trim() }]);
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
  const { data: novoConvite } = await supabase.from("convites").insert([{ user_id: userId, codigo }]).select().single();
  res.json({ ok: true, codigo: novoConvite.codigo, link: `${process.env.APP_URL}/?convite=${novoConvite.codigo}` });
});

// =============================
// 🏟️ SALAS DE USUÁRIOS
// =============================
app.post("/criar-sala", async (req, res) => {
  const { userId, nomeUsuario, valorEntrada } = req.body;
  if (!valorEntrada || valorEntrada < 0.5) return res.status(400).json({ erro: "Valor mínimo é R$ 0,50" });
  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Não encontrado" });
  const saldoTotal = (usuario.saldo || 0) + (usuario.bonus || 0);
  if (saldoTotal < valorEntrada) return res.status(400).json({ erro: "Saldo insuficiente" });
  let novoBonus = usuario.bonus || 0; let novoSaldo = usuario.saldo || 0;
  if (novoBonus >= valorEntrada) { novoBonus -= valorEntrada; } else { novoSaldo -= (valorEntrada - novoBonus); novoBonus = 0; }
  await supabase.from("usuarios").update({ saldo: novoSaldo, bonus: novoBonus }).eq("id", userId);
  const expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { data: sala, error } = await supabase.from("salas_usuarios").insert([{ criador_id: userId, nome: `Sala de ${nomeUsuario}`, valor_entrada: valorEntrada, codigo: Math.random().toString(36).substr(2, 6).toUpperCase(), status: "aguardando", jogadores: 1, max_jogadores: 50, premio_acumulado: valorEntrada, expires_at }]).select().single();
  if (error) return res.status(500).json({ erro: error.message });
  res.json({ ok: true, sala });
});

app.get("/salas-usuarios", async (req, res) => {
  const { data } = await supabase.from("salas_usuarios").select("*, usuarios(nome)").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  res.json(data || []);
});

app.post("/entrar-sala-usuario", async (req, res) => {
  const { userId, salaId } = req.body;
  const { data: sala } = await supabase.from("salas_usuarios").select("*").eq("id", salaId).single();
  if (!sala) return res.status(404).json({ erro: "Sala não encontrada" });
  if (sala.jogadores >= sala.max_jogadores) return res.status(400).json({ erro: "Sala cheia" });
  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  const saldoTotal = (usuario.saldo || 0) + (usuario.bonus || 0);
  if (saldoTotal < sala.valor_entrada) return res.status(400).json({ erro: "Saldo insuficiente" });
  let novoBonus = usuario.bonus || 0; let novoSaldo = usuario.saldo || 0;
  if (novoBonus >= sala.valor_entrada) { novoBonus -= sala.valor_entrada; } else { novoSaldo -= (sala.valor_entrada - novoBonus); novoBonus = 0; }
  await supabase.from("usuarios").update({ saldo: novoSaldo, bonus: novoBonus }).eq("id", userId);
  await supabase.from("salas_usuarios").update({ jogadores: sala.jogadores + 1, premio_acumulado: (sala.premio_acumulado || 0) + sala.valor_entrada }).eq("id", salaId);
  res.json({ ok: true });
});

// =============================
// 🎮 DESCONTAR ENTRADA
// =============================
app.post("/descontar-entrada", async (req, res) => {
  const { userId, valor } = req.body;
  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Não encontrado" });
  const saldoTotal = (usuario.saldo || 0) + (usuario.bonus || 0);
  if (saldoTotal < valor) return res.status(400).json({ erro: "Saldo insuficiente" });
  let novoBonus = usuario.bonus || 0; let novoSaldo = usuario.saldo || 0;
  if (novoBonus >= valor) { novoBonus -= valor; } else { novoSaldo -= (valor - novoBonus); novoBonus = 0; }
  await supabase.from("usuarios").update({ saldo: novoSaldo, bonus: novoBonus }).eq("id", userId);
  res.json({ ok: true });
});

// =============================
// 💰 PIX
// =============================
app.post("/criar-pagamento", async (req, res) => {
  const { valor, userId } = req.body;
  try {
    const pagamento = await payment.create({ body: { transaction_amount: Number(valor), description: "Deposito Click Arena", payment_method_id: "pix", payer: { email: "pagador@clickarena.com" }, external_reference: userId, notification_url: `${process.env.APP_URL}/webhook` } });
    res.json({ id: pagamento.id, qr_code: pagamento.point_of_interaction.transaction_data.qr_code, qr_base64: pagamento.point_of_interaction.transaction_data.qr_code_base64 });
  } catch (err) { console.log("❌ PIX:", err.message); res.status(500).json({ erro: err.message }); }
});

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
          await supabase.from("historico").insert([{ user_id: userId, tipo: "Depósito", valor, data: new Date().toISOString() }]);
        }
      }
    }
    res.sendStatus(200);
  } catch (err) { res.sendStatus(500); }
});

// =============================
// 💸 SACAR
// =============================
app.post("/sacar", async (req, res) => {
  const { valor, userId, chave_pix } = req.body;
  if (!chave_pix) return res.status(400).json({ erro: "Informe sua chave PIX" });
  if (!valor || valor <= 0) return res.status(400).json({ erro: "Valor inválido" });
  const { data: usuario } = await supabase.from("usuarios").select("saldo, nome, email, id").eq("id", userId).single();
  if (!usuario) return res.status(404).json({ erro: "Não encontrado" });
  if ((usuario.saldo || 0) < valor) return res.status(400).json({ erro: "Saldo insuficiente. O bônus não pode ser sacado." });
  const { error: updateError } = await supabase.from("usuarios").update({ saldo: usuario.saldo - valor }).eq("id", userId);
  if (updateError) return res.status(500).json({ erro: "Erro ao processar saque" });
  await supabase.from("historico").insert([{ user_id: userId, tipo: "Saque", valor, data: new Date().toISOString() }]);
  try { await enviarEmailSaque(usuario, valor, chave_pix); } catch(e) { console.log("❌ Email saque:", e.message); }
  res.json({ ok: true, mensagem: "Pedido de saque realizado! Em até 48h será processado." });
});

// =============================
// 📋 HISTÓRICO / SALDO / RANKING
// =============================
app.get("/historico/:userId", async (req, res) => {
  const { data } = await supabase.from("historico").select("*").eq("user_id", req.params.userId).order("data", { ascending: false });
  res.json(data || []);
});

app.get("/saldo/:userId", async (req, res) => {
  const { data: usuario } = await supabase.from("usuarios").select("saldo, bonus, xp, nivel, vitorias_nivel, bloqueado").eq("id", req.params.userId).single();
  res.json({ saldo: usuario?.saldo || 0, bonus: usuario?.bonus || 0, xp: usuario?.xp || 0, nivel: usuario?.nivel || "Iniciante", vitorias_nivel: usuario?.vitorias_nivel || 0, bloqueado: usuario?.bloqueado || false });
});

app.get("/ranking", async (req, res) => {
  const hoje = new Date().toISOString().split("T")[0];
  const { data } = await supabase.from("ranking_diario").select("*").eq("dia", hoje).order("ganho", { ascending: false }).limit(50);
  res.json(data || []);
});

app.get("/ranking-global", async (req, res) => {
  const { data } = await supabase.from("ranking_global").select("*").order("xp", { ascending: false }).limit(100);
  res.json(data || []);
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
app.listen(PORT, () => console.log("✅ Servidor rodando na porta " + PORT));