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

  // 🚫 Bloqueia clique muito rápido
  if (agora - ultimoCliqueValido < 80) {
    return false;
  }

  ultimoClique = agora;
  cliquesSegundo++;

  // 📊 histórico
  historicoCliques.push(agora);

  if (historicoCliques.length > 10) {
    historicoCliques.shift();
  }

  // 🤖 detectar padrão robótico
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
  if (ambientOsc) return; // já está rodando

  ambientOsc = audioCtx.createOscillator();
  ambientGain = audioCtx.createGain();

ambientOsc.type = "triangle";

let agora = audioCtx.currentTime;

// sequência tipo cassino
ambientOsc.frequency.setValueAtTime(600, agora);
ambientOsc.frequency.linearRampToValueAtTime(900, agora + 0.1);
ambientOsc.frequency.linearRampToValueAtTime(700, agora + 0.2);

ambientGain.gain.setValueAtTime(0.1, agora);
ambientGain.gain.exponentialRampToValueAtTime(0.0001, agora + 0.25);

  ambientOsc.start(agora);
  ambientOsc.stop(agora + 0.25);
}

// 🔇 PARAR SOM AMBIENTE
function pararSomAmbiente() {
  if (!ambientOsc) return;

  ambientOsc.stop();
  ambientOsc.disconnect();

  ambientOsc = null;
}

let audioCtx = new (window.AudioContext || window.webkitAudioContext)();


