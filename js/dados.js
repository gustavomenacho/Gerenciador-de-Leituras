import { STATUS_LIST, STORAGE_KEY } from "./constantes.js";
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

  return {
    id: id,
    title: cleanText(raw.title, 120),
    author: cleanText(raw.author, 80),
    image: cleanText(raw.image, 2048),
    status: status,
    rating: rating,
    comment: cleanText(raw.comment, 280),
    localCover: raw.localCover === true, // true = tem capa salva no IndexedDB
    createdAt: createdAt,
    updatedAt: updatedAt
  };
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
