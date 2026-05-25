// =============================
// 🔐 AUTENTICAÇÃO
// =============================

let usuarioLogado = null;
let fotoBase64 = null;

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const convite = params.get("convite");
  if (convite) localStorage.setItem("codigo_convite", convite);

  const sessao = localStorage.getItem("usuario");
  if (sessao) {
    usuarioLogado = JSON.parse(sessao);
    iniciarJogo();
  }

  // ✅ intercepta botão voltar do celular
  history.pushState({ tela: "jogo" }, "");
  window.addEventListener("popstate", (e) => {
    history.pushState({ tela: "jogo" }, "");
    fecharTelaAtiva();
  });
});

// fecha qualquer tela aberta ao pressionar voltar
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

function previewFoto(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    fotoBase64 = e.target.result;
    const preview = document.getElementById("fotoPreview");
    preview.style.backgroundImage = `url(${fotoBase64})`;
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
    preview.style.borderRadius = "50%";
    preview.innerText = "";
  };
  reader.readAsDataURL(file);
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

  try {
    const res = await fetch(`${window.location.origin}/cadastro`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, foto_base64: fotoBase64, codigo_convite })
    });
    const data = await res.json();
    if (!res.ok) { erroEl.innerText = data.erro || "Erro ao criar conta"; erroEl.classList.remove("hidden"); return; }
    localStorage.removeItem("codigo_convite");
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

  atualizarSaldo();
  iniciarBotsSalas();
  renderSalas();
  sincronizarTimer();
  buscarSaldo();
  buscarRankingDiario();

  setInterval(buscarSaldo, 5000);
  setInterval(buscarRankingDiario, 10000);

  configurarClickBtn();
  configurarClickBtnTreino();
}

// =============================
// 🎮 VARIÁVEIS
// =============================

let ultimoClique = 0;
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

// ✅ modo de saldo: "real" ou "bonus"
let modoSaldo = "real";

let perfil = JSON.parse(localStorage.getItem("perfil")) || {
  nome: "Jogador", id: "user1", partidas: 0, vitorias: 0, derrotas: 0
};

let combo = 0;
let saldo = 0;
let tempoGlobal = 30;
let cliques = 0;
let tempo = 30;
let salaAtual = null;

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
// 🤖 BOTS
// =============================
const nomesBot = [
  "Carlos Mendes","Ana Lima","Pedro Costa","Julia Rocha","Rafael Souza",
  "Fernanda Dias","Lucas Oliveira","Beatriz Nunes","Thiago Alves","Camila Ferreira",
  "Bruno Santos","Larissa Gomes","Diego Martins","Leticia Carvalho","Mateus Ribeiro",
  "Vanessa Pereira","Felipe Araujo","Isabela Castro","Gustavo Lima","Patricia Moura",
  "Anderson Lima","Mariana Costa","Ricardo Souza","Juliana Ferreira","Eduardo Santos",
  "Gabriela Silva","Leandro Oliveira","Amanda Rocha","Marcos Alves","Natalia Gomes",
  "Vinicius Dias","Priscila Carvalho","Rodrigo Martins","Aline Ribeiro","Fabio Pereira",
  "Tatiane Lima"
];

const fotosBot = [
  "https://randomuser.me/api/portraits/men/32.jpg","https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/15.jpg","https://randomuser.me/api/portraits/women/28.jpg",
  "https://randomuser.me/api/portraits/men/67.jpg","https://randomuser.me/api/portraits/women/55.jpg",
  "https://randomuser.me/api/portraits/men/41.jpg","https://randomuser.me/api/portraits/women/19.jpg",
  "https://randomuser.me/api/portraits/men/88.jpg","https://randomuser.me/api/portraits/women/72.jpg",
  "https://randomuser.me/api/portraits/men/23.jpg","https://randomuser.me/api/portraits/women/36.jpg",
  "https://randomuser.me/api/portraits/men/51.jpg","https://randomuser.me/api/portraits/women/61.jpg",
  "https://randomuser.me/api/portraits/men/77.jpg","https://randomuser.me/api/portraits/women/83.jpg",
  "https://randomuser.me/api/portraits/men/5.jpg","https://randomuser.me/api/portraits/women/9.jpg",
  "https://randomuser.me/api/portraits/men/99.jpg","https://randomuser.me/api/portraits/women/47.jpg",
  "https://randomuser.me/api/portraits/men/12.jpg","https://randomuser.me/api/portraits/women/33.jpg",
  "https://randomuser.me/api/portraits/men/45.jpg","https://randomuser.me/api/portraits/women/58.jpg",
  "https://randomuser.me/api/portraits/men/71.jpg","https://randomuser.me/api/portraits/women/22.jpg",
  "https://randomuser.me/api/portraits/men/63.jpg","https://randomuser.me/api/portraits/women/91.jpg",
  "https://randomuser.me/api/portraits/men/38.jpg","https://randomuser.me/api/portraits/women/16.jpg",
  "https://randomuser.me/api/portraits/men/54.jpg","https://randomuser.me/api/portraits/women/69.jpg",
  "https://randomuser.me/api/portraits/men/82.jpg","https://randomuser.me/api/portraits/women/37.jpg",
  "https://randomuser.me/api/portraits/men/29.jpg","https://randomuser.me/api/portraits/women/48.jpg",
];

const salas = [
  { nome: "Bronze",   jogadores: 0, max: 50, valor: 2,  tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Prata",    jogadores: 0, max: 50, valor: 5,  tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Ouro",     jogadores: 0, max: 50, valor: 10, tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Diamante", jogadores: 0, max: 50, valor: 20, tempo: 30, status: "aguardando", emJogo: false, bots: [] },
];

const grupoA = [0, 1];
const grupoB = [2, 3];
let grupoAtual = "A";
let botsArena = [];

function gerarBotsParaSala(sala) {
  const qtd = Math.floor(Math.random() * 25) + 18;
  const indices = [];
  while (indices.length < Math.min(qtd, nomesBot.length)) {
    const i = Math.floor(Math.random() * nomesBot.length);
    if (!indices.includes(i)) indices.push(i);
  }
  sala.bots = indices.map(i => ({ nome: nomesBot[i], foto: fotosBot[i], score: 0 }));
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
  if (!window.somAmbienteIniciado) {
    window.somAmbienteIniciado = true;
    window.somIntervalo = setInterval(() => iniciarSomAmbiente(), 3000);
  }
});

function toggleSom() {
  somAtivo = !somAtivo;
  const btn = document.getElementById("btnSom");
  if (btn) btn.innerText = somAtivo ? "🔊" : "🔇";
}

function iniciarSomAmbiente() {
  if (!somAtivo || !audioCtx || ambientOsc) return;
  ambientOsc = audioCtx.createOscillator();
  ambientGain = audioCtx.createGain();
  ambientOsc.type = "triangle";
  let agora = audioCtx.currentTime;
  ambientOsc.frequency.setValueAtTime(600, agora);
  ambientOsc.frequency.linearRampToValueAtTime(900, agora + 0.1);
  ambientOsc.frequency.linearRampToValueAtTime(700, agora + 0.2);
  ambientGain.gain.setValueAtTime(0.1, agora);
  ambientGain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.25);
  ambientOsc.connect(ambientGain);
  ambientGain.connect(audioCtx.destination);
  ambientOsc.start(agora);
  ambientOsc.stop(agora + 0.25);
  ambientOsc.onended = () => { ambientOsc = null; };
}

