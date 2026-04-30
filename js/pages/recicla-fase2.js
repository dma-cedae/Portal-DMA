const BR_NUMBER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 2
});

const BR_INTEGER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 0
});

const PREMIOS = [
  { premio_id: "broche", nome: "Broche", custo_pontos: 10, estoque_inicial: 80, ativo: true },
  { premio_id: "copo", nome: "Copo", custo_pontos: 20, estoque_inicial: 45, ativo: true },
  { premio_id: "mochila", nome: "Mochila", custo_pontos: 100, estoque_inicial: 12, ativo: true },
  { premio_id: "composto", nome: "Composto orgânico", custo_pontos: 0, estoque_inicial: 200, ativo: true }
];

const MATERIAIS_ACEITOS = [
  "Papel e papelão limpos e secos",
  "Garrafas e embalagens plásticas vazias",
  "Latas de alumínio",
  "Embalagens metálicas leves",
  "Frascos plásticos de produtos de limpeza vazios",
  "Materiais recicláveis secos compatíveis com a coleta do programa"
];

const MATERIAIS_NAO_ACEITOS = [
  "Resíduos orgânicos",
  "Papéis engordurados ou contaminados",
  "Materiais com resto de alimento",
  "Resíduos sanitários",
  "Itens contaminados por produtos químicos ou biológicos",
  "Materiais fora do escopo operacional do programa"
];

/*
  Este bloco substitui a antiga seção de educação ambiental.
  A área agora funciona como espaço de comunicação institucional
  e reserva para artes / folders do programa.
*/
const TEXTOS_COMUNICACAO = [
  {
    titulo: "Arte institucional em preparação",
    texto:
      "Este espaço será ocupado por peças visuais do Recicla CEDAE, com identidade própria para divulgação da Fase 2, materiais aceitos, orientações de participação e reforço da mobilização interna."
  },
  {
    titulo: "Campanha vinculada à meta institucional",
    texto:
      "A comunicação da nova fase será alinhada ao compromisso da companhia com a melhoria da gestão de resíduos e com o avanço em práticas aderentes à certificação Lixo Zero."
  },
  {
    titulo: "Mobilização contínua das equipes",
    texto:
      "Além dos resultados acumulados, a nova etapa reforça o papel da comunicação visual como apoio ao engajamento, à adesão das diretorias e à consolidação de hábitos institucionais mais sustentáveis."
  }
];

const state = {
  registros: [],
  kpis: {}
};

const els = {
  fase2DbStatus: document.getElementById("fase2DbStatus"),

  publicKpiSemanas: document.getElementById("publicKpiSemanas"),
  publicKpiParticipantes: document.getElementById("publicKpiParticipantes"),
  publicKpiPesoTotal: document.getElementById("publicKpiPesoTotal"),
  publicKpiDiretorias: document.getElementById("publicKpiDiretorias"),

  awardCatalog: document.getElementById("awardCatalog"),

  publicEducationGrid: document.getElementById("publicEducationGrid"),
  acceptedMaterialsList: document.getElementById("acceptedMaterialsList"),
  rejectedMaterialsList: document.getElementById("rejectedMaterialsList"),

  historicTop20Body: document.getElementById("historicTop20Body"),
  historicTop20Count: document.getElementById("historicTop20Count"),
  historicTop20Highlight: document.getElementById("historicTop20Highlight"),

  consultaForm: document.getElementById("consultaForm"),
  consultaId: document.getElementById("consultaId"),
  consultaResultado: document.getElementById("consultaResultado")
};

function formatNumber(value) {
  return BR_NUMBER.format(Number(value || 0));
}

function formatInteger(value) {
  return BR_INTEGER.format(Number(value || 0));
}

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function uniqueSorted(values) {
  return [...new Set(values.filter((v) => v !== null && v !== undefined && v !== ""))]
    .sort((a, b) => String(a).localeCompare(String(b), "pt-BR"));
}

function normalizeRegistro(item) {
  return {
    posicao: Number(item.posicao || 0),
    n_id: item.n_id ?? item.id ?? item.participante_id ?? null,
    nome: item.nome ?? "",
    diretoria: item.diretoria ?? "",
    somatorio: Number(item.somatorio || item.peso_total || item.total || 0),
    status_broche: item.status_broche ?? item.broche ?? "Nao informado",
    status_mochila: item.status_mochila ?? item.mochila ?? "Nao informado",
    quantidade_retirada_sacos_de_composto_organico: Number(
      item.quantidade_retirada_sacos_de_composto_organico || 0
    )
  };
}

