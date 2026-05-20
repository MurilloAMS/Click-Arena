// =============================
// 🔐 AUTENTICAÇÃO
// =============================

let usuarioLogado = null;
let fotoBase64 = null;

window.addEventListener("DOMContentLoaded", () => {
  const sessao = localStorage.getItem("usuario");
  if (sessao) {
    usuarioLogado = JSON.parse(sessao);
    iniciarJogo();
  }
});

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

  if (!nome || !email || !senha) {
    erroEl.innerText = "Preencha todos os campos";
    erroEl.classList.remove("hidden");
    return;
  }
  if (senha.length < 6) {
    erroEl.innerText = "A senha precisa ter pelo menos 6 caracteres";
    erroEl.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${window.location.origin}/cadastro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, senha, foto_base64: fotoBase64 })
    });
    const data = await res.json();
    if (!res.ok) {
      erroEl.innerText = data.erro || "Erro ao criar conta";
      erroEl.classList.remove("hidden");
      return;
    }
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

  if (!email || !senha) {
    erroEl.innerText = "Preencha e-mail e senha";
    erroEl.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${window.location.origin}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, senha })
    });
    const data = await res.json();
    if (!res.ok) {
      erroEl.innerText = data.erro || "Erro ao entrar";
      erroEl.classList.remove("hidden");
      return;
    }
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
  saldo = usuarioLogado.saldo || 0;

  atualizarSaldo();
  iniciarBotsSalas();
  renderSalas();
  iniciarTimer();
  buscarSaldo();
  buscarRankingDiario();

  setInterval(buscarSaldo, 5000);
  setInterval(buscarRankingDiario, 10000);

  configurarClickBtn();
  configurarClickBtnTreino();
}

// =============================
// 🎮 VARIÁVEIS DO JOGO
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

let ambientOsc = null;
let ambientGain = null;
let ultimoSaldo = 0;
let audioCtx = null;
let somAtivo = true;

let perfil = JSON.parse(localStorage.getItem("perfil")) || {
  nome: "Jogador",
  id: "user1",
  partidas: 0,
  vitorias: 0
};

let combo = 0;
let saldo = 0;
let tempoGlobal = 30;
let cliques = 0;
let tempo = 30;
let salaAtual = null;

// =============================
// 🤖 BOTS DAS SALAS (nomes reais)
// =============================

const nomesBot = [
  "Carlos Mendes", "Ana Lima", "Pedro Costa", "Julia Rocha",
  "Rafael Souza", "Fernanda Dias", "Lucas Oliveira", "Beatriz Nunes",
  "Thiago Alves", "Camila Ferreira", "Bruno Santos", "Larissa Gomes",
  "Diego Martins", "Leticia Carvalho", "Mateus Ribeiro", "Vanessa Pereira",
  "Felipe Araujo", "Isabela Castro", "Gustavo Lima", "Patricia Moura"
];

// URLs de fotos reais de pessoas (via UI Faces / randomuser)
const fotosBot = [
  "https://randomuser.me/api/portraits/men/32.jpg",
  "https://randomuser.me/api/portraits/women/44.jpg",
  "https://randomuser.me/api/portraits/men/15.jpg",
  "https://randomuser.me/api/portraits/women/28.jpg",
  "https://randomuser.me/api/portraits/men/67.jpg",
  "https://randomuser.me/api/portraits/women/55.jpg",
  "https://randomuser.me/api/portraits/men/41.jpg",
  "https://randomuser.me/api/portraits/women/19.jpg",
  "https://randomuser.me/api/portraits/men/88.jpg",
  "https://randomuser.me/api/portraits/women/72.jpg",
  "https://randomuser.me/api/portraits/men/23.jpg",
  "https://randomuser.me/api/portraits/women/36.jpg",
  "https://randomuser.me/api/portraits/men/51.jpg",
  "https://randomuser.me/api/portraits/women/61.jpg",
  "https://randomuser.me/api/portraits/men/77.jpg",
  "https://randomuser.me/api/portraits/women/83.jpg",
  "https://randomuser.me/api/portraits/men/5.jpg",
  "https://randomuser.me/api/portraits/women/9.jpg",
  "https://randomuser.me/api/portraits/men/99.jpg",
  "https://randomuser.me/api/portraits/women/47.jpg",
];