function pararSomAmbiente() {
  if (!ambientOsc) return;
  try { ambientOsc.stop(); ambientOsc.disconnect(); } catch(e) {}
  ambientOsc = null;
}

function somClick() {
  if (!somAtivo || !audioCtx) return;
  let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
  osc.frequency.value = 600; osc.type = "square"; gain.gain.value = 0.004;
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.05);
}

function somUltrapassar() {
  if (!somAtivo || !audioCtx) return;
  let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.2);
  gain.gain.value = 0.04;
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.2);
}

function somVitoria() {
  if (!somAtivo || !audioCtx) return;
  let osc = audioCtx.createOscillator(); let gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(500, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
  gain.gain.value = 0.03;
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start(); osc.stop(audioCtx.currentTime + 0.5);
}

function vibrar() { if (navigator.vibrate) navigator.vibrate(30); }

// =============================
// 🛡️ ANTI-BOT
// =============================
setInterval(() => { if (cliquesSegundo > 15) console.log("🚨"); cliquesSegundo = 0; }, 1000);

function cliqueValido() {
  const agora = Date.now();
  if (agora - ultimoCliqueValido < 80) return false;
  ultimoCliqueValido = agora;
  cliquesSegundo++;
  historicoCliques.push(agora);
  if (historicoCliques.length > 10) historicoCliques.shift();
  if (historicoCliques.length === 10) {
    let intervalos = [];
    for (let i = 1; i < historicoCliques.length; i++) intervalos.push(historicoCliques[i] - historicoCliques[i-1]);
    if (intervalos.every(v => Math.abs(v - intervalos[0]) < 5)) return false;
  }
  return true;
}

// =============================
// 💬 CHAT com hora + swipe
// =============================
let chatAberto = false;
let chatInterval = null;
let chatSwipeStartY = 0;

function abrirChat() {
  document.getElementById("chatGlobal").classList.remove("hidden");
  chatAberto = true;
  carregarMensagens();
  chatInterval = setInterval(carregarMensagens, 3000);

  // swipe para fechar
  const chatBox = document.querySelector(".chat-box");
  chatBox.addEventListener("touchstart", (e) => { chatSwipeStartY = e.touches[0].clientY; }, { passive: true });
  chatBox.addEventListener("touchend", (e) => {
    const diff = e.changedTouches[0].clientY - chatSwipeStartY;
    if (diff > 80) fecharChat(); // swipe down de 80px fecha
  }, { passive: true });
}

function fecharChat() {
  document.getElementById("chatGlobal").classList.add("hidden");
  chatAberto = false;
  clearInterval(chatInterval);
}

function formatarHora(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

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
      const foto = m.foto_url ? `<img src="${m.foto_url}" class="chat-foto" />` : `<div class="chat-avatar">${m.nome.charAt(0).toUpperCase()}</div>`;
      const hora = m.created_at ? `<span class="chat-hora">${formatarHora(m.created_at)}</span>` : "";
      container.innerHTML += `
        <div class="chat-msg ${souEu ? "chat-msg-eu" : ""}">
          ${!souEu ? foto : ""}
          <div class="chat-bubble ${souEu ? "bubble-eu" : "bubble-outro"}">
            ${!souEu ? `<div class="chat-nome">${m.nome}</div>` : ""}
            <div>${m.mensagem}</div>
            ${hora}
          </div>
          ${souEu ? foto : ""}
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
  try {
    await fetch(`${window.location.origin}/chat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, nome: usuarioLogado.nome, foto_url: usuarioLogado.foto_url, mensagem: msg })
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
  treinoCliquesCount = 0;
  treinoTempo = 30;
  document.getElementById("arenaTreino").classList.remove("hidden");
  document.getElementById("treinoCliques").innerText = "0";
  document.getElementById("treino-barra").style.width = "0%";
  if (usuarioLogado) {
    try {
      const res = await fetch(`${window.location.origin}/recordes-treino/${usuarioLogado.id}`);
      recordesTreino = await res.json();
      renderRecordesTreino();
    } catch(e) {}
  }
  iniciarTreino();
}

function renderRecordesTreino() {
  const div = document.getElementById("recordesTreino");
  if (!div) return;
  if (!recordesTreino.length) { div.innerHTML = `<p style="color:#6b7280; font-size:12px; text-align:center;">Sem recordes ainda</p>`; return; }
  const medalhas = ["🥇","🥈","🥉"];
  div.innerHTML = `<p style="color:#9ca3af; font-size:12px; margin-bottom:6px;">Seus recordes:</p>` +
    recordesTreino.map((r, i) => `
      <div style="display:flex; justify-content:space-between; font-size:13px; padding:4px 0; border-bottom:1px solid #1f2937;">
        <span>${medalhas[i]} ${i+1}º</span>
        <span style="color:#22c55e; font-weight:bold;">${r.cliques} cliques</span>
      </div>
    `).join("");
}

function fecharTreino() { clearInterval(treinoInterval); document.getElementById("arenaTreino").classList.add("hidden"); }

function iniciarTreino() {
  clearInterval(treinoInterval);
  treinoTempo = 30;
  treinoInterval = setInterval(() => {
    treinoTempo--;
    const el = document.getElementById("treinoTimer");
    if (el) el.innerText = treinoTempo + "s";
    if (treinoTempo <= 0) {
      clearInterval(treinoInterval);
      document.getElementById("arenaTreino").classList.add("hidden");
      if (usuarioLogado) {
        fetch(`${window.location.origin}/recorde-treino`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: usuarioLogado.id, cliques: treinoCliquesCount })
        }).catch(() => {});
      }
      const titulo = document.getElementById("resultadoTitulo");
      const texto = document.getElementById("resultadoTexto");
      titulo.classList.remove("vitoria","derrota");
      titulo.classList.add("vitoria");
      titulo.innerText = "🏋️ TREINO CONCLUÍDO";
      texto.innerText = `Você fez ${treinoCliquesCount} cliques!`;
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
    treinoCliquesCount++;
    somClick(); vibrar();
    const el = document.getElementById("treinoCliques");
    if (el) el.innerText = treinoCliquesCount;
    const barra = document.getElementById("treino-barra");
    if (barra) barra.style.width = Math.min((treinoCliquesCount / 200) * 100, 100) + "%";
    const plus = document.createElement("div");
    plus.innerText = "+1"; plus.className = "plus-treino";
    plus.style.left = Math.random() * 40 + 30 + "%";
    plus.style.top = "10%";
    document.getElementById("clickAreaTreino").appendChild(plus);
    setTimeout(() => plus.remove(), 800);
  });
}

// =============================
// 🏆 RANKING
// =============================
let rankingDiario = [];

async function buscarRankingDiario() {
  try {
    const res = await fetch(`${window.location.origin}/ranking`);
    if (!res.ok) return;
    rankingDiario = await res.json();
    renderRanking();
  } catch(e) {}
}

