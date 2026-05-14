import { AedesAPI } from '../modules/aedes/aedes-api.js';

// Mapeamento de Labels para transformar os IDs do banco em nomes legíveis
const LABELS_MAP = {
    // Tipos de Foco
    "objetos_acumulando_agua": "Objetos acumulando água",
    "reservatorio_de_agua": "Reservatório de água",
    "bromelias": "Bromélias",
    "outros": "Outros",
    // Motivos de Não Vistoria
    "sem_condicao_acesso": "Sem acesso",
    "sem_brigadista": "Sem brigadista",
    "sem_viatura_disponivel": "Sem viatura disponível",
    "esquecimento": "Esquecimento",
    // Motivos de Não Remediação
    "falta_de_cloro_larvicida": "Falta de cloro/larvicida",
    "necessidade_limpeza_terreno": "Necessidade de limpeza do terreno",
    "reservatorio_sem_cobertura": "Reservatório sem cobertura"
};

async function inicializarModuloAedes() {
    try {
        console.log("A carregar Módulo Aedes...");
        const todosLotes = await AedesAPI.getLotes();
        
        // Filtro de Data (Corte em 14/05/2026 conforme regra da Área Técnica)
        const dataCorte = new Date('2026-05-14T00:00:00');
        const lotes = todosLotes.filter(lote => {
            const dataLote = new Date(lote.data_envio);
            return dataLote >= dataCorte;
        });

        renderizarTabelaConsolidada(lotes);

        // Configuração do Botão de Exportação
        const btnExport = document.getElementById('btnExportExcel');
        if (btnExport) {
            btnExport.onclick = () => exportarParaExcel(lotes);
        }

    } catch (error) {
        console.error("Erro crítico no Módulo Aedes:", error);
    }
}

/**
 * Renderiza a tabela desmembrando os lotes em unidades individuais
 */
function renderizarTabelaConsolidada(lotes) {
    const container = document.getElementById('containerTabelaAedes');
    if (!container) return;

    let html = `
        <table class="tabela-custom">
            <thead>
                <tr>
                    <th>DATA</th>
                    <th>UNIDADE</th>
                    <th>VISTORIA</th>
                    <th>FOCO</th>
                    <th>DETALHES / OUTROS</th>
                    <th>OBSERVAÇÕES</th>
                </tr>
            </thead>
            <tbody>
    `;

    lotes.forEach(lote => {
        const registros = lote.payload_completo?.dados || [];
        const dataEnvio = lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : "---";

        registros.forEach(r => {
            const fezVistoria = String(r[2]).toLowerCase() === 'sim';
            const temFoco = String(r[3]).toLowerCase() === 'sim';
            
            // Captura campos de "Outros" (Ajuste os índices [8], [9], [10] se necessário conforme seu form)
            const outrosMotivoNaoVistoria = r[8] || "";
            const outrosLocalFoco = r[9] || "";
            const outrosMotivoNaoRemediacao = r[10] || "";

       // 1. Define os símbolos com as cores solicitadas
            const iconVistoria = fezVistoria 
                ? '<span style="color: #16a34a; font-weight: bold;">✔</span>' 
                : '<span style="color: #000; font-weight: bold;">✖</span>';
            
            const iconFoco = temFoco
                ? '<span style="color: #ef4444; font-weight: bold;">✔</span>' // Vermelho para foco positivo
                : '<span style="color: #000; font-weight: bold;">✖</span>'; // Preto para foco negativo

            const detalheOutros = [outrosMotivoNaoVistoria, outrosLocalFoco, outrosMotivoNaoRemediacao]
                                  .filter(txt => txt && txt.length > 0).join(" | ");

            html += `
                <tr>
                    <td>${dataEnvio}</td>
                    <td><b>${r[1]}</b></td>
                    <td style="text-align:center">
                        ${iconVistoria} ${(!fezVistoria && r[7] === 'outros') ? '<br><small>'+outrosMotivoNaoVistoria+'</small>' : ''}
                    </td>
                    <td style="text-align:center">
                        <span class="badge ${temFoco ? 'badge--danger' : ''}">${iconFoco}</span>
                    </td>
                    <td style="font-size:0.8rem; color:#1C1C1C">${detalheOutros || "-"}</td>
                    <td style="font-size:0.8rem;">${r[11] || "-"}</td>
                </tr>
            `;
        });
    });

    html += `</tbody></table>`;
    container.innerHTML = html;
}

/**
 * Gera o ficheiro Excel consolidado (linha por unidade)
 */
async function exportarParaExcel(lotes) {
    if (typeof ExcelJS === 'undefined') {
        alert("Erro: A biblioteca ExcelJS não foi carregada no HTML.");
        return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Relatório Consolidado Aedes');

    // Definição das Colunas
   worksheet.columns = [
        { header: 'DATA', key: 'data', width: 12 },
        { header: 'FOCAL', key: 'focal', width: 20 },
        { header: 'UNIDADE', key: 'unidade', width: 25 },
        { header: 'VISTORIA', key: 'vistoria', width: 12 },
        { header: 'FOCO', key: 'foco', width: 12 },
        { header: 'OUTROS: MOTIVO NÃO VISTORIA', key: 'outros_vistoria', width: 25 },
        { header: 'OUTROS: LOCAL FOCO', key: 'outros_local', width: 25 },
        { header: 'OUTROS: MOTIVO NÃO REMED.', key: 'outros_remed', width: 25 },
        { header: 'OBSERVAÇÕES', key: 'obs', width: 30 }
    ];

    lotes.forEach(lote => {
        const registros = lote.payload_completo?.dados || [];
        registros.forEach(r => {
            worksheet.addRow({
                data: lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : "",
                focal: lote.focal_nome || "N/A",
                unidade: r[1],
                vistoria: r[2],
                foco: r[3],
                outros_vistoria: r[8] || "",
                outros_local: r[9] || "",
                outros_remed: r[10] || "",
                obs: r[11] || ""
            });
        });
    });
        
    // Estilização do Cabeçalho
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '16A34A' } }; // Verde Aedes
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Download do ficheiro
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    // Utiliza FileSaver se disponível, senão fallback para link
    if (window.saveAs) {
        window.saveAs(blob, `Relatorio_Aedes_DMA_${new Date().getTime()}.xlsx`);
    } else {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `DMA_Aedes_Consolidado_${new Date().getTime()}.xlsx`;
        a.click();
    }
}

// Inicialização
document.addEventListener("DOMContentLoaded", inicializarModuloAedes);