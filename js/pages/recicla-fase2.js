/**
 * ==========================================================================
 * RECICLA CEDAE FASE 2 - MÓDULO SCRIPT PRINCIPAL (FRONT-END)
 * CRS 2026 · Renderização de Dashboard Reativo & Integração via API
 * ==========================================================================
 */

import { ReciclaAPI } from "../modules/recicla/recicla-api.js";

// ─── ESTADO GLOBAL DA APLICAÇÃO ─────────────────────────────────────────────
const state = {
  kpis: { total_participantes: 0, somatorio_total: 0 },
  dadosDiretorias: [],
  dadosReciclados: [],
  charts: {}
};

// Meta anual de referência para o gráfico de progresso (kg).
// Ajuste este valor conforme a meta oficial definida pela CRS.
const META_ANUAL_KG = 5000;

// Paleta baseada no padrão de cores da coleta seletiva (CONAMA):
// azul = papel, verde = vidro, amarelo = metal, marrom = orgânico.
const CORES_GRAFICO = ["#0B4C8C", "#2F7D4F", "#D99A2B", "#7C5233", "#3E7FC1", "#A9743B"];

// ─── CATEGORIAS DE COLETA (conteúdo educativo, substitui o antigo catálogo de brindes) ──
const CATEGORIAS_COLETA = [
  { nome: "Papel & Papelão", cor: "#0B4C8C", icone: "fa-box-archive", desc: "Caixas, jornais e folhas de rascunho limpas e secas." },
  { nome: "Vidro", cor: "#2F7D4F", icone: "fa-wine-bottle", desc: "Garrafas e potes, preferencialmente sem tampa e enxaguados." },
  { nome: "Metal", cor: "#D99A2B", icone: "fa-jar", desc: "Latas de alumínio e aço, tampas e clipes metálicos." },
  { nome: "Orgânico", cor: "#7C5233", icone: "fa-seedling", desc: "Restos de alimentos e borra de café para compostagem." }
];

// ─── MAPEAMENTO DE ELEMENTOS DO DOM ─────────────────────────────────────────
const els = {
  kpiParticipantes: document.getElementById("kpi-participantes"),
  kpiTotalPeso: document.getElementById("kpi-total-peso"),
  fase2DbStatus: document.getElementById("fase2-db-status"),
  consultaForm: document.getElementById("form-consulta-recicla"),
  consultaId: document.getElementById("input-id-recicla"),
  consultaResultado: document.getElementById("resultado-consulta-recicla"),
  rankingCorpo: document.getElementById("corpo-ranking-diretorias"),
  categoriasColeta: document.getElementById("container-categorias-coleta")
};

// ─── INICIALIZADOR PRINCIPAL ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  bindConsulta();
});

/**
 * Busca a carga consolidada do banco e dispara a interface
 */
