/* =========================================================
   PAGELOG — lógica da estante
   Estrutura: constantes → estado → armazenamento → renderização
   → diálogo/formulário → eventos → início.
========================================================= */

/* ---------- Constantes ---------- */
const STORAGE_KEY = "minha-biblioteca"; // mesmo nome da versão 1, para não perder dados antigos
const STATUSES = ["Quero ler", "Lendo", "Lido"];
const COVER_COLORS = ["#2f4a3a", "#6e2a24", "#2b3a55", "#5a4632", "#3f3355", "#25504f"];
const UNDO_TIMEOUT = 6000;

const EXAMPLE_BOOKS = [
  { title: "Dom Casmurro", author: "Machado de Assis", status: "Lido", rating: 5, comment: "Capitu traiu ou não traiu? Releria só para decidir de novo." },
  { title: "Torto Arado", author: "Itamar Vieira Junior", status: "Lendo", rating: 0, comment: "" },
  { title: "O Hobbit", author: "J. R. R. Tolkien", status: "Lido", rating: 4, comment: "A melhor porta de entrada para a Terra-média." },
  { title: "Vidas Secas", author: "Graciliano Ramos", status: "Quero ler", rating: 0, comment: "" },
  { title: "Código Limpo", author: "Robert C. Martin", status: "Lendo", rating: 4, comment: "Nomes bons valem mais que comentários." },
];

/* ---------- Estado ---------- */
let books = [];
let editingId = null;      // null = criando; string = editando o livro com esse id
let lastRemoved = null;    // guarda o último livro removido para o "Desfazer"
let toastTimer = null;

/* ---------- Elementos ---------- */
const $ = (selector) => document.querySelector(selector);

const grid = $("#booksGrid");
const resultCount = $("#resultCount");
const emptyLibrary = $("#emptyLibrary");
const emptySearch = $("#emptySearch");
const statButtons = document.querySelectorAll(".stat");

const searchInput = $("#searchInput");
const statusFilter = $("#statusFilter");
const sortSelect = $("#sortSelect");

const dialog = $("#bookDialog");
const dialogTitle = $("#dialogTitle");
const form = $("#bookForm");
const submitBtn = $("#submitBtn");
const titleInput = $("#titleInput");
const authorInput = $("#authorInput");
const imageInput = $("#imageInput");
const statusInput = $("#statusInput");
const commentInput = $("#commentInput");
const commentCount = $("#commentCount");
const starLabels = document.querySelectorAll(".star-label");

const toast = $("#toast");
const toastText = $("#toastText");
const toastUndo = $("#toastUndo");

/* =========================================================
   ARMAZENAMENTO (localStorage)
========================================================= */
function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
}

// Garante que todo livro tenha o formato esperado (inclusive dados da versão antiga, sem id)
function normalizeBook(raw, index = 0) {
  return {
    id: raw.id || createId(),
    title: String(raw.title || "").trim(),
    author: String(raw.author || "").trim(),
    image: String(raw.image || "").trim(),
    status: STATUSES.includes(raw.status) ? raw.status : "Quero ler",
    rating: Math.min(5, Math.max(0, Number(raw.rating) || 0)),
    comment: String(raw.comment || "").trim(),
    createdAt: raw.createdAt || Date.now() - index, // mantém a ordem original dos antigos
  };
}

function loadBooks() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    books = Array.isArray(data) ? data.map(normalizeBook).filter((b) => b.title) : [];
  } catch {
    books = []; // dado corrompido ou storage bloqueado: começa vazio em vez de quebrar
  }
}

function saveBooks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch {
    showToast("Não foi possível salvar neste navegador.");
  }
}

/* =========================================================
   UTILITÁRIOS
========================================================= */
// Cria um elemento com classe e texto. Usar textContent (e não innerHTML)
// impede que um título como "<img onerror=...>" vire código executável.
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

// Mesma entrada → mesma cor, para cada livro ter sempre "a sua" capa
function coverColor(text) {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVER_COLORS[hash % COVER_COLORS.length];
}

