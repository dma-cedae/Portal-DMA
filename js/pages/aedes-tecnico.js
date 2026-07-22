/**
 * Portal-DMA - CEDAE
 * Módulo de Controle de Vetores (Aedes aegypti)
 * Script de Integração da Tabela Física e Exportação Avançada com ExcelJS
 */

import { AedesAPI } from '../modules/aedes/aedes-api.js';

// Estado global dos dados na página para permitir filtros dinâmicos por mês/ano
let DADOS_PAINEL_GLOBAL = [];
let ORDENACAO_DATA_CRESCENTE = false; // Começa como false para exibir do MAIS RECENTE primeiro

async function inicializarModuloAedes() {
    try {
        console.log("A carregar Módulo Aedes via Tabela Física do Banco...");
        const dadosView = await AedesAPI.getConsolidadoView();

        if (!dadosView || dadosView.length === 0) {
            throw new Error("Nenhum dado retornado do banco de dados.");
        }

        DADOS_PAINEL_GLOBAL = dadosView;

        // 💡 Correção do nome: de "ejecutar..." para "executar..."
        executarOrdenacaoDados(ORDENACAO_DATA_CRESCENTE);

        configurarFiltrosMesAno(DADOS_PAINEL_GLOBAL);
        renderizarTabelaConsolidada(DADOS_PAINEL_GLOBAL);

        // Configuração da ação do botão de exportar baseada nos checkboxes ativos
        const btnExport = document.getElementById('btnExportExcel');
        if (btnExport) {
            btnExport.onclick = () => {
                const gridCheckboxes = document.getElementById('selectFiltroSemana');
                if (!gridCheckboxes) return;
                
                const checkboxesMarcados = Array.from(gridCheckboxes.querySelectorAll('.chk-mes-filtro:checked')).map(chk => chk.value);
                
                if (checkboxesMarcados.length === 0) {
                    alert("Por favor, selecione pelo menos um mês para exportar.");
                    return;
                }

                const dadosFiltrados = DADOS_PAINEL_GLOBAL.filter(d => checkboxesMarcados.includes(`${d.mes}/${d.ano}`));
                exportarParaExcel(dadosFiltrados);
            };
        }
    } catch (error) {
        console.error("Erro técnico ao inicializar painel do Módulo Aedes:", error);
        exibirMensagemErroInterface(`Não foi possível sincronizar a matriz de dados. Motivo: ${error.message}`);
    }
}

/**
 * Função utilitária para ordenar o array global baseado na propriedade de data
 */
function executarOrdenacaoDados(ordemCrescente) {
    DADOS_PAINEL_GLOBAL.sort((a, b) => {
        const dataA = new Date(a.data_real_envio || a.data_registro || 0);
        const dataB = new Date(b.data_real_envio || b.data_registro || 0);
        return ordemCrescente ? dataA - dataB : dataB - dataA;
    });
}

/**
 * Configura o evento de clique na coluna de data para alternar a ordenação
 */
function configurarEventosOrdenacao() {
    const thData = document.getElementById('thDataEnvio');
    if (!thData) return;

    thData.onclick = () => {
        ORDENACAO_DATA_CRESCENTE = !ORDENACAO_DATA_CRESCENTE;

        executarOrdenacaoDados(ORDENACAO_DATA_CRESCENTE);

        // Mantém o filtro atual dos meses ativo ao reordenar
        const gridCheckboxes = document.getElementById('selectFiltroSemana');
        if (gridCheckboxes) {
            const checkboxesMarcados = Array.from(gridCheckboxes.querySelectorAll('.chk-mes-filtro:checked')).map(chk => chk.value);
            const dadosFiltrados = DADOS_PAINEL_GLOBAL.filter(d => checkboxesMarcados.includes(`${d.mes}/${d.ano}`));
            renderizarTabelaConsolidada(dadosFiltrados);
        } else {
            renderizarTabelaConsolidada(DADOS_PAINEL_GLOBAL);
        }
    };
}

/**
 * Monta dinamicamente os Checkboxes dentro do Grid do novo Layout Bonito
 */