function extractRecords(json) {
  if (!json) return [];

  if (Array.isArray(json)) return json;
  if (Array.isArray(json.registros)) return json.registros;
  if (Array.isArray(json.ranking_geral)) return json.ranking_geral;
  if (Array.isArray(json.participantes)) return json.participantes;
  if (Array.isArray(json.dados)) return json.dados;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.rows)) return json.rows;
  if (Array.isArray(json.top_20)) return json.top_20;
  if (Array.isArray(json.ranking_top_20)) return json.ranking_top_20;

  return [];
}

function extractKpis(json, registros) {
  if (json && json.kpis && typeof json.kpis === "object") {
    return json.kpis;
  }

  const totalParticipantes = registros.length;
  const totalDiretorias = uniqueSorted(registros.map((item) => item.diretoria)).length;
  const somatorioTotal = registros.reduce((acc, item) => acc + Number(item.somatorio || 0), 0);

  return {
    total_participantes: totalParticipantes,
    total_diretorias: totalDiretorias,
    somatorio_total: somatorioTotal
  };
}

function calculateSemanasPrograma(registros) {
  const datas = registros
    .map((item) => new Date(item.data))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a - b);

  if (!datas.length) return 0;

  const primeira = datas[0];
  const ultima = datas[datas.length - 1];
  const diffMs = ultima - primeira;
  const diffDias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return Math.max(1, Math.ceil((diffDias + 1) / 7));
}

function getParticipanteById(id) {
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;

  return state.registros.find((item) => String(item.n_id) === normalizedId) || null;
}

function getPremiosDisponiveis(somatorio) {
  const pontos = Number(somatorio || 0);

  return PREMIOS.filter((premio) => {
    if (!premio.ativo) return false;
    if (premio.premio_id === "composto") return pontos >= 10;
    return pontos >= Number(premio.custo_pontos || 0);
  });
}

function renderCommunicationSection() {
  if (els.publicEducationGrid) {
    els.publicEducationGrid.innerHTML = TEXTOS_COMUNICACAO.map(
      (item) => `
        <article class="education-card">
          <h3>${escapeHtml(item.titulo)}</h3>
          <p>${escapeHtml(item.texto)}</p>
        </article>
      `
    ).join("");
  }
}

function renderMaterialsSection() {
  if (els.acceptedMaterialsList) {
    els.acceptedMaterialsList.innerHTML = MATERIAIS_ACEITOS.map(
      (item) => `<li>${escapeHtml(item)}</li>`
    ).join("");
  }

  if (els.rejectedMaterialsList) {
    els.rejectedMaterialsList.innerHTML = MATERIAIS_NAO_ACEITOS.map(
      (item) => `<li>${escapeHtml(item)}</li>`
    ).join("");
  }
}

