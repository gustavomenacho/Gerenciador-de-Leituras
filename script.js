// PageLog - gerenciador de leituras
// Gustavo Menacho

// ---------- constantes ----------

// mantive o nome da chave da primeira versao pra nao perder os livros salvos
const STORAGE_KEY = "minha-biblioteca";
const THEME_KEY = "pagelog-tema";
const STATUS_LIST = ["Quero ler", "Lendo", "Lido"];
const COVER_COLORS = ["#2f4a3a", "#6e2a24", "#2b3a55", "#5a4632", "#3f3355", "#25504f"];
const UNDO_TIME = 6000;
const IMPORT_PREFIX = "#importar=";
const MAX_IMPORT = 2000;
const LONG_LINK = 30000;

const EXAMPLE_BOOKS = [
  { title: "Dom Casmurro", author: "Machado de Assis", status: "Lido", rating: 5, comment: "Capitu traiu ou não traiu? Releria só para decidir de novo." },
  { title: "Torto Arado", author: "Itamar Vieira Junior", status: "Lendo", rating: 0, comment: "" },
  { title: "O Hobbit", author: "J. R. R. Tolkien", status: "Lido", rating: 4, comment: "A melhor porta de entrada para a Terra-média." },
  { title: "Vidas Secas", author: "Graciliano Ramos", status: "Quero ler", rating: 0, comment: "" },
  { title: "Código Limpo", author: "Robert C. Martin", status: "Lendo", rating: 4, comment: "Nomes bons valem mais que comentários." }
];

// ---------- estado ----------

let books = [];
let editingId = null; // null quando esta criando um livro novo
let backup = null; // copia da estante pro botao "Desfazer"
let toastTimer = null;
let pendingImport = null; // livros esperando confirmacao de importacao

// ---------- elementos ----------

const grid = document.getElementById("booksGrid");
const resultCount = document.getElementById("resultCount");
const emptyLibrary = document.getElementById("emptyLibrary");
const emptySearch = document.getElementById("emptySearch");
const statButtons = document.querySelectorAll(".stat");

const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");

const bookDialog = document.getElementById("bookDialog");
const dialogTitle = document.getElementById("dialogTitle");
const form = document.getElementById("bookForm");
const submitBtn = document.getElementById("submitBtn");
const titleInput = document.getElementById("titleInput");
const authorInput = document.getElementById("authorInput");
const imageInput = document.getElementById("imageInput");
const imageHint = document.getElementById("imageHint");
const statusInput = document.getElementById("statusInput");
const commentInput = document.getElementById("commentInput");
const commentCount = document.getElementById("commentCount");
const starLabels = document.querySelectorAll(".star-label");

const toast = document.getElementById("toast");
const toastText = document.getElementById("toastText");
const toastUndo = document.getElementById("toastUndo");

const themeToggle = document.getElementById("themeToggle");

const transferDialog = document.getElementById("transferDialog");
const shareLinkBtn = document.getElementById("shareLinkBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const downloadBtn = document.getElementById("downloadBtn");
const transferLink = document.getElementById("transferLink");
const linkStatus = document.getElementById("linkStatus");

const importDialog = document.getElementById("importDialog");
const importSummary = document.getElementById("importSummary");
const importHint = document.getElementById("importHint");
const importMergeBtn = document.getElementById("importMergeBtn");
const importReplaceBtn = document.getElementById("importReplaceBtn");
const importFile = document.getElementById("importFile");

// ---------- funcoes auxiliares ----------

function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

// tira espacos e corta o texto no tamanho maximo
function cleanText(value, max) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim().slice(0, max);
}

// deixa tudo minusculo e sem acento, pra busca achar "memorias" em "Memórias"
function normalizeText(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// so aceito imagem com http ou https (bloqueia coisas tipo "javascript:")
function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

// escolhe sempre a mesma cor de capa pro mesmo livro
// (transforma o texto num numero e usa o resto da divisao pra escolher a cor)
function getCoverColor(text) {
  let number = 0;
  for (let i = 0; i < text.length; i++) {
    number = (number * 31 + text.charCodeAt(i)) % 1000000;
  }
  return COVER_COLORS[number % COVER_COLORS.length];
}

function plural(count, singular, pluralWord) {
  if (count === 1) {
    return count + " " + singular;
  }
  return count + " " + pluralWord;
}

// cria um elemento ja com classe e texto
// uso textContent em vez de innerHTML pra ninguem conseguir injetar html pelo titulo
function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#icon-" + name);
  svg.appendChild(use);
  return svg;
}

