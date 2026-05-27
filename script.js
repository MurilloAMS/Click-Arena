// =============================
// 🎭 AVATARES
// =============================
const AVATARES = [
  "🦊","🐺","🦁","🐯","🐻","🐼","🦝","🦄","🐲","🦅",
  "🦋","🐬","🦈","🦊","🐙","🦚","🦜","🦩","🐧","🦉",
  "🐺","🦊","🦁","🐯","🦝","🦄","🐲","🦅","🦋","🐬",
  "🧙","🧝","🧛","🤺","🥷","🧜","🧚","👑","💎","🔥",
  "⚡","🌟","🎯","🏆","💪","🎮","🕹️","👾","🤖","👻"
];

function getAvatarEmoji(avatarKey) {
  if (!avatarKey) return "🦊";
  if (avatarKey.startsWith("avatar")) {
    const idx = parseInt(avatarKey.replace("avatar","")) - 1;
    return AVATARES[idx] || "🦊";
  }
  return avatarKey;
}

function getAvatarAleatorio() {
  return AVATARES[Math.floor(Math.random() * AVATARES.length)];
}

// =============================
// ⭐ SISTEMA DE XP E NÍVEIS
// =============================
const NIVEIS = [
  { nome: "Iniciante",        cor: "#9ca3af", bg: "rgba(156,163,175,0.2)", vitorias: 5  },
  { nome: "Essencial",        cor: "#60a5fa", bg: "rgba(96,165,250,0.2)",  vitorias: 5  },
  { nome: "Intermediário",    cor: "#facc15", bg: "rgba(250,204,21,0.2)",  vitorias: 6  },
  { nome: "Avançado",         cor: "#22c55e", bg: "rgba(34,197,94,0.2)",   vitorias: 8  },
  { nome: "Especialista",     cor: "#3b82f6", bg: "rgba(59,130,246,0.2)",  vitorias: 10 },
  { nome: "Mestre",           cor: "#991b1b", bg: "rgba(153,27,27,0.2)",   vitorias: 12 },
  { nome: "Jogador de Elite", cor: "#7c3aed", bg: "rgba(124,58,237,0.2)",  vitorias: 99 },
];

function getNivelInfo(nomeNivel) {
  return NIVEIS.find(n => n.nome === nomeNivel) || NIVEIS[0];
}

function calcularXPPorcentagem(nivel, vitoriasNivel) {
  const n = getNivelInfo(nivel);
  return Math.min(Math.round((vitoriasNivel / n.vitorias) * 100), 100);
}

// =============================
// 🔐 AUTENTICAÇÃO
// =============================
let usuarioLogado = null;

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const convite = params.get("convite");
  if (convite) localStorage.setItem("codigo_convite", convite);

  const sessao = localStorage.getItem("usuario");
  if (sessao) {
    usuarioLogado = JSON.parse(sessao);
    iniciarJogo();
  }

  history.pushState({ tela: "jogo" }, "");
  window.addEventListener("popstate", () => {
    history.pushState({ tela: "jogo" }, "");
    fecharTelaAtiva();
  });
});

function fecharTelaAtiva() {
  if (!document.getElementById("telaMenu").classList.contains("hidden")) { fecharTela(); return; }
  if (!document.getElementById("chatGlobal").classList.contains("hidden")) { fecharChat(); return; }
  if (!document.getElementById("wallet").classList.contains("hidden")) { fecharWallet(); return; }
  if (!document.getElementById("menuLateral").classList.contains("hidden")) { fecharMenu(); return; }
}

function mostrarCadastro() {
  document.getElementById("telaLogin").classList.add("hidden");
  document.getElementById("telaCadastro").classList.remove("hidden");
}

function mostrarLogin() {
  document.getElementById("telaCadastro").classList.add("hidden");
  document.getElementById("telaLogin").classList.remove("hidden");
}

async function fazerCadastro() {
  const nome = document.getElementById("cadNome").value.trim();
  const email = document.getElementById("cadEmail").value.trim();
  const senha = document.getElementById("cadSenha").value;
  const erroEl = document.getElementById("cadErro");
  erroEl.classList.add("hidden");

  if (!nome || !email || !senha) { erroEl.innerText = "Preencha todos os campos"; erroEl.classList.remove("hidden"); return; }
  if (senha.length < 6) { erroEl.innerText = "Senha precisa ter pelo menos 6 caracteres"; erroEl.classList.remove("hidden"); return; }

  const codigo_convite = localStorage.getItem("codigo_convite") || null;
  const avatarSelecionado = localStorage.getItem("avatarCadastro") || "avatar1";

  try {
    const res = await fetch(`${window.location.origin}/cadastro`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, codigo_convite, avatar: avatarSelecionado })
    });
    const data = await res.json();
    if (!res.ok) { erroEl.innerText = data.erro || "Erro ao criar conta"; erroEl.classList.remove("hidden"); return; }
    localStorage.removeItem("codigo_convite");
    localStorage.removeItem("avatarCadastro");
    usuarioLogado = data.usuario;
    localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
    iniciarJogo();
  } catch (err) {
    erroEl.innerText = "Erro ao conectar com servidor";
    erroEl.classList.remove("hidden");
  }
}

