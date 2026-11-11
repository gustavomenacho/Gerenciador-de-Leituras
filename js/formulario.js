import { DEFAULT_IMAGE_HINT, MAX_COVER_FILE } from "./constantes.js";
import { state } from "./estado.js";
import { authorInput, bookDialog, chooseCoverBtn, commentCount, commentInput, coverFile, coverPreviewImg, dialogTitle, form, imageHint, imageInput, removeCoverBtn, starLabels, statusInput, submitBtn, titleInput } from "./elementos.js";
import { createId, isValidImageUrl } from "./utils.js";
import { normalizeBook, saveBooks } from "./dados.js";
import { deleteCover, resizeImage, saveCover } from "./capas.js";
import { render } from "./tela.js";
import { showToast } from "./acoes.js";

// ---------- formulario ----------

export function paintStars(value) {
  starLabels.forEach(function (label, index) {
    label.classList.toggle("is-on", index < value);
  });
}

export function setRating(value) {
  form.elements.rating.value = String(value);
  paintStars(value);
}

export function updateCommentCount() {
  commentCount.textContent = commentInput.value.length + "/" + commentInput.maxLength;
}

export function showError(input, show) {
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

export function getEditingBook() {
  return state.books.find(function (book) {
    return book.id === state.editingId;
  });
}

// mostra a previa: imagem nova escolhida > capa salva do livro > link digitado
export function updateCoverPreview() {
  let src = "";
  const book = getEditingBook();
  const link = imageInput.value.trim();

  if (state.newCover) {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(state.newCover);
    src = previewUrl;
  } else if (book && book.localCover && !state.removeCover && state.coverUrls[book.id]) {
    src = state.coverUrls[book.id];
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

export async function handleCoverFile(file) {
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
    state.newCover = await resizeImage(file);
    state.removeCover = false;
    imageInput.value = ""; // a imagem do aparelho substitui o link
    imageInput.removeAttribute("aria-invalid");
    imageHint.textContent = "Imagem pronta (" + Math.round(state.newCover.size / 1024) + " KB). Ela será salva ao confirmar.";
  } catch (error) {
    state.newCover = null;
    imageHint.textContent = "Não foi possível abrir essa imagem. Tente outra (JPG ou PNG).";
  }
  updateCoverPreview();
}

export function clearCover() {
  state.newCover = null;
  state.removeCover = true;
  imageInput.value = "";
  imageHint.textContent = DEFAULT_IMAGE_HINT;
  updateCoverPreview();
  chooseCoverBtn.focus();
}

export function openBookDialog(book) {
  form.reset();
  showError(titleInput, false);
  showError(authorInput, false);
  imageInput.removeAttribute("aria-invalid");
  imageHint.textContent = DEFAULT_IMAGE_HINT;
  state.newCover = null;
  state.removeCover = false;

  if (book) {
    state.editingId = book.id;
    dialogTitle.textContent = "Editar livro";
    submitBtn.textContent = "Salvar alterações";
    titleInput.value = book.title;
    authorInput.value = book.author;
    imageInput.value = book.image;
    statusInput.value = book.status;
    commentInput.value = book.comment;
    setRating(book.rating);
  } else {
    state.editingId = null;
    dialogTitle.textContent = "Novo livro";
    submitBtn.textContent = "Adicionar à estante";
    setRating(0);
  }

  updateCommentCount();
  updateCoverPreview();
  bookDialog.showModal();
  titleInput.focus();
}

export function validateForm() {
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

export async function handleSubmit(event) {
  event.preventDefault();
  if (!validateForm()) {
    return;
  }

  const now = Date.now();
  const oldBook = getEditingBook();
  const data = {
    id: state.editingId || createId(),
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
    if (state.newCover) {
      await saveCover(data.id, state.newCover);
      data.localCover = true;
      data.image = "";
    } else if (state.removeCover || data.image.trim() !== "") {
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
    const index = state.books.indexOf(oldBook);
    state.books[index] = normalizeBook(data);
    showToast("Alterações salvas.");
  } else {
    state.books.push(normalizeBook(data));
    showToast('"' + data.title.trim() + '" entrou na estante.');
  }

  if (coverError) {
    showToast("Não foi possível salvar a imagem neste navegador. O livro foi salvo sem ela.");
  }

  state.newCover = null;
  state.removeCover = false;
  saveBooks();
  bookDialog.close();
  render();
}