async function loadData() {
  try {
    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Conectando ao Banco Central...`;
    }

    const [dados, ranking, historico] = await Promise.all([
      ReciclaAPI.getDadosDashboard(),
      ReciclaAPI.getRankingDiretorias(),
      ReciclaAPI.getHistoricoPesagens()
    ]);

    console.log("Resposta da API:", { dados, ranking, historico });

    state.kpis = {
      total_participantes: dados.participantes || 0,
      total_pesagens: dados.pesagens || 0,
      somatorio_total: dados.pesoTotal || 0,
      ultimaAtualizacao: dados.ultimaAtualizacao || null
    };

    state.dadosDiretorias = Array.isArray(ranking) ? ranking : [];
    state.dadosReciclados = Array.isArray(historico) ? historico : [];

    renderKpis();
    renderCategoriasColeta();
    renderRankingTable();
    renderCharts();

    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Banco conectado`;
    }
  } catch (err) {
    console.error("Erro ao inicializar dashboard:", err);
    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${err.message}`;
    }
  }
}

// ─── RENDERIZADORES DE COMPONENTES ──────────────────────────────────────────

function renderKpis() {
  if (els.kpiParticipantes) {
    els.kpiParticipantes.innerText = formatInteger(state.kpis.total_participantes);
  }
  if (els.kpiTotalPeso) {
    els.kpiTotalPeso.innerText = `${formatFloat(state.kpis.somatorio_total)} kg`;
  }
}

function renderCategoriasColeta() {
  if (!els.categoriasColeta) return;
  els.categoriasColeta.innerHTML = CATEGORIAS_COLETA.map(c => `
    <div class="card-categoria">
      <div class="card-categoria__ponto" style="background:${c.cor};">
        <i class="fa-solid ${c.icone}"></i>
      </div>
      <div class="card-categoria__texto">
        <h4>${c.nome}</h4>
        <p>${c.desc}</p>
      </div>
    </div>
  `).join("");
}

function renderRankingTable() {
  if (!els.rankingCorpo) return;

  if (state.dadosDiretorias.length === 0) {
    els.rankingCorpo.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#6B6255; font-size:0.85rem; padding: 20px;">Nenhuma pesagem computada neste ciclo.</td></tr>`;
    return;
  }

  els.rankingCorpo.innerHTML = state.dadosDiretorias.map((d, index) => {
    const medalhas = ["🥇", "🥈", "🥉"];
    const rankVis = index < 3 ? `<span style="font-size:1.1rem;">${medalhas[index]}</span>` : `${index + 1}º`;

    return `
      <tr>
        <td style="text-align: center; font-weight: bold;">${rankVis}</td>
        <td style="font-weight: 600;">${escapeHtml(d.diretoria)}</td>
        <td style="text-align: center;">${formatInteger(d.totalParticipantes)}</td>
        <td style="text-align: right; font-weight: bold; color: var(--verde-vidro);">${formatFloat(d.pesoTotal)} kg</td>
      </tr>
    `;
  }).join("");
}

// ─── RENDERIZADOR DE GRÁFICOS (APEXCHARTS) ──────────────────────────────────
function renderCharts() {
  // Destrói instâncias antigas se existirem para evitar vazamento de memória
  ["diretoria", "historico", "meta"].forEach(key => {
    if (state.charts[key] && typeof state.charts[key].destroy === "function") {
      state.charts[key].destroy();
    }
  });

  const elChartDir = document.getElementById("chart-recicla-diretorias");
  const elChartHist = document.getElementById("chart-recicla-historico");
  const elChartMeta = document.getElementById("chart-recicla-meta");

  const fontFamily = "'Inter', sans-serif";

  // 1. Gráfico de Rosca — Distribuição por Diretoria
  if (elChartDir && state.dadosDiretorias.length > 0) {
    const optionsDir = {
      series: state.dadosDiretorias.map(d => d.pesoTotal),
      labels: state.dadosDiretorias.map(d => d.diretoria),
      chart: { type: "donut", height: 260, background: "transparent", fontFamily },
      colors: CORES_GRAFICO,
      legend: { position: "bottom", labels: { colors: "#6B6255" }, fontSize: "12px" },
      dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
      stroke: { colors: ["#FFFFFF"] },
      plotOptions: {
        pie: { donut: { labels: { show: true, total: { show: true, label: "Total", color: "#6B6255", formatter: () => `${formatFloat(state.kpis.somatorio_total)} kg` } } } }
      }
    };
    state.charts.diretoria = new ApexCharts(elChartDir, optionsDir);
    state.charts.diretoria.render();
  }

  // 2. Gráfico de Área — Evolução Cronológica das Coletas
  if (elChartHist && state.dadosReciclados.length > 0) {
    const optionsHist = {
      series: [{ name: "Massa Coletada", data: state.dadosReciclados.map(r => r.Quantidade) }],
      chart: { type: "area", height: 260, toolbar: { show: false }, background: "transparent", fontFamily },
      colors: ["#0B4C8C"],
      dataLabels: { enabled: false },
      stroke: { curve: "smooth", width: 3 },
      fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05 } },
      xaxis: {
        categories: state.dadosReciclados.map(r => {
          if (!r.Data) return "";
          const partes = r.Data.split("-");
          return partes.length === 3 ? `${partes[2]}/${partes[1]}` : r.Data;
        }),
        labels: { style: { colors: "#6B6255" } }
      },
      yaxis: { labels: { style: { colors: "#6B6255" }, formatter: (val) => `${val.toFixed(0)} kg` } },
      grid: { borderColor: "#E4DDCC" },
      tooltip: { theme: "light" }
    };
    state.charts.historico = new ApexCharts(elChartHist, optionsHist);
    state.charts.historico.render();
  }

  // 3. Gráfico Radial — Progresso frente à Meta Anual
  if (elChartMeta) {
    const percentual = META_ANUAL_KG > 0
      ? Math.min(100, (state.kpis.somatorio_total / META_ANUAL_KG) * 100)
      : 0;

    const optionsMeta = {
      series: [Number(percentual.toFixed(1))],
      chart: { type: "radialBar", height: 260, background: "transparent", fontFamily },
      colors: ["#2F7D4F"],
      plotOptions: {
        radialBar: {
          hollow: { size: "62%" },
          dataLabels: {
            name: { fontSize: "12px", color: "#6B6255", offsetY: -6 },
            value: {
              fontSize: "22px",
              fontWeight: 700,
              color: "#262117",
              formatter: (val) => `${val}%`
            }
          }
        }
      },
      labels: [`Meta de ${formatInteger(META_ANUAL_KG)} kg`]
    };
    state.charts.meta = new ApexCharts(elChartMeta, optionsMeta);
    state.charts.meta.render();
  }
}