// ---------- dados ----------

// arruma o livro pro formato certo
// serve pros dados antigos (sem id), pro formulario e pro que vem de importacao
function normalizeBook(raw, index) {
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
    createdAt: createdAt,
    updatedAt: updatedAt
  };
}

function loadBooks() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (Array.isArray(saved)) {
      books = saved.map(normalizeBook).filter(function (book) {
        return book.title !== "";
      });
    } else {
      books = [];
    }
  } catch (error) {
    // se o dado estiver corrompido comeca vazio em vez de quebrar a pagina
    books = [];
  }
}

function saveBooks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
  } catch (error) {
    showToast("Não foi possível salvar neste navegador.");
  }
}

// ---------- tela ----------

function getVisibleBooks() {
  const search = normalizeText(searchInput.value.trim());
  const status = statusFilter.value;

  const result = books.filter(function (book) {
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
function createGeneratedCover(book) {
  const cover = createElement("div", "cover-generated");
  cover.style.setProperty("--cover", getCoverColor(book.title + book.author));
  cover.setAttribute("aria-hidden", "true");
  cover.appendChild(createElement("span", "cover-title", book.title));
  cover.appendChild(createElement("span", "cover-rule"));
  cover.appendChild(createElement("span", "cover-author", book.author));
  return cover;
}

function createCover(book) {
  const cover = createElement("div", "book-cover");

  if (book.image && isValidImageUrl(book.image)) {
    const img = document.createElement("img");
    img.src = book.image;
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

function createRating(rating) {
  const stars = createElement("p", "book-rating");
  stars.setAttribute("aria-label", "Nota " + rating + " de 5");
  for (let i = 1; i <= 5; i++) {
    const star = createElement("span", i <= rating ? "" : "off", "★");
    star.setAttribute("aria-hidden", "true");
    stars.appendChild(star);
  }
  return stars;
}

function createCard(book) {
  const card = createElement("li", "book");
  card.dataset.id = book.id;

  const body = createElement("div", "book-body");
  body.appendChild(createElement("h3", "book-title", book.title));
  body.appendChild(createElement("p", "book-author", book.author));
  if (book.rating > 0) {
    body.appendChild(createRating(book.rating));
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

function updateStats() {
  document.querySelector('[data-count="all"]').textContent = books.length;

  STATUS_LIST.forEach(function (status) {
    const total = books.filter(function (book) {
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

// desenha a tela toda de novo a partir do array books
function render() {
  const visibleBooks = getVisibleBooks();

  updateStats();

  grid.innerHTML = "";
  visibleBooks.forEach(function (book) {
    grid.appendChild(createCard(book));
  });

  const isEmpty = books.length === 0;
  emptyLibrary.hidden = !isEmpty;
  emptySearch.hidden = isEmpty || visibleBooks.length > 0;

  if (isEmpty) {
    resultCount.textContent = "";
  } else {
    resultCount.textContent = plural(visibleBooks.length, "livro", "livros");
  }
}

// ---------- formulario ----------

function paintStars(value) {
  starLabels.forEach(function (label, index) {
    label.classList.toggle("is-on", index < value);
  });
}

function setRating(value) {
  form.elements.rating.value = String(value);
  paintStars(value);
}

function updateCommentCount() {
  commentCount.textContent = commentInput.value.length + "/" + commentInput.maxLength;
}

function showError(input, show) {
  const message = document.getElementById(input.getAttribute("aria-describedby"));
  message.hidden = !show;
  if (show) {
    input.setAttribute("aria-invalid", "true");
  } else {
    input.removeAttribute("aria-invalid");
  }
}

function openBookDialog(book) {
  form.reset();
  showError(titleInput, false);
  showError(authorInput, false);
  imageInput.removeAttribute("aria-invalid");
  imageHint.textContent = "Sem capa? O PageLog cria uma para você.";

  if (book) {
    editingId = book.id;
    dialogTitle.textContent = "Editar livro";
    submitBtn.textContent = "Salvar alterações";
    titleInput.value = book.title;
    authorInput.value = book.author;
    imageInput.value = book.image;
    statusInput.value = book.status;
    commentInput.value = book.comment;
    setRating(book.rating);
  } else {
    editingId = null;
    dialogTitle.textContent = "Novo livro";
    submitBtn.textContent = "Adicionar à estante";
    setRating(0);
  }

  updateCommentCount();
  bookDialog.showModal();
  titleInput.focus();
}

function validateForm() {
  let firstError = null;

  const titleEmpty = titleInput.value.trim() === "";
  showError(titleInput, titleEmpty);
  if (titleEmpty) firstError = titleInput;

  const authorEmpty = authorInput.value.trim() === "";
  showError(authorInput, authorEmpty);
  if (authorEmpty && !firstError) firstError = authorInput;

  const image = imageInput.value.trim();
  if (image !== "" && !isValidImageUrl(image)) {
    imageInput.setAttribute("aria-invalid", "true");
    imageHint.textContent = "Use um endereço que comece com http:// ou https://";
    if (!firstError) firstError = imageInput;
  } else {
    imageInput.removeAttribute("aria-invalid");
    imageHint.textContent = "Sem capa? O PageLog cria uma para você.";
  }

  if (firstError) {
    firstError.focus();
    return false;
  }
  return true;
}

function handleSubmit(event) {
  event.preventDefault();
  if (!validateForm()) {
    return;
  }

  const now = Date.now();
  const data = {
    title: titleInput.value,
    author: authorInput.value,
    image: imageInput.value,
    status: statusInput.value,
    rating: Number(form.elements.rating.value),
    comment: commentInput.value
  };

  if (editingId) {
    const index = books.findIndex(function (book) {
      return book.id === editingId;
    });
    data.id = editingId;
    data.createdAt = books[index].createdAt;
    data.updatedAt = now;
    books[index] = normalizeBook(data);
    showToast("Alterações salvas.");
  } else {
    data.createdAt = now;
    data.updatedAt = now;
    books.push(normalizeBook(data));
    showToast('"' + data.title.trim() + '" entrou na estante.');
  }

  saveBooks();
  bookDialog.close();
  render();
}

// ---------- acoes ----------

// guarda como a estante estava antes de excluir ou importar
function saveBackup(undoMessage) {
  backup = { books: books.slice(), message: undoMessage };
}

function undo() {
  if (!backup) {
    return;
  }
  books = backup.books;
  const message = backup.message;
  backup = null;
  saveBooks();
  render();
  showToast(message);
}

function removeBook(id) {
  const book = books.find(function (item) {
    return item.id === id;
  });
  if (!book) {
    return;
  }

  saveBackup("Livro devolvido à estante.");
  books = books.filter(function (item) {
    return item.id !== id;
  });
  saveBooks();
  render();
  showToast('"' + book.title + '" saiu da estante.', true);

  // o botao clicado sumiu, entao mando o foco pro titulo da estante
  document.getElementById("estante").focus();
}

function loadExamples() {
  const now = Date.now();
  books = EXAMPLE_BOOKS.map(function (book, i) {
    const copy = Object.assign({}, book);
    copy.createdAt = now - i;
    return normalizeBook(copy);
  });
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

function showToast(message, withUndo) {
  clearTimeout(toastTimer);
  toastText.textContent = message;
  toastUndo.hidden = !withUndo;
  toast.hidden = false;

  let time = 3000;
  if (withUndo) {
    time = UNDO_TIME;
  }

  toastTimer = setTimeout(function () {
    toast.hidden = true;
    if (withUndo) {
      backup = null;
    }
  }, time);
}

// ---------- tema claro / escuro ----------
// o script no <head> ja aplica o tema antes da pagina aparecer (pra nao piscar)

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  const icon = themeToggle.querySelector("use");
  const themeColor = document.querySelector('meta[name="theme-color"]');

  if (isDark) {
    themeToggle.setAttribute("aria-label", "Ativar tema claro");
    icon.setAttribute("href", "#icon-sun");
    themeColor.setAttribute("content", "#181a1b");
  } else {
    themeToggle.setAttribute("aria-label", "Ativar tema escuro");
    icon.setAttribute("href", "#icon-moon");
    themeColor.setAttribute("content", "#f5efe3");
  }
}

function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
}

function toggleTheme() {
  let newTheme = "dark";
  if (document.documentElement.dataset.theme === "dark") {
    newTheme = "light";
  }
  applyTheme(newTheme);
  try {
    localStorage.setItem(THEME_KEY, newTheme);
  } catch (error) {
    // se nao der pra salvar, o tema so vale ate fechar a pagina
  }
}

// ---------- levar a estante pra outro aparelho ----------
// sem servidor: os livros vao no proprio link, depois do "#"
// (o que vem depois do # nao e enviado pro servidor, fica so no navegador)
// passos: livros -> JSON -> comprimido -> base64 -> link

// base64 normal tem + / = que atrapalham em link, por isso troco
function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToBytes(text) {
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
async function compress(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function decompress(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

function getExportData() {
  return {
    app: "pagelog",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    livros: books
  };
}

// le o JSON importado e passa cada livro pelo normalizeBook
// (nao da pra confiar no que vem de fora)
function readLibrary(text) {
  const data = JSON.parse(text);
  let list = data;
  if (!Array.isArray(data)) {
    list = data ? data.livros : null;
  }
  if (!Array.isArray(list)) {
    throw new Error("formato invalido");
  }

  return list
    .slice(0, MAX_IMPORT)
    .filter(function (item) {
      return item && typeof item === "object";
    })
    .map(normalizeBook)
    .filter(function (book) {
      return book.title !== "" && book.author !== "";
    });
}

async function createLink() {
  const compressed = await compress(JSON.stringify(getExportData()));
  const link = location.origin + location.pathname + IMPORT_PREFIX + bytesToBase64(compressed);
  transferLink.value = link;
  transferLink.hidden = false;
  return link;
}

function longLinkWarning(link) {
  if (link.length > LONG_LINK) {
    return " A estante é grande: se o link não abrir, use o arquivo.";
  }
  return "";
}

function openTransferDialog() {
  const isEmpty = books.length === 0;
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

async function copyLink() {
  const link = await createLink();
  try {
    await navigator.clipboard.writeText(link);
    linkStatus.textContent =
      "Link copiado com " + plural(books.length, "livro", "livros") +
      ". Cole no WhatsApp ou e-mail e abra no outro aparelho." + longLinkWarning(link);
  } catch (error) {
    // se o navegador nao deixar copiar, deixo o link selecionado pra copiar na mao
    transferLink.select();
    linkStatus.textContent =
      "Não foi possível copiar sozinho: o link está selecionado acima, copie manualmente." +
      longLinkWarning(link);
  }
}

async function shareLink() {
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

function downloadFile() {
  const json = JSON.stringify(getExportData(), null, 2);
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
  showToast("Arquivo de backup baixado.");
}

// ---------- importar (link ou arquivo) ----------

// o mesmo livro e reconhecido pelo id ou por titulo + autor
// (caso a pessoa tenha cadastrado na mao nos dois aparelhos)
function isSameBook(a, b) {
  if (a.id === b.id) {
    return true;
  }
  const sameTitle = normalizeText(a.title) === normalizeText(b.title);
  const sameAuthor = normalizeText(a.author) === normalizeText(b.author);
  return sameTitle && sameAuthor;
}

// junta sem duplicar: se o livro existe nos dois, fica o editado por ultimo
function mergeBooks(newBooks) {
  const result = books.slice();
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
      newBook.id = result[index].id;
      result[index] = newBook;
      updated++;
    }
  });

  return { books: result, added: added, updated: updated };
}

function askImport(newBooks, origin) {
  if (newBooks.length === 0) {
    showToast("Nenhum livro encontrado " + origin + ".");
    return;
  }

  pendingImport = newBooks;
  const found = "Encontramos " + plural(newBooks.length, "livro", "livros") + " " + origin + ".";

  if (books.length === 0) {
    importSummary.textContent = found + " Importar para esta estante?";
    importHint.hidden = true;
    importReplaceBtn.hidden = true;
    importMergeBtn.textContent = "Importar";
  } else {
    importSummary.textContent = found + " Esta estante já tem " + plural(books.length, "livro", "livros") + ".";
    importHint.hidden = false;
    importReplaceBtn.hidden = false;
    importMergeBtn.textContent = "Juntar";
  }

  if (transferDialog.open) {
    transferDialog.close();
  }
  importDialog.showModal();
}

function confirmImport(mode) {
  if (!pendingImport) {
    return;
  }

  saveBackup("Importação desfeita: a estante voltou a ser como antes.");

  if (mode === "replace") {
    books = pendingImport;
    showToast("Estante substituída: " + plural(books.length, "livro", "livros") + ".", true);
  } else {
    const result = mergeBooks(pendingImport);
    books = result.books;
    let message = "Estante importada: " + plural(result.added, "novo", "novos");
    if (result.updated > 0) {
      message += ", " + plural(result.updated, "atualizado", "atualizados");
    }
    showToast(message + ".", true);
  }

  pendingImport = null;
  saveBooks();
  render();
  importDialog.close();
}

async function importFromLink() {
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

async function importFromFile(file) {
  try {
    const text = await file.text();
    askImport(readLibrary(text), "no arquivo");
  } catch (error) {
    showToast("Este arquivo não é um backup válido do PageLog.");
  }
  importFile.value = ""; // pra conseguir escolher o mesmo arquivo de novo
}

// ---------- eventos ----------

document.getElementById("openModalBtn").addEventListener("click", function () {
  openBookDialog(null);
});

// um evento so na grade pra todos os botoes de editar/excluir
grid.addEventListener("click", function (event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }
  const id = button.closest(".book").dataset.id;

  if (button.dataset.action === "edit") {
    const book = books.find(function (item) {
      return item.id === id;
    });
    openBookDialog(book);
  }
  if (button.dataset.action === "delete") {
    removeBook(id);
  }
});

// botoes com data-action fora da grade (estante vazia, rodape...)
document.addEventListener("click", function (event) {
  const button = event.target.closest("[data-action]");
  if (!button) {
    return;
  }
  const action = button.dataset.action;

  if (action === "add") openBookDialog(null);
  if (action === "examples") loadExamples();
  if (action === "clear-filters") clearFilters();
  if (action === "transfer") openTransferDialog();
  if (action === "import-file") importFile.click();
});

// clicar numa ficha filtra pelo status dela
statButtons.forEach(function (button) {
  button.addEventListener("click", function () {
    statusFilter.value = button.dataset.status;
    render();
  });
});

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", render);
sortSelect.addEventListener("change", render);

form.addEventListener("submit", handleSubmit);
form.addEventListener("change", function (event) {
  if (event.target.name === "rating") {
    paintStars(Number(event.target.value));
  }
});
commentInput.addEventListener("input", updateCommentCount);

// mostra as estrelas acendendo quando passa o mouse
starLabels.forEach(function (label, index) {
  label.addEventListener("mouseenter", function () {
    paintStars(index + 1);
  });
  label.addEventListener("mouseleave", function () {
    paintStars(Number(form.elements.rating.value));
  });
});

// fechar qualquer janela: botoes com data-close ou clique no fundo escuro
document.querySelectorAll("dialog").forEach(function (dialog) {
  dialog.querySelectorAll("[data-close]").forEach(function (button) {
    button.addEventListener("click", function () {
      dialog.close();
    });
  });
  dialog.addEventListener("click", function (event) {
    if (event.target === dialog) {
      dialog.close();
    }
  });
});

toastUndo.addEventListener("click", function () {
  clearTimeout(toastTimer);
  undo();
});

themeToggle.addEventListener("click", toggleTheme);

// se a pessoa nunca escolheu um tema, acompanha o do sistema
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function (event) {
  if (!getSavedTheme()) {
    applyTheme(event.matches ? "dark" : "light");
  }
});

document.getElementById("openTransferBtn").addEventListener("click", openTransferDialog);
copyLinkBtn.addEventListener("click", copyLink);
shareLinkBtn.addEventListener("click", shareLink);
downloadBtn.addEventListener("click", downloadFile);

importFile.addEventListener("change", function () {
  if (importFile.files.length > 0) {
    importFromFile(importFile.files[0]);
  }
});
importMergeBtn.addEventListener("click", function () {
  confirmImport("merge");
});
importReplaceBtn.addEventListener("click", function () {
  confirmImport("replace");
});
importDialog.addEventListener("close", function () {
  pendingImport = null;
});

// caso o link seja colado numa aba que ja esta com o PageLog aberto
window.addEventListener("hashchange", importFromLink);

// ---------- inicio ----------

applyTheme(document.documentElement.dataset.theme || "light");
loadBooks();
render();
importFromLink();
