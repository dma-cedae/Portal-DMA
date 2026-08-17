/**
 * ==========================================================================
 * js/modules/recicla/recicla-fase2.js
 * ==========================================================================
 */

import { ReciclaAPI } from "../modules/recicla/recicla-api.js";

// ─── ESTADO GLOBAL DA APLICAÇÃO ─────────────────────────────────────────────
const state = {
  kpis: {
    consolidado: { participantes: 0, pesagens: 0, pesoTotal: 0 },
    porLocal: {}
  },
  dadosDiretorias: [],
  dadosReciclados: [],
  charts: {}
};

// Meta anual de referência para o gráfico de progresso (kg).
const META_ANUAL_KG = 5000;

// Paleta baseada no padrão de cores da coleta seletiva (CONAMA)
const CORES_GRAFICO = ["#0B4C8C", "#2F7D4F", "#D99A2B", "#7C5233", "#3E7FC1", "#A9743B"];

// ─── CATEGORIAS DE COLETA ────────────────────────────────────────────────
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
  kpiSedePeso: document.getElementById("kpi-sede-peso"),
  kpiSedePart: document.getElementById("kpi-sede-part"),
  kpiLaranjalPeso: document.getElementById("kpi-laranjal-peso"),
  kpiLaranjalPart: document.getElementById("kpi-laranjal-part"),
  fase2DbStatus: document.getElementById("fase2-db-status"),
  consultaForm: document.getElementById("form-consulta-recicla"),
  consultaId: document.getElementById("input-id-recicla"),
  consultaLocal: document.getElementById("input-local-recicla"),
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

    const [dadosDashboard, ranking, historico] = await Promise.all([
      ReciclaAPI.getDadosDashboard(),
      ReciclaAPI.getRankingDiretorias(),
      ReciclaAPI.getHistoricoPesagens()
    ]);

    state.kpis = {
      consolidado: dadosDashboard.consolidado || { participantes: 0, pesagens: 0, pesoTotal: 0 },
      porLocal: dadosDashboard.porLocal || {}
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
  // Consolidado Geral
  if (els.kpiTotalPeso) {
    els.kpiTotalPeso.innerText = `${formatFloat(state.kpis.consolidado.pesoTotal)} kg`;
  }
  if (els.kpiParticipantes) {
    els.kpiParticipantes.innerText = `${formatInteger(state.kpis.consolidado.participantes)} participantes`;
  }

  // Prédio Sede
  const sede = state.kpis.porLocal.sede || { pesoTotal: 0, participantes: 0 };
  if (els.kpiSedePeso) {
    els.kpiSedePeso.innerText = `${formatFloat(sede.pesoTotal)} kg`;
  }
  if (els.kpiSedePart) {
    els.kpiSedePart.innerText = `${formatInteger(sede.participantes)} participantes`;
  }

  // Laranjal
  const laranjal = state.kpis.porLocal.laranjal || { pesoTotal: 0, participantes: 0 };
  if (els.kpiLaranjalPeso) {
    els.kpiLaranjalPeso.innerText = `${formatFloat(laranjal.pesoTotal)} kg`;
  }
  if (els.kpiLaranjalPart) {
    els.kpiLaranjalPart.innerText = `${formatInteger(laranjal.participantes)} participantes`;
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
    const localBadge = d.local ? `<span style="font-size: 0.75rem; background: #E4DDCC; padding: 2px 6px; border-radius: 4px; margin-left: 6px; color: #554C3F;">${escapeHtml(d.local)}</span>` : "";

    return `
      <tr>
        <td style="text-align: center; font-weight: bold;">${rankVis}</td>
        <td style="font-weight: 600;">${escapeHtml(d.diretoria)} ${localBadge}</td>
        <td style="text-align: center;">${formatInteger(d.totalParticipantes)}</td>
        <td style="text-align: right; font-weight: bold; color: var(--verde-vidro);">${formatFloat(d.pesoTotal)} kg</td>
      </tr>
    `;
  }).join("");
}

// ─── RENDERIZADOR DE GRÁFICOS (APEXCHARTS - 3 GRÁFICOS DE DISTRIBUIÇÃO) ───────

/**
 * Monta a configuração padrão de um donut chart, já tratando os problemas
 * de sobreposição de rótulos (%) e legenda espremida:
 *  - rótulos de % só aparecem em fatias com peso visual suficiente (>=4%);
 *    fatias menores mostram o valor apenas na legenda, evitando texto cortado.
 *  - legenda com espaçamento fixo entre itens e marcador redondo, mostrando
 *    também o valor em kg ao lado do nome (não só a cor).
 *  - traço branco entre fatias para separar visualmente cores parecidas.
 */
function buildDonutOptions({ series, labels, totalLabel, totalValueFormatter }) {
  const total = series.reduce((acc, v) => acc + v, 0);

  const options = {
    series,
    labels,
    chart: {
      type: "donut",
      height: 300,
      background: "transparent",
      fontFamily: "'Inter', sans-serif"
    },
    colors: CORES_GRAFICO,
    stroke: {
      width: 2,
      colors: ["#FFFFFF"]
    },
    dataLabels: {
      enabled: true,
      formatter: (val) => (val >= 4 ? `${val.toFixed(1)}%` : ""),
      style: {
        fontSize: "12px",
        fontWeight: 600,
        colors: ["#FFFFFF"]
      },
      dropShadow: { enabled: false }
    },
    legend: {
      position: "bottom",
      horizontalAlign: "center",
      fontSize: "12px",
      labels: { colors: "#6B6255" },
      markers: { width: 10, height: 10, radius: 10 },
      itemMargin: { horizontal: 10, vertical: 5 },
      formatter: (seriesName, opts) => {
        const idx = opts.seriesIndex;
        const val = opts.w.globals.series[idx];
        return `${seriesName} — ${formatFloat(val)} kg`;
      }
    },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: totalLabel || "Total",
              color: "#6B6255",
              fontSize: "13px",
              formatter: totalValueFormatter || (() => `${formatFloat(total)} kg`)
            },
            value: {
              fontSize: "18px",
              fontWeight: 700,
              color: "#262117"
            }
          }
        }
      }
    },
    tooltip: {
      y: { formatter: (val) => `${formatFloat(val)} kg` }
    },
    responsive: [{
      breakpoint: 480,
      options: {
        chart: { height: 260 },
        legend: { fontSize: "11px" }
      }
    }]
  };

  return options;
}