async function fazerLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value;
  const erroEl = document.getElementById("loginErro");
  erroEl.classList.add("hidden");

  if (!email || !senha) { erroEl.innerText = "Preencha e-mail e senha"; erroEl.classList.remove("hidden"); return; }

  try {
    const res = await fetch(`${window.location.origin}/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    if (!res.ok) { erroEl.innerText = data.erro || "Erro ao entrar"; erroEl.classList.remove("hidden"); return; }
    usuarioLogado = data.usuario;
    localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
    iniciarJogo();
  } catch (err) {
    erroEl.innerText = "Erro ao conectar com servidor";
    erroEl.classList.remove("hidden");
  }
}

function fazerLogout() {
  localStorage.removeItem("usuario");
  usuarioLogado = null;
  location.reload();
}

function iniciarJogo() {
  document.getElementById("telaLogin").classList.add("hidden");
  document.getElementById("telaCadastro").classList.add("hidden");
  document.getElementById("jogoprincipal").classList.remove("hidden");

  perfil.nome = usuarioLogado.nome;
  perfil.id = usuarioLogado.id;
  perfil.partidas = usuarioLogado.partidas || 0;
  perfil.vitorias = usuarioLogado.vitorias || 0;
  perfil.derrotas = usuarioLogado.derrotas || 0;
  saldo = usuarioLogado.saldo || 0;
  bonus = usuarioLogado.bonus || 0;
  xpAtual = usuarioLogado.xp || 0;
  nivelAtual = usuarioLogado.nivel || "Iniciante";
  vitoriasNivel = usuarioLogado.vitorias_nivel || 0;

  atualizarSaldo();
  atualizarBarraXP();
  iniciarBotsSalas();
  renderSalas();
  sincronizarTimer();
  buscarSaldo();
  buscarRankingDiario();
  buscarRankingGlobal();
  buscarSalasUsuarios();

  setInterval(buscarSaldo, 5000);
  setInterval(buscarRankingDiario, 10000);
  setInterval(buscarSalasUsuarios, 15000);

  configurarClickBtn();
  configurarClickBtnTreino();
}

// =============================
// 🎮 VARIÁVEIS
// =============================
let ultimoCliqueValido = 0;
let cliquesSegundo = 0;
let historicoCliques = [];
let timerInterval = null;
let botInterval = null;
let posicaoAnterior = null;
let treinoInterval = null;
let treinoCliquesCount = 0;
let treinoTempo = 30;
let esperaInterval = null;
let ambientOsc = null;
let ambientGain = null;
let ultimoSaldo = 0;
let audioCtx = null;
let somAtivo = true;
let bonus = 0;
let modoSaldo = "real";
let xpAtual = 0;
let nivelAtual = "Iniciante";
let vitoriasNivel = 0;

let perfil = JSON.parse(localStorage.getItem("perfil")) || {
  nome: "Jogador", id: "user1", partidas: 0, vitorias: 0, derrotas: 0
};

let saldo = 0;
let tempoGlobal = 30;
let cliques = 0;
let tempo = 30;
let salaAtual = null;
let salasUsuariosData = [];

// =============================
// ⏱️ TIMER SINCRONIZADO
// =============================
async function sincronizarTimer() {
  try {
    const res = await fetch(`${window.location.origin}/tempo-global`);
    const data = await res.json();
    tempoGlobal = data.tempo;
  } catch(e) {
    tempoGlobal = 30 - (Math.floor(Date.now() / 1000) % 30);
  }
  iniciarTimer();
}

// =============================
// 🤖 BOTS COM AVATARES
// =============================
const nomesBot = [
  "Carlos Mendes","Aninha","Pedro Costa","Julia Rocha","Rafael Souza",
  "Fernanda","Luquinha","Bea Nunes","Thiago Alves","Camila Ferreira",
  "Bruno Santos","Larissa Gomes","Diego","Leticia Carvalho","Mateus Ribeiro",
  "Vanessa Pereira","Felipe Araujo","Castro","Gustavo Lima","Patricia Moura",
  "Anderson","Mariana Costa","Ricardo Souza","Juliana Ferreira","Neymar",
  "Gabi","Leandro Oliveira","Amanda Rocha","Marcos Alves","Natalia Gomes",
  "Vini Dias","Priscila Carvalho","Rodrigo","Aline Ribeiro","Pereira","Tati Lima"
];

const salas = [
  { nome: "Iniciante",         jogadores: 0, max: 50, valor: 0.5,  tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Essencial",         jogadores: 0, max: 50, valor: 1,    tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Intermediário",     jogadores: 0, max: 50, valor: 2,    tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Avançado",          jogadores: 0, max: 50, valor: 5,    tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Especialista",      jogadores: 0, max: 50, valor: 10,   tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Mestre",            jogadores: 0, max: 50, valor: 20,   tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Jogadores de Elite",jogadores: 0, max: 50, valor: 50,   tempo: 30, status: "aguardando", emJogo: false, bots: [] },
];

const grupoA = [0, 1, 2, 3];
const grupoB = [4, 5, 6];
let grupoAtual = "A";
let botsArena = [];

function gerarBotsParaSala(sala) {
  const qtd = Math.floor(Math.random() * 25) + 18;
  const indices = [];
  while (indices.length < Math.min(qtd, nomesBot.length)) {
    const i = Math.floor(Math.random() * nomesBot.length);
    if (!indices.includes(i)) indices.push(i);
  }
  sala.bots = indices.map(i => ({ nome: nomesBot[i], avatar: getAvatarAleatorio(), score: 0 }));
  sala.jogadores = sala.bots.length;
}

function iniciarBotsSalas() {
  salas.forEach(sala => gerarBotsParaSala(sala));
  salas.forEach(sala => {
    const totalBots = sala.bots.length;
    sala.jogadores = Math.floor(totalBots * 0.5);
    let adicionados = sala.jogadores;
    const entrar = setInterval(() => {
      if (adicionados >= totalBots || sala.emJogo) { clearInterval(entrar); return; }
      adicionados++;
      sala.jogadores = adicionados;
      renderSalas();
    }, Math.random() * 2000 + 800);
  });
}

// =============================
// 🔊 ÁUDIO
// =============================
document.addEventListener("click", () => {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state !== "running") audioCtx.resume();
  if (!window.somAmbienteIniciado) { window.somAmbienteIniciado = true; window.somIntervalo = setInterval(() => iniciarSomAmbiente(), 3000); }
});

function toggleSom() { somAtivo = !somAtivo; const btn = document.getElementById("btnSom"); if (btn) btn.innerText = somAtivo ? "🔊" : "🔇"; }

function iniciarSomAmbiente() {
  if (!somAtivo || !audioCtx || ambientOsc) return;
  ambientOsc = audioCtx.createOscillator(); ambientGain = audioCtx.createGain();
  ambientOsc.type = "triangle"; let agora = audioCtx.currentTime;
  ambientOsc.frequency.setValueAtTime(600, agora); ambientOsc.frequency.linearRampToValueAtTime(900, agora+0.1); ambientOsc.frequency.linearRampToValueAtTime(700, agora+0.2);
  ambientGain.gain.setValueAtTime(0.1, agora); ambientGain.gain.exponentialRampToValueAtTime(0.0001, agora+0.25);
  ambientOsc.connect(ambientGain); ambientGain.connect(audioCtx.destination);
  ambientOsc.start(agora); ambientOsc.stop(agora+0.25); ambientOsc.onended = () => { ambientOsc = null; };
}

function pararSomAmbiente() { if (!ambientOsc) return; try { ambientOsc.stop(); ambientOsc.disconnect(); } catch(e) {} ambientOsc = null; }

function somClick() { if (!somAtivo || !audioCtx) return; let o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.frequency.value=600;o.type="square";g.gain.value=0.004; o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.05); }
function somUltrapassar() { if (!somAtivo || !audioCtx) return; let o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.frequency.setValueAtTime(400,audioCtx.currentTime);o.frequency.exponentialRampToValueAtTime(900,audioCtx.currentTime+0.2);g.gain.value=0.04; o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.2); }
function somVitoria() { if (!somAtivo || !audioCtx) return; let o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.frequency.setValueAtTime(500,audioCtx.currentTime);o.frequency.linearRampToValueAtTime(1200,audioCtx.currentTime+0.5);g.gain.value=0.03; o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+0.5); }
function vibrar() { if (navigator.vibrate) navigator.vibrate(30); }

// =============================
// 🛡️ ANTI-BOT
// =============================
setInterval(() => { if (cliquesSegundo > 10) console.log("🚨"); cliquesSegundo = 0; }, 1000);

function cliqueValido() {
  const agora = Date.now();
  if (agora - ultimoCliqueValido < 80) return false;
  ultimoCliqueValido = agora; cliquesSegundo++;
  historicoCliques.push(agora);
  if (historicoCliques.length > 10) historicoCliques.shift();
  if (historicoCliques.length === 10) {
    let intervalos = [];
    for (let i=1;i<historicoCliques.length;i++) intervalos.push(historicoCliques[i]-historicoCliques[i-1]);
    if (intervalos.every(v => Math.abs(v-intervalos[0])<5)) return false;
  }
  return true;
}

// =============================
// 💬 CHAT
// =============================
let chatAberto = false;
let chatInterval = null;
let chatSwipeStartY = 0;

function abrirChat() {
  document.getElementById("chatGlobal").classList.remove("hidden");
  chatAberto = true; carregarMensagens();
  chatInterval = setInterval(carregarMensagens, 3000);
  const chatBox = document.querySelector(".chat-box");
  chatBox.addEventListener("touchstart", (e) => { chatSwipeStartY = e.touches[0].clientY; }, { passive: true });
  chatBox.addEventListener("touchend", (e) => { if (e.changedTouches[0].clientY - chatSwipeStartY > 80) fecharChat(); }, { passive: true });
}

function fecharChat() { document.getElementById("chatGlobal").classList.add("hidden"); chatAberto = false; clearInterval(chatInterval); }
function formatarHora(dateStr) { const d = new Date(dateStr); return d.toLocaleTimeString("pt-BR", { hour:"2-digit", minute:"2-digit" }); }

async function carregarMensagens() {
  try {
    const res = await fetch(`${window.location.origin}/chat`);
    if (!res.ok) return;
    const mensagens = await res.json();
    const container = document.getElementById("chatMensagens");
    const eraEmbaixo = container.scrollHeight - container.scrollTop <= container.clientHeight + 50;
    container.innerHTML = "";
    mensagens.forEach(m => {
      const souEu = usuarioLogado && m.user_id === usuarioLogado.id;
      const avatarEl = m.foto_url
        ? `<div class="chat-avatar" style="font-size:20px;">${m.foto_url}</div>`
        : `<div class="chat-avatar">${m.nome.charAt(0).toUpperCase()}</div>`;
      const hora = m.created_at ? `<span class="chat-hora">${formatarHora(m.created_at)}</span>` : "";
      container.innerHTML += `
        <div class="chat-msg ${souEu ? "chat-msg-eu" : ""}">
          ${!souEu ? avatarEl : ""}
          <div class="chat-bubble ${souEu ? "bubble-eu" : "bubble-outro"}">
            ${!souEu ? `<div class="chat-nome">${m.nome}</div>` : ""}
            <div>${m.mensagem}</div>
            ${hora}
          </div>
          ${souEu ? avatarEl : ""}
        </div>
      `;
    });
    if (eraEmbaixo) container.scrollTop = container.scrollHeight;
  } catch(e) {}
}

async function enviarMensagem() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg || !usuarioLogado) return;
  input.value = "";
  const avatarEmoji = getAvatarEmoji(usuarioLogado.avatar);
  try {
    await fetch(`${window.location.origin}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, nome: usuarioLogado.nome, avatar: avatarEmoji, mensagem: msg })
    });
    carregarMensagens();
  } catch(e) {}
}