function renderRanking() {
  const div = document.getElementById("ranking");
  if (!div) return;
  div.innerHTML = "<h3>🏆 Top jogadores hoje</h3>";
  const icones = ["🥇","🥈","🥉"];
  const classes = ["gold","silver","bronze"];

  if (!rankingDiario.length) {
    if (usuarioLogado) {
      const foto = usuarioLogado.foto_url ? `<img src="${usuarioLogado.foto_url}" class="rank-foto" />` : `<div class="rank-avatar">${usuarioLogado.nome.charAt(0)}</div>`;
      div.innerHTML += `
        <p style="text-align:center; color:#6b7280; font-size:13px; padding:10px 0;">Nenhuma partida hoje ainda</p>
        <div class="rank-card voce-rank">
          <div class="rank-left"><div class="rank-icon">—</div>${foto}
            <div><div class="rank-name">${usuarioLogado.nome} (você)</div><div class="rank-info">0 vitórias • 0 cliques</div></div>
          </div>
          <div class="rank-money">R$ 0</div>
        </div>
      `;
    }
    return;
  }

  rankingDiario.slice(0, 3).forEach((j, i) => {
    const foto = j.foto_url ? `<img src="${j.foto_url}" class="rank-foto" />` : `<div class="rank-avatar">${j.nome.charAt(0).toUpperCase()}</div>`;
    div.innerHTML += `
      <div class="rank-card ${classes[i]}">
        <div class="rank-left"><div class="rank-icon">${icones[i]}</div>${foto}
          <div><div class="rank-name">${j.nome}</div><div class="rank-info">${j.vitorias} vitórias • ${j.cliques} cliques</div></div>
        </div>
        <div class="rank-money">R$ ${Number(j.ganho).toFixed(2)}</div>
      </div>
    `;
  });

  if (usuarioLogado) {
    const pos = rankingDiario.findIndex(j => j.user_id === usuarioLogado.id);
    if (pos >= 3) {
      const eu = rankingDiario[pos];
      const foto = eu.foto_url ? `<img src="${eu.foto_url}" class="rank-foto" />` : `<div class="rank-avatar">${eu.nome.charAt(0)}</div>`;
      div.innerHTML += `
        <div class="rank-separador">• • •</div>
        <div class="rank-card voce-rank">
          <div class="rank-left"><div class="rank-icon">${pos+1}º</div>${foto}
            <div><div class="rank-name">${eu.nome} (você)</div><div class="rank-info">${eu.vitorias} vitórias • ${eu.cliques} cliques</div></div>
          </div>
          <div class="rank-money">R$ ${Number(eu.ganho).toFixed(2)}</div>
        </div>
      `;
    } else if (pos === -1) {
      const foto = usuarioLogado.foto_url ? `<img src="${usuarioLogado.foto_url}" class="rank-foto" />` : `<div class="rank-avatar">${usuarioLogado.nome.charAt(0)}</div>`;
      div.innerHTML += `
        <div class="rank-separador">• • •</div>
        <div class="rank-card voce-rank">
          <div class="rank-left"><div class="rank-icon">—</div>${foto}
            <div><div class="rank-name">${usuarioLogado.nome} (você)</div><div class="rank-info">0 vitórias • 0 cliques</div></div>
          </div>
          <div class="rank-money">R$ 0</div>
        </div>
      `;
    }
  }
}

// =============================
// 🚪 SALAS
// =============================
function calcularPremio(sala) {
  return ((sala.jogadores * sala.valor) * 0.7).toFixed(2);
}

function renderSalas() {
  const div = document.getElementById("salas");
  if (!div) return;
  div.innerHTML = "";
  salas.forEach(sala => {
    const premio = calcularPremio(sala);
    div.innerHTML += `
      <div class="sala ${sala.status === 'jogando' ? 'sala-bloqueada' : ''}" onclick="entrarSala('${sala.nome}')">
        <div class="sala-left">
          <b>${sala.nome}</b>
          <span class="sala-jogadores"><span class="jog-ativo">${sala.jogadores}</span>/${sala.max} jogadores</span>
        </div>
        <div class="sala-right">
          <div class="sala-premio">🏆 R$ ${premio}</div>
          <div class="sala-entrada">Entrada: R$ ${sala.valor}</div>
          <div class="${sala.status === 'jogando' ? 'red' : 'green'}">
            ${sala.status === 'jogando' ? '🔒 Em jogo (' + sala.tempo + 's)' : '⏳ Começa em ' + tempoGlobal.toString().padStart(2,'0') + 's'}
          </div>
        </div>
      </div>
    `;
  });
}

function entrarSala(nome) {
  pararSomAmbiente();
  const sala = salas.find(s => s.nome === nome);

  if (sala.status === "jogando") {
    mostrarModalAviso("🔒 Partida em andamento", "Aguarde o fim desta partida para entrar na próxima rodada.");
    return;
  }

  // ✅ calcula saldo disponível conforme modo selecionado
  const saldoDisponivel = modoSaldo === "bonus" ? bonus : saldo;
  if (saldoDisponivel < sala.valor) {
    mostrarModalSaldoInsuficiente(sala.valor);
    return;
  }

  salaAtual = sala;

  // desconta localmente
  if (modoSaldo === "bonus") {
    bonus -= sala.valor;
  } else {
    saldo -= sala.valor;
  }
  atualizarSaldo();

  // desconta no servidor
  fetch(`${window.location.origin}/descontar-entrada`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: usuarioLogado.id, valor: sala.valor, modo: modoSaldo })
  }).catch(() => {});

  botsArena = sala.bots.map(b => ({
    nome: b.nome, foto: b.foto, score: 0,
    alvo: Math.floor(Math.random() * 70) + 258 // 142 a 328
  }));

  document.getElementById("arena").classList.remove("hidden");
  if (sala.status === "aguardando") mostrarEspera();
  else iniciarArena();
}

function mostrarModalAviso(titulo, mensagem) {
  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">🔒</div>
      <h2>${titulo}</h2>
      <p>${mensagem}</p>
      <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);
  setTimeout(() => modal.remove(), 3000);
}

// =============================
// ⏳ ESPERA
// =============================
function mostrarEspera() {
  const overlay = document.getElementById("arenaEspera");
  const countEl = document.getElementById("esperaCount");
  overlay.classList.remove("hidden");
  const btn = document.getElementById("clickBtn");
  if (btn) btn.disabled = true;
  countEl.innerText = tempoGlobal;

  clearInterval(esperaInterval);
  esperaInterval = setInterval(() => {
    countEl.innerText = tempoGlobal;
    if (salaAtual && salaAtual.status === "jogando") {
      clearInterval(esperaInterval);
      overlay.classList.add("hidden");
      if (btn) btn.disabled = false;
      iniciarArena();
      return;
    }
    if (tempoGlobal <= 1) {
      clearInterval(esperaInterval);
      setTimeout(() => {
        overlay.classList.add("hidden");
        if (btn) btn.disabled = false;
        iniciarArena();
      }, 1000);
    }
  }, 500);
}

