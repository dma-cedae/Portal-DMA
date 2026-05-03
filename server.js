// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./js/db.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middlewares ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(express.json({ limit: "10mb" }));

// ─── Inicialização do Banco ──────────────────────────────────────────────────
async function initSchema() {
  try {
    await pool.query(`CREATE SCHEMA IF NOT EXISTS aedes;`);

    // Tabela de Lotes
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.lotes (
        id              SERIAL PRIMARY KEY,
        focal_nome      TEXT,
        total_registros INTEGER DEFAULT 0,
        unidades_vitoriadas JSONB,
        payload_completo    JSONB,
        data_envio      TIMESTAMP DEFAULT NOW()
      );
    `);

    // Tabela de Focais
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focais (
        focal_pk SERIAL PRIMARY KEY,
        matricula TEXT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE,
        ativo BOOLEAN DEFAULT true
      );
    `);

    console.log("✅ Tabelas aedes.lotes e aedes.focais verificadas.");
  } catch (err) {
    console.error("❌ Erro no initSchema:", err.message);
  }
}

/* =========================================================
   ROTAS DE FOCAIS (Ajustadas para o Dashboard)
========================================================= */

// 🟢 ROTA PRINCIPAL: Usada pelo getFocais() do seu front-end
app.get("/api/aedes/focais", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT nome, email FROM aedes.focais 
      WHERE ativo = true ORDER BY nome ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar lista de focais" });
  }
});

// Rota Detalhada (com Join na importação)
app.get("/api/aedes/focais/lista", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.focal_pk, f.matricula, f.nome, f.email, s.unidade AS focal_unidades
      FROM aedes.focais f
      LEFT JOIN aedes.stg_importacao_excel s ON f.email = s.email 
      WHERE f.ativo = true
      ORDER BY f.nome ASC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login do Focal
app.get("/api/aedes/focais/login", async (req, res) => {
  try {
    const { email, matricula } = req.query;
    if (!email || !matricula) return res.status(400).json({ ok: false, error: "Dados incompletos." });

    const result = await pool.query(
      `SELECT focal, matricula, email, unidade 
       FROM aedes.stg_importacao_excel
       WHERE email = $1 AND CAST(matricula AS TEXT) = $2`,
      [email.trim(), String(matricula).trim()]
    );

    if (result.rows.length === 0) return res.status(401).json({ ok: false, error: "Credenciais inválidas." });

    res.json({ ok: true, nome: result.rows[0].focal, auth_type: "aedes_focal" });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Erro no servidor." });
  }
});

/* =========================================================
   ROTAS DE VISTORIAS (LOTES)
========================================================= */

app.get("/api/aedes/lotes", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, focal_nome, total_registros, data_envio, payload_completo 
      FROM aedes.lotes ORDER BY data_envio DESC
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar lotes." });
  }
});

app.post("/api/aedes/lotes", async (req, res) => {
  try {
    const { focal_nome, totalRegistros, payload_completo } = req.body;
    const result = await pool.query(
      `INSERT INTO aedes.lotes (focal_nome, total_registros, payload_completo, data_envio)
       VALUES ($1, $2, $3, NOW()) RETURNING id;`,
      [focal_nome || "Focal não identificado", totalRegistros || 0, payload_completo || {}]
    );
    res.status(201).json({ ok: true, loteId: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Falha ao gravar dados." });
  }
});

/* =========================================================
   ROTAS GERAIS
========================================================= */

app.get("/api/unidades", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades ORDER BY nome_unidade ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok", time: new Date() }));

// Error Handlers
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro interno no servidor." });
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  await initSchema();
});