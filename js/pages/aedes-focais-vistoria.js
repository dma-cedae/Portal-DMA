/**
 * ============================================================
 * Aedes · Área dos Focais · Vistoria semanal por grade
 * ------------------------------------------------------------
 * Revisão:
 * - padronização de campos derivados com "-"
 * - limpeza consistente de dependências da linha
 * - payload mais coerente com a interface
 * - helpers de normalização para evitar inconsistências
 * ============================================================
 */

const AEDES_FOCAL_SESSION_KEY = "dma_aedes_focal_session_v1";
const AEDES_FOCAL_REPORTS_STORAGE_KEY = "dma_aedes_focal_reports_v7";
const AEDES_API_TIMEOUT_MS = 90000;
const DASH_VALUE = "-";

/**
 * ============================================================
 * CATÁLOGOS FIXOS DOS CHECKBOX GROUPS
 * ============================================================
 */
const LOCAIS_FOCO_OPTIONS = [
  { value: "objetos_acumulando_agua", label: "Objetos acumulando água" },
  { value: "reservatorio_de_agua", label: "Reservatório de água" },
  { value: "calha", label: "Calha ou ralos" },
  { value: "bromelias", label: "Bromélias ou vasos de plantas" },
  { value: "outros", label: "Outros" }
];

const MOTIVOS_NAO_REMEDIACAO_OPTIONS = [
  { value: "falta_de_treinamento_capacitacao", label: "Falta de treinamento/capacitação" },
  { value: "falta_de_cloro_larvicida", label: "Falta de cloro/larvicida" },
  { value: "necessidade_limpeza_terreno", label: "Necessidade de limpeza do terreno" },
  { value: "reservatorio_sem_cobertura", label: "Reservatório sem cobertura" },
  { value: "aguardando_responsavel_local", label: "Aguardando responsável local" },
  { value: "outros", label: "Outros" }
];

const MOTIVOS_NAO_VISTORIA_OPTIONS = [
  { value: "sem_condicao_acesso", label: "Sem acesso" },
  { value: "sem_brigadista", label: "Sem brigadista" },
  { value: "sem_viatura_disponivel", label: "Sem viatura disponível" },
  { value: "esquecimento", label: "Esquecimento" },
  { value: "outros", label: "Outros" }
];

/**
 * ============================================================
 * ESTADO DA PÁGINA
 * ============================================================
 */
let currentSession = null;
let gridRows = [];
let systemDate = new Date();

/**
 * ============================================================
 * CICLO DE VIDA
 * ============================================================
 */
document.addEventListener("DOMContentLoaded", () => {
  setupActions();

  currentSession = getFocalSession();

  if (!isValidSession(currentSession)) {
    showSessionWarning();
    return;
  }

  showApp();
  fillSessionInfo(currentSession);
  initializeSystemDateInfo();
  buildGridRows();
  bindGridEvents();
  renderGrid();
});

/**
 * ============================================================
 * EVENTOS FIXOS DA PÁGINA
 * ============================================================
 */
function setupActions() {
  const btnEncerrarSessao = document.getElementById("btnEncerrarSessao");
  const form = document.getElementById("vistoriaForm");

  if (btnEncerrarSessao) {
    btnEncerrarSessao.addEventListener("click", () => {
      clearFocalSession();
      window.location.href = "./aedes-focais.html";
    });
  }

  if (form) {
    form.addEventListener("submit", handleSubmitReport);
  }
}



/**
 * ============================================================
 * SESSÃO DO FOCAL
 * ============================================================
 */
