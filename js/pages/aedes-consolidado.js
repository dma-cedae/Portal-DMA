/**
 * Portal-DMA - CEDAE
 * Módulo de Controle de Vetores (Aedes aegypti)
 * Script de Integração da View Consolidada e Exportação Avançada com ExcelJS
 */

import { AedesAPI } from '../modules/aedes/aedes-api.js';

// Mapeamento de Labels para exibição amigável na interface do site
const LABELS_MAP = {
    "objetos_acumulando_agua": "Objetos acumulando água",
    "reservatorio_de_agua": "Reservatório de água",
    "bromelias": "Bromélias",
    "outros": "Outros",
    "sem_condicao_acesso": "Sem acesso",
    "sem_brigadista": "Sem brigadista",
    "sem_viatura_disponivel": "Sem viatura disponível",
    "esquecimento": "Esquecimento",
    "falta_de_cloro_larvicida": "Falta de cloro/larvicida",
    "necessidade_limpeza_terreno": "Necessidade de limpeza do terreno",
    "reservatorio_sem_cobertura": "Reservatório sem cobertura"
};

// Estado global dos dados na página para permitir filtros dinâmicos por semana
let DADOS_PAINEL_GLOBAL = [];

async function inicializarModuloAedes() {
    try {
        console.log("A carregar Módulo Aedes via View Consolidada...");

        // 1. Captura os dados unificados (Histórico + Portal + Não Informados) do Backend no Render
        // Nota: Altere a URL abaixo caso seu endpoint use outro caminho
        const resposta = await fetch('/api/aedes/consolidado');
        const json = await resposta.json();

        if (!json.sucesso) {
            throw new Error(json.erro || "Falha ao obter dados do servidor.");
        }

        DADOS_PAINEL_GLOBAL = json.dados;

        // 2. Renderiza os componentes na tela (Filtros e Tabela)
        configurarFiltrosSemana(DADOS_PAINEL_GLOBAL);
        renderizarTabelaConsolidada(DADOS_PAINEL_GLOBAL);

        // 3. Configura os ouvintes de clique para exportação
        const btnExport = document.getElementById('btnExportExcel');
        if (btnExport) {
            btnExport.onclick = () => exportarParaExcel(DADOS_PAINEL_GLOBAL);
        }

    } catch (error) {
        console.error("Erro crítico ao inicializar painel do Módulo Aedes:", error);
        exibirMensagemErroInterface("Não foi possível carregar os dados do painel de controle.");
    }
}

/**
 * Monta dinamicamente um select/dropdown de semanas para que o usuário possa filtrar a tela
 */
function configurarFiltrosSemana(dados) {
    const selectSemana = document.getElementById('selectFiltroSemana');
    if (!selectSemana) return;

    // Obtém todas as semanas únicas presentes no banco (incluindo a Semana 0 de histórico)
    const semanasUnicas = [...new Set(dados.map(item => item.semana_contagem))].sort((a, b) => b - a);

    selectSemana.innerHTML = '<option value="todas">-- Todas as Semanas / Todo o Histórico --</option>';
    
    semanasUnicas.forEach(sem => {
        const amostraDado = dados.find(d => d.semana_contagem === sem);
        const labelPeriodo = amostraDado ? amostraDado.periodo_semana : '';
        
        const option = document.createElement('option');
        option.value = sem;
        option.textContent = sem === 0 ? 'Histórico (Antes do Portal-DMA)' : `Semana ${sem} (${labelPeriodo})`;
        selectSemana.appendChild(option);
    });

    // Evento de mudança no filtro
    selectSemana.onchange = (e) => {
        const valorFiltro = e.target.value;
        if (valorFiltro === 'todas') {
            renderizarTabelaConsolidada(DADOS_PAINEL_GLOBAL);
        } else {
            const dadosFiltrados = DADOS_PAINEL_GLOBAL.filter(d => d.semana_contagem == valorFiltro);
            renderizarTabelaConsolidada(dadosFiltrados);
        }
    };
}

/**
 * Renderiza a tabela HTML na tela do Portal-DMA
 */
