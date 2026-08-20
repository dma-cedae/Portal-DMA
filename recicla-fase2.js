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

// Paleta multicolorida para os gráficos individuais
const CORES_GRAFICO = ["#0e32a7", "#158f05", "#ffdb3c", "#8b5731", "#3a9cff", "#f52929"];

// Cores específicas para o Consolidado
const COR_SEDE_CONSOLIDADO = "#0059ff"; // Azul Sede
const COR_LARANJAL_CONSOLIDADO = "#f88b0e"; // Laranja Laranjal

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

function renderRankingTable() {
  if (!els.rankingCorpo) return;

  if (state.dadosDiretorias.length === 0) {
    els.rankingCorpo.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#888;">Nenhum registro encontrado</td></tr>`;
    return;
  }

  els.rankingCorpo.innerHTML = state.dadosDiretorias.map((item, index) => `
    <tr>
      <td><strong>#${index + 1}</strong></td>
      <td>${escapeHtml(item.diretoria)}</td>
      <td><span class="badge badge-${item.local.toLowerCase()}">${escapeHtml(item.local.toUpperCase())}</span></td>
      <td style="text-align:right;"><strong>${formatFloat(item.pesoTotal)} kg</strong></td>
    </tr>
  `).join("");
}

function renderCategoriasColeta() {
  if (!els.categoriasColeta) return;

  // Agrupa resíduos por tipo a partir do histórico de pesagens
  const totaisPorCategoria = state.dadosReciclados.reduce((acc, item) => {
    const cat = item.categoria || item.tipoResiduo || "Geral";
    acc[cat] = (acc[cat] || 0) + (Number(item.peso) || 0);
    return acc;
  }, {});

  const categorias = Object.keys(totaisPorCategoria);
  if (categorias.length === 0) {
    els.categoriasColeta.innerHTML = `<p style="color:#888; text-align:center;">Sem dados de categorias registrados.</p>`;
    return;
  }

  els.categoriasColeta.innerHTML = categorias.map(cat => `
    <div class="card-categoria" style="padding:12px; border:1px solid #e0e0e0; border-radius:8px;">
      <span style="font-weight:600; display:block;">${escapeHtml(cat)}</span>
      <strong style="color:#0066b2; font-size:1.1rem;">${formatFloat(totaisPorCategoria[cat])} kg</strong>
    </div>
  `).join("");
}

// ─── RENDERIZADOR DE GRÁFICOS (APEXCHARTS) ───────────────────────────────────