function getFocalSession() {
  try {
    const raw = localStorage.getItem(AEDES_FOCAL_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (error) {
    console.error("Erro ao ler sessão do focal:", error);
    return null;
  }
}

function isValidSession(session) {
  return !!(
    session &&
    session.auth_type === "aedes_focal" &&
    // O focal_id (ou focal_pk) é agora o campo MAIS importante
    (session.focal_id || session.focal_pk) && 
    session.nome
    // Removemos a obrigatoriedade de session.unidades aqui, 
    // pois elas virão da API stg_importacao no próximo passo.
  );
}

function clearFocalSession() {
  localStorage.removeItem(AEDES_FOCAL_SESSION_KEY);
}

function showSessionWarning() {
  const warning = document.getElementById("sessionWarning");
  const app = document.getElementById("vistoriaApp");

  if (warning) warning.classList.remove("hidden");
  if (app) app.classList.add("hidden");
}

function showApp() {
  const warning = document.getElementById("sessionWarning");
  const app = document.getElementById("vistoriaApp");

  if (warning) warning.classList.add("hidden");
  if (app) app.classList.remove("hidden");
}

function fillSessionInfo(session) {
  const nomeEl = document.getElementById("infoFocalNome");
  const emailEl = document.getElementById("infoFocalEmail");

  if (nomeEl) nomeEl.textContent = session.nome || "---";
  if (emailEl) emailEl.textContent = session.email || "---";
}

/**
 * ============================================================
 * DATA / SEMANA AUTOMÁTICA
 * ============================================================
 */
function initializeSystemDateInfo() {
  systemDate = new Date();

  const dataEl = document.getElementById("infoDataPreenchimento");
  const semanaEl = document.getElementById("infoSemanaReferencia");

  if (dataEl) {
    dataEl.textContent = new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(systemDate);
  }

  if (semanaEl) {
    const ano = getIsoWeekYear(systemDate);
    const semana = getIsoWeek(systemDate);
    semanaEl.textContent = `Ano ${ano} · Semana ${String(semana).padStart(2, "0")}`;
  }
}

/**
 * ============================================================
 * ESTADO DA GRADE
 * ============================================================
 */
/**
 * ============================================================
 * ESTADO DA GRADE - CORRIGIDO PARA FILTRAR POR FOCAL
 * ============================================================
 */
async function buildGridRows() {
  const tbody = document.getElementById("vistoriaGridBody");
  
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px;">Sincronizando unidades vinculadas ao seu perfil...</td></tr>`;
  }

  try {
    // 1. Pega o e-mail da sessão (armazenado no login)
    const emailFocal = currentSession?.email;

    if (!emailFocal) {
      throw new Error("Sessão inválida. Por favor, faça login novamente.");
    }

    // 2. BUSCA NA ROTA BASE - O filtro aqui é o E-MAIL
    // Mudamos o parâmetro para 'filtro' para bater com o que o server.js espera
    const url = `${window.AEDES_API_BASE_URL}/api/aedes/base?filtro=${encodeURIComponent(emailFocal)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error("Não foi possível carregar suas unidades.");
    }
    
    // O servidor retorna apenas as linhas onde o e-mail do focal é o dono
    const unidadesFocal = await response.json();

    if (unidadesFocal.length === 0) {
       if (tbody) tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">Nenhuma unidade encontrada para o e-mail: ${emailFocal}</td></tr>`;
       return;
    }

    // 3. Mapeamento para o estado da grade
    gridRows = unidadesFocal.map((itemSTG) => ({
      rowId: createLocalId("row"),
      unidadeId: itemSTG.matricula || null, // Usando a matrícula como ID único da linha
      unidade: itemSTG.unidade || "Unidade sem identificação",
      
      statusLinha: "Pendente",
      vistoriaRealizada: "",
      motivosNaoVistoria: [],
      outrosMotivoNaoVistoria: "",
      focoEncontrado: "",
      locaisFoco: [],
      outrosLocalFoco: "",
      focoRemediado: "",
      motivosNaoRemediacao: [],
      outrosMotivoNaoRemediacao: "",
      observacoes: ""
    }));

    // 4. Renderiza a grade filtrada
    renderGrid();

  } catch (error) {
    console.error("Erro ao carregar grade filtrada:", error);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="color:red; text-align:center; padding:20px;">
        Erro: ${error.message}
      </td></tr>`;
    }
  }
}
function getRowVisibility(row) {
  const vistoriaSim = row.vistoriaRealizada === "sim";
  const vistoriaNao = row.vistoriaRealizada === "nao";
  const focoSim = row.focoEncontrado === "sim";
  const remediadoNao = row.focoRemediado === "nao";

  return {
    showFocoEncontrado: vistoriaSim,
    showFocoRemediado: vistoriaSim && focoSim,
    showLocaisFoco: vistoriaSim && focoSim,
    showMotivosNaoRemediacao: vistoriaSim && focoSim && remediadoNao,
    showMotivosNaoVistoria: vistoriaNao
  };
}

/**
 * ============================================================
 * RENDER DA GRADE
 * ============================================================
 */
function renderGrid() {
  const tbody = document.getElementById("vistoriaGridBody");
  const count = document.getElementById("gridUnitCount");
  const table = document.querySelector(".history-table--focal-grid");

  if (!tbody) return;

  if (count) {
    count.textContent = `${formatNumber(gridRows.length)} unidades`;
  }

  if (!gridRows.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">Nenhuma unidade vinculada ao focal.</td>
      </tr>
    `;
    if (table) {
      table.classList.remove(
        "show-col-nao-vistoria",
        "show-col-locais-foco",
        "show-col-nao-remediacao"
      );
    }
    return;
  }

  tbody.innerHTML = gridRows
    .map((row, index) => {
      row.statusLinha = getRowStatus(row);
      const visible = getRowVisibility(row);

      return `
        <tr data-row-id="${escapeHtml(row.rowId)}">
            <td class="col-unidade">
            <div class="unit-cell">
              <strong class="unit-name">
                ${escapeHtml(row.unidade || DASH_VALUE)}
              </strong>

              <span class="status-pill ${getStatusClass(row.statusLinha)}">
                ${escapeHtml(row.statusLinha)}
              </span>
            </div>
          </td>

          <td class="col-vistoria">
            ${renderInlineRadioGroup({
              rowId: row.rowId,
              field: "vistoriaRealizada",
              value: row.vistoriaRealizada,
              index,
              options: [
                { value: "sim", label: "Sim" },
                { value: "nao", label: "Não", className: "radio-chip-inline--danger" }
              ]
            })}
          </td>

          <td class="col-nao-vistoria">
            ${
              visible.showMotivosNaoVistoria
                ? renderCheckboxGroup({
                    rowId: row.rowId,
                    groupKey: "motivosNaoVistoria",
                    values: row.motivosNaoVistoria,
                    otherText: row.outrosMotivoNaoVistoria,
                    options: MOTIVOS_NAO_VISTORIA_OPTIONS,
                    otherPlaceholder: "Especifique o outro motivo de não vistoria",
                    otherField: "outrosMotivoNaoVistoria"
                  })
                : `<span class="table-inline-note">${DASH_VALUE}</span>`
            }
          </td>

          <td class="col-foco">
            ${
              visible.showFocoEncontrado
                ? renderInlineRadioGroup({
                    rowId: row.rowId,
                    field: "focoEncontrado",
                    value: row.focoEncontrado,
                    index,
                    options: [
                      { value: "sim", label: "Sim" },
                      { value: "nao", label: "Não", className: "radio-chip-inline--danger" }
                    ]
                  })
                : `<span class="table-inline-note">${DASH_VALUE}</span>`
            }
          </td>

          <td class="col-locais-foco">
            ${
              visible.showLocaisFoco
                ? renderCheckboxGroup({
                    rowId: row.rowId,
                    groupKey: "locaisFoco",
                    values: row.locaisFoco,
                    otherText: row.outrosLocalFoco,
                    options: LOCAIS_FOCO_OPTIONS,
                    otherPlaceholder: "Especifique o outro local de foco",
                    otherField: "outrosLocalFoco"
                  })
                : `<span class="table-inline-note">${DASH_VALUE}</span>`
            }
          </td>

          <td class="col-remediacao">
            ${
              visible.showFocoRemediado
                ? renderInlineRadioGroup({
                    rowId: row.rowId,
                    field: "focoRemediado",
                    value: row.focoRemediado,
                    index,
                    options: [
                      { value: "sim", label: "Sim" },
                      { value: "nao", label: "Não", className: "radio-chip-inline--danger" }
                    ]
                  })
                : `<span class="table-inline-note">${DASH_VALUE}</span>`
            }
          </td>

          <td class="col-nao-remediacao">
            ${
              visible.showMotivosNaoRemediacao
                ? renderCheckboxGroup({
                    rowId: row.rowId,
                    groupKey: "motivosNaoRemediacao",
                    values: row.motivosNaoRemediacao,
                    otherText: row.outrosMotivoNaoRemediacao,
                    options: MOTIVOS_NAO_REMEDIACAO_OPTIONS,
                    otherPlaceholder: "Especifique o outro motivo de não remediação",
                    otherField: "outrosMotivoNaoRemediacao"
                  })
                : `<span class="table-inline-note">${DASH_VALUE}</span>`
            }
          </td>

          <td class="col-observacoes">
            <textarea
              class="input-control input-control--compact"
              rows="3"
              placeholder="Observações gerais da vistoria"
              data-row-id="${escapeHtml(row.rowId)}"
              data-field="observacoes"
            >${escapeHtml(row.observacoes || "")}</textarea>
          </td>
        </tr>
      `;
    })
    .join("");

  updateConditionalColumnsVisibility();
}