function renderizarTabelaConsolidada(dados) {
    const container = document.getElementById('containerTabelaAedes');
    if (!container) return;

    if (!dados || dados.length === 0) {
        container.innerHTML = '<div class="alert alert-info">Nenhum registro encontrado para o período selecionado.</div>';
        return;
    }

    let html = `
        <table class="tabela-aedes-dma">
            <thead>
                <tr>
                    <th>Semana</th>
                    <th>Período</th>
                    <th>Unidade CEDAE</th>
                    <th>Vistoria</th>
                    <th>Foco</th>
                    <th>Local do Foco</th>
                    <th>Remediação</th>
                    <th>Responsável / Focal</th>
                    <th>Data do Envio</th>
                </tr>
            </thead>
            <tbody>
    `;

    dados.forEach(item => {
        // Classes css dinâmicas para colorir o status de "Não Informado" ou Focos Detectados
        let classeVistoria = '';
        if (item.vistoria === 'Não Informado') classeVistoria = 'status-nao-informado';
        else if (item.vistoria === 'sim') classeVistoria = 'status-sim';
        else if (item.vistoria === 'nao') classeVistoria = 'status-nao';

        let classeFoco = item.foco === 'sim' ? 'status-foco-alerta' : '';
        const dataFormatada = item.data_real_envio ? new Date(item.data_real_envio).toLocaleDateString('pt-BR') : '-';

        html += `
            <tr>
                <td style="text-align: center; font-weight: bold;">${item.semana_contagem === 0 ? 'Histórico' : item.semana_contagem}</td>
                <td style="font-size: 11px;">${item.periodo_semana}</td>
                <td><strong>${item.unidade}</strong></td>
                <td class="${classeVistoria}" style="text-align: center;">${item.vistoria}</td>
                <td class="${classeFoco}" style="text-align: center;">${item.foco}</td>
                <td>${item.local_foco || '-'}</td>
                <td style="text-align: center;">${item.remediacao}</td>
                <td>${item.focal}</td>
                <td style="text-align: center;">${dataFormatada}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Motor de Exportação Avançada utilizando ExcelJS
 */
async function exportarParaExcel(dadosParaExportar) {
    if (typeof ExcelJS === 'undefined') {
        alert("Erro: A biblioteca ExcelJS não foi carregada nesta página. Verifique os scripts da página.");
        return;
    }

    try {
        console.log("Iniciando exportação de " + dadosParaExportar.length + " registros...");
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Painel Consolidado Aedes');

        // Configuração estrutural rígida das colunas da planilha conforme a VIEW do Neon
        worksheet.columns = [
            { header: 'Nº SEMANA', key: 'semana_contagem', width: 12 },
            { header: 'PERÍODO COBERTURA', key: 'periodo_semana', width: 25 },
            { header: 'UNIDADE CEDAE', key: 'unidade', width: 32 },
            { header: 'VISTORIA REALIZADA', key: 'vistoria', width: 22 },
            { header: 'FOCO DETECTADO', key: 'foco', width: 18 },
            { header: 'LOCAL DO FOCO', key: 'local_foco', width: 28 },
            { header: 'REMEDIAÇÃO', key: 'remediacao', width: 15 },
            { header: 'OBSERVAÇÕES TÉCNICAS', key: 'observacoes', width: 45 },
            { header: 'FOCAL RESPONSÁVEL', key: 'focal', width: 28 },
            { header: 'DATA REAL DE ENVIO', key: 'data_real_envio', width: 20 }
        ];

        // Adiciona as linhas na planilha e aplica validações estilísticas
        dadosParaExportar.forEach(item => {
            const row = worksheet.addRow({
                semana_contagem: item.semana_contagem === 0 ? 'Histórico' : item.semana_contagem,
                periodo_semana: item.periodo_semana,
                unidade: item.unidade,
                vistoria: item.vistoria,
                foco: item.foco,
                local_foco: item.local_foco,
                remediacao: item.remediacao,
                observacoes: item.observacoes,
                focal: item.focal,
                data_real_envio: item.data_real_envio ? new Date(item.data_real_envio).toLocaleDateString('pt-BR') : '-'
            });

            // Alinhamentos de legibilidade das células de status e datas
            row.getCell('semana_contagem').alignment = { horizontal: 'center' };
            row.getCell('periodo_semana').alignment = { horizontal: 'center' };
            row.getCell('vistoria').alignment = { horizontal: 'center' };
            row.getCell('foco').alignment = { horizontal: 'center' };
            row.getCell('remediacao').alignment = { horizontal: 'center' };
            row.getCell('data_real_envio').alignment = { horizontal: 'center' };

            // Regra visual de destaque: Se não foi informado, pinta a linha sutilmente de cinza/amarelo claro
            if (item.vistoria === 'Não Informado') {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF9F2' } // Alerta suave para ausência de preenchimento
                    };
                });
            }
            
            // Se houver foco positivo de dengue/larvas, destaca a célula em vermelho claro
            if (item.foco === 'sim') {
                row.getCell('foco').fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FEE2E2' }
                };
                row.getCell('foco').font = { color: { argb: '991B1B' }, bold: true };
            }
        });

        // Estilização do Cabeçalho Principal (Verde CEDAE institucional)
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } }; // Teal escuro
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 28;

        // Ativa os filtros automáticos nativos do Excel no topo das colunas
        worksheet.autoFilter = 'A1:J1';

        // Congela a primeira linha (cabeçalho) para que permaneça visível ao dar scroll
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        // Dispara a geração do buffer binário e download direto no navegador
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const nomeArquivo = `CEDAE_Aedes_PainelConsolidado_Semana_${document.getElementById('selectFiltroSemana')?.value || 'Geral'}.xlsx`;
        
        const url = window.URL.createObjectURL(blob);
        const linkDownload = document.createElement('a');
        linkDownload.href = url;
        linkDownload.download = nomeArquivo;
        linkDownload.click();
        
        // Limpa a memória lógica da URL temporária
        window.URL.revokeObjectURL(url);
        console.log("Planilha baixada com sucesso pelo usuário.");

    } catch (erro) {
        console.error("Erro interno no motor do ExcelJS durante a exportação:", erro);
        alert("Erro técnico: Não foi possível processar a planilha XLSX.");
    }
}

function exibirMensagemErroInterface(mensagem) {
    const container = document.getElementById('containerTabelaAedes');
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${mensagem}</div>`;
    }
}

// Inicializa automaticamente o módulo assim que o DOM do Portal-DMA estiver pronto
document.addEventListener("DOMContentLoaded", inicializarModuloAedes);