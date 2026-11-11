import { STATUS_LIST } from "./constantes.js";
import { state } from "./estado.js";
import { emptyLibrary, emptySearch, grid, resultCount, searchInput, sortSelect, statButtons, statusFilter } from "./elementos.js";
import { createElement, createIcon, getCoverColor, isValidImageUrl, normalizeText, plural } from "./utils.js";
import { formatDate } from "./dados.js";
import { renderGoal } from "./meta.js";

// ---------- tela ----------

export function getVisibleBooks() {
  const search = normalizeText(searchInput.value.trim());
  const status = statusFilter.value;

  const result = state.books.filter(function (book) {
    const foundText =
      normalizeText(book.title).includes(search) ||
      normalizeText(book.author).includes(search);
    const foundStatus = status === "all" || book.status === status;
    return foundText && foundStatus;
  });

  const order = sortSelect.value;
  result.sort(function (a, b) {
    if (order === "title") {
      return a.title.localeCompare(b.title, "pt-BR");
    }
    if (order === "author") {
      return a.author.localeCompare(b.author, "pt-BR");
    }
    if (order === "rating") {
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return a.title.localeCompare(b.title, "pt-BR");
    }
    // padrao: mais recentes primeiro
    return b.createdAt - a.createdAt;
  });

  return result;
}

// capa gerada pra quando o livro nao tem imagem (ou a imagem nao carrega)
export function createGeneratedCover(book) {
  const cover = createElement("div", "cover-generated");
  cover.style.setProperty("--cover", getCoverColor(book.title + book.author));
  cover.setAttribute("aria-hidden", "true");
  cover.appendChild(createElement("span", "cover-title", book.title));
  cover.appendChild(createElement("span", "cover-rule"));
  cover.appendChild(createElement("span", "cover-author", book.author));
  return cover;
}

// qual imagem usar: primeiro a do aparelho, depois o link
export function getBookImage(book) {
  if (book.localCover && state.coverUrls[book.id]) {
    return state.coverUrls[book.id];
  }
  if (book.image && isValidImageUrl(book.image)) {
    return book.image;
  }
  return "";
}

export function createCover(book) {
  const cover = createElement("div", "book-cover");
  const image = getBookImage(book);

  if (image) {
    const img = document.createElement("img");
    img.src = image;
    img.alt = "Capa de " + book.title;
    img.loading = "lazy";
    img.onerror = function () {
      img.replaceWith(createGeneratedCover(book));
    };
    cover.appendChild(img);
  } else {
    cover.appendChild(createGeneratedCover(book));
  }

  // carimbo do status (a classe nao pode ter espaco: "Quero ler" vira "Quero-ler")
  const stampClass = "stamp stamp-" + book.status.replace(" ", "-");
  cover.appendChild(createElement("span", stampClass, book.status));
  return cover;
}

export function createRating(rating) {
  const stars = createElement("p", "book-rating");
  stars.setAttribute("aria-label", "Nota " + rating + " de 5");
  for (let i = 1; i <= 5; i++) {
    const star = createElement("span", i <= rating ? "" : "off", "★");
    star.setAttribute("aria-hidden", "true");
    stars.appendChild(star);
  }
  return stars;
}

// barra de progresso de quem esta lendo
function createProgress(book) {
  const percent = Math.round((book.pagesRead / book.pagesTotal) * 100);
  const wrapper = createElement("div", "book-progress");

  const bar = document.createElement("progress");
  bar.className = "progress";
  bar.max = book.pagesTotal;
  bar.value = book.pagesRead;
  bar.setAttribute("aria-label", "Progresso de " + book.title + ": " + percent + "%");

  const text = createElement(
    "span",
    "book-progress-text",
    book.pagesRead + " de " + book.pagesTotal + " páginas · " + percent + "%"
  );

  wrapper.appendChild(bar);
  wrapper.appendChild(text);
  return wrapper;
}

export function createCard(book) {
  const card = createElement("li", "book");
  card.dataset.id = book.id;

  const body = createElement("div", "book-body");
  body.appendChild(createElement("h3", "book-title", book.title));
  body.appendChild(createElement("p", "book-author", book.author));
  if (book.rating > 0) {
    body.appendChild(createRating(book.rating));
  }
  if (book.status === "Lendo" && book.pagesTotal > 0) {
    body.appendChild(createProgress(book));
  }
  if (book.status === "Lido" && book.finishedAt) {
    body.appendChild(createElement("p", "book-finished", "Lido em " + formatDate(book.finishedAt)));
  }
  if (book.comment) {
    body.appendChild(createElement("blockquote", "book-comment", book.comment));
  }

  const actions = createElement("div", "book-actions");

  const editBtn = document.createElement("button");
  editBtn.type = "button";
  editBtn.dataset.action = "edit";
  editBtn.setAttribute("aria-label", "Editar " + book.title);
  editBtn.appendChild(createIcon("edit"));
  editBtn.appendChild(document.createTextNode("Editar"));

  const deleteBtn = document.createElement("button");
  deleteBtn.type = "button";
  deleteBtn.dataset.action = "delete";
  deleteBtn.setAttribute("aria-label", "Excluir " + book.title);
  deleteBtn.appendChild(createIcon("trash"));
  deleteBtn.appendChild(document.createTextNode("Excluir"));

  actions.appendChild(editBtn);
  actions.appendChild(deleteBtn);

  card.appendChild(createCover(book));
  card.appendChild(body);
  card.appendChild(actions);
  return card;
}

export function updateStats() {
  document.querySelector('[data-count="all"]').textContent = state.books.length;

  STATUS_LIST.forEach(function (status) {
    const total = state.books.filter(function (book) {
      return book.status === status;
    }).length;
    document.querySelector('[data-count="' + status + '"]').textContent = total;
  });

  // marca a ficha que esta filtrando
  statButtons.forEach(function (button) {
    const active = button.dataset.status === statusFilter.value;
    button.setAttribute("aria-pressed", String(active));
  });
}

// desenha a tela toda de novo a partir do array state.books
export function render() {
  const visibleBooks = getVisibleBooks();

  updateStats();
  renderGoal();

  grid.innerHTML = "";
  visibleBooks.forEach(function (book) {
    grid.appendChild(createCard(book));
  });

  const isEmpty = state.books.length === 0;
  emptyLibrary.hidden = !isEmpty;
  emptySearch.hidden = isEmpty || visibleBooks.length > 0;

  if (isEmpty) {
    resultCount.textContent = "";
  } else {
    resultCount.textContent = plural(visibleBooks.length, "livro", "livros");
  }
}