document.addEventListener("keydown", (e) => { if (e.key === "Enter" && chatAberto) enviarMensagem(); });

// =============================
// 🏋️ TREINO
// =============================
let recordesTreino = [];

async function abrirTreino() {
  treinoCliquesCount = 0; treinoTempo = 30;
  document.getElementById("arenaTreino").classList.remove("hidden");
  document.getElementById("treinoCliques").innerText = "0";
  document.getElementById("treino-barra").style.width = "0%";
  if (usuarioLogado) {
    try { const res = await fetch(`${window.location.origin}/recordes-treino/${usuarioLogado.id}`); recordesTreino = await res.json(); renderRecordesTreino(); } catch(e) {}
  }
  iniciarTreino();
}

function renderRecordesTreino() {
  const div = document.getElementById("recordesTreino");
  if (!div) return;
  if (!recordesTreino.length) { div.innerHTML = `<p style="color:#6b7280;font-size:12px;text-align:center;">Sem recordes ainda</p>`; return; }
  const medalhas = ["🥇","🥈","🥉"];
  div.innerHTML = `<p style="color:#9ca3af;font-size:12px;margin-bottom:6px;">Seus recordes:</p>` +
    recordesTreino.map((r,i) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0;border-bottom:1px solid #1f2937;"><span>${medalhas[i]} ${i+1}º</span><span style="color:#22c55e;font-weight:bold;">${r.cliques} cliques</span></div>`).join("");
}

function fecharTreino() { clearInterval(treinoInterval); document.getElementById("arenaTreino").classList.add("hidden"); }

function iniciarTreino() {
  clearInterval(treinoInterval); treinoTempo = 30;
  treinoInterval = setInterval(() => {
    treinoTempo--;
    const el = document.getElementById("treinoTimer");
    if (el) el.innerText = treinoTempo + "s";
    if (treinoTempo <= 0) {
      clearInterval(treinoInterval);
      document.getElementById("arenaTreino").classList.add("hidden");
      if (usuarioLogado) { fetch(`${window.location.origin}/recorde-treino`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId: usuarioLogado.id, cliques: treinoCliquesCount }) }).catch(()=>{}); }
      const titulo = document.getElementById("resultadoTitulo");
      titulo.classList.remove("vitoria","derrota"); titulo.classList.add("vitoria");
      titulo.innerText = "🏋️ TREINO CONCLUÍDO";
      document.getElementById("resultadoTexto").innerText = `Você fez ${treinoCliquesCount} cliques!`;
      document.getElementById("resultado").classList.remove("hidden");
    }
  }, 1000);
}

function configurarClickBtnTreino() {
  const btn = document.getElementById("clickBtnTreino");
  if (!btn) return;
  btn.addEventListener("click", () => {
    if (treinoTempo <= 0) return;
    if (!cliqueValido()) return;
    treinoCliquesCount++; somClick(); vibrar();
    const el = document.getElementById("treinoCliques"); if (el) el.innerText = treinoCliquesCount;
    const barra = document.getElementById("treino-barra"); if (barra) barra.style.width = Math.min((treinoCliquesCount/200)*100,100)+"%";
    const plus = document.createElement("div"); plus.innerText="+1"; plus.className="plus-treino"; plus.style.left=Math.random()*40+30+"%"; plus.style.top="10%";
    document.getElementById("clickAreaTreino").appendChild(plus); setTimeout(()=>plus.remove(),800);
  });
}

// =============================
// 🏆 RANKING DUPLO
// =============================
let rankingDiario = [];
let rankingGlobalData = [];

async function buscarRankingDiario() {
  try {
    const res = await fetch(`${window.location.origin}/ranking`);
    if (!res.ok) return;
    rankingDiario = await res.json();
    renderRankingDuplo();
  } catch(e) {}
}

async function buscarRankingGlobal() {
  try {
    const res = await fetch(`${window.location.origin}/ranking`);
    if (!res.ok) return;
    rankingDiario = await res.json();
    renderRankingDuplo();
  } catch(e) {}
}

async function buscarRankingGlobal() {
  try {
    const res = await fetch(`${window.location.origin}/ranking-global`);
    if (!res.ok) return;
    rankingGlobalData = await res.json();
    renderRankingDuplo();
  } catch(e) {}
}

function renderRankingDuplo() {
  const div = document.getElementById("ranking");
  if (!div) return;

  const nivelInfo = getNivelInfo(nivelAtual);
  const meuAvatar = usuarioLogado ? getAvatarEmoji(usuarioLogado.avatar) : "🦊";

  // ===== DESTAQUES DO DIA =====
  const icones = ["🥇","🥈","🥉"];
  const classes = ["gold","silver","bronze"];

  let destaqueHTML = `<div class="ranking-col-titulo">🌟 Destaques do Dia</div>`;

  if (!rankingDiario.length) {
    destaqueHTML += `<p style="text-align:center;color:#6b7280;font-size:12px;padding:10px 0;">Nenhuma partida hoje</p>`;
    destaqueHTML += `<div class="rank-card voce-rank" style="font-size:12px;">
      <div class="rank-left"><div class="rank-icon">—</div><div style="font-size:20px;">${meuAvatar}</div>
        <div><div class="rank-name">${usuarioLogado?.nome || "Você"}</div><div class="rank-info">0 vitórias</div></div>
      </div><div class="rank-money">R$ 0</div></div>`;
  } else {
    rankingDiario.slice(0,3).forEach((j,i) => {
      const av = j.foto_url || "🦊";
      destaqueHTML += `<div class="rank-card ${classes[i]}">
        <div class="rank-left"><div class="rank-icon">${icones[i]}</div><div style="font-size:20px;">${av}</div>
          <div><div class="rank-name">${j.nome}</div><div class="rank-info">${j.vitorias}V • ${j.cliques}C</div></div>
        </div><div class="rank-money">R$ ${Number(j.ganho).toFixed(2)}</div></div>`;
    });

    if (usuarioLogado) {
      const pos = rankingDiario.findIndex(j => j.user_id === usuarioLogado.id);
      if (pos >= 3) {
        const eu = rankingDiario[pos];
        destaqueHTML += `<div class="rank-separador">• • •</div>
          <div class="rank-card voce-rank" style="font-size:12px;">
            <div class="rank-left"><div class="rank-icon">${pos+1}º</div><div style="font-size:20px;">${meuAvatar}</div>
              <div><div class="rank-name">${eu.nome} (você)</div><div class="rank-info">${eu.vitorias}V • ${eu.cliques}C</div></div>
            </div><div class="rank-money">R$ ${Number(eu.ganho).toFixed(2)}</div></div>`;
      } else if (pos === -1) {
        destaqueHTML += `<div class="rank-separador">• • •</div>
          <div class="rank-card voce-rank" style="font-size:12px;">
            <div class="rank-left"><div class="rank-icon">—</div><div style="font-size:20px;">${meuAvatar}</div>
              <div><div class="rank-name">${usuarioLogado.nome} (você)</div><div class="rank-info">0V • 0C</div></div>
            </div><div class="rank-money">R$ 0</div></div>`;
      }
    }
  }

  // ===== RANKING GLOBAL =====
  let globalHTML = `<div class="ranking-col-titulo">🌍 Ranking Global</div><div class="ranking-global-lista">`;

  if (!rankingGlobalData.length) {
    globalHTML += `<p style="text-align:center;color:#6b7280;font-size:12px;padding:10px 0;">Sem dados ainda</p>`;
  } else {
    rankingGlobalData.forEach((j, i) => {
      const av = j.avatar || "🦊";
      const nivelJ = getNivelInfo(j.nivel || "Iniciante");
      const euMesmo = usuarioLogado && j.user_id === usuarioLogado.id;
      globalHTML += `
        <div class="rank-global-item ${euMesmo ? "voce-rank" : ""}">
          <span style="color:#6b7280;font-size:11px;min-width:18px;">${i+1}º</span>
          <span style="font-size:18px;">${av}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:12px;font-weight:bold;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${j.nome}${euMesmo?" (você)":""}</div>
            <div style="font-size:10px;color:${nivelJ.cor};">${j.nivel || "Iniciante"}</div>
          </div>
          <div style="text-align:right;font-size:11px;color:#9ca3af;">
            <div>${j.vitorias || 0}V</div>
            <div>${j.cliques || 0}C</div>
          </div>
        </div>`;
    });
  }
  globalHTML += `</div>`;

  div.innerHTML = `<div class="ranking-duplo">${destaqueHTML}</div><div class="ranking-duplo">${globalHTML}</div>`;
}

