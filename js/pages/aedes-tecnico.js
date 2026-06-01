/**
 * Portal-DMA - CEDAE
 * Módulo de Controle de Vetores (Aedes aegypti)
 * Script de Integração da View Consolidada e Exportação Avançada com ExcelJS
 */

import { AedesAPI } from '../modules/aedes/aedes-api.js';

// Estado global dos dados na página para permitir filtros dinâmicos por semana
let DADOS_PAINEL_GLOBAL = [];

async function inicializarModuloAedes() {
    try {
        console.log("A carregar Módulo Aedes via View Consolidada do Banco...");

        // 1. Busca os dados já unificados e processados pela View SQL
        const dadosView = await AedesAPI.getConsolidadoView();

        if (!dadosView || dadosView.length === 0) {
            throw new Error("Nenhum dado retornado do banco de dados ou formato inválido.");
        }

        // Armazena a resposta pura no estado global
        DADOS_PAINEL_GLOBAL = dadosView;
        console.log("✅ Dados carregados com sucesso! Total de registros:", DADOS_PAINEL_GLOBAL.length);

        // 2. Renderiza os componentes na tela (Dropdown de Semanas e Tabela)
        configurarFiltrosSemana(DADOS_PAINEL_GLOBAL);
        renderizarTabelaConsolidada(DADOS_PAINEL_GLOBAL);

        // 3. Configura a ação do botão de exportação baseado no filtro atual da tela
        const btnExport = document.getElementById('btnExportExcel');
        if (btnExport) {
            btnExport.onclick = () => {
                const filtroAtual = document.getElementById('selectFiltroSemana').value;
                const dadosFiltrados = filtroAtual === 'todas' 
                    ? DADOS_PAINEL_GLOBAL 
                    : DADOS_PAINEL_GLOBAL.filter(d => d.semana_contagem == filtroAtual);
                exportarParaExcel(dadosFiltrados);
            };
        }

    } catch (error) {
        console.error("Erro crítico ao inicializar painel do Módulo Aedes:", error);
        exibirMensagemErroInterface(`Não foi possível sincronizar a matriz de dados. Motivo: ${error.message}`);
    }
}

/**
 * Monta dinamicamente o dropdown de semanas com os períodos calculados pela View
 */
