import { COVER_COLORS } from "./constantes.js";

// ---------- funcoes auxiliares ----------

export function createId() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return String(Date.now()) + Math.random().toString(16).slice(2);
}

// tira espacos e corta o texto no tamanho maximo
export function cleanText(value, max) {
  if (value === undefined || value === null) {
    return "";
  }
  return String(value).trim().slice(0, max);
}

// deixa tudo minusculo e sem acento, pra busca achar "memorias" em "Memórias"
export function normalizeText(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

// so aceito imagem com http ou https (bloqueia coisas tipo "javascript:")
export function isValidImageUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    return false;
  }
}

// escolhe sempre a mesma cor de capa pro mesmo livro
// (transforma o texto num numero e usa o resto da divisao pra escolher a cor)
export function getCoverColor(text) {
  let number = 0;
  for (let i = 0; i < text.length; i++) {
    number = (number * 31 + text.charCodeAt(i)) % 1000000;
  }
  return COVER_COLORS[number % COVER_COLORS.length];
}

export function plural(count, singular, pluralWord) {
  if (count === 1) {
    return count + " " + singular;
  }
  return count + " " + pluralWord;
}

// cria um elemento ja com classe e texto
// uso textContent em vez de innerHTML pra ninguem conseguir injetar html pelo titulo
export function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) {
    element.className = className;
  }
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

export function createIcon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", "#icon-" + name);
  svg.appendChild(use);
  return svg;
}
