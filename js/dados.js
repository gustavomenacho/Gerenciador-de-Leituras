import { MAX_PAGES, STATUS_LIST, STORAGE_KEY } from "./constantes.js";
import { state } from "./estado.js";
import { cleanText, createId } from "./utils.js";
import { showToast } from "./acoes.js";

// ---------- dados ----------

// arruma o livro pro formato certo
// serve pros dados antigos (sem id), pro formulario e pro que vem de importacao
export function normalizeBook(raw, index) {
  if (!index) {
    index = 0;
  }

  let createdAt = Number(raw.createdAt);
  if (!createdAt) {
    createdAt = Date.now() - index;
  }

  let updatedAt = Number(raw.updatedAt);
  if (!updatedAt) {
    updatedAt = createdAt;
  }

  // id so pode ter letras, numeros, _ e -
  // (tem que checar se e string, senao o test() transforma undefined em "undefined")
  let id = raw.id;
  if (typeof id !== "string" || !/^[\w-]{1,64}$/.test(id)) {
    id = createId();
  }

  let status = raw.status;
  if (!STATUS_LIST.includes(status)) {
    status = "Quero ler";
  }

  let rating = Math.round(Number(raw.rating) || 0);
  if (rating < 0) rating = 0;
  if (rating > 5) rating = 5;

  // paginas: numero inteiro entre 0 e MAX_PAGES
  let pagesTotal = toPages(raw.pagesTotal);
  let pagesRead = toPages(raw.pagesRead);
  if (pagesTotal > 0 && pagesRead > pagesTotal) {
    pagesRead = pagesTotal;
  }

  // data em que terminou (so pra quem esta "Lido"), no formato 2026-11-10
  let finishedAt = "";
  if (status === "Lido" && /^\d{4}-\d{2}-\d{2}$/.test(raw.finishedAt)) {
    finishedAt = raw.finishedAt;
  }

  return {
    id: id,
    title: cleanText(raw.title, 120),
    author: cleanText(raw.author, 80),
    image: cleanText(raw.image, 2048),
    status: status,
    rating: rating,
    comment: cleanText(raw.comment, 280),
    localCover: raw.localCover === true, // true = tem capa salva no IndexedDB
    pagesRead: pagesRead,
    pagesTotal: pagesTotal,
    finishedAt: finishedAt,
    createdAt: createdAt,
    updatedAt: updatedAt
  };
}

function toPages(value) {
  let pages = Math.round(Number(value) || 0);
  if (pages < 0) pages = 0;
  if (pages > MAX_PAGES) pages = MAX_PAGES;
  return pages;
}

// data de hoje no formato do <input type="date"> (2026-11-10)
// (nao uso toISOString porque ele converte pro fuso de Londres e pode dar o dia errado)
export function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return now.getFullYear() + "-" + month + "-" + day;
}

// 2026-11-10 -> 10/11/2026
export function formatDate(date) {
  const parts = date.split("-");
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

export function loadBooks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      state.books = saved.map(normalizeBook).filter(function (book) {
        return book.title !== "";
      });
    } else {
      state.books = [];
    }
  } catch (error) {
    // se o dado estiver corrompido comeca vazio em vez de quebrar a pagina
    state.books = [];
  }
}

export function saveBooks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.books));
  } catch (error) {
    showToast("Não foi possível salvar neste navegador.");
  }
}
