/**
 * ==========================================================
 * POST /api/aedes/lotes
 * Recebe o lote de inspeções, grava na tabela lotes,
 * vistorias_itens e consolida na fato_vistorias.
 * ==========================================================
 */
import express from "express";
import { pool } from "../../js/db.js";

const router = express.Router();

// ==========================================================
// ROTA 1: ROTA CONCRETA E OFICIAL
// ==========================================================
router.post("/lotes", async (req, res) => {
  const client = await pool.connect();

  try {
    // 🟢 1. Extração Inteligente: Funciona tanto se vier solto quanto envelopado
    const cabecalhoOriginal = req.body.cabecalho || req.body.payload_completo?.cabecalho;
    const dadosOrigem = req.body.dados || req.body.payload_completo?.dados || [];

    if (!cabecalhoOriginal || Object.keys(cabecalhoOriginal).length === 0) {
      return res.status(400).json({
        error: "Cabeçalho do lote não informado."
      });
    }

    if (!Array.isArray(dadosOrigem) || dadosOrigem.length === 0) {
      return res.status(400).json({
        error: "O lote não contém registros válidos."
      });
    }

    const {
      focal_nome,
      focal_email,
      matricula,
      semana_iso,
      ano_iso,
      total_registros,
      lote_id_cliente
    } = cabecalhoOriginal;

    // 🟢 2. Conversor de Matriz Posicional para Objeto Nomeado
    const registros = dadosOrigem.map((reg, index) => {
      if (Array.isArray(reg)) {
        return {
          unidade_id: String(reg[0] || ""),
          unidade_nome: reg[1] || "",
          vistoria_realizada: reg[2] || "nao",
          foco_encontrado: reg[3] || "nao",
          foco_remediado: reg[4] || "-",
          locais_foco: Array.isArray(reg[5]) ? reg[5] : [],
          outros_local: reg[6] || "-",
          motivos_nao_vistoria: Array.isArray(reg[7]) ? reg[7] : [],
          outros_motivos_nao_vistoria: reg[8] || "",
          motivos_nao_remediacao: Array.isArray(reg[9]) ? reg[9] : [],
          outros_motivos_nao_remediacao: reg[10] || "-",
          observacoes: reg[11] || "-",
          id_referencia: reg[12] || `ref_${Date.now()}_${index}_${reg[0] || 'unk'}`
        };
      }
      return reg; // Se já for um objeto estruturado, preserva
    });

    console.log("==================================");
    console.log("📦 LOTE RECEBIDO E ADAPTADO NO BACKEND");
    console.log("Focal:", focal_nome);
    console.log("Semana:", semana_iso);
    console.log("Registros Validados:", registros.length);
    console.log("==================================");

    await client.query("BEGIN");

    // Salva o lote
    const loteResult = await client.query(
      `
      INSERT INTO aedes.lotes (
        focal_nome,
        total_registros,
        payload_completo
      )
      VALUES ($1,$2,$3)
      RETURNING id;
      `,
      [
        focal_nome || "Focal não identificado",
        total_registros ?? registros.length,
        JSON.stringify(req.body) // Preserva a raiz exata do envio original no histórico JSONB
      ]
    );

    const loteId = loteResult.rows[0].id;

    // Processa cada vistoria
    for (const reg of registros) {
      const motivosVistoriaJson =
        reg.motivos_nao_vistoria?.length
          ? JSON.stringify(reg.motivos_nao_vistoria)
          : null;

      const motivosRemediacaoJson =
        reg.motivos_nao_remediacao?.length
          ? JSON.stringify(reg.motivos_nao_remediacao)
          : null;

      const locaisFocoJson =
        reg.locais_foco?.length
          ? JSON.stringify(reg.locais_foco)
          : null;

      const motivosVistoriaStr = Array.isArray(reg.motivos_nao_vistoria)
        ? reg.motivos_nao_vistoria.join(", ")
        : reg.motivos_nao_vistoria || null;

      const motivosRemediacaoStr = Array.isArray(reg.motivos_nao_remediacao)
        ? reg.motivos_nao_remediacao.join(", ")
        : reg.motivos_nao_remediacao || null;

      const locaisFocoStr = Array.isArray(reg.locais_foco)
        ? reg.locais_foco.join(", ")
        : reg.locais_foco || null;

      const dataRegistroValida = reg.data_registro
        ? new Date(reg.data_registro)
        : new Date();

      // Inserção em vistorias_itens
      const queryItem = `
        INSERT INTO aedes.vistorias_itens (
          lote_id, unidade_id, unidade_nome, vistoria_realizada, 
          foco_encontrado, foco_remediado, motivos_nao_vistoria, 
          motivos_nao_remediacao, locais_foco, observacoes, 
          data_registro, outros_local, outros_motivos_nao_vistoria, 
          outros_motivos_nao_remediacao, id_referencia
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (id_referencia) DO UPDATE SET
          vistoria_realizada = EXCLUDED.vistoria_realizada,
          foco_encontrado = EXCLUDED.foco_encontrado,
          foco_remediado = EXCLUDED.foco_remediado,
          observacoes = EXCLUDED.observacoes;
      `;

      await client.query(queryItem, [
        loteId, reg.unidade_id, reg.unidade_nome, reg.vistoria_realizada,
        reg.foco_encontrado, reg.foco_remediado, motivosVistoriaJson,
        motivosRemediacaoJson, locaisFocoJson, reg.observacoes,
        dataRegistroValida, reg.outros_local, reg.outros_motivos_nao_vistoria,
        reg.outros_motivos_nao_remediacao, reg.id_referencia
      ]);

      // Inserção em fato_vistorias
      const queryFato = `
        INSERT INTO aedes.fato_vistorias (
          lote_id, origin, ano, mes, semana, unidade_id, unidade_nome, 
          vistoria_realizada, foco_encontrado, foco_remediado, 
          motivos_nao_vistoria, motivos_nao_remediacao, locais_foco, 
          observacoes, data_registro, outros_locais_foco, 
          outros_motivos_nao_vistoria, outros_motivos_nao_remediacao, id_referencia
        ) VALUES (
          $1, 'Portal', 
          EXTRACT(YEAR FROM $11::timestamp), 
          EXTRACT(MONTH FROM $11::timestamp), 
          EXTRACT(WEEK FROM $11::timestamp), 
          $2, $3, $4, $5, $6, 
          $7, $8, $9, 
          $10, $11::timestamp, $12, $13, $14, $15
        )
        ON CONFLICT (id_referencia) DO UPDATE SET
          vistoria_realizada = EXCLUDED.vistoria_realizada,
          foco_encontrado = EXCLUDED.foco_encontrado,
          foco_remediado = EXCLUDED.foco_remediado,
          observacoes = EXCLUDED.observacoes,
          ano = EXCLUDED.ano,
          mes = EXCLUDED.mes,
          semana = EXCLUDED.semana;
      `;

      await client.query(queryFato, [
        loteId, reg.unidade_id, reg.unidade_nome, reg.vistoria_realizada,
        reg.foco_encontrado, reg.foco_remediado, motivosVistoriaStr,
        motivosRemediacaoStr, locaisFocoStr, reg.observacoes,
        dataRegistroValida, reg.outros_local, reg.outros_motivos_nao_vistoria,
        reg.outros_motivos_nao_remediacao, reg.id_referencia
      ]);
    }

    await client.query("COMMIT");
    res.status(201).json({ sucesso: true, mensagem: "Lote processado e gravado nas tabelas de itens e fatos com sucesso." });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao salvar o lote do Aedes:", err.message);
    res.status(500).json({ error: "Erro interno ao processar o lote: " + err.message });
  } finally {
    client.release();
  }
});


