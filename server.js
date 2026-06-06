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
  setTimeout(async () => {
    const ontem = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    await supabase.from("ranking_diario").delete().eq("dia", ontem);
    console.log("✅ Ranking diário resetado às 00:00");
    agendarResetDiario();
  }, amanha - agora);
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
  if (error) console.log("❌ E-mail:", error.message);
  else console.log("✅ E-mail configurado");
});

async function enviarEmailSaque(usuario, valor, chave_pix) {
  const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  await transporter.sendMail({
    from: `"Click Arena" <${process.env.EMAIL_USER}>`,
    to: process.env.EMAIL_USER,
    subject: `💸 Saque — R$ ${Number(valor).toFixed(2)}`,
    html: `<div style="font-family:Arial;max-width:500px;margin:auto;background:#0f172a;color:white;padding:30px;border-radius:12px;">
      <h2 style="color:#22c55e;">💸 Pedido de Saque</h2>
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;color:#9ca3af;">👤 Usuário</td><td style="font-weight:bold;">${usuario.nome}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;">📧 E-mail</td><td>${usuario.email}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;">💰 Valor</td><td style="color:#22c55e;font-size:22px;font-weight:bold;">R$ ${Number(valor).toFixed(2)}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;">🔑 Chave PIX</td><td style="font-weight:bold;font-size:16px;">${chave_pix}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;">📅 Data/Hora</td><td>${agora}</td></tr>
      </table>
    </div>`
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
      <p style="background:#1f2937;padding:15px;border-radius:8px;">${mensagem}</p>
    </div>`
  });
}

// =============================
// ⭐ XP E NÍVEIS
// =============================
const NIVEIS = [
  { nome: "Iniciante",        cor: "#9ca3af", vitorias: 5  },
  { nome: "Essencial",        cor: "#60a5fa", vitorias: 5  },
  { nome: "Intermediário",    cor: "#facc15", vitorias: 6  },
  { nome: "Avançado",         cor: "#22c55e", vitorias: 8  },
  { nome: "Especialista",     cor: "#3b82f6", vitorias: 10 },
  { nome: "Mestre",           cor: "#991b1b", vitorias: 12 },
  { nome: "Jogador de Elite", cor: "#7c3aed", vitorias: 99 },
];

async function atualizarXPNivel(userId, vitorias_nivel_atual, nivel_atual) {
  const idxAtual = NIVEIS.findIndex(n => n.nome === nivel_atual);
  const nivelObj = NIVEIS[idxAtual] || NIVEIS[0];
  const novas_vitorias = vitorias_nivel_atual + 1;
  let novoNivel = nivel_atual;
  let novasVitoriasNivel = novas_vitorias;

  if (novas_vitorias >= nivelObj.vitorias && idxAtual < NIVEIS.length - 1) {
    novoNivel = NIVEIS[idxAtual + 1].nome;
    novasVitoriasNivel = 0;
  }

  const xpGanho = Math.round((100 / nivelObj.vitorias) * 10) / 10;
  const novoXP = novoNivel !== nivel_atual ? 0 : Math.min(Math.round((novasVitoriasNivel / nivelObj.vitorias) * 100), 100);

  await supabase.from("usuarios").update({ xp: novoXP, nivel: novoNivel, vitorias_nivel: novasVitoriasNivel }).eq("id", userId);
  return { novoNivel, novoXP, xpGanho, subiu: novoNivel !== nivel_atual };
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

  const { data: novoUser, error } = await supabase.from("usuarios")
    .insert([{
      nome, email, senha,
      saldo: 0, bonus: 0, partidas: 0, vitorias: 0, derrotas: 0,
      indicado_por, avatar: avatar || "🦊",
      xp: 0, nivel: "Iniciante", vitorias_nivel: 0,
      tentativas_fraude: 0, bloqueado: false,
      cliques_total: 0, ganhos_total: 0,
      created_at: new Date().toISOString()
    }])
    .select().single();

  if (error) return res.status(500).json({ erro: error.message });

  res.json({ ok: true, usuario: {
    id: novoUser.id, nome: novoUser.nome, email: novoUser.email,
    avatar: novoUser.avatar || "🦊", saldo: 0, bonus: 0,
    partidas: 0, vitorias: 0, derrotas: 0,
    xp: 0, nivel: "Iniciante", vitorias_nivel: 0, bloqueado: false,
    cliques_total: 0, ganhos_total: 0,
    created_at: novoUser.created_at
  }});
});

// =============================
// 🔐 LOGIN
// =============================
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Preencha e-mail e senha" });

  const { data: u, error } = await supabase.from("usuarios").select("*").eq("email", email).eq("senha", senha).single();
  if (error || !u) return res.status(401).json({ erro: "E-mail ou senha incorretos" });

  res.json({ ok: true, usuario: {
    id: u.id, nome: u.nome, email: u.email,
    avatar: u.avatar || "🦊", saldo: u.saldo, bonus: u.bonus || 0,
    partidas: u.partidas, vitorias: u.vitorias, derrotas: u.derrotas || 0,
    xp: u.xp || 0, nivel: u.nivel || "Iniciante", vitorias_nivel: u.vitorias_nivel || 0,
    bloqueado: u.bloqueado || false,
    cliques_total: u.cliques_total || 0, ganhos_total: u.ganhos_total || 0,
    created_at: u.created_at,
    cidade: u.cidade, sexo: u.sexo, idade: u.idade,
    chave_pix: u.chave_pix, nome_completo: u.nome_completo
  }});
});

// =============================
// 🚨 ANTI-FRAUDE
// =============================
app.post("/reportar-fraude", async (req, res) => {
  const { userId, cliques } = req.body;
  const { data: u } = await supabase.from("usuarios").select("tentativas_fraude, nome").eq("id", userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });
  const novas = (u.tentativas_fraude || 0) + 1;
  const bloqueado = novas >= 3;
  await supabase.from("usuarios").update({ tentativas_fraude: novas, bloqueado }).eq("id", userId);
  console.log(`🚨 FRAUDE: ${u.nome} — ${cliques} cliques — tentativa ${novas}${bloqueado ? " — BLOQUEADO" : ""}`);
  res.json({ ok: true, bloqueado, tentativas: novas });
});

// =============================
// 🏆 CREDITAR VITÓRIA
// =============================
app.post("/creditar-vitoria", async (req, res) => {
  const { userId, valor } = req.body;
  const { data: u } = await supabase.from("usuarios").select("saldo, vitorias, partidas, xp, nivel, vitorias_nivel, ganhos_total").eq("id", userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });

  await supabase.from("usuarios").update({
    saldo: (u.saldo || 0) + valor,
    vitorias: (u.vitorias || 0) + 1,
    partidas: (u.partidas || 0) + 1,
    ganhos_total: (u.ganhos_total || 0) + valor
  }).eq("id", userId);

  const xpResult = await atualizarXPNivel(userId, u.vitorias_nivel || 0, u.nivel || "Iniciante");
  await supabase.from("historico").insert([{ user_id: userId, tipo: "Vitória", valor, data: new Date().toISOString() }]);

  // ranking diário
  const hoje = new Date().toISOString().split("T")[0];
  const { data: rankD } = await supabase.from("ranking_diario").select("*").eq("user_id", userId).eq("dia", hoje).single();
  if (rankD) {
    await supabase.from("ranking_diario").update({ vitorias: (rankD.vitorias||0)+1, ganho: (rankD.ganho||0)+valor }).eq("id", rankD.id);
  } else {
    const { data: uInfo } = await supabase.from("usuarios").select("nome, avatar").eq("id", userId).single();
    await supabase.from("ranking_diario").insert([{ user_id: userId, nome: uInfo.nome, foto_url: uInfo.avatar, vitorias: 1, cliques: 0, ganho: valor, dia: hoje }]);
  }

  // ranking global
  const { data: rankG } = await supabase.from("ranking_global").select("*").eq("user_id", userId).single();
  const { data: uAtual } = await supabase.from("usuarios").select("nome, avatar, vitorias, xp, nivel, ganhos_total").eq("id", userId).single();
  if (rankG) {
    await supabase.from("ranking_global").update({ vitorias: (rankG.vitorias||0)+1, xp: uAtual.xp, nivel: uAtual.nivel, nome: uAtual.nome, avatar: uAtual.avatar, ganhos_total: uAtual.ganhos_total, updated_at: new Date().toISOString() }).eq("id", rankG.id);
  } else {
    await supabase.from("ranking_global").insert([{ user_id: userId, nome: uAtual.nome, avatar: uAtual.avatar, vitorias: 1, cliques: 0, xp: uAtual.xp, nivel: uAtual.nivel, ganhos_total: uAtual.ganhos_total || 0 }]);
  }

  res.json({ ok: true, xpGanho: xpResult.xpGanho, novoNivel: xpResult.novoNivel, subiu: xpResult.subiu });
});

// =============================
// 📊 REGISTRAR PARTIDA
// =============================
app.post("/registrar-partida", async (req, res) => {
  const { userId, venceu, cliques } = req.body;
  const { data: u } = await supabase.from("usuarios").select("partidas, derrotas, cliques_total").eq("id", userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });

  const update = {
    partidas: (u.partidas || 0) + 1,
    cliques_total: (u.cliques_total || 0) + cliques
  };
  if (!venceu) update.derrotas = (u.derrotas || 0) + 1;
  await supabase.from("usuarios").update(update).eq("id", userId);

  const hoje = new Date().toISOString().split("T")[0];
  const { data: rankD } = await supabase.from("ranking_diario").select("*").eq("user_id", userId).eq("dia", hoje).single();
  if (rankD) {
    await supabase.from("ranking_diario").update({ cliques: (rankD.cliques||0)+cliques }).eq("id", rankD.id);
  } else {
    const { data: uInfo } = await supabase.from("usuarios").select("nome, avatar").eq("id", userId).single();
    await supabase.from("ranking_diario").insert([{ user_id: userId, nome: uInfo.nome, foto_url: uInfo.avatar, vitorias: 0, cliques, ganho: 0, dia: hoje }]);
  }

  const { data: rankG } = await supabase.from("ranking_global").select("*").eq("user_id", userId).single();
  if (rankG) {
    await supabase.from("ranking_global").update({ cliques: (rankG.cliques||0)+cliques }).eq("id", rankG.id);
  }

  res.json({ ok: true });
});

// =============================
// 👤 PERFIL PÚBLICO
// =============================
app.get("/perfil-publico/:userId", async (req, res) => {
  const { data: u } = await supabase.from("usuarios").select("id, nome, avatar, nivel, xp, vitorias, cliques_total, ganhos_total, partidas, created_at").eq("id", req.params.userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });
  res.json(u);
});

// =============================
// ✏️ ATUALIZAR PERFIL
// =============================
app.post("/atualizar-perfil", async (req, res) => {
  const { userId, nome, cidade, sexo, idade, chave_pix, nome_completo } = req.body;
  const update = {};
  if (nome !== undefined) update.nome = nome;
  if (cidade !== undefined) update.cidade = cidade;
  if (sexo !== undefined) update.sexo = sexo;
  if (idade !== undefined) update.idade = idade;
  if (chave_pix !== undefined) update.chave_pix = chave_pix;
  if (nome_completo !== undefined) update.nome_completo = nome_completo;

  await supabase.from("usuarios").update(update).eq("id", userId);

  // atualiza nome no ranking também
  if (nome) {
    const hoje = new Date().toISOString().split("T")[0];
    await supabase.from("ranking_diario").update({ nome }).eq("user_id", userId).eq("dia", hoje);
    await supabase.from("ranking_global").update({ nome }).eq("user_id", userId);
  }

  res.json({ ok: true });
});

// =============================
// 🎭 ATUALIZAR AVATAR
// =============================
app.post("/atualizar-avatar", async (req, res) => {
  const { userId, avatar } = req.body;
  await supabase.from("usuarios").update({ avatar }).eq("id", userId);
  await supabase.from("ranking_global").update({ avatar }).eq("user_id", userId);
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
    console.log("❌ Reclamação:", e.message);
    res.status(500).json({ erro: "Erro ao enviar" });
  }
});

// =============================
// 💬 CHAT — limpa mensagens > 24h
// =============================
app.get("/chat", async (req, res) => {
  const { data } = await supabase.from("chat_global").select("*").order("created_at", { ascending: true }).limit(100);
  res.json(data || []);
});

app.post("/chat", async (req, res) => {
  const { userId, nome, avatar, mensagem } = req.body;
  if (!mensagem || !mensagem.trim()) return res.status(400).json({ erro: "Mensagem vazia" });
  await supabase.from("chat_global").insert([{ user_id: userId, nome, foto_url: avatar || null, mensagem: mensagem.trim() }]);
  // apaga mensagens com mais de 24h
  const limite24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  await supabase.from("chat_global").delete().lt("created_at", limite24h);
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
  const codigo = nomeUsuario.toLowerCase().replace(/\s+/g,"-").replace(/[^a-z0-9-]/g,"") + "-" + Math.random().toString(36).substr(2,4);
  const { data: novoConvite } = await supabase.from("convites").insert([{ user_id: userId, codigo }]).select().single();
  res.json({ ok: true, codigo: novoConvite.codigo, link: `${process.env.APP_URL}/?convite=${novoConvite.codigo}` });
});

// =============================
// 🏟️ SALAS DE USUÁRIOS
// =============================
app.post("/criar-sala", async (req, res) => {
  const { userId, nomeUsuario, valorEntrada } = req.body;
  if (!valorEntrada || valorEntrada < 0.5) return res.status(400).json({ erro: "Valor mínimo é R$ 0,50" });
  const { data: u } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });
  const saldoTotal = (u.saldo||0)+(u.bonus||0);
  if (saldoTotal < valorEntrada) return res.status(400).json({ erro: "Saldo insuficiente" });
  let nb = u.bonus||0, ns = u.saldo||0;
  if (nb >= valorEntrada) { nb -= valorEntrada; } else { ns -= (valorEntrada-nb); nb=0; }
  await supabase.from("usuarios").update({ saldo: ns, bonus: nb }).eq("id", userId);
  const expires_at = new Date(Date.now()+24*60*60*1000).toISOString();
  const { data: sala, error } = await supabase.from("salas_usuarios").insert([{ criador_id: userId, nome: `Sala de ${nomeUsuario}`, valor_entrada: valorEntrada, codigo: Math.random().toString(36).substr(2,6).toUpperCase(), status: "aguardando", jogadores: 1, max_jogadores: 50, premio_acumulado: valorEntrada, expires_at }]).select().single();
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
  const { data: u } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  const saldoTotal = (u.saldo||0)+(u.bonus||0);
  if (saldoTotal < sala.valor_entrada) return res.status(400).json({ erro: "Saldo insuficiente" });
  let nb = u.bonus||0, ns = u.saldo||0;
  if (nb >= sala.valor_entrada) { nb -= sala.valor_entrada; } else { ns -= (sala.valor_entrada-nb); nb=0; }
  await supabase.from("usuarios").update({ saldo: ns, bonus: nb }).eq("id", userId);
  await supabase.from("salas_usuarios").update({ jogadores: sala.jogadores+1, premio_acumulado: (sala.premio_acumulado||0)+sala.valor_entrada }).eq("id", salaId);
  res.json({ ok: true });
});

// =============================
// 🎮 DESCONTAR ENTRADA
// =============================
app.post("/descontar-entrada", async (req, res) => {
  const { userId, valor } = req.body;
  const { data: u } = await supabase.from("usuarios").select("saldo, bonus").eq("id", userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });
  const saldoTotal = (u.saldo||0)+(u.bonus||0);
  if (saldoTotal < valor) return res.status(400).json({ erro: "Saldo insuficiente" });
  let nb = u.bonus||0, ns = u.saldo||0;
  if (nb >= valor) { nb -= valor; } else { ns -= (valor-nb); nb=0; }
  await supabase.from("usuarios").update({ saldo: ns, bonus: nb }).eq("id", userId);
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
      const pag = await payment.get({ id: data.data.id });
      if (pag.status === "approved") {
        const { data: u } = await supabase.from("usuarios").select("saldo").eq("id", pag.external_reference).single();
        if (u) {
          await supabase.from("usuarios").update({ saldo: (u.saldo||0)+pag.transaction_amount }).eq("id", pag.external_reference);
          await supabase.from("historico").insert([{ user_id: pag.external_reference, tipo: "Depósito", valor: pag.transaction_amount, data: new Date().toISOString() }]);
        }
      }
    }
    res.sendStatus(200);
  } catch(err) { res.sendStatus(500); }
});

// =============================
// 💸 SACAR
// =============================
app.post("/sacar", async (req, res) => {
  const { valor, userId, chave_pix } = req.body;
  if (!chave_pix) return res.status(400).json({ erro: "Informe sua chave PIX" });
  if (!valor || valor <= 0) return res.status(400).json({ erro: "Valor inválido" });
  const { data: u } = await supabase.from("usuarios").select("saldo, nome, email, id, chave_pix, nome_completo").eq("id", userId).single();
  if (!u) return res.status(404).json({ erro: "Não encontrado" });
  if ((u.saldo||0) < valor) return res.status(400).json({ erro: "Saldo insuficiente. Bônus não pode ser sacado." });
  const { error } = await supabase.from("usuarios").update({ saldo: u.saldo - valor }).eq("id", userId);
  if (error) return res.status(500).json({ erro: "Erro ao processar saque" });
  await supabase.from("historico").insert([{ user_id: userId, tipo: "Saque", valor, data: new Date().toISOString() }]);
  try { await enviarEmailSaque(u, valor, chave_pix); } catch(e) { console.log("❌ Email saque:", e.message); }
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
  const { data: u } = await supabase.from("usuarios").select("saldo, bonus, xp, nivel, vitorias_nivel, bloqueado, cliques_total, ganhos_total").eq("id", req.params.userId).single();
  res.json({ saldo: u?.saldo||0, bonus: u?.bonus||0, xp: u?.xp||0, nivel: u?.nivel||"Iniciante", vitorias_nivel: u?.vitorias_nivel||0, bloqueado: u?.bloqueado||false, cliques_total: u?.cliques_total||0, ganhos_total: u?.ganhos_total||0 });
});

app.get("/ranking", async (req, res) => {
  const hoje = new Date().toISOString().split("T")[0];
  const { data } = await supabase.from("ranking_diario").select("*").eq("dia", hoje).order("ganho", { ascending: false }).limit(50);
  res.json(data || []);
});

app.get("/ranking-global", async (req, res) => {
  const { data } = await supabase.from("ranking_global").select("*").limit(100);
  if (!data) return res.json([]);
  const NIVEIS_ORDEM = ["Iniciante","Essencial","Intermediário","Avançado","Especialista","Mestre","Jogador de Elite"];
  const ordenado = data.sort((a, b) => {
    const iA = NIVEIS_ORDEM.indexOf(a.nivel || "Iniciante");
    const iB = NIVEIS_ORDEM.indexOf(b.nivel || "Iniciante");
    if (iB !== iA) return iB - iA;
    return (b.xp || 0) - (a.xp || 0);
  });
  res.json(ordenado);
});

 // =============================
 // 🖱️ CLIQUE
 // =============================
 app.post("/click", (req, res) => {
  const { userId, timestamp } = req.body;
  if (!jogadores[userId]) jogadores[userId] = { cliques: 0, ultimoClique: 0, historico: [] };
  const j = jogadores[userId];
  if (timestamp - j.ultimoClique < 80) return res.json({ ok: false });
  j.ultimoClique = timestamp; j.cliques++;
  j.historico.push(timestamp); if (j.historico.length > 10) j.historico.shift();
  res.json({ ok: true, cliques: j.cliques });
 });

// =============================
// 🔐 MIDDLEWARE ADMIN
// =============================
function adminAuth(req, res, next) {
  const token = req.headers["x-admin-token"] || req.query.token;
  if (token !== process.env.ADMIN_TOKEN) return res.status(401).json({ erro: "Não autorizado" });
  next();
}

// =============================
// 📊 DASHBOARD
// =============================
app.get("/admin/dashboard", adminAuth, async (req, res) => {
  try {
    const hoje = new Date().toISOString().split("T")[0];
    const agora = new Date();
    const h24  = new Date(agora - 24*60*60*1000).toISOString();
    const h7d  = new Date(agora - 7*24*60*60*1000).toISOString();
    const h30d = new Date(agora - 30*24*60*60*1000).toISOString();

    const [
      { count: totalUsuarios },
      { data: depositos },
      { data: saques },
      { data: vitorias },
      { data: rankHoje },
      { count: novosHoje },
      { count: novos7d },
      { count: novos30d },
    ] = await Promise.all([
      supabase.from("usuarios").select("*", { count:"exact", head:true }),
      supabase.from("historico").select("valor").eq("tipo","Depósito"),
      supabase.from("historico").select("valor").eq("tipo","Saque").eq("status","confirmado"),
      supabase.from("historico").select("valor").eq("tipo","Vitória"),
      supabase.from("ranking_diario").select("ganho,vitorias,cliques").eq("dia",hoje),
      supabase.from("usuarios").select("id",{count:"exact",head:true}).gte("created_at",h24),
      supabase.from("usuarios").select("id",{count:"exact",head:true}).gte("created_at",h7d),
      supabase.from("usuarios").select("id",{count:"exact",head:true}).gte("created_at",h30d),
    ]);

    const totalDepositos  = (depositos||[]).reduce((s,d)=>s+Number(d.valor),0);
    const totalSaques     = (saques||[]).reduce((s,d)=>s+Number(d.valor),0);
    const totalVitorias   = (vitorias||[]).reduce((s,d)=>s+Number(d.valor),0);
    const ganhoPlataforma = totalDepositos * 0.3;
    const partidasHoje    = (rankHoje||[]).length;
    const cliquesHoje     = (rankHoje||[]).reduce((s,d)=>s+(d.cliques||0),0);

    const { count: saquesPendentes } = await supabase.from("historico")
      .select("id",{count:"exact",head:true}).eq("tipo","Saque").eq("status","pendente");

    res.json({
      totalUsuarios, novosHoje: novosHoje||0, novos7d: novos7d||0, novos30d: novos30d||0,
      totalDepositos, totalSaques, totalVitorias, ganhoPlataforma,
      saldoPlataforma: totalDepositos - totalSaques,
      partidasHoje, cliquesHoje, saquesPendentes: saquesPendentes||0
    });
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

// =============================
// 👥 USUÁRIOS
// =============================
app.get("/admin/usuarios", adminAuth, async (req, res) => {
  const { busca, pagina=0 } = req.query;
  let query = supabase.from("usuarios")
    .select("id,nome,email,saldo,bonus,partidas,vitorias,nivel,bloqueado,tentativas_fraude,created_at,avatar,cliques_total,ganhos_total,chave_pix")
    .order("created_at",{ascending:false})
    .range(pagina*30, pagina*30+29);
  if (busca) query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
  const { data, error } = await query;
  if (error) return res.status(500).json({ erro: error.message });
  res.json(data||[]);
});

app.get("/admin/usuario/:id", adminAuth, async (req, res) => {
  const { data: u } = await supabase.from("usuarios").select("*").eq("id",req.params.id).single();
  if (!u) return res.status(404).json({ erro:"Não encontrado" });
  const { data: hist } = await supabase.from("historico").select("*").eq("user_id",req.params.id).order("data",{ascending:false}).limit(20);
  res.json({ usuario: u, historico: hist||[] });
});

// =============================
// 💰 AJUSTAR SALDO
// =============================
app.post("/admin/ajustar-saldo", adminAuth, async (req, res) => {
  const { userId, valor, motivo } = req.body;
  const { data: u } = await supabase.from("usuarios").select("saldo,nome").eq("id",userId).single();
  if (!u) return res.status(404).json({ erro:"Não encontrado" });
  const novoSaldo = Math.max(0,(u.saldo||0)+Number(valor));
  await supabase.from("usuarios").update({ saldo: novoSaldo }).eq("id",userId);
  await supabase.from("historico").insert([{
    user_id:userId,
    tipo: valor>0?"Crédito Admin":"Débito Admin",
    valor:Math.abs(valor),
    data:new Date().toISOString(),
    status:"confirmado"
  }]);

  // envia notificação ao usuário
  const msg = valor > 0
    ? `Seu saldo foi creditado no valor de R$ ${Number(valor).toFixed(2)}.${motivo ? " Motivo: "+motivo : ""}`
    : `Foi realizado um débito de R$ ${Math.abs(valor).toFixed(2)} em sua conta.${motivo ? " Motivo: "+motivo : ""}`;

  await supabase.from("notificacoes").insert([{
    user_id: userId,
    titulo: valor > 0 ? "💰 Saldo creditado" : "💸 Débito realizado",
    mensagem: msg
  }]);

  res.json({ ok:true, novoSaldo });
});

// =============================
// 🚫 BLOQUEAR / DESBLOQUEAR
// =============================
app.post("/admin/bloquear", adminAuth, async (req, res) => {
  const { userId, bloquear, motivo } = req.body;
  await supabase.from("usuarios").update({ bloqueado: bloquear }).eq("id",userId);

  // notifica usuário
  if (bloquear) {
    await supabase.from("notificacoes").insert([{
      user_id: userId,
      titulo: "🚫 Conta bloqueada",
      mensagem: `Sua conta foi bloqueada pela plataforma.${motivo ? " Motivo: "+motivo : " Entre em contato com o suporte."}`
    }]);
  } else {
    await supabase.from("notificacoes").insert([{
      user_id: userId,
      titulo: "✅ Conta desbloqueada",
      mensagem: "Sua conta foi desbloqueada. Você já pode participar das partidas normalmente."
    }]);
  }

  res.json({ ok:true });
});

app.post("/admin/resetar-fraude", adminAuth, async (req, res) => {
  const { userId } = req.body;
  await supabase.from("usuarios").update({ tentativas_fraude:0, bloqueado:false }).eq("id",userId);
  res.json({ ok:true });
});

// =============================
// 💸 SAQUES — com status e motivo
// =============================
app.get("/admin/saques", adminAuth, async (req, res) => {
  const { status } = req.query;
  let query = supabase.from("historico")
    .select("*, usuarios(nome,email,chave_pix)")
    .eq("tipo","Saque")
    .order("data",{ascending:false})
    .limit(100);
  if (status) query = query.eq("status",status);
  const { data } = await query;
  res.json(data||[]);
});

app.post("/admin/saque-status", adminAuth, async (req, res) => {
  const { id, status, motivo } = req.body;

  // busca dados do saque antes de atualizar
  const { data: hist } = await supabase.from("historico")
    .select("user_id, valor, usuarios(nome)")
    .eq("id",id).single();

  const update = { status };
  if (status === "confirmado") update.processado_em = new Date().toISOString();
  await supabase.from("historico").update(update).eq("id",id);

  // ✅ saque recusado NÃO devolve saldo
  // envia notificação ao usuário com motivo
  if (hist) {
    const valor = Number(hist.valor).toFixed(2);
    if (status === "confirmado") {
      await supabase.from("notificacoes").insert([{
        user_id: hist.user_id,
        titulo: "✅ Saque confirmado!",
        mensagem: `Seu saque de R$ ${valor} foi processado com sucesso! O valor será debitado na sua chave PIX em breve.`
      }]);
    } else if (status === "recusado") {
      const motivoFinal = motivo || "Comportamento suspeito detectado pela plataforma.";
      await supabase.from("notificacoes").insert([{
        user_id: hist.user_id,
        titulo: "❌ Saque recusado",
        mensagem: `Seu saque de R$ ${valor} foi recusado. Motivo: ${motivoFinal} Em caso de dúvidas, entre em contato pelo canal de reclamações.`
      }]);
    }
  }

  res.json({ ok:true });
});

// =============================
// 💰 DEPÓSITOS
// =============================
app.get("/admin/depositos", adminAuth, async (req, res) => {
  const { data } = await supabase.from("historico")
    .select("*, usuarios(nome,email,avatar)")
    .eq("tipo","Depósito")
    .order("data",{ascending:false})
    .limit(100);
  res.json(data||[]);
});

// =============================
// 📧 EMAIL
// =============================
app.post("/admin/email", adminAuth, async (req, res) => {
  const { para, assunto, mensagem, paraTodos } = req.body;
  const remetente = `"Click Arena" <${process.env.EMAIL_USER}>`;
  try {
    if (paraTodos) {
      const { data: usuarios } = await supabase.from("usuarios").select("email,nome");
      const emails = (usuarios||[]).map(u=>u.email).filter(Boolean);
      await transporter.sendMail({
        from: remetente, bcc: emails, subject: assunto,
        html: emailHtml(mensagem)
      });
      res.json({ ok:true, enviados: emails.length });
    } else {
      await transporter.sendMail({ from: remetente, to: para, subject: assunto, html: emailHtml(mensagem) });
      res.json({ ok:true, enviados:1 });
    }
  } catch(e) { res.status(500).json({ erro: e.message }); }
});

function emailHtml(mensagem) {
  return `<div style="font-family:Arial;max-width:600px;margin:auto;background:#0f172a;color:white;padding:30px;border-radius:12px;">
    <h2 style="color:#3b82f6;">Click Arena</h2>
    <p style="line-height:1.8;">${mensagem.replace(/\n/g,"<br>")}</p>
    <hr style="border-color:#1f2937;margin:20px 0;">
    <p style="color:#6b7280;font-size:12px;">Click Arena — Competição. Velocidade. Comunidade.</p>
  </div>`;
}

app.get("/admin/emails-usuarios", adminAuth, async (req, res) => {
  const { busca } = req.query;
  let query = supabase.from("usuarios").select("id,nome,email").order("nome");
  if (busca) query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
  const { data } = await query.limit(20);
  res.json(data||[]);
});

// =============================
// 🔔 NOTIFICAÇÕES
// =============================
app.post("/admin/notificacao", adminAuth, async (req, res) => {
  const { userId, titulo, mensagem, paraTodos } = req.body;

  if (paraTodos) {
    const { data: usuarios } = await supabase.from("usuarios").select("id");
    const inserts = (usuarios||[]).map(u => ({ user_id: u.id, titulo, mensagem }));
    if (inserts.length > 0) await supabase.from("notificacoes").insert(inserts);
    return res.json({ ok:true, enviados: inserts.length });
  }

  if (!userId||!titulo||!mensagem) return res.status(400).json({ erro:"Preencha todos os campos" });
  await supabase.from("notificacoes").insert([{ user_id:userId, titulo, mensagem }]);
  res.json({ ok:true });
});

// rota pública — jogador busca suas notificações
app.get("/notificacoes/:userId", async (req, res) => {
  const { data } = await supabase.from("notificacoes")
    .select("*").eq("user_id",req.params.userId)
    .order("created_at",{ascending:false}).limit(30);
  res.json(data||[]);
});

// jogador marca como lida
app.post("/notificacoes/lida", async (req, res) => {
  const { id } = req.body;
  await supabase.from("notificacoes").update({ lida:true }).eq("id",id);
  res.json({ ok:true });
});

// count não lidas
app.get("/notificacoes-count/:userId", async (req, res) => {
  const { count } = await supabase.from("notificacoes")
    .select("id",{count:"exact",head:true})
    .eq("user_id",req.params.userId).eq("lida",false);
  res.json({ count: count||0 });
});

// =============================
// 📈 FINANCEIRO GERAL
// =============================
app.get("/admin/financeiro", adminAuth, async (req, res) => {
  const { data } = await supabase.from("historico")
    .select("id,tipo,valor,data,status,usuarios(nome,email)")
    .order("data",{ascending:false}).limit(100);
  res.json(data||[]);
});

// =============================
// 📁 ESTÁTICOS
// =============================
app.use(express.static(path.join(__dirname)));
app.get("/", (req, res) => { res.sendFile(path.join(__dirname, "index.html")); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Servidor rodando na porta " + PORT));