let ultimoClique = 0;
let ultimoCliqueValido = 0;
let cliquesSegundo = 0;
let historicoCliques = [];
let timerInterval = null;
let botInterval = null;
let posicaoAnterior = null;

let ambientOsc = null;
let ambientGain = null;
let ultimoSaldo = 0;

// ✅ audioCtx declarado no topo para evitar erro de "não existe ainda"
let audioCtx = null;

let perfil = JSON.parse(localStorage.getItem("perfil")) || {
  nome: "Jogador123",
  id: "user1",
  partidas: 0,
  vitorias: 0
};

setInterval(() => {
  if (cliquesSegundo > 15) {
    console.log("🚨 Cliques muito rápidos (suspeito)");
  }
  cliquesSegundo = 0;
}, 1000);

function cliqueValido() {
  const agora = Date.now();

  if (agora - ultimoCliqueValido < 80) {
    return false;
  }

  // ✅ atualiza ultimoCliqueValido (antes estava atualizando ultimoClique por engano)
  ultimoCliqueValido = agora;
  cliquesSegundo++;

  historicoCliques.push(agora);

  if (historicoCliques.length > 10) {
    historicoCliques.shift();
  }

  if (historicoCliques.length === 10) {
    let intervalos = [];

    for (let i = 1; i < historicoCliques.length; i++) {
      intervalos.push(historicoCliques[i] - historicoCliques[i - 1]);
    }

    const todosIguais = intervalos.every(i => Math.abs(i - intervalos[0]) < 5);

    if (todosIguais) {
      console.log("🚨 Bot detectado");
      return false;
    }
  }

  return true;
}

function salvarPerfil() {
  localStorage.setItem("perfil", JSON.stringify(perfil));
}

// 🔊 INICIAR SOM AMBIENTE
function iniciarSomAmbiente() {
  // ✅ verifica se audioCtx existe antes de usar
  if (!audioCtx) return;
  if (ambientOsc) return;

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

  // ✅ limpa referência depois que o som termina
  ambientOsc.onended = () => {
    ambientOsc = null;
  };
}

// 🔇 PARAR SOM AMBIENTE
function pararSomAmbiente() {
  if (!ambientOsc) return;

  try {
    ambientOsc.stop();
    ambientOsc.disconnect();
  } catch(e) {}

  ambientOsc = null;
}

// ✅ listener unificado para criar audioCtx no primeiro clique
document.addEventListener("click", () => {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (audioCtx.state !== "running") {
    audioCtx.resume();
  }

  // inicia som ambiente uma única vez
  if (!window.somAmbienteIniciado) {
    window.somAmbienteIniciado = true;

    window.somIntervalo = setInterval(() => {
      iniciarSomAmbiente();
    }, 3000);
  }
});

