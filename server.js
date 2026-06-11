// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { pool } from "./js/db.js";

// 🟢 Ponte limpa e homologada para pacotes legados do CommonJS
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Carrega a classe PdfPrinter de forma limpa pelo require padrão do Node.js
const PdfPrinter = require('pdfmake');

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
        outros_motivos_nao_vistoria   TEXT,
        outros_motivos_nao_remediacao TEXT,
        id_referencia                TEXT UNIQUE
      );
    `);
  
// Nova rota para tabela fato_vistorias (Consolidado: EXCEL + PORTAL)

   await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.fato_vistorias (
        id                           SERIAL PRIMARY KEY,
        lote_id                      INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        unidade_id                   TEXT UNIQUE, 
        unidade_nome                 TEXT,
        vistoria_realizada           TEXT,
        foco_encontrado              TEXT,
        foco_remediado               TEXT,
        motivos_nao_vistoria         TEXT,
        motivos_nao_remediacao       TEXT,
        locais_foco                  TEXT,
        observacoes                  TEXT,
        data_registro                TIMESTAMP DEFAULT NOW(),
        outros_locais_foco           TEXT,
        outros_motivos_nao_vistoria  TEXT,
        outros_motivos_nao_remediacao TEXT,
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
    
  // ─── CORREÇÃO E CRIAÇÃO DAS VIEWS DO SPRINT 3 ───────────────────────────
    
    // 1. Recriando a vw_resumo_aedes (Que estava faltando)
    await pool.query(`
      CREATE OR REPLACE VIEW aedes.vw_resumo_aedes AS
      SELECT 
        COUNT(*) AS total_registros,
        COUNT(CASE WHEN LOWER(vistoria_realizada) = 'sim' THEN 1 END) AS total_vistorias,
        COUNT(CASE WHEN LOWER(foco_encontrado) = 'sim' THEN 1 END) AS total_focos,
        COUNT(CASE WHEN LOWER(foco_encontrado) = 'sim' AND LOWER(foco_remediado) = 'sim' THEN 1 END) AS total_remediados
      FROM aedes.fato_vistorias;
    `);

    // 2. Correção segura para a Pizza de Motivos de Não Vistoria (Evitando erro de escalar)
      await pool.query(`
    CREATE OR REPLACE VIEW aedes.vw_motivos_nao_vistoria AS
    SELECT 
      COALESCE(motivo::text, 'Não Informado') AS motivo,
      COUNT(*) AS quantidade
    FROM aedes.fato_vistorias,
    LATERAL (
        SELECT motivos_nao_vistoria AS motivo WHERE motivos_nao_vistoria IS NOT NULL AND motivos_nao_vistoria <> ''
    UNION ALL
    SELECT outros_motivos_nao_vistoria WHERE outros_motivos_nao_vistoria IS NOT NULL AND outros_motivos_nao_vistoria <> ''
  ) AS sub
  GROUP BY motivo;
` );

    // 3. Correção segura para a Pizza de Motivos de Não Remediação
    await pool.query(`
      CREATE OR REPLACE VIEW aedes.vw_motivos_nao_remediacao AS
      SELECT 
        COALESCE(motivo::text, 'Não Informado') AS motivo,
        COUNT(*) AS quantidade
      FROM aedes.fato_vistorias,
     LATERAL (
        SELECT motivos_nao_remediacao AS motivo WHERE motivos_nao_remediacao IS NOT NULL AND motivos_nao_remediacao <> ''
    UNION ALL
    SELECT outros_motivos_nao_remediacao WHERE outros_motivos_nao_remediacao IS NOT NULL AND outros_motivos_nao_remediacao <> ''
  ) AS sub
  GROUP BY motivo;