// =============================
// 🚪 SALAS
// =============================
function calcularPremio(sala) { return ((sala.jogadores * sala.valor) * 0.7).toFixed(2); }

async function buscarSalasUsuarios() {
  try {
    const res = await fetch(`${window.location.origin}/salas-usuarios`);
    if (!res.ok) return;
    salasUsuariosData = await res.json();
    renderSalas();
  } catch(e) {}
}

function renderSalas() {
  const div = document.getElementById("salas");
  if (!div) return;
  div.innerHTML = "";
  salas.forEach(sala => {
    const premio = calcularPremio(sala);
    const nivelSala = getNivelInfo(sala.nome);
    div.innerHTML += `
      <div class="sala ${sala.status==='jogando'?'sala-bloqueada':''}" onclick="entrarSala('${sala.nome}')" style="border-left: 3px solid ${nivelSala.cor || '#374151'};">
        <div class="sala-left">
          <b>${sala.nome}</b>
          <span class="sala-jogadores"><span class="jog-ativo">${sala.jogadores}</span>/${sala.max} jogadores</span>
        </div>
        <div class="sala-right">
          <div class="sala-premio">🏆 R$ ${premio}</div>
          <div class="sala-entrada">Entrada: R$ ${sala.valor.toFixed(2)}</div>
          <div class="${sala.status==='jogando'?'red':'green'}">
            ${sala.status==='jogando'?'🔒 Em jogo ('+sala.tempo+'s)':'⏳ '+tempoGlobal.toString().padStart(2,'0')+'s'}
          </div>
        </div>
      </div>`;
  });

  if (salasUsuariosData.length > 0) {
    div.innerHTML += `<div class="salas-titulo-usuario">👤 Salas criadas por jogadores</div>`;
    salasUsuariosData.forEach(s => {
      const premio = ((s.premio_acumulado||0)*0.7).toFixed(2);
      div.innerHTML += `
        <div class="sala sala-usuario" onclick="entrarSalaUsuario('${s.id}', ${s.valor_entrada})">
          <div class="sala-left">
            <b>${s.nome}</b>
            <span style="color:#3b82f6;font-size:11px;font-weight:bold;">👤 Por ${s.usuarios?.nome||"Jogador"}</span>
            <span class="sala-jogadores"><span class="jog-ativo">${s.jogadores}</span>/${s.max_jogadores}</span>
          </div>
          <div class="sala-right">
            <div class="sala-premio">🏆 R$ ${premio}</div>
            <div class="sala-entrada">Entrada: R$ ${Number(s.valor_entrada).toFixed(2)}</div>
            <div class="green">⏳ Aguardando</div>
          </div>
        </div>`;
    });
  }
}

function entrarSala(nome) {
  pararSomAmbiente();
  const sala = salas.find(s => s.nome === nome);

  // verifica bloqueio por fraude
  if (usuarioLogado?.bloqueado) {
    mostrarModalFraude("🚫 Conta bloqueada por fraude. Você está impedido de participar de partidas.");
    return;
  }

  if (sala.status === "jogando") {
    mostrarModalAviso("🔒 Partida em andamento", "Aguarde o fim desta partida para entrar na próxima rodada.");
    return;
  }

  const saldoDisponivel = modoSaldo === "bonus" ? bonus : saldo;
  if (saldoDisponivel < sala.valor) { mostrarModalSaldoInsuficiente(sala.valor); return; }

  salaAtual = sala;
  if (modoSaldo === "bonus") bonus -= sala.valor; else saldo -= sala.valor;
  atualizarSaldo();

  fetch(`${window.location.origin}/descontar-entrada`, {
    method: "POST", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ userId: usuarioLogado.id, valor: sala.valor })
  }).catch(()=>{});

  botsArena = sala.bots.map(b => ({ nome: b.nome, avatar: b.avatar, score: 0, alvo: Math.floor(Math.random()*100)+164 }));
  document.getElementById("arena").classList.remove("hidden");
  if (sala.status === "aguardando") mostrarEspera(); else iniciarArena();
}

async function entrarSalaUsuario(salaId, valorEntrada) {
  if (usuarioLogado?.bloqueado) { mostrarModalFraude("🚫 Conta bloqueada."); return; }
  const saldoDisponivel = modoSaldo === "bonus" ? bonus : saldo;
  if (saldoDisponivel < valorEntrada) { mostrarModalSaldoInsuficiente(valorEntrada); return; }
  try {
    const res = await fetch(`${window.location.origin}/entrar-sala-usuario`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId: usuarioLogado.id, salaId }) });
    const data = await res.json();
    if (!res.ok) { mostrarModalAviso("❌ Erro", data.erro || "Não foi possível entrar"); return; }
    if (modoSaldo === "bonus") bonus -= valorEntrada; else saldo -= valorEntrada;
    atualizarSaldo();
    botsArena = Array.from({length:10},(_,i)=>({ nome: nomesBot[i]||"Bot", avatar: getAvatarAleatorio(), score:0, alvo: Math.floor(Math.random()*100)+164 }));
    salaAtual = { jogadores:10, valor: valorEntrada, status:"aguardando" };
    document.getElementById("arena").classList.remove("hidden");
    mostrarEspera();
  } catch(e) { mostrarModalAviso("❌ Erro","Erro ao conectar"); }
}

// =============================
// ➕ CRIAR SALA
// =============================
function abrirCriarSalaRapido() {
  const modal = document.createElement("div");
  modal.id = "modalCriarSala"; modal.className = "modal-overlay";
  modal.innerHTML = `<div class="modal-box" style="gap:15px;">
    <div class="modal-icon">🏟️</div>
    <h2 style="color:#3b82f6;">Criar Sala</h2>
    <p style="color:#9ca3af;font-size:13px;">Sala ativa por 24h • Livre para todos</p>
    <input id="valorCriarSalaRapido" type="number" min="0.5" step="0.5" placeholder="Valor de entrada (mín. R$ 0,50)" class="auth-input" />
    <div id="criarSalaRapidoMsg" style="font-size:13px;display:none;"></div>
    <button class="btn-primary" onclick="confirmarCriarSalaRapido()">🏟️ Criar sala</button>
    <button class="btn-secondary" onclick="document.getElementById('modalCriarSala').remove()">Cancelar</button>
  </div>`;
  document.body.appendChild(modal);
}

async function confirmarCriarSalaRapido() {
  const valor = Number(document.getElementById("valorCriarSalaRapido").value);
  const msgEl = document.getElementById("criarSalaRapidoMsg");
  if (!valor || valor < 0.5) { msgEl.innerText="Valor mínimo R$ 0,50"; msgEl.style.color="#ef4444"; msgEl.style.display="block"; return; }
  try {
    const res = await fetch(`${window.location.origin}/criar-sala`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId: usuarioLogado.id, nomeUsuario: usuarioLogado.nome, valorEntrada: valor }) });
    const data = await res.json();
    if (!res.ok) { msgEl.innerText=data.erro||"Erro"; msgEl.style.color="#ef4444"; msgEl.style.display="block"; return; }
    saldo -= valor; atualizarSaldo();
    document.getElementById("modalCriarSala").remove();
    buscarSalasUsuarios();
    mostrarModalAviso("✅ Sala criada!","Sua sala está ativa! Todos podem entrar.");
  } catch(e) { msgEl.innerText="Erro"; msgEl.style.color="#ef4444"; msgEl.style.display="block"; }
}

function mostrarModalAviso(titulo, mensagem) {
  const modal = document.createElement("div"); modal.className="modal-overlay";
  modal.innerHTML = `<div class="modal-box"><h2 style="color:#3b82f6;font-size:18px;">${titulo}</h2><p>${mensagem}</p><button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button></div>`;
  document.body.appendChild(modal);
  setTimeout(()=>{ if(modal.parentNode) modal.remove(); }, 4000);
}

