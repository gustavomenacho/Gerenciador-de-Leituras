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

// capas enviadas do aparelho ficam no IndexedDB (cabe muito mais que no localStorage)
const DB_NAME = "pagelog";
const COVER_STORE = "capas";
const COVER_MAX_WIDTH = 400;
const COVER_MAX_HEIGHT = 600;
const MAX_COVER_FILE = 15 * 1024 * 1024; // 15 MB (antes de reduzir)
const DEFAULT_IMAGE_HINT = "Sem capa? O PageLog cria uma para você.";

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
let coverUrls = {}; // id do livro -> endereco temporario da capa salva no IndexedDB
let newCover = null; // capa escolhida no formulario (ainda nao salva)
let removeCover = false; // true quando clicou em "Remover" no formulario

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
const chooseCoverBtn = document.getElementById("chooseCoverBtn");
const removeCoverBtn = document.getElementById("removeCoverBtn");
const coverFile = document.getElementById("coverFile");
const coverPreviewImg = document.getElementById("coverPreviewImg");

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
    localCover: raw.localCover === true, // true = tem capa salva no IndexedDB
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

// ---------- capas do aparelho (IndexedDB) ----------
// o localStorage so guarda texto e tem limite de uns 5 MB,
// entao as imagens ficam no IndexedDB, com o id do livro como chave

