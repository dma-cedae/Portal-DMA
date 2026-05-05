import { AedesAPI } from '../modules/aedes/aedes-api.js';

const MOTIVOS_NAO_VISTORIA_OPTIONS = [
    { value: "sem_condicao_acesso", label: "Sem acesso" },
    { value: "sem_brigadista", label: "Sem brigadista" },
    { value: "sem_viatura_disponivel", label: "Sem viatura disponível" },
    { value: "esquecimento", label: "Esquecimento" },
    { value: "outros", label: "Outros" }
];

const MOTIVOS_NAO_REMEDIACAO_OPTIONS = [
    { value: "falta_de_treinamento_capacitacao", label: "Falta de treinamento/capacitação" },
    { value: "falta_de_cloro_larvicida", label: "Falta de cloro/larvicida" },
    { value: "necessidade_limpeza_terreno", label: "Necessidade de limpeza do terreno" },
    { value: "reservatorio_sem_cobertura", label: "Reservatório sem cobertura" },
    { value: "aguardando_responsavel_local", label: "Aguardando responsável local" },
    { value: "outros", label: "Outros" }
];

const LOCAIS_FOCO_OPTIONS = [
    { value: "objetos_acumulando_agua", label: "Objetos acumulando água" },
    { value: "reservatorio_de_agua", label: "Reservatório de água" },
    { value: "calha", label: "Calha ou ralos" },
    { value: "bromelias", label: "Bromélias ou vasos de plantas" },
    { value: "outros", label: "Outros" }
];

async function inicializarDashboardAedes() {
    try {
        // CORREÇÃO: Removido o 'new' pois AedesAPI é um objeto estático
        const [lotes, listaFocais] = await Promise.all([
            AedesAPI.getLotes(),
            AedesAPI.getFocais()
        ]);

        const dataMaster = [];

        lotes.forEach(lote => {
            const registros = lote.payload_completo?.dados || [];
            const nomeDoFocal = lote.focal_nome || "Não Identificado";

            registros.forEach(reg => { 
                dataMaster.push({
                    focal_nome: nomeDoFocal,
                    unidadeId: reg[0],
                    unidade: reg[1],
                    vistoriaRealizada: reg[2],
                    focoEncontrado: reg[3],
                    focoRemediado: reg[4],
                    locaisFocoResumo: Array.isArray(reg[5]) ? reg[5].join(", ") : reg[5], 
                    motivosNaoVistoriaResumo: Array.isArray(reg[6]) ? reg[6][0] : reg[6],
                    motivosNaoRemediacaoResumo: Array.isArray(reg[7]) ? reg[7][0] : reg[7],
                    observacoes: reg[8]
                }); 
            });
        });

        // Renderiza a interface existente
        if (typeof renderDados === "function") {
            renderDados(dataMaster, listaFocais);
        }

        // Inicializa a navegação passando os dados processados
        setupNavigation(dataMaster);

    } catch (error) {
        console.error("❌ Erro na inicialização do Dashboard:", error);
    }
}


