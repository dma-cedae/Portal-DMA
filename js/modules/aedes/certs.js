// js/modules/aedes/certs.js

const MONTHS = [
  "",
  "janeiro", "fevereiro", "março", "abril",
  "maio", "junho", "julho", "agosto",
  "setembro", "outubro", "novembro", "dezembro",
];

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
    .btn-print { background: var(--navy); color: #fff; }
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
      content: "✦ DMA ✦";
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
    .corner--tl { top: 12mm;    left: 12mm;  border-top: 2px solid var(--gold); border-left:  2px solid var(--gold); }
    .corner--tr { top: 12mm;    right: 12mm; border-top: 2px solid var(--gold); border-right: 2px solid var(--gold); }
    .corner--bl { bottom: 12mm; left: 12mm;  border-bottom: 2px solid var(--gold); border-left:  2px solid var(--gold); }
    .corner--br { bottom: 12mm; right: 12mm; border-bottom: 2px solid var(--gold); border-right: 2px solid var(--gold); }

    /* ── Topbar ─────────────────────────────────────────────── */
    .topbar {
      position: relative;
      z-index: 2;
      background: linear-gradient(100deg, var(--navy) 0%, var(--navy-mid) 55%, var(--blue) 100%);
      color: #fff;
      /* padding reduzido para não cortar a logo */
      padding: 0.5mm 12mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }

    /* Faixa dourada abaixo do topo */
    .topbar::after {
      content: "";
      position: absolute;
      bottom: 0; left: 0; right: 0;
      height: 8px;
      background: linear-gradient(90deg, transparent, var(--gold-light), var(--gold), var(--gold-light), transparent);
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 15px;
      flex-shrink: 0; /* evita que a logo seja espremida */
    }

    .brand-logo {
      width: 48px;
      height: 40px;
      object-fit: contain;
      flex-shrink: 0;
      display: block; /* remove espaço baseline */
    }

    .brand-text small {
      display: block;
      font-size: 0.62rem;
      opacity: 0.75;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 2px;
    }

    .brand-text strong {
      display: block;
      font-family: "Cinzel", serif;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 0.05em;
    }

    .top-badge {
      text-align: right;
      font-size: 0.7rem;
      line-height: 1.5;
      opacity: 0.88;
      max-width: 85mm;
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
      padding: 6mm 18mm 5mm;
      display: flex;
      flex-direction: column;
      /* altura = folha - topbar estimada (~22mm) */
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
      color: #fff;
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
      background: #fff;
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
      background: #e6f4ea;
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
      padding-top: 15px;
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
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
        <img class="brand-logo" src="../assets/icon-192.png" alt="Portal DMA" />
        <div class="brand-text">
          <small>Sistema de Gestão Ambiental</small>
          <strong>Portal DMA</strong>
        </div>
      </div>

      <div class="top-badge">
        <strong>Programa de Combate ao Aedes aegypti</strong>
        Certificado de Conformidade Mensal — CEDAE
      </div>
    </header>

    <main class="body">

      <p class="eyebrow">✦ &nbsp; Certificado Institucional &nbsp; ✦</p>
      <h1 class="cert-title">Certificado de Conformidade</h1>
      <div class="ornament">✦ Controle de vistorias e acompanhamento preventivo ✦</div>

      <div class="narrative">
        <p>Certificamos que a unidade</p>
        <div class="unit-block">
          <span class="unit-name">${escapeHtml(unidadeNome)}</span>
        </div>
        <p>
          atendeu ao critério mínimo de vistorias estabelecido pelo
          <span class="hl">Programa de Combate ao Aedes aegypti</span>,
          registrando <span class="hl">${escapeHtml(String(total))} vistorias</span>
          no mês de <span class="hl">${escapeHtml(mesNome)} de ${escapeHtml(String(ano))}</span>.
        </p>
        <p>
          Este certificado reconhece a vistoria mensal realizada pela unidade no período informado,
          contribuindo para o monitoramento e controle do mosquito Aedes aegypti. 
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
          <span class="cert-id">Nº ${escapeHtml(certId)}</span>
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