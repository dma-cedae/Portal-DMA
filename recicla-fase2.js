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

// Paleta multicolorida para os gráficos individuais
const CORES_GRAFICO = ["#1076db", "#11bd59", "#ffaf25", "#d3e01d", "#4e98e2", "#ee2737"];

// Cores específicas para o Consolidado
const COR_SEDE_CONSOLIDADO = "#51c751"; // cedae verde gay 
const COR_LARANJAL_CONSOLIDADO = "#0091d8"; // cedae azul gay 

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

    state.dadosDiretorias = Array.isArray(ranking) ? agruparDadosDiretorias(ranking) : [];
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

/**
 * Agrupa registros duplicados pela combinação de 'diretoria' + 'local'
 */
function agruparDadosDiretorias(dados) {
  const mapa = new Map();

  dados.forEach(item => {
    if (!item.diretoria) return;

    const diretoria = String(item.diretoria).trim();
    const local = String(item.local || "geral").trim();
    const chave = `${diretoria.toLowerCase()}_${local.toLowerCase()}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        diretoria,
        local,
        totalParticipantes: Number(item.totalParticipantes) || 0,
        pesoTotal: Number(item.pesoTotal) || 0
      });
    } else {
      const atual = mapa.get(chave);
      atual.totalParticipantes += Number(item.totalParticipantes) || 0;
      atual.pesoTotal += Number(item.pesoTotal) || 0;
    }
  });

  return Array.from(mapa.values()).sort((a, b) => b.pesoTotal - a.pesoTotal);
}

// ─── RENDERIZADORES DE COMPONENTES ──────────────────────────────────────────

function renderKpis() {
  if (els.kpiTotalPeso) {
    els.kpiTotalPeso.innerText = `${formatFloat(state.kpis.consolidado.pesoTotal)} kg`;
  }
  if (els.kpiParticipantes) {
    els.kpiParticipantes.innerText = `${formatInteger(state.kpis.consolidado.participantes)} participantes`;
  }

  const sede = state.kpis.porLocal.sede || { pesoTotal: 0, participantes: 0 };
  if (els.kpiSedePeso) {
    els.kpiSedePeso.innerText = `${formatFloat(sede.pesoTotal)} kg`;
  }
  if (els.kpiSedePart) {
    els.kpiSedePart.innerText = `${formatInteger(sede.participantes)} participantes`;
  }

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
        <td style="text-align: right; font-weight: bold; color: var(--verde-vidro, #2F7D4F);">${formatFloat(d.pesoTotal)} kg</td>
      </tr>
    `;
  }).join("");
}

// ─── RENDERIZADOR DE GRÁFICOS (APEXCHARTS) ───────────────────────────────────

/**
 * Configuração para gráficos individuais com paleta multicolorida por barra
 */
