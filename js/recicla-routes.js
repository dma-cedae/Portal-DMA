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
      participantes: Number(rows[0].participantes),
      pesagens: Number(rows[0].pesagens),
      pesoTotal: Number(rows[0].peso_total),
      ultimaAtualizacao: rows[0].ultima_atualizacao
    });

  } catch (err) {

    console.error("[RECICLA] Erro Dashboard:", err);

    res.status(500).json({
      sucesso: false,
      erro: err.message
    });

  }
});


/**
 * ==========================================================
 * GET /api/recicla/participante?id=123
 * Consulta um participante específico
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
      participante: participante.rows[0],
      pesagens: pesagens.rows
    });

  } catch (err) {

    console.error("[RECICLA] Erro Consulta Participante:", err);

    res.status(500).json({
      sucesso: false,
      erro: err.message
    });

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

    res.json({
      sucesso: true,
      modulo: "Recicla CEDAE",
      status: "online"
    });

  } catch (err) {

    res.status(500).json({
      sucesso: false,
      status: "offline",
      erro: err.message
    });

  }

});


export default router;