// =============================
// 💸 MODAL SALDO
// =============================
function mostrarModalSaldoInsuficiente(valorNecessario) {
  const modal = document.createElement("div");
  modal.id = "modalSaldoInsuficiente";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">💰</div>
      <h2>Saldo insuficiente</h2>
      <p>Você precisa de <strong>R$ ${Number(valorNecessario).toFixed(2)}</strong> para entrar.</p>
      <p style="color:#6b7280; font-size:13px;">Saldo real: R$ ${saldo.toFixed(2)} | Bônus: R$ ${bonus.toFixed(2)}</p>
      <button class="btn-primary" onclick="fecharModalSaldo(); abrirWallet(); depositar();">💳 Depositar</button>
      <button class="btn-secondary" style="margin-top:8px" onclick="fecharModalSaldo()">Fechar</button>
    </div>
  `;
  document.body.appendChild(modal);
}

function fecharModalSaldo() {
  const modal = document.getElementById("modalSaldoInsuficiente");
  if (modal) modal.remove();
}

// =============================
// ⚔️ ARENA
// =============================
function iniciarArena() {
  cliques = 0; tempo = 30; posicaoAnterior = null;
  botsArena.forEach(bot => { bot.score = 0; });
  atualizarRankingArena();
  clearInterval(timerInterval);
  clearInterval(botInterval);

  timerInterval = setInterval(() => {
    tempo--;
    const el = document.getElementById("arenaTimer");
    if (el) el.innerText = tempo + "s";
    if (tempo <= 0) {
      clearInterval(timerInterval);
      clearInterval(botInterval);
      mostrarResultado();
      iniciarSomAmbiente();
      setTimeout(() => { document.getElementById("arena").classList.add("hidden"); }, 2000);
    }
  }, 1000);

  // ✅ bots continuam clicando até o fim (tempo 30s completo)
  botInterval = setInterval(() => {
    botsArena.forEach(bot => {
      // distribuem os cliques linearmente até o alvo em 30s
      const incremento = bot.alvo / 60; // 2 updates por segundo = 60 updates em 30s
      bot.score = Math.min(bot.score + incremento + (Math.random() * 2 - 1), bot.alvo);
      if (bot.score < 0) bot.score = 0;
    });
    atualizarRankingArena();
  }, 500);
}

function atualizarRankingArena() {
  const nomeJogador = usuarioLogado ? usuarioLogado.nome : "VOCÊ";
  let jogadores = [
    { nome: nomeJogador, score: cliques, foto: usuarioLogado ? usuarioLogado.foto_url : null },
    ...botsArena.map(b => ({ nome: b.nome, score: b.score, foto: b.foto }))
  ];

  jogadores.sort((a, b) => b.score - a.score);
  const max = jogadores[0].score || 1;
  const div = document.getElementById("arenaRanking");
  if (!div) return;
  div.innerHTML = "";

  const posicaoAtual = jogadores.findIndex(j => j.nome === nomeJogador) + 1;
  if (posicaoAnterior !== null && posicaoAtual < posicaoAnterior) somUltrapassar();
  posicaoAnterior = posicaoAtual;

  jogadores.slice(0, 4).forEach((j, i) => {
    const eVoce = j.nome === nomeJogador;
    const fotoEl = j.foto
      ? `<img src="${j.foto}" class="rank-foto" style="width:22px;height:22px;margin-right:5px;" />`
      : `<div class="rank-avatar" style="width:22px;height:22px;font-size:9px;margin-right:5px;">${j.nome.charAt(0)}</div>`;
    div.innerHTML += `
      <div class="rank-player ${eVoce ? "voce" : ""}">
        <div style="display:flex; justify-content:space-between; font-size:12px; align-items:center;">
          <div style="display:flex;align-items:center;">${fotoEl}<span>${i+1}º ${j.nome}</span></div>
          <span>${Math.floor(j.score)}</span>
        </div>
        <div class="barra"><div class="progresso" style="width:${(j.score/max)*100}%"></div></div>
      </div>
    `;
  });

  if (posicaoAtual > 4) {
    const eu = jogadores[posicaoAtual - 1];
    const fotoEl = eu.foto
      ? `<img src="${eu.foto}" class="rank-foto" style="width:22px;height:22px;margin-right:5px;" />`
      : `<div class="rank-avatar" style="width:22px;height:22px;font-size:9px;margin-right:5px;">${eu.nome.charAt(0)}</div>`;
    div.innerHTML += `
      <div style="text-align:center; color:#374151; font-size:11px; margin:3px 0;">• • •</div>
      <div class="rank-player voce">
        <div style="display:flex; justify-content:space-between; font-size:12px; align-items:center;">
          <div style="display:flex;align-items:center;">${fotoEl}<span>${posicaoAtual}º ${eu.nome}</span></div>
          <span>${Math.floor(eu.score)}</span>
        </div>
        <div class="barra"><div class="progresso" style="width:${(eu.score/max)*100}%"></div></div>
      </div>
    `;
  }
}

function configurarClickBtn() {
  const btn = document.getElementById("clickBtn");
  if (!btn) return;
  btn.onclick = null;
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    if (!cliqueValido()) return;
    const agora = Date.now();
    fetch(`${window.location.origin}/click`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: perfil.id, timestamp: agora })
    }).catch(() => {});
    ultimoClique = agora;
    somClick(); vibrar();
    cliques += 1;
    const plus = document.createElement("div");
    plus.innerText = "+1"; plus.className = "plus-arena";
    plus.style.left = Math.random() * 40 + 30 + "%";
    plus.style.top = "5%";
    document.getElementById("clickArea").appendChild(plus);
    setTimeout(() => plus.remove(), 800);
    atualizarRankingArena();
  });
}

// =============================
// 🏁 RESULTADO
// =============================
function mostrarResultado() {
  somVitoria();
  const nomeJogador = usuarioLogado ? usuarioLogado.nome : "VOCÊ";
  let jogadores = [{ nome: nomeJogador, score: cliques }, ...botsArena.map(b => ({ nome: b.nome, score: b.score }))];
  jogadores.sort((a, b) => b.score - a.score);

  const posicao = jogadores.findIndex(j => j.nome === nomeJogador) + 1;
  const venceu = posicao === 1;
  const titulo = document.getElementById("resultadoTitulo");
  const texto = document.getElementById("resultadoTexto");
  const ganhoEl = document.getElementById("resultadoGanho");
  titulo.classList.remove("vitoria","derrota");

  if (venceu && salaAtual) {
    const premio = parseFloat(calcularPremio(salaAtual));
    saldo += premio;
    atualizarSaldo();
    fetch(`${window.location.origin}/creditar-vitoria`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, valor: premio })
    }).catch(() => {});
    titulo.innerText = "VOCÊ VENCEU! 🚀🔥";
    titulo.classList.add("vitoria");
    if (ganhoEl) { ganhoEl.innerText = `+R$ ${premio.toFixed(2)}`; ganhoEl.classList.remove("hidden"); }
    soltarConfete();
    animarPremio(premio);
  } else {
    titulo.innerText = `${posicao}º LUGAR`;
    texto.innerText = "Boa tentativa! Tente novamente.";
    titulo.classList.add("derrota");
    if (ganhoEl) ganhoEl.classList.add("hidden");
  }

  if (usuarioLogado) {
    fetch(`${window.location.origin}/registrar-partida`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, venceu, cliques })
    }).catch(() => {});
    perfil.partidas++;
    if (venceu) perfil.vitorias++;
    else perfil.derrotas++;
    localStorage.setItem("perfil", JSON.stringify(perfil));
  }

  document.getElementById("resultado").classList.remove("hidden");
}

function animarPremio(valor) {
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const moeda = document.createElement("div");
      moeda.innerText = "💰";
      moeda.style.cssText = `position:fixed; font-size:28px; left:${Math.random()*80+10}%; bottom:20%; animation:subirMoeda 1.2s ease forwards; z-index:10000; pointer-events:none;`;
      document.body.appendChild(moeda);
      setTimeout(() => moeda.remove(), 1200);
    }, i * 150);
  }
  const ganho = document.createElement("div");
  ganho.innerText = `+R$ ${valor.toFixed(2)}`;
  ganho.style.cssText = `position:fixed; left:50%; top:40%; transform:translateX(-50%); color:#22c55e; font-size:36px; font-weight:bold; text-shadow:0 0 20px #22c55e; animation:subirGanho 2s ease forwards; z-index:10000; pointer-events:none;`;
  document.body.appendChild(ganho);
  setTimeout(() => ganho.remove(), 2000);
}