function buildBarOptionsIndividual({ seriesData, categories, height = 360 }) {
  return {
    series: [{
      name: "Volume Reciclado",
      data: seriesData
    }],
    chart: {
      type: "bar",
      height: height,
      toolbar: {
        show: true,
        tools: { download: false, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
      },
      background: "transparent",
      fontFamily: "'Inter', sans-serif"
    },
    colors: CORES_GRAFICO, // Cores variadas para cada barra
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "45%",
        borderRadius: 6,
        distributed: true, // Distribui as cores da lista nas barras
        dataLabels: { position: "top" }
      }
    },
    dataLabels: {
      enabled: true,
      textAnchor: "start",
      formatter: (val) => `${formatFloat(val)} kg`,
      offsetY: -12,
      style: {
        fontSize: "10px",
        fontWeight: 600,
        colors: ["#262117"]
      }
    },
    legend: { show: false },
    xaxis: {
      categories: categories,
      labels: {
        rotate: -45,
        rotateAlways: true,
        style: { colors: "#6B6255", fontSize: "11px", fontWeight: 600 }
      },
      axisBorder: { show: false },
      axisTicks: { show: false }
    },
    yaxis: {
      labels: { formatter: (val) => formatFloat(val) },
      title: { text: "Peso (kg)", style: { color: "#6B6255", fontSize: "11px", fontWeight: 500 } }
    },
    grid: { borderColor: "#E4DDCC", strokeDashArray: 4 },
    tooltip: { y: { formatter: (val) => `${formatFloat(val)} kg` } }
  };
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

  const dadosSede = state.dadosDiretorias.filter(d => d.local && d.local.toLowerCase() === "sede");
  const dadosLaranjal = state.dadosDiretorias.filter(d => d.local && d.local.toLowerCase() === "laranjal");

  // 1. Gráfico Sede (Multicolorido)
  if (elSede && dadosSede.length > 0) {
    state.charts.sede = new ApexCharts(elSede, buildBarOptionsIndividual({
      seriesData: dadosSede.map(d => d.pesoTotal),
      categories: dadosSede.map(d => d.diretoria)
    }));
    state.charts.sede.render();
  } else if (elSede) {
    elSede.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados na Sede</p>`;
  }

  // 2. Gráfico Laranjal (Multicolorido)
  if (elLaranjal && dadosLaranjal.length > 0) {
    state.charts.laranjal = new ApexCharts(elLaranjal, buildBarOptionsIndividual({
      seriesData: dadosLaranjal.map(d => d.pesoTotal),
      categories: dadosLaranjal.map(d => d.diretoria)
    }));
    state.charts.laranjal.render();
  } else if (elLaranjal) {
    elLaranjal.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados no Laranjal</p>`;
  }

  // 3. Gráfico Consolidado Geral (Prédio Sede: Roxo | Laranjal: Laranja Forte)
  if (elGeral && state.dadosDiretorias.length > 0) {
    const todasDiretorias = [...new Set(state.dadosDiretorias.map(d => d.diretoria))];

    // Ordenar diretorias pelo peso total acumulado
    todasDiretorias.sort((a, b) => {
      const pesoA = state.dadosDiretorias.filter(d => d.diretoria === a).reduce((acc, curr) => acc + curr.pesoTotal, 0);
      const pesoB = state.dadosDiretorias.filter(d => d.diretoria === b).reduce((acc, curr) => acc + curr.pesoTotal, 0);
      return pesoB - pesoA;
    });

    const dadosSedeGeral = todasDiretorias.map(dir => {
      const item = state.dadosDiretorias.find(d => d.diretoria === dir && d.local.toLowerCase() === "sede");
      return item ? item.pesoTotal : 0;
    });

    const dadosLaranjalGeral = todasDiretorias.map(dir => {
      const item = state.dadosDiretorias.find(d => d.diretoria === dir && d.local.toLowerCase() === "laranjal");
      return item ? item.pesoTotal : 0;
    });

    state.charts.geral = new ApexCharts(elGeral, {
      series: [
        { name: "Prédio Sede", data: dadosSedeGeral },
        { name: "Laranjal", data: dadosLaranjalGeral }
      ],
      chart: {
        type: "bar",
        height: 420,
        toolbar: {
          show: true,
          tools: { download: false, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
        },
        background: "transparent",
        fontFamily: "'Inter', sans-serif"
      },
      colors: [COR_SEDE_CONSOLIDADO, COR_LARANJAL_CONSOLIDADO], // Roxo e Laranja
      plotOptions: {
        bar: {
          horizontal: false,
          columnWidth: "60%",
          borderRadius: 4,
          dataLabels: { position: "top" }
        }
      },
      dataLabels: {
        enabled: true,
        textAnchor: "start",
        formatter: (val) => (val > 0 ? `${formatFloat(val)} kg` : ""), // Omite rótulos zerados
        offsetY: -15,
        style: {
          fontSize: "9px",
          fontWeight: 600,
          colors: ["#262117"]
        }
      },
      legend: {
        show: true,
        position: "bottom",
        horizontalAlign: "center",
        fontSize: "12px",
        labels: { colors: "#6B6255" },
        markers: { width: 12, height: 12, radius: 12 },
        itemMargin: { horizontal: 15, vertical: 5 }
      },
      xaxis: {
        categories: todasDiretorias,
        labels: {
          rotate: -45,
          rotateAlways: true,
          style: { colors: "#6B6255", fontSize: "11px", fontWeight: 600 }
        },
        axisBorder: { show: false },
        axisTicks: { show: false }
      },
      yaxis: {
        labels: { formatter: (val) => formatFloat(val) },
        title: { text: "Peso (kg)", style: { color: "#6B6255", fontSize: "11px", fontWeight: 500 } }
      },
      grid: { borderColor: "#E4DDCC", strokeDashArray: 4 },
      tooltip: { y: { formatter: (val) => `${formatFloat(val)} kg` } }
    });
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