const salas = [
  { nome: "Bronze", jogadores: 0, max: 40, valor: 2, tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Prata",  jogadores: 0, max: 40, valor: 5, tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Ouro",   jogadores: 0, max: 40, valor: 10, tempo: 30, status: "aguardando", emJogo: false, bots: [] },
  { nome: "Diamante", jogadores: 0, max: 40, valor: 20, tempo: 30, status: "aguardando", emJogo: false, bots: [] },
];

const grupoA = [0, 1];
const grupoB = [2, 3];
let grupoAtual = "A";

// bots da arena de combate
let botsArena = [];

function gerarBotsParaSala(sala) {
  const qtd = Math.floor(Math.random() * 11) + 7; // 7 a 17
  const indices = [];
  while (indices.length < qtd) {
    const i = Math.floor(Math.random() * nomesBot.length);
    if (!indices.includes(i)) indices.push(i);
  }
  sala.bots = indices.map(i => ({
    nome: nomesBot[i],
    foto: fotosBot[i],
    score: 0
  }));
  sala.jogadores = sala.bots.length;
}

function iniciarBotsSalas() {
  salas.forEach(sala => gerarBotsParaSala(sala));
  // simula entrada gradual de bots
  salas.forEach(sala => {
    const totalBots = sala.bots.length;
    sala.jogadores = Math.floor(totalBots * 0.4); // começa com 40%
    let adicionados = sala.jogadores;

    const entrar = setInterval(() => {
      if (adicionados >= totalBots || sala.emJogo) {
        clearInterval(entrar);
        return;
      }
      adicionados++;
      sala.jogadores = adicionados;
      renderSalas();
    }, Math.random() * 3000 + 1000);
  });
}

// =============================
// 🔊 ÁUDIO
// =============================

document.addEventListener("click", () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
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
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.frequency.value = 600;
  osc.type = "square";
  gain.gain.value = 0.004;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.05);
}

function somUltrapassar() {
  if (!somAtivo || !audioCtx) return;
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(400, audioCtx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, audioCtx.currentTime + 0.2);
  gain.gain.value = 0.04;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.2);
}

function somVitoria() {
  if (!somAtivo || !audioCtx) return;
  let osc = audioCtx.createOscillator();
  let gain = audioCtx.createGain();
  osc.frequency.setValueAtTime(500, audioCtx.currentTime);
  osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
  gain.gain.value = 0.03;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.5);
}

// =============================
// 🛡️ ANTI-BOT — 1 clique por vez
// =============================

setInterval(() => {
  if (cliquesSegundo > 15) console.log("🚨 Cliques muito rápidos");
  cliquesSegundo = 0;
}, 1000);

function cliqueValido() {
  const agora = Date.now();
  if (agora - ultimoCliqueValido < 80) return false;
  ultimoCliqueValido = agora;
  cliquesSegundo++;
  historicoCliques.push(agora);
  if (historicoCliques.length > 10) historicoCliques.shift();
  if (historicoCliques.length === 10) {
    let intervalos = [];
    for (let i = 1; i < historicoCliques.length; i++) {
      intervalos.push(historicoCliques[i] - historicoCliques[i - 1]);
    }
    const todosIguais = intervalos.every(v => Math.abs(v - intervalos[0]) < 5);
    if (todosIguais) { console.log("🚨 Bot detectado"); return false; }
  }
  return true;
}

// =============================
// 💬 CHAT GLOBAL
// =============================

let chatAberto = false;
let chatInterval = null;

function abrirChat() {
  document.getElementById("chatGlobal").classList.remove("hidden");
  chatAberto = true;
  carregarMensagens();
  chatInterval = setInterval(carregarMensagens, 3000);
}

