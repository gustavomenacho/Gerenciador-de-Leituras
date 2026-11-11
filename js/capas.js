import { COVER_MAX_HEIGHT, COVER_MAX_WIDTH, COVER_STORE, DB_NAME } from "./constantes.js";
import { state } from "./estado.js";

// ---------- capas do aparelho (IndexedDB) ----------
// o localStorage so guarda texto e tem limite de uns 5 MB,
// entao as imagens ficam no IndexedDB, com o id do livro como chave

export function openDatabase() {
  return new Promise(function (resolve, reject) {
    const request = indexedDB.open(DB_NAME, 1);
    // roda so na primeira vez (ou quando muda a versao): cria a "tabela" das capas
    request.onupgradeneeded = function () {
      request.result.createObjectStore(COVER_STORE);
    };
    request.onsuccess = function () {
      resolve(request.result);
    };
    request.onerror = function () {
      reject(request.error);
    };
  });
}

// executa uma acao no IndexedDB e espera terminar
export async function useCoverStore(mode, action) {
  const db = await openDatabase();
  return new Promise(function (resolve, reject) {
    const transaction = db.transaction(COVER_STORE, mode);
    const store = transaction.objectStore(COVER_STORE);
    let result;
    action(store, function (value) {
      result = value;
    });
    transaction.oncomplete = function () {
      db.close();
      resolve(result);
    };
    transaction.onerror = function () {
      db.close();
      reject(transaction.error);
    };
  });
}

// cria um endereco temporario (blob:...) pra usar a imagem no <img>
export function setCoverUrl(id, blob) {
  if (state.coverUrls[id]) {
    URL.revokeObjectURL(state.coverUrls[id]);
  }
  state.coverUrls[id] = URL.createObjectURL(blob);
}

export async function saveCover(id, blob) {
  await useCoverStore("readwrite", function (store) {
    store.put(blob, id);
  });
  setCoverUrl(id, blob);
}

export async function deleteCover(id) {
  await useCoverStore("readwrite", function (store) {
    store.delete(id);
  });
  if (state.coverUrls[id]) {
    URL.revokeObjectURL(state.coverUrls[id]);
    delete state.coverUrls[id];
  }
}

export async function getCover(id) {
  return useCoverStore("readonly", function (store, done) {
    const request = store.get(id);
    request.onsuccess = function () {
      done(request.result);
    };
  });
}

// carrega todas as capas quando a pagina abre
// e apaga as que sobraram de livros que nao existem mais
export async function loadCovers() {
  const ids = state.books.map(function (book) {
    return book.id;
  });

  await useCoverStore("readwrite", function (store) {
    const request = store.openCursor();
    request.onsuccess = function () {
      const cursor = request.result;
      if (!cursor) {
        return;
      }
      if (ids.includes(cursor.key)) {
        setCoverUrl(cursor.key, cursor.value);
      } else {
        cursor.delete();
      }
      cursor.continue();
    };
  });
}

// diminui a foto antes de salvar (foto de celular tem varios MB)
// desenha a imagem menor num canvas e exporta como JPEG
export function resizeImage(file) {
  return new Promise(function (resolve, reject) {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = function () {
      URL.revokeObjectURL(url);

      let scale = Math.min(COVER_MAX_WIDTH / img.width, COVER_MAX_HEIGHT / img.height);
      if (scale > 1) {
        scale = 1; // nao aumenta imagem pequena
      }

      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);

      const context = canvas.getContext("2d");
      context.fillStyle = "#ffffff"; // fundo branco pra png transparente nao ficar preto
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(img, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("nao foi possivel converter"));
        }
      }, "image/jpeg", 0.85);
    };

    img.onerror = function () {
      URL.revokeObjectURL(url);
      reject(new Error("imagem invalida"));
    };

    img.src = url;
  });
}

// pro arquivo de backup: imagem -> texto (data URL) e o caminho de volta
export function blobToDataUrl(blob) {
  return new Promise(function (resolve, reject) {
    const reader = new FileReader();
    reader.onload = function () {
      resolve(reader.result);
    };
    reader.onerror = function () {
      reject(reader.error);
    };
    reader.readAsDataURL(blob);
  });
}

export async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
}
