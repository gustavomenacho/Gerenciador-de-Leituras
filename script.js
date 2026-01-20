/* =========================
   STORAGE
========================= */
const STORAGE_KEY = "minha-biblioteca";

function saveBooks() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

function loadBooks() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (data) {
    books.length = 0;
    books.push(...JSON.parse(data));
  }
}

/* =========================
   ESTADO
========================= */
const books = [];
let ratingValue = 0;
let editingIndex = null;

/* =========================
   ELEMENTOS
========================= */
const grid = document.getElementById("booksGrid");
const stats = document.getElementById("stats");
const emptyMessage = document.getElementById("emptyMessage");
const modal = document.getElementById("modal");

// Filtros
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");

// Form
const bookForm = document.getElementById("bookForm");
const titleInput = document.getElementById("titleInput");
const authorInput = document.getElementById("authorInput");
const imageInput = document.getElementById("imageInput");
const statusInput = document.getElementById("statusInput");
const commentInput = document.getElementById("commentInput");

// Modal
const openModalBtn = document.getElementById("openModalBtn");
const closeModalBtn = document.getElementById("closeModal");
const cancelBtn = document.getElementById("cancelBtn");

// Stars
const starsContainer = document.getElementById("ratingStars");
const clearRatingBtn = document.getElementById("clearRating");

/* =========================
   ESTRELAS
========================= */
starsContainer.innerHTML = [1,2,3,4,5]
  .map(i => `<img src="assets/star.png" data-v="${i}" class="star" style="cursor:pointer">`)
  .join("");

function resetStars() {
  ratingValue = 0;
  updateStarsUI();
}

function updateStarsUI() {
  [...starsContainer.children].forEach(star => {
    star.src =
      Number(star.dataset.v) <= ratingValue
        ? "assets/star-yellow.png"
        : "assets/star.png";
  });
}

starsContainer.onclick = e => {
  if (!e.target.classList.contains("star")) return;
  ratingValue = Number(e.target.dataset.v);
  updateStarsUI();
};

clearRatingBtn.onclick = e => {
  e.preventDefault();
  resetStars();
};

/* =========================
   CONTADORES
========================= */
function updateCounters() {
  stats.innerHTML = `
    <div class="stat-card"><strong>${books.length}</strong><span>Total</span></div>
    <div class="stat-card"><strong>${books.filter(b => b.status === "Quero ler").length}</strong><span>Quero ler</span></div>
    <div class="stat-card"><strong>${books.filter(b => b.status === "Lendo").length}</strong><span>Lendo</span></div>
    <div class="stat-card"><strong>${books.filter(b => b.status === "Lido").length}</strong><span>Lidos</span></div>
  `;
}

/* =========================
   RENDER
========================= */
function renderBooks() {
  grid.innerHTML = "";

  const search = searchInput.value.toLowerCase();
  const status = statusFilter.value;

  const filteredBooks = books.filter(book => {
    const matchSearch =
      book.title.toLowerCase().includes(search) ||
      book.author.toLowerCase().includes(search);

    const matchStatus =
      status === "all" || book.status === status;

    return matchSearch && matchStatus;
  });

  if (filteredBooks.length === 0) {
    stats.style.display = books.length ? "grid" : "none";
    emptyMessage.style.display = "block";
    return;
  }

  stats.style.display = "grid";
  emptyMessage.style.display = "none";

  filteredBooks.forEach(book => {
    const originalIndex = books.indexOf(book);

    const card = document.createElement("div");
    card.className = "book-card";

    card.innerHTML = `
      <img src="${book.image || "https://via.placeholder.com/300x420"}" alt="Capa">

      <div class="book-card-content">
        <h3>${book.title}</h3>
        <p class="author">${book.author}</p>

        <span class="badge ${book.status.replace(/\s+/g, "-")}">
          ${book.status}
        </span>

        ${
          book.rating > 0
            ? `<div class="stars">
                ${[1,2,3,4,5].map(i => `
                  <img src="assets/${i <= book.rating ? "star-yellow.png" : "star.png"}" class="star">
                `).join("")}
              </div>`
            : ""
        }

        ${
          book.comment && book.comment.trim() !== ""
            ? `<p class="comment">${book.comment}</p>`
            : ""
        }
      </div>

      <div class="card-actions">
        <button class="edit" data-index="${originalIndex}">
          <img src="assets/edit.png"> Editar
        </button>
        <button class="delete" data-index="${originalIndex}">
          <img src="assets/excluir.png"> Excluir
        </button>
      </div>
    `;

    grid.appendChild(card);
  });

  updateCounters();
}

/* =========================
   AÇÕES DOS CARDS
========================= */
grid.onclick = e => {
  const deleteBtn = e.target.closest(".delete");
  const editBtn = e.target.closest(".edit");

  if (deleteBtn) {
    books.splice(deleteBtn.dataset.index, 1);
    saveBooks();
    renderBooks();
  }

  if (editBtn) {
    openEditModal(editBtn.dataset.index);
  }
};

/* =========================
   MODAL
========================= */
openModalBtn.onclick = () => {
  modal.classList.remove("hidden");
  editingIndex = null;
  bookForm.reset();
  resetStars();
  clearRatingBtn.style.display = "none";
  document.querySelector(".modal-box h2").innerText = "Adicionar Livro";
  document.querySelector(".modal-actions .primary-btn").innerText = "Adicionar";
};

const closeModal = () => modal.classList.add("hidden");
closeModalBtn.onclick = closeModal;
cancelBtn.onclick = closeModal;

function openEditModal(index) {
  const book = books[index];
  editingIndex = index;

  modal.classList.remove("hidden");
  document.querySelector(".modal-box h2").innerText = "Editar Livro";
  document.querySelector(".modal-actions .primary-btn").innerText = "Atualizar";
  clearRatingBtn.style.display = "inline";

  titleInput.value = book.title;
  authorInput.value = book.author;
  imageInput.value = book.image;
  statusInput.value = book.status;
  commentInput.value = book.comment || "";

  ratingValue = book.rating;
  updateStarsUI();
}

/* =========================
   FORM
========================= */
bookForm.onsubmit = e => {
  e.preventDefault();

  const data = {
    title: titleInput.value.trim(),
    author: authorInput.value.trim(),
    image: imageInput.value.trim(),
    status: statusInput.value,
    rating: ratingValue,
    comment: commentInput.value.trim()
  };

  if (editingIndex !== null) {
    books[editingIndex] = data;
    editingIndex = null;
  } else {
    books.push(data);
  }

  saveBooks();
  closeModal();
  bookForm.reset();
  resetStars();
  renderBooks();
};

/* =========================
   FILTROS
========================= */
searchInput.addEventListener("input", renderBooks);
statusFilter.addEventListener("change", renderBooks);

/* =========================
   INIT
========================= */
loadBooks();
renderBooks();