import { IMPORT_PREFIX, LONG_LINK, MAX_IMPORT } from "./constantes.js";
import { state } from "./estado.js";
import { copyLinkBtn, downloadBtn, importDialog, importFile, importHint, importMergeBtn, importReplaceBtn, importSummary, linkStatus, shareLinkBtn, transferDialog, transferLink } from "./elementos.js";
import { normalizeText, plural } from "./utils.js";
import { normalizeBook, saveBooks } from "./dados.js";
import { blobToDataUrl, dataUrlToBlob, getCover, saveCover } from "./capas.js";
import { render } from "./tela.js";
import { saveBackup, showToast } from "./acoes.js";

// ---------- levar a estante pra outro aparelho ----------
// sem servidor: os livros vao no proprio link, depois do "#"
// (o que vem depois do # nao e enviado pro servidor, fica so no navegador)
// passos: livros -> JSON -> comprimido -> base64 -> link

// base64 normal tem + / = que atrapalham em link, por isso troco
export function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64ToBytes(text) {
  let base64 = text.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// usa o CompressionStream do proprio navegador (vi no MDN)
export async function compress(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

export async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

// dados pro link: sem as capas do aparelho (o link ficaria enorme)
export function getExportData() {
  const list = state.books.map(function (book) {
    const copy = Object.assign({}, book);
    copy.localCover = false;
    return copy;
  });
  return {
    app: "pagelog",
    versao: 2,
    exportadoEm: new Date().toISOString(),
    livros: list
  };
}

// dados pro arquivo: inclui as capas como texto (data URL), em "capas": { id: imagem }
export async function getExportDataWithCovers() {
  const data = getExportData();
  data.capas = {};
  for (const book of state.books) {
    if (book.localCover) {
      const blob = await getCover(book.id);
      if (blob) {
        data.capas[book.id] = await blobToDataUrl(blob);
      }
    }
  }
  return data;
}

// le o JSON importado e passa cada livro pelo normalizeBook
// (nao da pra confiar no que vem de fora)
export function readLibrary(text) {
  const data = JSON.parse(text);
  let list = data;
  let covers = {};
  if (!Array.isArray(data)) {
    list = data ? data.livros : null;
    if (data && data.capas && typeof data.capas === "object") {
      covers = data.capas;
    }
  }
  if (!Array.isArray(list)) {
    throw new Error("formato invalido");
  }

  return list
    .slice(0, MAX_IMPORT)
    .filter(function (item) {
      return item && typeof item === "object";
    })
    .map(function (item) {
      const book = normalizeBook(item);
      book.localCover = false; // a capa so vale depois de salva neste aparelho
      // capa que veio no arquivo: so aceito imagem em data URL e de tamanho razoavel
      const cover = covers[item.id];
      if (typeof cover === "string" && cover.startsWith("data:image/") && cover.length < 3000000) {
        book.coverData = cover;
      }
      return book;
    })
    .filter(function (book) {
      return book.title !== "" && book.author !== "";
    });
}

export async function createLink() {
  const compressed = await compress(JSON.stringify(getExportData()));
  const link = location.origin + location.pathname + IMPORT_PREFIX + bytesToBase64(compressed);
  transferLink.value = link;
  transferLink.hidden = false;
  return link;
}

export function longLinkWarning(link) {
  if (link.length > LONG_LINK) {
    return " A estante é grande: se o link não abrir, use o arquivo.";
  }
  return "";
}

export function openTransferDialog() {
  const isEmpty = state.books.length === 0;
  transferLink.hidden = true;
  shareLinkBtn.hidden = !navigator.share; // compartilhar so aparece onde existe (celular)
  shareLinkBtn.disabled = isEmpty;
  copyLinkBtn.disabled = isEmpty;
  downloadBtn.disabled = isEmpty;

  if (isEmpty) {
    linkStatus.textContent = "Sua estante está vazia: cadastre livros antes de levá-la.";
  } else {
    linkStatus.textContent = "";
  }
  transferDialog.showModal();
}

export async function copyLink() {
  const link = await createLink();
  try {
    await navigator.clipboard.writeText(link);
    linkStatus.textContent =
      "Link copiado com " + plural(state.books.length, "livro", "livros") +
      ". Cole no WhatsApp ou e-mail e abra no outro aparelho." + longLinkWarning(link);
  } catch (error) {
    // se o navegador nao deixar copiar, deixo o link selecionado pra copiar na mao
    transferLink.select();
    linkStatus.textContent =
      "Não foi possível copiar sozinho: o link está selecionado acima, copie manualmente." +
      longLinkWarning(link);
  }
}

export async function shareLink() {
  const link = await createLink();
  try {
    await navigator.share({
      title: "Minha estante no PageLog",
      text: "Abra para importar minha estante:",
      url: link
    });
    linkStatus.textContent = "Link enviado." + longLinkWarning(link);
  } catch (error) {
    // AbortError = a pessoa fechou a janela de compartilhar, nao e erro
    if (error.name !== "AbortError") {
      linkStatus.textContent = "Não foi possível compartilhar. Use o botão Copiar link.";
    }
  }
}

export async function downloadFile() {
  let data;
  try {
    data = await getExportDataWithCovers();
  } catch (error) {
    data = getExportData(); // se nao conseguir ler as capas, baixa pelo menos os livros
  }
  const json = JSON.stringify(data, null, 2);
  const file = new Blob([json], { type: "application/json" });
  const today = new Date().toISOString().slice(0, 10);

  const a = document.createElement("a");
  a.href = URL.createObjectURL(file);
  a.download = "pagelog-estante-" + today + ".json";
  a.click();
  setTimeout(function () {
    URL.revokeObjectURL(a.href);
  }, 1000);

  linkStatus.textContent = "";
  showToast("Arquivo de state.backup baixado.");
}

// ---------- importar (link ou arquivo) ----------

// o mesmo livro e reconhecido pelo id ou por titulo + autor
// (caso a pessoa tenha cadastrado na mao nos dois aparelhos)
export function isSameBook(a, b) {
  if (a.id === b.id) {
    return true;
  }
  const sameTitle = normalizeText(a.title) === normalizeText(b.title);
  const sameAuthor = normalizeText(a.author) === normalizeText(b.author);
  return sameTitle && sameAuthor;
}

// junta sem duplicar: se o livro existe nos dois, fica o editado por ultimo
export function mergeBooks(newBooks) {
  const result = state.books.slice();
  let added = 0;
  let updated = 0;

  newBooks.forEach(function (newBook) {
    const index = result.findIndex(function (book) {
      return isSameBook(book, newBook);
    });

    if (index === -1) {
      result.push(newBook);
      added++;
    } else if (newBook.updatedAt > result[index].updatedAt) {
      const oldBook = result[index];
      newBook.id = oldBook.id;
      // se o livro importado nao trouxe capa nenhuma, mantem a capa que ja tinha aqui
      if (!newBook.coverData && !newBook.image && oldBook.localCover) {
        newBook.localCover = true;
      }
      result[index] = newBook;
      updated++;
    }
  });

  return { books: result, added: added, updated: updated };
}

export function askImport(newBooks, origin) {
  if (newBooks.length === 0) {
    showToast("Nenhum livro encontrado " + origin + ".");
    return;
  }

  state.pendingImport = newBooks;
  const found = "Encontramos " + plural(newBooks.length, "livro", "livros") + " " + origin + ".";

  if (state.books.length === 0) {
    importSummary.textContent = found + " Importar para esta estante?";
    importHint.hidden = true;
    importReplaceBtn.hidden = true;
    importMergeBtn.textContent = "Importar";
  } else {
    importSummary.textContent = found + " Esta estante já tem " + plural(state.books.length, "livro", "livros") + ".";
    importHint.hidden = false;
    importReplaceBtn.hidden = false;
    importMergeBtn.textContent = "Juntar";
  }

  if (transferDialog.open) {
    transferDialog.close();
  }
  importDialog.showModal();
}

// salva no IndexedDB as capas que vieram no arquivo
export async function saveImportedCovers() {
  for (const book of state.books) {
    if (book.coverData) {
      try {
        await saveCover(book.id, await dataUrlToBlob(book.coverData));
        book.localCover = true;
      } catch (error) {
        book.localCover = false;
      }
      delete book.coverData; // nao vai pro localStorage
    }
  }
}

export async function confirmImport(mode) {
  if (!state.pendingImport) {
    return;
  }

  saveBackup("Importação desfeita: a estante voltou a ser como antes.");
  let message = "";

  if (mode === "replace") {
    state.books = state.pendingImport;
    message = "Estante substituída: " + plural(state.books.length, "livro", "livros") + ".";
  } else {
    const result = mergeBooks(state.pendingImport);
    state.books = result.books;
    message = "Estante importada: " + plural(result.added, "novo", "novos");
    if (result.updated > 0) {
      message += ", " + plural(result.updated, "atualizado", "atualizados");
    }
    message += ".";
  }

  state.pendingImport = null;
  importDialog.close();
  await saveImportedCovers();
  saveBooks();
  render();
  showToast(message, true);
}

export async function importFromLink() {
  if (!location.hash.startsWith(IMPORT_PREFIX)) {
    return;
  }
  const code = location.hash.slice(IMPORT_PREFIX.length);

  // limpa o endereco pra nao importar de novo se recarregar a pagina
  history.replaceState(null, "", location.pathname + location.search);

  try {
    const text = await decompress(base64ToBytes(code));
    askImport(readLibrary(text), "no link");
  } catch (error) {
    showToast("Este link de estante está incompleto ou corrompido.");
  }
}

export async function importFromFile(file) {
  try {
    const text = await file.text();
    askImport(readLibrary(text), "no arquivo");
  } catch (error) {
    showToast("Este arquivo não é um state.backup válido do PageLog.");
  }
  importFile.value = ""; // pra conseguir escolher o mesmo arquivo de novo
}
