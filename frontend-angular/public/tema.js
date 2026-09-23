// Aplica el tema y el menú guardados antes de pintar, para evitar un parpadeo.
try {
  if (localStorage.getItem('cf_tema') === 'dark') document.documentElement.dataset.theme = 'dark';
  if (localStorage.getItem('cf_menu') === 'cerrado') document.documentElement.dataset.menu = 'cerrado';
} catch (e) {}
