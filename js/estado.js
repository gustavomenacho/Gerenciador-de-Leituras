// ---------- estado ----------
// fica tudo num objeto porque um modulo nao consegue mudar o "let" de outro modulo

export const state = {
  books: [],
  editingId: null, // null quando esta criando um livro novo
  backup: null, // copia da estante pro botao "Desfazer"
  toastTimer: null,
  pendingImport: null, // livros esperando confirmacao de importacao
  coverUrls: {}, // id do livro -> endereco temporario da capa salva no IndexedDB
  newCover: null, // capa escolhida no formulario (ainda nao salva)
  removeCover: false // true quando clicou em "Remover" no formulario
};