function renderAwardCatalog() {
  if (!els.awardCatalog) return;

  els.awardCatalog.innerHTML = PREMIOS
    .filter((premio) => premio.ativo)
    .map((premio) => `
      <article class="award-item">
        <span>${escapeHtml(premio.nome)}</span>
        <strong>${
          premio.premio_id === "composto"
            ? "10 kg = 1 pacote"
            : `${formatInteger(premio.custo_pontos)} pontos`
        }</strong>
        <p>
          ${
            premio.premio_id === "composto"
              ? "Benefício ambiental associado ao acúmulo de material reciclável, com retirada conforme regra operacional do programa."
              : "Reconhecimento vinculado à participação no programa, condicionado à pontuação acumulada e à disponibilidade de estoque."
          }
        </p>
        <div class="award-item__meta">
          <span class="award-pill">Estoque de referência: ${formatInteger(premio.estoque_inicial)}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderKpis() {
  const kpis = state.kpis;
  const semanasPrograma = calculateSemanasPrograma(state.registros);

  if (els.publicKpiSemanas) {
    els.publicKpiSemanas.textContent = formatInteger(semanasPrograma);
  }

  if (els.publicKpiParticipantes) {
    els.publicKpiParticipantes.textContent = formatInteger(
      kpis.total_participantes ?? state.registros.length
    );
  }

  if (els.publicKpiPesoTotal) {
    els.publicKpiPesoTotal.textContent = `${formatNumber(
      kpis.somatorio_total ?? 0
    )} kg`;
  }

  if (els.publicKpiDiretorias) {
    els.publicKpiDiretorias.textContent = formatInteger(
      kpis.total_diretorias ?? uniqueSorted(state.registros.map((item) => item.diretoria)).length
    );
  }
}

function renderHistoricTop20() {
  if (!els.historicTop20Body) return;

  if (!state.registros.length) {
    els.historicTop20Body.innerHTML = `
      <tr>
        <td colspan="4">Sem dados disponíveis no momento.</td>
      </tr>
    `;

    if (els.historicTop20Count) {
      els.historicTop20Count.textContent = "0 registros";
    }

    if (els.historicTop20Highlight) {
      els.historicTop20Highlight.textContent = "Classificação pública indisponível.";
    }

    return;
  }

  const ranking = [...state.registros]
    .sort((a, b) => Number(b.somatorio || 0) - Number(a.somatorio || 0))
    .slice(0, 20)
    .map((item, index) => ({
      ...item,
      posicao: index + 1
    }));

  els.historicTop20Body.innerHTML = ranking
    .map(
      (item) => `
        <tr>
          <td>${formatInteger(item.posicao)}</td>
          <td>${escapeHtml(`ID ${item.n_id}`)}</td>
          <td>${escapeHtml(item.diretoria || "-")}</td>
          <td>${formatNumber(item.somatorio || 0)}</td>
        </tr>
      `
    )
    .join("");

  if (els.historicTop20Count) {
    els.historicTop20Count.textContent = `${formatInteger(ranking.length)} registros`;
  }

  if (els.historicTop20Highlight) {
    const lider = ranking[0];
    els.historicTop20Highlight.textContent = lider
      ? `ID ${lider.n_id} ocupa a primeira colocação atual, com ${formatNumber(lider.somatorio)} kg acumulados.`
      : "Classificação pública indisponível.";
  }
}

function renderConsultaResultado(participante) {
  if (!els.consultaResultado) return;

  if (!participante) {
    els.consultaResultado.innerHTML = `
      <div class="empty-state">Nenhum participante localizado para o ID informado.</div>
    `;
    return;
  }

  const premiosDisponiveis = getPremiosDisponiveis(participante.somatorio);

  els.consultaResultado.innerHTML = `
    <div class="result-card">
      <h3>Consulta do participante · ID ${escapeHtml(participante.n_id)}</h3>

      <div class="result-grid">
        <div class="result-box">
          <span>Diretoria</span>
          <strong>${escapeHtml(participante.diretoria || "-")}</strong>
        </div>

        <div class="result-box">
          <span>Total acumulado</span>
          <strong>${formatNumber(participante.somatorio || 0)} kg</strong>
        </div>

        <div class="result-box">
          <span>Status do broche</span>
          <strong>${escapeHtml(participante.status_broche || "Não informado")}</strong>
        </div>

        <div class="result-box">
          <span>Status da mochila</span>
          <strong>${escapeHtml(participante.status_mochila || "Não informado")}</strong>
        </div>

        <div class="result-box">
          <span>Composto retirado</span>
          <strong>${formatInteger(
            participante.quantidade_retirada_sacos_de_composto_organico || 0
          )}</strong>
        </div>

        <div class="result-box">
          <span>Prêmios disponíveis</span>
          <strong>${
            premiosDisponiveis.length
              ? escapeHtml(premiosDisponiveis.map((item) => item.nome).join(", "))
              : "Nenhum no momento"
          }</strong>
        </div>
      </div>
    </div>
  `;
}

function bindConsulta() {
  if (!els.consultaForm) return;

  els.consultaForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const id = String(els.consultaId?.value || "").trim();
    const participante = getParticipanteById(id);

    renderConsultaResultado(participante);
  });
}

function renderAll() {
  renderKpis();
  renderAwardCatalog();
  renderCommunicationSection();
  renderMaterialsSection();
  renderHistoricTop20();
}

async function loadData() {
  if (els.fase2DbStatus) {
    els.fase2DbStatus.textContent = "Lendo base pública do Recicla CEDAE...";
  }

  const response = await fetch("./data/recicla-pagina.json", {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Não foi possível carregar data/recicla-pagina.json");
  }

  const json = await response.json();
  const rawRecords = extractRecords(json);

  state.registros = rawRecords.map(normalizeRegistro);
  state.kpis = extractKpis(json, state.registros);

  renderAll();

  if (els.fase2DbStatus) {
    els.fase2DbStatus.textContent =
      `Base pública carregada com ${formatInteger(state.registros.length)} participantes.`;
  }
}

async function bootstrap() {
  try {
    bindConsulta();
    await loadData();
  } catch (error) {
    console.error(error);

    if (els.fase2DbStatus) {
      els.fase2DbStatus.textContent = "Erro ao carregar a página pública do Recicla CEDAE.";
    }
  }
}

bootstrap();