function renderCharts() {
  ["sede", "laranjal", "geral"].forEach(key => {
    if (state.charts[key] && typeof state.charts[key].destroy === "function") {
      state.charts[key].destroy();
    }
  });

  const elSede = document.getElementById("chart-recicla-sede");
  const elLaranjal = document.getElementById("chart-recicla-laranjal");
  const elGeral = document.getElementById("chart-recicla-geral");

  // Filtros de dados por local
  const dadosSede = state.dadosDiretorias.filter(d => d.local && d.local.toLowerCase() === "sede");
  const dadosLaranjal = state.dadosDiretorias.filter(d => d.local && d.local.toLowerCase() === "laranjal");

  // 1. Gráfico Sede
  if (elSede && dadosSede.length > 0) {
    state.charts.sede = new ApexCharts(elSede, buildDonutOptions({
      series: dadosSede.map(d => d.pesoTotal),
      labels: dadosSede.map(d => d.diretoria),
      totalLabel: "Sede",
      totalValueFormatter: () => `${formatFloat(state.kpis.porLocal.sede?.pesoTotal || 0)} kg`
    }));
    state.charts.sede.render();
  } else if (elSede) {
    elSede.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados na Sede</p>`;
  }

  // 2. Gráfico Laranjal
  if (elLaranjal && dadosLaranjal.length > 0) {
    state.charts.laranjal = new ApexCharts(elLaranjal, buildDonutOptions({
      series: dadosLaranjal.map(d => d.pesoTotal),
      labels: dadosLaranjal.map(d => d.diretoria),
      totalLabel: "Laranjal",
      totalValueFormatter: () => `${formatFloat(state.kpis.porLocal.laranjal?.pesoTotal || 0)} kg`
    }));
    state.charts.laranjal.render();
  } else if (elLaranjal) {
    elLaranjal.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados no Laranjal</p>`;
  }

  // 3. Gráfico Consolidado Geral
  if (elGeral && state.dadosDiretorias.length > 0) {
    state.charts.geral = new ApexCharts(elGeral, buildDonutOptions({
      series: state.dadosDiretorias.map(d => d.pesoTotal),
      labels: state.dadosDiretorias.map(d => `${d.diretoria} (${d.local || 'geral'})`),
      totalLabel: "Total",
      totalValueFormatter: () => `${formatFloat(state.kpis.consolidado.pesoTotal)} kg`
    }));
    state.charts.geral.render();
  } else if (elGeral) {
    elGeral.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados consolidados</p>`;
  }
}

// ─── GERENCIADOR EVENTO DA CONSULTA INDIVIDUAL ──────────────────────────────
function bindConsulta() {
  if (!els.consultaForm) return;

  els.consultaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = String(els.consultaId?.value || "").trim();
    const local = String(els.consultaLocal?.value || "").trim();

    if (!id || !local || !els.consultaResultado) {
      if (els.consultaResultado) {
        els.consultaResultado.innerHTML = `
          <div style="background: rgba(180,58,42,0.08); border: 1px solid #B43A2A; border-radius: 8px; padding: 10px; color: #B43A2A; font-size: 0.8rem; text-align: center;">
            Informe o ID e selecione o local da consulta.
          </div>`;
      }
      return;
    }

    els.consultaResultado.innerHTML = `
      <div style="text-align:center; color: #6B6255; font-size: 0.8rem; padding: 10px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Consultando base...
      </div>`;

    const part = await ReciclaAPI.consultarParticipante(id, local);

    if (!part) {
      els.consultaResultado.innerHTML = `
        <div style="background: rgba(180,58,42,0.08); border: 1px solid #B43A2A; border-radius: 8px; padding: 14px; color: #B43A2A; font-size: 0.8rem; text-align: center; line-height: 1.4;">
          <i class="fa-solid fa-circle-xmark" style="font-size: 1.1rem; margin-bottom: 5px; display:block;"></i>
          <strong>Participante ID [${escapeHtml(id)}] em [${escapeHtml(local)}] não localizado!</strong><br>
          Verifique os dados informados.
        </div>`;
      return;
    }

    els.consultaResultado.innerHTML = `
      <div style="background: #fff; border: 1px solid #2F7D4F; border-radius: 8px; padding: 14px; color: #262117; box-shadow: 0 4px 12px rgba(0,0,0,0.08); animation: fadeIn 0.3s ease;">
        <strong style="font-size: 0.95rem; color: #2F7D4F; display:block; margin-bottom:8px; border-bottom:1px solid #E4DDCC; padding-bottom:4px;">
          <i class="fa-solid fa-user-check"></i> ${escapeHtml(part.nome)}
        </strong>
        <p style="margin: 4px 0; font-size: 0.8rem;"><strong>ID:</strong> ${escapeHtml(part.id)} | <strong>Local:</strong> ${escapeHtml(part.local)}</p>
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