function configurarFiltrosMesAno(dados) {
    const gridCheckboxes = document.getElementById('selectFiltroSemana'); 
    if (!gridCheckboxes) return;

    const periodosValidos = dados.map(item => ({ mes: item.mes, ano: item.ano, chave: `${item.mes}/${item.ano}` }));
    const chavesUnicas = [...new Set(periodosValidos.map(p => p.chave))].sort((a, b) => {
        const [mesA, anoA] = a.split('/').map(Number);
        const [mesB, anoB] = b.split('/').map(Number);
        return anoB !== anoA ? anoB - anoA : mesB - mesA;
    });

    const nomesMeses = ["", "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

    gridCheckboxes.innerHTML = ''; 
    
    chavesUnicas.forEach(chave => {
        const [mes, ano] = chave.split('/');
        const divItem = document.createElement('div');
        divItem.className = 'checkbox-item-wrapper';
        
        divItem.innerHTML = `
            <input type="checkbox" class="chk-mes-filtro" id="chk_${mes}_${ano}" value="${chave}" checked> 
            <label for="chk_${mes}_${ano}">${nomesMeses[Number(mes)]} / ${ano}</label>
        `;
        gridCheckboxes.appendChild(divItem);
    });

    const executarFiltroMultiplo = () => {
        const checkboxesMarcados = Array.from(gridCheckboxes.querySelectorAll('.chk-mes-filtro:checked')).map(chk => chk.value);
        const chkTodos = document.getElementById('chk_todos');

        if (chkTodos) {
            chkTodos.checked = (checkboxesMarcados.length === chavesUnicas.length);
        }

        if (checkboxesMarcados.length === 0) {
            renderizarTabelaConsolidada([]);
        } else {
            executarOrdenacaoDados(ORDENACAO_DATA_CRESCENTE);
            const dadosFiltrados = DADOS_PAINEL_GLOBAL.filter(d => checkboxesMarcados.includes(`${d.mes}/${d.ano}`));
            renderizarTabelaConsolidada(dadosFiltrados);
        }
    };

    const chkTodos = document.getElementById('chk_todos');
    if (chkTodos) {
        chkTodos.onchange = (e) => {
            const status = e.target.checked;
            gridCheckboxes.querySelectorAll('.chk-mes-filtro').forEach(chk => chk.checked = status);
            executarFiltroMultiplo();
        };
    }

    gridCheckboxes.querySelectorAll('.chk-mes-filtro').forEach(chk => {
        chk.onchange = () => {
            executarFiltroMultiplo();
        };
    });
}

/**
 * Renderiza a tabela HTML na tela mapeando as propriedades normalizadas
 */
function renderizarTabelaConsolidada(dados) {
    const container = document.getElementById('containerTabelaAedes');
    if (!container) return;

    const classeIcone = ORDENACAO_DATA_CRESCENTE ? "fas fa-sort-up" : "fas fa-sort-down";

    let html = `
        <table class="tabela-aedes-dma">
            <thead>
                <tr>
                    <th style="text-align: center; width: 120px; cursor: pointer; user-select: none; background: #e2e8f0;" id="thDataEnvio">
                        Data Envio <i class="${classeIcone}" id="iconeOrdenacaoData" style="margin-left: 5px; color: var(--teal-cedae);"></i>
                    </th>
                    <th>Unidade CEDAE</th>
                    <th style="text-align: center;">Vistoria</th>
                    <th style="text-align: center;">Foco</th>
                    <th>Locais do Foco</th>
                    <th>Outros Detalhes Foco</th>
                    <th style="text-align: center;">Remediação</th>
                    <th>Motivo Não Vistoria</th>
                    <th>Motivo Não Remediação</th>
                    <th>Observações DMA</th>
                </tr>
            </thead>
            <tbody>
    `;

    const limparCampoArrayDoBanco = (valorTexto, valorOutros) => {
        let textoLimpo = '';
        try {
            if (valorTexto && valorTexto !== '-' && valorTexto !== '[]') {
                const arrayParsed = JSON.parse(valorTexto);
                if (Array.isArray(arrayParsed)) {
                    textoLimpo = arrayParsed.map(termo => 
                        termo.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                    ).join(', ');
                }
            }
        } catch (e) {
            textoLimpo = String(valorTexto);
        }

        if (textoLimpo.toLowerCase().includes('nenhum foco') || textoLimpo.trim() === '') {
            textoLimpo = '';
        }

        const outrosLimpo = (valorOutros && valorOutros !== '-') ? String(valorOutros).trim() : '';
        if (textoLimpo && outrosLimpo) {
            return `${textoLimpo} (${outrosLimpo})`;
        }
        return textoLimpo || outrosLimpo || '-';
    };

    dados.forEach(item => {
        const vistoriaStr = String(item.vistoria_realizada || 'Não Informado').trim();
        const vistoriaLower = vistoriaStr.toLowerCase();
        const focoLower = String(item.foco_encontrado || 'Não').toLowerCase().trim();
        const remediacaoStr = String(item.foco_remediado || '-').trim();

        let classeLinha = (vistoriaLower === 'não' || vistoriaLower === 'nao') ? 'status-nao-informado' : '';
        let classeFoco = (focoLower === 'sim' || focoLower === 's') ? 'status-foco-alerta' : '';
        
        const campoDataStr = item.data_real_envio || item.data_registro || '';
        let dataFormatada = '-';
        if (campoDataStr && campoDataStr !== '-') {
            const match = campoDataStr.substring(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                dataFormatada = `${match[3]}/${match[2]}/${match[1]}`;
            } else {
                dataFormatada = campoDataStr;
            }
        }
        
        const nomeUnidadeExibicao = item.unidade_nome || item.unidade || item.nome_unidade || item.unidade_descricao || '-';

        const exibeCamposFoco = !(vistoriaLower === 'não' || vistoriaLower === 'nao' || focoLower === 'não' || focoLower === 'nao' || focoLower === 'n');

        const colunaLocaisFoco = exibeCamposFoco ? limparCampoArrayDoBanco(item.locais_foco, '') : '-';
        const colunaOutrosLocais = exibeCamposFoco ? ((item.outros_locais_foco && item.outros_locais_foco !== '-') ? item.outros_locais_foco : '-') : '-';

        const colunaMotivoNaoVistoria = limparCampoArrayDoBanco(item.motivos_nao_vistoria, item.outros_motivos_nao_vistoria);
        const colunaMotivoNaoRemediacao = limparCampoArrayDoBanco(item.motivos_nao_remediacao, item.outros_motivos_nao_remediacao);
        const colunaObservacoes = (item.observacoes && item.observacoes !== '-') ? item.observacoes : '-';

        html += `
            <tr class="${classeLinha}">
                <td style="font-size: 11px; white-space: nowrap; text-align: center; font-weight: bold; color: #0f766e;">${dataFormatada}</td>
                <td><strong>${nomeUnidadeExibicao}</strong></td>
                <td style="text-align: center; font-weight: 500;">${vistoriaStr.toUpperCase()}</td>
                <td style="text-align: center;"><span class="${classeFoco ? 'status-foco-alerta' : ''}">${focoLower.toUpperCase()}</span></td>
                <td>${colunaLocaisFoco}</td>
                <td style="font-size: 11px; font-style: italic; color: #555;">${colunaOutrosLocais}</td>
                <td style="text-align: center;">${remediacaoStr.toUpperCase()}</td>
                <td style="color: #c2410c;">${colunaMotivoNaoVistoria}</td>
                <td style="color: #991b1b;">${colunaMotivoNaoRemediacao}</td>
                <td style="font-size: 11px; color: #374151;">${colunaObservacoes}</td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Ativa novamente as escutas de clique do cabeçalho da tabela montada
    configurarEventosOrdenacao();
}

/**
 * Motor de Exportação Avançada utilizando ExcelJS
 */
async function exportarParaExcel(dadosParaExportar) {
    if (typeof ExcelJS === 'undefined') {
        alert("Erro: A biblioteca ExcelJS não foi carregada na página.");
        return;
    }

    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Tabela_Consolidada_Aedes');

        worksheet.columns = [
            { header: 'DATA REAL DE ENVIO', key: 'data_real_envio', width: 20 },
            { header: 'UNIDADE CEDAE', key: 'unidade_nome', width: 35 },
            { header: 'VISTORIA REALIZADA', key: 'vistoria_realizada', width: 22 },
            { header: 'FOCO DETECTADO', key: 'foco_encontrado', width: 18 },
            { header: 'LOCAIS DO FOCO', key: 'locais_foco', width: 28 },
            { header: 'OUTROS DETALHES FOCO', key: 'outros_locais_foco', width: 30 },
            { header: 'REMEDIAÇÃO', key: 'foco_remediado', width: 15 },
            { header: 'MOTIVO NÃO VISTORIA', key: 'motivos_nao_vistoria', width: 35 },
            { header: 'MOTIVO NÃO REMEDIAÇÃO', key: 'motivos_nao_remediacao', width: 35 },
            { header: 'OBSERVAÇÕES TÉCNICAS', key: 'observacoes', width: 45 }
        ];

        dadosParaExportar.forEach(item => {
            const vistoriaStr = String(item.vistoria_realizada || '-').trim();
            const vistoriaLower = vistoriaStr.toLowerCase();
            const focoLower = String(item.foco_encontrado || '-').toLowerCase().trim();
            
            const campoDataStr = item.data_real_envio || item.data_registro || '';
            let dataFormatadaExcel = '-';
            if (campoDataStr && campoDataStr !== '-') {
                const match = campoDataStr.substring(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
                if (match) {
                    dataFormatadaExcel = `${match[3]}/${match[2]}/${match[1]}`;
                } else {
                    dataFormatadaExcel = campoDataStr;
                }
            }

            const nomeUnidadeExibicao = item.unidade_nome || item.unidade || item.nome_unidade || item.unidade_descricao || '-';

            const limparExcelArray = (val, out) => {
                if (!val || val === '[]' || val === '-') return (out && out !== '-') ? out : '-';
                try {
                    const parsed = JSON.parse(val);
                    if (Array.isArray(parsed)) {
                        let str = parsed.map(t => t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ');
                        if (str.toLowerCase().includes('nenhum foco') || str.trim() === '') return '-';
                        return out && out !== '-' ? `${str} (${out})` : str;
                    }
                } catch(e) {}
                if (String(val).toLowerCase().includes('nenhum foco')) return '-';
                return val;
            };

            const exibeFocoCampos = !(vistoriaLower === 'não' || vistoriaLower === 'nao' || focoLower === 'não' || focoLower === 'nao' || focoLower === 'n');

            const row = worksheet.addRow({
                data_real_envio: dataFormatadaExcel,
                unidade_nome: nomeUnidadeExibicao,
                vistoria_realizada: vistoriaStr.toUpperCase(),
                foco_encontrado: focoLower.toUpperCase(),
                locais_foco: exibeFocoCampos ? limparExcelArray(item.locais_foco, '') : '-',
                outros_locais_foco: exibeFocoCampos && item.outros_locais_foco && item.outros_locais_foco !== '-' ? item.outros_locais_foco : '-',
                foco_remediado: String(item.foco_remediado || '-').toUpperCase(),
                motivos_nao_vistoria: limparExcelArray(item.motivos_nao_vistoria, item.outros_motivos_nao_vistoria),
                motivos_nao_remediacao: limparExcelArray(item.motivos_nao_remediacao, item.outros_motivos_nao_remediacao),
                observacoes: item.observacoes && item.observacoes !== '-' ? item.observacoes : '-'
            });

            row.getCell('data_real_envio').alignment = { horizontal: 'center' };
            row.getCell('vistoria_realizada').alignment = { horizontal: 'center' };
            row.getCell('foco_encontrado').alignment = { horizontal: 'center' };
            row.getCell('foco_remediado').alignment = { horizontal: 'center' };

            if (vistoriaLower === 'não' || vistoriaLower === 'nao' || vistoriaStr === '-') {
                row.eachCell((cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9F2' } };
                });
            }
            
            if (focoLower === 'sim' || focoLower === 's') {
                row.getCell('foco_encontrado').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };
                row.getCell('foco_encontrado').font = { color: { argb: '991B1B' }, bold: true };
            }
    });

        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 };
        headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F766E' } };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        headerRow.height = 28;

        worksheet.autoFilter = 'A1:J1';
        worksheet.views = [{ state: 'frozen', ySplit: 1 }];

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = window.URL.createObjectURL(blob);
        const linkDownload = document.createElement('a');
        linkDownload.href = url;
        linkDownload.download = `CEDAE_Aedes_FatoVistorias_Export.xlsx`;
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

document.addEventListener("DOMContentLoaded", inicializarModuloAedes);