function updateConditionalColumnsVisibility() {
  const table = document.querySelector(".history-table--focal-grid");
  if (!table) return;

  const hasNaoVistoria = gridRows.some((row) => getRowVisibility(row).showMotivosNaoVistoria);
  const hasLocaisFoco = gridRows.some((row) => getRowVisibility(row).showLocaisFoco);
  const hasNaoRemediacao = gridRows.some((row) => getRowVisibility(row).showMotivosNaoRemediacao);

  table.classList.toggle("show-col-nao-vistoria", hasNaoVistoria);
  table.classList.toggle("show-col-locais-foco", hasLocaisFoco);
  table.classList.toggle("show-col-nao-remediacao", hasNaoRemediacao);

  table.classList.remove(
    "grid-mode-0",
    "grid-mode-1",
    "grid-mode-2",
    "grid-mode-3"
  );

  const visibleConditionalCount =
    Number(hasNaoVistoria) +
    Number(hasLocaisFoco) +
    Number(hasNaoRemediacao);

  table.classList.add(`grid-mode-${visibleConditionalCount}`);
}

function renderInlineRadioGroup({ rowId, field, value, index, options }) {
  return `
    <div class="radio-group-inline compact">
      ${options
        .map((option, optionIndex) => {
          const inputId = `${field}_${index}_${optionIndex}_${rowId}`;

          return `
            <label class="radio-chip-inline ${option.className || ""}" for="${escapeHtml(inputId)}">
              <input
                type="radio"
                id="${escapeHtml(inputId)}"
                name="${escapeHtml(field)}_${escapeHtml(rowId)}"
                value="${escapeHtml(option.value)}"
                ${value === option.value ? "checked" : ""}
                data-row-id="${escapeHtml(rowId)}"
                data-field="${escapeHtml(field)}"
              />
              <span>${escapeHtml(option.label)}</span>
            </label>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderCheckboxGroup({
  rowId,
  groupKey,
  values,
  otherText,
  options,
  otherPlaceholder,
  otherField
}) {
  const selectedValues = Array.isArray(values) ? values : [];
  const hasOtherSelected = selectedValues.includes("outros");

  return `
    <div class="checkbox-group">
      ${options
        .map((option, index) => {
          const inputId = `${groupKey}_${index}_${rowId}`;
          return `
            <label class="checkbox-option" for="${escapeHtml(inputId)}">
              <input
                type="checkbox"
                id="${escapeHtml(inputId)}"
                value="${escapeHtml(option.value)}"
                data-row-id="${escapeHtml(rowId)}"
                data-group-key="${escapeHtml(groupKey)}"
                ${selectedValues.includes(option.value) ? "checked" : ""}
              />
              <span>${escapeHtml(option.label)}</span>
            </label>
          `;
        })
        .join("")}

      <textarea
        class="${hasOtherSelected ? "" : "hidden"}"
        placeholder="${escapeHtml(otherPlaceholder)}"
        data-row-id="${escapeHtml(rowId)}"
        data-field="${escapeHtml(otherField)}"
      >${escapeHtml(isDashValue(otherText) ? "" : otherText || "")}</textarea>
    </div>
  `;
}

/**
 * ============================================================
 * EVENTOS DA GRADE
 * ============================================================
 */
function bindGridEvents() {
  const tbody = document.getElementById("vistoriaGridBody");
  if (!tbody) return;

  tbody.addEventListener("change", (event) => {
    const target = event.target;

    if (target.matches("input[type='radio'][data-field]")) {
      const rowId = target.dataset?.rowId;
      const field = target.dataset?.field;
      if (!rowId || !field) return;

      updateGridRow(rowId, field, target.value, { rerender: true });
      return;
    }

    if (target.matches("input[type='checkbox'][data-group-key]")) {
      const rowId = target.dataset?.rowId;
      const groupKey = target.dataset?.groupKey;
      const optionValue = target.value;

      if (!rowId || !groupKey || !optionValue) return;

      updateGridCheckboxGroup(rowId, groupKey, optionValue, target.checked);
      return;
    }

    if (target.matches("textarea[data-field], input[data-field]")) {
      const rowId = target.dataset?.rowId;
      const field = target.dataset?.field;
      if (!rowId || !field) return;

      updateGridRow(rowId, field, target.value, { rerender: false });
    }
  });

  tbody.addEventListener("input", (event) => {
    const target = event.target;
    const rowId = target.dataset?.rowId;
    const field = target.dataset?.field;

    if (!rowId || !field) return;

    if (target.matches("textarea[data-field], input[data-field]")) {
      updateGridRow(rowId, field, target.value, { rerender: false });
    }
  });
}

/**
 * ============================================================
 * ESTADO DA LINHA
 * ============================================================
 */
function updateGridRow(rowId, field, value, options = { rerender: true }) {
  const row = gridRows.find((item) => item.rowId === rowId);
  if (!row) return;

  row[field] = normalizeFieldValue(field, value);

  if (field === "vistoriaRealizada") {
    if (value === "nao") {
      applyNoVistoriaState(row);
    }

    if (value === "sim") {
      clearNoVistoriaState(row);
      row.focoEncontrado = "";
      row.focoRemediado = "";
    }
  }

  if (field === "focoEncontrado") {
    if (value === "nao") {
      applyNoFocoState(row);
    }

    if (value === "sim") {
      clearNoFocoState(row);
      row.focoRemediado = "";
    }
  }

  if (field === "focoRemediado" && value === "sim") {
    clearNaoRemediacaoState(row);
  }

  if (field === "focoRemediado" && value === "nao") {
    row.outrosMotivoNaoRemediacao = safeTrim(row.outrosMotivoNaoRemediacao);
  }

  row.statusLinha = getRowStatus(row);

  if (options.rerender) {
    renderGrid();
  }
}

function updateGridCheckboxGroup(rowId, groupKey, optionValue, checked) {
  const row = gridRows.find((item) => item.rowId === rowId);
  if (!row) return;

  const currentValues = Array.isArray(row[groupKey]) ? [...row[groupKey]] : [];

  let nextValues;

  if (checked) {
    nextValues = currentValues.includes(optionValue)
      ? currentValues
      : [...currentValues, optionValue];
  } else {
    nextValues = currentValues.filter((item) => item !== optionValue);
  }

  row[groupKey] = uniqueArray(nextValues);

  if (groupKey === "locaisFoco" && optionValue === "outros" && !checked) {
    row.outrosLocalFoco = "";
  }

  if (groupKey === "motivosNaoRemediacao" && optionValue === "outros" && !checked) {
    row.outrosMotivoNaoRemediacao = "";
  }

  if (groupKey === "motivosNaoVistoria" && optionValue === "outros" && !checked) {
    row.outrosMotivoNaoVistoria = "";
  }

  row.statusLinha = getRowStatus(row);
  renderGrid();
}

function applyNoVistoriaState(row) {
  row.focoEncontrado = DASH_VALUE;
  row.focoRemediado = DASH_VALUE;

  row.locaisFoco = [];
  row.outrosLocalFoco = DASH_VALUE;

  row.motivosNaoRemediacao = [];
  row.outrosMotivoNaoRemediacao = DASH_VALUE;
}

function clearNoVistoriaState(row) {
  row.motivosNaoVistoria = [];
  row.outrosMotivoNaoVistoria = "";
}

function applyNoFocoState(row) {
  row.focoRemediado = DASH_VALUE;
  row.locaisFoco = [];
  row.outrosLocalFoco = DASH_VALUE;
  row.motivosNaoRemediacao = [];
  row.outrosMotivoNaoRemediacao = DASH_VALUE;
}

function clearNoFocoState(row) {
  row.locaisFoco = [];
  row.outrosLocalFoco = "";
  row.motivosNaoRemediacao = [];
  row.outrosMotivoNaoRemediacao = "";
}

function clearNaoRemediacaoState(row) {
  row.motivosNaoRemediacao = [];
  row.outrosMotivoNaoRemediacao = "";
}

function hasValidGroupSelection(values, otherText) {
  if (!Array.isArray(values) || values.length === 0) {
    return false;
  }

  const cleanedValues = values.filter(Boolean);

  if (cleanedValues.length === 0) {
    return false;
  }

  const onlyOtherSelected =
    cleanedValues.length === 1 &&
    cleanedValues[0] === "outros";

  if (onlyOtherSelected) {
    return safeTrim(otherText).length > 0 && !isDashValue(otherText);
  }

  if (cleanedValues.includes("outros")) {
    return safeTrim(otherText).length > 0 && !isDashValue(otherText);
  }

  return true;
}

function getRowStatus(row) {
  if (!row.vistoriaRealizada) {
    return "Pendente";
  }

  if (row.vistoriaRealizada === "nao") {
    if (!hasValidGroupSelection(row.motivosNaoVistoria, row.outrosMotivoNaoVistoria)) {
      if (
        Array.isArray(row.motivosNaoVistoria) &&
        row.motivosNaoVistoria.includes("outros")
      ) {
        return "Detalhar outro motivo de não vistoria";
      }

      return "Motivo de não vistoria obrigatório";
    }

    return "Pronto";
  }

  if (row.vistoriaRealizada === "sim" && !row.focoEncontrado) {
    return "Informar foco";
  }

  if (row.vistoriaRealizada === "sim" && row.focoEncontrado === "nao") {
    return "Pronto";
  }

  if (row.vistoriaRealizada === "sim" && row.focoEncontrado === "sim") {
    if (!hasValidGroupSelection(row.locaisFoco, row.outrosLocalFoco)) {
      if (Array.isArray(row.locaisFoco) && row.locaisFoco.includes("outros")) {
        return "Detalhar outro local de foco";
      }

      return "Local do foco obrigatório";
    }

    if (!row.focoRemediado) {
      return "Informar remediação";
    }

    if (row.focoRemediado === "nao") {
      if (!hasValidGroupSelection(row.motivosNaoRemediacao, row.outrosMotivoNaoRemediacao)) {
        if (
          Array.isArray(row.motivosNaoRemediacao) &&
          row.motivosNaoRemediacao.includes("outros")
        ) {
          return "Detalhar outro motivo de não remediação";
        }

        return "Motivo de não remediação obrigatório";
      }
    }

    return "Pronto";
  }

  return "Pendente";
}

function getStatusClass(status) {
  if (status === "Pronto") return "status-pill status-pill--success";
  if (status === "Pendente") return "status-pill status-pill--muted";
  return "status-pill status-pill--danger";
}

/**
 * ============================================================
 * ENVIO / API
 * ============================================================
 */
async function handleSubmitReport(event) {
  event.preventDefault();
  clearFormMessage();

  const submitButton = document.getElementById("btnEnviarRelatorio");

  if (!currentSession || !isValidSession(currentSession)) {
    showFormMessage("Sessão inválida. Retorne à página inicial e faça o acesso novamente.", "error");
    return;
  }

  if (!window.AEDES_API_BASE_URL) {
    showFormMessage("A API do sistema não está configurada.", "error");
    return;
  }

  const invalidRows = gridRows.filter((row) => getRowStatus(row) !== "Pronto");
  if (invalidRows.length > 0) {
    showFormMessage("Existem linhas pendentes ou incompletas na grade.", "error");
    return;
  }

  const dataReferencia = new Date();
  const payload = buildBatchPayload(dataReferencia);

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Enviando relatório semanal...";
    }

    await wakeUpApi();
    const result = await sendBatchToApi(payload);

    saveBatchLocally({
      ...payload,
      syncStatus: "enviado_api",
      syncResponse: result,
      syncAt: new Date().toISOString()
    });

    showFormMessage(
      `Relatório semanal enviado com sucesso. Lote ${result.loteId} recebido para validação técnica.`,
      "success"
    );

    resetGridAfterSubmit();
  } catch (error) {
    console.error("Erro ao enviar relatório:", error);

    saveBatchLocally({
      ...payload,
      syncStatus: "erro_envio_api",
      syncError: error?.message || "Erro desconhecido",
      syncAt: new Date().toISOString()
    });

    showFormMessage(
      "Não foi possível enviar o relatório semanal para a API. Tente novamente em instantes.",
      "error"
    );
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Enviar relatório semanal";
    }
  }
}

