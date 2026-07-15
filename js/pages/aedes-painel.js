// js/pages/aedes-painel.js
// Versão corrigida — lê array direto da API, desagrega campos JSON array,
// filtra locais de foco e motivos corretamente.

const ENDPOINT_API = window.location.hostname === "localhost"
  ? "http://localhost:3001/api/aedes"
  : "https://dma-aedes-api.onrender.com/api/aedes";

// Instâncias ativas do Chart.js — evita sobreposição/freeze
let graficosAtivos = {};

// Cache do payload completo para filtragem client-side
let _dadosCompletos = [];

// ─── INICIALIZAÇÃO ────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  await carregarDadosEInicializar();

  // Botão PDF
  const btnPdf = document.getElementById("btnGerarPdf");
  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      const filtroUnidade = document.getElementById("filtroUnidade")?.value || "TODOS";
      const filtroAno     = document.getElementById("filtroAno")?.value     || "TODOS";
      const textoOriginal = btnPdf.innerHTML;
      btnPdf.innerHTML = `⏳ Processando PDF...`;
      btnPdf.disabled  = true;

      const base = window.location.hostname === "localhost"
        ? "http://localhost:3001"
        : "https://dma-aedes-api.onrender.com";
      window.open(`${base}/api/aedes/relatorio-pdf?unidade=${encodeURIComponent(filtroUnidade)}&ano=${encodeURIComponent(filtroAno)}`, "_blank");

      setTimeout(() => { btnPdf.innerHTML = textoOriginal; btnPdf.disabled = false; }, 2000);
    });
  }
});