function buildBarOptionsIndividual({ seriesData, categories, height = 360 }) {
  return {
    series: [{ name: "Volume Reciclado", data: seriesData }],
    chart: {
      type: "bar",
      height: height,
      toolbar: { show: true, tools: { download: false, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
      background: "transparent",
      fontFamily: "'Inter', sans-serif"
    },
    colors: CORES_GRAFICO,
    plotOptions: {
      bar: {
        horizontal: false,
        columnWidth: "45%",
        borderRadius: 6,
        distributed: true,
        dataLabels: { position: "top" }
      }
    },
    dataLabels: {
      enabled: true,
      textAnchor: "start",
      formatter: (val) => `${formatFloat(val)} kg`,
      offsetY: -12,
      style: { fontSize: "10px", fontWeight: 600, colors: ["#262117"] }
    },
    legend: { show: false },
    xaxis: {
      categories: categories,
      labels: { rotate: -45, rotateAlways: true, style: { colors: "#6B6255", fontSize: "11px", fontWeight: 600 } },
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

  if (elSede && dadosSede.length > 0) {
    state.charts.sede = new ApexCharts(elSede, buildBarOptionsIndividual({
      seriesData: dadosSede.map(d => d.pesoTotal),
      categories: dadosSede.map(d => d.diretoria)
    }));
    state.charts.sede.render();
  } else if (elSede) {
    elSede.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados na Sede</p>`;
  }

  if (elLaranjal && dadosLaranjal.length > 0) {
    state.charts.laranjal = new ApexCharts(elLaranjal, buildBarOptionsIndividual({
      seriesData: dadosLaranjal.map(d => d.pesoTotal),
      categories: dadosLaranjal.map(d => d.diretoria)
    }));
    state.charts.laranjal.render();
  } else if (elLaranjal) {
    elLaranjal.innerHTML = `<p style="text-align:center; color:#6B6255; font-size:0.8rem; padding:40px;">Sem dados no Laranjal</p>`;
  }

  if (elGeral && state.dadosDiretorias.length > 0) {
    const todasDiretorias = [...new Set(state.dadosDiretorias.map(d => d.diretoria))];

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
        toolbar: { show: true, tools: { download: false, selection: false, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } },
        background: "transparent",
        fontFamily: "'Inter', sans-serif"
      },
      colors: [COR_SEDE_CONSOLIDADO, COR_LARANJAL_CONSOLIDADO],
      plotOptions: {
            bar: {
        horizontal: false,
        columnWidth: "40%", // Reduzido de 60% para 40% para afastar as barras agrupadas
        borderRadius: 4,
        dataLabels: { position: "top" }
      }
      },
      dataLabels: {
        enabled: true,
        textAnchor: "start",
        formatter: (val) => (val > 0 ? `${formatFloat(val)} kg` : ""),
        offsetY: -15,
        style: { fontSize: "9px", fontWeight: 600, colors: ["#262117"] }
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
        labels: { rotate: -45, rotateAlways: true, style: { colors: "#6B6255", fontSize: "11px", fontWeight: 600 } },
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

function bindConsulta() {
  if (!els.consultaForm) return;

  els.consultaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = els.consultaId.value.trim();
    const local = els.consultaLocal.value.trim();

    els.consultaResultado.innerHTML = `<p style='color:#333; font-size:0.85rem;'><i class='fa-solid fa-spinner fa-spin'></i> Calculando pegada ecológica...</p>`;

    try {
      const participante = await ReciclaAPI.consultarParticipante(id, local);

      if (!participante) {
        els.consultaResultado.innerHTML = `
          <div style="background:#B43A2A; color:#fff; padding:12px; border-radius:8px; font-size:0.85rem; font-weight:600;">
            ❌ Colaborador não localizado na unidade ${escapeHtml(local.toUpperCase())} ou sem pesagens ativas.
          </div>`;
        return;
      }

      const peso = Number(participante.somatorio || 0);
      const litrosAgua = (peso * 20).toFixed(0);
      const arvoresSalvas = (peso * 0.02).toFixed(2);

      const metas = [
        { kg: 5, nome: "Brinde 5 kg" },
        { kg: 10, nome: "Brinde 10 kg" },
        { kg: 25, nome: "Brinde 25 kg" },
        { kg: 50, nome: "Brinde 50 kg" }
      ];

      let htmlBrindes = "";
      let temDireitoAAlgum = false;

      metas.forEach(meta => {
        if (peso >= meta.kg) {
          temDireitoAAlgum = true;
          htmlBrindes += `
            <div style="color: #74b62e; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-circle-check" style="font-size:1.1rem;"></i> ${meta.nome} ✔️
            </div>`;
        } else {
          const falta = (meta.kg - peso).toFixed(2);
          htmlBrindes += `
            <div style="color: #666; font-size: 1.05rem; display: flex; align-items: center; gap: 10px; opacity: 0.75;">
              <i class="fa-regular fa-circle" style="font-size:1.1rem;"></i> ${meta.nome} <span style="font-size: 0.9rem; color:#999;">(Faltam ${falta.toLocaleString('pt-BR')} kg)</span>
            </div>`;
        }
      });

      const statusGeralBrindes = temDireitoAAlgum
        ? `<div style="background: #eef9e6; border: 1px solid #d4edb8; color: #437413; font-weight: 700; padding: 16px; border-radius: 8px; font-size: 1rem; text-align: center;"><i class="fa-solid fa-gift"></i> Você tem brinde(s) liberado(s) para resgate!</div>`
        : `<div style="background: #fff8eb; border: 1px solid #ffe8cc; color: #b26a00; font-weight: 600; padding: 16px; border-radius: 8px; font-size: 1rem; text-align: center;"><i class="fa-solid fa-hourglass-half"></i> Faltam poucos quilos para seu primeiro brinde!</div>`;

      els.consultaResultado.innerHTML = `
        <div style="background:#ffffff; border-radius:10px; padding:24px; margin-top:18px; border: 1px solid #ccd5df; text-align:left; color:#333;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #eef2f7; padding-bottom:16px; margin-bottom:20px; gap:12px;">
            <div>
              <h4 style="margin:0; font-size:1.5rem; line-height:1.2; color:#004d88; font-family:'Montserrat',sans-serif; text-transform:uppercase; font-weight:800;">${escapeHtml(participante.nome)}</h4>
              <p style="margin:6px 0 0; font-size:1rem; color:#666;">Unidade: <strong>${escapeHtml(participante.local.toUpperCase())}</strong></p>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <span style="font-size:2rem; font-weight:700; color:#0066b2; font-family:'Ubuntu',sans-serif; white-space:nowrap;">${peso.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} kg</span>
            </div>
          </div>

       
          <div style="margin-top:16px; border-top: 2px dashed #ccd5df; padding-top:18px;">
            <h5 style="margin: 0 0 14px 0; font-size:0.95rem; font-weight:700; text-transform:uppercase; color:#888; letter-spacing:0.04em;">Resgate de Brindes:</h5>
            <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:18px;">
              ${htmlBrindes}
            </div>
            ${statusGeralBrindes}
          </div>
        </div>
      `;
    } catch (err) {
      console.error("Erro na consulta de participante:", err);
      els.consultaResultado.innerHTML = `
        <div style="background:#B43A2A; color:#fff; padding:12px; border-radius:8px; font-size:0.85rem;">
          ❌ Falha ao processar dados de impacto ecológico.
        </div>`;
    }
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
