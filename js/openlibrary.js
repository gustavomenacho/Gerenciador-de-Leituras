import { state } from "./estado.js";
import { authorInput, coverResults, imageHint, imageInput, pagesTotalInput, searchCoverBtn, titleInput } from "./elementos.js";
import { createElement } from "./utils.js";
import { updateCoverPreview } from "./formulario.js";

// ---------- buscar capa na Open Library ----------
// API publica e gratuita: https://openlibrary.org/developers/api
// so busca quando a pessoa clica em "Buscar capa" (nada e enviado enquanto digita)

const SEARCH_URL = "https://openlibrary.org/search.json";
const COVER_URL = "https://covers.openlibrary.org/b/id/";
const MAX_RESULTS = 6;
const TIMEOUT = 8000;

async function searchBooks(title, author) {
  const params = new URLSearchParams({
    title: title,
    fields: "title,author_name,cover_i,number_of_pages_median",
    limit: "20"
  });
  if (author) {
    params.set("author", author);
  }

  // se a API demorar demais, cancela
  const controller = new AbortController();
  const timer = setTimeout(function () {
    controller.abort();
  }, TIMEOUT);

  try {
    const response = await fetch(SEARCH_URL + "?" + params.toString(), { signal: controller.signal });
    if (!response.ok) {
      throw new Error("erro " + response.status);
    }
    const data = await response.json();
    // so interessa quem tem capa
    return data.docs
      .filter(function (doc) {
        return typeof doc.cover_i === "number";
      })
      .slice(0, MAX_RESULTS);
  } finally {
    clearTimeout(timer);
  }
}

export function clearCoverResults() {
  coverResults.innerHTML = "";
  coverResults.hidden = true;
}

function chooseResult(doc) {
  imageInput.value = COVER_URL + doc.cover_i + "-L.jpg";
  state.newCover = null;
  state.removeCover = true; // o link escolhido substitui a imagem do aparelho

  // aproveita pra completar o que estiver vazio
  if (!authorInput.value.trim() && doc.author_name) {
    authorInput.value = doc.author_name[0];
  }
  if (!pagesTotalInput.value && doc.number_of_pages_median) {
    pagesTotalInput.value = doc.number_of_pages_median;
  }

  clearCoverResults();
  imageHint.textContent = "Capa escolhida. Ela será salva ao confirmar.";
  updateCoverPreview();
  searchCoverBtn.focus();
}

function showResults(docs) {
  clearCoverResults();

  docs.forEach(function (doc) {
    const author = doc.author_name ? doc.author_name[0] : "autor desconhecido";
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cover-result";
    button.setAttribute("aria-label", "Usar a capa de " + doc.title + ", de " + author);

    const img = document.createElement("img");
    img.src = COVER_URL + doc.cover_i + "-M.jpg";
    img.alt = "";
    img.loading = "lazy";

    button.appendChild(img);
    button.appendChild(createElement("span", "cover-result-title", doc.title));
    button.addEventListener("click", function () {
      chooseResult(doc);
    });

    item.appendChild(button);
    coverResults.appendChild(item);
  });

  coverResults.hidden = false;
}

export async function searchCover() {
  const title = titleInput.value.trim();
  if (title.length < 2) {
    imageHint.textContent = "Digite o título do livro antes de buscar a capa.";
    titleInput.focus();
    return;
  }

  searchCoverBtn.disabled = true;
  imageHint.textContent = "Buscando capas...";
  clearCoverResults();

  try {
    let docs = await searchBooks(title, authorInput.value.trim());
    // nada com o autor? tenta so pelo titulo
    if (docs.length === 0 && authorInput.value.trim()) {
      docs = await searchBooks(title, "");
    }

    if (docs.length === 0) {
      imageHint.textContent = "Nenhuma capa encontrada. Você pode escolher uma imagem do aparelho.";
    } else {
      imageHint.textContent = "Escolha uma das " + docs.length + " capas encontradas:";
      showResults(docs);
    }
  } catch (error) {
    imageHint.textContent = "Não foi possível buscar agora (sem internet?). Tente de novo mais tarde.";
  }

  searchCoverBtn.disabled = false;
}
