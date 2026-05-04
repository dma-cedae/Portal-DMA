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

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.lotes (
        id               SERIAL PRIMARY KEY,
        focal_nome       TEXT,
        payload_completo JSONB,
        data_envio       TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.vistorias_itens (
        id                     SERIAL PRIMARY KEY,
        lote_id                INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        unidade_id             TEXT,
        unidade_nome           TEXT,
        vistoria_realizada     TEXT,
        foco_encontrado        TEXT,
        foco_remediado         TEXT,
        locais_foco            JSONB,
        motivos_nao_vistoria   JSONB,
        motivos_nao_remediacao JSONB,
        observacoes            TEXT,
        data_registro          TIMESTAMP DEFAULT NOW()
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
   ROTAS DE VISTORIAS (LOTES)
========================================================= */
app.post("/api/aedes/lotes", async (req, res) => {
  const client = await pool.connect();
  try {
    const { cabecalho, dados } = req.body;
    await client.query('BEGIN');

    // 1. Inserir no Lote (Referência explícita ao schema aedes)
    const loteRes = await client.query(
      `INSERT INTO aedes.lotes (focal_nome, payload_completo) 
       VALUES ($1, $2) RETURNING id`,
      [cabecalho.focal_nome, JSON.stringify(req.body)]
    );
    const loteId = loteRes.rows[0].id;

    // 2. Inserir nos Itens (Referência explícita ao schema aedes)
    const itemQuery = `
      INSERT INTO aedes.vistorias_itens (
        lote_id, unidade_id, unidade_nome, vistoria_realizada, 
        foco_encontrado, foco_remediado, locais_foco, 
        motivos_nao_vistoria, motivos_nao_remediacao, observacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;

    for (const row of dados) {
      await client.query(itemQuery, [
        loteId,
        row[0], // unidadeId
        row[1], // unidadeNome
        row[2], // vistoriaRealizada
        row[3], // focoEncontrado
        row[4], // focoRemediado
        JSON.stringify(row[5] || []), // locaisFoco
        JSON.stringify(row[6] || []), // motivosNaoVistoria
        JSON.stringify(row[7] || []), // motivosNaoRemediacao
        row[8]  // observacoes
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, loteId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERRO NO BANCO:", err.message); // Verifique este log no seu terminal!
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

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