function fecharChat() {
  document.getElementById("chatGlobal").classList.add("hidden");
  chatAberto = false;
  clearInterval(chatInterval);
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
      const foto = m.foto_url
        ? `<img src="${m.foto_url}" class="chat-foto" />`
        : `<div class="chat-avatar">${m.nome.charAt(0).toUpperCase()}</div>`;
      container.innerHTML += `
        <div class="chat-msg ${souEu ? "chat-msg-eu" : ""}">
          ${!souEu ? foto : ""}
          <div class="chat-bubble ${souEu ? "bubble-eu" : "bubble-outro"}">
            ${!souEu ? `<div class="chat-nome">${m.nome}</div>` : ""}
            <div>${m.mensagem}</div>
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: usuarioLogado.id,
        nome: usuarioLogado.nome,
        foto_url: usuarioLogado.foto_url,
        mensagem: msg
      })
    });
    carregarMensagens();
  } catch(e) {}
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && chatAberto) enviarMensagem();
});

// =============================
// 🏋️ TREINO
// =============================

function abrirTreino() {
  treinoCliquesCount = 0;
  treinoTempo = 30;
  document.getElementById("arenaTreino").classList.remove("hidden");
  document.getElementById("treinoCliques").innerText = "0";
  document.getElementById("treino-barra").style.width = "0%";
  iniciarTreino();
}

function fecharTreino() {
  clearInterval(treinoInterval);
  document.getElementById("arenaTreino").classList.add("hidden");
}

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
      const titulo = document.getElementById("resultadoTitulo");
      const texto = document.getElementById("resultadoTexto");
      titulo.classList.remove("vitoria", "derrota");
      titulo.classList.add("vitoria");
      titulo.innerText = "🏋️ TREINO CONCLUÍDO";
      texto.innerText = `Você fez ${treinoCliquesCount} cliques! Continue treinando.`;
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
    somClick();
    const el = document.getElementById("treinoCliques");
    if (el) el.innerText = treinoCliquesCount;
    const barra = document.getElementById("treino-barra");
    if (barra) barra.style.width = Math.min((treinoCliquesCount / 200) * 100, 100) + "%";
    const plus = document.createElement("div");
    plus.innerText = "+1";
    plus.className = "plus";
    plus.style.left = "50%";
    plus.style.top = "50%";
    document.getElementById("clickAreaTreino").appendChild(plus);
    setTimeout(() => plus.remove(), 800);
  });
}

// =============================
// 🏆 RANKING DIÁRIO
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

  if (!rankingDiario.length) {
    div.innerHTML += `<p style="text-align:center; color:#6b7280; padding:20px;">Nenhuma partida hoje ainda</p>`;
    return;
  }

  const top3 = rankingDiario.slice(0, 3);
  const icones = ["🥇", "🥈", "🥉"];
  const classes = ["gold", "silver", "bronze"];

  top3.forEach((j, i) => {
    const foto = j.foto_url
      ? `<img src="${j.foto_url}" class="rank-foto" />`
      : `<div class="rank-avatar">${j.nome.charAt(0).toUpperCase()}</div>`;
    div.innerHTML += `
      <div class="rank-card ${classes[i]}">
        <div class="rank-left">
          <div class="rank-icon">${icones[i]}</div>
          ${foto}
          <div>
            <div class="rank-name">${j.nome}</div>
            <div class="rank-info">${j.vitorias} vitórias • ${j.cliques} cliques</div>
          </div>
        </div>
        <div class="rank-money">R$ ${j.ganho}</div>
      </div>
    `;
  });

  if (usuarioLogado) {
    const minhaPosicao = rankingDiario.findIndex(j => j.user_id === usuarioLogado.id);
    if (minhaPosicao >= 3) {
      const eu = rankingDiario[minhaPosicao];
      const foto = eu.foto_url
        ? `<img src="${eu.foto_url}" class="rank-foto" />`
        : `<div class="rank-avatar">${eu.nome.charAt(0).toUpperCase()}</div>`;
      div.innerHTML += `
        <div class="rank-separador">• • •</div>
        <div class="rank-card voce-rank">
          <div class="rank-left">
            <div class="rank-icon">${minhaPosicao + 1}º</div>
            ${foto}
            <div>
              <div class="rank-name">${eu.nome} (você)</div>
              <div class="rank-info">${eu.vitorias} vitórias • ${eu.cliques} cliques</div>
            </div>
          </div>
          <div class="rank-money">R$ ${eu.ganho}</div>
        </div>
      `;
    }
  }
}

// =============================
// 🚪 SALAS com taxa de 30%
// =============================

function calcularPremio(sala) {
  const total = sala.jogadores * sala.valor;
  return (total * 0.7).toFixed(2); // 70% para o vencedor
}

function renderSalas() {
  const div = document.getElementById("salas");
  if (!div) return;
  div.innerHTML = "";

  salas.forEach(sala => {
    const premio = calcularPremio(sala);
    div.innerHTML += `
      <div class="sala" onclick="entrarSala('${sala.nome}')">
        <div class="sala-left">
          <b>${sala.nome}</b>
          <span>${sala.jogadores}/${sala.max} jogadores</span>
        </div>
        <div class="sala-right">
          <div class="sala-premio">🏆 R$ ${premio}</div>
          <div class="sala-entrada">Entrada: R$ ${sala.valor}</div>
          <div class="${sala.status === 'jogando' ? 'red' : 'green'}">
            ${sala.status === 'jogando'
              ? '🔥 Em jogo (' + sala.tempo + 's)'
              : '⏳ Começa em ' + tempoGlobal.toString().padStart(2, '0') + 's'}
          </div>
        </div>
      </div>
    `;
  });
}

function entrarSala(nome) {
  pararSomAmbiente();
  const sala = salas.find(s => s.nome === nome);
  if (sala.status === "jogando") return;

  if (saldo < sala.valor) {
    mostrarModalSaldoInsuficiente(sala.valor);
    return;
  }

  salaAtual = sala;
  saldo -= sala.valor;
  atualizarSaldo();

  // prepara bots da arena com scores zerados
  botsArena = sala.bots.map(b => ({
    nome: b.nome,
    foto: b.foto,
    score: 0,
    // cliques finais entre 292 e 319
    alvo: Math.floor(Math.random() * 28) + 292
  }));

  document.getElementById("arena").classList.remove("hidden");
  iniciarArena();
}

// =============================
// 💸 MODAL SALDO INSUFICIENTE
// =============================

function mostrarModalSaldoInsuficiente(valorNecessario) {
  const modal = document.createElement("div");
  modal.id = "modalSaldoInsuficiente";
  modal.className = "modal-overlay";
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-icon">💰</div>
      <h2>Saldo insuficiente</h2>
      <p>Você precisa de <strong>R$ ${valorNecessario.toFixed(2)}</strong> para entrar nesta sala.</p>
      <p style="color:#6b7280; font-size:13px;">Seu saldo atual: R$ ${saldo.toFixed(2)}</p>
      <button class="btn-primary" onclick="fecharModalSaldo(); abrirWallet(); depositar();">
        💳 Depositar agora
      </button>
      <button class="btn-secondary" style="margin-top:8px" onclick="fecharModalSaldo()">
        Fechar
      </button>
    </div>
  `;
  document.body.appendChild(modal);
}

