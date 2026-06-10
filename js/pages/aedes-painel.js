// js/pages/aedes-painel.js

const ENDPOINT_API = "http://localhost:3001/api/aedes";

// Objeto global para gerenciar as instâncias do Chart.js e evitar bugs de sobreposição
let graficosAtivos = {};

// Inicialização automática ao carregar o DOM
document.addEventListener("DOMContentLoaded", async () => {
  await inicializarFiltrosDoTopo();
  processarFiltrosETelas(); // Carga inicial (Padrão: TODOS)
});

/**
 * 1. POPULA OS SELETORES DINÂMICOS DO CABEÇALHO
 * Consome a base unificada para extrair os filtros reais de Unidades, Anos e Semanas
 */
async function inicializarFiltrosDoTopo() {
  try {
    const response = await fetch(`${ENDPOINT_API}/painel-dados`);
    if (!response.ok) throw new Error("Não foi possível carregar os dados de parametrização dos filtros.");
    
    const payload = await response.json();
    const registros = payload.registros || [];

    const selectUnidade = document.getElementById("filtroUnidade");
    const selectAno = document.getElementById("filtroAno");
    const selectSemana = document.getElementById("filtroSemana");

    // Limpa duplicados e nulos das colunas oficiais
    const listaUnidades = [...new Set(registros.map(item => item.Unidade || item.unidade_nome).filter(Boolean))].sort();
    const listaAnos = [...new Set(registros.map(item => item.Ano || item.ano).filter(Boolean))].sort((a, b) => b - a);
    const listaSemanas = [...new Set(registros.map(item => item.Semana || item.semana).filter(Boolean))].sort((a, b) => a - b);

    // Injeta nos selects do HTML
    listaUnidades.forEach(uni => selectUnidade.options.add(new Option(uni, uni)));
    listaAnos.forEach(ano => selectAno.options.add(new Option(ano, ano)));
    listaSemanas.forEach(sem => selectSemana.options.add(new Option(`Semana ${sem}`, sem)));

  } catch (err) {
    console.error("❌ Erro ao preencher filtros estruturais:", err.message);
  }
}

/**
 * 2. MOTOR DE REQUISIÇÃO REATIVO
 * Captura os filtros e dispara as requisições para as rotas da API em paralelo
 */
async function processarFiltrosETelas() {
  const unity = document.getElementById("filtroUnidade").value;
  const year = document.getElementById("filtroAno").value;
  const month = document.getElementById("filtroMes").value;
  const week = document.getElementById("filtroSemana").value;

  // Monta a Query String esperada pelo seu Express no server.js
  const queryParams = new URLSearchParams({
    unidade: unity === "TODAS" ? "" : unity,
    ano: year === "TODOS" ? "" : year,
    mes: month === "TODOS" ? "" : month,
    semana: week === "TODAS" ? "" : week
  }).toString();

  try {
    // Executa as chamadas em paralelo para otimizar a velocidade
    await Promise.all([
      carregarKpisERankingGlobal(queryParams),
      carregarSerieTemporal(queryParams),
      carregarGraficosSetorEMineracaoTexto(queryParams)
    ]);
  } catch (error) {
    console.error("❌ Falha crítica na sincronização dos componentes analíticos:", error);
  }
}

/**
 * MÓDULO A: KPIs PRINCIPAIS E MATRIZ DE RANKING
 * Rota consumida: GET /api/aedes/painel-dados
 */