` );

    // 4. Correção segura para a Pizza de Locais de Foco
        // 4. Correção segura para a Pizza de Locais de Foco
      await pool.query(`
        -- 1. Remove a view antiga para evitar o erro de alteração de nome de coluna
        DROP VIEW IF EXISTS aedes.vw_locais_foco;

        -- 2. Cria a nova view com a lógica corrigida
        CREATE VIEW aedes.vw_locais_foco AS
        SELECT 
          COALESCE(sub.local::text, 'Não Informado') AS locais_foco,
          COUNT(*) AS quantidade
        FROM aedes.fato_vistorias,
        LATERAL (
          SELECT locais_foco AS local WHERE locais_foco IS NOT NULL AND locais_foco <> ''
          UNION ALL
          SELECT outros_locais_foco AS local WHERE outros_locais_foco IS NOT NULL AND outros_locais_foco <> ''
        ) AS sub
        GROUP BY sub.local; -- Agrupa pelo resultado do LATERAL
      `);


    console.log("✅ Estrutura de tabelas e Views do Sprint 3 validadas com sucesso.");
  } catch (err) {
    console.error("❌ Erro no initSchema:", err.message);
  }
}


/* =========================================================
   ROTAS REQUISITADAS NO SPRINT 3
========================================================= */

// ─── ROTAS DO CENTRO OPERACIONAL (aedes-tecnico.html) ──────────────────────

// 1. Matriz de Cobertura Semanal
app.get("/api/aedes/cobertura-semanal", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vw_cobertura_semanal ORDER BY ano DESC, semana DESC`);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro em /cobertura-semanal:", err.message);
    res.status(500).json({ error: "Erro ao buscar matriz de cobertura." });
  }
});

// 2. Unidades Pendentes e Focos Não Remediados
app.get("/api/aedes/unidades-pendentes", async (req, res) => {
  try {
    // Caso a view física retorne nula, criamos um fallback dinâmico seguro na query
    const result = await pool.query(`
      SELECT 
        unidade_id,
        unidade_nome,
        data_registro,
        CASE WHEN LOWER(vistoria_realizada) <> 'sim' THEN 'Não Enviado/Não Vistoriado' ELSE 'Pendente de Remediação' END AS status_pendencia
      FROM aedes.fato_vistorias
      WHERE LOWER(vistoria_realizada) <> 'sim' 
         OR (LOWER(foco_encontrado) = 'sim' AND LOWER(foco_remediado) <> 'sim')
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Erro em /unidades-pendentes:", err.message);
    res.status(500).json({ error: "Erro ao buscar pendências." });
  }
});

// ─── ROTAS DO CENTRO ANALÍTICO (aedes-painel.html) ─────────────────────────

// 3. KPIs de Resumo (Total vistorias, focos, remediados)
app.get("/api/aedes/resumo", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vw_resumo_aedes`);
    res.json(result.rows[0] || { total_registros: 0, total_vistorias: 0, total_focos: 0, total_remediados: 0 });
  } catch (err) {
    console.error("Erro em /resumo:", err.message);
    res.status(500).json({ error: "Erro ao buscar resumo de KPIs." });
  }
});

/* ==========================================================================\
   ROTAS ANALÍTICAS ATUALIZADAS (INTEGRAÇÃO HISTÓRICO EXCEL + LOTES API)
========================================================================== */