function openDatabase() {
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
async function useCoverStore(mode, action) {
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
function setCoverUrl(id, blob) {
  if (coverUrls[id]) {
    URL.revokeObjectURL(coverUrls[id]);
  }
  coverUrls[id] = URL.createObjectURL(blob);
}

async function saveCover(id, blob) {
  await useCoverStore("readwrite", function (store) {
    store.put(blob, id);
  });
  setCoverUrl(id, blob);
}

async function deleteCover(id) {
  await useCoverStore("readwrite", function (store) {
    store.delete(id);
  });
  if (coverUrls[id]) {
    URL.revokeObjectURL(coverUrls[id]);
    delete coverUrls[id];
  }
}

async function getCover(id) {
  return useCoverStore("readonly", function (store, done) {
    const request = store.get(id);
    request.onsuccess = function () {
      done(request.result);
    };
  });
}

// carrega todas as capas quando a pagina abre
// e apaga as que sobraram de livros que nao existem mais
async function loadCovers() {
  const ids = books.map(function (book) {
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
function resizeImage(file) {
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
function blobToDataUrl(blob) {
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

async function dataUrlToBlob(dataUrl) {
  const response = await fetch(dataUrl);
  return response.blob();
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

// qual imagem usar: primeiro a do aparelho, depois o link
function getBookImage(book) {
  if (book.localCover && coverUrls[book.id]) {
    return coverUrls[book.id];
  }
  if (book.image && isValidImageUrl(book.image)) {
    return book.image;
  }
  return "";
}

function createCover(book) {
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

// ---------- capa no formulario ----------

let previewUrl = null; // endereco temporario da imagem escolhida (pra mostrar a previa)

function getEditingBook() {
  return books.find(function (book) {
    return book.id === editingId;
  });
}

// mostra a previa: imagem nova escolhida > capa salva do livro > link digitado
function updateCoverPreview() {
  let src = "";
  const book = getEditingBook();
  const link = imageInput.value.trim();

  if (newCover) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(newCover);
    src = previewUrl;
  } else if (book && book.localCover && !removeCover && coverUrls[book.id]) {
    src = coverUrls[book.id];
  } else if (link && isValidImageUrl(link)) {
    src = link;
  }

  if (src) {
    coverPreviewImg.src = src;
    coverPreviewImg.hidden = false;
  } else {
    coverPreviewImg.removeAttribute("src");
    coverPreviewImg.hidden = true;
  }
  removeCoverBtn.hidden = !src;
}

async function handleCoverFile(file) {
  coverFile.value = ""; // pra conseguir escolher o mesmo arquivo de novo

  if (!file.type.startsWith("image/")) {
    imageHint.textContent = "Esse arquivo não é uma imagem.";
    return;
  }
  if (file.size > MAX_COVER_FILE) {
    imageHint.textContent = "Imagem muito grande (máximo 15 MB).";
    return;
  }

  imageHint.textContent = "Preparando a imagem...";
  try {
    newCover = await resizeImage(file);
    removeCover = false;
    imageInput.value = ""; // a imagem do aparelho substitui o link
    imageInput.removeAttribute("aria-invalid");
    imageHint.textContent = "Imagem pronta (" + Math.round(newCover.size / 1024) + " KB). Ela será salva ao confirmar.";
  } catch (error) {
    newCover = null;
    imageHint.textContent = "Não foi possível abrir essa imagem. Tente outra (JPG ou PNG).";
  }
  updateCoverPreview();
}

function clearCover() {
  newCover = null;
  removeCover = true;
  imageInput.value = "";
  imageHint.textContent = DEFAULT_IMAGE_HINT;
  updateCoverPreview();
  chooseCoverBtn.focus();
}

function openBookDialog(book) {
  form.reset();
  showError(titleInput, false);
  showError(authorInput, false);
  imageInput.removeAttribute("aria-invalid");
  imageHint.textContent = DEFAULT_IMAGE_HINT;
  newCover = null;
  removeCover = false;

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
  updateCoverPreview();
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
  }

  if (firstError) {
    firstError.focus();
    return false;
  }
  return true;
}

async function handleSubmit(event) {
  event.preventDefault();
  if (!validateForm()) {
    return;
  }

  const now = Date.now();
  const oldBook = getEditingBook();
  const data = {
    id: editingId || createId(),
    title: titleInput.value,
    author: authorInput.value,
    image: imageInput.value,
    status: statusInput.value,
    rating: Number(form.elements.rating.value),
    comment: commentInput.value,
    localCover: oldBook ? oldBook.localCover : false,
    createdAt: oldBook ? oldBook.createdAt : now,
    updatedAt: now
  };

  // salva ou apaga a capa do aparelho
  let coverError = false;
  submitBtn.disabled = true;
  try {
    if (newCover) {
      await saveCover(data.id, newCover);
      data.localCover = true;
      data.image = "";
    } else if (removeCover || data.image.trim() !== "") {
      // removeu a capa, ou trocou por um link
      if (data.localCover) {
        await deleteCover(data.id);
      }
      data.localCover = false;
    }
  } catch (error) {
    coverError = true;
  }
  submitBtn.disabled = false;

  if (oldBook) {
    const index = books.indexOf(oldBook);
    books[index] = normalizeBook(data);
    showToast("Alterações salvas.");
  } else {
    books.push(normalizeBook(data));
    showToast('"' + data.title.trim() + '" entrou na estante.');
  }

  if (coverError) {
    showToast("Não foi possível salvar a imagem neste navegador. O livro foi salvo sem ela.");
  }

  newCover = null;
  removeCover = false;
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

// dados pro link: sem as capas do aparelho (o link ficaria enorme)
function getExportData() {
  const list = books.map(function (book) {
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
async function getExportDataWithCovers() {
  const data = getExportData();
  data.capas = {};
  for (const book of books) {
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
function readLibrary(text) {
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

async function downloadFile() {
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

// salva no IndexedDB as capas que vieram no arquivo
async function saveImportedCovers() {
  for (const book of books) {
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

async function confirmImport(mode) {
  if (!pendingImport) {
    return;
  }

  saveBackup("Importação desfeita: a estante voltou a ser como antes.");
  let message = "";

  if (mode === "replace") {
    books = pendingImport;
    message = "Estante substituída: " + plural(books.length, "livro", "livros") + ".";
  } else {
    const result = mergeBooks(pendingImport);
    books = result.books;
    message = "Estante importada: " + plural(result.added, "novo", "novos");
    if (result.updated > 0) {
      message += ", " + plural(result.updated, "atualizado", "atualizados");
    }
    message += ".";
  }

  pendingImport = null;
  importDialog.close();
  await saveImportedCovers();
  saveBooks();
  render();
  showToast(message, true);
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

// capa: escolher imagem do aparelho, remover, ou digitar um link
chooseCoverBtn.addEventListener("click", function () {
  coverFile.click();
});
coverFile.addEventListener("change", function () {
  if (coverFile.files.length > 0) {
    handleCoverFile(coverFile.files[0]);
  }
});
removeCoverBtn.addEventListener("click", clearCover);
imageInput.addEventListener("input", function () {
  // digitou um link: ele passa a valer no lugar da imagem do aparelho
  // (se apagar o link de novo, a imagem salva volta)
  const hasLink = imageInput.value.trim() !== "";
  if (hasLink) {
    newCover = null;
  }
  removeCover = hasLink;
  updateCoverPreview();
});

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

// as capas do IndexedDB carregam depois (e assincrono), ai desenha de novo
loadCovers()
  .then(render)
  .catch(function () {
    // sem IndexedDB (ex.: alguns modos anonimos): os livros aparecem com a capa gerada
  });