async function carregarKpisERankingGlobal(queryParams) {
  const res = await fetch(`${ENDPOINT_API}/painel-dados?${queryParams}`);
  const payload = await res.json();
  const dados = payload.registros || [];

  const total = dados.length;
  
  // Normalização de chaves lendo estritamente o layout validado da tabela fato_vistorias
  const vistorias = dados.filter(d => {
    const v = d.vistoria_realizada || d.Vistoria_Realizada || '';
    return String(v).toLowerCase() === 'sim';
  }).length;

  const focos = dados.filter(d => {
    const v = d.vistoria_realizada || d.Vistoria_Realizada || '';
    const f = d.foco_encontrado || d.Foco_Encontrado || '';
    return String(v).toLowerCase() === 'sim' && String(f).toLowerCase() === 'sim';
  }).length;

  const remediados = dados.filter(d => {
    const r = d.foco_remediado || d.Foco_Remediado || '';
    return String(r).toLowerCase() === 'sim';
  }).length;

  document.getElementById("kpiRegistros").innerText = total.toLocaleString('pt-BR');
  document.getElementById("kpiVistorias").innerText = vistorias.toLocaleString('pt-BR');
  document.getElementById("kpiFocos").innerText = focos.toLocaleString('pt-BR');
  document.getElementById("kpiRemediados").innerText = remediados.toLocaleString('pt-BR');

  // Renderização da tabela de Ranking das Unidades
  const tbody = document.getElementById("tabelaRankingUnidades");
  tbody.innerHTML = "";

  const agrupamentoUnidades = {};
  dados.forEach(item => {
    const nome = item.unidade_nome || item.Unidade || "Não Identificada";
    if (!agrupamentoUnidades[nome]) {
      agrupamentoUnidades[nome] = { nome, registros: 0, vistorias: 0, focos: 0, remediados: 0 };
    }
    
    agrupamentoUnidades[nome].registros++;
    const v = item.vistoria_realizada || item.Vistoria_Realizada || '';
    const f = item.foco_encontrado || item.Foco_Encontrado || '';
    const r = item.foco_remediado || item.Foco_Remediado || '';

    if (String(v).toLowerCase() === 'sim') agrupamentoUnidades[nome].vistorias++;
    if (String(v).toLowerCase() === 'sim' && String(f).toLowerCase() === 'sim') agrupamentoUnidades[nome].focos++;
    if (String(r).toLowerCase() === 'sim') agrupamentoUnidades[nome].remediados++;
  });

  Object.values(agrupamentoUnidades)
    .sort((a, b) => b.vistorias - a.vistorias)
    .forEach(uni => {
      const taxaRemediacao = uni.focos > 0 ? ((uni.remediados / uni.focos) * 100).toFixed(1) + "%" : "100.0%";
      const badgeClasse = (uni.focos > 0 && (uni.remediados / uni.focos) < 0.8) 
        ? 'bg-red-50 text-red-600 border border-red-200' 
        : 'bg-emerald-50 text-emerald-600 border border-emerald-200';

      tbody.innerHTML += `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition-colors text-sm text-gray-700">
          <td class="p-3 font-semibold text-gray-900">${uni.nome}</td>
          <td class="p-3 text-center text-gray-500">${uni.registros}</td>
          <td class="p-3 text-center font-bold text-[#0056b3]">${uni.vistorias}</td>
          <td class="p-3 text-center text-[#ef4444]">${uni.focos}</td>
          <td class="p-3 text-center text-[#22c55e]">${uni.remediados}</td>
          <td class="p-3 text-center">
            <span class="px-2 py-0.5 rounded-md text-[11px] font-bold ${badgeClasse}">${taxaRemediacao}</span>
          </td>
        </tr>`;
    });
}
/**
 * MÓDULO B: SÉRIE TEMPORAL — EVOLUÇÃO POR ANO (REGISTROS VS VISTORIAS)
 * 100% REATIVO AOS FILTROS E BASEADO EXCLUSIVAMENTE EM 'ANO', 'REGISTROS' E 'VISTORIAS'
 */
