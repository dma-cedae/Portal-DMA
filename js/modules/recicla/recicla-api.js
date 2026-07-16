/**
 * ==========================================================================
 * js/modules/recicla/recicla-api.js
 * ==========================================================================
 */

const API_BASE_URL = "https://dma-aedes-api.onrender.com/api/recicla";

export const ReciclaAPI = {
  /**
   * Obtém os dados consolidados do dashboard (KPIs)
   */
  async getDadosDashboard() {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard-dados`);

      if (!response.ok) {
        throw new Error(`Falha na requisição: Status ${response.status}`);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.erro || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados;
    } catch (error) {
      console.error("❌ [ReciclaAPI] Erro em getDadosDashboard:", error.message);
      throw error;
    }
  },

  /**
   * Obtém o ranking de diretorias (peso total e participantes),
   * ordenado do maior para o menor volume coletado
   */
  async getRankingDiretorias() {
    try {
      const response = await fetch(`${API_BASE_URL}/ranking-diretorias`);

      if (!response.ok) {
        throw new Error(`Falha na requisição: Status ${response.status}`);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.erro || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados || [];
    } catch (error) {
      console.error("❌ [ReciclaAPI] Erro em getRankingDiretorias:", error.message);
      return [];
    }
  },

  /**
   * Obtém o histórico de pesagens por dia, para o gráfico de evolução
   */
  async getHistoricoPesagens() {
    try {
      const response = await fetch(`${API_BASE_URL}/historico-pesagens`);

      if (!response.ok) {
        throw new Error(`Falha na requisição: Status ${response.status}`);
      }

      const resultado = await response.json();

      if (!resultado.sucesso) {
        throw new Error(resultado.erro || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados || [];
    } catch (error) {
      console.error("❌ [ReciclaAPI] Erro em getHistoricoPesagens:", error.message);
      return [];
    }
  },

  /**
   * Consulta o extrato de pesagem acumulado de um participante individual
   */
  async consultarParticipante(id) {
    try {
      const response = await fetch(`${API_BASE_URL}/participante?id=${encodeURIComponent(id)}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Falha na consulta: Status ${response.status}`);
      }

      const resultado = await response.json();

      if (resultado.sucesso && resultado.dados) {
        return {
          id: resultado.dados.id,
          nome: resultado.dados.nome,
          diretoria: resultado.dados.diretoria,
          somatorio: resultado.dados.somatorio_peso || 0
        };
      }

      return null;
    } catch (error) {
      console.error(`❌ [ReciclaAPI] Erro ao consultar participante [${id}]:`, error.message);
      return null;
    }
  }
};