function fecharModalSaldo() {
  const modal = document.getElementById("modalSaldoInsuficiente");
  if (modal) modal.remove();
}

// =============================
// ⚔️ ARENA DE COMBATE
// =============================

function iniciarArena() {
  cliques = 0;
  tempo = 30;
  posicaoAnterior = null;

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
      setTimeout(() => {
        document.getElementById("arena").classList.add("hidden");
      }, 2000);
    }
  }, 1000);

  // bots progridem para atingir alvo em 30s
  botInterval = setInterval(() => {
    botsArena.forEach(bot => {
      const progresso = bot.alvo / 60; // em 30s com 2 updates/s
      bot.score = Math.min(bot.score + progresso + Math.random() * 1.5, bot.alvo);
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

  let posicao = jogadores.findIndex(j => j.nome === nomeJogador) + 1;
  if (posicaoAnterior !== null && posicao < posicaoAnterior) somUltrapassar();
  posicaoAnterior = posicao;

  jogadores.slice(0, 4).forEach((j, i) => {
    const eVoce = j.nome === nomeJogador;
    const fotoEl = j.foto
      ? `<img src="${j.foto}" class="rank-foto" style="width:24px;height:24px;margin-right:6px;" />`
      : `<div class="rank-avatar" style="width:24px;height:24px;font-size:10px;margin-right:6px;">${j.nome.charAt(0)}</div>`;

    div.innerHTML += `
      <div class="rank-player ${eVoce ? "voce" : ""}">
        <div style="display:flex; justify-content:space-between; font-size:13px; align-items:center;">
          <div style="display:flex;align-items:center;">${fotoEl}<span>${i + 1}º ${j.nome}</span></div>
          <span>${Math.floor(j.score)}</span>
        </div>
        <div class="barra">
          <div class="progresso" style="width:${(j.score / max) * 100}%"></div>
        </div>
      </div>
    `;
  });
}


// ✅ CLIQUE — apenas +1 por clique
function configurarClickBtn() {
  const btn = document.getElementById("clickBtn");
  if (!btn) return;
  btn.onclick = null;

  btn.addEventListener("click", () => {
    if (!cliqueValido()) return;

    const agora = Date.now();

    fetch(`${window.location.origin}/click`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: perfil.id, timestamp: agora })
    })
    .then(res => res.json())
    .then(data => { if (!data.ok) return; })
    .catch(err => console.log("Erro no click:", err));

    ultimoClique = agora;

    // ✅ sempre +1, sem combo duplicado
    somClick();
    cliques += 1;

    const plus = document.createElement("div");
    plus.innerText = "+1";
    plus.className = "plus";
    plus.style.left = Math.random() * 60 + 20 + "%";
    plus.style.top = "30%";
    document.getElementById("clickArea").appendChild(plus);
    setTimeout(() => plus.remove(), 800);

    atualizarRankingArena();
  });
}

