import { installBtn } from "./elementos.js";

// ---------- app instalavel (PWA) ----------

let installEvent = null; // o navegador avisa quando da pra instalar

export function startPwa() {
  // service worker: deixa o site abrir sem internet
  // (so funciona em https ou localhost, nao abrindo o arquivo direto)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {
      // sem service worker o site funciona normal, so nao fica offline
    });
  }

  // Chrome/Android: guarda o pedido de instalacao e mostra o botao
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installEvent = event;
    installBtn.hidden = false;
  });

  window.addEventListener("appinstalled", function () {
    installEvent = null;
    installBtn.hidden = true;
  });
}

export async function installApp() {
  if (!installEvent) {
    return;
  }
  installEvent.prompt();
  await installEvent.userChoice;
  installEvent = null;
  installBtn.hidden = true;
}
