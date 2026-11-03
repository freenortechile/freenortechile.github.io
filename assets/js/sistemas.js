/* ==========================================================================
   SISTEMAS — Filtros del catálogo, ventana de detalles y WhatsApp por sistema
   Para cambiar lo que dice cada sistema, edita SISTEMAS más abajo.
   ========================================================================== */

(function () {
  'use strict';

  const SISTEMAS = {
    gestiona: {
      nombre: 'GESTIONA POS',
      rubro: 'Tiendas de ropa, calzado y accesorios',
      acento: 'var(--color-primary)',
      imagen: null,
      demo: null,
      video: 'assets/videos/gestiona.mp4',
      poster: 'assets/videos/gestiona.jpg',
      resumen: 'Nuestro sistema más completo para tiendas con tallas y colores. Ya funciona en negocios reales, con escáner desde el celular y datos en la nube.',
      modulos: [
        ['Punto de venta', 'Busca por código, nombre o talla y cobra con cualquier medio de pago.'],
        ['Inventario por talla y color', 'Stock al día, mínimos, alertas y kardex de movimientos.'],
        ['Escáner con celular', 'Conecta el celular con un código y úsalo como lector.'],
        ['Compras y proveedores', 'Ingreso de mercadería con documento y costo.'],
        ['Cierre de caja', 'Apertura, ingresos, retiros, arqueo e historial.'],
        ['Reportes y metas', 'Ventas, ganancia, margen, meta diaria y exportación.'],
        ['Usuarios y roles', 'Administradores y vendedores con sus permisos.'],
        ['Nube y respaldos', 'Varios equipos con los mismos datos y copias de seguridad.'],
        ['Dashboard', 'Ventas del día, ticket promedio y avance de la meta.']
      ]
    },
    farmacia: {
      nombre: 'FarmaNorte',
      rubro: 'Farmacias y droguerías',
      acento: '#3b82f6',
      imagen: 'assets/img/sistemas/farmacia.png',
      demo: null,
      video: 'assets/videos/farmacia.mp4',
      poster: 'assets/videos/farmacia.jpg',
      resumen: 'Venta de medicamentos por caja, blíster o unidad, con control de lotes y vencimientos, recetas y libro de recetas.',
      modulos: [
        ['Venta por caja, blíster o unidad', 'El stock se descuenta en unidades exactas.'],
        ['Lotes y vencimientos', 'Sale primero lo que vence antes; alertas a 30 y 90 días.'],
        ['Recetas', 'Venta directa, receta simple, retenida y receta cheque.'],
        ['Libro de recetas', 'Médico, paciente y RUT registrados automáticamente.'],
        ['Principio activo', 'Busca alternativas y bioequivalentes en segundos.'],
        ['Inventario', 'Ingreso por lote, stock bajo y pedido sugerido.'],
        ['Caja con arqueo', 'Apertura, ingresos, retiros y cierre por billetes.'],
        ['Reportes', 'Ventas, ganancia, lo más vendido y por vendedor.'],
        ['Celular y cámara', 'Instalable, lector de códigos y fotos de productos.']
      ]
    },
    optica: {
      nombre: 'VisiónPOS',
      rubro: 'Ópticas',
      acento: '#14b8a6',
      imagen: 'assets/img/sistemas/optica.png',
      demo: null,
      video: 'assets/videos/optica.mp4',
      poster: 'assets/videos/optica.jpg',
      resumen: 'Órdenes de trabajo con receta, abono y saldo, desde el encargo hasta la entrega, con aviso por WhatsApp cuando los lentes están listos.',
      modulos: [
        ['Órdenes de trabajo', 'Recibida, laboratorio, taller, lista y entregada.'],
        ['Recetas ópticas', 'Esfera, cilindro, eje, adición, DP y altura de cada ojo.'],
        ['Abonos y saldos', 'Cobra un abono al encargar y el saldo al entregar.'],
        ['Aviso por WhatsApp', 'Avisa al cliente cuando sus lentes están listos.'],
        ['Hoja para laboratorio', 'Graduación y armazón impresos, sin precios.'],
        ['Clientes', 'Historial de recetas, control anual y cumpleaños.'],
        ['Catálogo', 'Armazones, cristales, lentes de contacto, sol y servicios.'],
        ['Caja y ventas', 'Venta de mostrador, caja con arqueo y reportes.'],
        ['Celular y cámara', 'Fotos de la receta y lector de códigos.']
      ]
    },
    mineria: {
      nombre: 'FaenaPro',
      rubro: 'Minería y contratistas',
      acento: '#f59e0b',
      imagen: 'assets/img/sistemas/mineria.png',
      demo: null,
      video: 'assets/videos/mineria.mp4',
      poster: 'assets/videos/mineria.jpg',
      resumen: 'Gestión de la faena en un solo lugar: producción, equipos, mantención, combustible, bodega, personal y seguridad. Cada empresa activa solo lo que usa.',
      modulos: [
        ['Producción', 'Toneladas por turno contra la meta, leyes y despachos.'],
        ['Combustible', 'Cargas por equipo, estanques y litros por hora.'],
        ['Equipos', 'Horómetro, estado y documentos con vencimiento.'],
        ['Mantención', 'Preventivas por horas, fallas, repuestos y costos.'],
        ['Bodega y pañol', 'Vales de salida, préstamo de herramientas y EPP.'],
        ['Personal y turnos', '7x7, 4x3 y otros; quién está en faena y documentos.'],
        ['Seguridad', 'Días sin accidentes, incidentes, charlas y entrega de EPP.'],
        ['Compras', 'Solicitudes, órdenes de compra con IVA y recepción.'],
        ['Varias faenas y roles', 'Administrador, supervisor, bodeguero y operador.']
      ]
    },
    articulos: {
      nombre: 'MarkNorte',
      rubro: 'Bazares, minimarkets, librerías y ferreterías',
      acento: '#6366f1',
      imagen: 'assets/img/sistemas/articulos.png',
      demo: 'demos/articulos/index.html',
      video: 'assets/videos/articulos.mp4',
      poster: 'assets/videos/articulos.jpg',
      resumen: 'Un punto de venta simple para vender rápido, saber qué tienes y cuadrar la caja. Se aprende a usar en minutos.',
      modulos: [
        ['Venta rápida', 'Busca o escanea, descuento y cobro con vuelto.'],
        ['Monto libre', 'Vende lo que no tiene código escribiendo el precio.'],
        ['Por kilo, litro o metro', 'Cantidades con decimales y su stock exacto.'],
        ['Productos', 'Categorías, precio, costo, ganancia y foto.'],
        ['Importar desde Excel', 'Carga todo tu catálogo de una vez.'],
        ['Inventario', 'Ingreso de mercadería y productos por agotarse.'],
        ['Caja', 'Apertura, ingresos, retiros y cierre por billetes.'],
        ['Reportes', 'Ventas, ganancia, categorías y vendedores.'],
        ['Celular y cámara', 'Instalable y con lector de códigos.']
      ]
    },
    sportpos: {
      nombre: 'SportNorte',
      rubro: 'Tiendas de zapatillas y ropa deportiva',
      acento: '#ea580c',
      imagen: 'assets/img/sistemas/sportpos.png',
      demo: null,
      video: 'assets/videos/sportpos.mp4',
      poster: 'assets/videos/sportpos.jpg',
      vertical: true,
      resumen: 'Punto de venta y posventa para tiendas con tallas y colores: vende rápido, controla el stock de cada talla y registra cambios, devoluciones y garantías ligados a la venta.',
      modulos: [
        ['Venta por talla y color', 'Busca por marca, modelo o talla, o escanea con la cámara.'],
        ['Cobro con todos los medios', 'Efectivo con vuelto, débito, crédito y transferencia, con descuentos.'],
        ['Posventa', 'Cambios de talla, devoluciones y garantías con plazos controlados.'],
        ['Productos con tallas', 'Crea un modelo con todas sus tallas de una vez, con foto y código.'],
        ['Inventario', 'Stock por talla, alertas de tallas por agotarse e ingreso de mercadería.'],
        ['Caja con arqueo', 'Apertura, ingresos, retiros y cierre contando billetes.'],
        ['Reportes', 'Ventas, ganancia, categorías y vendedores; ya descuentan la posventa.'],
        ['Usuarios y roles', 'Administrador y vendedores, con recuperación de contraseña.'],
        ['Celular, PC y nube', 'Se instala en Android, iPhone y Windows; datos en la nube si lo necesitas.']
      ]
    },
    taller: {
      nombre: 'TallerPro',
      rubro: 'Talleres mecánicos',
      acento: '#ef4444',
      imagen: 'assets/img/sistemas/taller.png',
      demo: null,
      video: 'assets/videos/taller.mp4',
      poster: 'assets/videos/taller.jpg',
      vertical: true,
      resumen: 'Órdenes de trabajo con vehículo, presupuesto, repuestos y mano de obra, desde el ingreso hasta la entrega, con aviso de mantención por WhatsApp.',
      modulos: [
        ['Órdenes de trabajo', 'Ingresada, en diagnóstico, presupuesto, en reparación y lista para entregar.'],
        ['Clientes y vehículos', 'Patente, marca, modelo y todo su historial de servicios.'],
        ['Presupuesto', 'Repuestos y mano de obra, con abonos y saldo.'],
        ['Repuestos', 'Venta y uso en órdenes con stock descontado automáticamente.'],
        ['Próximas mantenciones', 'Avisa a tus clientes por WhatsApp cuando les toca.'],
        ['Caja con arqueo', 'Apertura, ingresos, retiros y cierre por billetes.'],
        ['Reportes', 'Ventas, ganancia y órdenes entregadas.'],
        ['Usuarios y roles', 'Administrador y mecánicos o recepción.'],
        ['Celular, PC y nube', 'Instalable en Android, iPhone y Windows.']
      ]
    },
    tecno: {
      nombre: 'TecnoPOS',
      rubro: 'Electrónica y repuestos de celulares',
      acento: '#22d3ee',
      imagen: 'assets/img/sistemas/tecno.png',
      demo: null,
      video: 'assets/videos/tecno.mp4',
      poster: 'assets/videos/tecno.jpg',
      vertical: true,
      resumen: 'Servicio técnico con IMEI, presupuesto y abonos, garantía de cada reparación y venta de repuestos y accesorios con el stock al día.',
      modulos: [
        ['Servicio técnico', 'Cada equipo con su IMEI, falla y estado de la reparación.'],
        ['Presupuesto y abonos', 'Cobra abonos y el saldo al entregar el equipo.'],
        ['Garantía de reparación', 'Controla la garantía de cada trabajo entregado.'],
        ['Venta de repuestos', 'Pantallas, baterías y accesorios con stock y código de barras.'],
        ['Compatibilidad', 'Modelos compatibles y calidad de cada repuesto.'],
        ['Clientes', 'Historial de equipos y reparaciones.'],
        ['Caja con arqueo', 'Apertura, ingresos, retiros y cierre por billetes.'],
        ['Reportes', 'Ventas, ganancia y reparaciones.'],
        ['Celular, PC y nube', 'Instalable en Android, iPhone y Windows.']
      ]
    },
    joya: {
      nombre: 'JoyaPOS',
      rubro: 'Joyerías y compra de oro',
      acento: '#eab308',
      imagen: 'assets/img/sistemas/joya.png',
      demo: null,
      video: 'assets/videos/joya.mp4',
      poster: 'assets/videos/joya.jpg',
      vertical: true,
      resumen: 'Precio del día del oro y la plata, joyas por peso y material, compra de oro usado, arreglos y apartados con abonos.',
      modulos: [
        ['Precio del día', 'Actualizas el valor del gramo y tus joyas se recalculan solas.'],
        ['Joyas por peso y material', 'Material, ley, peso y piedra; el sistema calcula el precio.'],
        ['Compra de oro y plata', 'Compra de oro usado con comprobante y control de caja.'],
        ['Arreglos', 'Recepción, estado y entrega con abonos.'],
        ['Apartados', 'Reserva una joya con abonos hasta entregarla.'],
        ['Inventario', 'Stock, alertas y movimientos.'],
        ['Caja con arqueo', 'Apertura, ingresos, retiros y cierre por billetes.'],
        ['Reportes', 'Ventas, ganancia y compras de oro.'],
        ['Celular, PC y nube', 'Instalable en Android, iPhone y Windows.']
      ]
    },
    belleza: {
      nombre: 'BellezaPro',
      rubro: 'Peluquerías, uñas, estética y barberías',
      acento: '#ec4899',
      imagen: 'assets/img/sistemas/belleza.png',
      demo: null,
      video: 'assets/videos/belleza.mp4',
      poster: 'assets/videos/belleza.jpg',
      vertical: true,
      resumen: 'Agenda de citas con seña, servicios y productos en una sola cuenta, clientas con su historial y caja para tu salón de belleza.',
      modulos: [
        ['Agenda de citas', 'Agendada, confirmada, en atención, lista para cobrar y entregada.'],
        ['Servicios', 'Peluquería, uñas, estética y barbería con su duración y valor.'],
        ['Seña y cobro', 'Cobra la seña al agendar y el saldo al terminar.'],
        ['Productos de venta', 'Vende shampoo, tintes, cremas y esmaltes con stock al día.'],
        ['Clientas', 'Historial de servicios y datos de contacto.'],
        ['Cobro integrado', 'Servicios, productos y seña en una sola cuenta.'],
        ['Caja con arqueo', 'Apertura, ingresos, retiros y cierre por billetes.'],
        ['Reportes', 'Ventas, ganancia y servicios más pedidos.'],
        ['Celular, PC y nube', 'Instalable en Android, iPhone y Windows.']
      ]
    },
    bodega: {
      nombre: 'BodegaPro',
      rubro: 'Bodegas mayoristas y distribuidoras',
      acento: '#c9a54a',
      imagen: 'assets/img/sistemas/bodega.png',
      demo: null,
      video: 'assets/videos/bodega.mp4',
      poster: 'assets/videos/bodega.jpg',
      vertical: true,
      resumen: 'Inventario, compras, facturación y cuentas por cobrar para bodegas mayoristas. Documentos internos con folio propio, funciona en computador, celular y tablet.',
      modulos: [
        ['Facturar', 'Factura, boleta, guía de despacho, nota de venta y cotización desde una sola pantalla.'],
        ['Precio mayorista', 'Se aplica solo según la cantidad, con descuentos por producto o al total.'],
        ['Ventas a crédito', 'Plazo y límite de crédito por cliente, con aviso al superarlo.'],
        ['Documentos', 'Historial, PDF, guías por facturar, notas de crédito y anulaciones.'],
        ['Cuentas por cobrar y pagar', 'Vencimientos, abonos, estado de cuenta y deudas con proveedores.'],
        ['Compras', 'Recepción de mercadería: sube el stock y actualiza el costo.'],
        ['Inventario', 'Stock valorizado, ubicaciones, hoja de conteo y kardex.'],
        ['Caja y reportes', 'Arqueo, utilidad, mejores clientes y libro de ventas.'],
        ['Usuarios y roles', 'Administrador, ventas y bodega, cada uno con lo que necesita.']
      ]
    },
    perfumeria: {
      nombre: 'POS Perfumería',
      rubro: 'Perfumerías y tiendas de fragancias',
      acento: '#d4a857',
      imagen: 'assets/img/sistemas/perfumeria.png',
      demo: null,
      video: 'assets/videos/perfumeria.mp4',
      poster: 'assets/videos/perfumeria.jpg',
      resumen: 'Elegante y pensado para perfumes: catálogo con foto, venta de decants, caja con arqueo y temas noche y oro o blanco y rosa.',
      modulos: [
        ['Catálogo de perfumes', 'Marca, tipo (EDP, EDT…), ml, género y familia olfativa.'],
        ['Decants', 'Vende 5 o 10 ml y descuenta del frasco.'],
        ['Venta con fotos', 'Busca rápido y vende también desde el celular.'],
        ['Caja completa', 'Arqueo por billetes, tarjetas y fondo para mañana.'],
        ['Ventas', 'Reimprimir, enviar por WhatsApp y anular con motivo.'],
        ['Reportes', 'Por marca, género, medio de pago y vendedor.'],
        ['Vendedores', 'Ven solo la venta y anulan solo lo del día.'],
        ['Dos temas', 'Noche y oro o blanco y rosa.'],
        ['Respaldos', 'Copias de seguridad y recuperación de acceso.']
      ]
    }
  };

  let config = {};

  function whatsappUrl(texto) {
    return `https://wa.me/${config.whatsappNumber}?text=${encodeURIComponent(texto)}`;
  }

  function esc(texto) {
    return String(texto).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  /* ---------- Filtros por rubro ---------- */
  function setupFiltros() {

    const filtros = document.querySelector('[data-filtros-sistemas]');

    if (!filtros) return;

    filtros.addEventListener('click', (e) => {

      const boton = e.target.closest('button[data-filtro]');

      if (!boton) return;

      filtros.querySelectorAll('button').forEach(b => b.classList.toggle('is-active', b === boton));

      const filtro = boton.dataset.filtro;

      document.querySelectorAll('.sistema-card[data-grupo]').forEach((card) => {
        card.hidden = filtro !== 'todos' && !card.dataset.grupo.split(' ').includes(filtro);
      });
    });
  }

  /* ---------- Ventana de detalles ---------- */
  function medio(s, conVideo) {
    if (s.video) {
      return `<div class="modal-sistema__media modal-sistema__media--video${s.vertical ? ' modal-sistema__media--vertical' : ''}">
        <video src="${s.video}" poster="${s.poster || ''}" controls playsinline preload="${conVideo ? 'auto' : 'none'}" ${conVideo ? 'autoplay' : ''}></video>
      </div>`;
    }
    return s.imagen ? `<div class="modal-sistema__media"><img src="${s.imagen}" alt="Pantalla de ${esc(s.nombre)}"></div>` : '';
  }

  function abrirDetalle(id, conVideo = false) {

    const s = SISTEMAS[id];
    const modal = document.getElementById('modal-sistema');

    if (!s || !modal) return;

    const mensaje = `Hola FREENORTE, me interesa ${s.nombre} para mi negocio. ¿Me pueden dar más información?`;

    modal.style.setProperty('--accent', s.acento);

    modal.querySelector('[data-modal-contenido]').innerHTML = `
      ${medio(s, conVideo)}
      <div class="modal-sistema__body">
        <p class="eyebrow">${esc(s.rubro)}</p>
        <h2>${esc(s.nombre)}</h2>
        <p class="modal-sistema__lead">${esc(s.resumen)}</p>
        <ul class="modal-sistema__modulos">
          ${s.modulos.map(([t, d]) => `<li><strong>${esc(t)}</strong><span>${esc(d)}</span></li>`).join('')}
        </ul>
        <div class="modal-sistema__acciones">
          ${s.demo ? `<a class="btn btn--primary" href="${s.demo}" target="_blank" rel="noopener">Probar gratis<svg class="icon btn__arrow" aria-hidden="true"><use href="#i-arrow"/></svg></a>` : ''}
          <a class="btn btn--whatsapp" href="${whatsappUrl(mensaje)}" target="_blank" rel="noopener"><svg class="icon" aria-hidden="true"><use href="#i-chat"/></svg>Cotizar por WhatsApp</a>
          <a class="btn btn--ghost" href="#contacto" data-cerrar-modal data-interest="demo-${id}">Solicitar demostración</a>
        </div>
      </div>
    `;

    modal.showModal();
    document.body.classList.add('modal-abierto');
    modal.scrollTop = 0;

    const video = modal.querySelector('video');
    if (video && conVideo) video.play().catch(() => {});
  }

  function setupModal() {

    const modal = document.getElementById('modal-sistema');

    if (!modal) return;

    document.addEventListener('click', (e) => {
      const boton = e.target.closest('[data-detalle], [data-video]');
      if (boton) {
        e.preventDefault();
        if (boton.dataset.video) abrirDetalle(boton.dataset.video, true);
        else abrirDetalle(boton.dataset.detalle);
      }
    });

    // Al cerrar se detiene el video
    modal.addEventListener('close', () => {
      document.body.classList.remove('modal-abierto');
      modal.querySelectorAll('video').forEach(v => v.pause());
    });

    modal.addEventListener('click', (e) => {

      // Clic fuera del contenido: cerrar
      if (e.target === modal) modal.close();

      if (e.target.closest('[data-cerrar-modal]')) {

        const interes = e.target.closest('[data-interest]');
        modal.close();

        // Deja elegida la opción en el formulario de contacto
        const select = document.getElementById('interes');
        if (interes && select && select.querySelector(`option[value="${interes.dataset.interest}"]`)) {
          select.value = interes.dataset.interest;
        }
      }
    });
  }

  /* ---------- Botones "Cotizar" de cada tarjeta ---------- */
  function setupWhatsappSistemas() {
    document.querySelectorAll('[data-whatsapp-sistema]').forEach((a) => {
      const s = SISTEMAS[a.dataset.whatsappSistema];
      if (!s) return;
      a.href = whatsappUrl(`Hola FREENORTE, me interesa ${s.nombre} para mi negocio. ¿Me pueden dar más información?`);
      a.target = '_blank';
      a.rel = 'noopener';
    });
  }

  function init(cfg) {
    config = cfg || {};
    setupFiltros();
    setupModal();
    setupWhatsappSistemas();
  }

  window.FN = window.FN || {};
  window.FN.sistemas = { init };
})();