// =============================
// 🏁 RESULTADO + ANIMAÇÃO VITÓRIA
// =============================

function mostrarResultado() {
  somVitoria();

  const nomeJogador = usuarioLogado ? usuarioLogado.nome : "VOCÊ";
  let jogadores = [
    { nome: nomeJogador, score: cliques },
    ...botsArena.map(b => ({ nome: b.nome, score: b.score }))
  ];
  jogadores.sort((a, b) => b.score - a.score);

  const posicao = jogadores.findIndex(j => j.nome === nomeJogador) + 1;
  const titulo = document.getElementById("resultadoTitulo");
  const texto = document.getElementById("resultadoTexto");
  const ganhoEl = document.getElementById("resultadoGanho");

  titulo.classList.remove("vitoria", "derrota");

  if (posicao === 1 && salaAtual) {
    const premio = parseFloat(calcularPremio(salaAtual));

    // atualiza saldo
    saldo += premio;
    atualizarSaldo();

    // salva no servidor
    fetch(`${window.location.origin}/creditar-vitoria`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: usuarioLogado.id, valor: premio })
    }).catch(() => {});

    titulo.innerText = "VOCÊ VENCEU! 🚀🔥";
    titulo.classList.add("vitoria");
    if (ganhoEl) {
      ganhoEl.innerText = `+R$ ${premio.toFixed(2)}`;
      ganhoEl.classList.remove("hidden");
    }

    soltarConfete();
    animarPremio(premio);

  } else {
    titulo.innerText = `${posicao}º LUGAR`;
    texto.innerText = "Você quase chegou lá! Tente novamente.";
    titulo.classList.add("derrota");
    if (ganhoEl) ganhoEl.classList.add("hidden");
  }

  document.getElementById("resultado").classList.remove("hidden");
}

