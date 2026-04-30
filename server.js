// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./js/db.js";

// ─── Configuração inicial ────────────────────────────────────────────────────
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares globais ─────────────────────────────────────────────────────
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json({ limit: "10mb" }));

/* =========================================================
   INICIALIZAÇÃO DO BANCO (Tabelas do Módulo Aedes)
========================================================= */
async function initSchema() {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS aedes;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.lotes (
        id                  SERIAL PRIMARY KEY,
        focal_nome          TEXT,
        total_registros     INTEGER DEFAULT 0,
        unidades_vitoriadas JSONB,
        payload_completo    JSONB,
        data_envio          TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log("✅ Schema aedes.lotes verificado.");
  } catch (err) {
    console.error("❌ Erro no initSchema:", err.message);
  }
}

/* =========================================================
   SAÚDE DA API
========================================================= */
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", time: new Date() });
});

/* =========================================================
   UNIDADES
========================================================= */
app.get("/api/unidades", async (_req, res) => {
  console.log("🟢 Rota /api/unidades foi acessada!");
  try {
    const result = await pool.query(`
      SELECT 
        unidade_id, 
        nome_unidade,
        nome_unidade AS "unidade_origem"
      FROM aedes.unidades 
      ORDER BY nome_unidade ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro no Banco:", err.message);
    res.status(500).json({ error: "Erro no banco de dados" });
  }
});

/* =========================================================
   FOCAIS
========================================================= */
app.get("/api/aedes/focais/lista", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        f.focal_pk, 
        f.matricula, 
        f.nome, 
        f.email,
        s.unidade AS focal_unidades
      FROM aedes.focais f
      -- Aqui ligamos o e-mail do focal com o e-mail na tabela de importação
      LEFT JOIN aedes.stg_importacao_excel s ON f.email = s.email 
      WHERE f.ativo = true
      ORDER BY f.nome ASC
    `);
    
    console.log(`[API] Sucesso! Total de linhas retornadas: ${result.rows.length}`);
    res.json(result.rows);
  } catch (err) {
    // Se der erro, ele vai te dizer exatamente qual coluna ele não achou agora
    console.error("❌ Erro na Query:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/aedes/focais/login", async (req, res) => {
  try {
    const { email, matricula } = req.query;

    if (!email || !matricula) {
      return res.status(400).json({ ok: false, error: "Dados incompletos para login." });
    }

    const result = await pool.query(
      `SELECT focal, matricula, email, unidade 
       FROM aedes.stg_importacao_excel
       WHERE email = $1 AND CAST(matricula AS TEXT) = $2`,
      [email.trim(), String(matricula).trim()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ ok: false, error: "Credenciais inválidas." });
    }

    res.json({
      ok: true,
      nome: result.rows[0].focal,
      matricula: result.rows[0].matricula,
      auth_type: "aedes_focal",
    });
  } catch (err) {
    console.error("❌ Erro no login focal:", err.message);
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  }
});

/* =========================================================
   BASE CONSOLIDADA
========================================================= */
app.get("/api/aedes/base", async (req, res) => {
  try {
    const { filtro } = req.query;

    let sql = `
      SELECT 
        matricula, 
        unidade, 
        focal AS "focalNome", 
        email 
      FROM aedes.stg_importacao_excel
    `;
    let params = [];

    // Ajustado para aceitar o e-mail que vem do front-end
    if (filtro && filtro.trim() !== "") {
      sql += " WHERE CAST(matricula AS TEXT) = $1 OR focal ILIKE $2 OR email = $3";
      params.push(filtro.trim(), `%${filtro.trim()}%`, filtro.trim());
    }

    sql += " ORDER BY unidade ASC";

    const result = await pool.query(sql, params);
    console.log(`[API] /aedes/base — Filtro: ${filtro} | Registros: ${result.rowCount}`);

    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro na rota /api/aedes/base:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar base consolidada." });
  }
});

/* =========================================================
   LOTES DE VISTORIAS
========================================================= */
app.get("/api/aedes/lotes", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, 
        focal_nome, 
        total_registros,
        data_envio,
        payload_completo 
      FROM aedes.lotes
      ORDER BY data_envio DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar lotes:", err.message);
    res.status(500).json({ error: "Erro ao buscar vistorias enviadas." });
  }
});

app.get("/api/aedes/lotes/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT * FROM aedes.lotes WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Lote não localizado." });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro ao buscar lote:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/aedes/lotes", async (req, res) => {
  try {
    const { focal_nome, totalRegistros, payload_completo } = req.body;

    const result = await pool.query(
      `INSERT INTO aedes.lotes (focal_nome, total_registros, payload_completo, data_envio)
       VALUES ($1, $2, $3, NOW())
       RETURNING id;`,
      [
        focal_nome || "Focal não identificado",
        totalRegistros || 0,
        payload_completo || {},  // pg serializa JSONB automaticamente
      ]
    );

    console.log(`✅ Lote salvo! ID: ${result.rows[0].id}`);
    res.status(201).json({ ok: true, loteId: result.rows[0].id });
  } catch (err) {
    console.error("❌ Erro ao salvar lote:", err.message);
    res.status(500).json({ ok: false, error: "Falha ao gravar os dados no banco." });
  }
});

/* =========================================================
   CERTIFICADOS
========================================================= */
app.get("/api/aedes/certificados", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        unidade,
        EXTRACT(MONTH FROM data_envio) AS mes,
        EXTRACT(YEAR  FROM data_envio) AS ano,
        COUNT(*) AS total_vistorias
      FROM (
        SELECT 
          jsonb_array_elements(payload_completo->'registros')->>'unidade' AS unidade,
          data_envio
        FROM aedes.lotes
      ) subconsulta
      GROUP BY unidade, ano, mes
      HAVING COUNT(*) >= 2
      ORDER BY ano DESC, mes DESC, unidade ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao calcular certificados:", err.message);
    res.status(500).json({ error: "Erro ao calcular certificados" });
  }
});

/* =========================================================
   HANDLERS DE ERRO GLOBAIS
========================================================= */
// 404 — rota não encontrada
app.use((_req, res) => {
  res.status(404).json({ error: "Rota não encontrada." });
});

// 500 — erro interno não tratado
app.use((err, _req, res, _next) => {
  console.error("❌ Erro não tratado:", err.message);
  res.status(500).json({ error: "Erro interno do servidor." });
});

/* =========================================================
   START SERVER
========================================================= */
app.listen(PORT, async () => {
  console.log(`🚀 Servidor DMA rodando em: http://localhost:${PORT}`);
  await initSchema();
});