function fecharResultado() {
  document.getElementById("resultado").classList.add("hidden");
  const ganhoEl = document.getElementById("resultadoGanho");
  if (ganhoEl) ganhoEl.classList.add("hidden");
}

function soltarConfete() {
  const canvas = document.getElementById("confete");
  const ctx = canvas.getContext("2d");
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  let particulas = [];
  for (let i = 0; i < 150; i++) particulas.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, r: Math.random()*6+2, d: Math.random()*5+2, color: `hsl(${Math.random()*360},100%,50%)` });
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particulas.forEach(p => { ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=p.color; ctx.fill(); });
    particulas.forEach(p => { p.y+=p.d; if(p.y>canvas.height){p.y=0;p.x=Math.random()*canvas.width;} });
  }
  let intervalo = setInterval(draw, 20);
  setTimeout(() => { clearInterval(intervalo); ctx.clearRect(0,0,canvas.width,canvas.height); }, 3000);
}

// =============================
// ⏱️ TIMER GLOBAL
// =============================
function iniciarTimer() {
  setInterval(() => {
    tempoGlobal--;
    if (tempoGlobal <= 0) { iniciarRodada(); tempoGlobal = 30; }
    const el = document.getElementById("timer");
    if (el) el.innerText = "00:" + tempoGlobal.toString().padStart(2,"0");
    renderSalas();
  }, 1000);
}

function iniciarRodada() {
  if (grupoAtual === "A") { iniciarSalas(grupoA); grupoAtual = "B"; }
  else { iniciarSalas(grupoB); grupoAtual = "A"; }
}

function iniciarSalas(grupo) {
  grupo.forEach(index => {
    const sala = salas[index];
    if (sala.emJogo) return;
    sala.status = "jogando"; sala.emJogo = true; sala.tempo = 30;
    let intervalo = setInterval(() => {
      sala.tempo--;
      if (sala.tempo <= 0) {
        clearInterval(intervalo);
        sala.status = "aguardando"; sala.emJogo = false; sala.tempo = 30;
        gerarBotsParaSala(sala); renderSalas();
      }
    }, 1000);
  });
}

// =============================
// 💰 WALLET com modo saldo/bonus
// =============================
function abrirWallet() {
  document.getElementById("wallet").classList.remove("hidden");
  atualizarWallet();
}

function atualizarWallet() {
  document.getElementById("walletSaldo").innerText = "R$ " + saldo.toFixed(2);
  const bonusEl = document.getElementById("walletBonus");
  if (bonusEl) bonusEl.innerText = bonus > 0 ? `🎁 Bônus disponível: R$ ${bonus.toFixed(2)}` : "";

  // atualiza botões de modo
  const btnReal = document.getElementById("btnModoReal");
  const btnBonus = document.getElementById("btnModoBonus");
  if (btnReal && btnBonus) {
    btnReal.className = modoSaldo === "real" ? "btn-modo ativo" : "btn-modo";
    btnBonus.className = modoSaldo === "bonus" ? "btn-modo ativo" : "btn-modo";
    btnBonus.style.display = bonus > 0 ? "flex" : "none";
  }
}

function selecionarModo(modo) {
  modoSaldo = modo;
  atualizarWallet();
}

function fecharWallet() { document.getElementById("wallet").classList.add("hidden"); }
function depositar() { document.getElementById("modalDeposito").classList.remove("hidden"); }
function fecharDeposito() {
  document.getElementById("modalDeposito").classList.add("hidden");
  document.getElementById("pixContainer").innerHTML = "";
}
function sacar() { document.getElementById("modalSaque").classList.remove("hidden"); }
function fecharSaque() {
  document.getElementById("modalSaque").classList.add("hidden");
  document.getElementById("saqueMsg").classList.add("hidden");
}

async function confirmarSaque() {
  const valor = Number(document.getElementById("inputSaqueValor").value);
  const chave = document.getElementById("inputSaqueChave").value.trim();
  const msgEl = document.getElementById("saqueMsg");
  msgEl.classList.add("hidden");

  if (!valor || valor <= 0) { msgEl.innerText = "Digite um valor válido"; msgEl.className = "saque-erro"; msgEl.classList.remove("hidden"); return; }
  if (!chave) { msgEl.innerText = "Digite sua chave PIX"; msgEl.className = "saque-erro"; msgEl.classList.remove("hidden"); return; }
  if (valor > saldo) { msgEl.innerText = "Saldo real insuficiente. O bônus não pode ser sacado."; msgEl.className = "saque-erro"; msgEl.classList.remove("hidden"); return; }

  try {
    const res = await fetch(`${window.location.origin}/sacar`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor, userId: usuarioLogado.id, chave_pix: chave })
    });
    const data = await res.json();
    if (!res.ok) { msgEl.innerText = data.erro || "Erro"; msgEl.className = "saque-erro"; msgEl.classList.remove("hidden"); return; }
    saldo -= valor;
    atualizarSaldo();
    msgEl.innerText = data.mensagem;
    msgEl.className = "saque-sucesso";
    msgEl.classList.remove("hidden");
    document.getElementById("inputSaqueValor").value = "";
    document.getElementById("inputSaqueChave").value = "";
  } catch (err) {
    msgEl.innerText = "Erro ao conectar";
    msgEl.className = "saque-erro";
    msgEl.classList.remove("hidden");
  }
}

async function confirmarDeposito() {
  const valor = document.getElementById("inputValor").value;
  const container = document.getElementById("pixContainer");
  if (!valor || valor <= 0) { container.innerHTML = "<p style='color:red'>Digite um valor válido</p>"; return; }
  container.innerHTML = "<p>⏳ Gerando PIX...</p>";
  try {
    const res = await fetch(`${window.location.origin}/criar-pagamento`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: Number(valor), userId: usuarioLogado.id })
    });
    if (!res.ok) { container.innerHTML = `<p style="color:red">Erro ao gerar PIX</p>`; return; }
    const data = await res.json();
    container.innerHTML = `
      <img src="data:image/png;base64,${data.qr_base64}" style="width:200px; margin-top:10px; border-radius:10px;">
      <button onclick="copiarPix('${data.qr_code}')" class="btn-copiar">📋 Copiar PIX</button>
      <div id="feedbackPix" class="hidden"></div>
      <div id="pixStatus" style="margin-top:10px; color:#9ca3af; font-size:13px;">⏳ Aguardando pagamento...</div>
    `;
    const verificar = setInterval(async () => {
      try {
        const r = await fetch(`${window.location.origin}/saldo/${usuarioLogado.id}`);
        const d = await r.json();
        if (d.saldo > saldo) {
          clearInterval(verificar);
          const diff = d.saldo - saldo;
          saldo = d.saldo; bonus = d.bonus || bonus;
          atualizarSaldo();
          container.innerHTML = `<div class="pix-sucesso">✅ Depósito de R$ ${diff.toFixed(2)} realizado!<br><span style="font-size:13px; color:#86efac;">Saldo atualizado</span></div>`;
          setTimeout(() => fecharDeposito(), 3000);
        }
      } catch(e) {}
    }, 4000);
    setTimeout(() => clearInterval(verificar), 600000);
  } catch (err) {
    container.innerHTML = "<p style='color:red'>Erro ao conectar</p>";
  }
}

