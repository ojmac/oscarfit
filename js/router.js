/* router.js — Navegación entre secciones (SPA simple, sin dependencias) */

const Router = {
  current: 'dashboard',

  init() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => Router.go(btn.dataset.section));
    });

    window.addEventListener('hashchange', () => {
      const section = location.hash.replace('#', '') || 'dashboard';
      Router.show(section);
    });

    const initial = location.hash.replace('#', '') || 'dashboard';
    Router.go(initial);
  },

  go(section) {
    location.hash = section;
  },

  show(section) {
    document.querySelectorAll('.section').forEach((el) => {
      el.classList.toggle('active', el.id === `section-${section}`);
    });
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.section === section);
    });
    Router.current = section;
    document.dispatchEvent(new CustomEvent('section:change', { detail: { section } }));
  }
};

window.Router = Router;
