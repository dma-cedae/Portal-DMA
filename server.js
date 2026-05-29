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
  origin: '*',
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
        total_registros  INTEGER, 
        data_envio       TIMESTAMP DEFAULT NOW()
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.vistorias_itens (
        id                           SERIAL PRIMARY KEY,
        lote_id                      INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        unidade_id                   TEXT UNIQUE, 
        unidade_nome                 TEXT,
        vistoria_realizada           TEXT,
        foco_encontrado              TEXT,
        foco_remediado               TEXT,
        motivos_nao_vistoria         JSONB,
        motivos_nao_remediacao       JSONB,
        locais_foco                  JSONB,
        observacoes                  TEXT,
        data_registro                TIMESTAMP DEFAULT NOW(),
        outros_local                 TEXT,
        outros_motivo_nao_vistoria   TEXT,
        outros_motivo_nao_remediacao TEXT,
        id_referencia                TEXT UNIQUE
      );
    `);
  
    // Tabela de Focais
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focais (
        focal_pk BIGSERIAL PRIMARY KEY,
        matricula TEXT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE,
        ativo BOOLEAN DEFAULT true
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focal_unidade (
        focal_unidade_pk BIGSERIAL PRIMARY KEY,
        focal_pk         BIGINT REFERENCES aedes.focais(focal_pk) ON DELETE CASCADE,
        unidade_id       BIGINT, -- Relaciona com a tabela unidades externa
        ativo            BOOLEAN DEFAULT true,
        data_inicio      TIMESTAMP DEFAULT NOW()
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
      SELECT 
        f.focal_pk, 
        f.matricula, 
        f.nome, 
        f.email,
        f.ativo,
        STRING_AGG(u.nome_unidade, ', ') AS focal_unidades
      FROM aedes.focais f
      LEFT JOIN aedes.focal_unidade fu ON f.focal_pk = fu.focal_pk
      LEFT JOIN aedes.unidades u ON fu.unidade_id = u.unidade_id
      WHERE f.ativo = true
      GROUP BY f.focal_pk, f.matricula, f.nome, f.email, f.ativo
      ORDER BY f.nome ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro em /focais/lista:", err.message);
    res.status(500).json({ error: "Erro ao buscar lista detalhada de focais." });
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
      SELECT DISTINCT
        u.unidade_id AS id, 
        u.nome_unidade AS "Unidade", 
        f.matricula, 
        f.email,
        f.nome AS "focalNome"
      FROM aedes.unidades u
      INNER JOIN aedes.focal_unidade fu ON u.unidade_id = fu.unidade_id
      INNER JOIN aedes.focais f ON fu.focal_pk = f.focal_pk
      WHERE u.ativo = true AND f.ativo = true
    `;
    let params = [];

    if (filtro && filtro.trim() !== "") {
      sql += " AND (f.email = $1 OR CAST(f.matricula AS TEXT) = $2)";
      params.push(filtro.trim(), filtro.trim());
    }

    sql += " ORDER BY u.nome_unidade ASC";

    const result = await pool.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro ao buscar dados consolidados:", err.message);
    res.status(500).json({ error: "Erro interno ao buscar base." });
  }
});

