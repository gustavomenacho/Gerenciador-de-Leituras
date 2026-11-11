// ---------- constantes ----------

// mantive o nome da chave da primeira versao pra nao perder os livros salvos
export const STORAGE_KEY = "minha-biblioteca";
export const THEME_KEY = "pagelog-tema";
export const STATUS_LIST = ["Quero ler", "Lendo", "Lido"];
export const COVER_COLORS = ["#2f4a3a", "#6e2a24", "#2b3a55", "#5a4632", "#3f3355", "#25504f"];
export const UNDO_TIME = 6000;
export const IMPORT_PREFIX = "#importar=";
export const MAX_IMPORT = 2000;
export const LONG_LINK = 30000;

// capas enviadas do aparelho ficam no IndexedDB (cabe muito mais que no localStorage)
export const DB_NAME = "pagelog";
export const COVER_STORE = "capas";
export const COVER_MAX_WIDTH = 400;
export const COVER_MAX_HEIGHT = 600;
export const MAX_COVER_FILE = 15 * 1024 * 1024; // 15 MB (antes de reduzir)
export const DEFAULT_IMAGE_HINT = "Sem capa? O PageLog cria uma para você.";

export const EXAMPLE_BOOKS = [
  { title: "Dom Casmurro", author: "Machado de Assis", status: "Lido", rating: 5, comment: "Capitu traiu ou não traiu? Releria só para decidir de novo." },
  { title: "Torto Arado", author: "Itamar Vieira Junior", status: "Lendo", rating: 0, comment: "" },
  { title: "O Hobbit", author: "J. R. R. Tolkien", status: "Lido", rating: 4, comment: "A melhor porta de entrada para a Terra-média." },
  { title: "Vidas Secas", author: "Graciliano Ramos", status: "Quero ler", rating: 0, comment: "" },
  { title: "Código Limpo", author: "Robert C. Martin", status: "Lendo", rating: 4, comment: "Nomes bons valem mais que comentários." }
];
