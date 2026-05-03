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
        const [lotes, listaFocais] = await Promise.all([
            AedesAPI.getLotes(),
            AedesAPI.getFocais()
        ]);

        const dataMaster = [];
        lotes.forEach(lote => {
            const registros = lote.payload_completo?.registros || [];
            registros.forEach(reg => { dataMaster.push({ ...reg }); });
        });

        renderDados(dataMaster, listaFocais);
        setupNavigation();

    } catch (error) {
        console.error("Erro ao carregar dados:", error);
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

    tbodyConsolidada.innerHTML = data.map(reg => {
        const vist = String(reg.vistoriaRealizada || "").toLowerCase() === 'sim';
        const foco = vist ? (String(reg.focoEncontrado || "").toLowerCase() === 'sim') : null;
        const remd = (vist && foco) ? (String(reg.focoRemediado || "").toLowerCase() === 'sim') : null;

        if (reg.focal_nome) {
            stats.nomesQueEnviaram.add(reg.focal_nome.trim());
        }

        stats.t++;
        if (!vist) {
            stats.p++;
            if (stats.mV.hasOwnProperty(reg.motivosNaoVistoriaResumo)) stats.mV[reg.motivosNaoVistoriaResumo]++;
        }
        if (vist && foco) {
            stats.f++;
            if (remd) stats.r++;
            else if (stats.mR.hasOwnProperty(reg.motivosNaoRemediacaoResumo)) stats.mR[reg.motivosNaoRemediacaoResumo]++;
            if (stats.locais.hasOwnProperty(reg.locaisFocoResumo)) stats.locais[reg.locaisFocoResumo]++;
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

    document.getElementById('kpi-total').innerText = stats.t;
    document.getElementById('kpi-pendentes').innerText = stats.p;
    document.getElementById('kpi-focos').innerText = stats.f;
    document.getElementById('kpi-remediados').innerText = stats.r;

    // ✅ CORREÇÃO: chamadas corretas, sem duplicatas e sem função inexistente
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

function setupNavigation() {
    const btnPainel = document.getElementById('menu-painel');
    const btnConsol = document.getElementById('menu-consolidada');
    const secPainel = document.getElementById('section-painel');
    const secConsol = document.getElementById('section-consolidada');

    btnPainel?.addEventListener('click', () => {
        secPainel.style.display = 'block'; secConsol.style.display = 'none';
        btnPainel.classList.add('active'); btnConsol.classList.remove('active');
    });

    btnConsol?.addEventListener('click', () => {
        secPainel.style.display = 'none'; secConsol.style.display = 'block';
        btnConsol.classList.add('active'); btnPainel.classList.remove('active');
    });
}

document.addEventListener('DOMContentLoaded', inicializarDashboardAedes);