// ─── GERENCIADOR EVENTO DA CONSULTA INDIVIDUAL ──────────────────────────────
function bindConsulta() {
  if (!els.consultaForm) return;

  els.consultaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = String(els.consultaId?.value || "").trim();
    if (!id || !els.consultaResultado) return;

    els.consultaResultado.innerHTML = `
      <div style="text-align:center; color: #6B6255; font-size: 0.8rem; padding: 10px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Consultando base de homologação...
      </div>`;

    const part = await ReciclaAPI.consultarParticipante(id);

    if (!part) {
      els.consultaResultado.innerHTML = `
        <div style="background: rgba(180,58,42,0.08); border: 1px solid #B43A2A; border-radius: 8px; padding: 14px; color: #B43A2A; font-size: 0.8rem; text-align: center; line-height: 1.4;">
          <i class="fa-solid fa-circle-xmark" style="font-size: 1.1rem; margin-bottom: 5px; display:block;"></i>
          <strong>ID [${escapeHtml(id)}] não localizado!</strong><br>
          Verifique o número digitado ou contate o suporte da CRS.
        </div>`;
      return;
    }

    els.consultaResultado.innerHTML = `
      <div style="background: #fff; border: 1px solid #2F7D4F; border-radius: 8px; padding: 14px; color: #262117; box-shadow: 0 4px 12px rgba(0,0,0,0.08); animation: fadeIn 0.3s ease;">
        <strong style="font-size: 0.95rem; color: #2F7D4F; display:block; margin-bottom:8px; border-bottom:1px solid #E4DDCC; padding-bottom:4px;">
          <i class="fa-solid fa-user-check"></i> ${escapeHtml(part.nome)}
        </strong>
        <p style="margin: 4px 0; font-size: 0.8rem;"><strong>ID Interno:</strong> ${escapeHtml(part.id)}</p>
        <p style="margin: 4px 0; font-size: 0.8rem;"><strong>Lotação:</strong> ${escapeHtml(part.diretoria)}</p>
        <div style="margin-top: 12px; background: #F5F1E7; padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; color: #6B6255;">Volume Acumulado:</span>
          <strong style="font-size: 1.25rem; color: #2F7D4F;">${formatFloat(part.somatorio)} kg</strong>
        </div>
      </div>`;
  });
}

// ─── UTILS DE FORMATAÇÃO E SANITIZAÇÃO ──────────────────────────────────────
function formatFloat(val) {
  return typeof val === "number" ? val.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) : "0,0";
}

function formatInteger(val) {
  return typeof val === "number" ? val.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "0";
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}