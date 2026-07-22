/**
 * ==========================================================================
 * js/modules/recicla/recicla-api.js
 * ==========================================================================
 */

// Detecta automaticamente se está em ambiente local ou produção
const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
const API_BASE_URL = isLocal 
  ? "http://localhost:3001/api/recicla" 
  : "https://dma-aedes-api.onrender.com/api/recicla";

console.log(`🌐 [ReciclaAPI] Conectando ao backend em: ${API_BASE_URL}`);

export const ReciclaAPI = {
  /**
   * Obtém os dados consolidados do dashboard (KPIs gerais e por local)
   */
  async getDadosDashboard() {
    try {
      const url = `${API_BASE_URL}/dashboard-dados`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Falha HTTP: Status ${response.status} (${response.statusText})`);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.erro || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados;
    } catch (error) {
      console.group("❌ [ReciclaAPI] Erro detalhado em getDadosDashboard");
      console.error("Mensagem:", error.message);
      console.error("URL tentada:", `${API_BASE_URL}/dashboard-dados`);
      console.groupEnd();
      throw error;
    }
  },

  /**
   * Obtém o ranking de diretorias, separado por local e consolidado
   */
  async getRankingDiretorias() {
    try {
      const url = `${API_BASE_URL}/ranking-diretorias`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Falha HTTP: Status ${response.status} (${response.statusText})`);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.erro || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados || [];
    } catch (error) {
      console.group("❌ [ReciclaAPI] Erro detalhado em getRankingDiretorias");
      console.error("Mensagem:", error.message);
      console.error("URL tentada:", `${API_BASE_URL}/ranking-diretorias`);
      console.groupEnd();
      return [];
    }
  },

  /**
   * Obtém o histórico de pesagens por dia e por local
   */
  async getHistoricoPesagens() {
    try {
      const url = `${API_BASE_URL}/historico-pesagens`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Falha HTTP: Status ${response.status} (${response.statusText})`);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.erro || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados || [];
    } catch (error) {
      console.group("❌ [ReciclaAPI] Erro detalhado em getHistoricoPesagens");
      console.error("Mensagem:", error.message);
      console.error("URL tentada:", `${API_BASE_URL}/historico-pesagens`);
      console.groupEnd();
      return [];
    }
  },

  /**
   * Consulta o extrato de pesagem acumulado de um participante específico por ID e Local
   */
  async consultarParticipante(id, local) {
    try {
      if (!id || !local) {
        throw new Error("ID e Local são obrigatórios para a consulta.");
      }

      const url = `${API_BASE_URL}/participante?id=${encodeURIComponent(id)}&local=${encodeURIComponent(local)}`;
      const response = await fetch(url);

      if (response.status === 404) {
        console.warn(`⚠️ [ReciclaAPI] Participante ID [${id}] em [${local}] não encontrado (404).`);
        return null;
      }

      if (!response.ok) {
        throw new Error(`Falha HTTP: Status ${response.status} (${response.statusText})`);
      }

      const resultado = await response.json();

      if (resultado.sucesso && resultado.dados) {
        return {
          id: resultado.dados.participante_id || resultado.dados.id,
          id_serial: resultado.dados.id_serial,
          nome: resultado.dados.nome,
          diretoria: resultado.dados.diretoria,
          email: resultado.dados.email,
          local: resultado.dados.local,
          somatorio: resultado.dados.somatorio_peso || 0,
          pesagens: resultado.dados.pesagens || []
        };
      }

      return null;
    } catch (error) {
      console.group(`❌ [ReciclaAPI] Erro ao consultar participante [ID: ${id}, Local: ${local}]`);
      console.error("Mensagem:", error.message);
      console.groupEnd();
      return null;
    }
  }
};