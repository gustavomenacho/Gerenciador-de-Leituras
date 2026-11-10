<div align="center">

<img src="assets/pagelog.svg" alt="Logo do PageLog" width="120">

# PageLog

**Sua estante pessoal de leituras.**

Gerenciador de leituras para cadastrar livros, acompanhar o que estou lendo e guardar minhas notas.<br>
Feito com **HTML, CSS e JavaScript puro**, sem frameworks e sem bibliotecas.

[**🌐 Ver o site no ar**](https://pagelog-leituras.netlify.app) · [Funcionalidades](#-funcionalidades) · [Como rodar](#-como-rodar) · [O que aprendi](#-o-que-aprendi) · [Autor](#-autor)

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=flat&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=flat&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
![localStorage](https://img.shields.io/badge/dados-localStorage-2f4a3a?style=flat)
![Netlify](https://img.shields.io/badge/deploy-Netlify-00C7B7?style=flat&logo=netlify&logoColor=white)

</div>

---

## 📸 Telas

<p align="center">
  <img src="docs/capturas/estante.webp" alt="Estante do PageLog com os totais, busca, filtros e cinco livros" width="100%">
</p>

<p align="center">
  <img src="docs/capturas/estante-escuro.webp" alt="Estante no tema escuro" width="100%">
  <br><em>Tema escuro</em>
</p>

<p align="center">
  <img src="docs/capturas/formulario.webp" alt="Formulário de edição de um livro" width="49%">
  <img src="docs/capturas/formulario-escuro.webp" alt="Formulário de edição no tema escuro" width="49%">
  <br><em>Cadastro e edição</em>
</p>

<p align="center">
  <img src="docs/capturas/transferir.webp" alt="Janela para levar a estante por link ou por arquivo" width="100%">
  <br><em>Levar a estante para outro aparelho</em>
</p>

<p align="center">
  <img src="docs/capturas/celular.webp" alt="PageLog no celular" width="300">
  <img src="docs/capturas/celular-escuro.webp" alt="PageLog no celular, tema escuro" width="300">
  <br><em>No celular</em>
</p>

---

## 📖 Sobre

Esse projeto começou como o **Desafio Fase 2 da Pós-graduação Dev Start** (com apoio da Rocketseat): um CRUD de livros salvando no `localStorage`.

Depois de entregar, voltei nele para melhorar. Corrigi bugs que tinham passado (inclusive uma falha de segurança), melhorei a acessibilidade e dei uma cara própria para ele: a de um **sebo**, com papel envelhecido, capas de tecido e carimbos de biblioteca marcando cada livro como *Lido*, *Lendo* ou *Quero ler*.

---

## ✨ Funcionalidades

- Cadastrar, editar e excluir livros (título, autor, capa, status, nota e anotação)
- Capa gerada automaticamente quando o livro não tem imagem ou o link da capa quebra
- Totais por status no topo, que também funcionam como filtro
- Busca por título ou autor ignorando acentos ("codigo" encontra "Código Limpo")
- Ordenar por mais recentes, título, autor ou nota
- Nota de 1 a 5 estrelas, funcionando também pelo teclado
- Excluir com opção de **desfazer**
- **Levar a estante para outro aparelho** (começar no celular e continuar no PC) por link ou por arquivo de backup
- Tema claro e escuro (segue o sistema, mas dá para trocar no botão)
- Botão "Ver exemplos" para quem quer só conhecer o app
- Tudo salvo no navegador, sem servidor

---

## 🚀 Como rodar

O site está no ar em **[pagelog-leituras.netlify.app](https://pagelog-leituras.netlify.app)** (o Netlify publica de novo a cada push na `main`).

Para rodar localmente não precisa instalar nada:

```bash
git clone https://github.com/gustavomenacho/Gerenciador-de-Leituras.git
cd Gerenciador-de-Leituras
```

Depois é só abrir o `index.html` no navegador ou usar a extensão **Live Server** do VS Code.

---

## 🗂️ Arquivos

```
index.html        estrutura da página e janelas (dialog)
style.css         estilos, cores do tema claro e escuro, responsivo
script.js         lógica: salvar, mostrar, filtrar, importar/exportar
assets/           logo e favicon
docs/capturas/    imagens do README
```

---

## 🧠 O que aprendi

**XSS e por que não usar `innerHTML` com dado do usuário.** Na primeira versão eu montava os cards com `innerHTML`. Descobri que se alguém cadastrasse um livro com o título `<img src=x onerror=...>`, aquilo virava código rodando na página. Troquei para `createElement` + `textContent`, que trata tudo como texto. Também passei a aceitar só links de capa com `http://` ou `https://`.

**Uma função para desenhar a tela.** Os livros ficam num array e a função `render()` redesenha tudo a partir dele (cards, totais e mensagens de lista vazia). Antes os totais paravam de atualizar quando a busca não achava nada, porque a função saía antes de chegar nessa parte.

**Usar id em vez da posição no array.** Antes eu identificava o livro pelo índice, o que dava problema com a lista filtrada. Agora cada livro tem um `id` gerado com `crypto.randomUUID()`. Os livros salvos na versão antiga ganham um id quando a página carrega, então ninguém perde nada.

**`<dialog>`.** Usando o `<dialog>` com `showModal()` o navegador já cuida de várias coisas: fechar com Esc, prender o foco dentro da janela e devolver o foco para o botão que abriu.

**Acessibilidade.** As estrelas da nota são `radio` escondidos com o `label` virando a estrela, então dá para escolher com as setas do teclado. Também coloquei `label` em todos os campos, mensagens de erro com `aria-describedby`, foco visível e `prefers-reduced-motion`.

**Tema escuro com variáveis CSS.** Todas as cores estão em variáveis no `:root`. O tema escuro só troca o valor delas em `:root[data-theme="dark"]`. Um script pequeno no `<head>` aplica o tema antes da página aparecer, para não piscar branco.

**Levar a estante sem servidor.** Como o `localStorage` é de cada navegador, os livros do celular não aparecem no PC. Para resolver sem precisar de login e banco de dados:
- **Link:** transformo a estante em JSON, comprimo com `CompressionStream`, converto para base64 e coloco depois do `#` no link. O que vem depois do `#` não vai para o servidor, então os dados passam direto de um navegador para o outro.
- **Arquivo:** o mesmo JSON, baixado como `.json` e importado com `<input type="file">`.

Na hora de importar dá para **juntar** ou **substituir**. Para juntar sem duplicar, comparo os livros pelo id ou por título + autor, e fica a versão que foi editada por último (cada livro guarda `updatedAt`). Como o arquivo pode vir de qualquer lugar, todo livro importado passa pela mesma função que limpa e valida os dados do formulário.

---

## 👤 Autor

**Gustavo Menacho**, advogado em transição para o desenvolvimento front-end.

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=flat&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/gustavomenacho/)
[![GitHub](https://img.shields.io/badge/GitHub-181717?style=flat&logo=github&logoColor=white)](https://github.com/gustavomenacho)
[![E-mail](https://img.shields.io/badge/E--mail-EA4335?style=flat&logo=gmail&logoColor=white)](mailto:menacho1996@gmail.com)