function mostrarModalFraude(msg) {
  const modal = document.createElement("div"); modal.className="modal-overlay";
  modal.innerHTML = `<div class="modal-box" style="border:2px solid #ef4444;">
    <div style="font-size:48px;">🚫</div>
    <h2 style="color:#ef4444;">Conta Bloqueada</h2>
    <p style="color:#fca5a5;">${msg}</p>
    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);
}

// =============================
// ⏳ ESPERA
// =============================
function mostrarEspera() {
  const overlay = document.getElementById("arenaEspera");
  const countEl = document.getElementById("esperaCount");
  overlay.classList.remove("hidden");
  const btn = document.getElementById("clickBtn"); if (btn) btn.disabled = true;
  countEl.innerText = tempoGlobal;
  clearInterval(esperaInterval);
  esperaInterval = setInterval(() => {
    countEl.innerText = tempoGlobal;
    if (salaAtual && salaAtual.status === "jogando") { clearInterval(esperaInterval); overlay.classList.add("hidden"); if (btn) btn.disabled=false; iniciarArena(); return; }
    if (tempoGlobal <= 1) { clearInterval(esperaInterval); setTimeout(()=>{ overlay.classList.add("hidden"); if(btn) btn.disabled=false; iniciarArena(); },1000); }
  }, 500);
}

// =============================
// 💸 MODAL SALDO
// =============================
function mostrarModalSaldoInsuficiente(valorNecessario) {
  const modal = document.createElement("div"); modal.id="modalSaldoInsuficiente"; modal.className="modal-overlay";
  modal.innerHTML = `<div class="modal-box"><div class="modal-icon">💰</div><h2>Saldo insuficiente</h2>
    <p>Você precisa de <strong>R$ ${Number(valorNecessario).toFixed(2)}</strong></p>
    <p style="color:#6b7280;font-size:13px;">Real: R$ ${saldo.toFixed(2)} | Bônus: R$ ${bonus.toFixed(2)}</p>
    <button class="btn-primary" onclick="fecharModalSaldo();abrirWallet();depositar();">💳 Depositar</button>
    <button class="btn-secondary" style="margin-top:8px" onclick="fecharModalSaldo()">Fechar</button>
  </div>`;
  document.body.appendChild(modal);
}

function fecharModalSaldo() { const m=document.getElementById("modalSaldoInsuficiente"); if(m) m.remove(); }

// =============================
// ⚔️ ARENA
// =============================
function iniciarArena() {
  cliques = 0; tempo = 30; posicaoAnterior = null;
  botsArena.forEach(bot => { bot.score = 0; });
  atualizarRankingArena();
  clearInterval(timerInterval); clearInterval(botInterval);

  timerInterval = setInterval(() => {
    tempo--;
    const el = document.getElementById("arenaTimer"); if (el) el.innerText = tempo+"s";
    if (tempo <= 0) {
      clearInterval(timerInterval); clearInterval(botInterval);
      mostrarResultado(); iniciarSomAmbiente();
      setTimeout(()=>{ document.getElementById("arena").classList.add("hidden"); }, 2000);
    }
  }, 1000);

  botInterval = setInterval(() => {
    botsArena.forEach(bot => {
      const inc = bot.alvo / 60;
      bot.score = Math.min(bot.score + inc + (Math.random()*2-1), bot.alvo);
      if (bot.score < 0) bot.score = 0;
    });
    atualizarRankingArena();
  }, 500);
}

function atualizarRankingArena() {
  const nomeJogador = usuarioLogado ? usuarioLogado.nome : "VOCÊ";
  const meuAvatar = usuarioLogado ? getAvatarEmoji(usuarioLogado.avatar) : "🦊";
  let jogadores = [
    { nome: nomeJogador, score: cliques, avatar: meuAvatar },
    ...botsArena.map(b => ({ nome: b.nome, score: b.score, avatar: b.avatar }))
  ];
  jogadores.sort((a,b) => b.score-a.score);
  const max = jogadores[0].score || 1;
  const div = document.getElementById("arenaRanking"); if (!div) return;
  div.innerHTML = "";

  const posicaoAtual = jogadores.findIndex(j=>j.nome===nomeJogador)+1;
  if (posicaoAnterior !== null && posicaoAtual < posicaoAnterior) somUltrapassar();
  posicaoAnterior = posicaoAtual;

  jogadores.slice(0,4).forEach((j,i) => {
    const eVoce = j.nome === nomeJogador;
    div.innerHTML += `<div class="rank-player ${eVoce?"voce":""}">
      <div style="display:flex;justify-content:space-between;font-size:12px;align-items:center;">
        <div style="display:flex;align-items:center;gap:4px;"><span style="font-size:16px;">${j.avatar}</span><span>${i+1}º ${j.nome}</span></div>
        <span>${Math.floor(j.score)}</span>
      </div>
      <div class="barra"><div class="progresso" style="width:${(j.score/max)*100}%"></div></div>
    </div>`;
  });

  if (posicaoAtual > 4) {
    const eu = jogadores[posicaoAtual-1];
    div.innerHTML += `<div style="text-align:center;color:#374151;font-size:11px;margin:3px 0;">• • •</div>
      <div class="rank-player voce">
        <div style="display:flex;justify-content:space-between;font-size:12px;align-items:center;">
          <div style="display:flex;align-items:center;gap:4px;"><span style="font-size:16px;">${eu.avatar}</span><span>${posicaoAtual}º ${eu.nome}</span></div>
          <span>${Math.floor(eu.score)}</span>
        </div>
        <div class="barra"><div class="progresso" style="width:${(eu.score/max)*100}%"></div></div>
      </div>`;
  }
}

function configurarClickBtn() {
  const btn = document.getElementById("clickBtn"); if (!btn) return;
  btn.onclick = null;
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    if (!cliqueValido()) return;
    fetch(`${window.location.origin}/click`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId: perfil.id, timestamp: Date.now() }) }).catch(()=>{});
    somClick(); vibrar();
    cliques += 1;
    const plus = document.createElement("div"); plus.innerText="+1"; plus.className="plus-arena"; plus.style.left=Math.random()*40+30+"%"; plus.style.top="5%";
    document.getElementById("clickArea").appendChild(plus); setTimeout(()=>plus.remove(),800);
    atualizarRankingArena();
  });
}


// =============================
// 🏁 RESULTADO + XP + FRAUDE
// =============================
async function mostrarResultado() {
  somVitoria();
  const nomeJogador = usuarioLogado ? usuarioLogado.nome : "VOCÊ";
  let jogadores = [{nome:nomeJogador, score:cliques}, ...botsArena.map(b=>({nome:b.nome,score:b.score}))];
  jogadores.sort((a,b)=>b.score-a.score);

  const posicao = jogadores.findIndex(j=>j.nome===nomeJogador)+1;
  const venceu = posicao === 1;

  // ✅ VERIFICAÇÃO DE FRAUDE — 286+ cliques
  if (cliques >= 286) {
    const resF = await fetch(`${window.location.origin}/reportar-fraude`, {
      method: "POST", headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ userId: usuarioLogado.id, cliques })
    });
    const dataF = await resF.json();

    if (dataF.bloqueado) usuarioLogado.bloqueado = true;

    // mostra tela de fraude em vez do resultado normal
    mostrarTelaFraude(dataF.bloqueado);
    if (usuarioLogado) {
      fetch(`${window.location.origin}/registrar-partida`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId: usuarioLogado.id, venceu: false, cliques }) }).catch(()=>{});
    }
    return;
  }

  const titulo = document.getElementById("resultadoTitulo");
  const texto = document.getElementById("resultadoTexto");
  const ganhoEl = document.getElementById("resultadoGanho");
  titulo.classList.remove("vitoria","derrota");

  let xpGanho = 0;
  if (venceu && salaAtual) {
    const premio = parseFloat(calcularPremio(salaAtual));
    saldo += premio; atualizarSaldo();

    const resV = await fetch(`${window.location.origin}/creditar-vitoria`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ userId: usuarioLogado.id, valor: premio })
    });
    const dataV = await resV.json();
    xpGanho = dataV.xpGanho || 0;

    if (dataV.novoNivel && dataV.novoNivel !== nivelAtual) {
      nivelAtual = dataV.novoNivel;
      vitoriasNivel = 0;
      mostrarModalAviso("🎉 SUBIU DE NÍVEL!", `Você agora é ${nivelAtual}!`);
    } else {
      vitoriasNivel++;
    }

    xpAtual = calcularXPPorcentagem(nivelAtual, vitoriasNivel);
    atualizarBarraXP();

    titulo.innerText = "VOCÊ VENCEU! 🚀🔥";
    titulo.classList.add("vitoria");
    if (ganhoEl) { ganhoEl.innerText=`+R$ ${premio.toFixed(2)}`; ganhoEl.classList.remove("hidden"); }
    soltarConfete(); animarPremio(premio);

    // animação XP
    if (xpGanho > 0) {
      setTimeout(() => animarXP(xpGanho), 1500);
    }
  } else {
    titulo.innerText = `${posicao}º LUGAR`;
    texto.innerText = "Boa tentativa! Tente novamente.";
    titulo.classList.add("derrota");
    if (ganhoEl) ganhoEl.classList.add("hidden");
  }

  if (usuarioLogado) {
    fetch(`${window.location.origin}/registrar-partida`, { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ userId: usuarioLogado.id, venceu, cliques }) }).catch(()=>{});
    perfil.partidas++; if (venceu) perfil.vitorias++; else perfil.derrotas++;
    localStorage.setItem("perfil", JSON.stringify(perfil));
  }

  document.getElementById("resultado").classList.remove("hidden");
}

function mostrarTelaFraude(bloqueado) {
  const div = document.createElement("div");
  div.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.95);display:flex;align-items:center;justify-content:center;z-index:9999;";
  div.innerHTML = `
    <div style="background:linear-gradient(145deg,#1a0000,#0a0000);border:2px solid #ef4444;border-radius:20px;padding:40px 30px;max-width:320px;width:90%;text-align:center;animation:explode 0.5s ease;">
      <div style="font-size:56px;margin-bottom:10px;">🚨</div>
      <h1 style="color:#ef4444;font-size:22px;margin:0 0 15px;text-shadow:0 0 20px #ef4444;">PARTIDA SUSPEITA</h1>
      <p style="color:#fca5a5;font-size:15px;line-height:1.6;margin-bottom:20px;">Partida suspeita de fraude, iremos analisar.</p>
      ${bloqueado ? `<p style="color:#ef4444;font-weight:bold;font-size:14px;margin-bottom:15px;">⚠️ Sua conta foi bloqueada por múltiplas tentativas de fraude.</p>` : ""}
      <p style="color:#6b7280;font-size:12px;margin-bottom:20px;">O valor da entrada não será devolvido. A plataforma não se responsabiliza por comportamentos fraudulentos.</p>
      <button onclick="this.parentElement.parentElement.remove()" style="background:#374151;border:none;color:white;padding:12px 25px;border-radius:10px;cursor:pointer;font-size:15px;">Fechar</button>
    </div>
  `;
  document.body.appendChild(div);
  setTimeout(() => { document.getElementById("arena").classList.add("hidden"); }, 500);
}

function animarXP(xpGanho) {
  const div = document.createElement("div");
  div.innerText = `+${xpGanho}% XP`;
  div.style.cssText = `position:fixed;left:50%;bottom:80px;transform:translateX(-50%);color:#facc15;font-size:22px;font-weight:bold;text-shadow:0 0 15px #facc15;animation:subirXP 2s ease forwards;z-index:10000;pointer-events:none;`;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2000);
}