function renderDados(data, listaFocais) {
    const stats = {
        t: 0, p: 0, f: 0, r: 0,
        mV: Object.fromEntries(MOTIVOS_NAO_VISTORIA_OPTIONS.map(o => [o.label, 0])),
        mR: Object.fromEntries(MOTIVOS_NAO_REMEDIACAO_OPTIONS.map(o => [o.label, 0])),
        locais: Object.fromEntries(LOCAIS_FOCO_OPTIONS.map(o => [o.label, 0])),
        nomesQueEnviaram: new Set()
    };

    const tbodyConsolidada = document.getElementById('table-body-consolidada');
    const tbodyFocais = document.getElementById('table-body-focais');

    if (!tbodyConsolidada) return;

    tbodyConsolidada.innerHTML = data.map(reg => {
        const vist = String(reg.vistoriaRealizada || "").toLowerCase() === 'sim';
        const foco = vist ? (String(reg.focoEncontrado || "").toLowerCase() === 'sim') : null;
        const remd = (vist && foco) ? (String(reg.focoRemediado || "").toLowerCase() === 'sim') : null;

        if (reg.focal_nome) {
            stats.nomesQueEnviaram.add(reg.focal_nome.trim());
        }

        stats.t++;
        
        // Contagem de motivos de não vistoria
        if (!vist) {
            stats.p++;
            const labelMotivo = MOTIVOS_NAO_VISTORIA_OPTIONS.find(o => o.value === reg.motivosNaoVistoriaResumo)?.label;
            if (labelMotivo && stats.mV.hasOwnProperty(labelMotivo)) stats.mV[labelMotivo]++;
        }
        
        // Contagem de focos e remediação
        if (vist && foco) {
            stats.f++;
            if (remd) {
                stats.r++;
            } else {
                const labelMotivoR = MOTIVOS_NAO_REMEDIACAO_OPTIONS.find(o => o.value === reg.motivosNaoRemediacaoResumo)?.label;
                if (labelMotivoR && stats.mR.hasOwnProperty(labelMotivoR)) stats.mR[labelMotivoR]++;
            }
            
            const labelLocal = LOCAIS_FOCO_OPTIONS.find(o => o.value === reg.locaisFocoResumo)?.label;
            if (labelLocal && stats.locais.hasOwnProperty(labelLocal)) stats.locais[labelLocal]++;
        }

        return `
            <tr>
                <td><strong>${reg.unidade || 'S/N'}</strong></td>
                <td><span class="badge ${vist ? 'badge-sim' : 'badge-nao'}">${vist ? 'Sim' : '🚨Não'}</span></td>
                <td>${vist ? (foco ? '🚨 Sim' : 'Não') : '-'}</td>
                <td>${(vist && foco) ? (remd ? 'Sim' : '🚨Não') : '-'}</td>
                <td>${reg.motivosNaoVistoriaResumo || '-'}</td>
                <td>${reg.motivosNaoRemediacaoResumo || '-'}</td>
                <td><small>${reg.observacoes || '-'}</small></td>
            </tr>`;
    }).join('');

    // Renderização da tabela de Focais (Status de envio)
    if (tbodyFocais && listaFocais) {
        tbodyFocais.innerHTML = listaFocais.map(f => {
            const enviou = stats.nomesQueEnviaram.has(f.nome.trim());
            return `
                <tr>
                    <td><strong>${f.nome}</strong></td>
                    <td style="text-align: center;">
                        <span class="badge ${enviou ? 'badge-sim' : 'badge-nao'}" style="width: 100px;">
                            <i class="fas ${enviou ? 'fa-check-circle' : 'fa-clock'}"></i> 
                            ${enviou ? 'ENVIADO' : 'PENDENTE'}
                        </span>
                    </td>
                </tr>`;
        }).join('');
    }

    // KPIs principais
    document.getElementById('kpi-total').innerText = stats.t;
    document.getElementById('kpi-pendentes').innerText = stats.p;
    document.getElementById('kpi-focos').innerText = stats.f;
    document.getElementById('kpi-remediados').innerText = stats.r;

    // Renderização dos Gráficos
    renderVistoriaChart('chart-motivos-vistoria', stats.mV);
    renderParetoRemediacao('chart-motivos-remediacao', stats.mR);
    renderLocaisChart('chart-locais-foco', stats.locais);
}
// ✨ Gráfico moderno de motivos de não vistoria — barras horizontais com gradiente e destaque
function renderVistoriaChart(canvasId, dataMap) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvasId);
    if (existing) existing.destroy();

    const labels = Object.keys(dataMap);
    const values = Object.values(dataMap);
    const total = values.reduce((a, b) => a + b, 0);
    const maxVal = Math.max(...values, 1);

    // Plugin customizado: desenha mini-percentual e barra de fundo estilo "track"
    const trackPlugin = {
        id: 'trackPlugin',
        beforeDatasetsDraw(chart) {
            const { ctx, chartArea: { left, right, top }, scales: { y, x } } = chart;
            const trackHeight = 10;
            const radius = 5;

            chart.data.labels.forEach((label, i) => {
                const yPos = y.getPixelForValue(i);
                const trackY = yPos - trackHeight / 2;
                const trackWidth = right - left;

                // Fundo da trilha (track)
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(left, trackY, trackWidth, trackHeight, radius);
                ctx.fillStyle = 'rgba(226, 232, 240, 0.6)';
                ctx.fill();
                ctx.restore();
            });
        }
    };

    new Chart(canvas, {
        type: 'bar',
        plugins: [trackPlugin],
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: function(context) {
                    const chart = context.chart;
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return '#f59e0b';
                    const val = values[context.dataIndex];
                    const intensity = val / maxVal;
                    // Gradiente do amarelo quente ao laranja-vermelho conforme intensidade
                    const gradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
                    if (intensity > 0.6) {
                        gradient.addColorStop(0, '#f59e0b');
                        gradient.addColorStop(1, '#ef4444');
                    } else if (intensity > 0.3) {
                        gradient.addColorStop(0, '#fbbf24');
                        gradient.addColorStop(1, '#f97316');
                    } else {
                        gradient.addColorStop(0, '#fde68a');
                        gradient.addColorStop(1, '#fbbf24');
                    }
                    return gradient;
                },
                borderRadius: 5,
                borderSkipped: false,
                barThickness: 10
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 900,
                easing: 'easeOutQuart'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { size: 11, weight: 'bold' },
                    bodyFont: { size: 10 },
                    callbacks: {
                        label: function(context) {
                            const val = context.raw;
                            const pct = total > 0 ? ((val / total) * 100).toFixed(0) : 0;
                            return ` ${val} ocorrência${val !== 1 ? 's' : ''} (${pct}% do total)`;
                        }
                    }
                }
            },
            layout: { padding: { right: 50 } },
            scales: {
                x: {
                    display: false,
                    beginAtZero: true,
                    max: maxVal * 1.3
                },
                y: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        font: { size: 10, weight: '600' },
                        color: '#475569',
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            return label.length > 18 ? label.match(/.{1,18}(\s|$)/g).map(s => s.trim()) : label;
                        }
                    }
                }
            }
        },
        // Plugin inline para desenhar o valor e % à direita de cada barra
        plugins: [trackPlugin, {
            id: 'valueLabels',
            afterDatasetsDraw(chart) {
                const { ctx, scales: { x, y } } = chart;
                chart.data.datasets[0].data.forEach((val, i) => {
                    const xPos = x.getPixelForValue(val);
                    const yPos = y.getPixelForValue(i);
                    const pct = total > 0 ? ((val / total) * 100).toFixed(0) : 0;

                    ctx.save();
                    ctx.font = 'bold 10px Segoe UI';
                    ctx.fillStyle = val > maxVal * 0.6 ? '#dc2626' : '#64748b';
                    ctx.textAlign = 'left';
                    ctx.fillText(`${val}  (${pct}%)`, xPos + 8, yPos + 4);
                    ctx.restore();
                });
            }
        }]
    });
}