function configurarFiltrosSemana(dados) {
    const selectSemana = document.getElementById('selectFiltroSemana');
    if (!selectSemana) return;

    // Isola as semanas existentes e ordena do maior para o menor (Mais recente primeiro)
    const semanasUnicas = [...new Set(dados.map(item => item.semana_contagem))].sort((a, b) => b - a);
    selectSemana.innerHTML = '<option value="todas">-- Todas as Semanas / Todo o Histórico --</option>';
    
    semanasUnicas.forEach(sem => {
        const amostraDado = dados.find(d => d.semana_contagem === sem);
        const labelPeriodo = amostraDado ? amostraDado.periodo_semana : '';
        
        const option = document.createElement('option');
        option.value = sem;
        option.textContent = sem === 0 ? 'Histórico (Pré-Portal)' : `Semana ${sem} (${labelPeriodo})`;
        selectSemana.appendChild(option);
    });

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
 * Renderiza a tabela HTML na tela mapeando as propriedades diretas da sua View SQL
 */
function renderizarTabelaConsolidada(dados) {
    const container = document.getElementById('containerTabelaAedes');
    if (!container) return;

    let html = `
        <table class="tabela-aedes-dma">
            <thead>
                <tr>
                    <th style="text-align: center; width: 110px;">Nº Semana</th>
                    <th>Período</th>
                    <th>Unidade CEDAE</th>
                    <th style="text-align: center;">Vistoria</th>
                    <th style="text-align: center;">Foco</th>
                    <th>Local do Foco</th>
                    <th style="text-align: center;">Remediação</th>
                    <th>Responsável / Focal</th>
                    <th style="text-align: center;">Data do Envio</th>
                </tr>
            </thead>
            <tbody>
    `;

    dados.forEach(item => {
        // Normalização das strings para checagem estável de status e classes CSS
        const vistoriaStr = String(item.vistoria || '-').trim();
        const vistoriaLower = vistoriaStr.toLowerCase();
        const focoLower = String(item.foco || '-').toLowerCase().trim();

        // Linha ganha cor cinza/amarelada se não houver informação ou a vistoria foi negativa
        let classeLinha = (vistoriaStr === 'Não Informado' || vistoriaLower === 'não' || vistoriaLower === 'nao' || vistoriaStr === '-') ? 'status-nao-informado' : '';
        // Célula do foco ganha cor vermelha de alerta se houver foco positivo
        let classeFoco = (focoLower === 'sim' || focoLower === 's') ? 'status-foco-alerta' : '';
        
        // Captura a data de envio tratando variações de colunas da view (data_real_envio ou data_envio)
        const campoData = item.data_real_envio || item.data_envio;
        const dataFormatada = campoData ? new Date(campoData).toLocaleDateString('pt-BR') : '-';
        
        const labelSemana = item.semana_contagem === 0 ? 'Histórico' : `Semana ${item.semana_contagem}`;
        const periodoSemana = item.periodo_semana || '-';
        const unidadeNome = item.unidade || '-';
        const remediacao = item.remediacao || '-';
        const focalNome = item.focal || item.focal_nome || '-';

        // Tratamento elegante para exibir justificativas caso não tenha sido vistoriado
        let localExibicao = item.local_foco || '-';
        if (vistoriaLower === 'não' || vistoriaLower === 'nao') {
            localExibicao = item.motivo_nao_vistoria ? `Não vistoriado: ${item.motivo_nao_vistoria}` : 'Não vistoriado';
        }

        html += `
            <tr class="${classeLinha}">
                <td style="text-align: center; font-weight: bold; color: #0f766e;">${labelSemana}</td>
                <td style="font-size: 11px; white-space: nowrap;">${periodoSemana}</td>
                <td><strong>${unidadeNome}</strong></td>
                <td style="text-align: center; font-weight: 500;">${vistoriaStr}</td>
                <td class="${classeFoco}" style="text-align: center;">${item.foco || '-'}</td>
                <td>${localExibicao}</td>
                <td style="text-align: center;">${remediacao}</td>
                <td>${focalNome}</td>
                <td style="text-align: center;">${dataFormatada}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Motor de Exportação Avançada utilizando ExcelJS mapeando diretamente a View SQL
 */
async function exportarParaExcel(dadosParaExportar) {
    if (typeof ExcelJS === 'undefined') {
        alert("Erro: A biblioteca ExcelJS não foi carregada na página.");
        return;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Painel Consolidado Aedes');

        // Estrutura exata das colunas do relatório XLSX baseado na View
        worksheet.columns = [
            { header: 'Nº SEMANA', key: 'semana_contagem', width: 14 },
            { header: 'PERÍODO COBERTURA', key: 'periodo_semana', width: 25 },
            { header: 'UNIDADE CEDAE', key: 'unidade', width: 32 },
            { header: 'VISTORIA REALIZADA', key: 'vistoria', width: 22 },
            { header: 'FOCO DETECTADO', key: 'foco', width: 18 },
            { header: 'LOCAL DO FOCO / MOTIVO', key: 'local_foco', width: 28 },
            { header: 'REMEDIAÇÃO', key: 'remediacao', width: 15 },
            { header: 'OBSERVAÇÕES TÉCNICAS', key: 'observacoes', width: 45 },
            { header: 'FOCAL RESPONSÁVEL', key: 'focal', width: 28 },
            { header: 'DATA REAL DE ENVIO', key: 'data_real_envio', width: 20 }
        ];

        dadosParaExportar.forEach(item => {
            const vistoriaStr = String(item.vistoria || '-').trim();
            const vistoriaLower = vistoriaStr.toLowerCase();
            const focoLower = String(item.foco || '-').toLowerCase().trim();
            
            const campoData = item.data_real_envio || item.data_envio;

            let localExibicao = item.local_foco || '-';
            if (vistoriaLower === 'não' || vistoriaLower === 'nao') {
                localExibicao = item.motivo_nao_vistoria ? `Não vistoriado: ${item.motivo_nao_vistoria}` : 'Não vistoriado';
            }

            const row = worksheet.addRow({
                semana_contagem: item.semana_contagem === 0 ? 'Histórico' : `Semana ${item.semana_contagem}`,
                periodo_semana: item.periodo_semana || '-',
                unidade: item.unidade || '-',
                vistoria: vistoriaStr,
                foco: item.foco || '-',
                local_foco: localExibicao,
                remediacao: item.remediacao || '-',
                observacoes: item.observacoes || '-',
                focal: item.focal || item.focal_nome || '-',
                data_real_envio: campoData ? new Date(campoData).toLocaleDateString('pt-BR') : '-'
            });

            // Alinhamentos visuais das células
            row.getCell('semana_contagem').alignment = { horizontal: 'center' };
            row.getCell('periodo_semana').alignment = { horizontal: 'center' };
            row.getCell('vistoria').alignment = { horizontal: 'center' };
            row.getCell('foco').alignment = { horizontal: 'center' };
            row.getCell('remediacao').alignment = { horizontal: 'center' };
            row.getCell('data_real_envio').alignment = { horizontal: 'center' };

            // Cor de fundo para unidades inadimplentes/não informadas (Amarelo bem suave)
            if (vistoriaStr === 'Não Informado' || vistoriaLower === 'não' || vistoriaLower === 'nao' || vistoriaStr === '-') {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F2' } };
                });
            }
            
            // Destaque crítico para focos positivos (Fundo vermelho claro, texto vermelho escuro e negrito)
            if (focoLower === 'sim' || focoLower === 's') {
                row.getCell('foco').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
                row.getCell('foco').font = { color: { argb: '991B1B' }, bold: true };
            }
        });

        // Estilização do cabeçalho oficial DMA (#0F766E - Verde institucional)
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 28;

        worksheet.autoFilter = 'A1:J1'; // Ativa as setas de filtro nativas do Excel
        worksheet.views = [{ state: 'frozen', ySplit: 1 }]; // Mantém o topo fixo ao rolar para baixo

        // Executa o download binário do arquivo .xlsx
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const filtroAtual = document.getElementById('selectFiltroSemana')?.value || 'Geral';
        const nomeArquivo = `CEDAE_Aedes_PainelConsolidado_Semana_${filtroAtual}.xlsx`;
        
        const url = window.URL.createObjectURL(blob);
        const linkDownload = document.createElement('a');
        linkDownload.href = url;
        linkDownload.download = nomeArquivo;
        linkDownload.click();
        
        window.URL.revokeObjectURL(url);
    } catch (erro) {
        console.error("Erro na exportação para Excel:", erro);
        alert("Erro técnico ao processar e fazer o download da planilha XLSX.");
    }
}

function exibirMensagemErroInterface(mensagem) {
    const container = document.getElementById('containerTabelaAedes');
    if (container) {
        container.innerHTML = `<div class="alert alert-danger">${mensagem}</div>`;
    }
}

// Escuta o carregamento seguro da árvore DOM antes de rodar
document.addEventListener("DOMContentLoaded", inicializarModuloAedes);