function animarPremio(valor) {
  for (let i=0;i<8;i++) {
    setTimeout(()=>{ const m=document.createElement("div"); m.innerText="💰"; m.style.cssText=`position:fixed;font-size:28px;left:${Math.random()*80+10}%;bottom:20%;animation:subirMoeda 1.2s ease forwards;z-index:10000;pointer-events:none;`; document.body.appendChild(m); setTimeout(()=>m.remove(),1200); },i*150);
  }
  const g=document.createElement("div"); g.innerText=`+R$ ${valor.toFixed(2)}`; g.style.cssText=`position:fixed;left:50%;top:40%;transform:translateX(-50%);color:#22c55e;font-size:36px;font-weight:bold;text-shadow:0 0 20px #22c55e;animation:subirGanho 2s ease forwards;z-index:10000;pointer-events:none;`; document.body.appendChild(g); setTimeout(()=>g.remove(),2000);
}

function fecharResultado() {
  document.getElementById("resultado").classList.add("hidden");
  const el = document.getElementById("resultadoGanho"); if (el) el.classList.add("hidden");
}

function soltarConfete() {
  const canvas = document.getElementById("confete"); const ctx = canvas.getContext("2d");
  canvas.width=window.innerWidth; canvas.height=window.innerHeight;
  let p=[]; for(let i=0;i<150;i++) p.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*6+2,d:Math.random()*5+2,color:`hsl(${Math.random()*360},100%,50%)`});
  function draw(){ctx.clearRect(0,0,canvas.width,canvas.height);p.forEach(q=>{ctx.beginPath();ctx.arc(q.x,q.y,q.r,0,Math.PI*2);ctx.fillStyle=q.color;ctx.fill();});p.forEach(q=>{q.y+=q.d;if(q.y>canvas.height){q.y=0;q.x=Math.random()*canvas.width;}});}
  let iv=setInterval(draw,20); setTimeout(()=>{clearInterval(iv);ctx.clearRect(0,0,canvas.width,canvas.height);},3000);
}

// =============================
// ⭐ BARRA DE XP
// =============================
function atualizarBarraXP() {
  const nivelInfo = getNivelInfo(nivelAtual);
  const xpPct = calcularXPPorcentagem(nivelAtual, vitoriasNivel);

  const barEl = document.getElementById("xpBarra");
  const nivelEl = document.getElementById("xpNivel");
  const pctEl = document.getElementById("xpPct");

  if (barEl) { barEl.style.width = xpPct + "%"; barEl.style.background = nivelInfo.cor; }
  if (nivelEl) { nivelEl.innerText = nivelAtual; nivelEl.style.color = nivelInfo.cor; }
  if (pctEl) pctEl.innerText = xpPct + "%";
}

// =============================
// ⏱️ TIMER GLOBAL
// =============================
function iniciarTimer() {
  setInterval(() => {
    tempoGlobal--;
    if (tempoGlobal <= 0) { iniciarRodada(); tempoGlobal = 30; }
    const el = document.getElementById("timer"); if (el) el.innerText = "00:"+tempoGlobal.toString().padStart(2,"0");
    renderSalas();
  }, 1000);
}

function iniciarRodada() { if (grupoAtual==="A"){iniciarSalas(grupoA);grupoAtual="B";}else{iniciarSalas(grupoB);grupoAtual="A";} }

function iniciarSalas(grupo) {
  grupo.forEach(index => {
    const sala = salas[index]; if (sala.emJogo) return;
    sala.status="jogando"; sala.emJogo=true; sala.tempo=30;
    let iv=setInterval(()=>{ sala.tempo--; if(sala.tempo<=0){clearInterval(iv);sala.status="aguardando";sala.emJogo=false;sala.tempo=30;gerarBotsParaSala(sala);renderSalas();} },1000);
  });
}

// =============================
// 💰 WALLET
// =============================
function abrirWallet() { document.getElementById("wallet").classList.remove("hidden"); atualizarWallet(); }

function atualizarWallet() {
  document.getElementById("walletSaldo").innerText = "R$ " + saldo.toFixed(2);
  const bonusEl = document.getElementById("walletBonus"); if (bonusEl) bonusEl.innerText = bonus>0?`🎁 Bônus: R$ ${bonus.toFixed(2)}`:"";
  const btnReal = document.getElementById("btnModoReal"); const btnBonus = document.getElementById("btnModoBonus");
  if (btnReal&&btnBonus) { btnReal.className=modoSaldo==="real"?"btn-modo ativo":"btn-modo"; btnBonus.className=modoSaldo==="bonus"?"btn-modo ativo":"btn-modo"; btnBonus.style.display=bonus>0?"flex":"none"; }
}

function selecionarModo(modo) { modoSaldo=modo; atualizarWallet(); }
function fecharWallet() { document.getElementById("wallet").classList.add("hidden"); }
function depositar() { document.getElementById("modalDeposito").classList.remove("hidden"); }
function fecharDeposito() { document.getElementById("modalDeposito").classList.add("hidden"); document.getElementById("pixContainer").innerHTML=""; }
function sacar() { document.getElementById("modalSaque").classList.remove("hidden"); }
function fecharSaque() { document.getElementById("modalSaque").classList.add("hidden"); document.getElementById("saqueMsg").classList.add("hidden"); }

async function confirmarSaque() {
  const valor = Number(document.getElementById("inputSaqueValor").value);
  const chave = document.getElementById("inputSaqueChave").value.trim();
  const msgEl = document.getElementById("saqueMsg"); msgEl.classList.add("hidden");
  if (!valor||valor<=0){msgEl.innerText="Digite um valor válido";msgEl.className="saque-erro";msgEl.classList.remove("hidden");return;}
  if (!chave){msgEl.innerText="Digite sua chave PIX";msgEl.className="saque-erro";msgEl.classList.remove("hidden");return;}
  if (valor>saldo){msgEl.innerText="Saldo insuficiente. Bônus não pode ser sacado.";msgEl.className="saque-erro";msgEl.classList.remove("hidden");return;}
  try {
    const res = await fetch(`${window.location.origin}/sacar`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({valor,userId:usuarioLogado.id,chave_pix:chave})});
    const data = await res.json();
    if (!res.ok){msgEl.innerText=data.erro||"Erro";msgEl.className="saque-erro";msgEl.classList.remove("hidden");return;}
    saldo-=valor; atualizarSaldo();
    msgEl.innerText=data.mensagem; msgEl.className="saque-sucesso"; msgEl.classList.remove("hidden");
    document.getElementById("inputSaqueValor").value=""; document.getElementById("inputSaqueChave").value="";
  } catch(err){msgEl.innerText="Erro ao conectar";msgEl.className="saque-erro";msgEl.classList.remove("hidden");}
}