// Comparação sem diferenciar acentos e maiúsculas ("memorias" encontra "Memórias")
function normalizeText(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function isSafeImageUrl(url) {
  try {
    return ["http:", "https:"].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/* =========================================================
   RENDERIZAÇÃO
========================================================= */
function getVisibleBooks() {
  const search = normalizeText(searchInput.value.trim());
  const status = statusFilter.value;

  const filtered = books.filter((book) => {
    const matchSearch =
      normalizeText(book.title).includes(search) || normalizeText(book.author).includes(search);
    const matchStatus = status === "all" || book.status === status;
    return matchSearch && matchStatus;
  });

  const byText = (key) => (a, b) => a[key].localeCompare(b[key], "pt-BR");
  const sorters = {
    recent: (a, b) => b.createdAt - a.createdAt,
    title: byText("title"),
    author: byText("author"),
    rating: (a, b) => b.rating - a.rating || byText("title")(a, b),
  };

  return filtered.sort(sorters[sortSelect.value]);
}

function buildCover(book) {
  const cover = el("div", "book-cover");

  const generated = el("div", "cover-generated");
  generated.style.setProperty("--cover", coverColor(book.title + book.author));
  generated.append(el("span", "cover-title", book.title), el("span", "cover-rule"), el("span", "cover-author", book.author));
  generated.setAttribute("aria-hidden", "true");

  if (book.image && isSafeImageUrl(book.image)) {
    const img = el("img");
    img.src = book.image;
    img.alt = `Capa de ${book.title}`;
    img.loading = "lazy";
    // Se a imagem não carregar, troca pela capa gerada
    img.addEventListener("error", () => img.replaceWith(generated), { once: true });
    cover.append(img);
  } else {
    cover.append(generated);
  }

  const stamp = el("span", `stamp stamp-${book.status.replace(/\s+/g, "-")}`, book.status);
  cover.append(stamp);
  return cover;
}

function buildRating(rating) {
  const wrapper = el("p", "book-rating");
  wrapper.setAttribute("aria-label", `Nota ${rating} de 5`);
  for (let i = 1; i <= 5; i++) {
    const star = el("span", i <= rating ? "" : "off", "★");
    star.setAttribute("aria-hidden", "true");
    wrapper.append(star);
  }
  return wrapper;
}

function buildCard(book) {
  const item = el("li", "book");
  item.dataset.id = book.id;

  const body = el("div", "book-body");
  body.append(el("h3", "book-title", book.title), el("p", "book-author", book.author));
  if (book.rating > 0) body.append(buildRating(book.rating));
  if (book.comment) body.append(el("blockquote", "book-comment", book.comment));

  const actions = el("div", "book-actions");
  const editBtn = el("button");
  editBtn.type = "button";
  editBtn.dataset.action = "edit";
  editBtn.setAttribute("aria-label", `Editar ${book.title}`);
  editBtn.append(icon("edit"), document.createTextNode("Editar"));

  const deleteBtn = el("button");
  deleteBtn.type = "button";
  deleteBtn.dataset.action = "delete";
  deleteBtn.setAttribute("aria-label", `Excluir ${book.title}`);
  deleteBtn.append(icon("trash"), document.createTextNode("Excluir"));

  actions.append(editBtn, deleteBtn);
  item.append(buildCover(book), body, actions);
  return item;
}

function updateStats() {
  document.querySelector('[data-count="all"]').textContent = books.length;
  STATUSES.forEach((status) => {
    document.querySelector(`[data-count="${status}"]`).textContent =
      books.filter((book) => book.status === status).length;
  });
  statButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.status === statusFilter.value));
  });
}

// Única função que desenha a tela: sempre parte do estado atual
function render() {
  const visible = getVisibleBooks();

  updateStats(); // sempre atualiza, haja ou não resultados

  grid.replaceChildren(...visible.map(buildCard));

  const libraryIsEmpty = books.length === 0;
  emptyLibrary.hidden = !libraryIsEmpty;
  emptySearch.hidden = libraryIsEmpty || visible.length > 0;

  resultCount.textContent = libraryIsEmpty
    ? ""
    : `${visible.length} ${visible.length === 1 ? "livro" : "livros"}`;
}

/* =========================================================
   DIÁLOGO E FORMULÁRIO
========================================================= */
function setRating(value) {
  form.elements.rating.value = String(value);
  paintStars(value);
}

function paintStars(value) {
  starLabels.forEach((label, index) => label.classList.toggle("is-on", index < value));
}

function updateCommentCount() {
  commentCount.textContent = `${commentInput.value.length}/${commentInput.maxLength}`;
}

function clearErrors() {
  [titleInput, authorInput].forEach((input) => {
    input.removeAttribute("aria-invalid");
    document.getElementById(input.getAttribute("aria-describedby")).hidden = true;
  });
}

function openDialog(book = null) {
  form.reset();
  clearErrors();
  editingId = book ? book.id : null;

  dialogTitle.textContent = book ? "Editar livro" : "Novo livro";
  submitBtn.textContent = book ? "Salvar alterações" : "Adicionar à estante";

  if (book) {
    titleInput.value = book.title;
    authorInput.value = book.author;
    imageInput.value = book.image;
    statusInput.value = book.status;
    commentInput.value = book.comment;
  }

  setRating(book ? book.rating : 0);
  updateCommentCount();
  dialog.showModal();
  titleInput.focus();
}

