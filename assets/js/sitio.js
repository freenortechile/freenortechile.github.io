/* FREENORTE: comportamiento del sitio (v2): portada animada, tarjetas de sistemas, ficha, boleta, acordeón, línea de tiempo. */
(function () {
  'use strict';

  var CONFIG = {
    whatsappNumber: '56949424720',
    whatsappDisplay: '+56 9 4942 4720',
    whatsappGreeting: 'Hola FREENORTE, quisiera más información.',
    email: 'contacto.freenorte@gmail.com'
  };
  var reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clp = function (n) { return '$' + Math.round(n).toLocaleString('es-CL'); };
  var esc = function (t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var datos = window.FN_SISTEMAS || [];
  var mini = function (s) { return 'assets/img/sistemas/min/' + s.id + '.jpg'; };

  if (window.FN && window.FN.contactForm) window.FN.contactForm.init(CONFIG);
  $$('[data-year]').forEach(function (e) { e.textContent = new Date().getFullYear(); });

  /* ---------- Tema día / noche ---------- */
  var raiz = document.documentElement, botonTema = $('#tema-boton');
  function pintarTema() {
    var dia = raiz.getAttribute('data-tema') === 'dia';
    botonTema.textContent = dia ? 'Noche' : 'Día';
    botonTema.setAttribute('aria-pressed', String(dia));
  }
  botonTema.addEventListener('click', function () {
    var dia = raiz.getAttribute('data-tema') !== 'dia';
    raiz.setAttribute('data-tema', dia ? 'dia' : 'noche');
    try { localStorage.setItem('fn-tema2', dia ? 'dia' : 'noche'); } catch (e) { }
    pintarTema();
  });
  pintarTema();

  /* ---------- Menú móvil ---------- */
  var menuBoton = $('#menu-boton'), menuMovil = $('#menu-movil');
  function menu(abrir) { menuMovil.hidden = !abrir; menuBoton.setAttribute('aria-expanded', String(abrir)); menuBoton.textContent = abrir ? 'Cerrar' : 'Menú'; }
  menuBoton.addEventListener('click', function () { menu(menuMovil.hidden); });
  $$('a', menuMovil).forEach(function (a) { a.addEventListener('click', function () { menu(false); }); });

  /* ---------- Barra de progreso, cabecera y paralaje (un solo listener de scroll) ---------- */
  var cab = $('#cabecera'), prog = $('#progreso'), imgCiudad = $('.ciudad__img'), marcoCiudad = $('.ciudad__marco');
  var linea = $('#linea-tiempo'), pasos = $$('.linea-tiempo .qa');
  var esperando = false;
  function alScroll() {
    esperando = false;
    var y = window.scrollY, alto = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.transform = 'scaleX(' + (alto > 0 ? y / alto : 0).toFixed(4) + ')';
    cab.classList.toggle('is-bajo', y > 40);
    if (!reducir && imgCiudad && marcoCiudad) {
      var r = marcoCiudad.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) {
        var p = (window.innerHeight - r.top) / (window.innerHeight + r.height);
        imgCiudad.style.transform = 'translateY(' + (-(p * 18)).toFixed(1) + '%)';
      }
    }
    if (linea) {
      var l = linea.getBoundingClientRect(), avance = Math.max(0, Math.min(1, (window.innerHeight * 0.6 - l.top) / l.height));
      linea.style.setProperty('--avance', avance.toFixed(3));
      pasos.forEach(function (p) { p.classList.toggle('is-activo', p.getBoundingClientRect().top < window.innerHeight * 0.62); });
    }
  }
  window.addEventListener('scroll', function () { if (!esperando) { esperando = true; requestAnimationFrame(alScroll); } }, { passive: true });
  alScroll();

  /* ---------- Aparición al desplazarse ---------- */
  var revelar = $$('[data-rev]');
  if ('IntersectionObserver' in window && !reducir) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visto'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });
    revelar.forEach(function (el) {
      el.style.setProperty('--i', Math.min(Array.prototype.indexOf.call(el.parentElement.children, el), 6));
      io.observe(el);
    });
  } else {
    revelar.forEach(function (el) { el.classList.add('is-visto'); });
  }
  $$('.hoja__lista li').forEach(function (li, i) { li.style.setProperty('--k', i); });

  /* ---------- Portada: vitrina de pantallas, palabra que rota, cinta de rubros, contadores ---------- */
  var pant = $('#vitrina-pantallas'), chip = $('#vitrina-chip'), rota = $('#rota'), cinta = $('#cinta');
  if (pant && datos.length) {
    var orden = datos.slice().sort(function (a, b) { return (a.id === 'gestiona' ? -1 : 0) - (b.id === 'gestiona' ? -1 : 0); });
    orden.forEach(function (s, i) {
      var im = document.createElement('img');
      im.src = mini(s); im.alt = ''; im.width = 720; im.height = 450; im.decoding = 'async';
      if (i > 1) im.loading = 'lazy';
      pant.appendChild(im);
    });
    var imgs = $$('img', pant), k = 0;
    function mostrar(i) {
      imgs.forEach(function (im, j) { im.classList.toggle('is-activa', j === i); });
      chip.textContent = orden[i].nombre + ' · ' + orden[i].corto;
      if (rota) {
        rota.classList.add('is-cambia');
        setTimeout(function () { rota.textContent = orden[i].corto.toLowerCase(); rota.classList.remove('is-cambia'); }, 350);
      }
    }
    mostrar(0);
    if (!reducir) setInterval(function () { k = (k + 1) % orden.length; mostrar(k); }, 3600);
    else if (rota) rota.textContent = 'tu negocio';
  }
  if (cinta && datos.length) {
    var html = datos.map(function (s) { return '<span style="--c:' + s.color + '">' + esc(s.corto) + '</span>'; }).join('');
    cinta.innerHTML = html + html;
  }
  $$('[data-cuenta]').forEach(function (el) {
    var fin = +el.dataset.cuenta;
    if (reducir) { el.textContent = fin; return; }
    var t0 = null;
    function paso(t) {
      if (t0 === null) t0 = t;
      var p = Math.min((t - t0) / 1400, 1);
      el.textContent = Math.round(fin * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(paso);
    }
    el.textContent = '0';
    setTimeout(function () { requestAnimationFrame(paso); }, 700);
  });

  /* ---------- Sistemas: tarjetas ---------- */
  var cont = $('#tarjetas'), ficha = $('#ficha'), fondo = $('#ficha-fondo'), actual = null, ultimoFoco = null;
  datos.forEach(function (s, idx) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'tarjeta'; b.dataset.id = s.id; b.dataset.grupo = s.grupo; b.style.setProperty('--c', s.color);
    b.setAttribute('data-rev', '');
    b.innerHTML = '<span class="tarjeta__img"><img src="' + mini(s) + '" alt="" width="720" height="450" loading="lazy" decoding="async"></span>' +
      '<span class="tarjeta__cuerpo"><span class="tarjeta__nom">' + esc(s.nombre) + '</span><span class="tarjeta__rubro">' + esc(s.corto) + '</span><span class="tarjeta__ver">Ver sistema →</span></span>';
    b.addEventListener('click', function () { abrir(s.id); });
    if (!reducir) {
      b.addEventListener('mousemove', function (e) {
        var r = b.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        b.style.transform = 'translateY(-6px) perspective(700px) rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg)';
      });
      b.addEventListener('mouseleave', function () { b.style.transform = ''; });
    }
    cont.appendChild(b);
  });
  if ('IntersectionObserver' in window && !reducir) {
    var io2 = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-visto'); io2.unobserve(e.target); } });
    }, { threshold: 0.05 });
    $$('.tarjeta').forEach(function (t, i) { t.style.setProperty('--i', i % 4); io2.observe(t); });
  } else { $$('.tarjeta').forEach(function (t) { t.classList.add('is-visto'); }); }

  $$('.filtro').forEach(function (f) {
    f.addEventListener('click', function () {
      $$('.filtro').forEach(function (x) { var on = x === f; x.classList.toggle('is-activo', on); x.setAttribute('aria-pressed', String(on)); });
      var cual = f.dataset.filtro;
      $$('.tarjeta').forEach(function (t) { t.hidden = cual !== 'todos' && t.dataset.grupo !== cual; });
    });
  });

  function boleta(s) {
    var b = s.boleta, total = 0, hayPrecio = true;
    var filas = b.items.map(function (it) {
      if (it[2] == null) { hayPrecio = false; return '<div class="bol__fila"><span>' + esc(it[0]) + '</span><span>x' + it[1] + '</span></div>'; }
      total += it[1] * it[2];
      return '<div class="bol__fila"><span>' + it[1] + ' x ' + esc(it[0]) + '</span><span>' + clp(it[1] * it[2]) + '</span></div>';
    }).join('');
    return '<div class="bol__neg">' + esc(b.negocio) + '</div><div class="bol__tit">' + esc(b.titulo || 'Boleta de venta') + '</div><div class="bol__linea"></div>' + filas + '<div class="bol__linea"></div>' +
      (hayPrecio ? '<div class="bol__fila bol__total"><span>TOTAL</span><span>' + clp(total) + '</span></div>' : '') +
      (b.nota ? '<div class="bol__nota">' + esc(b.nota) + '</div>' : '') + '<div class="bol__nota">Gracias por su compra</div>';
  }

  function abrir(id) {
    var s = datos.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    actual = s; ultimoFoco = document.activeElement;
    var img = $('#ficha-img');
    img.src = s.imagen || mini(s); img.alt = 'Pantalla de ' + s.nombre + ', sistema para ' + s.rubro.toLowerCase();
    $('#ficha-nombre').textContent = s.nombre;
    $('#ficha-rubro').textContent = s.rubro;
    $('#ficha-resumen').textContent = s.resumen;
    $('#ficha-mods').innerHTML = s.modulos.map(function (m) { return '<li><strong>' + esc(m[0]) + '</strong>' + esc(m[1]) + '</li>'; }).join('');
    $('#ficha-video').hidden = !s.video;
    var demo = $('#ficha-demo'); demo.hidden = !s.demo; if (s.demo) demo.href = s.demo;
    var comprar = $('#ficha-comprar'); comprar.hidden = !s.ml; if (s.ml) { comprar.href = s.ml; comprar.textContent = 'Comprar en Mercado Libre · ' + clp(s.precio); }
    var op = 'demo-' + s.id;
    $('#ficha-cotizar').dataset.interest = $('#interes option[value="' + op + '"]') ? op : 'cotizar';
    var papel = $('#boleta-papel');
    papel.classList.remove('is-imprimiendo');
    papel.innerHTML = boleta(s);
    fondo.hidden = false; ficha.hidden = false;
    ficha.scrollTop = 0;
    document.body.classList.add('sin-scroll');
    void ficha.offsetWidth;
    fondo.classList.add('is-visible'); ficha.classList.add('is-visible');
    if (!reducir) setTimeout(function () { papel.classList.add('is-imprimiendo'); }, 350);
    $('#ficha-volver').focus({ preventScroll: true });
  }
  function cerrar() {
    if (ficha.hidden) return;
    ficha.classList.remove('is-visible'); fondo.classList.remove('is-visible');
    document.body.classList.remove('sin-scroll');
    setTimeout(function () { ficha.hidden = true; fondo.hidden = true; }, reducir ? 0 : 420);
    actual = null;
    if (ultimoFoco && ultimoFoco.focus) ultimoFoco.focus({ preventScroll: true });
  }
  /* ---------- Comprar en Mercado Libre ---------- */
  (function () {
    var lista = $('#comprar-lista'); if (!lista) return;
    lista.innerHTML = datos.filter(function (s) { return s.ml; }).map(function (s) {
      return '<article class="compra" style="--c:' + esc(s.color || '#e3b85b') + '"><h3>' + esc(s.nombre) + '</h3><p>' + esc(s.rubro) + '</p>' +
        '<strong class="compra__precio">' + clp(s.precio) + '</strong>' +
        '<a class="boton boton--oro" href="' + esc(s.ml) + '" target="_blank" rel="noopener">Comprar en Mercado Libre</a></article>';
    }).join('');
  })();

  $('#ficha-volver').addEventListener('click', cerrar);
  fondo.addEventListener('click', cerrar);
  $('#ficha-cotizar').addEventListener('click', cerrar);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { cerrar(); menu(false); }
  });

  /* ---------- Video en ventana ---------- */
  var dlg = $('#video-dialogo'), player = $('#video-player');
  function verVideo(titulo, src, poster) {
    $('#video-titulo').textContent = titulo;
    player.src = src; if (poster) player.poster = poster;
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    var p = player.play(); if (p && p.catch) p.catch(function () { });
  }
  function cerrarVideo() { player.pause(); player.removeAttribute('src'); player.load(); if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
  $('#video-cerrar').addEventListener('click', cerrarVideo);
  dlg.addEventListener('click', function (e) { if (e.target === dlg) cerrarVideo(); });
  dlg.addEventListener('close', function () { player.pause(); });
  $('#ficha-video').addEventListener('click', function () { if (actual && actual.video) verVideo(actual.nombre, actual.video, actual.poster); });
  $$('[data-abrir-video]').forEach(function (b) {
    b.addEventListener('click', function () {
      var s = datos.filter(function (x) { return x.id === b.dataset.abrirVideo; })[0];
      if (s && s.video) verVideo(s.nombre, s.video, s.poster);
    });
  });

  var cv = $('#caso-video'), gest = datos.filter(function (x) { return x.id === 'gestiona'; })[0];
  if (cv && gest && gest.video && 'IntersectionObserver' in window && !reducir) {
    var cargado = false;
    new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) {
          if (!cargado) { cv.src = gest.video; cargado = true; }
          var p = cv.play(); if (p && p.catch) p.catch(function () { });
        } else { cv.pause(); }
      });
    }, { threshold: 0.3 }).observe(cv);
  }

  /* ---------- Preguntas: acordeón ---------- */
  $$('.preguntas__texto .qa').forEach(function (qa, i) {
    var h = $('h3', qa), p = $('p', qa), txt = h.textContent;
    var id = 'qa-' + i;
    h.innerHTML = '';
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'qa__boton'; b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', id); b.textContent = txt;
    h.appendChild(b);
    var panel = document.createElement('div');
    panel.className = 'qa__panel'; panel.id = id; panel.setAttribute('role', 'region');
    var inner = document.createElement('div');
    inner.appendChild(p); panel.appendChild(inner); qa.appendChild(panel);
    b.addEventListener('click', function () {
      var abrirlo = b.getAttribute('aria-expanded') !== 'true';
      $$('.preguntas__texto .qa__boton').forEach(function (o) { o.setAttribute('aria-expanded', 'false'); o.nextElementSibling; });
      $$('.preguntas__texto .qa__panel').forEach(function (o) { o.classList.remove('is-abierto'); });
      if (abrirlo) { b.setAttribute('aria-expanded', 'true'); panel.classList.add('is-abierto'); }
    });
    if (i === 0) { b.setAttribute('aria-expanded', 'true'); panel.classList.add('is-abierto'); }
  });

  /* ---------- Contacto ---------- */
  var form = $('#contact-form'), abrirForm = $('#abrir-formulario');
  function mostrarForm() { form.hidden = false; abrirForm.setAttribute('aria-expanded', 'true'); }
  abrirForm.addEventListener('click', function () { mostrarForm(); form.scrollIntoView({ behavior: reducir ? 'auto' : 'smooth', block: 'center' }); $('#nombre').focus({ preventScroll: true }); });
  $$('[data-interest]').forEach(function (a) { a.addEventListener('click', mostrarForm); });
  $('#rapido').addEventListener('submit', function (e) {
    e.preventDefault();
    var t = $('#rapido-texto').value.trim();
    var msg = t ? 'Hola FREENORTE, mi negocio es: ' + t + '. Quisiera más información.' : CONFIG.whatsappGreeting;
    window.open('https://wa.me/' + CONFIG.whatsappNumber + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });
})();