async function confirmarDeposito() {
  const valor = document.getElementById("inputValor").value;
  const container = document.getElementById("pixContainer");
  if (!valor||Number(valor)<5){container.innerHTML="<p style='color:#ef4444'>Depósito mínimo R$ 5,00</p>";return;}
  container.innerHTML="<p>⏳ Gerando PIX...</p>";
  try {
    const res = await fetch(`${window.location.origin}/criar-pagamento`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({valor:Number(valor),userId:usuarioLogado.id})});
    if (!res.ok){container.innerHTML="<p style='color:red'>Erro ao gerar PIX</p>";return;}
    const data = await res.json();
    container.innerHTML=`<img src="data:image/png;base64,${data.qr_base64}" style="width:200px;margin-top:10px;border-radius:10px;"><button onclick="copiarPix('${data.qr_code}')" class="btn-copiar">📋 Copiar PIX</button><div id="feedbackPix" class="hidden"></div><div id="pixStatus" style="margin-top:10px;color:#9ca3af;font-size:13px;">⏳ Aguardando...</div>`;
    const verificar = setInterval(async()=>{
      try{const r=await fetch(`${window.location.origin}/saldo/${usuarioLogado.id}`);const d=await r.json();if(d.saldo>saldo){clearInterval(verificar);const diff=d.saldo-saldo;saldo=d.saldo;bonus=d.bonus||bonus;atualizarSaldo();container.innerHTML=`<div class="pix-sucesso">✅ Depósito de R$ ${diff.toFixed(2)} realizado!</div>`;setTimeout(()=>fecharDeposito(),3000);}}catch(e){}
    },4000);
    setTimeout(()=>clearInterval(verificar),600000);
  } catch(err){container.innerHTML="<p style='color:red'>Erro</p>";}
}

function copiarPix(c){navigator.clipboard.writeText(c).then(()=>mostrarFeedback("✅ Pix copiado")).catch(()=>mostrarFeedback("❌ Erro"));}
function mostrarFeedback(msg){const d=document.getElementById("feedbackPix");if(!d)return;d.innerText=msg;d.classList.remove("hidden");d.classList.add("feedback-sucesso");setTimeout(()=>d.classList.add("hidden"),2000);}

async function buscarSaldo() {
  if (!usuarioLogado) return;
  try {
    const res = await fetch(`${window.location.origin}/saldo/${usuarioLogado.id}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.saldo > ultimoSaldo && ultimoSaldo > 0) animarDinheiro(data.saldo - ultimoSaldo);
    ultimoSaldo = data.saldo; saldo = data.saldo; bonus = data.bonus||0;
    xpAtual = data.xp||0; nivelAtual = data.nivel||"Iniciante"; vitoriasNivel = data.vitorias_nivel||0;
    if (data.bloqueado) usuarioLogado.bloqueado = true;
    const el = document.getElementById("saldo"); if (el) el.innerText = "R$ " + data.saldo.toFixed(2);
    atualizarBarraXP();
  } catch(err){}
}

function atualizarSaldo() { const e1=document.getElementById("saldo"),e2=document.getElementById("walletSaldo"); if(e1)e1.innerText="R$ "+saldo.toFixed(2); if(e2)e2.innerText="R$ "+saldo.toFixed(2); }
function animarDinheiro(v){const d=document.createElement("div");d.innerText=`+R$ ${v.toFixed(2)}`;d.className="money";d.style.left="50%";d.style.top="50%";document.body.appendChild(d);setTimeout(()=>d.remove(),1000);}

async function verHistorico() {
  if (!usuarioLogado) return;
  const area = document.getElementById("historicoArea");
  if (!area.classList.contains("hidden")) { area.classList.add("hidden"); return; }
  const res = await fetch(`${window.location.origin}/historico/${usuarioLogado.id}`);
  const dados = await res.json();
  if (!dados.length) { area.innerHTML="<p style='text-align:center;color:#6b7280;'>Nenhuma transação</p>"; }
  else { area.innerHTML=dados.map(item=>`<div style="background:#111;padding:10px;margin-bottom:8px;border-radius:8px;"><strong>${item.tipo}</strong> — R$ ${Number(item.valor).toFixed(2)}<br><small style="color:#6b7280">${new Date(item.data).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"})}</small></div>`).join(""); }
  area.classList.remove("hidden");
}

// =============================
// 🔗 CONVITE
// =============================
async function abrirConvite() {
  abrirTela(`<div class="tela-box"><div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>🔗 Convidar Amigos</h2></div>
    <div class="tela-content" style="text-align:center;">
      <div style="font-size:48px;margin-bottom:15px;">🎁</div>
      <p style="color:#e5e7eb;margin-bottom:5px;">Convide amigos e <strong>você</strong> ganha</p>
      <h2 style="color:#22c55e;margin:5px 0;">R$ 10,00 de bônus</h2>
      <p style="color:#9ca3af;font-size:13px;margin-bottom:25px;">Para cada amigo cadastrado pelo seu link você ganha R$10.</p>
      <div id="conviteContainer"><button class="btn-primary" onclick="gerarLinkConvite()">Gerar meu link</button></div>
    </div></div>`);
}

async function gerarLinkConvite() {
  const c = document.getElementById("conviteContainer"); c.innerHTML="<p>⏳ Gerando...</p>";
  try {
    const res = await fetch(`${window.location.origin}/criar-convite`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:usuarioLogado.id,nomeUsuario:usuarioLogado.nome})});
    const data = await res.json();
    if (!res.ok){c.innerHTML="<p style='color:red'>Erro</p>";return;}
    c.innerHTML=`<div style="background:#111827;padding:15px;border-radius:12px;margin-bottom:15px;"><p style="color:#9ca3af;font-size:12px;margin-bottom:8px;">Seu link:</p><p style="color:#22c55e;font-size:13px;word-break:break-all;">${data.link}</p></div>
      <button class="btn-primary" onclick="navigator.clipboard.writeText('${data.link}').then(()=>alert('Copiado!'))">📋 Copiar</button>
      <p style="color:#6b7280;font-size:12px;margin-top:15px;">Convites ilimitados!</p>`;
  } catch(e){c.innerHTML="<p style='color:red'>Erro</p>";}
}

// =============================
// 👤 PERFIL + AVATARES
// =============================
function abrirPerfil() {
  const total = perfil.partidas||0; const vitorias = perfil.vitorias||0; const derrotas = perfil.derrotas||0;
  const aproveitamento = total>0?Math.round((vitorias/total)*100):0;
  const nivelInfo = getNivelInfo(nivelAtual);
  const xpPct = calcularXPPorcentagem(nivelAtual, vitoriasNivel);
  const meuAvatar = getAvatarEmoji(usuarioLogado?.avatar);

  abrirTela(`
    <div class="tela-box perfil-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>Perfil</h2></div>
      <div class="perfil-header">
        <div style="font-size:72px;cursor:pointer;" onclick="abrirGaleriaAvatares()">${meuAvatar}</div>
        <p style="font-size:12px;color:#6b7280;margin-top:5px;">Toque para trocar avatar</p>
        <input id="nomePerfil" value="${perfil.nome}" class="input-nome" />
      </div>
      <div style="margin:0 20px 15px;background:#0f172a;border-radius:12px;padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <span style="color:${nivelInfo.cor};font-weight:bold;font-size:14px;">${nivelAtual}</span>
          <span style="color:#9ca3af;font-size:12px;">${xpPct}% XP</span>
        </div>
        <div style="height:8px;background:#1f2937;border-radius:8px;overflow:hidden;">
          <div style="width:${xpPct}%;height:100%;background:${nivelInfo.cor};border-radius:8px;transition:width 0.5s;"></div>
        </div>
      </div>
      <div class="perfil-saldo"><span>Saldo real</span><h1>R$ ${saldo.toFixed(2)}</h1>${bonus>0?`<p style="color:#f59e0b;font-size:13px;margin:5px 0 0;">🎁 Bônus: R$ ${bonus.toFixed(2)}</p>`:""}</div>
      <div class="perfil-stats">
        <div class="stat"><strong>${total}</strong><span>Partidas</span></div>
        <div class="stat"><strong>${vitorias}</strong><span>Vitórias</span></div>
        <div class="stat"><strong>${derrotas}</strong><span>Derrotas</span></div>
        <div class="stat"><strong>${aproveitamento}%</strong><span>Aproveit.</span></div>
      </div>
      <div class="perfil-actions">
        <button class="btn-primary" onclick="salvarNome()">💾 Salvar nome</button>
        <button class="btn-secondary" onclick="fecharTela()">✕ Fechar</button>
      </div>
    </div>`);
}

