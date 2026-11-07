/* FREENORTE: animaciones extra (planes, menú activo, brillo de botones).
   Respeta "reducir movimiento" del sistema. */
(function () {
  'use strict';
  var reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function formato(n) { return '$' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

  /* 1. Precios que suben al aparecer la tarjeta */
  var precios = $$('[data-precio]');
  if (!reducir && 'IntersectionObserver' in window) {
    precios.forEach(function (el) { el.textContent = formato(0); });
    var ioP = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        ioP.unobserve(e.target);
        var el = e.target, fin = +el.dataset.precio, t0 = null;
        var retraso = 250 + (+getComputedStyle(el.closest('.plan')).getPropertyValue('--i') || 0) * 90;
        function paso(t) {
          if (t0 === null) t0 = t;
          var p = Math.min((t - t0) / 1100, 1);
          var v = Math.round(fin * (1 - Math.pow(1 - p, 3)) / 10) * 10;
          el.textContent = formato(p < 1 ? v : fin);
          if (p < 1) requestAnimationFrame(paso);
        }
        setTimeout(function () { requestAnimationFrame(paso); }, retraso);
      });
    }, { threshold: 0.4 });
    precios.forEach(function (el) { ioP.observe(el); });
  }

  /* 2. Menú: marca la sección en la que estás */
  var enlaces = $$('.menu a[href^="#"]');
  var secciones = enlaces.map(function (a) { return document.querySelector(a.getAttribute('href')); }).filter(Boolean);
  if ('IntersectionObserver' in window && secciones.length) {
    var ioM = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var id = '#' + e.target.id;
        enlaces.forEach(function (a) {
          var activo = a.getAttribute('href') === id;
          a.classList.toggle('is-actual', activo);
          if (activo) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    secciones.forEach(function (s) { ioM.observe(s); });
  }

  /* 3. Tarjetas de plan: leve inclinación siguiendo el mouse (solo computador) */
  if (!reducir && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.plan').forEach(function (card) {
      card.addEventListener('pointermove', function (ev) {
        var r = card.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', (-y * 4).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (x * 5).toFixed(2) + 'deg');
        card.style.setProperty('--mx', ((x + 0.5) * 100).toFixed(1) + '%');
        card.style.setProperty('--my', ((y + 0.5) * 100).toFixed(1) + '%');
      });
      card.addEventListener('pointerleave', function () {
        card.style.removeProperty('--rx'); card.style.removeProperty('--ry');
      });
    });
  }
})();