function copiarPix(codigo) {
  navigator.clipboard.writeText(codigo)
    .then(() => mostrarFeedback("✅ Pix copiado"))
    .catch(() => mostrarFeedback("❌ Erro ao copiar"));
}

function mostrarFeedback(msg) {
  const div = document.getElementById("feedbackPix");
  if (!div) return;
  div.innerText = msg; div.classList.remove("hidden"); div.classList.add("feedback-sucesso");
  setTimeout(() => div.classList.add("hidden"), 2000);
}

async function buscarSaldo() {
  if (!usuarioLogado) return;
  try {
    const res = await fetch(`${window.location.origin}/saldo/${usuarioLogado.id}`);
    if (!res.ok) return;
    const data = await res.json();
    const novoSaldo = data.saldo;
    if (novoSaldo > ultimoSaldo && ultimoSaldo > 0) animarDinheiro(novoSaldo - ultimoSaldo);
    ultimoSaldo = novoSaldo; saldo = novoSaldo; bonus = data.bonus || 0;
    const el = document.getElementById("saldo");
    if (el) el.innerText = "R$ " + novoSaldo.toFixed(2);
  } catch (err) {}
}

function atualizarSaldo() {
  const el1 = document.getElementById("saldo");
  const el2 = document.getElementById("walletSaldo");
  if (el1) el1.innerText = "R$ " + saldo.toFixed(2);
  if (el2) el2.innerText = "R$ " + saldo.toFixed(2);
}

function animarDinheiro(valor) {
  const div = document.createElement("div");
  div.innerText = `+R$ ${valor.toFixed(2)}`;
  div.className = "money"; div.style.left = "50%"; div.style.top = "50%";
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1000);
}

async function verHistorico() {
  if (!usuarioLogado) return;
  const area = document.getElementById("historicoArea");

  // ✅ toggle — se já está aberto, fecha
  if (!area.classList.contains("hidden")) {
    area.classList.add("hidden");
    return;
  }

  const res = await fetch(`${window.location.origin}/historico/${usuarioLogado.id}`);
  const dados = await res.json();

  if (!dados.length) {
    area.innerHTML = "<p style='text-align:center;'>Nenhuma transação ainda</p>";
  } else {
    area.innerHTML = dados.map(item => `
      <div style="background:#111; padding:10px; margin-bottom:8px; border-radius:8px;">
        <strong>${item.tipo}</strong> — R$ ${Number(item.valor).toFixed(2)}<br>
        <small style="color:#6b7280">${new Date(item.data).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</small>
      </div>
    `).join("");
  }
  area.classList.remove("hidden");
}

// =============================
// 🔗 CONVITE
// =============================
async function abrirConvite() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>🔗 Convidar Amigos</h2></div>
      <div class="tela-content" style="text-align:center;">
        <div style="font-size:48px; margin-bottom:15px;">🎁</div>
        <p style="color:#e5e7eb; margin-bottom:5px;">Convide amigos e <strong>você</strong> ganha</p>
        <h2 style="color:#22c55e; margin:5px 0;">R$ 10,00 de bônus</h2>
        <p style="color:#9ca3af; font-size:13px; margin-bottom:25px;">Para cada amigo que se cadastrar pelo seu link você ganha R$10 de bônus para jogar.</p>
        <div id="conviteContainer">
          <button class="btn-primary" onclick="gerarLinkConvite()">Gerar meu link</button>
        </div>
      </div>
    </div>
  `);
}

async function gerarLinkConvite() {
  const container = document.getElementById("conviteContainer");
  container.innerHTML = "<p>⏳ Gerando...</p>";
  try {
    const res = await fetch(`${window.location.origin}/criar-convite`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, nomeUsuario: usuarioLogado.nome })
    });
    const data = await res.json();
    if (!res.ok) { container.innerHTML = "<p style='color:red'>Erro</p>"; return; }
    container.innerHTML = `
      <div style="background:#111827; padding:15px; border-radius:12px; margin-bottom:15px;">
        <p style="color:#9ca3af; font-size:12px; margin-bottom:8px;">Seu link:</p>
        <p style="color:#22c55e; font-size:13px; word-break:break-all;">${data.link}</p>
      </div>
      <button class="btn-primary" onclick="navigator.clipboard.writeText('${data.link}').then(() => alert('Copiado!'))">📋 Copiar link</button>
      <p style="color:#6b7280; font-size:12px; margin-top:15px;">Convites ilimitados!</p>
    `;
  } catch(e) { container.innerHTML = "<p style='color:red'>Erro</p>"; }
}

// =============================
// 🏟️ SALAS DE USUÁRIOS
// =============================
async function abrirSalasUsuarios() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>🏟️ Salas de Jogadores</h2></div>
      <div class="tela-content">
        <button class="btn-primary" style="margin-bottom:20px" onclick="abrirCriarSala()">+ Criar minha sala</button>
        <div id="listaSalasUsuarios"><p style="text-align:center; color:#6b7280;">Carregando...</p></div>
      </div>
    </div>
  `);
  carregarSalasUsuarios();
}

async function carregarSalasUsuarios() {
  const div = document.getElementById("listaSalasUsuarios");
  if (!div) return;
  try {
    const res = await fetch(`${window.location.origin}/salas-usuarios`);
    const salas = await res.json();
    if (!salas.length) { div.innerHTML = "<p style='text-align:center; color:#6b7280;'>Nenhuma sala ativa</p>"; return; }
    div.innerHTML = salas.map(s => {
      const premio = ((s.premio_acumulado || 0) * 0.7).toFixed(2);
      return `
        <div class="sala">
          <div class="sala-left">
            <b>${s.nome}</b>
            <span style="color:#3b82f6; font-size:11px;">👤 Sala de jogador</span>
            <span>${s.jogadores}/${s.max_jogadores}</span>
          </div>
          <div class="sala-right">
            <div class="sala-premio">🏆 R$ ${premio}</div>
            <div class="sala-entrada">Entrada: R$ ${s.valor_entrada}</div>
            <div class="green">Código: ${s.codigo}</div>
          </div>
        </div>
      `;
    }).join("");
  } catch(e) { div.innerHTML = "<p style='color:red'>Erro</p>"; }
}

