/**
 * Módulo de Comunicação API - AEDES-api.js
 */

// 🌐 Alterna dinamicamente a URL base dependendo de onde o frontend está rodando
const API_BASE = ["localhost", "127.0.0.1"].includes(window.location.hostname)
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
     * Envia as vistorias preenchidas no formulário (Lote de Inspeções)
     */
    async postLote(payload) {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/lotes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            // Se o backend responder com erro (Ex: 400 Bad Request)
            if (!response.ok) {
                let mensagemErro = "Erro ao salvar os dados no banco.";
                try {
                    const errorData = await response.json();
                    mensagemErro = errorData.error || errorData.detalhe || mensagemErro;
                } catch (jsonErr) {
                    // Fallback caso a resposta de erro não seja um JSON válido
                    console.error("Não foi possível decodificar o erro do servidor:", jsonErr);
                }
                throw new Error(mensagemErro);
            }

            return await response.json();
        } catch (error) {
            console.error("❌ AedesAPI.postLote:", error);
            throw error;
        }
    
    },

    /**
     * ROTA ATIVA: Consome diretamente a tabela 'fato_vistorias' do banco.
     */
    async getDadosPainel() {
        try {
            const response = await fetch(`${API_BASE}/api/aedes/painel-dados`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            
            const dados = await response.json();
            
            if (!dados || !Array.isArray(dados)) return [];

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
     * ROTA DOSSIÊ: Busca o focal técnico responsável pela unidade
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
     * ⛔ ROTA DESLIGADA / LEGADA (Mantida apenas como stub seguro para evitar quebras)
     
    async getConsolidadoView() {
        // Retorna um array vazio estável imediatamente sem gastar processamento de rede
        return [];
    },*/
    

    /**
     * 🟢 GERAÇÃO DE PDF: Conecta à nova rota do RMarkdown em formato PDF
     */
    downloadRelatorioPDF(unidade, ano) {
        try {
            const filtroUnidade = unidade || "TODOS";
            const filtroAno = ano || "TODOS";

            // Montagem inteligente baseada no ambiente ativo (Local vs Produção Render)
            const url = `${API_BASE}/api/aedes/relatorio-pdf?unidade=${encodeURIComponent(filtroUnidade)}&ano=${encodeURIComponent(filtroAno)}`;
            
            window.open(url, '_blank');
        } catch (error) {
            console.error("❌ AedesAPI.downloadRelatorioPDF:", error);
        }
    },

async getConsolidadoView() {
    try {
        const response = await fetch(`${API_BASE}/api/aedes/consolidado`);
        if (!response.ok) throw new Error(`Status: ${response.status}`);
        
        const json = await response.json();
        
        // Garante o mapeamento se os dados vierem envelopados em json.dados ou direto no array
        const dadosOrigem = json && json.sucesso && Array.isArray(json.dados) ? json.dados : (Array.isArray(json) ? json : []);

        return dadosOrigem.map(item => {
            // Se o backend não retornar o ano na query, usamos o atual como fallback
            const anoAtual = item.ano || 2026; 

            // Tratamento amigável para exibição dos booleanos/strings que vêm do banco
            const statusVistoria = item.vistoria_realizada ? "sim" : "nao";
            const statusFoco = item.foco_encontrado ? "sim" : "nao";
            const statusRemediacao = item.foco_remediado ? "sim" : "nao";

            return {
                ...item,
                // Mantém compatibilidade com a estrutura esperada pela sua View/Tabela do frontend
                ano: anoAtual,
                vistoria: statusVistoria,
                foco: statusFoco,
                remediacao: statusRemediacao,
                
                // Mapeia os novos campos de texto vindos da query do banco
                local_foco: item.locais_foco || (statusVistoria === "nao" ? "Não vistoriado" : "-"),
                motivo_nao_vistoria: item.motivos_nao_vistoria || null,
                observacoes: item.observacoes || "-",
                data_real_envio: item.data_real_envio || null,

                // Fallback para campos que não estavam explicitamente na query enviada, mas mantêm o formato seguro
                unidade: item.unidade || "-",
                mes: item.mes || "-"
            };
        });
        
    } catch (error) {
        console.error("❌ AedesAPI.getConsolidadoView:", error);
        return [];
    }
},

// Adicione este método dentro do objeto export const AedesAPI = { ... }

 /**
     * SPRINT 4: Busca as unidades inadimplentes baseadas na semana interna de um mês específico
     */
    async getUnidadesNaoEnviadas(ano, mes, semanaMes) {
        try {
            if (!ano || !mes || !semanaMes) return null;
            
            const response = await fetch(`${API_BASE}/api/aedes/nao-enviados?ano=${parseInt(ano)}&mes=${parseInt(mes)}&semana_mes=${parseInt(semanaMes)}`);
            if (!response.ok) throw new Error(`Status: ${response.status}`);
            
            return await response.json();
        } catch (error) {
            console.error(`❌ AedesAPI.getUnidadesNaoEnviadas:`, error);
            return null;
        }
    }
};