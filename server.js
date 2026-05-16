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
        id                     SERIAL PRIMARY KEY,
        lote_id                INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        unidade_id             TEXT UNIQUE, 
        unidade_nome           TEXT,
        vistoria_realizada     TEXT,
        foco_encontrado        TEXT,
        foco_remediado         TEXT,
        motivos_nao_vistoria   JSONB,
        motivos_nao_remediacao JSONB,
        locais_foco            JSONB,
        observacoes            TEXT,
        data_registro          TIMESTAMP DEFAULT NOW(),
        outros_local           TEXT,
        outros_motivo_nao_vistoria TEXT,
        outros_motivo_nao_remediacao TEXT,
        id_referencia          TEXT UNIQUE
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

/* ------------------------------------------------
server antigo lkasemirogit.hub

app.get("/api/aedes/base", async (req, res) => {
  try {
    const { filtro } = req.query;

    let sql = `
      SELECT 
        u.unidade_id AS id, 
        u.nome_unidade AS unidade, 
        stg.matricula, 
        stg.email,
        stg.focal AS "focalNome"
      FROM aedes.unidades u
      INNER JOIN aedes.stg_importacao_excel stg ON u.nome_unidade = stg.unidade
    `;
    let params = [];

    if (filtro && filtro.trim() !== "") {
      sql += " WHERE stg.email = $1 OR CAST(stg.matricula AS TEXT) = $2";
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
*/


app.get("/api/aedes/base", async (req, res) => {
  try {
    const { filtro } = req.query;

    // Buscando agora a partir do excel_historico e trazendo dados limpos
    let sql = `
      SELECT DISTINCT
        u.unidade_id AS id, 
        u.nome_unidade AS Unidade, 
        h.matricula, 
        h.email,
        h.focal AS "focalNome"
      FROM aedes.unidades u
      INNER JOIN aedes.excel_historico h ON u.nome_unidade = h.unidade
    `;
    let params = [];

    if (filtro && filtro.trim() !== "") {
      sql += " WHERE h.email = $1 OR CAST(h.matricula AS TEXT) = $2";
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
    // Query ajustada para comparar strings ('Sim') e usar os nomes exatos das colunas do seu banco
    const result = await pool.query(`
      SELECT 
        "Unidade",
        EXTRACT(MONTH FROM "Data") AS mes,
        EXTRACT(YEAR FROM "Data") AS ano,
        
        -- Conta quantas vistorias foram realizadas de fato no mês
        COUNT(CASE WHEN "UV_Sim" = 'Sim' THEN 1 END) AS total_vistorias,
        
        -- Regra 1: Garante que houve vistorias em pelo menos 4 semanas distintas do mês
        CASE 
          WHEN COUNT(DISTINCT "Semana") >= 4 THEN true 
          ELSE false 
        END AS cobertura_semanal_completa,
        
        -- Regra 2: Verifica se sobrou algum foco sem remédio (Foco = Sim e Remediação Não = Sim)
        CASE 
          WHEN COUNT(CASE WHEN "FE_Sim" = 'Sim' AND "RM_Não" = 'Sim' THEN 1 END) > 0 THEN true
          ELSE false 
        END AS focos_nao_remediados

      FROM aedes.excel_historico
      WHERE "UV_Sim" = 'Sim' -- Filtra apenas registros com vistorias concluídas
      GROUP BY "Unidade", EXTRACT(YEAR FROM "Data"), EXTRACT(MONTH FROM "Data")
      ORDER BY ano DESC, mes DESC, "Unidade" ASC;
    `);

    // Formata o retorno mapeando as propriedades para minúsculas
    // Isso garante compatibilidade perfeita com o seu arquivo aedes-publico.js no front-end
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

    // 1. Inserir no Lote - AGORA COM 3 PARÂMETROS ($1, $2, $3)
    const loteRes = await client.query(
      `INSERT INTO aedes.lotes (focal_nome, payload_completo, total_registros) 
       VALUES ($1, $2, $3) RETURNING id`,
      [cabecalho.focal_nome, JSON.stringify(req.body), dados.length] // <-- Adicionado dados.length ($3)
    );
    const loteId = loteRes.rows[0].id;

    // 2. Inserir nos Itens - EXATAMENTE 14 PLACEHOLDERS ($1 até $14)
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
  // Gerar ID Semântico
  const idReferencia = `${row[1].replace(/\s+/g, '')}_${dataHoje}`;
  
      // 3. MAPEAMENTO DE 14 VALORES CORRESPONDENTES
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
   ROTAS GERAIS
========================================================= */

/*app.get("/api/unidades", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades ORDER BY nome_unidade ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
});
*/
app.get("/api/unidades", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades ORDER BY nome_unidade ASC`);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ ERRO NA ROTA UNIDADES:", err.message); // <-- Adicione essa linha temporariamente
    res.status(500).json({ error: "Erro ao buscar unidades.", detalhe: err.message }); // <-- E mude aqui para ver o erro no navegador
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