function closeDialog() {
  dialog.close();
}

// Valida os campos obrigatórios e mostra a mensagem logo abaixo de cada um
function validate() {
  clearErrors();
  const invalid = [titleInput, authorInput].filter((input) => !input.value.trim());
  invalid.forEach((input) => {
    input.setAttribute("aria-invalid", "true");
    document.getElementById(input.getAttribute("aria-describedby")).hidden = false;
  });

  if (imageInput.value.trim() && !isSafeImageUrl(imageInput.value.trim())) {
    imageInput.setAttribute("aria-invalid", "true");
    $("#imageHint").textContent = "Use um endereço que comece com http:// ou https://";
    invalid.push(imageInput);
  } else {
    imageInput.removeAttribute("aria-invalid");
    $("#imageHint").textContent = "Sem capa? O PageLog cria uma para você.";
  }

  if (invalid.length) invalid[0].focus();
  return invalid.length === 0;
}

function handleSubmit(event) {
  event.preventDefault();
  if (!validate()) return;

  const data = {
    title: titleInput.value,
    author: authorInput.value,
    image: imageInput.value,
    status: statusInput.value,
    rating: Number(form.elements.rating.value),
    comment: commentInput.value,
  };

  if (editingId) {
    books = books.map((book) => (book.id === editingId ? normalizeBook({ ...book, ...data }) : book));
    showToast("Alterações salvas.");
  } else {
    books.push(normalizeBook({ ...data, createdAt: Date.now() }));
    showToast(`“${data.title.trim()}” entrou na estante.`);
  }

  saveBooks();
  closeDialog();
  render();
}

/* =========================================================
   AÇÕES: excluir com "Desfazer", exemplos, filtros
========================================================= */
function removeBook(id) {
  const index = books.findIndex((book) => book.id === id);
  if (index === -1) return;

  lastRemoved = { book: books[index], index };
  books.splice(index, 1);
  saveBooks();
  render();
  showToast(`“${lastRemoved.book.title}” saiu da estante.`, true);
  $("#estante").focus(); // o botão clicado sumiu: leva o foco para um lugar previsível
}

function undoRemove() {
  if (!lastRemoved) return;
  books.splice(lastRemoved.index, 0, lastRemoved.book);
  lastRemoved = null;
  saveBooks();
  render();
  showToast("Livro devolvido à estante.");
}

function loadExamples() {
  const now = Date.now();
  books = EXAMPLE_BOOKS.map((book, i) => normalizeBook({ ...book, createdAt: now - i }));
  saveBooks();
  render();
  showToast("Exemplos carregados. Fique à vontade para editar ou excluir.");
}

function clearFilters() {
  searchInput.value = "";
  statusFilter.value = "all";
  render();
  searchInput.focus();
}

function showToast(message, withUndo = false) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toastUndo.hidden = !withUndo;
  toast.hidden = false;
  toastTimer = setTimeout(() => {
    toast.hidden = true;
    lastRemoved = null;
  }, withUndo ? UNDO_TIMEOUT : 3000);
}

/* =========================================================
   EVENTOS
========================================================= */
$("#openModalBtn").addEventListener("click", () => openDialog());

// Delegação: um único ouvinte na grade atende todos os cards
grid.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const id = button.closest(".book").dataset.id;

  if (button.dataset.action === "edit") openDialog(books.find((book) => book.id === id));
  if (button.dataset.action === "delete") removeBook(id);
});

document.addEventListener("click", (event) => {
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "add") openDialog();
  if (action === "examples") loadExamples();
  if (action === "clear-filters") clearFilters();
});

// Fichas de resumo funcionam como atalho do filtro de status
statButtons.forEach((button) => {
  button.addEventListener("click", () => {
    statusFilter.value = button.dataset.status;
    render();
  });
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
sortSelect.addEventListener("change", render);

form.addEventListener("submit", handleSubmit);
form.addEventListener("change", (event) => {
  if (event.target.name === "rating") paintStars(Number(event.target.value));
});
commentInput.addEventListener("input", updateCommentCount);

// Prévia ao passar o mouse sobre as estrelas
starLabels.forEach((label, index) => {
  label.addEventListener("mouseenter", () => paintStars(index + 1));
  label.addEventListener("mouseleave", () => paintStars(Number(form.elements.rating.value)));
});

dialog.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", closeDialog));

// Clique no fundo escuro (fora da caixa) também fecha
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) closeDialog();
});

toastUndo.addEventListener("click", () => {
  clearTimeout(toastTimer);
  undoRemove();
});

/* ---------- Início ---------- */
loadBooks();
render();