function abrirCriarSala() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="abrirSalasUsuarios()">←</span><h2>Criar Sala</h2></div>
      <div class="tela-content" style="max-width:400px; margin:auto;">
        <p style="color:#9ca3af; margin-bottom:20px;">Sala ativa por 24h.</p>
        <label style="color:#e5e7eb; font-size:14px;">Valor de entrada (mín. R$ 1)</label>
        <input id="valorCriarSala" type="number" min="1" placeholder="Ex: 5" class="auth-input" style="margin-top:8px; margin-bottom:20px;" />
        <div id="criarSalaMsg" class="hidden"></div>
        <button class="btn-primary" onclick="confirmarCriarSala()">🏟️ Criar sala</button>
        <p style="color:#6b7280; font-size:12px; margin-top:15px; text-align:center;">Vencedor recebe 70% do prêmio total.</p>
      </div>
    </div>
  `);
}

async function confirmarCriarSala() {
  const valor = Number(document.getElementById("valorCriarSala").value);
  const msgEl = document.getElementById("criarSalaMsg");
  msgEl.classList.add("hidden");
  if (!valor || valor < 1) { msgEl.innerText = "Valor mínimo é R$ 1"; msgEl.style.color = "#ef4444"; msgEl.classList.remove("hidden"); return; }
  try {
    const res = await fetch(`${window.location.origin}/criar-sala`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, nomeUsuario: usuarioLogado.nome, valorEntrada: valor })
    });
    const data = await res.json();
    if (!res.ok) { msgEl.innerText = data.erro || "Erro"; msgEl.style.color = "#ef4444"; msgEl.classList.remove("hidden"); return; }
    saldo -= valor; atualizarSaldo();
    msgEl.innerHTML = `✅ Sala criada! Código: <strong>${data.sala.codigo}</strong>`;
    msgEl.style.color = "#22c55e";
    msgEl.classList.remove("hidden");
  } catch(e) { msgEl.innerText = "Erro"; msgEl.style.color = "#ef4444"; msgEl.classList.remove("hidden"); }
}

// =============================
// 👤 PERFIL
// =============================
function salvarPerfil() { localStorage.setItem("perfil", JSON.stringify(perfil)); }
function gerarAvatar(nome) { return nome ? nome.charAt(0).toUpperCase() : "?"; }

function abrirPerfil() {
  const total = perfil.partidas || 0;
  const vitorias = perfil.vitorias || 0;
  const derrotas = perfil.derrotas || 0;
  const aproveitamento = total > 0 ? Math.round((vitorias / total) * 100) : 0;

  const foto = usuarioLogado && usuarioLogado.foto_url
    ? `<img src="${usuarioLogado.foto_url}" class="perfil-foto-img" onclick="trocarFotoPerfil()" />`
    : `<div class="perfil-avatar" onclick="trocarFotoPerfil()">${gerarAvatar(perfil.nome)}</div>`;

  abrirTela(`
    <div class="tela-box perfil-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>Perfil</h2></div>
      <div class="perfil-header">
        ${foto}
        <p style="font-size:12px; color:#6b7280; margin-top:5px;">Toque para alterar foto</p>
        <input id="inputFotoPerfil" type="file" accept="image/*" class="hidden" onchange="atualizarFotoPerfil(event)" />
        <input id="nomePerfil" value="${perfil.nome}" class="input-nome" />
      </div>
      <div class="perfil-saldo">
        <span>Saldo real</span><h1>R$ ${saldo.toFixed(2)}</h1>
        ${bonus > 0 ? `<p style="color:#f59e0b; font-size:13px; margin:5px 0 0;">🎁 Bônus: R$ ${bonus.toFixed(2)}</p>` : ""}
      </div>
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
    </div>
  `);
}

function trocarFotoPerfil() { document.getElementById("inputFotoPerfil").click(); }

async function atualizarFotoPerfil(event) {
  const file = event.target.files[0];
  if (!file || !usuarioLogado) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const res = await fetch(`${window.location.origin}/atualizar-foto`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: usuarioLogado.id, foto_base64: e.target.result })
      });
      const data = await res.json();
      if (data.ok) {
        usuarioLogado.foto_url = data.foto_url;
        localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
        abrirPerfil();
      }
    } catch(e) {}
  };
  reader.readAsDataURL(file);
}

function salvarNome() {
  const input = document.getElementById("nomePerfil");
  if (input) {
    perfil.nome = input.value;
    if (usuarioLogado) usuarioLogado.nome = input.value;
    salvarPerfil();
    localStorage.setItem("usuario", JSON.stringify(usuarioLogado));
    fecharTela();
  }
}

// =============================
// 🗂️ MENU
// =============================
function abrirMenu() { document.getElementById("menuLateral").classList.remove("hidden"); }
function fecharMenu() { document.getElementById("menuLateral").classList.add("hidden"); }

function abrirTela(conteudoHTML) {
  const tela = document.getElementById("telaMenu");
  tela.innerHTML = conteudoHTML;
  tela.classList.remove("hidden");
  // impede scroll da página de fundo
  document.body.style.overflow = "hidden";
}

function fecharTela() {
  document.getElementById("telaMenu").classList.add("hidden");
  document.body.style.overflow = "";
}

function abrirReclamacoes() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>🚨 Reclamações</h2></div>
      <div class="tela-content">
        <p style="color:#9ca3af; margin-bottom:15px;">Sua reclamação será enviada para nossa equipe.</p>
        <textarea id="textoReclamacao" placeholder="Descreva sua reclamação aqui..."></textarea>
        <div id="reclamacaoMsg" class="hidden"></div>
        <button class="btn-primary" onclick="enviarReclamacao()">Enviar reclamação</button>
      </div>
    </div>
  `);
}

async function enviarReclamacao() {
  const texto = document.getElementById("textoReclamacao").value.trim();
  const msgEl = document.getElementById("reclamacaoMsg");
  msgEl.classList.add("hidden");

  if (!texto) { msgEl.innerText = "Escreva sua reclamação antes de enviar"; msgEl.style.color = "#ef4444"; msgEl.classList.remove("hidden"); return; }

  try {
    const res = await fetch(`${window.location.origin}/reclamacao`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado?.id, nomeUsuario: usuarioLogado?.nome || "Anônimo", emailUsuario: usuarioLogado?.email || "sem email", mensagem: texto })
    });
    if (res.ok) {
      msgEl.innerText = "✅ Reclamação enviada com sucesso!";
      msgEl.style.color = "#22c55e";
      msgEl.classList.remove("hidden");
      document.getElementById("textoReclamacao").value = "";
    } else {
      msgEl.innerText = "Erro ao enviar. Tente novamente.";
      msgEl.style.color = "#ef4444";
      msgEl.classList.remove("hidden");
    }
  } catch(e) {
    msgEl.innerText = "Erro de conexão";
    msgEl.style.color = "#ef4444";
    msgEl.classList.remove("hidden");
  }
}

