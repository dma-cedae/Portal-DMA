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
                    <th>LOCAL FOCO</th>
                    <th>REMEDIAÇÃO</th>  
                    <th>DETALHES / OUTROS</th>
                    <th>OBSERVAÇÕES</th>
                </tr>
            </thead>
            <tbody>
    `;

    lotes.forEach(lote => {
        const registros = lote.payload_completo?.dados || lote.dados || []; 
        const dataEnvio = lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : "---";

        registros.forEach(r => {
            const fezVistoria  = String(r[2]).toLowerCase() === 'sim';
            const temFoco      = String(r[3]).toLowerCase() === 'sim';
            const foiRemediado = String(r[4]).toLowerCase() === 'sim';
            
            // Tratamento de locais
            let localFoco = Array.isArray(r[5]) ? r[5].join(", ") : (r[5] || "");
            
            // Captura dos campos de texto "Outros"
            const outrosLocalFoco           = (r[6] && !['sim', 'nao', 'não', '-'].includes(String(r[6]).toLowerCase().trim())) ? r[6] : "";
            const outrosMotivoNaoVistoria   = (r[8] && !['sim', 'nao', 'não', '-'].includes(String(r[8]).toLowerCase().trim())) ? r[8] : "";
            const outrosMotivoNaoRemediacao = (r[10] && !['sim', 'nao', 'não', '-'].includes(String(r[10]).toLowerCase().trim())) ? r[10] : "";
            
            const observacoes = r[11] || "-";

            // Ícone visual de Vistoria
            const iconVistoria = fezVistoria 
                ? '<span style="color: #16a34a; font-weight: bold;">✔</span>' 
                : '<span style="color: #000; font-weight: bold;">✖</span>';
            
            // REGRA DO FOCO: Se Vistoria = Não, Foco fica vazio (-). Se Vistoria = Sim, mostra ✔ ou ✖.
            const displayFoco = fezVistoria
                ? (temFoco 
                    ? `<span class="badge badge--danger"><span style="color: #ef4444; font-weight: bold;">✔</span></span>`
                    : '<span style="color: #000; font-weight: bold;">✖</span>')
                : '-';

            // REGRA DA REMEDIAÇÃO: Só faz sentido se houve Vistoria E se houve Foco.
            const displayRemediacao = (fezVistoria && temFoco)
                ? (foiRemediado 
                    ? '<span style="color: #16a34a; font-weight: bold;">✔</span>' 
                    : '<span style="color: #ef4444; font-weight: bold;">✖</span>')
                : '-';

            // Une as justificativas textuais
            const detalheOutros = [outrosMotivoNaoVistoria, outrosLocalFoco, outrosMotivoNaoRemediacao]
                                  .filter(txt => txt && txt.trim().length > 0)
                                  .join(" | ");

            html += `
                <tr>
                    <td>${dataEnvio}</td>
                    <td><b>${r[1]}</b></td>
                    <td style="text-align:center">${iconVistoria}</td>
                    <td style="text-align:center">${displayFoco}</td>
                    <td style="text-align:center;">
                        ${(fezVistoria && temFoco) ? `<b>${localFoco}</b>` : '-'}
                    </td>
                    <td style="text-align:center">${displayRemediacao}</td>
                    <td style="font-size:0.8rem; color:#1C1C1C; text-align:center;">${detalheOutros || "-"}</td>
                    <td style="font-size:0.8rem;">${observacoes}</td>
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

    worksheet.columns = [
        { header: 'DATA', key: 'data', width: 12 },
        { header: 'FOCAL', key: 'focal', width: 20 },
        { header: 'UNIDADE', key: 'unidade', width: 25 },
        { header: 'VISTORIA', key: 'vistoria', width: 12 },
        { header: 'MOTIVO NÃO VISTORIA', key: 'motivo_nao_vistoria', width: 25 }, // Nova Coluna
        { header: 'FOCO', key: 'foco', width: 12 },
        { header: 'LOCAL FOCO', key: 'local_foco', width: 25 },
        { header: 'REMEDIAÇÃO', key: 'remediacao', width: 15 },
        { header: 'MOTIVO NÃO REMEDIAÇÃO', key: 'motivo_nao_remediacao', width: 25 }, // Nova Coluna
        { header: 'DETALHES / OUTROS', key: 'detalhes_outros', width: 35 },
        { header: 'OBSERVAÇÕES', key: 'obs', width: 30 }
    ];

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };

    lotes.forEach(lote => {
    const registros = lote.payload_completo?.dados || lote.dados || [];
    const dataEnvio = lote.data_envio ? new Date(lote.data_envio).toLocaleDateString('pt-BR') : "";
    const focalNome = lote.focal_nome || "N/A";

    registros.forEach(r => {
        const fezVistoria = String(r[2]).toLowerCase() === 'sim';
        const temFoco     = String(r[3]).toLowerCase() === 'sim';
        let localFoco     = Array.isArray(r[5]) ? r[5].join(", ") : (r[5] || "");

        // --- TRATAMENTO DOS NOVOS CAMPOS (ARRAYS) ---
        // Se não fez vistoria, extrai os motivos salvos em r[7]
        const motivoNaoVistoria = !fezVistoria ? (Array.isArray(r[7]) ? r[7].join(", ") : (r[7] || "-")) : "-";
        
        // Se fez vistoria e teve foco, mas não remediou, extrai os motivos salvos in r[9]
        const motivoNaoRemediacao = (fezVistoria && temFoco && String(r[4]).toLowerCase() !== 'sim') 
            ? (Array.isArray(r[9]) ? r[9].join(", ") : (r[9] || "-")) 
            : "-";
        // ---------------------------------------------

        // Filtragem de dados "Outros" (Campos de texto manuais)
        const outrosLocalFoco           = (r[6] && !['sim', 'nao', 'não', '-'].includes(String(r[6]).toLowerCase().trim())) ? r[6] : "";
        const outrosMotivoNaoVistoria   = (r[8] && !['sim', 'nao', 'não', '-'].includes(String(r[8]).toLowerCase().trim())) ? r[8] : "";
        const outrosMotivoNaoRemediacao = (r[10] && !['sim', 'nao', 'não', '-'].includes(String(r[10]).toLowerCase().trim())) ? r[10] : "";

        const detalheOutros = [outrosMotivoNaoVistoria, outrosLocalFoco, outrosMotivoNaoRemediacao]
                              .filter(txt => txt && txt.trim().length > 0)
                              .join(" | ") || "-";

        const excelFoco        = fezVistoria ? (r[3] || "-") : "-";
        const excelLocalFoco   = (fezVistoria && temFoco) ? localFoco : "-";
        const excelRemediacao  = (fezVistoria && temFoco) ? (r[4] || "-") : "-";

        // Inserção dos dados alinhada com as novas chaves
        const row = worksheet.addRow({
            data: dataEnvio,
            focal: focalNome,
            unidade: r[1] || "-",
            vistoria: r[2] || "-",
            motivo_nao_vistoria: motivoNaoVistoria,       // Adicionado aqui
            foco: excelFoco,
            local_foco: excelLocalFoco,
            remediacao: excelRemediacao,
            motivo_nao_remediacao: motivoNaoRemediacao,   // Adicionado aqui
            detalhes_outros: detalheOutros,
            obs: r[11] || "-"
        });

        // Alinhamentos centrais das novas colunas de texto limpo
        row.getCell('data').alignment = { horizontal: 'center' };
        row.getCell('vistoria').alignment = { horizontal: 'center' };
        row.getCell('motivo_nao_vistoria').alignment = { horizontal: 'center' };
        row.getCell('foco').alignment = { horizontal: 'center' };
        row.getCell('local_foco').alignment = { horizontal: 'center' };
        row.getCell('remediacao').alignment = { horizontal: 'center' };
        row.getCell('motivo_nao_remediacao').alignment = { horizontal: 'center' };
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