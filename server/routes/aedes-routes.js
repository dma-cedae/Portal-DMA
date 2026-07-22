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

router.post("/lotes", async (req, res) => {
  const client = await pool.connect();

  try {
    const { focal_nome, total_registros, registros } = req.body;

    if (!registros || !Array.isArray(registros) || registros.length === 0) {
      return res.status(400).json({ error: "O lote não contém registros válidos." });
    }

    await client.query("BEGIN");

    // 1. Insere o lote principal
    const loteQuery = `
      INSERT INTO aedes.lotes (focal_nome, total_registros, payload_completo)
      VALUES ($1, $2, $3)
      RETURNING id;
    `;
    const payloadCompletoJson = JSON.stringify(req.body);
    const loteResult = await client.query(loteQuery, [
      focal_nome || "Focal Desconhecido",
      total_registros || registros.length,
      payloadCompletoJson
    ]);

    const loteId = loteResult.rows[0].id;

    // 2. Itera sobre cada registro para salvar em itens e na fato_vistorias
    for (let reg of registros) {
      const motivosVistoriaJson = reg.motivos_nao_vistoria ? JSON.stringify(reg.motivos_nao_vistoria) : null;
      const motivosRemediacaoJson = reg.motivos_nao_remediacao ? JSON.stringify(reg.motivos_nao_remediacao) : null;
      const locaisFocoJson = reg.locais_foco ? JSON.stringify(reg.locais_foco) : null;

      const motivosVistoriaStr = Array.isArray(reg.motivos_nao_vistoria) ? reg.motivos_nao_vistoria.join(', ') : (reg.motivos_nao_vistoria || null);
      const motivosRemediacaoStr = Array.isArray(reg.motivos_nao_remediacao) ? reg.motivos_nao_remediacao.join(', ') : (reg.motivos_nao_remediacao || null);
      const locaisFocoStr = Array.isArray(reg.locais_foco) ? reg.locais_foco.join(', ') : (reg.locais_foco || null);

      const dataRegistroValida = reg.data_registro ? new Date(reg.data_registro) : new Date();

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
          lote_id, origem, ano, mes, semana, unidade_id, unidade_nome, 
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

export default router;