function abrirGaleriaAvatares() {
  const AVATARES_LIST = ["🦊","🐺","🦁","🐯","🐻","🐼","🦝","🦄","🐲","🦅","🦋","🐬","🦈","🐙","🦚","🦜","🦩","🐧","🦉","🧙","🧝","🧛","🤺","🥷","🧜","🧚","👑","💎","🔥","⚡","🌟","🎯","🏆","💪","🎮","🕹️","👾","🤖","👻","🌈","🦸","🧟","🎭","🐉","🦕","🤠","😈","👽","🦀","🐊"];

  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="abrirPerfil()">←</span><h2>Escolher Avatar</h2></div>
      <div class="tela-content">
        <p style="color:#9ca3af;margin-bottom:15px;text-align:center;">Escolha seu avatar</p>
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;">
          ${AVATARES_LIST.map((av,i) => `
            <div onclick="selecionarAvatar('${av}')" style="font-size:36px;text-align:center;padding:10px;border-radius:12px;cursor:pointer;background:${getAvatarEmoji(usuarioLogado?.avatar)===av?'rgba(59,130,246,0.3)':'#111827'};border:${getAvatarEmoji(usuarioLogado?.avatar)===av?'2px solid #3b82f6':'2px solid transparent'};transition:0.2s;">
              ${av}
            </div>`).join("")}
        </div>
      </div>
    </div>`);
}

async function selecionarAvatar(emoji) {
  if (!usuarioLogado) return;
  try {
    await fetch(`${window.location.origin}/atualizar-avatar`, {
      method:"POST", headers:{"Content-Type":"application/json"},
      body: JSON.stringify({ userId: usuarioLogado.id, avatar: emoji })
    });
    usuarioLogado.avatar = emoji;
    localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
    abrirPerfil();
  } catch(e) {}
}

function salvarNome() {
  const input = document.getElementById("nomePerfil");
  if (input) { perfil.nome=input.value; if(usuarioLogado)usuarioLogado.nome=input.value; localStorage.setItem("perfil",JSON.stringify(perfil)); localStorage.setItem("usuario",JSON.stringify(usuarioLogado)); fecharTela(); }
}

// =============================
// 🗂️ MENU
// =============================
function abrirMenu() { document.getElementById("menuLateral").classList.remove("hidden"); }
function fecharMenu() { document.getElementById("menuLateral").classList.add("hidden"); }

function abrirTela(html) {
  const tela = document.getElementById("telaMenu"); tela.innerHTML = html; tela.classList.remove("hidden"); document.body.style.overflow="hidden";
}

function fecharTela() { document.getElementById("telaMenu").classList.add("hidden"); document.body.style.overflow=""; }

function abrirReclamacoes() {
  abrirTela(`<div class="tela-box"><div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>🚨 Reclamações</h2></div>
    <div class="tela-content">
      <p style="color:#9ca3af;margin-bottom:15px;">Sua reclamação será enviada para nossa equipe.</p>
      <textarea id="textoReclamacao" placeholder="Descreva aqui..."></textarea>
      <div id="reclamacaoMsg" style="display:none;font-size:13px;margin-bottom:10px;"></div>
      <button class="btn-primary" onclick="enviarReclamacao()">Enviar reclamação</button>
    </div></div>`);
}

async function enviarReclamacao() {
  const texto = document.getElementById("textoReclamacao").value.trim();
  const msgEl = document.getElementById("reclamacaoMsg"); msgEl.style.display="none";
  if (!texto){msgEl.innerText="Escreva antes de enviar";msgEl.style.color="#ef4444";msgEl.style.display="block";return;}
  try {
    const res = await fetch(`${window.location.origin}/reclamacao`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({userId:usuarioLogado?.id,nomeUsuario:usuarioLogado?.nome||"Anônimo",emailUsuario:usuarioLogado?.email||"",mensagem:texto})});
    if (res.ok){msgEl.innerText="✅ Reclamação enviada! Lhe daremos um retorno em breve.";msgEl.style.color="#22c55e";msgEl.style.display="block";document.getElementById("textoReclamacao").value="";}
    else{msgEl.innerText="Erro ao enviar.";msgEl.style.color="#ef4444";msgEl.style.display="block";}
  } catch(e){msgEl.innerText="Erro de conexão.";msgEl.style.color="#ef4444";msgEl.style.display="block";}
}

function abrirConfiguracoes() {
  abrirTela(`<div class="tela-box"><div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>Configurações</h2></div>
    <div class="tela-content">
      <div class="config-item"><span>Som</span><input type="checkbox" ${somAtivo?"checked":""} onchange="toggleSom()"></div>
      <div class="config-item"><span>Vibração</span><input type="checkbox" checked></div>
    </div></div>`);
}

function abrirDiretrizes() {
  abrirTela(`<div class="tela-box"><div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>Diretrizes</h2></div>
    <div class="tela-content"><p style="line-height:1.8;color:#e5e7eb;">DIRETRIZES OFICIAIS — CLICK ARENA

1. SOBRE O CLICK ARENA

O Click Arena é uma plataforma de competição online baseada em habilidade, velocidade e desempenho em tempo real.

O vencedor da partida é definido exclusivamente pelo desempenho obtido durante o tempo da competição.

O Click Arena NÃO é uma plataforma de apostas.

---

2. SISTEMA ANTIBOT E ANTIFRAUDE

É proibido utilizar autoclick, scripts, programas automatizados ou qualquer mecanismo que simule cliques humanos.

Partidas com pontuação suspeita serão anuladas e o valor não será devolvido. Na terceira tentativa de fraude a conta será bloqueada permanentemente.

---

3. SAQUES E DEPÓSITOS

Depósito mínimo: R$ 5,00. Saques processados em até 48h. Bônus não pode ser sacado diretamente.

---

4. CONDUTA

Respeite os outros jogadores. Comportamento abusivo resultará em banimento.</p></div></div>`);
}

// =============================
// 🎭 AVATAR NO CADASTRO
// =============================
function abrirGaleriaAvataresCadastro() {
  const AVATARES_LIST = ["🦊","🐺","🦁","🐯","🐻","🐼","🦝","🦄","🐲","🦅","🦋","🐬","🦈","🐙","🦚","🦜","🦩","🐧","🦉","🧙","🧝","🧛","🤺","🥷","👑","💎","🔥","⚡","🌟","🎯","🏆","💪","🎮","👾","🤖","👻","🌈","🦸","😈","👽"];
  const div = document.createElement("div"); div.id="galeriaAvatarCad"; div.className="modal-overlay";
  div.innerHTML=`<div class="modal-box" style="max-height:80vh;overflow-y:auto;">
    <h2 style="color:#3b82f6;margin-bottom:15px;">Escolha seu avatar</h2>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:15px;">
      ${AVATARES_LIST.map(av=>`<div onclick="escolherAvatarCadastro('${av}',this)" style="font-size:32px;text-align:center;padding:8px;border-radius:10px;cursor:pointer;background:#111827;border:2px solid transparent;">${av}</div>`).join("")}
    </div>
    <button class="btn-secondary" onclick="document.getElementById('galeriaAvatarCad').remove()">Fechar</button>
  </div>`;
  document.body.appendChild(div);
}

function escolherAvatarCadastro(emoji, el) {
  localStorage.setItem("avatarCadastro", emoji);
  document.querySelectorAll("#galeriaAvatarCad div[onclick]").forEach(d => { d.style.borderColor="transparent"; d.style.background="#111827"; });
  el.style.borderColor="#3b82f6"; el.style.background="rgba(59,130,246,0.2)";
  const preview = document.getElementById("avatarPreviewCad");
  if (preview) { preview.innerText = emoji; preview.style.fontSize = "48px"; }
  setTimeout(()=>document.getElementById("galeriaAvatarCad").remove(), 300);
}