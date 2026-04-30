import { AedesAPI } from '../modules/aedes/aedes-api.js';

// 1. Criamos uma variável "global" para guardar o resultado da verificação
let dadosCertificadoPendente = null;

const els = {
    certUnidade: document.getElementById('certUnidade'),
    certMes:     document.getElementById('certMes'),
    certAno:     document.getElementById('certAno'),
    checkBtn:    document.getElementById('checkCertificateBtn'),
    downloadBtn: document.getElementById('downloadCertificateBtn'),
};

async function bootstrap() {
    const unidades = await AedesAPI.getUnidades();
    if (unidades.length > 0) {
        els.certUnidade.innerHTML = '<option value="">Selecione uma unidade...</option>' +
            unidades.map(u => `<option value="${u.unidade_origem}">${u.nome_unidade}</option>`).join('');
    }
}

async function verificarElegibilidade() {
    const unidadeSelecionada = els.certUnidade.value;
    const nomeUnidadeExibicao = els.certUnidade.options[els.certUnidade.selectedIndex].text;
    const mes = parseInt(els.certMes.value);
    const ano = parseInt(els.certAno.value);

    if (!unidadeSelecionada) {
        alert("Por favor, selecione uma unidade.");
        return;
    }

    try {
        els.checkBtn.innerText = "VERIFICANDO...";
        els.checkBtn.disabled = true;

        const lotes = await AedesAPI.getLotes();
        let contadorVistorias = 0; // Variável local para a conta

        lotes.forEach(lote => {
            const dataEnvio = new Date(lote.data_envio);
            const mesmoPeriodo = (dataEnvio.getMonth() + 1 === mes && dataEnvio.getFullYear() === ano);

            if (mesmoPeriodo) {
                const registros = lote.payload_completo?.registros || [];
                if (registros.some(r => r.unidade === unidadeSelecionada)) {
                    contadorVistorias++;
                }
            }
        });

        if (contadorVistorias >= 2) {
            // 2. SUCESSO: Guardamos tudo o que o certs.js vai precisar no "objeto global"
            dadosCertificadoPendente = {
                unidadeNome: nomeUnidadeExibicao,
                ano: ano,
                mes: mes,
                total: contadorVistorias
            };
            
            alert(`🏆 Unidade Protegida! Encontramos ${contadorVistorias} vistorias.`);
            ativarBotaoDownload(true);
        } else {
            dadosCertificadoPendente = null; // Limpa se não for elegível
            alert(`⚠️ Não elegível: apenas ${contadorVistorias} vistorias encontradas.`);
            ativarBotaoDownload(false);
        }
    } catch (err) {
        console.error(err);
        alert("Erro ao consultar vistorias.");
    } finally {
        els.checkBtn.innerText = "VERIFICAR STATUS";
        els.checkBtn.disabled = false;
    }
}

// 3. O Botão de Download agora usa os dados guardados na variável global
els.downloadBtn?.addEventListener('click', () => {
    if (dadosCertificadoPendente) {
        // AedesCerts é o objeto definido no seu arquivo certs.js
        AedesCerts.openPrintableCertificate(dadosCertificadoPendente);
    }
});

function ativarBotaoDownload(status) {
    if (!els.downloadBtn) return;
    els.downloadBtn.disabled = !status;
    els.downloadBtn.style.opacity = status ? "1" : "0.5";
    els.downloadBtn.style.background = status ? "var(--accent-green)" : "white";
    els.downloadBtn.style.color = status ? "white" : "var(--primary-blue)";
    els.downloadBtn.style.cursor = status ? "pointer" : "default";
}

window.verificarElegibilidade = verificarElegibilidade;
bootstrap();