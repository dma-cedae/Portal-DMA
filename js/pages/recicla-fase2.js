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

// ─── CONFIGURAÇÃO DE PREMIAÇÕES (REGRA DE NEGÓCIO) ──────────────────────────
const PREMIOS = [
  { meta: 10, nome: "Squeeze Ecológica Cedae", icone: "fa-bottle-water", cor: "#10b981" },
  { meta: 50, nome: "EcoBag Reforçada CRS", icone: "fa-bag-shopping", cor: "#059669" },
  { meta: 100, nome: "Camiseta DryFit Recicla", icone: "fa-shirt", cor: "#047857" },
  { meta: 250, nome: "Kit Jardinagem + Adubo Orgânico", icone: "fa-seedling", cor: "#065f46" },
  { meta: 500, nome: "Ingresso Cultural + Brinde Master", icone: "fa-ticket", cor: "#064e3b" }
];

const CORES_GRAFICO = ["#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

// ─── MAPEAMENTO DE ELEMENTOS DO DOM ─────────────────────────────────────────
const els = {
  kpiParticipantes: document.getElementById("kpi-participantes"),
  kpiTotalPeso: document.getElementById("kpi-total-peso"),
  fase2DbStatus: document.getElementById("fase2-db-status"),
  consultaForm: document.getElementById("form-consulta-recicla"),
  consultaId: document.getElementById("input-id-recicla"),
  consultaResultado: document.getElementById("resultado-consulta-recicla"),
  rankingCorpo: document.getElementById("corpo-ranking-diretorias"),
  catalogoPremios: document.getElementById("container-premios-metas")
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

    // Consome a rota agregada da API
    const data = await ReciclaAPI.getDadosDashboard();

    state.kpis = data.kpis;
    state.dadosDiretorias = data.dadosDiretorias;
    state.dadosReciclados = data.dadosReciclados;

    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> Sincronismo estável (Banco de Dados Central) · CRS 2026`;
    }
    
    // Renderiza os componentes visuais
    renderKpis(); 
    renderAwardCatalog(); 
    renderRankingTable(); 
    renderCharts();
  } catch (err) {
    console.error("Erro ao inicializar dashboard:", err);
    if (els.fase2DbStatus) {
      els.fase2DbStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> Erro ao carregar dados do banco: ${err.message}`;
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

function renderAwardCatalog() {
  if (!els.catalogoPremios) return;
  els.catalogoPremios.innerHTML = PREMIOS.map(p => `
    <div class="card-premio" style="border-left: 4px solid ${p.cor}; background: rgba(255,255,255,0.03); padding: 15px; border-radius: 6px; margin-bottom: 10px; display: flex; align-items: center; gap: 15px;">
      <div style="background: ${p.cor}; width: 45px; height: 45px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem;">
        <i class="fa-solid ${p.icone}"></i>
      </div>
      <div style="flex: 1;">
        <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">${p.nome}</h4>
        <p style="margin: 3px 0 0 0; font-size: 0.8rem; color: #94a3b8;">Meta Desbloqueada com: <strong>${p.meta} kg</strong> acumulados</p>
      </div>
    </div>
  `).join("");
}

function renderRankingTable() {
  if (!els.rankingCorpo) return;

  if (state.dadosDiretorias.length === 0) {
    els.rankingCorpo.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#94a3b8; font-size:0.85rem; padding: 20px;">Nenhuma pesagem computada neste ciclo.</td></tr>`;
    return;
  }

  els.rankingCorpo.innerHTML = state.dadosDiretorias.map((d, index) => {
    const medalhas = ["🥇", "🥈", "🥉"];
    const rankVis = index < 3 ? `<span style="font-size:1.1rem;">${medalhas[index]}</span>` : `${index + 1}º`;
    
    return `
      <tr>
        <td style="text-align: center; font-weight: bold; color: #fff;">${rankVis}</td>
        <td style="font-weight: 600; color: #e2e8f0;">${escapeHtml(d.diretoria)}</td>
        <td style="text-align: center; color: #cbd5e1;">${formatInteger(d.totalParticipantes)}</td>
        <td style="text-align: right; font-weight: bold; color: var(--verde-sustentavel);">${formatFloat(d.pesoTotal)} kg</td>
      </tr>
    `;
  }).join("");
}

// ─── RENDERIZADOR DE GRÁFICOS (APEXCHARTS) ──────────────────────────────────
function renderCharts() {
  // Destrói instâncias antigas se existirem para evitar vazamento de memória
  if (state.charts.diretoria && typeof state.charts.diretoria.destroy === "function") state.charts.diretoria.destroy();
  if (state.charts.historico && typeof state.charts.historico.destroy === "function") state.charts.historico.destroy();

  const elChartDir = document.getElementById("chart-recicla-diretorias");
  const elChartHist = document.getElementById("chart-recicla-historico");

  // 1. Gráfico de Rosca/Donut - Distribuição por Diretoria
  if (elChartDir && state.dadosDiretorias.length > 0) {
    const optionsDir = {
      series: state.dadosDiretorias.map(d => d.pesoTotal),
      labels: state.dadosDiretorias.map(d => d.diretoria),
      chart: { type: 'donut', height: 280, background: 'transparent' },
      theme: { monochrome: { enabled: false } },
      colors: CORES_GRAFICO,
      legend: { position: 'bottom', labels: { colors: '#94a3b8' } },
      dataLabels: { enabled: true, formatter: (val) => `${val.toFixed(1)}%` },
      plotOptions: { pie: { donut: { labels: { show: true, total: { show: true, label: 'Total', color: '#94a3b8', formatter: () => `${formatFloat(state.kpis.somatorio_total)} kg` } } } } }
    };
    state.charts.diretoria = new ApexCharts(elChartDir, optionsDir);
    state.charts.diretoria.render();
  }

  // 2. Gráfico de Linha/Área - Evolução Cronológica das Coletas
  if (elChartHist && state.dadosReciclados.length > 0) {
    const optionsHist = {
      series: [{ name: 'Massa Coletada', data: state.dadosReciclados.map(r => r.Quantidade) }],
      chart: { type: 'area', height: 280, toolbar: { show: false }, background: 'transparent' },
      colors: ['#10b981'],
      dataLabels: { enabled: false },
      stroke: { curve: 'smooth', width: 3 },
      fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.4, opacityTo: 0.05 } },
      xaxis: {
        categories: state.dadosReciclados.map(r => {
          if (!r.Data) return "";
          const partes = r.Data.split("-");
          return partes.length === 3 ? `${partes[2]}/${partes[1]}` : r.Data;
        }),
        labels: { style: { colors: '#94a3b8' } }
      },
      yaxis: { labels: { style: { colors: '#94a3b8' }, formatter: (val) => `${val.toFixed(0)} kg` } },
      grid: { borderColor: 'rgba(255,255,255,0.06)' },
      tooltip: { theme: 'dark' }
    };
    state.charts.historico = new ApexCharts(elChartHist, optionsHist);
    state.charts.historico.render();
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
      <div style="text-align:center; color: #94a3b8; font-size: 0.8rem; padding: 10px;">
        <i class="fa-solid fa-spinner fa-spin"></i> Consultando base de homologação...
      </div>`;
    
    // Executa a busca individual parametrizada mapeando o JOIN do banco
    const part = await ReciclaAPI.consultarParticipante(id);
    
    if (!part) {
      els.consultaResultado.innerHTML = `
        <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid #ef4444; border-radius: 8px; padding: 14px; color: #ef4444; font-size: 0.8rem; text-align: center; line-height: 1.4;">
          <i class="fa-solid fa-circle-xmark" style="font-size: 1.1rem; margin-bottom: 5px; display:block;"></i>
          <strong>ID [${escapeHtml(id)}] não localizado!</strong><br>
          Verifique o número digitado ou contate o suporte da CRS.
        </div>`;
      return;
    }

    // Calcula a próxima meta com base no volume atual
    const metaAlcancada = PREMIOS.filter(p => part.somatorio >= p.meta).pop();
    const proximaMeta = PREMIOS.find(p => part.somatorio < p.meta);
    
    let metaHtml = `<p style="margin: 8px 0 0 0; font-size: 0.75rem; color: #a8a29e;"><i class="fa-solid fa-award"></i> Nenhuma meta atingida ainda. Continue reciclando!</p>`;
    if (metaAlcancada) {
      metaHtml = `<p style="margin: 8px 0 0 0; font-size: 0.75rem; color: #f59e0b;"><i class="fa-solid fa-trophy"></i> <strong>Prêmio Liberado:</strong> ${metaAlcancada.nome}</p>`;
    }
    if (proximaMeta) {
      const faltaQuanto = (proximaMeta.meta - part.somatorio).toFixed(1);
      metaHtml += `<p style="margin: 3px 0 0 0; font-size: 0.72rem; color: #94a3b8;"><i class="fa-solid fa-arrow-up-from-bracket"></i> Faltam <strong>${faltaQuanto} kg</strong> para liberar o próximo prêmio.</p>`;
    } else {
      metaHtml += `<p style="margin: 3px 0 0 0; font-size: 0.72rem; color: #10b981;"><i class="fa-solid fa-star"></i> <strong>Incrível!</strong> Você maximizou o catálogo de metas!</p>`;
    }
    
    els.consultaResultado.innerHTML = `
      <div style="background: rgba(255,255,255,0.04); border: 1px solid #10b981; border-radius: 8px; padding: 14px; color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); animation: fadeIn 0.3s ease;">
        <strong style="font-size: 0.95rem; color: #10b981; display:block; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.06); padding-bottom:4px;">
          <i class="fa-solid fa-user-check"></i> ${escapeHtml(part.nome)}
        </strong>
        <p style="margin: 4px 0; font-size: 0.8rem; color: #cbd5e1;"><strong>ID Interno:</strong> ${escapeHtml(part.id)}</p>
        <p style="margin: 4px 0; font-size: 0.8rem; color: #cbd5e1;"><strong>Lotação:</strong> ${escapeHtml(part.diretoria)}</p>
        <div style="margin-top: 12px; background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.8rem; color: #94a3b8;">Volume Acumulado:</span>
          <strong style="font-size: 1.25rem; color: #10b981;">${formatFloat(part.somatorio)} kg</strong>
        </div>
        ${metaHtml}
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