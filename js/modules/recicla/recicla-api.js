/**
 * ==========================================================================
 * js/modules/recicla/recicla-api.js
 * ==========================================================================
 */

// 🟢 Alterado de localhost para o seu servidor centralizado no Render
// ❌ ANTES (Apontando para um serviço inexistente)
// const API_BASE_URL = "https://dma-cedae.onrender.com/api/recicla"; 

// 🟢 AGORA (Apontando para a sua API real do Render que está no seu print)
const API_BASE_URL = "https://dma-aedes-api.onrender.com/api/recicla";

export const ReciclaAPI = {
  /**
   * Obtém os dados consolidados do dashboard (KPIs, Gráficos e Ranking)
   */
  async getDadosDashboard() {
    try {
      const response = await fetch(`${API_BASE_URL}/dashboard-dados`);
      
      if (!response.ok) {
        throw new Error(`Falha na requisição: Status ${response.status}`);
      }

      const resultado = await response.json();
      
      if (!resultado.sucesso) {
        throw new Error(resultado.error || "Erro desconhecido retornado pelo servidor.");
      }

      return resultado.dados;
    } catch (error) {
      console.error("❌ [ReciclaAPI] Erro em getDadosDashboard:", error.message);
      throw error;
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