// Gráfico de barras horizontais para motivos de não remediação (Pareto simplificado)
function renderParetoRemediacao(canvasId, dict) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvasId);
    if (existing) existing.destroy();

    // Ordena do maior para o menor (estilo Pareto)
    const sorted = Object.entries(dict).sort((a, b) => b[1] - a[1]);
    const labels = sorted.map(([k]) => k);
    const values = sorted.map(([, v]) => v);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                data: values,
                backgroundColor: values.map(v => v > 0 ? '#ef4444' : '#cbd5e1'),
                borderRadius: 5,
                barThickness: 18
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 800, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    callbacks: {
                        label: ctx => ` ${ctx.raw} caso${ctx.raw !== 1 ? 's' : ''}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: { precision: 0, color: '#94a3b8', font: { size: 10 } }
                },
                y: {
                    grid: { display: false },
                    border: { display: false },
                    ticks: {
                        autoSkip: false,
                        font: { size: 10, weight: 'bold' },
                        color: '#475569',
                        callback: function(value) {
                            const label = this.getLabelForValue(value);
                            return label.length > 18 ? label.match(/.{1,18}(\s|$)/g).map(s => s.trim()) : label;
                        }
                    }
                }
            }
        }
    });
}

// Gráfico de Área Polar para Locais de Foco
function renderLocaisChart(canvasId, dict) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const existing = Chart.getChart(canvasId);
    if (existing) existing.destroy();

    new Chart(canvas, {
        type: 'polarArea',
        data: {
            labels: Object.keys(dict),
            datasets: [{
                data: Object.values(dict),
                backgroundColor: [
                    'rgba(59, 130, 246, 0.7)',
                    'rgba(16, 185, 129, 0.7)',
                    'rgba(245, 158, 11, 0.7)',
                    'rgba(239, 68, 68, 0.7)',
                    'rgba(100, 116, 139, 0.7)'
                ],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 900, easing: 'easeOutBack' },
            scales: { r: { ticks: { display: false } } },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { boxWidth: 12, font: { size: 10 } }
                }
            }
        }
    });
}
function setupNavigation(dataMaster) {
    const btnPainel = document.getElementById('menu-painel');
    const btnConsol = document.getElementById('menu-consolidada');
    const btnRelat = document.getElementById('menu-relatorios');

    const secPainel = document.getElementById('section-painel');
    const secConsol = document.getElementById('section-consolidada');
    const secRelat = document.getElementById('section-relatorios');

    const alternar = (btnAtivo, secExibir) => {
        // Gerencia classes active
        [btnPainel, btnConsol, btnRelat].forEach(b => b?.classList.remove('active'));
        // Gerencia visibilidade das seções
        [secPainel, secConsol, secRelat].forEach(s => { if(s) s.style.display = 'none'; });
        
        btnAtivo?.classList.add('active');
        if(secExibir) secExibir.style.display = 'block';
    };

    btnPainel?.addEventListener('click', () => alternar(btnPainel, secPainel));
    btnConsol?.addEventListener('click', () => alternar(btnConsol, secConsol));
    
    btnRelat?.addEventListener('click', () => {
        alternar(btnRelat, secRelat);
        const container = document.getElementById('conteudo-relatorio');
        
        // Gera o relatório usando os dados que já temos na memória
        container.innerHTML = gerarRelatorioTexto(dataMaster);
    });
}

function gerarRelatorioTexto(dados) {
    const vistorias = dados.filter(d => d.vistoriaRealizada === 'sim');
    const focos = vistorias.filter(d => d.focoEncontrado === 'sim');
    const remediados = focos.filter(d => d.focoRemediado === 'sim');
    
    // Cálculos de Performance
    const taxaInfestacao = vistorias.length > 0 ? ((focos.length / vistorias.length) * 100).toFixed(1) : 0;
    const taxaRemediacao = focos.length > 0 ? ((remediados.length / focos.length) * 100).toFixed(1) : 0;

    // Cruzamento de Dados: Foco vs Motivo de Não Remediação
    const analiseCruzada = {};
    focos.filter(f => f.focoRemediado === 'nao').forEach(f => {
        const chave = `${f.locaisFocoResumo} | ${f.motivosNaoRemediacaoResumo}`;
        analiseCruzada[chave] = (analiseCruzada[chave] || 0) + 1;
    });

    const topFalhas = Object.entries(analiseCruzada)
        .sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Unidades Modelo (Exemplo de 3 unidades com 100% conformidade)
    const modelos = vistorias.filter(v => v.focoEncontrado === 'nao').slice(0, 3);

    return `
    <div id="relatorio-tecnico-print" style="padding: 40px; background: #fff; font-family: 'Segoe UI', Tahoma, sans-serif; color: #1e293b; max-width: 900px; margin: auto; border: 1px solid #e2e8f0;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0b3d91; padding-bottom: 20px; margin-bottom: 30px;">
            <div>
                <h1 style="color: #0b3d91; font-size: 22pt; margin: 0; letter-spacing: -1px;">PARECER TÉCNICO DE BIOMONITORAMENTO</h1>
                <p style="margin: 5px 0 0 0; color: #64748b; font-size: 10pt; font-weight: bold;">MÓDULO AEDES | DEPARTAMENTO DE MANUTENÇÃO AMBIENTAL</p>
            </div>
            <div style="text-align: right;">
                <button onclick="window.print()" class="no-print" style="background: #0b3d91; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    <i class="fas fa-print"></i> EXPORTAR PARA PDF
                </button>
                <p style="font-size: 9pt; color: #94a3b8; margin-top: 10px;">Gerado em: ${new Date().toLocaleString()}</p>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 40px;">
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; text-align: center;">
                <span style="font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase;">Taxa de Infestação</span>
                <h2 style="font-size: 24pt; color: #ef4444; margin: 10px 0;">${taxaInfestacao}%</h2>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${taxaInfestacao}%; background: #ef4444; height: 100%;"></div>
                </div>
            </div>
            <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 20px; border-radius: 8px; text-align: center;">
                <span style="font-size: 8pt; font-weight: bold; color: #64748b; text-transform: uppercase;">Eficiência de Remediação</span>
                <h2 style="font-size: 24pt; color: #22c55e; margin: 10px 0;">${taxaRemediacao}%</h2>
                <div style="height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;">
                    <div style="width: ${taxaRemediacao}%; background: #22c55e; height: 100%;"></div>
                </div>
            </div>
            <div style="background: #0b3d91; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                <span style="font-size: 8pt; font-weight: bold; text-transform: uppercase; opacity: 0.8;">Unidades Modelo</span>
                <h2 style="font-size: 24pt; margin: 10px 0;">${modelos.length}</h2>
                <span style="font-size: 8pt;">STATUS: CONFORMIDADE</span>
            </div>
        </div>

        <div style="margin-bottom: 40px;">
            <h3 style="font-size: 12pt; border-left: 4px solid #0b3d91; padding-left: 10px; margin-bottom: 15px; color: #0b3d91;">DIAGNÓSTICO DE CAUSA RAIZ (FOCO vs IMPEDIMENTO)</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
                <thead>
                    <tr style="background: #f1f5f9; text-align: left;">
                        <th style="padding: 12px; border-bottom: 2px solid #cbd5e1;">Local do Foco</th>
                        <th style="padding: 12px; border-bottom: 2px solid #cbd5e1;">Motivo Principal de Não Remediação</th>
                        <th style="padding: 12px; border-bottom: 2px solid #cbd5e1; text-align: center;">Ocorrências</th>
                    </tr>
                </thead>
                <tbody>
                    ${topFalhas.length > 0 ? topFalhas.map(([chave, qtd]) => {
                        const [local, motivo] = chave.split(' | ');
                        return `
                        <tr>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0;"><strong>${local}</strong></td>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #ef4444;">${motivo}</td>
                            <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: bold;">${qtd}</td>
                        </tr>`;
                    }).join('') : '<tr><td colspan="3" style="padding: 20px; text-align: center; color: #64748b;">Nenhuma falha crítica de remediação detectada no período.</td></tr>'}
                </tbody>
            </table>
        </div>

        <div style="margin-bottom: 40px;">
            <h3 style="font-size: 12pt; border-left: 4px solid #22c55e; padding-left: 10px; margin-bottom: 15px; color: #166534;">BENCHMARK: UNIDADES DE REFERÊNCIA</h3>
            <div style="display: flex; gap: 10px;">
                ${modelos.map(u => `
                    <div style="flex: 1; border: 1px solid #bbf7d0; background: #f0fdf4; padding: 10px; border-radius: 4px; text-align: center;">
                        <i class="fas fa-certificate" style="color: #22c55e; margin-bottom: 5px;"></i><br>
                        <span style="font-size: 9pt; font-weight: bold; color: #166534;">${u.unidade}</span>
                    </div>
                `).join('')}
            </div>
        </div>

        <div style="padding: 20px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            <h4 style="margin: 0 0 10px 0; font-size: 11pt; color: #0b3d91;">RECOMENDAÇÕES DA ENGENHARIA AMBIENTAL</h4>
            <p style="font-size: 10pt; line-height: 1.6; color: #334155; margin: 0;">
                Considerando os dados apresentados, a taxa de remediação de <strong>${taxaRemediacao}%</strong> exige atenção imediata às falhas de <strong>${topFalhas[0] ? topFalhas[0][0].split(' | ')[1] : 'logística'}</strong>. 
                Recomenda-se o reforço das barreiras físicas nas unidades críticas para evitar a dispersão do vetor nas próximas 72 horas.
            </p>
        </div>

        <div style="margin-top: 50px; display: flex; justify-content: space-between; align-items: flex-end;">
            <div style="width: 200px; border-top: 1px solid #94a3b8; text-align: center; padding-top: 5px; font-size: 8pt; color: #64748b;">
                Responsável Técnico
            </div>
            <div style="text-align: right; font-size: 8pt; color: #94a3b8;">
                Documento Digitalizado - Sistema Integrado de Gestão Ambiental (SIGA)
            </div>
        </div>
    </div>
    `;
}
document.addEventListener('DOMContentLoaded', inicializarDashboardAedes);