/* =========================================================
   CERTIFICADOS
========================================================= */
app.get("/api/aedes/certificados", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        "Unidade",
        EXTRACT(MONTH FROM "Data") AS mes,
        EXTRACT(YEAR FROM "Data") AS ano,
        COUNT(CASE WHEN "UV_Sim" = 'Sim' THEN 1 END) AS total_vistorias,
        CASE 
          WHEN COUNT(DISTINCT "Semana") >= 4 THEN true 
          ELSE false 
        END AS cobertura_semanal_completa,
        CASE 
          WHEN COUNT(CASE WHEN "FE_Sim" = 'Sim' AND "RM_Não" = 'Sim' THEN 1 END) > 0 THEN true
          ELSE false 
        END AS focos_nao_remediados
      FROM aedes.excel_historico
      WHERE "UV_Sim" = 'Sim'
      GROUP BY "Unidade", EXTRACT(YEAR FROM "Data"), EXTRACT(MONTH FROM "Data")
      ORDER BY ano DESC, mes DESC, "Unidade" ASC;
    `);

    const linhasFormatadas = result.rows.map(row => ({
      unidade: row.Unidade, 
      mes: parseInt(row.mes),
      ano: parseInt(row.ano),
      total_vistorias: parseInt(row.total_vistorias || 0),
      cobertura_semanal_completa: row.cobertura_semanal_completa,
      focos_nao_remediados: row.focos_nao_remediados
    }));

    res.json(linhasFormatadas);
  } catch (err) {
    console.error("❌ Erro ao calcular certificados no Banco:", err.message);
    res.status(500).json({ error: "Erro interno ao processar as regras de elegibilidade." });
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

    const loteRes = await client.query(
      `INSERT INTO aedes.lotes (focal_nome, payload_completo, total_registros) 
       VALUES ($1, $2, $3) RETURNING id`,
      [cabecalho.focal_nome, JSON.stringify(req.body), dados.length]
    );
    const loteId = loteRes.rows[0].id;

    const itemQuery = `
      INSERT INTO aedes.vistorias_itens (
        lote_id, id_referencia, unidade_id, unidade_nome, 
        vistoria_realizada, foco_encontrado, foco_remediado, 
        locais_foco, outros_local,
        motivos_nao_vistoria, outros_motivo_nao_vistoria,
        motivos_nao_remediacao, outros_motivo_nao_remediacao,
        observacoes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      ON CONFLICT (id_referencia) DO UPDATE SET
        lote_id = EXCLUDED.lote_id,
        outros_local = EXCLUDED.outros_local,
        outros_motivo_nao_vistoria = EXCLUDED.outros_motivo_nao_vistoria,
        outros_motivo_nao_remediacao = EXCLUDED.outros_motivo_nao_remediacao,
        observacoes = EXCLUDED.observacoes;
    `;

    const dataHoje = new Date().toISOString().split('T')[0].replace(/-/g, '');

    for (const row of dados) {
      const idReferencia = `${row[1].replace(/\s+/g, '')}_${dataHoje}`;
  
      await client.query(itemQuery, [
        loteId,         // $1
        idReferencia,   // $2
        row[0],         // $3 - unidade_id
        row[1],         // $4 - unidade_nome
        row[2],         // $5 - vistoria_realizada
        row[3],         // $6 - foco_encontrado
        row[4],         // $7 - foco_remediado
        JSON.stringify(row[5] || []),  // $8 - locais_foco
        row[6],                        // $9 - outros_local
        JSON.stringify(row[7] || []),  // $10 - motivos_nao_vistoria
        row[8],                        // $11 - outros_motivo_nao_vistoria
        JSON.stringify(row[9] || []),  // $12 - motivos_nao_remediacao
        row[10],                       // $13 - outros_motivo_nao_remediacao
        row[11]                        // $14 - observacoes
      ]);
    }

    await client.query('COMMIT');
    res.status(201).json({ ok: true, loteId });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ ERRO NO BANCO:", err.message);
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
   ROTAS GERAIS E RELATÓRIO DO PAINEL ANALÍTICO
========================================================= */
app.get("/api/unidades", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT "Unidade" AS nome_unidade 
      FROM aedes.excel_historico 
      WHERE "Unidade" IS NOT NULL 
      ORDER BY nome_unidade ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro na rota /api/unidades:", err.message);
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
});

app.get("/api/aedes/painel-dados", async (req, res) => {
  try {
    const query = `
      SELECT 
        EXTRACT(YEAR FROM data_registro)::int AS "Ano",
        CASE EXTRACT(MONTH FROM data_registro)
          WHEN 1 THEN 'Janeiro' WHEN 2 THEN 'Fevereiro' WHEN 3 THEN 'Março'
          WHEN 4 THEN 'Abril' WHEN 5 THEN 'Maio' WHEN 6 THEN 'Junho'
          WHEN 7 THEN 'Julho' WHEN 8 THEN 'Agosto' WHEN 9 THEN 'Setembro'
          WHEN 10 THEN 'Outubro' WHEN 11 THEN 'Novembro' WHEN 12 THEN 'Dezembro'
        END AS "Mes_Nome",
        unidade_nome AS "Unidade",
        CASE WHEN LOWER(TRIM(vistoria_realizada)) = 'sim' THEN 1 ELSE 0 END AS visitada,
        CASE WHEN LOWER(TRIM(vistoria_realizada)) = 'sim' AND LOWER(TRIM(foco_encontrado)) = 'sim' THEN 1 ELSE 0 END AS foco_encontrado,
        CASE WHEN LOWER(TRIM(vistoria_realizada)) = 'sim' AND LOWER(TRIM(foco_encontrado)) = 'sim' AND LOWER(TRIM(foco_remediado)) = 'sim' THEN 1 ELSE 0 END AS foco_remediado,
        CASE WHEN LOWER(TRIM(vistoria_realizada)) = 'sim' AND LOWER(TRIM(foco_encontrado)) = 'sim' AND LOWER(TRIM(foco_remediado)) != 'sim' THEN 1 ELSE 0 END AS foco_pendente,
        CASE WHEN LOWER(motivos_nao_vistoria::text) LIKE '%acesso%' OR LOWER(motivos_nao_vistoria::text) LIKE '%condicao%' THEN 1 ELSE 0 END AS nv_acesso,
        CASE WHEN LOWER(motivos_nao_vistoria::text) LIKE '%brigadista%' THEN 1 ELSE 0 END AS nv_brigadista,
        CASE WHEN LOWER(motivos_nao_vistoria::text) LIKE '%viatura%' THEN 1 ELSE 0 END AS nv_viatura,
        CASE WHEN LOWER(motivos_nao_vistoria::text) LIKE '%esquecimento%' THEN 1 ELSE 0 END AS nv_esquecimento,
        CASE WHEN LOWER(motivos_nao_remediacao::text) LIKE '%treino%' OR LOWER(motivos_nao_remediacao::text) LIKE '%capacita%' THEN 1 ELSE 0 END AS mnr_capacitacao,
        CASE WHEN LOWER(motivos_nao_remediacao::text) LIKE '%cloro%' OR LOWER(motivos_nao_remediacao::text) LIKE '%larvicida%' THEN 1 ELSE 0 END AS mnr_larvicida,
        CASE WHEN LOWER(motivos_nao_remediacao::text) LIKE '%limpeza%' THEN 1 ELSE 0 END AS mnr_limpeza,
        CASE WHEN LOWER(motivos_nao_remediacao::text) LIKE '%cobertura%' OR LOWER(motivos_nao_remediacao::text) LIKE '%tampa%' THEN 1 ELSE 0 END AS mnr_cobertura
      FROM aedes.vistorias_itens;
    `;
    
    const result = await pool.query(query); 
    res.json(result.rows || result);
  } catch (err) {
    console.error("❌ Erro no painel-dados:", err.message);
    res.status(500).json({ error: "Erro interno ao processar o painel analítico." });
  }
});

/* ==========================================================================
   ⭐ SOLUÇÃO DO BUG: INCLUSÃO DA ROTA CONSOLIDADA EXIGIDA PELO FRONTEND
========================================================================== */
app.get("/api/aedes/consolidado", async (req, res) => {
  try {
    // Executa a busca direta na View customizada que criamos no Postgres/Neon
    const query = 'SELECT * FROM aedes.vw_painel_consolidado ORDER BY semana_contagem DESC, unidade ASC;';
    const result = await pool.query(query);

    // Retorna no encapsulamento exato esperado pelo método getConsolidadoView() do front
    res.json({
      sucesso: true,
      dados: result.rows
    });
  } catch (err) {
    console.error("❌ Erro crítico na rota /api/aedes/consolidado:", err.message);
    res.status(500).json({ 
      sucesso: false, 
      error: "Erro ao consultar a view consolidada no banco.",
      details: err.message 
    });
  }
});

/* ==========================================================================
   ROTA DO DOSSIÊ
========================================================================== */
app.get("/api/aedes/focal-dossie", async (req, res) => {
  try {
    const { unidade } = req.query;
    if (!unidade) return res.status(400).json({ error: "Nome da unidade é obrigatório." });

    const query = `
      WITH ranking_unidades AS (
        SELECT 
          vi.unidade_nome,
          DENSE_RANK() OVER (ORDER BY vi.unidade_nome ASC) as id_calculado
        FROM aedes.vistorias_itens vi
        WHERE vi.unidade_nome IS NOT NULL
        GROUP BY vi.unidade_nome
      )
      SELECT f.nome, f.matricula, f.email
      FROM aedes.focal_unidade fu
      INNER JOIN aedes.focais f ON fu.focal_pk = f.focal_pk
      INNER JOIN ranking_unidades ru ON fu.unidade_id = ru.id_calculado
      WHERE LOWER(TRIM(ru.unidade_nome)) = LOWER(TRIM($1))
        AND fu.ativo = true AND f.ativo = true
      LIMIT 1;
    `;

    const result = await pool.query(query, [unidade.trim()]);
    if (result.rows.length === 0) {
      return res.json({ nome: null, matricula: null, email: null });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("❌ Erro em /api/aedes/focal-dossie:", err.message);
    res.status(500).json({ error: "Erro ao buscar dados do focal técnico." });
  }
});

/* ==========================================================================
   SAÚDE DO SISTEMA
========================================================================== */
app.get("/api/health", (_req, res) => {
  const dataBrasilia = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  res.json({ status: "ok", time: dataBrasilia });
});

// Tratadores Globais de Erro e Rotas Inexistentes
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada no servidor." }));
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Erro crítico interno no servidor." });
});

app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  await initSchema();
});