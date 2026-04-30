import { AedesAPI } from '../modules/aedes/aedes-api.js';

async function inicializarDashboardAedes() {
    try {
        // 1. Busca os dados de vistorias e a lista de focais (agora sem erro 400)
        const lotes = await AedesAPI.getLotes();
        const baseFocais = await AedesAPI.getBase(); 

        let stats = {
            focos: 0,
            remediados: 0,
            unidadesAtivas: new Set(),
            focaisQueEnviaram: new Set()
        };

        // 2. Processamento dos Lotes vindo do Banco
        lotes.forEach(lote => {
            if (lote.focal_nome) {
                stats.focaisQueEnviaram.add(lote.focal_nome);
            }
            
            const registros = lote.payload_completo?.registros || [];
            registros.forEach(reg => {
                if (reg.unidade) stats.unidadesAtivas.add(reg.unidade);
                
                // Normalização para comparação de strings
                const encontrouFoco = String(reg.focoEncontrado || "").toLowerCase();
                const remediouFoco = String(reg.focoRemediado || "").toLowerCase();

                if (encontrouFoco === 'sim') {
                    stats.focos++;
                    if (remediouFoco === 'sim') {
                        stats.remediados++;
                    }
                }
            });
        });

        // 3. Atualização Segura dos KPIs no HTML
        const safeSet = (id, val) => { 
            const el = document.getElementById(id);
            if (el) el.innerText = val; 
        };
        
        safeSet('kpi-focos', stats.focos);
        safeSet('kpi-remediados', stats.remediados);
        safeSet('kpi-unidades', stats.unidadesAtivas.size);
        safeSet('kpi-pendentes', stats.focos - stats.remediados);

        // 4. Renderização da Tabela de Assiduidade
        renderAssiduidade(baseFocais, stats.focaisQueEnviaram);

    } catch (error) {
        console.error("Erro ao carregar Dashboard Aedes:", error);
    }
}

/**
 * Renderiza a lista lateral de agentes e marca quem já enviou dados
 */
function renderAssiduidade(baseFocais, focaisQueEnviaram) {
    const tbody = document.getElementById('focaisStatusBody');
    if (!tbody) return;

    // Remove duplicados da base (pela matrícula ou nome) para listar agentes únicos
    const agentesUnicos = [...new Map(baseFocais.map(item => [item.focal || item.focalNome, item])).values()];

    tbody.innerHTML = agentesUnicos.map(agente => {
        // Usa as propriedades retornadas pela nova query do server.js
        const nomeAgente = agente.focal || agente.focalNome;
        const jaEnviou = focaisQueEnviaram.has(nomeAgente);

        return `
            <tr>
                <td><strong>${nomeAgente || 'NOME NÃO IDENTIFICADO'}</strong></td>
                <td style="text-align: center;">
                    ${jaEnviou 
                        ? '<i class="fas fa-check-circle check-icon" style="color:#22c55e"></i>' 
                        : '<i class="fas fa-circle" style="color:#e2e8f0"></i>'}
                </td>
            </tr>
        `;
    }).join('');
}

document.addEventListener('DOMContentLoaded', inicializarDashboardAedes);