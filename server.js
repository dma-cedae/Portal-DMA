import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { pool } from "./js/db.js";
import { initReciclaSchema } from "./js/db-recicla.js";
import reciclaRoutes from "./js/recicla-routes.js";
// Se aedesRoutes não contiver as rotas tratadas abaixo, mantenha-o apenas se necessário para outros endpoints.
import aedesRoutes from './server/routes/aedes-routes.js'; 

// 🟢 Necessário apenas para bibliotecas CommonJS
import { createRequire } from "module";
const require = createRequire(import.meta.url);

// Biblioteca que ainda utiliza CommonJS
const PdfPrinter = require("pdfmake");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// ───────────────────────────────────────────────────────────────
// Middlewares
// ───────────────────────────────────────────────────────────────

app.use(cors({
  origin: function (origin, callback) {
    // Se não houver origin (carregamento direto), se for local, ou se contiver o domínio oficial do GitHub Pages
    if (!origin || 
        origin.includes("localhost") || 
        origin.includes("127.0.0.1") || 
        origin.includes("dma-cedae.github.io")) { // 🔥 Procura o termo em vez de exigir igualdade exata
      return callback(null, true);
    }
    
    callback(new Error("Bloqueado pelo CORS"));
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

app.use(express.json({
  limit: "10mb"
}));

// ───────────────────────────────────────────────────────────────
// Rotas Módulos Externos
// ───────────────────────────────────────────────────────────────
app.use("/api/recicla", reciclaRoutes);

// Se houver rotas legadas em aedesRoutes elas rodam aqui, 
// mas não entrarão em conflito com os caminhos explícitos abaixo.
app.use("/api/aedes", aedesRoutes); 

/**
 * ─── Inicialização do Banco de Dados: Módulo AEDES ──────────────────────────
 */
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
    console.log("✅ Tabela aedes.lotes verificada.");

    // Coloque este bloco dentro do seu initSchema() junto com as outras tabelas
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.lotes_brutos (
        id SERIAL PRIMARY KEY,
        payload_recebido JSONB NOT NULL,
        data_insercao TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela aedes.lotes_brutos (Payload Bruto) verificada.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.vistorias_itens (
        id                            SERIAL PRIMARY KEY,
        lote_id                       INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        unidade_id                    TEXT, 
        unidade_nome                  TEXT,
        vistoria_realizada            TEXT,
        foco_encontrado               TEXT,
        foco_remediado                TEXT,
        motivos_nao_vistoria          JSONB,
        motivos_nao_remediacao        JSONB,
        locais_foco                   JSONB,
        observacoes                   TEXT,
        data_registro                 TIMESTAMP DEFAULT NOW(),
        outros_local                  TEXT,
        outros_motivos_nao_vistoria   TEXT,
        outros_motivos_nao_remediacao TEXT,
        id_referencia                 TEXT UNIQUE
      );
    `);
    console.log("✅ Tabela aedes.vistorias_itens verificada.");
  
    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.fato_vistorias (
        id                            SERIAL PRIMARY KEY,
        lote_id                       INTEGER REFERENCES aedes.lotes(id) ON DELETE CASCADE,
        origem                        TEXT DEFAULT 'Portal',
        ano                           INTEGER,
        mes                           INTEGER,
        semana                        INTEGER,
        unidade_id                    TEXT, 
        unidade_nome                  TEXT,
        vistoria_realizada            TEXT,
        foco_encontrado               TEXT,
        foco_remediado                TEXT,
        motivos_nao_vistoria          TEXT,
        motivos_nao_remediacao        TEXT,
        locais_foco                   TEXT,
        observacoes                   TEXT,
        data_registro                 TIMESTAMP DEFAULT NOW(),
        outros_locais_foco            TEXT,
        outros_motivos_nao_vistoria   TEXT,
        outros_motivos_nao_remediacao TEXT,
        id_referencia                 TEXT UNIQUE
      );
    `);
    console.log("✅ Tabela aedes.fato_vistorias verificada.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focais (
        focal_pk   BIGSERIAL PRIMARY KEY,
        matricula  TEXT,
        nome       TEXT NOT NULL,
        email      TEXT UNIQUE,
        ativo      BOOLEAN DEFAULT true
      );
    `);
    console.log("✅ Tabela aedes.focais verificada.");

    await pool.query(`
      CREATE TABLE IF NOT EXISTS aedes.focal_unidade (
        focal_unidade_pk BIGSERIAL PRIMARY KEY,
        focal_pk         BIGINT REFERENCES aedes.focais(focal_pk) ON DELETE CASCADE,
        unidade_id       BIGINT, 
        ativo            BOOLEAN DEFAULT true,
        data_inicio      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("✅ Tabela aedes.focal_unidade verificada.");

    await pool.query(`
      CREATE OR REPLACE VIEW aedes.vw_resumo_aedes AS
      SELECT 
        COUNT(*) AS total_registros,
        COUNT(CASE WHEN LOWER(TRIM(vistoria_realizada)) = 'sim' THEN 1 END) AS total_vistorias,
        COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' THEN 1 END) AS total_focos,
        COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' AND LOWER(TRIM(foco_remediado)) = 'sim' THEN 1 END) AS total_remediados
      FROM aedes.fato_vistorias;
    `);
    console.log("✅ View aedes.vw_resumo_aedes sincronizada.");

    console.log("🚀 [AEDES] Toda a estrutura de dados foi inicializada com sucesso.");
    
    if (typeof initReciclaSchema === "function") {
      await initReciclaSchema(); 
    }

  } catch (err) {
    console.error("❌ Erro crítico no initSchema (Módulo AEDES):", err.message);
  }
}

/* =========================================================
    ⭐ ROTAS DO NOVO COMPONENTE DE AUDITORIA SEMANAL
========================================================= */

app.get("/api/aedes/nao-enviados", async (req, res) => {
  try {
    const { ano, mes, semana_mes } = req.query;
    if (!ano || !mes || !semana_mes) {
      return res.status(400).json({ error: "Parâmetros 'ano', 'mes' e 'semana_mes' são obrigatórios." });
    }

    const a = parseInt(ano);
    const m = parseInt(mes);
    const s = parseInt(semana_mes);

    let diaInicio = 1 + (s - 1) * 7;
    let diaFim = s * 7;
    if (s === 4) {
      diaFim = new Date(a, m, 0).getDate();
    }

    const dataInicioStr = `${a}-${String(m).padStart(2, '0')}-${String(diaInicio).padStart(2, '0')} 00:00:00`;
    const dataFimStr = `${a}-${String(m).padStart(2, '0')}-${String(diaFim).padStart(2, '0')} 23:59:59`;
    const intervaloTexto = `${String(diaInicio).padStart(2, '0')}/${String(m).padStart(2, '0')} a ${String(diaFim).padStart(2, '0')}/${String(m).padStart(2, '0')}`;

    const sqlNaoEnviados = `
      SELECT 
        u.unidade_id, u.nome_unidade,
        f.nome AS focal_name, f.email AS focal_email
      FROM aedes.unidades u
      LEFT JOIN aedes.focal_unidade fu ON u.unidade_id = fu.unidade_id AND fu.ativo = true
      LEFT JOIN aedes.focais f ON fu.focal_pk = f.focal_pk AND f.ativo = true
      WHERE u.ativo = true
        AND u.nome_unidade NOT IN (
          SELECT DISTINCT unidade_nome 
          FROM aedes.fato_vistorias 
          WHERE data_registro >= $1::timestamp AND data_registro <= $2::timestamp AND unidade_nome IS NOT NULL
        )
      ORDER BY u.nome_unidade ASC;
    `;

    const sqlMetricas = `
      SELECT 
        COUNT(*)::int AS qtd_entrou,
        COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' THEN 1 END)::int AS qtd_focos,
        COUNT(CASE WHEN LOWER(TRIM(foco_encontrado)) = 'sim' AND LOWER(TRIM(foco_remediado)) = 'sim' THEN 1 END)::int AS qtd_remediados,
        
        COALESCE(
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'unidade', unidade_nome,
              'remediado', LOWER(TRIM(foco_remediado)),
              'motivo_nao_remediado', COALESCE(NULLIF(motivos_nao_remediacao, ''), NULLIF(outros_motivos_nao_remediacao, ''), '-')
            )
          ) FILTER (WHERE LOWER(TRIM(foco_encontrado)) = 'sim'), 
          '[]'
        ) AS lista_focos
      FROM aedes.fato_vistorias
      WHERE data_registro >= $1::timestamp AND data_registro <= $2::timestamp;
    `;

    const resNaoEnviados = await pool.query(sqlNaoEnviados, [dataInicioStr, dataFimStr]);
    const resMetricas = await pool.query(sqlMetricas, [dataInicioStr, dataFimStr]);
    
    const metricas = resMetricas.rows[0] || { qtd_entrou: 0, qtd_focos: 0, qtd_remediados: 0 };

    res.json({
      intervalo: intervaloTexto,
      nao_enviados: resNaoEnviados.rows,
      metricas: metricas
    });

  } catch (err) {
    console.error("❌ Erro na rota /api/aedes/nao-enviados:", err.message);
    res.status(500).json({ error: "Erro interno ao processar auditoria.", detalhe: err.message });
  }
});

/* =========================================================
    ⭐ RETORNO DAS ROTAS DAS VIEWS (DASHBOARD PIZZA/GRAFICOS)
========================================================= */

app.get("/api/aedes/views/motivos-nao-vistoria", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vw_motivos_nao_vistoria ORDER BY quantidade DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar view de motivos não vistoria." });
  }
});

app.get("/api/aedes/views/motivos-nao-remediacao", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vw_motivos_nao_remediacao ORDER BY quantidade DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar view de motivos não remediação." });
  }
});

