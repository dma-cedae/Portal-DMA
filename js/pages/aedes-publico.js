// js/pages/aedes-publico.js

import { AedesAPI } from '../modules/aedes/aedes-api.js';
import { openPrintableCertificate } from '../modules/aedes/certs.js';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3001'
    : 'https://dma-aedes-api.onrender.com';

let dadosCertificadoPendente = null;

const els = {
  certUnidade: document.getElementById('certUnidade'),
  certMes:     document.getElementById('certMes'),
  certAno:     document.getElementById('certAno'),
  checkBtn:    document.getElementById('checkCertificateBtn'),
  downloadBtn: document.getElementById('downloadCertificateBtn'),
};

/* ── Bootstrap: carrega unidades ───────────────────────── */

async function bootstrap() {
  try {
    const unidades = await AedesAPI.getUnidades();
    els.certUnidade.innerHTML =
      '<option value="">Selecione uma unidade...</option>' +
      unidades.map(u => `<option value="${u.unidade_id}">${u.nome_unidade}</option>`).join('');
  } catch (err) {
    console.error('Erro ao carregar unidades:', err);
    els.certUnidade.innerHTML = '<option value="">Erro ao carregar unidades</option>';
  }
}

/* ── Verificação ───────────────────────────────────────── */

async function verificarElegibilidade() {
  const selectElement = els.certUnidade;

  if (!selectElement.value) {
    alert('Por favor, selecione uma unidade.');
    return;
  }

  const unidadeSelecionada = selectElement.options[selectElement.selectedIndex].text.trim().toUpperCase();
  const mesFiltro = parseInt(els.certMes.value);
  const anoFiltro = parseInt(els.certAno.value);

  try {
    els.checkBtn.disabled = true;
    els.checkBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> VERIFICANDO...';

    const response = await fetch(`${API_BASE}/api/aedes/certificados`);
    if (!response.ok) throw new Error('Falha na comunicação com o servidor');

    const certificados = await response.json();

    const dadosUnidade = certificados.find(c =>
      c.unidade.trim().toUpperCase() === unidadeSelecionada &&
      parseInt(c.mes) === mesFiltro &&
      parseInt(c.ano) === anoFiltro
    );

    const contadorVistorias = dadosUnidade ? parseInt(dadosUnidade.total_vistorias) : 0;

    if (contadorVistorias >= 4) {
      dadosCertificadoPendente = {
        unidadeNome: selectElement.options[selectElement.selectedIndex].text,
        ano:   anoFiltro,
        mes:   mesFiltro,
        total: contadorVistorias,
      };
      alert(`🏆 Unidade Protegida! Encontramos ${contadorVistorias} vistorias confirmadas.`);
      ativarBotaoDownload(true);
    } else {
      dadosCertificadoPendente = null;
      alert(`⚠️ Unidade não apta: foram encontradas apenas ${contadorVistorias} vistorias das 4 necessárias.`);
      ativarBotaoDownload(false);
    }
  } catch (err) {
    console.error('Erro na verificação:', err);
    alert('Erro ao consultar vistorias. Verifique sua conexão.');
  } finally {
    els.checkBtn.disabled = false;
    els.checkBtn.innerHTML = '<i class="fas fa-search"></i> VERIFICAR STATUS';
  }
}

/* ── Ativa/desativa botão de download ──────────────────── */

function ativarBotaoDownload(status) {
  if (!els.downloadBtn) return;
  els.downloadBtn.disabled         = !status;
  els.downloadBtn.style.opacity    = status ? '1'                   : '0.5';
  els.downloadBtn.style.background = status ? 'var(--accent-green)' : 'white';
  els.downloadBtn.style.color      = status ? 'white'               : 'var(--primary-blue)';
  els.downloadBtn.style.cursor     = status ? 'pointer'             : 'default';
}

/* ── Listeners ─────────────────────────────────────────── */

// ✅ FIX PRINCIPAL: conecta o clique ao botão de verificar
els.checkBtn?.addEventListener('click', verificarElegibilidade);

els.downloadBtn?.addEventListener('click', () => {
  if (!dadosCertificadoPendente) return;
  try {
    openPrintableCertificate(dadosCertificadoPendente);
  } catch (err) {
    console.error('Erro ao abrir certificado:', err);
    alert('Erro ao gerar o PDF. Verifique se pop-ups estão liberados neste site.');
  }
});

/* ── Init ──────────────────────────────────────────────── */
bootstrap();