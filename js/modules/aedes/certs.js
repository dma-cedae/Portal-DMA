// js/modules/aedes/certs.js

const MONTHS = [
  "",
  "janeiro", "fevereiro", "março", "abril",
  "maio", "junho", "julho", "agosto",
  "setembro", "outubro", "novembro", "dezembro",
];
const LOGO_BASE64 = [
    "data:image/png;base64,",
    "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",
  ].join("");

function escapeHtml(text) {
  return String(text ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatLongDate(date = new Date()) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getMonthName(mes) {
  return MONTHS[Number(mes)] || "";
}

export function buildCertificateHTML({ unidadeNome, ano, mes, total }) {
  // Isso pega "https://seu-dominio.com" ou o endereço do codespace
  const baseUrl = window.location.origin; 
  const logoBase64 = LOGO_BASE64;

  const mesNome     = getMonthName(mes);
  const dataGeracao = formatLongDate();
  const certId      = `DMA-${String(ano).slice(-2)}${String(mes).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Certificado — ${escapeHtml(unidadeNome)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Lato:ital,wght@0,300;0,400;0,700;1,300&display=swap" rel="stylesheet" />

  <style>
    :root {
      --navy:       #0a2e5c;
      --navy-mid:   #0d3d7a;
      --blue:       #1457a8;
      --gold:       #b8882a;
      --gold-light: #d4aa50;
      --cream:      #fdfaf4;
      --text:       #182438;
      --muted:      #56687e;
      --border:     #cdd9ea;
      --sheet-w:    297mm;
      --sheet-h:    210mm;
    }

    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    html, body {
      margin: 0; padding: 0;
      background: #dce6f2;
      font-family: "Lato", "Segoe UI", Arial, sans-serif;
      color: var(--text);
    }

    body { padding: 16px; }

    /* ── Barra de ações ─────────────────────────────────────── */
    .actions-bar {
      max-width: var(--sheet-w);
      margin: 0 auto 14px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }

    .actions-bar button {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: none;
      border-radius: 999px;
      padding: 10px 22px;
      font: 600 0.83rem "Lato", sans-serif;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: filter 0.15s, transform 0.1s;
    }

    .actions-bar button:hover  { filter: brightness(1.08); }
    .actions-bar button:active { transform: scale(0.97); }
    .btn-print { background: var(--navy); color: #ffffff; }
    .btn-close { background: transparent; border: 1.5px solid var(--navy) !important; color: var(--navy); }

    /* ── Folha ──────────────────────────────────────────────── */
    .sheet {
      width: var(--sheet-w);
      height: var(--sheet-h);
      margin: 0 auto;
      background: var(--cream);
      position: relative;
      overflow: hidden;
      box-shadow: 0 20px 60px rgba(10, 46, 92, 0.22);
      border: 8px solid var(--navy);
    }

    /* Moldura interna dourada */
    .sheet::before {
      content: "";
      position: absolute;
      inset: 9mm;
      border: 1.5px solid var(--gold);
      pointer-events: none;
      z-index: 1;
    }

    /* Marca d'água */
    .sheet::after {
      content: " DMA ";
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: "Cinzel", serif;
      font-size: 9rem;
      font-weight: 700;
      color: rgba(10, 46, 92, 0.035);
      pointer-events: none;
      z-index: 0;
      letter-spacing: 0.2em;
    }

    /* ── Cantos ornamentais ─────────────────────────────────── */
    .corner {
      position: absolute;
      z-index: 3;
      width: 14mm;
      height: 14mm;
      pointer-events: none;
    }
    .corner--tl { top: 25mm;    left: 12mm;  border-top: 2px solid var(--gold); border-left:  2px solid var(--gold); }
    .corner--tr { top: 25mm;    right: 12mm; border-top: 2px solid var(--gold); border-right: 2px solid var(--gold); }
    .corner--bl { bottom: 12mm; left: 12mm;  border-bottom: 2px solid var(--gold); border-left:  2px solid var(--gold); }
    .corner--br { bottom: 12mm; right: 12mm; border-bottom: 2px solid var(--gold); border-right: 2px solid var(--gold); }

    /* ── Topbar ─────────────────────────────────────────────── */
    .topbar {
      position: relative;
      z-index: 2;
      background: linear-gradient(135deg, var(--navy) 0%, var(--navy-mid) 40%, #051937 100%);
      color: #ffffff;
      /* Aumentamos o padding vertical para dar elegância */
      padding: 4mm 14mm 6mm; 
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      /* Sombra para destacar do fundo cream */
      box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    }

    /* Faixa dourada abaixo do topo */
    .topbar::after {
      content: "";
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 4px;
      background: linear-gradient(90deg, 
        var(--gold) 0%, 
        var(--gold-light) 50%, 
        var(--gold) 100%);
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 15px;
      flex-shrink: 0; /* evita que a logo seja espremida */
    }

    .brand-logo {
      /* Aumentamos um pouco a logo */
      width: 50px; 
      height: auto;
      filter: drop-shadow(0 0 2px rgba(255,255,255,0.2)); /* Leve brilho na logo */
      object-fit: contain;
      flex-shrink: 0;
      display: block;
    }

    .brand-text small {
      display: block;
      font-size: 0.62rem;
      opacity: 0.75;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .top-badge {
      text-align: right;
      font-size: 0.75rem;
      line-height: 1.4;
      border-left: 1px solid rgba(255,255,255,0.2); /* Divisória sutil */
      padding-left: 15px;
    }

    .top-badge strong {
      display: block;
      font-size: 0.76rem;
      letter-spacing: 0.02em;
    }

    /* ── Corpo ──────────────────────────────────────────────── */
    .body {
      position: relative;
      z-index: 2;
      padding: 25mm 18mm 5mm;
      display: flex;
      flex-direction: column;
      
      /* ADICIONE ESTA LINHA */
      justify-content: center; 

      /* Mantém a altura calculada */
      height: calc(var(--sheet-h) - 22mm);
    }
    .eyebrow {
      text-align: center;
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.22em;
      color: var(--gold);
      margin-bottom: 3px;
    }

    .cert-title {
      font-family: "Cinzel", serif;
      font-size: 1.9rem;
      font-weight: 700;
      text-align: center;
      color: var(--navy);
      margin: 0 0 2px;
      letter-spacing: 0.05em;
      line-height: 1.1;
    }

    .ornament {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      margin: 3px 0 7px;
      color: var(--gold);
      font-size: 0.72rem;
      letter-spacing: 0.12em;
    }

    .ornament::before,
    .ornament::after {
      content: "";
      flex: 1;
      max-width: 45mm;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--gold-light));
    }

    .ornament::after {
      background: linear-gradient(90deg, var(--gold-light), transparent);
    }

    /* ── Texto narrativo ────────────────────────────────────── */
    .narrative {
      max-width: 220mm;
      margin: 0 auto;
      text-align: center;
      line-height: 1.6;
      font-size: 0.875rem;
      color: var(--text);
    }

    .narrative p { margin: 0 0 5px; }

    .unit-block {
      margin: 6px auto 7px;
      text-align: center;
    }

    .unit-name {
      display: inline-block;
      font-family: "Cinzel", serif;
      font-size: 1.3rem;
      font-weight: 700;
      color: var(--navy);
      padding: 5px 18px 7px;
      border-top: 1px solid rgba(184,136,42,0.35);
      border-bottom: 3px solid var(--gold);
      line-height: 1.25;
      max-width: 100%;
      word-break: break-word;
      background: linear-gradient(to bottom, rgba(245,236,212,0.25), transparent);
    }

    .hl { color: var(--navy); font-weight: 700; }

    /* ── Tabela de dados (substitui os cards) ───────────────── */
    .data-table {
      width: 100%;
      max-width: 215mm;
      margin: 10px auto 0;
      border-collapse: collapse;
      font-size: 0.82rem;
    }

    .data-table thead tr {
      background: var(--navy);
      color: #fdfaf4;
    }

    .data-table thead th {
      padding: 7px 14px;
      font-size: 0.62rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      text-align: left;
    }

    .data-table thead th:last-child {
      text-align: center;
    }

    .data-table tbody tr {
      background: #fdfaf4;
      border-bottom: 1px solid var(--border);
    }

    .data-table tbody td {
      padding: 9px 14px;
      color: var(--navy);
      font-weight: 600;
      vertical-align: middle;
    }

    .data-table tbody td:last-child {
      text-align: center;
    }

    /* Linha de status com badge */
    .badge-conforme {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      background: #fdfaf4;
      color: #1a6e34;
      border: 1px solid #a8d5b5;
      border-radius: 4px;
      padding: 3px 10px;
      font-size: 0.72rem;
      font-weight: 700;
      letter-spacing: 0.05em;
      text-transform: uppercase;
    }

    .badge-conforme::before {
      content: "✔";
      font-size: 0.7rem;
    }

    /* ── Rodapé institucional ───────────────────────────────── */
    .cert-footer {
      margin-top: auto; 
      /* ADICIONE ESSA LINHA ABAIXO */
      margin-bottom: 15mm; 
      
      padding-top: 10px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 15px;
    }

    .footer-institution {
      font-size: 0.72rem;
      color: var(--muted);
      line-height: 1.5;
    }

    .footer-institution strong {
      display: block;
      color: var(--navy);
      font-size: 0.78rem;
      margin-bottom: 1px;
    }

    .footer-right {
      text-align: right;
      font-size: 0.65rem;
      color: var(--muted);
      line-height: 0.8;
    }

    .cert-id {
      display: block;
      font-family: "Lato", monospace;
      font-size: 0.68rem;
      font-weight: 700;
      color: var(--navy);
      letter-spacing: 0.06em;
      margin-bottom: 1px;
    }

    /* ── Impressão ───────────────────────────────────────────── */
    @page { size: A4 landscape; margin: 0; }

    @media print {
      html, body {
        width: var(--sheet-w);
        height: var(--sheet-h);
        background: white;
        padding: 0;
      }

      .actions-bar { display: none !important; }

      .sheet {
        width: var(--sheet-w);
        height: var(--sheet-h);
        margin: 0;
        box-shadow: none;
      }
    }
  </style>
</head>
<body>

  <div class="actions-bar">
    <button class="btn-close" onclick="window.close()">✕ Fechar</button>
    <button class="btn-print" onclick="window.print()">⎙ Imprimir / Salvar PDF</button>
  </div>

  <div class="sheet">

    <div class="corner corner--tl"></div>
    <div class="corner corner--tr"></div>
    <div class="corner corner--bl"></div>
    <div class="corner corner--br"></div>

    <header class="topbar">
  <div class="brand">
    <img class="brand-logo" src="${logoBase64}" alt="Portal DMA" />
    <div class="brand-text">
      <small>Sistema de Gestão Ambiental</small>
      <strong>Portal DMA</strong>
    </div>
  </div>

  <div class="top-badge">
        <strong>Programa de Combate ao <i>Aedes aegypti</i></strong>
        Certificado de Conformidade Mensal — CEDAE
      </div>
    </header>

    <main class="body">

      <p class="eyebrow"> &nbsp; Certificado Institucional &nbsp; </p>
      <h1 class="cert-title">Certificado de Conformidade</h1>
      <div class="ornament"> Controle de vistorias e acompanhamento preventivo </div>

      <div class="narrative">
        <p>Certificamos que a unidade</p>
        <div class="unit-block">
          <span class="unit-name">${escapeHtml(unidadeNome)}</span>
        </div>
        <p>
          atendeu ao critério mínimo de vistorias estabelecido pelo
          <span class="hl">Programa de Combate ao <i>Aedes aegypti</i></span>,
          registrando <span class="hl">${escapeHtml(String(total))} vistorias</span>
          no mês de <span class="hl">${escapeHtml(mesNome)} de ${escapeHtml(String(ano))}</span>.
        </p>
        <p>
          Este certificado reconhece a vistoria mensal realizada pela unidade no período informado,
          contribuindo para o monitoramento e controle do mosquito <i>Aedes aegypti</i>.
        </p>
      </div>

      <!-- Tabela de dados técnicos -->
      <table class="data-table">
        <thead>
          <tr>
            <th>Unidade certificada</th>
            <th>Período de referência</th>
            <th>Total de vistorias</th>
            <th>Situação</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${escapeHtml(unidadeNome)}</td>
            <td>${escapeHtml(mesNome)} / ${escapeHtml(String(ano))}</td>
            <td style="text-align:center;">${escapeHtml(String(total))}</td>
            <td><span class="badge-conforme">UNIDADE PROTEGIDA</span></td>
          </tr>
        </tbody>
      </table>

      <!-- Rodapé institucional -->
      <footer class="cert-footer">
        <div class="footer-institution">
          <strong>Departamento de Meio Ambiente — CEDAE</strong>
          Companhia Estadual de Águas e Esgotos do Rio de Janeiro<br />
          Documento gerado eletronicamente pelo Portal DMA
        </div>
        <div class="footer-right">
         <!-- <span class="cert-id">Nº ${escapeHtml(certId)}</span> -->
          Emitido em ${escapeHtml(dataGeracao)}<br />
          Válido para o período de referência indicado
        </div>
      </footer>

    </main>
  </div>

</body>
</html>`.trim();
}

export function openPrintableCertificate(data) {
  const html = buildCertificateHTML(data);
  const win  = window.open("", "_blank", "width=1366,height=900,menubar=no,toolbar=no");

  if (!win) {
    throw new Error(
      "Não foi possível abrir a janela do certificado. " +
      "Verifique se o navegador está bloqueando pop-ups para este site."
    );
  }

  win.document.open();
  win.document.write(html);
  win.document.close();

  return win;
}
