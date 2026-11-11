import { GOAL_KEY } from "./constantes.js";
import { state } from "./estado.js";
import { editGoalBtn, goalBar, goalForm, goalInput, goalText, goalYear } from "./elementos.js";
import { plural } from "./utils.js";

// ---------- meta de leitura do ano ----------
// conta os livros "Lido" que terminaram neste ano

function currentYear() {
  return String(new Date().getFullYear());
}

function getGoals() {
  try {
    const goals = JSON.parse(localStorage.getItem(GOAL_KEY));
    if (goals && typeof goals === "object") {
      return goals;
    }
  } catch (error) {
    // dado estranho: ignora
  }
  return {};
}

export function getGoal() {
  const goal = Number(getGoals()[currentYear()]);
  if (goal > 0) {
    return goal;
  }
  return 0;
}

export function saveGoal(goal) {
  const goals = getGoals();
  goals[currentYear()] = goal;
  try {
    localStorage.setItem(GOAL_KEY, JSON.stringify(goals));
  } catch (error) {
    // se nao der pra salvar, a meta so vale ate fechar a pagina
  }
}

export function countReadThisYear() {
  const year = currentYear();
  return state.books.filter(function (book) {
    return book.status === "Lido" && book.finishedAt.startsWith(year);
  }).length;
}

export function renderGoal() {
  const goal = getGoal();
  const done = countReadThisYear();
  goalYear.textContent = currentYear();

  if (goal === 0) {
    goalText.textContent =
      "Quantos livros você quer ler este ano? Até agora: " + plural(done, "livro lido", "livros lidos") + ".";
    goalBar.hidden = true;
    editGoalBtn.textContent = "Definir meta";
    return;
  }

  let text = done + " de " + plural(goal, "livro", "livros");
  if (done >= goal) {
    text += ". Meta batida!";
  } else {
    text += " (faltam " + (goal - done) + ")";
  }
  goalText.textContent = text;
  goalBar.max = goal;
  goalBar.value = Math.min(done, goal);
  goalBar.hidden = false;
  editGoalBtn.textContent = "Alterar meta";
}

export function openGoalForm() {
  goalInput.value = getGoal() || "";
  goalForm.hidden = false;
  editGoalBtn.hidden = true;
  goalInput.focus();
}

export function closeGoalForm() {
  goalForm.hidden = true;
  editGoalBtn.hidden = false;
  editGoalBtn.focus();
}

export function submitGoal(event) {
  event.preventDefault();
  const goal = Math.round(Number(goalInput.value));
  if (!goal || goal < 1) {
    goalInput.focus();
    return;
  }
  saveGoal(Math.min(goal, 999));
  closeGoalForm();
  renderGoal();
}