async function carregarSerieTemporal(queryParams) {
  try {
    // 1. Faz a requisição enviando os filtros de Unidade, Ano, etc. para o backend
    const res = await fetch(`${ENDPOINT_API}/cobertura-semanal?${queryParams}`);
    if (!res.ok) throw new Error("Erro ao requisitar dados de cobertura semanal filtrada.");
    
    const dados = await res.json();

    // Dicionários para consolidar os totais agrupados por ano
    const consolidadoRegistros = {};
    const consolidadoVistorias = {};

    // 2. Processa as linhas da view vw_cobertura_semanal retornadas pelo banco
    dados.forEach(d => {
      const ano = d.ano || d.Ano;
      
      if (ano) {
        const totalRegistros = parseInt(d.registros || d.Registros || 0);
        const totalVistorias = parseInt(d.vistorias || d.Vistorias || 0);

        if (!consolidadoRegistros[ano]) consolidadoRegistros[ano] = 0;
        if (!consolidadoVistorias[ano]) consolidadoVistorias[ano] = 0;

        // Acumula os valores correspondentes ao ano corrente da linha
        consolidadoRegistros[ano] += totalRegistros;
        consolidadoVistorias[ano] += totalVistorias;
      }
    });

    // 3. Ordena os anos de forma crescente (ex: 2023, 2024, 2025, 2026...)
    const anosLabels = Object.keys(consolidadoRegistros).sort((a, b) => parseInt(a) - parseInt(b));
    const dadosRegistros = anosLabels.map(ano => consolidadoRegistros[ano]);
    const dadosVistorias = anosLabels.map(ano => consolidadoVistorias[ano]);

    // Trata o cenário caso a tabela venha completamente filtrada/vazia
    if (anosLabels.length === 0) {
      destruirInstanciaGrafico('timeline');
      const canvas = document.getElementById("chartTimeline");
      if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "14px Segoe UI";
        ctx.fillStyle = "#94a3b8";
        ctx.textAlign = "center";
        ctx.fillText("Nenhum dado histórico encontrado para o filtro selecionado.", canvas.width / 2, canvas.height / 2);
      }
      return;
    }

    // 4. Destrói o gráfico anterior para evitar sobreposição ou congelamento de tela
    destruirInstanciaGrafico('timeline');

    const canvas = document.getElementById("chartTimeline");
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // 5. Instanciação do Gráfico com as Duas Linhas Analíticas Comparativas
    graficosAtivos.timeline = new Chart(ctx, {
      type: 'line',
      data: {
        labels: anosLabels, // Ex: ['2023', '2024', '2025', '2026']
        datasets: [
          {
            label: 'Quantidade de Envios (Registros)',
            data: dadosRegistros,
            borderColor: '#0056b3', // Azul Identidade CEDAE
            backgroundColor: 'rgba(0, 86, 179, 0.03)',
            borderWidth: 3,
            tension: 0.2, // Curvatura suave profissional
            fill: true,
            pointBackgroundColor: '#0056b3',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          },
          {
            label: 'Vistorias Realizadas',
            data: dadosVistorias,
            borderColor: '#22c55e', // Verde Sucesso / Cobertura Eficaz
            backgroundColor: 'transparent',
            borderWidth: 3,
            tension: 0.2,
            fill: false,
            pointBackgroundColor: '#22c55e',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2,
            pointRadius: 5,
            pointHoverRadius: 7
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { 
          legend: { 
            display: true, // Habilitado para o usuário diferenciar Envios vs Vistorias
            position: 'top',
            labels: {
              boxWidth: 15,
              font: { size: 11, weight: '500' },
              color: '#334155'
            }
          },
          tooltip: {
            backgroundColor: '#0f172a',
            titleColor: '#ffffff',
            bodyColor: '#ffffff',
            padding: 10,
            callbacks: {
              label: function(context) {
                return ` ${context.dataset.label}: ${context.parsed.y.toLocaleString('pt-BR')}`;
              }
            }
          }
        },
        scales: {
          x: { 
            grid: { display: false }, 
            ticks: { color: '#64748b', font: { size: 12, weight: 'bold' } } 
          },
          y: { 
            grid: { color: '#f1f5f9' }, 
            ticks: { 
              color: '#64748b', 
              font: { size: 11 },
              callback: value => value.toLocaleString('pt-BR')
            },
            beginAtZero: true
          }
        }
      }
    });
  } catch (error) {
    console.error("❌ Erro ao renderizar evolução anual reativa:", error);
  }
}
/**
 * MÓDULO C: GRÁFICOS DE PIZZA/ROSCA E MINERAÇÃO TEXTUAL (LÓGICA DO RMD)
 * Ajustado estritamente para as colunas plurais da sua tabela 'fato_vistorias'
 */
async function carregarGraficosSetorEMineracaoTexto(queryParams) {
  const res = await fetch(`${ENDPOINT_API}/painel-dados?${queryParams}`);
  const payload = await res.json();
  const registros = payload.registros || [];

  const locaisMap = {};
  const naoVistoriaMap = {};
  const naoRemediacaoMap = {};

  // Dicionários Regex para processar os campos livres "Outros" mapeados no Rmd
  const mineracaoLocais = { "Bromélias (Paisagismo)": 0, "Lajes / Calhas Obstruídas": 0, "Bandejas de Ar Condicionado": 0, "Estruturas Operacionais": 0 };
  const mineracaoFalhas = { "Recusa Operacional": 0, "Local Fechado / Sem Chave": 0, "Fatores Climáticos Extremos": 0 };

  registros.forEach(d => {
    // CORREÇÃO CRÍTICA: Leitura das colunas corretas em plural mapeadas na fato_vistorias
    const local = d.locais_foco || d.Locais_Foco;
    const mNoVistoria = d.motivos_nao_vistoria || d.Motivos_Nao_Vistoria;
    const mNoRemediacao = d.motivos_nao_remediacao || d.Motivos_Nao_Remediacao;
    
    // Mapeamento dos campos de texto livre do Excel ("outros_locais_foco", etc.)
    const campoOutroLocal = d.outros_locais_foco || d.Outros_Locais_Foco || '';
    const campoOutroMotivo = d.outros_motivos_nao_vistoria || d.outros_motivos_nao_remediacao || '';

    // 1. Agrupamento das opções estruturadas padrão
    if (local && local !== "[]") locaisMap[local] = (locaisMap[local] || 0) + 1;
    if (mNoVistoria && mNoVistoria !== "[]") naoVistoriaMap[mNoVistoria] = (naoVistoriaMap[mNoVistoria] || 0) + 1;
    if (mNoRemediacao && mNoRemediacao !== "[]") naoRemediacaoMap[mNoRemediacao] = (naoRemediacaoMap[mNoRemediacao] || 0) + 1;

    // 2. Execução das Regex do script RMD sobre os campos livres reais da Fato
    const txtLocalLimpo = String(campoOutroLocal).toLowerCase();
    if (txtLocalLimpo.trim() && txtLocalLimpo !== 'null') {
      if (/bromelia|planta|vaso/i.test(txtLocalLimpo)) mineracaoLocais["Bromélias (Paisagismo)"]++;
      else if (/laje|calha|telhado|rufo/i.test(txtLocalLimpo)) mineracaoLocais["Lajes / Calhas Obstruídas"]++;
      else if (/ar condicionado|condensadora|split/i.test(txtLocalLimpo)) mineracaoLocais["Bandejas de Ar Condicionado"]++;
      else if (/sapata|decantador|maquina|bomba/i.test(txtLocalLimpo)) mineracaoLocais["Estruturas Operacionais"]++;
    }

    const txtMotivoLimpo = String(campoOutroMotivo).toLowerCase();
    if (txtMotivoLimpo.trim() && txtMotivoLimpo !== 'null') {
      if (/recusa|nao permitiu|nao quis/i.test(txtMotivoLimpo)) mineracaoFalhas["Recusa Operacional"]++;
      else if (/fechado|trancado|vazio|ausente/i.test(txtMotivoLimpo)) mineracaoFalhas["Local Fechado / Sem Chave"]++;
      else if (/chuva|acesso dificil|temporal|clima/i.test(txtMotivoLimpo)) mineracaoFalhas["Fatores Climáticos Extremos"]++;
    }
  });

  // Renderização das Pizzas e Roscas (Paleta: Vermelho, Amarelo, Azul CEDAE e Cinza)
  gerarEstruturaGraficaSetor('locais', 'chartLocais', Object.keys(locaisMap), Object.values(locaisMap), ['#ef4444', '#eab308', '#0056b3', '#cbd5e1'], 'pie');
  gerarEstruturaGraficaSetor('naoVistoria', 'chartNaoVistoria', Object.keys(naoVistoriaMap), Object.values(naoVistoriaMap), ['#ef4444', '#eab308', '#64748b'], 'doughnut');
  gerarEstruturaGraficaSetor('naoRemediacao', 'chartNaoRemediacao', Object.keys(naoRemediacaoMap), Object.values(naoRemediacaoMap), ['#ef4444', '#eab308', '#001d3d'], 'doughnut');

  // Popula os quadros laterais de texto minerado via Regex
  renderizarListasDeTextoLivre("listaOutrosLocais", mineracaoLocais);
  renderizarListasDeTextoLivre("listaOutrosMotivos", mineracaoFalhas);
}

/**
 * UTILITÁRIO: ABSTRAÇÃO PARA RENDERIZAÇÃO DO CHART.JS
 */
function gerarEstruturaGraficaSetor(idChave, canvasId, labels, data, cores, tipo) {
  destruirInstanciaGrafico(idChave);
  const canvasElement = document.getElementById(canvasId);
  if (!canvasElement) return;

  graficosAtivos[idChave] = new Chart(canvasElement.getContext('2d'), {
    type: tipo,
    data: {
      labels: labels.length ? labels : ['Sem ocorrências'],
      datasets: [{
        data: data.length ? data : [0],
        backgroundColor: cores,
        borderColor: '#ffffff',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#334155', font: { size: 9 }, boxWidth: 10 }
        }
      }
    }
  });
}

/**
 * UTILITÁRIO: ATUALIZA AS TABELAS DE AUDITORIA DE TEXTO LIVRE ("OUTROS")
 */
function renderizarListasDeTextoLivre(domId, dicionarioContagem) {
  const container = document.getElementById(domId);
  container.innerHTML = "";

  const itensOrdenados = Object.entries(dicionarioContagem).sort((a, b) => b[1] - a[1]);
  const somaTotal = itensOrdenados.reduce((acc, c) => acc + c[1], 0);

  if (somaTotal === 0) {
    container.innerHTML = `<tr><td colspan="2" class="p-3 text-center text-gray-400 italic text-xs">Nenhum texto livre detectado para este filtro.</td></tr>`;
    return;
  }

  itensOrdenados.forEach(([chave, ocorrencias]) => {
    if (ocorrencias > 0) {
      container.innerHTML += `
        <tr class="hover:bg-gray-50 border-b border-gray-100 transition-colors text-xs text-gray-600">
          <td class="p-2.5 font-medium text-gray-700">${chave}</td>
          <td class="p-2.5 text-center font-bold text-gray-500">${ocorrencias}</td>
        </tr>`;
    }
  });
}

/**
 * DESTRUTOR DE INSTÂNCIAS DO CHART.JS
 */
function destruirInstanciaGrafico(idChave) {
  if (graficosAtivos[idChave]) {
    graficosAtivos[idChave].destroy();
    delete graficosAtivos[idChave];
  }
}

/**
 * EXPORTADOR DE RELATÓRIOS ACOPLADO AOS FILTROS
 */
function exportarRelatorio(tipo) {
  const unity = document.getElementById("filtroUnidade").value;
  const year = document.getElementById("filtroAno").value;
  const month = document.getElementById("filtroMes").value;
  const week = document.getElementById("filtroSemana").value;

  const params = new URLSearchParams({
    unidade: unity === "TODAS" ? "" : unity,
    ano: year === "TODOS" ? "" : year,
    mes: month === "TODOS" ? "" : month,
    semana: week === "TODAS" ? "" : week
  }).toString();

  window.open(`${ENDPOINT_API}/export/${tipo}?${params}`, '_blank');
}

// Substitua o bloco final do seu js/pages/aedes-painel.js por este:
document.addEventListener("DOMContentLoaded", () => {
  
  const btnPdf = document.getElementById("btnGerarPdf");

  if (btnPdf) {
    btnPdf.addEventListener("click", () => {
      // 1. Captura os seletores exatamente como estão mapeados no seu HTML
      const filtroUnidade = document.getElementById("filtroUnidade")?.value || "TODOS";
      const filtroAno = document.getElementById("filtroAno")?.value || "TODOS";

      // 2. Estado de carregamento visual no botão
      const textoOriginal = btnPdf.innerHTML;
      btnPdf.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processando PDF...`;
      btnPdf.disabled = true;

      // 3. 🟢 CHAMADA CORRETA: Usa o módulo central que injeta o host e o prefixo /api automaticamente!
      if (typeof AedesAPI !== "undefined" && typeof AedesAPI.downloadRelatorioPDF === "function") {
          AedesAPI.downloadRelatorioPDF(filtroUnidade, filtroAno);
      } else {
          // Fallback de segurança caso o módulo não tenha sido exposto globalmente
          const API_BASE = window.location.hostname === "localhost" ? "http://localhost:3001" : "https://dma-aedes-api.onrender.com";
          const urlRelatorio = `${API_BASE}/api/aedes/relatorio-pdf?unidade=${encodeURIComponent(filtroUnidade)}&ano=${encodeURIComponent(filtroAno)}`;
          window.open(urlRelatorio, '_blank');
      }

      // 4. Devolve o botão ao estado original após o disparo do download
      setTimeout(() => {
        btnPdf.innerHTML = textoOriginal;
        btnPdf.disabled = false;
      }, 2000);
    });
  }
});