function animarPremio(valor) {
  // moedas subindo
  for (let i = 0; i < 8; i++) {
    setTimeout(() => {
      const moeda = document.createElement("div");
      moeda.innerText = "💰";
      moeda.style.cssText = `
        position: fixed;
        font-size: 28px;
        left: ${Math.random() * 80 + 10}%;
        bottom: 20%;
        animation: subirMoeda 1.2s ease forwards;
        z-index: 10000;
        pointer-events: none;
      `;
      document.body.appendChild(moeda);
      setTimeout(() => moeda.remove(), 1200);
    }, i * 150);
  }

  // texto de ganho voando
  const ganho = document.createElement("div");
  ganho.innerText = `+R$ ${valor.toFixed(2)}`;
  ganho.style.cssText = `
    position: fixed;
    left: 50%;
    top: 40%;
    transform: translateX(-50%);
    color: #22c55e;
    font-size: 36px;
    font-weight: bold;
    text-shadow: 0 0 20px #22c55e;
    animation: subirGanho 2s ease forwards;
    z-index: 10000;
    pointer-events: none;
  `;
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
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let particulas = [];
  for (let i = 0; i < 150; i++) {
    particulas.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 6 + 2,
      d: Math.random() * 5 + 2,
      color: `hsl(${Math.random() * 360}, 100%, 50%)`
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particulas.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
    particulas.forEach(p => {
      p.y += p.d;
      if (p.y > canvas.height) { p.y = 0; p.x = Math.random() * canvas.width; }
    });
  }

  let intervalo = setInterval(draw, 20);
  setTimeout(() => { clearInterval(intervalo); ctx.clearRect(0, 0, canvas.width, canvas.height); }, 3000);
}

// =============================
// ⏱️ TIMER GLOBAL
// =============================

function iniciarTimer() {
  setInterval(() => {
    tempoGlobal--;
    if (tempoGlobal <= 0) { iniciarRodada(); tempoGlobal = 30; }
    const el = document.getElementById("timer");
    if (el) el.innerText = "00:" + tempoGlobal.toString().padStart(2, "0");
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
    sala.status = "jogando";
    sala.emJogo = true;
    sala.tempo = 30;

    let intervalo = setInterval(() => {
      sala.tempo--;
      if (sala.tempo <= 0) {
        clearInterval(intervalo);
        sala.status = "aguardando";
        sala.emJogo = false;
        sala.tempo = 30;
        gerarBotsParaSala(sala); // renova bots
        renderSalas();
      }
    }, 1000);
  });
}

// =============================
// 💰 WALLET
// =============================

function abrirWallet() {
  document.getElementById("wallet").classList.remove("hidden");
  document.getElementById("walletSaldo").innerText = "R$ " + saldo.toFixed(2);
}

function fecharWallet() {
  document.getElementById("wallet").classList.add("hidden");
}

function depositar() {
  document.getElementById("modalDeposito").classList.remove("hidden");
}

function fecharDeposito() {
  document.getElementById("modalDeposito").classList.add("hidden");
  document.getElementById("pixContainer").innerHTML = "";
}

function sacar() {
  document.getElementById("modalSaque").classList.remove("hidden");
}

function fecharSaque() {
  document.getElementById("modalSaque").classList.add("hidden");
  document.getElementById("saqueMsg").classList.add("hidden");
}