// 🔊 SOM CLICK
function somClick() {
  if (!audioCtx) return;

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

// 🔥 SOM ULTRAPASSAGEM
function somUltrapassar() {
  if (!audioCtx) return;

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

// 🏆 SOM VITÓRIA
function somVitoria() {
  if (!audioCtx) return;

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

let combo = 0;
let saldo = 48.50;
let tempoGlobal = 30;

const salas = [
  { nome: "Bronze", jogadores: 11, max: 3, valor: 2, tempo: 30, status: "aguardando", emJogo: false },
  { nome: "Prata", jogadores: 10, max: 5, valor: 5, tempo: 30, status: "aguardando", emJogo: false },
  { nome: "Ouro", jogadores: 12, max: 10, valor: 10, tempo: 30, status: "aguardando", emJogo: false },
  { nome: "Diamante", jogadores: 17, max: 10, valor: 20, tempo: 30, status: "aguardando", emJogo: false },
];

const grupoA = [0, 1];
const grupoB = [2, 3];

let grupoAtual = "A";

const rankingHoje = [
  { nome: "Neymar Jr.", vitorias: 12, cliques: 3200, ganho: 1542 },
  { nome: "Estevão Jardim", vitorias: 10, cliques: 2980, ganho: 1320 },
  { nome: "Caroline Maria", vitorias: 8, cliques: 2750, ganho: 1105 },
];

function renderRanking() {
  const div = document.getElementById("ranking");
  div.innerHTML = "<h3>🏆 Top jogadores hoje</h3>";

  rankingHoje.forEach((j, i) => {

    let classe = "";
    let icon = "⭐";

    if (i === 0) {
      classe = "gold";
      icon = "🥇";
    } else if (i === 1) {
      classe = "silver";
      icon = "🥈";
    } else if (i === 2) {
      classe = "bronze";
      icon = "🥉";
    }

    div.innerHTML += `
      <div class="rank-card ${classe}">
        <div class="rank-left">
          <div class="rank-icon">${icon}</div>
          <div>
            <div class="rank-name">${j.nome}</div>
            <div class="rank-info">
              ${j.vitorias} vitórias • ${j.cliques} cliques
            </div>
          </div>
        </div>
        <div class="rank-money">
          R$ ${j.ganho}
        </div>
      </div>
    `;
  });
}

function renderSalas() {
  const div = document.getElementById("salas");
  div.innerHTML = "";

  salas.forEach(sala => {
    const premio = sala.jogadores * sala.valor;

    div.innerHTML += `
      <div class="sala" onclick="entrarSala('${sala.nome}')">
        <div class="sala-left">
          <b>${sala.nome}</b>
          <span>${sala.jogadores}/${sala.max} jogadores</span>
        </div>
        <div class="sala-right">
          <div class="green">R$ ${premio}</div>
          <div>Entrada R$${sala.valor}</div>
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
    alert("Saldo insuficiente");
    return;
  }

  saldo -= sala.valor;
  atualizarSaldo();

  document.getElementById("arena").classList.remove("hidden");

  iniciarArena();
}

let cliques = 0;
let tempo = 30;

let bots = [
  { nome: "Renato Enio", score: 0, ritmo: 2 },
  { nome: "Rodigo Silva", score: 0, ritmo: 1.5 },
  { nome: "Wellington Junior", score: 0, ritmo: 2 },
];

function iniciarArena() {
  cliques = 0;
  tempo = 30;

  // ✅ reseta scores dos bots a cada partida
  bots.forEach(bot => bot.score = 0);

  atualizarRanking();

  clearInterval(timerInterval);
  clearInterval(botInterval);

  timerInterval = setInterval(() => {
    tempo--;

    document.getElementById("arenaTimer").innerText = tempo + "s";

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

  botInterval = setInterval(() => {
    bots.forEach(bot => {
      let variacao = Math.random() * 2;
      bot.score += bot.ritmo + variacao;

      if (Math.random() > 0.9) {
        bot.score += 10;
      }
    });

    atualizarRanking();

  }, 500);
}

function atualizarRanking() {
  let jogadores = [
    { nome: "VOCÊ", score: cliques },
    ...bots
  ];

  jogadores.sort((a, b) => b.score - a.score);

  const max = jogadores[0].score || 1;

  const div = document.getElementById("arenaRanking");
  div.innerHTML = "";

  let posicao = jogadores.findIndex(j => j.nome === "VOCÊ") + 1;

  if (posicaoAnterior !== null && posicao < posicaoAnterior) {
    somUltrapassar();
  }

  posicaoAnterior = posicao;

  jogadores.slice(0, 4).forEach((j, i) => {
    let porcentagem = (j.score / max) * 100;

    div.innerHTML += `
      <div class="rank-player ${j.nome === "VOCÊ" ? "voce" : ""}">
        <div style="display:flex; justify-content:space-between;">
          <span>${i + 1}º • ${j.nome}</span>
          <span>${Math.floor(j.score)}</span>
        </div>
        <div class="barra">
          <div class="progresso" style="width:${porcentagem}%"></div>
        </div>
      </div>
    `;
  });
}

function iniciarTimer() {
  setInterval(() => {
    tempoGlobal--;

    if (tempoGlobal <= 0) {
      iniciarRodada();
      tempoGlobal = 30;
    }

    document.getElementById("timer").innerText =
      "00:" + tempoGlobal.toString().padStart(2, "0");

    renderSalas();

  }, 1000);
}

function iniciarRodada() {
  if (grupoAtual === "A") {
    iniciarSalas(grupoA);
    grupoAtual = "B";
  } else {
    iniciarSalas(grupoB);
    grupoAtual = "A";
  }
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
      }

    }, 1000);
  });
}

function atualizarTimer() {
  const el = document.getElementById("timer");

  let min = String(Math.floor(tempoGlobal / 60)).padStart(2, "0");
  let seg = String(tempoGlobal % 60).padStart(2, "0");

  el.innerText = `${min}:${seg}`;
}

window.onload = () => {
  const btn = document.getElementById("clickBtn");

  btn.onclick = null;

  btn.addEventListener("click", () => {
    if (!cliqueValido()) return;

    const agora = Date.now();

    fetch(`${window.location.origin}/click`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        userId: perfil.id,
        timestamp: agora
      })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.ok) return;
    })
    .catch(err => {
      console.log("Erro no click:", err);
    });

    if (agora - ultimoClique < 300) {
      combo++;
    } else {
      combo = 1;
    }

    ultimoClique = agora;

    let ganho = combo >= 5 ? 2 : 1;

    somClick();
    cliques += ganho;

    const plus = document.createElement("div");
    plus.innerText = combo >= 5 ? `+${ganho} 🔥` : `+${ganho}`;
    plus.className = "plus";

    plus.style.left = "50%";
    plus.style.top = "50%";

    document.getElementById("clickArea").appendChild(plus);

    setTimeout(() => plus.remove(), 800);

    atualizarRanking();
  });
};

function mostrarResultado() {
  somVitoria();

  let jogadores = [
    { nome: "VOCÊ", score: cliques },
    ...bots
  ];

  jogadores.sort((a, b) => b.score - a.score);

  const posicao = jogadores.findIndex(j => j.nome === "VOCÊ") + 1;

  const titulo = document.getElementById("resultadoTitulo");
  const texto = document.getElementById("resultadoTexto");

  titulo.classList.remove("vitoria", "derrota");

  if (posicao === 1) {
    titulo.innerText = "VOCÊ VENCEU 🚀🔥";
    texto.innerText = "DOMINOU A PARTIDA!";
    titulo.classList.add("vitoria");

    soltarConfete();
  } else {
    titulo.innerText = `${posicao}º LUGAR`;
    texto.innerText = "Você quase chegou lá!";
    titulo.classList.add("derrota");
  }

  document.getElementById("resultado").classList.remove("hidden");
}

function fecharResultado() {
  document.getElementById("resultado").classList.add("hidden");
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

    update();
  }

  function update() {
    particulas.forEach(p => {
      p.y += p.d;
      if (p.y > canvas.height) {
        p.y = 0;
        p.x = Math.random() * canvas.width;
      }
    });
  }

  let intervalo = setInterval(draw, 20);

  setTimeout(() => {
    clearInterval(intervalo);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, 3000);
}

function abrirWallet() {
  document.getElementById("wallet").classList.remove("hidden");
  document.getElementById("walletSaldo").innerText = saldo.toFixed(2);
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
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        valor: Number(valor),
        userId: "user1"
      })
    });

    if (!res.ok) {
      const erro = await res.text();
      container.innerHTML = `<p style="color:red">${erro}</p>`;
      return;
    }

    const data = await res.json();

    container.innerHTML = `
      <img src="data:image/png;base64,${data.qr_base64}" style="width:200px; margin-top:10px; border-radius:10px;">
      <button onclick="copiarPix('${data.qr_code}')" class="btn-copiar">
        📋 Copiar PIX
      </button>
      <div id="feedbackPix" class="hidden"></div>
    `;

  } catch (err) {
    container.innerHTML = "<p style='color:red'>Erro ao conectar com servidor</p>";
  }
}

function copiarPix(codigo) {
  navigator.clipboard.writeText(codigo)
    .then(() => {
      mostrarFeedback("✅ Pix copiado com sucesso");
    })
    .catch(() => {
      mostrarFeedback("❌ Erro ao copiar Pix");
    });
}

function mostrarFeedback(msg) {
  const div = document.getElementById("feedbackPix");

  div.innerText = msg;
  div.classList.remove("hidden");
  div.classList.add("feedback-sucesso");

  setTimeout(() => {
    div.classList.add("hidden");
  }, 2000);
}

// ✅ função sacar corrigida - removido o "if (!res.ok)" que estava no lugar errado
function sacar() {
  let valor = prompt("Valor do saque:");

  if (!valor || isNaN(valor)) return;

  fetch(`${window.location.origin}/sacar`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      valor: Number(valor),
      userId: "user1"
    })
  })
  .then(res => res.text())
  .then(msg => alert(msg))
  .catch(err => {
    console.log("Erro:", err);
    alert("Erro ao conectar com servidor");
  });
}

function mostrarPix(data) {
  const img = document.createElement("img");
  img.src = "data:image/png;base64," + data.qr_base64;

  const div = document.createElement("div");
  div.style.position = "fixed";
  div.style.top = "50%";
  div.style.left = "50%";
  div.style.transform = "translate(-50%, -50%)";
  div.style.background = "#000";
  div.style.padding = "20px";
  div.style.borderRadius = "10px";

  const copiar = document.createElement("textarea");
  copiar.value = data.qr_code;

  div.appendChild(img);
  div.appendChild(copiar);

  document.body.appendChild(div);
}

function atualizarSaldo() {
  document.getElementById("saldo").innerText = "R$ " + saldo.toFixed(2);
  document.getElementById("walletSaldo").innerText = "R$ " + saldo.toFixed(2);
}

function animarSaldo(valor) {
  let alvo = saldo;
  let atual = saldo - valor;

  let intervalo = setInterval(() => {
    atual += valor / 20;

    if (atual >= alvo) {
      atual = alvo;
      clearInterval(intervalo);
    }

    document.getElementById("saldo").innerText = "R$ " + atual.toFixed(2);
    document.getElementById("walletSaldo").innerText = "R$ " + atual.toFixed(2);

  }, 20);
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

async function buscarSaldo() {
  try {
    const res = await fetch(`${window.location.origin}/saldo/user1`);

    if (!res.ok) {
      console.log("Erro ao buscar saldo");
      return;
    }

    const data = await res.json();

    const novoSaldo = data.saldo;

    if (novoSaldo > ultimoSaldo) {
      animarDinheiro(novoSaldo - ultimoSaldo);
    }

    ultimoSaldo = novoSaldo;

    document.getElementById("saldo").innerText =
      "R$ " + novoSaldo.toFixed(2);

  } catch (err) {
    console.log("Servidor offline ou erro:", err);
  }
}

setInterval(buscarSaldo, 2000);
buscarSaldo();

async function verHistorico() {
  const res = await fetch(`${window.location.origin}/historico/user1`);
  const dados = await res.json();

  const area = document.getElementById("historicoArea");

  if (!dados.length) {
    area.innerHTML = "<p style='text-align:center;'>Nenhuma transação ainda</p>";
  } else {
    area.innerHTML = dados.map(item => `
      <div style="
        background:#111;
        padding:10px;
        margin-bottom:10px;
        border-radius:8px;
      ">
        <strong>${item.tipo}</strong><br>
        R$ ${item.valor.toFixed(2)}<br>
        <small>${new Date(item.data).toLocaleString()}</small>
      </div>
    `).join("");
  }

  area.classList.remove("hidden");
}

function fecharHistorico() {
  document.getElementById("modalHistorico").classList.add("hidden");
}

atualizarSaldo();
renderRanking();
renderSalas();
iniciarTimer();

function abrirMenu() {
  document.getElementById("menuLateral").classList.remove("hidden");
}

function fecharMenu() {
  document.getElementById("menuLateral").classList.add("hidden");
}

function abrirReclamacoes() {
  alert("Área de reclamações (vamos evoluir isso)");
}

function abrirTela(conteudoHTML) {
  const tela = document.getElementById("telaMenu");
  tela.innerHTML = conteudoHTML;
  tela.classList.remove("hidden");
}

function fecharTela() {
  document.getElementById("telaMenu").classList.add("hidden");
}

function abrirPerfil() {
  const aproveitamento = perfil.partidas > 0
    ? Math.round((perfil.vitorias / perfil.partidas) * 100)
    : 0;

  abrirTela(`
    <div class="tela-box perfil-box">

      <div class="perfil-header">
        <div class="perfil-avatar">${gerarAvatar(perfil.nome)}</div>

        <input 
          id="nomePerfil" 
          value="${perfil.nome}" 
          class="input-nome"
        />

        <p>ID: ${perfil.id}</p>
      </div>

      <div class="perfil-saldo">
        <span>Saldo atual</span>
        <h1>R$ ${saldo.toFixed(2)}</h1>
      </div>

      <div class="perfil-stats">
        <div class="stat">
          <strong>${perfil.partidas}</strong>
          <span>Partidas</span>
        </div>
        <div class="stat">
          <strong>${perfil.vitorias}</strong>
          <span>Vitórias</span>
        </div>
        <div class="stat">
          <strong>${aproveitamento}%</strong>
          <span>Aproveitamento</span>
        </div>
      </div>

      <div class="perfil-actions">
        <button class="btn-primary" onclick="salvarNome()">💾 Salvar nome</button>
        <button class="btn-secondary" onclick="fecharTela()">✕ Fechar</button>
      </div>

    </div>
  `);
}

// ✅ função gerarAvatar que estava faltando no código original
function gerarAvatar(nome) {
  return nome ? nome.charAt(0).toUpperCase() : "?";
}

function salvarNome() {
  const input = document.getElementById("nomePerfil");
  if (input) {
    perfil.nome = input.value;
    salvarPerfil();
    alert("Nome salvo!");
  }
}

function abrirWallet() {
  document.getElementById("wallet").classList.remove("hidden");
  document.getElementById("walletSaldo").innerText = "R$ " + saldo.toFixed(2);
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
          <input type="checkbox" checked>
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