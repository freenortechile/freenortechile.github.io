// ==========================================
// SPORTPOS — MODO SIN CONEXIÓN
// Con internet usa siempre la versión nueva; sin
// internet abre la última versión guardada.
// Al publicar cambios, subir el número de VERSION.
// ==========================================

const VERSION = "sportpos-vendedor-v5";

const ARCHIVOS = [
    "./",
    "index.html",
    "manifest.webmanifest",
    "css/estilos.css",
    "js/tema.js",
    "js/modo.js",
    "js/base.js",
    "js/excel.js",
    "js/datos.js",
    "js/fotos.js",
    "js/movil.js",
    "js/lector.js",
    "js/vendor/zxing-library.min.js",
    "js/impresion.js",
    "js/vendor/supabase.js",
    "js/nube-config.js",
    "js/nube.js",
    "js/datos-ejemplo.js",
    "js/modulos/inicio.js",
    "js/modulos/vender.js",
    "js/modulos/ventas.js",
    "js/modulos/caja.js",
    "js/modulos/posventa.js",
    "js/modulos/productos.js",
    "js/modulos/inventario.js",
    "js/modulos/reportes.js",
    "js/modulos/configuracion.js",
    "js/vendor/jspdf.umd.min.js",
    "js/vendor/html2canvas.min.js",
    "js/pdf-universal.js",
    "js/app.js",
    "iconos/icono-192.png",
    "iconos/icono-512.png",
    "iconos/apple-touch-icon.png"
];


self.addEventListener("install", evento => {

    evento.waitUntil(
        caches.open(VERSION)
            .then(cache => cache.addAll(ARCHIVOS))
            .then(() => self.skipWaiting())
    );
});


self.addEventListener("activate", evento => {

    evento.waitUntil(
        caches.keys()
            .then(claves => Promise.all(claves.filter(c => c !== VERSION && c.replace(/v\d+$/, "") === VERSION.replace(/v\d+$/, "")).map(c => caches.delete(c))))
            .then(() => self.clients.claim())
    );
});


self.addEventListener("fetch", evento => {

    const pedido = evento.request;

    if (pedido.method !== "GET") {
        return;
    }

    const url = new URL(pedido.url);

    // Lector de códigos (CDN): se guarda la primera vez que se usa
    const esLector = url.hostname === "cdn.jsdelivr.net";

    if (url.origin !== self.location.origin && !esLector) {
        return;
    }

    // Fotos de productos: las guarda la app en el equipo, no hace falta duplicarlas aquí
    if (url.pathname.includes("/fotos/")) {
        return;
    }

    evento.respondWith(
        fetch(pedido)
            .then(respuesta => {

                if (respuesta.ok) {
                    const copia = respuesta.clone();
                    caches.open(VERSION).then(cache => cache.put(pedido, copia));
                }

                return respuesta;
            })
            .catch(() =>
                caches.match(pedido, { ignoreSearch: true })
                    .then(guardada => guardada || caches.match("index.html"))
            )
    );
});