async function wakeUpApi() {
  if (!window.AEDES_API_BASE_URL) return;

  try {
    await fetch(`${window.AEDES_API_BASE_URL}/api/health`, {
      method: "GET",
      cache: "no-store"
    });
  } catch (_error) {
    // ignora
  }
}

/**
 * Função principal disparada pelo clique no botão de "Enviar"
 */
async function handleSubmitReport(event) {
  if (event && typeof event.preventDefault === "function") {
    event.preventDefault();
  }

  // 1. Validação do Checkbox de Responsabilidade
  const checkbox = document.getElementById('chkResponsabilidade');
  if (checkbox && !checkbox.checked) {
    alert("Por favor, declare a veracidade das informações marcando o termo de responsabilidade.");
    return;
  }

  // 2. Validação da Grade
  if (!gridRows || gridRows.length === 0) {
    alert("Não há unidades carregadas para envio.");
    return;
  }

  const pendentes = gridRows.filter(row => !row.vistoriaRealizada);
  if (pendentes.length > 0) {
    const confirmar = confirm(`Existem ${pendentes.length} unidades sem resposta. Deseja enviar assim mesmo?`);
    if (!confirmar) return;
  }

  // Captura dos elementos de interface
  const btnSubmit = document.getElementById("btnEnviarRelatorio");
  const successScreen = document.getElementById("successScreen");
  const mainContent = document.querySelector('main'); // Onde está a sua grade

  try {
    // 3. Feedback visual imediato no botão
    if (btnSubmit) {
      btnSubmit.disabled = true;
      btnSubmit.innerText = "Processando envio...";
    }

    // 4. Preparação e Envio
    const payloadParaEnvio = buildBatchPayload(new Date());
    console.log("📦 Enviando pacote:", payloadParaEnvio);

    const resultado = await sendBatchToApi(payloadParaEnvio);

    // 5. LÓGICA DE SUCESSO (Troca de telas)
    if (resultado && resultado.ok) {
      console.log("✅ Servidor confirmou o recebimento:", resultado);

      // Esconde o conteúdo da grade para focar no sucesso
      if (mainContent) {
          mainContent.style.opacity = "0";
          setTimeout(() => mainContent.style.display = 'none', 300);
      }

      // Mostra a tela de sucesso (removendo a classe hidden)
      if (successScreen) {
        successScreen.classList.remove("hidden");
        // Se o seu CSS não usar flex por padrão na classe success-screen:
        successScreen.style.display = "flex"; 
        
        // Inicia a barra de animação e o redirecionamento
        iniciarAnimacaoSucesso();
      }
    }

  } catch (error) {
    console.error("❌ Erro no envio:", error);
    alert("Erro: " + error.message);

    // Se falhar, reabilita o botão para o usuário tentar novamente
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.innerText = "Enviar relatório semanal";
    }
  }
}

