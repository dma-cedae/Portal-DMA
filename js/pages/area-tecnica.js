import { AedesAPI } from '../modules/aedes/aedes-api.js';

async function inicializarDashboard() {
    try {
        // 1. Busca os lotes (A API deve retornar id, focal_nome, total_registros, payload_completo)
        const lotes = await AedesAPI.getLotes();
        
        console.log("Lotes recebidos do banco:", lotes); // Para conferir no console

        let totalVistorias = 0;
        let totalFocos = 0;
        let focaisUnicos = new Set();

        lotes.forEach(lote => {
            // Soma o total de registros (usando o dado que veio do banco)
            totalVistorias += (parseInt(lote.total_registros) || 0);
            
            // Adiciona o nome do focal ao Set para contagem única
            if (lote.focal_nome) focaisUnicos.add(lote.focal_nome);
            
            // Processa o JSON do payload_completo para contar focos
            // Verifica se o payload existe e se tem a estrutura de registros
            const registros = lote.payload_completo?.registros || [];
            if (Array.isArray(registros)) {
                const focosNoLote = registros.filter(r => 
                    String(r.focoEncontrado).toLowerCase() === 'sim'
                ).length;
                totalFocos += focosNoLote;
            }
        });

        // 2. Atualização Segura da UI (Evita o erro de 'null')
        const domElements = {
            vistorias: document.getElementById('kpi-vistorias'),
            focos: document.getElementById('kpi-focos'),
            focais: document.getElementById('kpi-focais')
        };

        if (domElements.vistorias) domElements.vistorias.innerText = totalVistorias;
        if (domElements.focos) domElements.focos.innerText = totalFocos;
        if (domElements.focais) domElements.focais.innerText = focaisUnicos.size;

        // 3. Popula a tabela se ela existir
        renderizarTabelaRecentes(lotes);

    } catch (error) {
        console.error("Erro ao processar dados do banco:", error);
    }
}

function renderizarTabelaRecentes(lotes) {
    const container = document.getElementById('mainDataTable');
    if (!container) return;

    // Pega os 5 mais recentes
    const recentes = lotes.slice(0, 5);

    container.innerHTML = `
        <table style="width:100%; border-collapse:collapse; font-size:0.85rem; text-align:left">
            <thead>
                <tr style="background:#f8fafc; color:#64748b; border-bottom:2px solid #f1f5f9">
                    <th style="padding:15px">DATA ENVIO</th>
                    <th style="padding:15px">FOCAL</th>
                    <th style="padding:15px">VISTORIAS</th>
                    <th style="padding:15px">STATUS</th>
                </tr>
            </thead>
            <tbody>
                ${recentes.map(l => `
                    <tr style="border-bottom:1px solid #f8fafc">
                        <td style="padding:15px; font-weight:500">
                            ${new Date(l.data_envio).toLocaleDateString('pt-BR')}
                        </td>
                        <td style="padding:15px">${l.focal_nome || 'N/A'}</td>
                        <td style="padding:15px">${l.total_registros || 0}</td>
                        <td style="padding:15px">
                            <span style="color:var(--accent-green)">●</span> Sincronizado
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

// Inicializa
document.addEventListener("DOMContentLoaded", inicializarDashboard);