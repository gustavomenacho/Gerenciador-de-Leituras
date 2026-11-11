// PageLog - gerenciador de leituras
// Gustavo Menacho
// arquivo principal: liga os eventos e inicia a pagina

import { state } from "./estado.js";
import { chooseCoverBtn, commentInput, copyLinkBtn, coverFile, downloadBtn, form, grid, imageInput, importDialog, importFile, importMergeBtn, importReplaceBtn, removeCoverBtn, searchInput, shareLinkBtn, sortSelect, starLabels, statButtons, statusFilter, themeToggle, toastUndo } from "./elementos.js";
import { loadBooks } from "./dados.js";
import { loadCovers } from "./capas.js";
import { render } from "./tela.js";
import { clearCover, handleCoverFile, handleSubmit, openBookDialog, paintStars, updateCommentCount, updateCoverPreview } from "./formulario.js";
import { clearFilters, loadExamples, removeBook, undo } from "./acoes.js";
import { applyTheme, getSavedTheme, toggleTheme } from "./tema.js";
import { confirmImport, copyLink, downloadFile, importFromFile, importFromLink, openTransferDialog, shareLink } from "./transferir.js";

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
    const book = state.books.find(function (item) {
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
    state.newCover = null;
  }
  state.removeCover = hasLink;
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
  clearTimeout(state.toastTimer);
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
  state.pendingImport = null;
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
