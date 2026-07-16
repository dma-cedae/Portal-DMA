// js/recicla-routes.js

import express from "express";
import { query } from "./db.js";

const router = express.Router();

/**
 * ==========================================================
 * GET /api/recicla/dashboard-dados
 * Retorna os indicadores gerais do programa
 * ==========================================================
 */
router.get("/dashboard-dados", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        (SELECT COUNT(*) FROM recicla.recicla2_cadastro) AS participantes,
        (SELECT COUNT(*) FROM recicla.recicla2_pesagens) AS pesagens,
        (SELECT COALESCE(SUM(pesagem),0) FROM recicla.recicla2_pesagens) AS peso_total,
        (SELECT MAX(data_pesagem) FROM recicla.recicla2_pesagens) AS ultima_atualizacao;
    `);

    res.json({
      sucesso: true,
      dados: {
        participantes: Number(rows[0].participantes),
        pesagens: Number(rows[0].pesagens),
        pesoTotal: Number(rows[0].peso_total),
        ultimaAtualizacao: rows[0].ultima_atualizacao
      }
    });
  } catch (err) {
    console.error("[RECICLA] Erro Dashboard:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * ==========================================================
 * GET /api/recicla/ranking-diretorias
 * Retorna o total de peso e participantes por diretoria,
 * ordenado do maior para o menor volume coletado
 * ==========================================================
 */
router.get("/ranking-diretorias", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        c.diretoria AS diretoria,
        COUNT(DISTINCT c.id) AS total_participantes,
        COALESCE(SUM(p.pesagem), 0) AS peso_total
      FROM recicla.recicla2_cadastro c
      LEFT JOIN recicla.recicla2_pesagens p
        ON p.participante_id = c.id
      GROUP BY c.diretoria
      HAVING COALESCE(SUM(p.pesagem), 0) > 0
      ORDER BY peso_total DESC;
    `);

    res.json({
      sucesso: true,
      dados: rows.map(r => ({
        diretoria: r.diretoria,
        totalParticipantes: Number(r.total_participantes),
        pesoTotal: Number(r.peso_total)
      }))
    });
  } catch (err) {
    console.error("[RECICLA] Erro Ranking Diretorias:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * ==========================================================
 * GET /api/recicla/historico-pesagens
 * Retorna o total pesado por dia, para o gráfico de evolução
 * ==========================================================
 */
router.get("/historico-pesagens", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        data_pesagem::date AS data,
        SUM(pesagem) AS quantidade
      FROM recicla.recicla2_pesagens
      GROUP BY data_pesagem::date
      ORDER BY data_pesagem::date ASC;
    `);

    res.json({
      sucesso: true,
      dados: rows.map(r => ({
        Data: r.data.toISOString().split("T")[0], // yyyy-mm-dd
        Quantidade: Number(r.quantidade)
      }))
    });
  } catch (err) {
    console.error("[RECICLA] Erro Histórico Pesagens:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * ==========================================================
 * GET /api/recicla/participante?id=123
 * Consulta um participante específico e seu somatório de peso
 * ==========================================================
 */
router.get("/participante", async (req, res) => {
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        sucesso: false,
        erro: "Informe o ID do participante."
      });
    }

    const participante = await query(`
      SELECT
        id,
        nome,
        diretoria,
        email,
        local,
        data_cadastro
      FROM recicla.recicla2_cadastro
      WHERE id = $1
    `, [id]);

    if (participante.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Participante não encontrado."
      });
    }

    const somatorio = await query(`
      SELECT COALESCE(SUM(pesagem), 0) AS somatorio_peso
      FROM recicla.recicla2_pesagens
      WHERE participante_id = $1
    `, [id]);

    const pesagens = await query(`
      SELECT
        id,
        pesagem,
        data_pesagem
      FROM recicla.recicla2_pesagens
      WHERE participante_id = $1
      ORDER BY data_pesagem DESC
    `, [id]);

    res.json({
      sucesso: true,
      dados: {
        ...participante.rows[0],
        somatorio_peso: Number(somatorio.rows[0].somatorio_peso),
        pesagens: pesagens.rows
      }
    });
  } catch (err) {
    console.error("[RECICLA] Erro Consulta Participante:", err);
    res.status(500).json({ sucesso: false, erro: err.message });
  }
});

/**
 * ==========================================================
 * GET /api/recicla/health
 * Teste simples da API
 * ==========================================================
 */
router.get("/health", async (req, res) => {
  try {
    await query("SELECT 1");
    res.json({ sucesso: true, modulo: "Recicla CEDAE", status: "online" });
  } catch (err) {
    res.status(500).json({ sucesso: false, status: "offline", erro: err.message });
  }
});

export default router;