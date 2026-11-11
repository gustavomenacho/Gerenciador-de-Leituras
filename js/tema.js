import { THEME_KEY } from "./constantes.js";
import { themeToggle } from "./elementos.js";

// ---------- tema claro / escuro ----------
// o script no <head> ja aplica o tema antes da pagina aparecer (pra nao piscar)

export function applyTheme(theme) {
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

export function getSavedTheme() {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch (error) {
    return null;
  }
}

export function toggleTheme() {
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
