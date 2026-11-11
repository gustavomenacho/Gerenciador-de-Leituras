import { EXAMPLE_BOOKS, UNDO_TIME } from "./constantes.js";
import { state } from "./estado.js";
import { searchInput, statusFilter, toast, toastText, toastUndo } from "./elementos.js";
import { normalizeBook, saveBooks, today } from "./dados.js";
import { render } from "./tela.js";

// ---------- acoes ----------

// guarda como a estante estava antes de excluir ou importar
export function saveBackup(undoMessage) {
  state.backup = { books: state.books.slice(), message: undoMessage };
}

export function undo() {
  if (!state.backup) {
    return;
  }
  state.books = state.backup.books;
  const message = state.backup.message;
  state.backup = null;
  saveBooks();
  render();
  showToast(message);
}

export function removeBook(id) {
  const book = state.books.find(function (item) {
    return item.id === id;
  });
  if (!book) {
    return;
  }

  saveBackup("Livro devolvido à estante.");
  state.books = state.books.filter(function (item) {
    return item.id !== id;
  });
  saveBooks();
  render();
  showToast('"' + book.title + '" saiu da estante.', true);

  // o botao clicado sumiu, entao mando o foco pro titulo da estante
  document.getElementById("estante").focus();
}

export function loadExamples() {
  const now = Date.now();
  state.books = EXAMPLE_BOOKS.map(function (book, i) {
    const copy = Object.assign({}, book);
    copy.createdAt = now - i;
    if (copy.status === "Lido") {
      copy.finishedAt = today();
      copy.pagesRead = copy.pagesTotal;
    }
    return normalizeBook(copy);
  });
  saveBooks();
  render();
  showToast("Exemplos carregados. Fique à vontade para editar ou excluir.");
}

export function clearFilters() {
  searchInput.value = "";
  statusFilter.value = "all";
  render();
  searchInput.focus();
}

export function showToast(message, withUndo) {
  clearTimeout(state.toastTimer);
  toastText.textContent = message;
  toastUndo.hidden = !withUndo;
  toast.hidden = false;

  let time = 3000;
  if (withUndo) {
    time = UNDO_TIME;
  }

  state.toastTimer = setTimeout(function () {
    toast.hidden = true;
    if (withUndo) {
      state.backup = null;
    }
  }, time);
}