/**
 * Função para gerenciar a barra de progresso e voltar para a página inicial
 */
function iniciarAnimacaoSucesso() {
  const progressFill = document.querySelector('.progress-fill');
  
  if (progressFill) {
    progressFill.style.width = '0%';
    // Pequeno delay para a transição CSS funcionar
    setTimeout(() => {
      progressFill.style.transition = 'width 3s linear';
      progressFill.style.width = '100%';
    }, 100);
  }

  // Redireciona o focal após 3.5 segundos
  setTimeout(() => {
    window.location.href = 'aedes.html';
  }, 3500);
}
/**
 * ============================================================
 * PAYLOAD DO LOTE
 * ============================================================
 */
function buildBatchPayload(dataReferencia) {
  const isoYear = getIsoWeekYear(dataReferencia);
  const isoWeek = getIsoWeek(dataReferencia);

  // 1. Mapeia as linhas da grade para o formato detalhado de registros
  const registros = gridRows.map((row) => {
    const rowNormalized = normalizeRowForPayload(row);

    const locaisFocoResumo = buildSummaryWithOther(
      rowNormalized.locaisFoco,
      rowNormalized.outrosLocalFoco,
      LOCAIS_FOCO_OPTIONS
    );

    const motivosNaoRemediacaoResumo = buildSummaryWithOther(
      rowNormalized.motivosNaoRemediacao,
      rowNormalized.outrosMotivoNaoRemediacao,
      MOTIVOS_NAO_REMEDIACAO_OPTIONS
    );

    const motivosNaoVistoriaResumo = buildSummaryWithOther(
      rowNormalized.motivosNaoVistoria,
      rowNormalized.outrosMotivoNaoVistoria,
      MOTIVOS_NAO_VISTORIA_OPTIONS
    );

    return {
      id: createLocalId("focal"),
      idOrigem: null,
      origem: "focal_web_grade",
      statusRegistro: "pendente_sincronizacao",
      createdAt: new Date().toISOString(),

      focal_nome: currentSession.nome || "",
      focal_email: currentSession.email || "",
      focal_id: currentSession.focal_id || currentSession.matricula || "",

      unidade_pk: row.unidadeId,
      unidade: row.unidade,
      
      unidadeId: row.unidadeId, 
      unidadeNome: row.unidade,

      semanaAcumulada: String(isoWeek),
      ano: isoYear,
      mes: dataReferencia.getMonth() + 1,
      semana: isoWeek,
      dataVistoria: toDateInputValue(dataReferencia),

      vistoriaRealizada: rowNormalized.vistoriaRealizada,
      statusVistoria: deriveStatusVistoria(rowNormalized.vistoriaRealizada),

      focoEncontrado: rowNormalized.focoEncontrado,
      statusFoco: deriveStatusFoco(rowNormalized.focoEncontrado),

      focoRemediado: rowNormalized.focoRemediado,
      statusRemediacao: deriveStatusRemediacao(rowNormalized.focoRemediado),

      locaisFocoResumo,
      locaisFoco: buildDetailedGroup(
        rowNormalized.locaisFoco,
        rowNormalized.outrosLocalFoco,
        LOCAIS_FOCO_OPTIONS
      ),

      motivosNaoRemediacaoResumo,
      motivosNaoRemediacao: buildDetailedGroup(
        rowNormalized.motivosNaoRemediacao,
        rowNormalized.outrosMotivoNaoRemediacao,
        MOTIVOS_NAO_REMEDIACAO_OPTIONS
      ),

      motivosNaoVistoriaResumo,
      motivosNaoVistoria: buildDetailedGroup(
        rowNormalized.motivosNaoVistoria,
        rowNormalized.outrosMotivoNaoVistoria,
        MOTIVOS_NAO_VISTORIA_OPTIONS
      ),

      observacoes: safeTrim(row.observacoes),

      matchCadastro: true,
      flags: {
        statusAusente: !rowNormalized.vistoriaRealizada,
        unidadeAusente: !row.unidadeId,
        semMatchCadastro: !row.unidadeId,
        focoSemVistoria:
          rowNormalized.vistoriaRealizada !== "sim" &&
          rowNormalized.focoEncontrado === "sim"
      }
    };
  });

  // 2. Retorno do Objeto LOTE (Payload que o Server.js recebe)
  return {
    // --- Campos obrigatórios na RAIZ para o Servidor ---
    matricula: String(currentSession.matricula || currentSession.focal_id || ""), 
    focal_nome: currentSession.nome || "",
    semana_iso: String(isoWeek),
    ano_iso: isoYear,
    
    // --- Estrutura de dados para as colunas JSONB ---
    unidades_vitoriadas: registros.map(r => ({
      unidade: r.unidade,
      vistoria: r.vistoriaRealizada,
      foco: r.focoEncontrado
    })),
    
    payload_completo: {
      loteId: createLocalId("lote"),
      createdAt: new Date().toISOString(),
      focal: currentSession,
      totalRegistros: registros.length,
      registros: registros 
    }
  };
}