// 1. ROTA PRINCIPAL: KPIs, Tabelas de Outros e Ranking Global (Puxa tudo da Fato/View)
app.get("/api/aedes/painel-dados", async (req, res) => {
  try {
    const { unidade, ano, mes, semana } = req.query;

    // USANDO AS COLUNAS REAIS DA SUA TABELA FATO_VISTORIAS (PLURAIS E EXCEL-COMPATÍVEIS)
    let query = `
      SELECT 
        origem,
        lote_id,
        data_registro,
        ano,
        mes,
        semana,
        unidade_id,
        unidade_nome,
        vistoria_realizada,
        foco_encontrado,
        foco_remediado,
        motivos_nao_vistoria,
        motivos_nao_remediacao,
        locais_foco,
        outros_motivos_nao_vistoria,
        outros_motivos_nao_remediacao,
        outros_locais_foco,
        observacoes,
        semana_acumulada
      FROM aedes.fato_vistorias 
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;

    // Filtros dinâmicos sanitizados
    if (unidade && unidade.trim() !== "") { 
      query += ` AND LOWER(unidade_nome) = LOWER($${paramIndex})`; 
      params.push(unidade.trim()); 
      paramIndex++; 
    }
    if (ano && ano.trim() !== "") { 
      query += ` AND ano = $${paramIndex}`; 
      params.push(parseInt(ano)); 
      paramIndex++; 
    }
    if (mes && mes.trim() !== "") { 
      query += ` AND mes = $${paramIndex}`; 
      params.push(parseInt(mes)); 
      paramIndex++; 
    }
    if (semana && semana.trim() !== "") { 
      query += ` AND semana = $${paramIndex}`; 
      params.push(parseInt(semana)); 
      paramIndex++; 
    }

    // Ordenação padrão e limite seguro para não sobrecarregar a memória do Node
    query += ` ORDER BY ano DESC, semana DESC LIMIT 25000`;

    const result = await pool.query(query, params);
    
    // Retorna o objeto esperado pelo seu aedes-painel.js
    res.json({ registros: result.rows });
  } catch (err) {
    // Isto vai printar no terminal do Node o erro exato caso ainda falte algo
    console.error("❌ Erro crítico na rota /api/aedes/painel-dados:", err.message);
    res.status(500).json({ error: "Erro interno no servidor ao processar a base unificada.", detalhe: err.message });
  }
});

// 2. ROTA DA LINHA DO TEMPO: Cobertura Cronológica Baseada na View ou Fato
app.get("/api/aedes/cobertura-semanal", async (req, res) => {
  try {
    const { unidade, ano, mes, semana } = req.query;

    // Se sua view 'vw_cobertura_semanal' já calcula em cima da fato_vistorias, usamos ela:
    let query = `SELECT * FROM aedes.vw_cobertura_semanal WHERE 1=1`;
    const params = [];
    let paramIndex = 1;

    if (unidade) { query += ` AND LOWER(unidade_nome) = LOWER($${paramIndex})`; params.push(unidade); paramIndex++; }
    if (ano) { query += ` AND ano = $${paramIndex}`; params.push(parseInt(ano)); paramIndex++; }
    if (mes) { query += ` AND mes = $${paramIndex}`; params.push(parseInt(mes)); paramIndex++; }
    if (semana) { query += ` AND semana = $${paramIndex}`; params.push(parseInt(semana)); paramIndex++; }

    query += ` ORDER BY ano DESC, semana ASC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Erro em cobertura-semanal:", err.message);
    // Fallback de segurança caso a view quebre com strings vazias: busca agregada direto na Fato
    try {
      let fallbackQuery = `
        SELECT ano, semana, COUNT(*) as registros,
               SUM(CASE WHEN LOWER(vistoria_realizada) = 'sim' THEN 1 ELSE 0 END) as vistorias
        FROM aedes.fato_vistorias
        WHERE 1=1
      `;
      // (mesmos filtros aplicados ao fallback se necessário...)
      fallbackQuery += ` GROUP BY ano, semana ORDER BY ano DESC, semana ASC`;
      const fallbackResult = await pool.query(fallbackQuery);
      return res.json(fallbackResult.rows);
    } catch (fallbackErr) {
      res.status(500).json({ error: "Erro ao gerar histórico linear." });
    }
  }
});

// 5. Exportações Fake/Estruturadas (CSV e PDF) para download no Frontend
app.get("/api/aedes/export/csv", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vistorias_itens`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-aedes.csv');
    
    // Converte de forma simples para CSV string
    const campos = ["id", "unidade_nome", "vistoria_realizada", "foco_encontrado", "foco_remediado", "data_registro"];
    let csvContent = campos.join(",") + "\n";
    result.rows.forEach(row => {
      csvContent += `${row.id},"${row.unidade_nome}",${row.vistoria_realizada},${row.foco_encontrado},${row.foco_remediado},${row.data_registro}\n`;
    });
    return res.status(200).send(csvContent);
  } catch (err) {
    res.status(500).json({ error: "Erro ao exportar CSV." });
  }
});

app.get("/api/aedes/export/pdf", async (req, res) => {
  // Como a geração de PDF pesada roda melhor no cliente (com pdfmake ou jspdf)
  // Deixamos a rota pronta retornando a estrutura que o front precisa para montar o PDF
  try {
    const result = await pool.query(`SELECT unidade_nome, vistoria_realizada, foco_encontrado FROM aedes.vistorias_itens`);
    res.json({ titulo: "Relatório Analítico de Vistorias - AEDES", emitidoEm: new Date(), dados: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Erro ao preparar dados para PDF." });
  }
});


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
   CERTIFICADOS (CONSOLIDADO: EXCEL + PORTAL) - REVISADO
========================================================= */
app.get("/api/aedes/certificados", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        UPPER(TRIM(unidade)) AS unidade,
        EXTRACT(MONTH FROM data_registro) AS mes,
        EXTRACT(YEAR FROM data_registro) AS ano,
        COUNT(CASE WHEN uv_sim = 'Sim' THEN 1 END) AS total_vistorias,
        -- Elegível se houver vistorias registradas em pelo menos 4 semanas diferentes
        CASE 
          WHEN COUNT(DISTINCT semana) >= 4 THEN true 
          ELSE false 
        END AS cobertura_semanal_completa,
        -- Foco em aberto: se achou foco (fe_sim = 'Sim') mas a remediação NÃO foi concluída (rm_sim != 'Sim')
        CASE 
          WHEN COUNT(CASE WHEN fe_sim = 'Sim' AND rm_sim <> 'Sim' THEN 1 END) > 0 THEN true
          ELSE false 
        END AS focos_nao_remediados
      FROM aedes.excel_portal
      WHERE uv_sim = 'Sim'
      GROUP BY UPPER(TRIM(unidade)), EXTRACT(YEAR FROM data_registro), EXTRACT(MONTH FROM data_registro)
      ORDER BY ano DESC, mes DESC, unidade ASC;
    `);

    const linhasFormatadas = result.rows.map(row => ({
      unidade: row.unidade, // Agora garantido em formato UPPER pelo banco
      mes: parseInt(row.mes),
      ano: parseInt(row.ano),
      total_vistorias: parseInt(row.total_vistorias || 0),
      cobertura_semanal_completa: row.cobertura_semanal_completa,
      focos_nao_remediados: row.focos_nao_remediados
    }));

    res.json(linhasFormatadas);
  } catch (err) {
    console.error("❌ Erro ao calcular certificados na tabela consolidada:", err.message);
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
    const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades ORDER BY nome_unidade ASC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar unidades." });
  }
});