async function confirmarSaque() {
  const valor = Number(document.getElementById("inputSaqueValor").value);
  const chave = document.getElementById("inputSaqueChave").value.trim();
  const msgEl = document.getElementById("saqueMsg");

  msgEl.classList.add("hidden");

  if (!valor || valor <= 0) {
    msgEl.innerText = "Digite um valor válido";
    msgEl.className = "saque-erro";
    msgEl.classList.remove("hidden");
    return;
  }
  if (!chave) {
    msgEl.innerText = "Digite sua chave PIX";
    msgEl.className = "saque-erro";
    msgEl.classList.remove("hidden");
    return;
  }
  if (valor > saldo) {
    msgEl.innerText = "Saldo insuficiente";
    msgEl.className = "saque-erro";
    msgEl.classList.remove("hidden");
    return;
  }

  try {
    const res = await fetch(`${window.location.origin}/sacar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor, userId: usuarioLogado.id, chave_pix: chave })
    });
    const data = await res.json();
    if (!res.ok) {
      msgEl.innerText = data.erro || "Erro ao solicitar saque";
      msgEl.className = "saque-erro";
      msgEl.classList.remove("hidden");
      return;
    }
    saldo -= valor;
    atualizarSaldo();
    msgEl.innerText = data.mensagem;
    msgEl.className = "saque-sucesso";
    msgEl.classList.remove("hidden");
    document.getElementById("inputSaqueValor").value = "";
    document.getElementById("inputSaqueChave").value = "";
  } catch (err) {
    msgEl.innerText = "Erro ao conectar com servidor";
    msgEl.className = "saque-erro";
    msgEl.classList.remove("hidden");
  }
}

async function confirmarDeposito() {
  const valor = document.getElementById("inputValor").value;
  const container = document.getElementById("pixContainer");

  if (!valor || valor <= 0) {
    container.innerHTML = "<p style='color:red'>Digite um valor válido</p>";
    return;
  }

  container.innerHTML = "<p>⏳ Gerando PIX...</p>";

  try {
    const res = await fetch(`${window.location.origin}/criar-pagamento`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ valor: Number(valor), userId: usuarioLogado.id })
    });

    if (!res.ok) {
      container.innerHTML = `<p style="color:red">Erro ao gerar PIX</p>`;
      return;
    }

    const data = await res.json();

container.innerHTML = `
      <img src="data:image/png;base64,${data.qr_base64}" style="width:200px; margin-top:10px; border-radius:10px;">
      <button onclick="copiarPix('${data.qr_code}')" class="btn-copiar">📋 Copiar PIX</button>
      <div id="feedbackPix" class="hidden"></div>
    `;

    const verificar = setInterval(async () => {
      try {
        const r = await fetch(`${window.location.origin}/saldo/${usuarioLogado.id}`);
        const d = await r.json();
        if (d.saldo > saldo) {
          clearInterval(verificar);
          saldo = d.saldo;
          atualizarSaldo();
          container.innerHTML = `<div class="pix-sucesso">✅ Depósito realizado com sucesso!</div>`;
          setTimeout(() => fecharDeposito(), 2500);
        }
      } catch(e) {}
    }, 5000);

    setTimeout(() => clearInterval(verificar), 600000);
  } catch (err) {
    container.innerHTML = "<p style='color:red'>Erro ao conectar com servidor</p>";
  }
}

function copiarPix(codigo) {
  navigator.clipboard.writeText(codigo)
    .then(() => mostrarFeedback("✅ Pix copiado com sucesso"))
    .catch(() => mostrarFeedback("❌ Erro ao copiar Pix"));
}

function mostrarFeedback(msg) {
  const div = document.getElementById("feedbackPix");
  if (!div) return;
  div.innerText = msg;
  div.classList.remove("hidden");
  div.classList.add("feedback-sucesso");
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
    ultimoSaldo = novoSaldo;
    saldo = novoSaldo;
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
  div.className = "money";
  div.style.left = "50%";
  div.style.top = "50%";
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 1000);
}

async function verHistorico() {
  if (!usuarioLogado) return;
  const res = await fetch(`${window.location.origin}/historico/${usuarioLogado.id}`);
  const dados = await res.json();
  const area = document.getElementById("historicoArea");
  if (!dados.length) {
    area.innerHTML = "<p style='text-align:center;'>Nenhuma transação ainda</p>";
  } else {
    area.innerHTML = dados.map(item => `
      <div style="background:#111; padding:10px; margin-bottom:10px; border-radius:8px;">
        <strong>${item.tipo}</strong><br>
        R$ ${Number(item.valor).toFixed(2)}<br>
        <small>${new Date(item.data).toLocaleString()}</small>
      </div>
    `).join("");
  }
  area.classList.remove("hidden");
}

// =============================
// 👤 PERFIL
// =============================

function salvarPerfil() {
  localStorage.setItem("perfil", JSON.stringify(perfil));
}

function gerarAvatar(nome) {
  return nome ? nome.charAt(0).toUpperCase() : "?";
}

function abrirPerfil() {
  const aproveitamento = perfil.partidas > 0
    ? Math.round((perfil.vitorias / perfil.partidas) * 100)
    : 0;

  const foto = usuarioLogado && usuarioLogado.foto_url
    ? `<img src="${usuarioLogado.foto_url}" class="perfil-foto-img" onclick="trocarFotoPerfil()" />`
    : `<div class="perfil-avatar" onclick="trocarFotoPerfil()">${gerarAvatar(perfil.nome)}</div>`;

  abrirTela(`
    <div class="tela-box perfil-box">
      <div class="tela-header">
        <span class="btn-voltar" onclick="fecharTela()">←</span>
        <h2>Perfil</h2>
      </div>
      <div class="perfil-header">
        ${foto}
        <p style="font-size:12px; color:#6b7280; margin-top:5px;">Toque na foto para alterar</p>
        <input id="inputFotoPerfil" type="file" accept="image/*" class="hidden" onchange="atualizarFotoPerfil(event)" />
        <input id="nomePerfil" value="${perfil.nome}" class="input-nome" />
        <p style="color:#6b7280; font-size:13px;">ID: ${perfil.id}</p>
      </div>
      <div class="perfil-saldo">
        <span>Saldo atual</span>
        <h1>R$ ${saldo.toFixed(2)}</h1>
      </div>
      <div class="perfil-stats">
        <div class="stat"><strong>${perfil.partidas}</strong><span>Partidas</span></div>
        <div class="stat"><strong>${perfil.vitorias}</strong><span>Vitórias</span></div>
        <div class="stat"><strong>${aproveitamento}%</strong><span>Aproveit.</span></div>
      </div>
      <div class="perfil-actions">
        <button class="btn-primary" onclick="salvarNome()">💾 Salvar nome</button>
        <button class="btn-secondary" onclick="fecharTela()">✕ Fechar</button>
      </div>
    </div>
  `);
}

function trocarFotoPerfil() {
  document.getElementById("inputFotoPerfil").click();
}

async function atualizarFotoPerfil(event) {
  const file = event.target.files[0];
  if (!file || !usuarioLogado) return;
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const res = await fetch(`${window.location.origin}/atualizar-foto`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

function abrirMenu() {
  document.getElementById("menuLateral").classList.remove("hidden");
}

function fecharMenu() {
  document.getElementById("menuLateral").classList.add("hidden");
}

function abrirTela(conteudoHTML) {
  const tela = document.getElementById("telaMenu");
  tela.innerHTML = conteudoHTML;
  tela.classList.remove("hidden");
}

function fecharTela() {
  document.getElementById("telaMenu").classList.add("hidden");
}

function abrirReclamacoes() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header">
        <span class="btn-voltar" onclick="fecharTela()">←</span>
        <h2>Reclamações</h2>
      </div>
      <div class="tela-content">
        <p>Descreva sua reclamação abaixo:</p>
        <textarea placeholder="Escreva aqui..."></textarea>
        <button class="btn-primary">Enviar</button>
      </div>
    </div>
  `);
}

function abrirConfiguracoes() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header">
        <span class="btn-voltar" onclick="fecharTela()">←</span>
        <h2>Configurações</h2>
      </div>
      <div class="tela-content">
        <div class="config-item">
          <span>Som</span>
          <input type="checkbox" ${somAtivo ? "checked" : ""} onchange="toggleSom()">
        </div>
        <div class="config-item">
          <span>Vibração</span>
          <input type="checkbox" checked>
        </div>
      </div>
    </div>
  `);
}

function abrirDiretrizes() {
  abrirTela(`
    <div class="tela-box">
      <div class="tela-header">
        <span class="btn-voltar" onclick="fecharTela()">←</span>
        <h2>Diretrizes</h2>
      </div>
      <div class="tela-content">
        <p>Use o jogo de forma justa. Bots e trapaças resultam em banimento permanente.</p>
      </div>
    </div>
  `);
}