function normalizeRowForPayload(row) {
  const normalized = {
    ...row,
    focoEncontrado: row.focoEncontrado,
    focoRemediado: row.focoRemediado,
    locaisFoco: Array.isArray(row.locaisFoco) ? [...row.locaisFoco] : [],
    outrosLocalFoco: row.outrosLocalFoco,
    motivosNaoRemediacao: Array.isArray(row.motivosNaoRemediacao) ? [...row.motivosNaoRemediacao] : [],
    outrosMotivoNaoRemediacao: row.outrosMotivoNaoRemediacao,
    motivosNaoVistoria: Array.isArray(row.motivosNaoVistoria) ? [...row.motivosNaoVistoria] : [],
    outrosMotivoNaoVistoria: row.outrosMotivoNaoVistoria
  };

  if (normalized.vistoriaRealizada === "nao") {
    normalized.focoEncontrado = DASH_VALUE;
    normalized.focoRemediado = DASH_VALUE;
    normalized.locaisFoco = [];
    normalized.outrosLocalFoco = DASH_VALUE;
    normalized.motivosNaoRemediacao = [];
    normalized.outrosMotivoNaoRemediacao = DASH_VALUE;
  }

  if (normalized.vistoriaRealizada === "sim" && normalized.focoEncontrado === "nao") {
    normalized.focoRemediado = DASH_VALUE;
    normalized.locaisFoco = [];
    normalized.outrosLocalFoco = DASH_VALUE;
    normalized.motivosNaoRemediacao = [];
    normalized.outrosMotivoNaoRemediacao = DASH_VALUE;
  }

  if (normalized.vistoriaRealizada === "sim" && normalized.focoEncontrado === "sim" && normalized.focoRemediado === "sim") {
    normalized.motivosNaoRemediacao = [];
    normalized.outrosMotivoNaoRemediacao = "";
  }

  return normalized;
}