/*app.get("/api/unidades", async (_req, res) => {
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
}); */

app.get("/api/aedes/painel-dados", async (req, res) => {

  try {

    const query = `
      SELECT

        ano AS "Ano",

        CASE mes
          WHEN 1 THEN 'Janeiro'
          WHEN 2 THEN 'Fevereiro'
          WHEN 3 THEN 'Março'
          WHEN 4 THEN 'Abril'
          WHEN 5 THEN 'Maio'
          WHEN 6 THEN 'Junho'
          WHEN 7 THEN 'Julho'
          WHEN 8 THEN 'Agosto'
          WHEN 9 THEN 'Setembro'
          WHEN 10 THEN 'Outubro'
          WHEN 11 THEN 'Novembro'
          WHEN 12 THEN 'Dezembro'
        END AS "Mes_Nome",

        unidade_nome AS "Unidade",

        CASE
          WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim'
          THEN 1
          ELSE 0
        END AS visitada,

        CASE
          WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim'
           AND LOWER(COALESCE(foco_encontrado,'')) = 'sim'
          THEN 1
          ELSE 0
        END AS foco_encontrado,

        CASE
          WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim'
           AND LOWER(COALESCE(foco_encontrado,'')) = 'sim'
           AND LOWER(COALESCE(foco_remediado,'')) = 'sim'
          THEN 1
          ELSE 0
        END AS foco_remediado,

        CASE
          WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim'
           AND LOWER(COALESCE(foco_encontrado,'')) = 'sim'
           AND LOWER(COALESCE(foco_remediado,'')) <> 'sim'
          THEN 1
          ELSE 0
        END AS foco_pendente,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_vistoria::text,'')) LIKE '%acesso%'
          THEN 1
          ELSE 0
        END AS nv_acesso,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_vistoria::text,'')) LIKE '%brigadista%'
          THEN 1
          ELSE 0
        END AS nv_brigadista,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_vistoria::text,'')) LIKE '%viatura%'
          THEN 1
          ELSE 0
        END AS nv_viatura,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_vistoria::text,'')) LIKE '%esquecimento%'
          THEN 1
          ELSE 0
        END AS nv_esquecimento,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%treinamento%'
            OR LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%capacitacao%'
          THEN 1
          ELSE 0
        END AS mnr_capacitacao,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%cloro%'
            OR LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%larvicida%'
          THEN 1
          ELSE 0
        END AS mnr_larvicida,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%limpeza%'
          THEN 1
          ELSE 0
        END AS mnr_limpeza,

        CASE
          WHEN LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%cobertura%'
            OR LOWER(COALESCE(motivos_nao_remediacao::text,'')) LIKE '%tampa%'
          THEN 1
          ELSE 0
        END AS mnr_cobertura

      FROM aedes.fato_vistorias
    `;

    const result = await pool.query(query);

    res.json(result.rows);

  } catch (err) {

    console.error(
      "❌ Erro no painel-dados:",
      err
    );

    res.status(500).json({
      error: "Erro interno ao processar o painel analítico."
    });

  }

});