// ==========================================================
// ROTA 2: 🛠️ NOVA ROTA PROVISÓRIA DE SEGURANÇA (DIRETO PRO BANCO)
// ==========================================================
router.post("/lotes-provisorio", async (req, res) => {
  const client = await pool.connect();
  try {
    // Captura o cabecalho e a matriz de dados nativa do payload
    const cabecalhoOriginal = req.body.cabecalho || req.body.payload_completo?.cabecalho;
    const dadosMatriz = req.body.dados || req.body.payload_completo?.dados || [];

    const nomeFocal = cabecalhoOriginal?.focal_nome || "Focal Provisório";
    const totalRegistros = cabecalhoOriginal?.total_registros || dadosMatriz.length;

    // Reconstrói o JSON no modelo estrutural da coluna "payload_completo" flagrada na imagem
    const payloadParaBanco = {
      dados: dadosMatriz
    };

    console.log("🛠️ Inserindo via Rota Provisória para:", nomeFocal);

    const queryTexto = `
      INSERT INTO aedes.lotes (
        focal_nome,
        total_registros,
        payload_completo,
        data_envio
      )
      VALUES ($1, $2, $3, NOW())
      RETURNING id, data_envio;
    `;

    const resultado = await client.query(queryTexto, [
      nomeFocal,
      totalRegistros,
      JSON.stringify(payloadParaBanco)
    ]);

    res.status(201).json({
      sucesso: true,
      mensagem: "Gravado com sucesso via rota provisória!",
      id: resultado.rows[0].id,
      data_envio: resultado.rows[0].data_envio
    });

  } catch (err) {
    console.error("❌ Erro crítico na rota provisória:", err.message);
    res.status(500).json({ 
      error: "Erro na rota provisória.", 
      detalhe: err.message 
    });
  } finally {
    client.release();
  }
});

export default router;