function deriveStatusVistoria(vistoriaRealizada) {
  if (vistoriaRealizada === "sim") return "realizada";
  if (vistoriaRealizada === "nao") return "nao_realizada";
  return "nao_informado";
}

function deriveStatusFoco(focoEncontrado) {
  if (focoEncontrado === "sim") return "sim";
  if (focoEncontrado === "nao") return "nao";
  if (isDashValue(focoEncontrado)) return DASH_VALUE;
  return "nao_informado";
}

function deriveStatusRemediacao(focoRemediado) {
  if (focoRemediado === "sim") return "sim";
  if (focoRemediado === "nao") return "nao";
  if (isDashValue(focoRemediado)) return DASH_VALUE;
  return "nao_informado";
}


/**
 * ============================================================
 * STORAGE LOCAL DE APOIO
 * ============================================================
 */
function saveBatchLocally(payload) {
  const existing = getSavedBatches();
  existing.push(payload);
  localStorage.setItem(AEDES_FOCAL_REPORTS_STORAGE_KEY, JSON.stringify(existing));
}

function getSavedBatches() {
  try {
    const raw = localStorage.getItem(AEDES_FOCAL_REPORTS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Erro ao ler lotes salvos:", error);
    return [];
  }
}

function resetGridAfterSubmit() {
  buildGridRows();
  initializeSystemDateInfo();
  renderGrid();
}

/**
 * ============================================================
 * FEEDBACK DE INTERFACE
 * ============================================================
 */
function showFormMessage(message, type) {
  const formMessage = document.getElementById("formMessage");
  if (!formMessage) return;

  formMessage.textContent = message;
  formMessage.className = "form-message";

  if (type === "error") {
    formMessage.classList.add("is-error");
  }

  if (type === "success") {
    formMessage.classList.add("is-success");
  }
}

function clearFormMessage() {
  const formMessage = document.getElementById("formMessage");
  if (!formMessage) return;

  formMessage.textContent = "";
  formMessage.className = "form-message";
}

/**
 * ============================================================
 * HELPERS DE GRUPOS
 * ============================================================
 */
function buildDetailedGroup(selectedValues, otherText, catalog) {
  const values = Array.isArray(selectedValues) ? selectedValues : [];

  return values.map((value) => {
    const catalogItem = catalog.find((item) => item.value === value);

    if (value === "outros") {
      return {
        tipo: "outros",
        label: catalogItem?.label || "Outros",
        detalhe: safeTrim(otherText) || null
      };
    }

    return {
      tipo: value,
      label: catalogItem?.label || value,
      detalhe: null
    };
  });
}

function buildSummaryWithOther(selectedValues, otherText, catalog) {
  const values = Array.isArray(selectedValues) ? selectedValues : [];

  return values.map((value) => {
    const catalogItem = catalog.find((item) => item.value === value);

    if (value === "outros") {
      const detalhe = safeTrim(otherText);
      return detalhe ? `Outros: ${detalhe}` : "Outros";
    }

    return catalogItem?.label || value;
  });
}

/**
 * ============================================================
 * HELPERS GERAIS
 * ============================================================
 */
function normalizeFieldValue(field, value) {
  if (typeof value !== "string") return value;

  if (field === "observacoes") {
    return value;
  }

  if (field.startsWith("outros")) {
    return isDashValue(value) ? DASH_VALUE : safeTrim(value);
  }

  return safeTrim(value);
}

function isDashValue(value) {
  return safeTrim(value) === DASH_VALUE;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getIsoWeek(date) {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);

  const firstThursday = new Date(target.getFullYear(), 0, 4);
  const firstThursdayDayNumber = (firstThursday.getDay() + 6) % 7;
  firstThursday.setDate(firstThursday.getDate() - firstThursdayDayNumber + 3);

  return 1 + Math.round((target - firstThursday) / (7 * 24 * 60 * 60 * 1000));
}

function getIsoWeekYear(date) {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  return target.getFullYear();
}

function safeTrim(value) {
  return String(value || "").trim();
}

function uniqueArray(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function formatNumber(value) {
  return new Intl.NumberFormat("pt-BR").format(Number(value || 0));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function createLocalId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
/* =========================================================
   FUNÇÃO DE COMUNICAÇÃO COM A API (TRANSPORTE)
========================================================= */
async function sendBatchToApi(payload) {
  // Define um tempo limite de 15 segundos para a requisição
  const AEDES_API_TIMEOUT_MS = 15000;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), AEDES_API_TIMEOUT_MS);

  try {
    const response = await fetch(`${window.AEDES_API_BASE_URL}/api/aedes/lotes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";

    if (!response.ok) {
      let errorMessage = `Falha no envio (${response.status})`;
      try {
        if (contentType.includes("application/json")) {
          const errorJson = await response.json();
          errorMessage = errorJson?.error || errorMessage;
        }
      } catch (_e) {}
      throw new Error(errorMessage);
    }

    if (contentType.includes("application/json")) {
      return await response.json();
    }

    return { ok: true };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Tempo limite excedido ao enviar o relatório.");
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}
function resetGridAfterSubmit() {
  // 1. Limpa o array de dados na memória
  gridRows = gridRows.map(row => ({
    ...row,
    statusLinha: "Pendente",
    vistoriaRealizada: "",
    focoEncontrado: "",
    // ... limpe outros campos se achar necessário
  }));

  // 2. Avisa o usuário e atualiza a tela
  renderGrid(); 
  
  // 3. Opcional: Rolar a página para o topo
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
// Aguarda o DOM carregar para garantir que os elementos existam
document.addEventListener('DOMContentLoaded', () => {
    const checkboxResponsabilidade = document.getElementById('chkResponsabilidade');
    const botaoEnviar = document.getElementById('btnEnviarRelatorio');

    if (checkboxResponsabilidade && botaoEnviar) {
        checkboxResponsabilidade.addEventListener('change', function() {
            if (this.checked) {
                // Habilita o botão e restaura a aparência
                botaoEnviar.disabled = false;
                botaoEnviar.style.opacity = "1";
                botaoEnviar.style.cursor = "pointer";
            } else {
                // Desabilita o botão e muda a aparência
                botaoEnviar.disabled = true;
                botaoEnviar.style.opacity = "0.5";
                botaoEnviar.style.cursor = "not-allowed";
            }
        });
    }
});