app.get("/api/aedes/views/locais-foco", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vw_locais_foco ORDER BY quantidade DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar view de locais de foco." });
  }
});

app.get("/api/aedes/resumo", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vw_resumo_aedes`);
    res.json(result.rows[0] || { total_registros: 0, total_vistorias: 0, total_focos: 0, total_remediados: 0 });
  } catch (err) {
    res.status(500).json({ error: "Erro ao buscar resumo de KPIs." });
  }
});

app.get("/api/aedes/painel-dados", async (req, res) => {
  try {
    const { unidade, ano, mes, semana } = req.query;
    let query = `
      SELECT origem, lote_id, data_registro, ano, mes, semana, unidade_id, unidade_nome, 
             vistoria_realizada, foco_encontrado, foco_remediado, motivos_nao_vistoria, 
             motivos_nao_remediacao, locais_foco, observacoes
      FROM aedes.fato_vistorias WHERE 1=1
    `;
    const params = [];
    let pIndex = 1;

    if (unidade) { query += ` AND LOWER(unidade_nome) = LOWER($${pIndex})`; params.push(unidade.trim()); pIndex++; }
    if (ano) { query += ` AND ano = $${pIndex}`; params.push(parseInt(ano)); pIndex++; }
    if (mes) { query += ` AND mes = $${pIndex}`; params.push(parseInt(mes)); pIndex++; }
    if (semana) { query += ` AND semana = $${pIndex}`; params.push(parseInt(semana)); pIndex++; }

    query += ` ORDER BY data_registro DESC LIMIT 25000`;
    const result = await pool.query(query, params);
    res.json({ registros: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Erro interno no servidor.", detalhe: err.message });
  }
});

app.get("/api/aedes/export/csv", async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM aedes.vistorias_itens`);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=relatorio-aedes.csv');
    
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
  try {
    const result = await pool.query(`SELECT unidade_nome, vistoria_realizada, foco_encontrado FROM aedes.vistorias_itens`);
    res.json({ titulo: "Relatório Analítico de Vistorias - AEDES", emitidoEm: new Date(), dados: result.rows });
  } catch (err) {
    res.status(500).json({ error: "Erro ao preparar dados para PDF." });
  }
});