// ─── 1. CARGA INICIAL E FILTROS ───────────────────────────────────────────────
async function carregarDadosEInicializar() {
  try {
    const res = await fetch(`${ENDPOINT_API}/painel-dados`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    // A rota retorna um array direto (não { registros: [] })
    const payload = await res.json();
    _dadosCompletos = Array.isArray(payload) ? payload : (payload.registros || []);

    popularFiltros(_dadosCompletos);
    renderizarTudo(_dadosCompletos);

  } catch (err) {
    console.error("❌ Erro ao carregar dados iniciais:", err.message);
    mostrarErroGlobal("Não foi possível carregar os dados do painel. Verifique a conexão com a API.");
  }
}

function popularFiltros(dados) {
  const selectUnidade = document.getElementById("filtroUnidade");
  const selectAno     = document.getElementById("filtroAno");
  const selectSemana  = document.getElementById("filtroSemana");

  // Limpa opções anteriores (exceto o placeholder)
  [selectUnidade, selectAno, selectSemana].forEach(sel => {
    while (sel.options.length > 1) sel.remove(1);
  });

  const unidades = [...new Set(dados.map(d => d.Unidade).filter(Boolean))].sort();
  const anos     = [...new Set(dados.map(d => d.Ano).filter(Boolean))].sort((a, b) => b - a);
  const semanas  = [...new Set(dados.map(d => d.semana || d.Semana).filter(Boolean))].sort((a, b) => a - b);

  unidades.forEach(u => selectUnidade.add(new Option(u, u)));
  anos.forEach(a    => selectAno.add(new Option(a, a)));
  semanas.forEach(s => selectSemana.add(new Option(`Semana ${s}`, s)));
}

// ─── 2. MOTOR DE FILTRO (CLIENT-SIDE — sem chamada extra à API) ───────────────
function processarFiltrosETelas() {
  const unidade = document.getElementById("filtroUnidade").value;
  const ano     = document.getElementById("filtroAno").value;
  const mes     = document.getElementById("filtroMes").value;
  const semana  = document.getElementById("filtroSemana").value;

  let dados = _dadosCompletos;

  if (unidade !== "TODAS") dados = dados.filter(d => d.Unidade === unidade);
  if (ano     !== "TODOS") dados = dados.filter(d => String(d.Ano) === String(ano));
  if (mes     !== "TODOS") dados = dados.filter(d => {
    // Mes_Nome vem como string "Janeiro", "Fevereiro" etc.
    const mesesMap = {
      "1":"Janeiro","2":"Fevereiro","3":"Março","4":"Abril",
      "5":"Maio","6":"Junho","7":"Julho","8":"Agosto",
      "9":"Setembro","10":"Outubro","11":"Novembro","12":"Dezembro"
    };
    return d.Mes_Nome === mesesMap[mes];
  });
  if (semana  !== "TODAS") dados = dados.filter(d => String(d.semana || d.Semana) === String(semana));

  renderizarTudo(dados);
}

// ─── 3. ORQUESTRADOR DE RENDERIZAÇÃO ─────────────────────────────────────────
function renderizarTudo(dados) {
  renderizarKpis(dados);
  renderizarRankingUnidades(dados);
  renderizarSerieAnual(dados);
  renderizarGraficosLocaisFoco(dados);
  renderizarGraficosMotivos(dados);
}

// ─── 4. KPIs ─────────────────────────────────────────────────────────────────
// A rota já retorna colunas binárias calculadas no SQL:
//   visitada | foco_encontrado | foco_remediado | foco_pendente
function renderizarKpis(dados) {
  const total       = dados.length;
  const visitadas   = dados.reduce((s, d) => s + (Number(d.visitada)        || 0), 0);
  const focos       = dados.reduce((s, d) => s + (Number(d.foco_encontrado) || 0), 0);
  const remediados  = dados.reduce((s, d) => s + (Number(d.foco_remediado)  || 0), 0);

  document.getElementById("kpiRegistros").innerText  = total.toLocaleString("pt-BR");
  document.getElementById("kpiVistorias").innerText  = visitadas.toLocaleString("pt-BR");
  document.getElementById("kpiFocos").innerText      = focos.toLocaleString("pt-BR");
  document.getElementById("kpiRemediados").innerText = remediados.toLocaleString("pt-BR");
}

// ─── 5. RANKING DE UNIDADES ───────────────────────────────────────────────────
function renderizarRankingUnidades(dados) {
  const tbody = document.getElementById("tabelaRankingUnidades");
  tbody.innerHTML = "";

  const grupos = {};
  dados.forEach(d => {
    const nome = d.Unidade || "Não Identificada";
    if (!grupos[nome]) grupos[nome] = { nome, total: 0, visitadas: 0, focos: 0, remediados: 0 };
    grupos[nome].total++;
    grupos[nome].visitadas  += Number(d.visitada)        || 0;
    grupos[nome].focos      += Number(d.foco_encontrado) || 0;
    grupos[nome].remediados += Number(d.foco_remediado)  || 0;
  });

  Object.values(grupos)
    .sort((a, b) => b.visitadas - a.visitadas)
    .forEach(u => {
      const taxa = u.focos > 0 ? ((u.remediados / u.focos) * 100).toFixed(1) + "%" : "—";
      const badge = u.focos > 0 && (u.remediados / u.focos) < 0.8
        ? "bg-red-50 text-red-600 border border-red-200"
        : "bg-emerald-50 text-emerald-600 border border-emerald-200";

      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition-colors text-sm text-gray-700">
          <td class="p-3 font-semibold text-gray-900">${u.nome}</td>
          <td class="p-3 text-center text-gray-500">${u.total}</td>
          <td class="p-3 text-center font-bold text-[#0056b3]">${u.visitadas}</td>
          <td class="p-3 text-center text-[#ef4444]">${u.focos}</td>
          <td class="p-3 text-center text-[#22c55e]">${u.remediados}</td>
          <td class="p-3 text-center">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${badge}">${taxa}</span>
          </td>
        </tr>`;
    });

  if (!Object.keys(grupos).length) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 italic">Nenhum dado para o filtro selecionado.</td></tr>`;
  }
}

// ─── 6. SÉRIE TEMPORAL (por Ano, agrupado client-side) ───────────────────────
function renderizarSerieAnual(dados) {
  const porAno = {};
  dados.forEach(d => {
    const ano = String(d.Ano || "").trim();
    if (!ano) return;
    if (!porAno[ano]) porAno[ano] = { registros: 0, vistorias: 0 };
    porAno[ano].registros++;
    porAno[ano].vistorias += Number(d.visitada) || 0;
  });

  const anos   = Object.keys(porAno).sort((a, b) => parseInt(a) - parseInt(b));
  const regs   = anos.map(a => porAno[a].registros);
  const visits = anos.map(a => porAno[a].vistorias);

  destruirInstanciaGrafico("timeline");
  const canvas = document.getElementById("chartTimeline");
  if (!canvas) return;

  if (!anos.length) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "13px Segoe UI"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
    ctx.fillText("Nenhum dado para o filtro selecionado.", canvas.width / 2, canvas.height / 2);
    return;
  }

  graficosAtivos.timeline = new Chart(canvas.getContext("2d"), {
    type: "line",
    data: {
      labels: anos,
      datasets: [
        {
          label: "Registros",
          data: regs,
          borderColor: "#0056b3", backgroundColor: "rgba(0,86,179,0.05)",
          borderWidth: 3, tension: 0.2, fill: true,
          pointBackgroundColor: "#0056b3", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 5
        },
        {
          label: "Vistorias",
          data: visits,
          borderColor: "#22c55e", backgroundColor: "transparent",
          borderWidth: 3, tension: 0.2, fill: false,
          pointBackgroundColor: "#22c55e", pointBorderColor: "#fff", pointBorderWidth: 2, pointRadius: 5
        }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 14, font: { size: 11 }, color: "#334155" } },
        tooltip: {
          backgroundColor: "#0f172a", titleColor: "#fff", bodyColor: "#fff", padding: 10,
          callbacks: { label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString("pt-BR")}` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#64748b", font: { size: 12, weight: "bold" } } },
        y: { grid: { color: "#f1f5f9" }, beginAtZero: true,
             ticks: { color: "#64748b", font: { size: 11 }, callback: v => v.toLocaleString("pt-BR") } }
      }
    }
  });
}

// ─── 7. GRÁFICOS DE LOCAIS DE FOCO ────────────────────────────────────────────
// As colunas nv_acesso, nv_brigadista etc. são binárias (0/1) vindas do SQL.
// Para locais de foco, o campo "locais_foco" pode ser JSON array — desagregamos.
function renderizarGraficosLocaisFoco(dados) {
  // Locais estruturados — desagrega arrays JSON
  const locaisMap = {};
  const outrosLocaisMap = {};

  dados.forEach(d => {
    // locais_foco pode vir como string JSON, array ou string simples
    const raw = d.locais_foco || d.Locais_Foco || "[]";
    const lista = parseArrayOuString(raw);
    lista.forEach(item => {
      if (!item || item === "Outro") return;
      locaisMap[item] = (locaisMap[item] || 0) + 1;
    });

    // Campo livre "outros_locais_foco" — mineração por regex
    const outro = String(d.outros_locais_foco || d.Outros_Locais_Foco || "").toLowerCase().trim();
    if (outro && outro !== "null" && outro !== "") {
      const cat = categorizarLocalLivre(outro);
      outrosLocaisMap[cat] = (outrosLocaisMap[cat] || 0) + 1;
    }
  });

  const cores = ["#ef4444","#eab308","#0056b3","#22c55e","#a855f7","#f97316","#cbd5e1"];
  gerarGraficoSetor("locais", "chartLocais", locaisMap, cores, "pie");

  renderizarListaLivre("listaOutrosLocais", outrosLocaisMap);
}

// ─── 8. GRÁFICOS DE MOTIVOS (NÃO VISTORIA / NÃO REMEDIAÇÃO) ──────────────────
// Usa as colunas binárias do SQL para os motivos categorizados
// e desagrega arrays nos campos originais para os demais.
function renderizarGraficosMotivos(dados) {
  // ── Motivos de NÃO vistoria ──
  const nvMap = {
    "Sem Acesso":         dados.reduce((s,d) => s + (Number(d.nv_acesso)      || 0), 0),
    "Falta de Brigadista":dados.reduce((s,d) => s + (Number(d.nv_brigadista)  || 0), 0),
    "Viatura":            dados.reduce((s,d) => s + (Number(d.nv_viatura)     || 0), 0),
    "Esquecimento":       dados.reduce((s,d) => s + (Number(d.nv_esquecimento)|| 0), 0),
  };
  // Remove zerados
  Object.keys(nvMap).forEach(k => { if (!nvMap[k]) delete nvMap[k]; });

  // Outros motivos de não vistoria — texto livre
  const outrosNVMap = {};
  dados.forEach(d => {
    const outro = String(d.outros_motivos_nao_vistoria || "").toLowerCase().trim();
    if (!outro || outro === "null") return;
    // Evita contar o que já está nas colunas estruturadas
    if (!/acesso|brigadista|viatura|esquecimento/.test(outro)) {
      const cat = categorizarMotivoLivre(outro);
      outrosNVMap[cat] = (outrosNVMap[cat] || 0) + 1;
    }
  });

  gerarGraficoSetor("naoVistoria", "chartNaoVistoria", nvMap, ["#ef4444","#eab308","#64748b","#0056b3"], "doughnut");

  // ── Motivos de NÃO remediação ──
  const mnrMap = {
    "Capacitação/Treinamento": dados.reduce((s,d) => s + (Number(d.mnr_capacitacao) || 0), 0),
    "Falta de Larvicida/Cloro": dados.reduce((s,d) => s + (Number(d.mnr_larvicida)  || 0), 0),
    "Limpeza":                  dados.reduce((s,d) => s + (Number(d.mnr_limpeza)    || 0), 0),
    "Cobertura/Tampa":          dados.reduce((s,d) => s + (Number(d.mnr_cobertura)  || 0), 0),
  };
  Object.keys(mnrMap).forEach(k => { if (!mnrMap[k]) delete mnrMap[k]; });

  // Outros motivos de não remediação — texto livre
  const outrosMNRMap = {};
  dados.forEach(d => {
    const outro = String(d.outros_motivos_nao_remediacao || "").toLowerCase().trim();
    if (!outro || outro === "null") return;
    if (!/treinamento|capacitacao|cloro|larvicida|limpeza|cobertura|tampa/.test(outro)) {
      const cat = categorizarMotivoLivre(outro);
      outrosMNRMap[cat] = (outrosMNRMap[cat] || 0) + 1;
    }
  });

  gerarGraficoSetor("naoRemediacao", "chartNaoRemediacao", mnrMap, ["#ef4444","#eab308","#001d3d","#22c55e"], "doughnut");

  // Junta "outros" dos dois tipos de motivo em uma tabela só
  const outrosCombinados = {};
  [outrosNVMap, outrosMNRMap].forEach(m => {
    Object.entries(m).forEach(([k,v]) => { outrosCombinados[k] = (outrosCombinados[k] || 0) + v; });
  });
  renderizarListaLivre("listaOutrosMotivos", outrosCombinados);
}

// ─── UTILITÁRIOS ──────────────────────────────────────────────────────────────

/**
 * Tenta parsear campo que pode vir como:
 *   - Array JS já parseado
 *   - String JSON: '["Caixa d'água","Calha"]'
 *   - String simples: 'Caixa d'água'
 *   - String com múltiplos itens separados por vírgula
 */
function parseArrayOuString(valor) {
  if (!valor || valor === "[]" || valor === "null") return [];
  if (Array.isArray(valor)) return valor.map(v => String(v).trim()).filter(Boolean);
  const str = String(valor).trim();
  if (str.startsWith("[")) {
    try {
      const arr = JSON.parse(str);
      return Array.isArray(arr) ? arr.map(v => String(v).trim()).filter(Boolean) : [str];
    } catch { /* não é JSON válido, trata como string */ }
  }
  // Múltiplos itens separados por vírgula (ex: vindo de CSV)
  return str.split(",").map(v => v.trim()).filter(Boolean);
}

function categorizarLocalLivre(txt) {
  if (/bromelia|planta|vaso|jardim/i.test(txt))          return "Bromélias / Paisagismo";
  if (/laje|calha|telhado|rufo/i.test(txt))              return "Lajes / Calhas Obstruídas";
  if (/ar condicionado|condensadora|split/i.test(txt))   return "Bandeja de Ar Condicionado";
  if (/sapata|decantador|maquina|bomba|cisterna/i.test(txt)) return "Estruturas Operacionais";
  if (/piscina|caixa|reservatorio/i.test(txt))           return "Piscinas / Reservatórios";
  return "Outros Locais";
}

function categorizarMotivoLivre(txt) {
  if (/recusa|nao permitiu|nao quis|proibiu/i.test(txt))       return "Recusa Operacional";
  if (/fechado|trancado|vazio|ausente|sem chave/i.test(txt))   return "Local Fechado / Sem Acesso";
  if (/chuva|temporal|clima|enchente/i.test(txt))              return "Fatores Climáticos";
  if (/equipamento|ferramenta|material/i.test(txt))            return "Falta de Equipamento";
  return "Outros Motivos";
}

function gerarGraficoSetor(idChave, canvasId, mapaContagem, cores, tipo) {
  destruirInstanciaGrafico(idChave);
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const labels = Object.keys(mapaContagem);
  const data   = Object.values(mapaContagem);
  const total  = data.reduce((s, v) => s + v, 0);

  if (total === 0) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.font = "12px Segoe UI"; ctx.fillStyle = "#94a3b8"; ctx.textAlign = "center";
    ctx.fillText("Nenhuma ocorrência para este filtro.", canvas.width / 2, canvas.height / 2);
    return;
  }

  graficosAtivos[idChave] = new Chart(canvas.getContext("2d"), {
    type: tipo,
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: cores.slice(0, labels.length),
        borderColor: "#ffffff",
        borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom", labels: { color: "#334155", font: { size: 9 }, boxWidth: 10 } },
        tooltip: {
          callbacks: {
            label: ctx => {
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              return ` ${ctx.label}: ${ctx.raw} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function renderizarListaLivre(domId, mapa) {
  const container = document.getElementById(domId);
  if (!container) return;
  container.innerHTML = "";

  const itens = Object.entries(mapa).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  if (!itens.length) {
    container.innerHTML = `<tr><td colspan="2" class="p-3 text-center text-gray-400 italic text-xs">Nenhum registro livre detectado para este filtro.</td></tr>`;
    return;
  }

  itens.forEach(([chave, qtd]) => {
    container.innerHTML += `
      <tr class="hover:bg-gray-50 border-b border-gray-100 transition-colors text-xs text-gray-600">
        <td class="p-2.5 font-medium text-gray-700">${chave}</td>
        <td class="p-2.5 text-center font-bold text-gray-500">${qtd}</td>
      </tr>`;
  });
}

function destruirInstanciaGrafico(idChave) {
  if (graficosAtivos[idChave]) {
    graficosAtivos[idChave].destroy();
    delete graficosAtivos[idChave];
  }
}

function exportarRelatorio(tipo) {
  const params = new URLSearchParams({
    unidade: (document.getElementById("filtroUnidade").value === "TODAS" ? "" : document.getElementById("filtroUnidade").value),
    ano:     (document.getElementById("filtroAno").value     === "TODOS" ? "" : document.getElementById("filtroAno").value),
    mes:     (document.getElementById("filtroMes").value     === "TODOS" ? "" : document.getElementById("filtroMes").value),
    semana:  (document.getElementById("filtroSemana").value  === "TODAS" ? "" : document.getElementById("filtroSemana").value),
  }).toString();
  window.open(`${ENDPOINT_API}/export/${tipo}?${params}`, "_blank");
}

function mostrarErroGlobal(msg) {
  document.querySelectorAll("[id^='kpi']").forEach(el => el.innerText = "—");
  const tbody = document.getElementById("tabelaRankingUnidades");
  if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-400 italic">${msg}</td></tr>`;
}