// 🔊 SOM CLICK
function somClick() {
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

  // 🔥 ABRIR ARENA
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

  atualizarRanking();

  // 🔥 LIMPA intervalos antigos (ESSENCIAL)
  clearInterval(timerInterval);
  clearInterval(botInterval);

  // ⏱ TIMER
  timerInterval = setInterval(() => {
    tempo--;

    document.getElementById("arenaTimer").innerText = tempo + "s";

    if (tempo <= 0) {
      clearInterval(timerInterval);
      clearInterval(botInterval);

      mostrarResultado(); // 🔥 FINALIZA

iniciarSomAmbiente();

      setTimeout(() => {
        document.getElementById("arena").classList.add("hidden");
      }, 2000);
    }

  }, 1000);

  // 🤖 BOTS
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

  let posicaoAtual = jogadores.findIndex(j => j.nome === "VOCÊ") + 1;

  // 🔊 DETECTAR ULTRAPASSAGEM
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

btn.onclick = null; // limpa qualquer evento antigo

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
  if (!data.ok) return; // bloqueado

  // 👉 CONTINUA SEU CÓDIGO NORMAL AQUI
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

    soltarConfete(); // 🎆 BOOM
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

  // 🔄 loading bonito
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

    // 🎯 MOSTRAR PIX BONITO
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
    const res = await fetch(`${window.location.origin}/saldo/user1`)

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
  const res = await fetch(`${window.location.origin}/historico/user1`)
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

buscarSaldo();
atualizarSaldo();
renderRanking();
renderSalas();
iniciarTimer();

document.addEventListener("click", () => {
  if (audioCtx.state !== "running") {
    audioCtx.resume();
  }

  // 🔊 inicia som ambiente uma única vez
  if (!window.somAmbienteIniciado) {
    window.somAmbienteIniciado = true;

    window.somIntervalo = setInterval(() => {
      iniciarSomAmbiente();
    }, 3000);
  }
});

function abrirMenu() {
  document.getElementById("menuLateral").classList.remove("hidden");
}

function fecharMenu() {
  document.getElementById("menuLateral").classList.add("hidden");
}

function abrirPerfil() {
  alert("Abrir perfil (vamos construir depois)");
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

      ${renderConquistas()}

      <div class="perfil-actions">
        <button class="btn-primary" onclick="salvarNome()">Salvar nome</button>
        <button class="btn-secondary" onclick="fecharTela()">Voltar</button>
      </div>

    </div>
  `);
}

function gerarAvatar(nome) {
  const letra = nome.charAt(0).toUpperCase();
  return letra;
}

function salvarNome() {
  const novoNome = document.getElementById("nomePerfil").value;

  if (!novoNome || novoNome.length < 3) {
    alert("Nome muito curto");
    return;
  }

  perfil.nome = novoNome;
  salvarPerfil();

  abrirPerfil(); // recarrega
}

function renderConquistas() {
  let conquistas = [];

  if (perfil.partidas >= 1) conquistas.push("🎮 Primeira partida");
  if (perfil.partidas >= 10) conquistas.push("🔥 Jogador frequente");
  if (perfil.vitorias >= 5) conquistas.push("🏆 Competidor");
  if (perfil.vitorias >= 20) conquistas.push("👑 Mestre do clique");

  if (conquistas.length === 0) {
    return `<p style="opacity:0.5;">Nenhuma conquista ainda</p>`;
  }

  return `
    <div class="perfil-conquistas">
      <h3>🏅 Conquistas</h3>
      ${conquistas.map(c => `<div class="badge">${c}</div>`).join("")}
    </div>
  `;
}

perfil.partidas++;
perfil.vitorias++; // só se ganhou

salvarPerfil();

function abrirDiretrizes() {
  abrirTela(`
    <div class="tela-box" style="overflow-y:auto; max-height:100vh;">
<div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
  <span onclick="fecharTela()" style="cursor:pointer; font-size:22px; padding:5px 10px; border-radius:8px; background:#1a2332;">
  ←
</span>
  <h2 style="margin:0;">📜 Diretrizes da Plataforma</h2>
</div>

      <p>
        A Click Arena é uma plataforma competitiva baseada em desempenho em tempo real.
        Nosso objetivo é garantir um ambiente justo, seguro e transparente para todos os jogadores.
      </p>

      <hr>

      <h3>🧠 1. Conduta do Usuário</h3>
      <p>
        Todos os usuários devem manter um comportamento respeitoso dentro da plataforma.
        Isso inclui evitar linguagem ofensiva, discriminação ou qualquer forma de abuso.
      </p>
      <p><strong>Exemplo:</strong> mensagens agressivas, xingamentos ou provocações excessivas podem resultar em penalidades.</p>

      <hr>

      <h3>⚖️ 2. Jogo Justo (Fair Play)</h3>
      <p>
        A competição deve ser baseada exclusivamente na habilidade do jogador.
        É proibido o uso de qualquer ferramenta que automatize ações.
      </p>
      <p><strong>Exemplo:</strong> uso de bots, autoclickers ou scripts para clicar automaticamente é considerado fraude.</p>

      <hr>

      <h3>🚫 3. Fraudes e Manipulação</h3>
      <p>
        Qualquer tentativa de manipular resultados, explorar falhas do sistema ou obter vantagem indevida é estritamente proibida.
      </p>
      <p><strong>Exemplo:</strong> tentar duplicar saldo, burlar o sistema de partidas ou interferir no funcionamento do jogo.</p>

      <hr>

      <h3>💰 4. Depósitos e Saques</h3>
      <p>
        Todas as transações financeiras são processadas por meios seguros e monitoradas.
        O saldo só será atualizado após confirmação do pagamento.
      </p>
      <p><strong>Exemplo:</strong> gerar um PIX não garante crédito imediato — o valor só entra após pagamento confirmado.</p>

      <hr>

      <h3>🔐 5. Segurança da Conta</h3>
      <p>
        O usuário é totalmente responsável pela segurança de sua conta.
        Não compartilhe seus dados de acesso com terceiros.
      </p>
      <p><strong>Exemplo:</strong> se outra pessoa acessar sua conta e usar seu saldo, a responsabilidade é do usuário.</p>

      <hr>

      <h3>📊 6. Resultados das Partidas</h3>
      <p>
        Os resultados são calculados automaticamente pelo sistema com base nos cliques realizados.
        Não há interferência manual.
      </p>
      <p><strong>Exemplo:</strong> em caso de empate ou inconsistência, o sistema define o resultado com base em critérios técnicos.</p>

      <hr>

      <h3>🚨 7. Penalidades</h3>
      <p>
        A Click Arena pode aplicar penalidades a qualquer momento em caso de violação das regras.
      </p>
      <ul>
        <li>Suspensão temporária</li>
        <li>Remoção de saldo</li>
        <li>Banimento permanente</li>
      </ul>

      <hr>

      <h3>📩 8. Reclamações e Suporte</h3>
      <p>
        Caso o usuário enfrente qualquer problema, poderá utilizar a área de reclamações.
        Todas as solicitações serão analisadas.
      </p>

      <hr>

      <h3>📌 9. Aceitação dos Termos</h3>
      <p>
        Ao utilizar a Click Arena, o usuário declara estar ciente e de acordo com todas as diretrizes descritas acima.
      </p>

      <br><br>

      <button onclick="fecharTela()">Voltar</button>
    </div>
  `);
}

function abrirReclamacoes() {
  abrirTela(`
    <div class="tela-box reclamacao-box">

      <h2>🚨 Reclamações</h2>

      <p class="reclamacao-sub">
        Teve algum problema? Nos conte o que aconteceu.
      </p>

      <textarea 
        id="inputReclamacao" 
        placeholder="Descreva seu problema com detalhes..."
      ></textarea>

      <button class="btn-primary" onclick="enviarReclamacao()">
        Enviar reclamação
      </button>

      <button class="btn-secondary" onclick="fecharTela()">
        Voltar
      </button>

      <div id="feedbackReclamacao"></div>

    </div>
  `);
}

function enviarReclamacao() {
  const textarea = document.getElementById("inputReclamacao");
  const feedback = document.getElementById("feedbackReclamacao");

  const texto = textarea.value;

  if (!texto || texto.length < 10) {
    feedback.innerHTML = `<p style="color:#ff6b6b;">Descreva melhor o problema</p>`;
    return;
  }

  // 🔥 ESCONDE O CAMPO (efeito profissional)
  textarea.style.display = "none";

  // 🔥 feedback bonito
  feedback.innerHTML = `
    <div style="
      background: #0f172a;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      margin-top: 10px;
      border: 1px solid #22c55e;
    ">
      <h3 style="color:#4ade80;">✔ Reclamação enviada</h3>
      <p style="opacity:0.7;">Nossa equipe irá analisar o caso.</p>
    </div>
  `;
}

function abrirConfiguracoes() {
  abrirTela(`
    <div class="tela-box">

      <h2>⚙️ Configurações</h2>

      ${toggle("Modo rápido", "modoRapido")}
      ${toggle("Sons", "sons")}
      ${toggle("Modo competitivo", "modoCompetitivo")}
      ${toggle("Animações", "animacoes")}

      <button class="btn-secondary" onclick="fecharTela()">Voltar</button>

    </div>
  `);
}

function getConfig(key) {
  return localStorage.getItem(key) !== "false";
}

function setConfig(key, value) {
  localStorage.setItem(key, value);
}

function toggle(label, key) {
  const ativo = getConfig(key);

  return `
    <div class="config-item">
      <span>${label}</span>
      <input type="checkbox" ${ativo ? "checked" : ""} 
        onchange="setConfig('${key}', this.checked)">
    </div>
  `;
}