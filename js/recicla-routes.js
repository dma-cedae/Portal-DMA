// js/recicla-routes.js

import express from "express";
import { query } from "./db.js";

const router = express.Router();

/**
 * ==========================================================
 * GET /api/recicla/dashboard-dados
 * Retorna os indicadores gerais divididos por local e consolidados
 * ==========================================================
 */
router.get("/dashboard-dados", async (req, res) => {
  try {
    // Busca indicadores consolidados gerais
    const geral = await query(`
      SELECT
        (SELECT COUNT(*) FROM recicla.recicla_cadastro) AS participantes,
        (SELECT COUNT(*) FROM recicla.recicla_pesagens) AS pesagens,
        (SELECT COALESCE(SUM(pesagem),0) FROM recicla.recicla_pesagens) AS peso_total,
        (SELECT MAX(data_pesagem) FROM recicla.recicla_pesagens) AS ultima_atualizacao;
    `);

    // Busca indicadores separados estritamente por local (sede e laranjal)
    const porLocal = await query(`
      SELECT 
        LOWER(TRIM(l.local)) AS local,
        COUNT(DISTINCT c.id_serial) AS participantes,
        COUNT(p.id) AS pesagens,
        COALESCE(SUM(p.pesagem), 0) AS peso_total
      FROM (
        SELECT 'sede' AS local 
        UNION 
        SELECT 'laranjal' AS local
      ) l
      LEFT JOIN recicla.recicla_cadastro c ON LOWER(TRIM(c.local)) = l.local
      LEFT JOIN recicla.recicla_pesagens p ON p.cadastro_id_serial = c.id_serial
      GROUP BY l.local;
    `);

    const locaisObj = {
      sede: { participantes: 0, pesagens: 0, pesoTotal: 0 },
      laranjal: { participantes: 0, pesagens: 0, pesoTotal: 0 }
    };

    porLocal.rows.forEach(r => {
      const nomeLocal = r.local ? r.local.toLowerCase() : "";
      if (locaisObj[nomeLocal]) {
        locaisObj[nomeLocal] = {
          participantes: Number(r.participantes),
          pesagens: Number(r.pesagens),
          pesoTotal: Number(r.peso_total)
        };
      }
    });

    res.json({
      sucesso: true,
      dados: {
        consolidado: {
          participantes: Number(geral.rows[0].participantes),
          pesagens: Number(geral.rows[0].pesagens),
          pesoTotal: Number(geral.rows[0].peso_total),
          ultimaAtualizacao: geral.rows[0].ultima_atualizacao
        },
        porLocal: locaisObj
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
 * Retorna o ranking por diretoria, separado por local
 * ==========================================================
 */
router.get("/ranking-diretorias", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        c.diretoria AS diretoria,
        LOWER(TRIM(c.local)) AS local,
        COUNT(DISTINCT c.id_serial) AS total_participantes,
        COALESCE(SUM(p.pesagem), 0) AS peso_total
      FROM recicla.recicla_cadastro c
      LEFT JOIN recicla.recicla_pesagens p
        ON p.cadastro_id_serial = c.id_serial
      GROUP BY c.diretoria, c.local
      HAVING COALESCE(SUM(p.pesagem), 0) > 0
      ORDER BY peso_total DESC;
    `);

    res.json({
      sucesso: true,
      dados: rows.map(r => ({
        diretoria: r.diretoria,
        local: r.local,
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
 * Retorna o histórico de pesagens por dia, diferenciando por local
 * ==========================================================
 */
router.get("/historico-pesagens", async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        data_pesagem::date AS data,
        local,
        SUM(pesagem) AS quantidade
      FROM recicla.recicla_pesagens
      GROUP BY data_pesagem::date, local
      ORDER BY data ASC;
    `);

    res.json({
      sucesso: true,
      dados: rows.map(r => ({
        Data: r.data ? r.data.toISOString().split("T")[0] : "",
        Local: r.local,
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
 * GET /api/recicla/participante?id=1&local=sede
 * Consulta um participante específico considerando ID e Local
 * ==========================================================
 */
router.get("/participante", async (req, res) => {
  try {
    const { id, local } = req.query;

    if (!id || !local) {
      return res.status(400).json({
        sucesso: false,
        erro: "Informe o ID e o local do participante."
      });
    }

    // Busca o participante cruzando o ID (integer) e o Local exato
    const participante = await query(`
      SELECT
        id_serial,
        id AS participante_id,
        nome,
        diretoria,
        email,
        local,
        data_cadastro
      FROM recicla.recicla_cadastro
      WHERE id = $1 AND LOWER(TRIM(local)) = LOWER(TRIM($2))
    `, [id, local]);

    if (participante.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        erro: "Participante não encontrado para este local."
      });
    }

    const idSerial = participante.rows[0].id_serial;

    // Busca o somatório de peso restrito ao id_serial correspondente
    const somatorio = await query(`
      SELECT COALESCE(SUM(pesagem), 0) AS somatorio_peso
      FROM recicla.recicla_pesagens
      WHERE cadastro_id_serial = $1
    `, [idSerial]);

    // Busca o histórico de pesagens individuais deste cadastro
    const pesagens = await query(`
      SELECT
        id AS pesagem_id,
        pesagem,
        data_pesagem,
        local
      FROM recicla.recicla_pesagens
      WHERE cadastro_id_serial = $1
      ORDER BY data_pesagem DESC
    `, [idSerial]);

    res.json({
      sucesso: true,
      dados: {
        ...participante.rows[0],
        id: participante.rows[0].participante_id, // Garante que retorna o id integer correto para o front
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