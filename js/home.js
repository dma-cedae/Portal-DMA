/* =====================================================
   PORTAL DMA
   HOME CONTROLLER
===================================================== */

/* =====================================================
   ELEMENTOS
===================================================== */

const els = {
  installBtn: document.getElementById("installBtn"),

  aboutBtn: document.getElementById("aboutBtn"),
  aboutModal: document.getElementById("aboutModal"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  closeModalBtn: document.getElementById("closeModalBtn")
};

let deferredPrompt = null;

/* =====================================================
   MODAL
===================================================== */

function isModalOpen() {
  return Boolean(els.aboutModal && els.aboutModal.hidden === false);
}

function openModal() {
  if (!els.aboutModal) return;

  els.aboutModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!els.aboutModal) return;

  els.aboutModal.hidden = true;
  document.body.style.overflow = "";
}

function bindModalEvents() {
  els.aboutBtn?.addEventListener("click", openModal);
  els.modalBackdrop?.addEventListener("click", closeModal);
  els.closeModalBtn?.addEventListener("click", closeModal);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && isModalOpen()) {
      closeModal();
    }
  });
}

/* =====================================================
   PWA INSTALL
===================================================== */

function bindInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;

    if (els.installBtn) {
      els.installBtn.hidden = false;
    }
  });

  els.installBtn?.addEventListener("click", async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();

    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      console.log("Usuário aceitou instalar o aplicativo.");
    } else {
      console.log("Usuário recusou a instalação.");
    }

    deferredPrompt = null;

    if (els.installBtn) {
      els.installBtn.hidden = true;
    }
  });
}

/* =====================================================
   SERVICE WORKER
===================================================== */

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await navigator.serviceWorker.register("./service-worker.js");
    console.log("Service Worker registrado:", registration.scope);
  } catch (error) {
    console.error("Erro ao registrar Service Worker:", error);
  }
}

/* =====================================================
   BOOTSTRAP
===================================================== */

function bootstrap() {
  bindModalEvents();
  bindInstallPrompt();
}

window.addEventListener("load", () => {
  bootstrap();
  registerServiceWorker();
});