/* =========================================================
    ROTAS DE FOCAIS
========================================================= */

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

app.get("/api/aedes/consolidado", async (req, res) => {
  try {
    const query = `
      SELECT 
        ano,
        mes,
        data_registro AS data_real_envio,
        unidade_nome AS unidade,
        vistoria_realizada,
        foco_encontrado,
        foco_remediado,
        motivos_nao_vistoria,
        motivos_nao_remediacao,
        locais_foco,
        outros_motivos_nao_vistoria,
        outros_motivos_nao_remediacao,
        outros_locais_foco,
        observacoes
      FROM aedes.fato_vistorias
      ORDER BY data_registro DESC;
    `;
    
    const result = await pool.query(query);
    res.json({ sucesso: true, dados: result.rows });
  } catch (err) {
    res.status(500).json({ sucesso: false, error: "Erro ao consultar banco.", details: err.message });
  }
});

app.get("/api/aedes/certificados", async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT unidade, mes, ano, total_vistorias, cobertura_semanal_completa, focos_nao_remediados
      FROM aedes.mv_certificados_consolidados
      ORDER BY ano DESC, mes DESC, unidade ASC;
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao processar certificados." });
  }
});

/* =========================================================
    🛠️ ROTA PROVISÓRIA: SALVA O PAYLOAD PLANO EXATAMENTE COMO ENVIADO
========================================================= */
app.post('/api/aedes/lotes-provisorio', async (req, res) => {
  try {
    // Se o corpo vier vazio, rejeita
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({ error: 'Payload vazio não pode ser processado.' });
    }

    console.log("📦 Recebendo payload plano na rota provisória...");

    // Query direta inserindo o objeto req.body completo no formato JSONB
    const queryText = `
      INSERT INTO aedes.lotes_brutos (payload_recebido)
      VALUES ($1)
      RETURNING id, data_insercao;
    `;

    const resultado = await pool.query(queryText, [JSON.stringify(req.body)]);

    console.log(`✅ JSON plano persistido na lotes_brutos! ID: ${resultado.rows[0].id}`);

    return res.status(201).json({
      success: true,
      message: 'Payload bruto gravado com sucesso sem conversões!',
      id: resultado.rows[0].id,
      data_insercao: resultado.rows[0].data_insercao
    });

  } catch (error) {
    console.error('❌ Erro crítico ao salvar no dump bruto:', error);
    return res.status(500).json({
      error: 'Falha interna ao armazenar o JSON bruto.',
      detalhe: error.message
    });
  }
});
/* =========================================================
    DEMAIS ROTAS ACESSÓRIAS
========================================================= */
app.get("/api/unidades", async (_req, res) => {
  try {
    const result = await pool.query(`SELECT unidade_id, nome_unidade FROM aedes.unidades WHERE ativo = true ORDER BY nome_unidade ASC`);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: "Erro ao buscar unidades." }); }
});

app.get("/api/health", (_req, res) => { res.json({ status: "ok", time: new Date().toLocaleString("pt-BR") }); });
app.use((_req, res) => res.status(404).json({ error: "Rota não encontrada." }));

app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando em: http://localhost:${PORT}`);
  initSchema().then(() => console.log("🔋 Banco de dados totalmente sincronizado."));
});