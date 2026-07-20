import { AedesAPI } from '../modules/aedes/aedes-api.js';

let meuGrafico = null;

// Garante a escuta correta do botão quando a janela carregar
document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btnProcessar');
    if (btn) {
        btn.addEventListener('click', inicializarDashboardAnalitico);
    }
});

async function inicializarDashboardAnalitico() {
    // 1. Processa a lista de unidades inadimplentes da semana usando o AedesAPI
    await processarAuditoriaSemanal();
    // 2. Busca os dados consolidados da View para renderizar os motivos estatísticos
    await carregarGraficoMotivos();
}

async function processarAuditoriaSemanal() {
    const ano = document.getElementById('txtAno').value;
    const mes = document.getElementById('selectMes').value;
    const semanaMes = document.getElementById('selectSemanaMes').value;
    
    const tbody = document.getElementById('corpoTabelaPendentes');
    const lblTotal = document.getElementById('lblTotalPendentes');
    const lblIntervalo = document.getElementById('lblIntervaloVigente');
    
    // Elementos dos novos contadores
    const lblEntrou = document.getElementById('lblQtdEntrou');
    const lblFocos = document.getElementById('lblQtdFocos');
    const lblRemediados = document.getElementById('lblQtdRemediados');

    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Auditando intervalo de datas...</td></tr>`;

    try {
        const pacoteDados = await AedesAPI.getUnidadesNaoEnviadas(ano, mes, semanaMes);

        if (!pacoteDados) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Falha ao carregar resposta do banco.</td></tr>`;
            return;
        }

  // Atualiza a referência visual da data vigente no topo da tela
        lblIntervalo.innerText = `Período: ${pacoteDados.intervalo}`;

        // Alimenta os novos mini cartões volumétricos
        lblEntrou.innerText = pacoteDados.metricas.qtd_entrou;
        lblFocos.innerText = pacoteDados.metricas.qtd_focos;
        lblRemediados.innerText = pacoteDados.metricas.qtd_remediados;

        // 💡 PROCESSAMENTO DA LISTA COM MOTIVOS DE NÃO REMEDIAÇÃO
        const wrapperFocos = document.getElementById('wrapperListaFocos');
        const containerListaFocos = document.getElementById('listaUnidadesComFoco');
        
        if (wrapperFocos && containerListaFocos) {
            const focosDetectados = pacoteDados.metricas.lista_focos || [];
            
            if (focosDetectados.length > 0) {
                wrapperFocos.style.display = 'block';
                containerListaFocos.innerHTML = '';
                
                focosDetectados.forEach(f => {
                    const ehRemediado = f.remediado === 'sim';
                    
                    const statusBadge = ehRemediado 
                        ? `<span style="background: #dcfce7; color: #15803d; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: auto;">Remediado</span>`
                        : `<span style="background: #fee2e2; color: #b91c1c; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-left: auto;">Pendente</span>`;
                    
                    // Se não foi remediado, monta um texto com a justificativa
                    const justificativaHtml = !ehRemediado && f.motivo_nao_remediado !== '-'
                        ? `<div style="font-size: 11px; color: #7f1d1d; background: #fef2f2; margin-top: 4px; padding: 4px 8px; border-radius: 4px; border-left: 3px solid #ef4444; width: 100%;">
                            <strong>Motivo:</strong> ${f.motivo_nao_remediado}
                           </div>`
                        : '';

                    const item = document.createElement('div');
                    item.style.cssText = "display: flex; flex-direction: column; background: white; padding: 8px 10px; border-radius: 6px; border: 1px solid #e2e8f0;";
                    
                    item.innerHTML = `
                        <div style="display: flex; align-items: center; width: 100%;">
                            <span style="font-weight: 600; color: #1e293b; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${f.unidade}</span> 
                            ${statusBadge}
                        </div>
                        ${justificativaHtml}
                    `;
                    
                    containerListaFocos.appendChild(item);
                });
            } else {
                wrapperFocos.style.display = 'none';
            }
        }

        // Segue com o processamento das unidades inadimplentes
        const dadosInadimplentes = pacoteDados.nao_enviados;
        lblTotal.innerText = dadosInadimplentes.length;
        tbody.innerHTML = '';

        if (dadosInadimplentes.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:#16a34a; font-weight:bold;"><i class="fas fa-check-circle"></i> 100% Regular! Todas as frentes enviaram relatórios neste período.</td></tr>`;
            return;
        }

        dadosInadimplentes.forEach(unidade => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>#${unidade.unidade_id || '-'}</td>
                <td><strong>${unidade.nome_unidade}</strong></td>
                <td>${unidade.focal_name || '<span style="color:#94a3b8; font-style:italic;">Não Definido</span>'}</td>
                <td><span class="badge-alert">NÃO ENVIADO</span></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color:red;">Erro ao processar mapeamento no servidor.</td></tr>`;
    }
}

async function carregarGraficoMotivos() {
    try {
        // Reaproveita a rota que já criamos no servidor para colher os motivos reais
        const resposta = await fetch(`${window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://dma-aedes-api.onrender.com'}/api/aedes/views/motivos-nao-vistoria`);
        const dadosView = await resposta.json();

        const labels = dadosView.map(item => item.motivo);
        const valores = dadosView.map(item => parseInt(item.whitespace_original || item.quantidade));

        renderizarGraficoRosca(labels, valores);
    } catch (error) {
        console.error("Erro ao gerar gráfico de pizza analítico:", error);
    }
}

function renderizarGraficoRosca(labels, valores) {
    const canvas = document.getElementById('chartPendencias');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (meuGrafico) {
        meuGrafico.destroy();
    }

    meuGrafico = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels.length > 0 ? labels : ['Sem ocorrências'],
            datasets: [{
                data: valores.length > 0 ? valores : [0],
                backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#6366f1', '#ec4899'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } },
                title: { display: true, text: 'Distribuição Histórica de Justificativas (Não Vistoria)', font: { weight: 'bold' } }
            }
        }
    });
}