function abrirConfiguracoes() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>Configurações</h2></div>
      <div class="tela-content">
        <div class="config-item"><span>Som</span><input type="checkbox" ${somAtivo ? "checked" : ""} onchange="toggleSom()"></div>
        <div class="config-item"><span>Vibração</span><input type="checkbox" checked></div>
      </div>
    </div>
  `);
}

function abrirDiretrizes() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header"><span class="btn-voltar" onclick="fecharTela()">←</span><h2>Diretrizes</h2></div>
      <div class="tela-content"><p>DIRETRIZES OFICIAIS — CLICK ARENA

1. SOBRE O CLICK ARENA

O Click Arena é uma plataforma de competição online baseada em habilidade, velocidade e desempenho em tempo real.

Os jogadores participam de partidas rápidas onde o objetivo é simples:

clicar mais rápido;

superar os outros participantes;

alcançar a maior pontuação dentro do tempo da partida.


O vencedor da partida é definido exclusivamente pelo desempenho obtido durante o tempo da competição.

O Click Arena NÃO é uma plataforma de apostas.

No Click Arena:

não existe sorteio;

não existe cassino;

não existe roleta;

não existe jogo de azar;

não existe multiplicador aleatório;

não existe resultado manipulado;

o resultado depende exclusivamente da habilidade, velocidade e desempenho do jogador.



---

2. COMO FUNCIONAM AS PARTIDAS

Estrutura das partidas

As partidas acontecem em tempo real e possuem duração definida.

Atualmente:

cada partida possui duração de 30 segundos;

os jogadores competem simultaneamente;

vence quem realizar a maior quantidade de cliques válidos.



---

Entrada nas partidas

Para participar:

1. o jogador entra na plataforma;


2. acessa a sala disponível;


3. aguarda o início da partida;


4. participa da competição;


5. o sistema contabiliza automaticamente os cliques válidos.




---

Resultado da partida

Ao final da partida:

o sistema calcula automaticamente o total de cliques válidos;

o ranking da partida é definido;

o vencedor recebe o prêmio correspondente;

os demais jogadores podem visualizar o resultado final.



---

3. CLIQUES VÁLIDOS

Para manter a integridade da competição:

apenas cliques humanos são considerados válidos;

o sistema possui mecanismos automáticos de detecção de padrões suspeitos;

cliques automatizados podem ser desconsiderados;

contas suspeitas podem sofrer análise manual.


O sistema poderá:

invalidar partidas;

remover pontuações;

suspender usuários;

bloquear contas;

cancelar recompensas;

limitar acesso temporariamente.



---

4. SISTEMA ANTIBOT E ANTIFRAUDE

O Click Arena possui mecanismos de proteção contra:

bots;

scripts automáticos;

autoclick;

automações;

manipulação de partidas;

exploração de falhas;

uso indevido da plataforma.


O sistema pode identificar:

padrões robóticos;

velocidade irreal de cliques;

comportamento repetitivo;

manipulação automatizada;

atividades suspeitas.



---

Proibições

É proibido:

utilizar autoclick;

utilizar scripts;

utilizar programas automatizados;

utilizar extensões manipuladoras;

modificar o funcionamento da plataforma;

explorar bugs;

manipular resultados;

tentar prejudicar outros jogadores.



---

Consequências

Usuários que violarem as regras poderão sofrer:

advertência;

suspensão temporária;

bloqueio permanente;

perda de saldo;

cancelamento de recompensas;

remoção do ranking;

encerramento definitivo da conta.



---

5. TAXA ADMINISTRATIVA DA PLATAFORMA

O Click Arena realiza a cobrança de uma taxa administrativa sobre cada partida.

Essa taxa é utilizada para:

manutenção da plataforma;

servidores;

processamento de pagamentos;

desenvolvimento;

segurança;

sistemas antifraude;

suporte;

melhorias contínuas.



---

Como funciona a taxa

Parte do valor arrecadado em cada partida é destinada:

ao prêmio da competição;

à administração e operação da plataforma.


O percentual administrativo poderá variar conforme:

tipo da sala;

evento;

promoção;

modalidade;

campanhas específicas.


Todas as informações relevantes serão apresentadas antes da participação do jogador.


---

6. DEPÓSITOS

Os depósitos realizados na plataforma possuem o objetivo de permitir participação nas competições disponíveis.


---

Regras dos depósitos

os depósitos devem ser realizados exclusivamente pelos meios oficiais da plataforma;

o saldo poderá levar alguns instantes para ser atualizado;

pagamentos suspeitos poderão passar por análise;

depósitos fraudulentos serão bloqueados.



---

PIX

Os pagamentos via PIX podem:

depender da instituição financeira do usuário;

sofrer instabilidade externa;

passar por confirmação bancária.


O Click Arena não possui controle sobre instabilidades de bancos ou instituições financeiras.


---

7. SAQUES

O jogador poderá solicitar saque do saldo disponível conforme as regras vigentes da plataforma.


---

Regras de saque

o saque poderá passar por análise de segurança;

atividades suspeitas podem gerar retenção temporária;

contas em análise poderão ter saques pausados;

o prazo pode variar conforme demanda operacional.



---

Verificação de segurança

A plataforma poderá solicitar:

confirmação de identidade;

validação de informações;

verificação de atividade.


Essas medidas existem para:

evitar fraudes;

proteger jogadores;

impedir lavagem de dinheiro;

garantir segurança operacional.



---

8. CONDUTA DOS JOGADORES

Todos os usuários devem manter comportamento respeitoso.


---

É proibido

discurso de ódio;

ameaças;

racismo;

preconceito;

assédio;

conteúdo ofensivo;

spam;

tentativa de golpe;

divulgação indevida;

comportamento abusivo.



---

Respeito à comunidade

O Click Arena busca construir:

um ambiente competitivo;

uma comunidade saudável;

respeito entre jogadores;

competição justa.



---

9. RANKINGS

Os rankings possuem objetivo competitivo e informativo.

Eles podem considerar:

vitórias;

quantidade de cliques;

desempenho;

consistência;

eventos especiais.


A plataforma poderá:

redefinir rankings;

atualizar pontuações;

remover usuários fraudulentos;

criar temporadas;

realizar eventos especiais.



---

10. DISPONIBILIDADE DA PLATAFORMA

O Click Arena trabalha continuamente para manter estabilidade.

Mesmo assim, podem ocorrer:

manutenção;

instabilidade;

atualização;

interrupção temporária;

falhas externas;

problemas de conexão.


A plataforma não garante funcionamento ininterrupto 24 horas por dia.


---

11. RESPONSABILIDADE DO USUÁRIO

O jogador é responsável por:

manter seus dados seguros;

proteger sua conta;

não compartilhar acessos;

utilizar dispositivos confiáveis;

respeitar as regras da plataforma.



---

12. SEGURANÇA DA CONTA

Recomendações importantes:

utilize senha forte;

não compartilhe dados;

não utilize aplicativos suspeitos;

não informe códigos a terceiros.


O Click Arena nunca solicitará senha completa do usuário fora dos canais oficiais.


---

13. ALTERAÇÕES NAS DIRETRIZES

O Click Arena poderá atualizar:

funcionalidades;

políticas;

regras;

diretrizes;

sistemas;

taxas;

modalidades.


As alterações poderão ocorrer visando:

segurança;

evolução da plataforma;

melhorias operacionais;

experiência dos jogadores.



---

14. USO JUSTO DA PLATAFORMA

Todos os jogadores devem competir de maneira honesta.

O objetivo do Click Arena é proporcionar:

diversão;

competição saudável;

experiência justa;

desafios rápidos;

ambiente competitivo.



---

15. SOBRE A NATUREZA DA PLATAFORMA

O Click Arena é uma plataforma baseada em:

habilidade;

velocidade;

reação;

desempenho competitivo.


O resultado das partidas depende da atuação individual de cada participante.


---

16. ACEITAÇÃO DOS TERMOS

Ao utilizar o Click Arena, o usuário declara estar ciente e de acordo com:

as diretrizes da plataforma;

as regras de competição;

os sistemas de segurança;

os critérios operacionais;

as políticas da comunidade.



---

17. SUPORTE

Em caso de dúvidas, problemas ou necessidade de suporte:

utilize os canais oficiais da plataforma;

descreva claramente a situação;

informe detalhes relevantes;

aguarde análise da equipe.



---

18. OBJETIVO DO CLICK ARENA

O objetivo do Click Arena é criar:

uma experiência competitiva acessível;

partidas rápidas;

desafios baseados em habilidade;

uma comunidade ativa;

uma plataforma moderna de competição em tempo real.

---

CLICK ARENA

Competição. Velocidade. Comunidade.

O mais rápido vence.</p></div>
    </div>
  `);
}