/* ==========================================================================
   ⭐ SOLUÇÃO temporária: consolidaremos na tabela fato_vistorias 
========================================================================== */
app.get("/api/aedes/consolidado", async (req, res) => {
  try {
    // Mapeia os campos reais descobertos na estrutura da tabela física
    const query = `
      SELECT 
        id,
        semana AS semana_contagem,
        semana_acumulada AS periodo_semana,
        ano,
        data_registro AS data_real_envio,
        unidade,
        uv_sim,
        uv_nao,
        fe_sim,
        fe_nao,
        rm_sim,
        rm_nao,
        matricula,
        focal_nome AS focal,
        focal_email
      FROM aedes.excel_portal 
      ORDER BY semana DESC, unidade ASC;
    `;
    
    const result = await pool.query(query);

    res.json({
      sucesso: true,
      dados: result.rows
    });
  } catch (err) {
    console.error("❌ Erro crítico na rota /api/aedes/consolidado:", err.message);
    res.status(500).json({ 
      sucesso: false, 
      error: "Erro ao consultar a tabela física no banco de dados.",
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

// =========================================================================
// MÓDULO EXTRA: GERAÇÃO DE RELATÓRIO EXECUTIVO EM PDF (ESTILO RMARKDOWN)
// =========================================================================
const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

app.get("/api/aedes/relatorio-pdf", async (req, res) => {
  try {
    const { unidade, ano } = req.query;

    // 1. Injeta a mesma lógica exata e precisa do seu endpoint "painel-dados"
    let sql = `
      SELECT 
        COUNT(*) as total_registros,
        SUM(CASE WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim' THEN 1 ELSE 0 END) as total_vistorias,
        SUM(CASE WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim' AND LOWER(COALESCE(foco_encontrado,'')) = 'sim' THEN 1 ELSE 0 END) as total_focos,
        SUM(CASE WHEN LOWER(COALESCE(vistoria_realizada,'')) = 'sim' AND LOWER(COALESCE(foco_encontrado,'')) = 'sim' AND LOWER(COALESCE(foco_remediado,'')) = 'sim' THEN 1 ELSE 0 END) as total_remediados
      FROM aedes.fato_vistorias
      WHERE 1=1
    `;
    const params = [];
    let pIndex = 1;

    // Filtros reativos baseados nos nomes de colunas que seu banco usa ('unidade_nome' e 'ano')
    if (unidade && unidade.trim() !== "" && unidade !== "TODOS" && unidade !== "Todas as Unidades Operacionais" && unidade !== "TODAS") {
      sql += ` AND LOWER(unidade_nome) = LOWER($${pIndex})`;
      params.push(unidade.trim());
      pIndex++;
    }
    if (ano && ano.trim() !== "" && ano !== "TODOS" && ano !== "Todos os Anos Combinados") {
      sql += ` AND ano = $${pIndex}`;
      params.push(parseInt(ano));
      pIndex++;
    }

    const result = await pool.query(sql, params);
    const dados = result.rows[0];

    // Converte os resultados com segurança
    const totalReg = parseInt(dados.total_registros || 0);
    const totalVis = parseInt(dados.total_vistorias || 0);
    const totalFoc = parseInt(dados.total_focos || 0);
    const totalRem = parseInt(dados.total_remediados || 0);
    
    // Cálculo das taxas reais do programa
    const txVistoria = totalReg > 0 ? ((totalVis / totalReg) * 100).toFixed(1) : "0.0";
    const txRemediacao = totalFoc > 0 ? ((totalRem / totalFoc) * 100).toFixed(1) : "0.0";

    const labelUnidade = params[0] ? unidade : 'Todas as Unidades';
    const labelAno = ano && ano !== "TODOS" ? ano : 'Histórico Consolidado';

    // 2. Definição do documento estruturado em PDF (Estilo RMarkdown/Flatly)
    const docDefinition = {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        { text: 'PROGRAMA AEDES — CENTRO ANALÍTICO CEDAE', style: 'header' },
        { text: `Sumário de Diagnóstico Técnico e Operacional | Filtros: ${labelUnidade} — ${labelAno}`, style: 'subheader' },
        { canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, linewidth: 1.5, lineColor: '#0056b3' }] },
        { text: '\n' },

        { text: '1. Resumo Executivo dos Indicadores', style: 'sectionHeader' },
        {
          text: `Este documento apresenta o sumário analítico automatizado das atividades de monitoramento vetorial. No escopo selecionado pelos filtros aplicados em tempo real no painel corporativo, foram computados e processados um total de ${totalReg.toLocaleString('pt-BR')} registros de formulários de campo. Esta amostragem resultou em uma taxa de cobertura de vistorias efetivadas com sucesso de ${txVistoria}%.`,
          style: 'bodyText'
        },
        { text: '\n' },

        // Tabela de Métricas Alinhada
        {
          style: 'tableExample',
          table: {
            widths: ['*', '*'],
            body: [
              [
                { text: 'Indicador Operacional', style: 'tableHeader' }, 
                { text: 'Métrica Quantitativa', style: 'tableHeader' }
              ],
              ['Total de Registros Avaliados (Base Histórica + API)', `${totalReg.toLocaleString('pt-BR')} formulários`],
              ['Vistorias Efetivadas com Sucesso (visitada)', `${totalVis.toLocaleString('pt-BR')} locais`],
              ['Focos de Vetores Detectados em Inspeção', { text: `${totalFoc.toLocaleString('pt-BR')} ocorrências`, color: '#ef4444', bold: true }],
              ['Focos Remediados pelas Equipes de Campo', `${totalRem.toLocaleString('pt-BR')} ações`],
              ['Taxa de Eficácia de Remediação Preventiva', `${txRemediacao}% das ocorrências`]
            ]
          },
          layout: {
            fillColor: (rowIndex) => (rowIndex === 0) ? '#0056b3' : (rowIndex % 2 === 0) ? '#f8fafc' : null,
            hLineColor: () => '#e2e8f0',
            vLineColor: () => '#e2e8f0'
          }
        },
        { text: '\n' },

        { text: '2. Diagnóstico Técnico Operacional', style: 'sectionHeader' },
        {
          text: [
            { text: 'Análise Crítica: ', bold: true },
            `A relação de dados consolidados reflete diretamente o comportamento estatístico mapeado no painel de controle. `,
            totalFoc > 0 ? `Com um volume de ${totalFoc} focos identificados pelas inspeções operacionais, a equipe conseguiu realizar ações de bloqueio e remediação imediata em ${totalRem} desses pontos. ` : 'Nenhum foco crítico latente foi retido sob os critérios do escopo selecionado. ',
            `Historicamente, os gargalos operacionais e reincidências de focos não remediados concentram-se em fatores estruturais complexos, tais como calhas obstruídas de difícil acesso, reservatórios operacionais elevados sem cobertura adequada ou focos naturais volumosos em áreas de vegetação.`
          ],
          style: 'bodyText'
        },
        { text: '\n' },

        { text: '3. Recomendações Técnicas', style: 'sectionHeader' },
        {
          ul: [
            'Reforçar campanhas de limpeza em calhas e coberturas nos períodos que antecedem as semanas epidemiológicas críticas;',
            'Padronizar as vistorias digitais via API para reduzir a incidência de campos não-informados no banco;',
            'Garantir a distribuição contínua de insumos larvicidas para as frentes de trabalho das unidades com maiores taxas de positividade.'
          ],
          style: 'bodyText'
        }
      ],
      styles: {
        header: { fontSize: 15, bold: true, color: '#0056b3', letterSpacing: 0.5 },
        subheader: { fontSize: 9, color: '#64748b', italics: true, margin: [0, 2, 0, 8] },
        sectionHeader: { fontSize: 12, bold: true, color: '#0f172a', margin: [0, 12, 0, 6] },
        bodyText: { fontSize: 10, color: '#334155', leading: 1.5, textAlign: 'justify' },
        tableHeader: { bold: true, fontSize: 10, color: '#ffffff', alignment: 'left', margin: [5, 4, 5, 4] },
        tableExample: { margin: [0, 5, 0, 15], fontSize: 9.5, color: '#334155' }
      }
    };

    // 3. Transforma a estrutura e responde via Stream binário para download imediato
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-aedes-${ano || 'consolidado'}.pdf`);
    
    pdfDoc.pipe(res);
    pdfDoc.end();

  } catch (err) {
    console.error("❌ Erro ao fabricar PDF analítico:", err);
    res.status(500).json({ error: "Falha ao gerar documento PDF automático." });
  }
});
// =========================================================================
// INICIALIZAÇÃO DO SERVIDOR
// =========================================================================

app.listen(PORT, async () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  await initSchema();
});