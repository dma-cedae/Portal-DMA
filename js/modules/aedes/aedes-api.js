/**
 * Módulo de Comunicação API - AEDES
 */

const API_BASE = window.location.hostname === "localhost" 
    ? "http://localhost:3001" 
    : "https://dma-aedes-api.onrender.com";

export const AedesAPI = {

    /**
     * Busca a lista de unidades operacionais cadastradas
     */
    async getUnidades() {
        try {
            const response = await fetch(`${API_BASE}/api/unidades`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getUnidades:", error);
            return [];
        }
    },

    /**
     * Busca os metadados dos lotes enviados (Validação/Certificados)
     */
    async getLotes() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/lotes`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.getLotes:", error);
            return [];
        }
    },

    /**
     * Envia as vistorias preenchidas no formulário Desktop (Lote de Inspeções)
     */
    async postLote(payload) {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/lotes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || "Erro ao salvar os dados no banco.");
            }

            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.postLote:", error);
            throw error;
        }
    },

    /**
     * NOVA ROTA: Consome diretamente a tabela 'vistorias_itens' otimizada e unificada do banco.
     * Substitui o processamento local pesado por leitura direta de performance.
     */
    async getDadosPainel() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            
            const dados = await response.json();
            
            return dados.map(r => ({
                Ano: parseInt(r.Ano) || 2026,
                Mes_Nome: r.Mes_Nome,
                Unidade: r.Unidade,
                visitada: parseInt(r.visitada) || 0,
                foco_encontrado: parseInt(r.foco_encontrado) || 0,
                foco_remediado: parseInt(r.foco_remediado) || 0,
                foco_pendente: parseInt(r.foco_pendente) || 0,
                nv_acesso: parseInt(r.nv_acesso) || 0,
                nv_brigadista: parseInt(r.nv_brigadista) || 0,
                nv_viatura: parseInt(r.nv_viatura) || 0,
                nv_esquecimento: parseInt(r.nv_esquecimento) || 0,
                mnr_capacitacao: parseInt(r.mnr_capacitacao) || 0,
                mnr_larvicida: parseInt(r.mnr_larvicida) || 0,
                mnr_limpeza: parseInt(r.mnr_limpeza) || 0,
                mnr_cobertura: parseInt(r.mnr_cobertura) || 0
            }));
        } catch (error) {
            console.error("❌ AedesAPI.getDadosPainel (Via Banco Otimizado):", error);
            return [];
        }
    },

    /**
     * ROTA DOSSIÊ: Busca o focal técnico responsável pela unidade direto da tabela relacional.
     */
    async getFocalDossie(nomeUnidade) {
        try {
            if (!nomeUnidade) return { nome: null, matricula: null, email: null };

            const url = `${API_BASE}/api/aedes/focal-dossie?unidade=${encodeURIComponent(nomeUnidade.trim())}`;
            
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error(`❌ AedesAPI.getFocalDossie para [${nomeUnidade}]:`, error);
            return { nome: null, matricula: null, email: null };
        }
    },

    /**
     * NOVA ROTA: Consome a View unificada (vw_painel_consolidado) trazendo 
     * a contagem de semanas sequenciais a partir da Semana 1 e os dados históricos.
     */
    async getConsolidadoView() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/consolidado`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            
            const json = await response.json();
            
            if (json && json.sucesso) {
                return json.dados;
            }
            return json || [];
        } catch (error) {
            console.error("❌ AedesAPI.getConsolidadoView:", error);
            return [];
        }
    }
}; // Chaves fechadas corretamente aqui para o export do objeto