// ==========================================
// SPORTPOS — HERRAMIENTAS BASE
// Guardado, formatos, íconos, ventanas y avisos
// ==========================================

"use strict";

const SISTEMA = {
    nombre: "SportPOS",
    version: "1.0"
};

// la app de vendedores guarda aparte, por si se abre en el mismo equipo que la de administración
const PREFIJO = window.SPORT_MODO === "vendedor" ? "sportv_" : "sport_";


// ==========================================
// GUARDADO (localStorage)
// ==========================================

function clonar(valor) {

    return valor === undefined
        ? undefined
        : JSON.parse(JSON.stringify(valor));
}


const DB = {

    leer(clave, defecto = null) {

        try {

            const texto =
                localStorage.getItem(PREFIJO + clave);

            if (texto === null) {
                return clonar(defecto);
            }

            return JSON.parse(texto);

        } catch (error) {

            return clonar(defecto);
        }
    },


    guardar(clave, valor) {

        try {

            localStorage.setItem(
                PREFIJO + clave,
                JSON.stringify(valor)
            );

            return true;

        } catch (error) {

            avisar(
                "No se pudo guardar: el almacenamiento del navegador está lleno.",
                "error"
            );

            return false;
        }
    },


    borrar(clave) {
        localStorage.removeItem(PREFIJO + clave);
    },


    claves() {

        return Object.keys(localStorage)
            .filter(clave => clave.startsWith(PREFIJO))
            .map(clave => clave.slice(PREFIJO.length));
    }
};


function nuevoId() {

    return (
        Date.now().toString(36) +
        Math.random().toString(36).slice(2, 8)
    );
}


// ==========================================
// FORMATOS
// ==========================================

const formatoNumero =
    new Intl.NumberFormat("es-CL");


function dinero(valor) {

    const n =
        Math.round(Number(valor) || 0);

    return (n < 0 ? "-$" : "$") + formatoNumero.format(Math.abs(n));
}


function numero(valor) {
    return formatoNumero.format(Math.round(Number(valor) || 0));
}


function aEntero(valor) {

    const n =
        parseInt(String(valor ?? "").replace(/[^\d-]/g, ""), 10);

    return Number.isFinite(n) ? n : 0;
}


function dos(n) {
    return String(n).padStart(2, "0");
}


// Fecha local "AAAA-MM-DD"
function fechaISO(fecha = new Date()) {

    return (
        fecha.getFullYear() + "-" +
        dos(fecha.getMonth() + 1) + "-" +
        dos(fecha.getDate())
    );
}


function hoyISO() {
    return fechaISO(new Date());
}


// "AAAA-MM-DD" → Date local
function fechaDesdeISO(texto) {

    const [a, m, d] =
        String(texto).slice(0, 10).split("-").map(Number);

    return new Date(a, (m || 1) - 1, d || 1);
}


// Último día del mes "AAAA-MM" → "AAAA-MM-DD"
function finDeMes(anioMes) {

    const [a, m] =
        String(anioMes).split("-").map(Number);

    return fechaISO(new Date(a, m, 0));
}


function sumarDias(texto, dias) {

    const fecha =
        fechaDesdeISO(texto);

    fecha.setDate(fecha.getDate() + dias);

    return fechaISO(fecha);
}


function diasHasta(texto) {

    const objetivo =
        fechaDesdeISO(texto);

    const hoy =
        new Date();

    hoy.setHours(0, 0, 0, 0);

    return Math.round((objetivo - hoy) / 86400000);
}


const MESES = [
    "ene", "feb", "mar", "abr", "may", "jun",
    "jul", "ago", "sep", "oct", "nov", "dic"
];


function fechaCorta(texto) {

    if (!texto) {
        return "—";
    }

    const fecha =
        String(texto).length <= 10
            ? fechaDesdeISO(texto)
            : new Date(texto);

    return (
        dos(fecha.getDate()) + "-" +
        dos(fecha.getMonth() + 1) + "-" +
        fecha.getFullYear()
    );
}


function fechaHora(texto) {

    if (!texto) {
        return "—";
    }

    const fecha =
        new Date(texto);

    return (
        fechaCorta(texto) + " " +
        dos(fecha.getHours()) + ":" +
        dos(fecha.getMinutes())
    );
}


function hora(texto) {

    const fecha =
        new Date(texto);

    return dos(fecha.getHours()) + ":" + dos(fecha.getMinutes());
}


// Vencimientos: "sep 2027"
function mesAnio(texto) {

    if (!texto) {
        return "—";
    }

    const fecha =
        fechaDesdeISO(texto);

    return MESES[fecha.getMonth()] + " " + fecha.getFullYear();
}


function fechaLarga(fecha = new Date()) {

    return fecha.toLocaleDateString(
        "es-CL",
        { weekday: "long", day: "numeric", month: "long", year: "numeric" }
    );
}


function plural(n, singular, pluralTexto) {
    return numero(n) + " " + (n === 1 ? singular : pluralTexto);
}


// ==========================================
// TEXTO
// ==========================================

function esc(texto) {

    return String(texto ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


function normalizar(texto) {

    return String(texto ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim();
}


function iniciales(nombre) {

    return String(nombre || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(parte => parte[0] || "")
        .join("")
        .toUpperCase();
}


// ==========================================
// RUT CHILENO
// ==========================================

function limpiarRut(rut) {
    return String(rut || "").replace(/[^0-9kK]/g, "").toUpperCase();
}


function validarRut(rut) {

    const limpio =
        limpiarRut(rut);

    if (limpio.length < 2) {
        return false;
    }

    const cuerpo =
        limpio.slice(0, -1);

    const dv =
        limpio.slice(-1);

    if (!/^\d+$/.test(cuerpo)) {
        return false;
    }

    let suma = 0;
    let multiplicador = 2;

    for (let i = cuerpo.length - 1; i >= 0; i--) {

        suma += Number(cuerpo[i]) * multiplicador;

        multiplicador =
            multiplicador === 7 ? 2 : multiplicador + 1;
    }

    const resto =
        11 - (suma % 11);

    const esperado =
        resto === 11 ? "0" : resto === 10 ? "K" : String(resto);

    return dv === esperado;
}


function formatearRut(rut) {

    const limpio =
        limpiarRut(rut);

    if (limpio.length < 2) {
        return limpio;
    }

    return (
        limpio.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".") +
        "-" +
        limpio.slice(-1)
    );
}


// ==========================================
// CONTRASEÑAS
// Se guarda un hash con sal, nunca la contraseña
// ==========================================

function bytesAHex(bytes) {

    return Array.from(
        new Uint8Array(bytes),
        byte => byte.toString(16).padStart(2, "0")
    ).join("");
}


function textoAleatorio(bytes = 16) {

    const arreglo =
        new Uint8Array(bytes);

    if (window.crypto && crypto.getRandomValues) {
        crypto.getRandomValues(arreglo);
    } else {
        arreglo.forEach((_, i) => { arreglo[i] = Math.floor(Math.random() * 256); });
    }

    return bytesAHex(arreglo);
}


function huella(texto) {

    let h = 0x811c9dc5;

    for (let i = 0; i < texto.length; i++) {
        h ^= texto.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }

    return (h >>> 0).toString(16).padStart(8, "0");
}


async function calcularHash(clave, sal) {

    if (window.crypto && crypto.subtle) {

        const llave =
            await crypto.subtle.importKey(
                "raw",
                new TextEncoder().encode(String(clave)),
                "PBKDF2",
                false,
                ["deriveBits"]
            );

        const bits =
            await crypto.subtle.deriveBits(
                {
                    name: "PBKDF2",
                    hash: "SHA-256",
                    salt: new TextEncoder().encode(sal),
                    iterations: 100000
                },
                llave,
                256
            );

        return bytesAHex(bits);
    }


    // Navegadores muy antiguos: respaldo simple
    let h = sal + "|" + clave;

    for (let i = 0; i < 20000; i++) {
        h = huella(h + i) + huella(i + h);
    }

    return "s:" + h;
}


async function crearClave(clave) {

    const sal =
        textoAleatorio(16);

    return {
        claveHash: await calcularHash(clave, sal),
        claveSal: sal
    };
}


async function verificarClave(registro, clave) {

    if (!registro || !registro.claveHash || !registro.claveSal) {
        return false;
    }

    return (
        await calcularHash(clave, registro.claveSal)
    ) === registro.claveHash;
}


// ==========================================
// ÍCONOS (dibujo de línea, sin internet)
// ==========================================

const ICONOS = {
    inicio: '<path d="M5 12H3l9-9 9 9h-2"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/><path d="M9 21v-6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6"/>',
    carro: '<circle cx="6" cy="19" r="2"/><circle cx="17" cy="19" r="2"/><path d="M17 17H6V3H4"/><path d="M6 5l14 1-1 7H6"/>',
    boleta: '<path d="M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-2-2-3 2"/><path d="M9 7h6M9 11h6M13 15h2"/>',
    caja: '<rect x="7" y="9" width="14" height="10" rx="2"/><circle cx="14" cy="14" r="2"/><path d="M17 9V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>',
    pastilla: '<path d="M4.5 12.5l8-8a4.95 4.95 0 0 1 7 7l-8 8a4.95 4.95 0 0 1-7-7z"/><path d="M8.5 8.5l7 7"/>',
    inventario: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
    calendario: '<rect x="4" y="5" width="16" height="16" rx="2"/><path d="M16 3v4M8 3v4M4 11h16"/><path d="M12 14v3M12 19.5v.01"/>',
    receta: '<path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z"/><path d="M9 13h6M9 17h4"/>',
    grafico: '<path d="M3 13a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 9a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/><path d="M15 5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1z"/>',
    ajustes: '<path d="M4 6h8M16 6h4M14 4v4"/><path d="M4 12h2M10 12h10M8 10v4"/><path d="M4 18h11M19 18h1M17 16v4"/>',
    salir: '<path d="M14 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-2"/><path d="M9 12h12l-3-3M18 15l3-3"/>',
    buscar: '<circle cx="10" cy="10" r="7"/><path d="M21 21l-6-6"/>',
    mas: '<path d="M12 5v14M5 12h14"/>',
    menos: '<path d="M5 12h14"/>',
    cerrar: '<path d="M18 6L6 18M6 6l12 12"/>',
    editar: '<path d="M4 20h4L18.5 9.5a2.83 2.83 0 1 0-4-4L4 16v4"/><path d="M13.5 6.5l4 4"/>',
    basura: '<path d="M4 7h16M10 11v6M14 11v6"/><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-12"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
    impresora: '<path d="M17 17h2a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h2"/><path d="M17 9V5a2 2 0 0 0-2-2H9a2 2 0 0 0-2 2v4"/><rect x="7" y="13" width="10" height="8" rx="2"/>',
    usuarios: '<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75M21 21v-2a4 4 0 0 0-3-3.85"/>',
    usuario: '<circle cx="12" cy="7" r="4"/><path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    alerta: '<path d="M12 9v4"/><path d="M10.36 3.59L2.26 17.13a1.91 1.91 0 0 0 1.63 2.87h16.22a1.91 1.91 0 0 0 1.63-2.87L13.64 3.59a1.91 1.91 0 0 0-3.28 0z"/><path d="M12 16.5v.01"/>',
    check: '<path d="M5 12l5 5L20 7"/>',
    descargar: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 11l5 5 5-5M12 4v12"/>',
    subir: '<path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><path d="M7 9l5-5 5 5M12 4v12"/>',
    cruz: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>',
    candado: '<rect x="5" y="11" width="14" height="10" rx="2"/><circle cx="12" cy="16" r="1"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/>',
    codigo: '<path d="M4 7V6a2 2 0 0 1 2-2h2M4 17v1a2 2 0 0 0 2 2h2M16 4h2a2 2 0 0 1 2 2v1M16 20h2a2 2 0 0 0 2-2v-1"/><path d="M8 9v6M11 9v6M14 9v6M17 9v6"/>',
    reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
    ojo: '<path d="M10 12a2 2 0 1 0 4 0 2 2 0 0 0-4 0"/><path d="M21 12c-2.4 4-5.4 6-9 6s-6.6-2-9-6c2.4-4 5.4-6 9-6s6.6 2 9 6"/>',
    prohibido: '<circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/>',
    dinero: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
    tarjeta: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 10h18M7 15h.01M11 15h2"/>',
    transferencia: '<path d="M7 10h14l-4-4"/><path d="M17 14H3l4 4"/>',
    flecha: '<path d="M5 12h14M13 18l6-6M13 6l6 6"/>',
    tendencia: '<path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/>',
    camion: '<circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M5 17H3V6a1 1 0 0 1 1-1h9v12M9 17h6M13 6h5l3 5v6h-2"/>',
    escudo: '<path d="M12 3a12 12 0 0 0 8.5 3A12 12 0 0 1 12 21 12 12 0 0 1 3.5 6 12 12 0 0 0 12 3"/><path d="M9 12l2 2 4-4"/>',
    copo: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M10 4l2 2 2-2M10 20l2-2 2 2"/>',
    libro: '<path d="M3 19a9 9 0 0 1 9 0 9 9 0 0 1 9 0"/><path d="M3 6a9 9 0 0 1 9 0 9 9 0 0 1 9 0"/><path d="M3 6v13M12 6v13M21 6v13"/>',
    base: '<ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6"/><path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>',
    llave: '<circle cx="8" cy="15" r="4"/><path d="M10.85 12.15L19 4M18 5l2 2M15 8l2 2"/>',
    camara: '<path d="M5 7h1a2 2 0 0 0 2-2 1 1 0 0 1 1-1h6a1 1 0 0 1 1 1 2 2 0 0 0 2 2h1a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2"/><circle cx="12" cy="13" r="3"/>',
    imagen: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="M21 16l-5-5-9 9"/>',
    compartir: '<circle cx="6" cy="12" r="3"/><circle cx="18" cy="6" r="3"/><circle cx="18" cy="18" r="3"/><path d="M8.7 10.7l6.6-3.4M8.7 13.3l6.6 3.4"/>',
    celular: '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M11 4h2M12 17v.01"/>',
    puntos: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    lentes: '<circle cx="6" cy="15" r="3.5"/><circle cx="18" cy="15" r="3.5"/><path d="M9.5 15a2.5 2.5 0 0 1 5 0"/><path d="M2.5 15L5 6h2M21.5 15L19 6h-2"/>',
    orden: '<path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/>',
    mensaje: '<path d="M3 20l1.3-3.9A9 8 0 1 1 7.7 19L3 20"/><path d="M9 10h.01M12 10h.01M15 10h.01"/>',
    herramienta: '<path d="M7 10h3V7L6.5 3.5a6 6 0 0 1 8 8l6 6a2 2 0 0 1-3 3l-6-6a6 6 0 0 1-8-8L7 10"/>',
    ojo2: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    bolsa: '<path d="M6.33 8h11.34a2 2 0 0 1 2 1.84l.86 10A2 2 0 0 1 18.53 22H5.47a2 2 0 0 1-2-2.16l.86-10A2 2 0 0 1 6.33 8z"/><path d="M9 11V6a3 3 0 0 1 6 0v5"/>',
    cambio: '<path d="M17 3l4 4-4 4"/><path d="M3 11V9a2 2 0 0 1 2-2h16"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a2 2 0 0 1-2 2H3"/>',
    tienda: '<path d="M3 21h18M3 7v1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7m0 1a3 3 0 0 0 6 0V7H3l2-4h14l2 4"/><path d="M5 21V10.85M19 21V10.85M9 21v-4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v4"/>'
};


function icono(nombre, clase = "") {

    return (
        '<svg class="icono ' + clase + '" viewBox="0 0 24 24" aria-hidden="true">' +
        (ICONOS[nombre] || "") +
        "</svg>"
    );
}


// ==========================================
// DOM
// ==========================================

function $(selector, raiz = document) {
    return raiz.querySelector(selector);
}


function $$(selector, raiz = document) {
    return Array.from(raiz.querySelectorAll(selector));
}


function crearElemento(html) {

    const plantilla =
        document.createElement("template");

    plantilla.innerHTML =
        html.trim();

    return plantilla.content.firstElementChild;
}


function vacioHTML(iconoNombre, titulo, texto = "", boton = "") {

    return `
        <div class="vacio">
            ${icono(iconoNombre)}
            <h3>${esc(titulo)}</h3>
            ${texto ? `<p>${esc(texto)}</p>` : ""}
            ${boton ? `<div style="margin-top:14px">${boton}</div>` : ""}
        </div>
    `;
}


// ==========================================
// AVISOS (esquina inferior)
// ==========================================

function avisar(mensaje, tipo = "ok") {

    let contenedor =
        $("#avisos");

    if (!contenedor) {

        contenedor =
            crearElemento('<div id="avisos" class="avisos" role="status"></div>');

        document.body.appendChild(contenedor);
    }


    const nombreIcono =
        tipo === "error" ? "alerta" : tipo === "aviso" ? "alerta" : "check";

    const clase =
        tipo === "aviso" ? "aviso-amarillo" : tipo;

    const aviso =
        crearElemento(
            `<div class="aviso ${clase}">${icono(nombreIcono)}<span>${esc(mensaje)}</span></div>`
        );

    contenedor.appendChild(aviso);

    setTimeout(
        () => aviso.remove(),
        tipo === "error" ? 5200 : 3200
    );
}


// ==========================================
// VENTANAS (modales)
// ==========================================

const pilaModales = [];


document.addEventListener(
    "keydown",
    evento => {

        if (evento.key === "Escape" && pilaModales.length) {

            const ultimo =
                pilaModales[pilaModales.length - 1];

            if (ultimo.cerrable) {
                evento.preventDefault();
                ultimo.cerrar();
            }
        }
    }
);


// abrirModal({ titulo, html, clase, botones: [{ texto, clase, accion(cerrar, raiz) }], alAbrir(raiz, cerrar), alCerrar() })
function abrirModal(opciones) {

    const fondo =
        crearElemento(`
            <div class="fondo-modal">
                <div class="modal ${opciones.clase || ""}" role="dialog" aria-modal="true">
                    <div class="modal-cabeza">
                        <h2>${esc(opciones.titulo || "")}</h2>
                        <button type="button" class="btn btn-fantasma btn-icono" data-cerrar aria-label="Cerrar">${icono("cerrar")}</button>
                    </div>
                    <div class="modal-cuerpo">${opciones.html || ""}</div>
                    ${opciones.botones && opciones.botones.length ? '<div class="modal-pie"></div>' : ""}
                </div>
            </div>
        `);

    const raiz =
        $(".modal", fondo);

    let cerrado =
        false;

    const registro = {
        cerrable: opciones.cerrable !== false,
        cerrar
    };


    function cerrar() {

        if (cerrado) {
            return;
        }

        cerrado = true;

        fondo.remove();

        const indice =
            pilaModales.indexOf(registro);

        if (indice >= 0) {
            pilaModales.splice(indice, 1);
        }

        if (opciones.alCerrar) {
            opciones.alCerrar();
        }
    }


    if (opciones.cerrable === false) {
        $("[data-cerrar]", fondo).remove();
    } else {
        $("[data-cerrar]", fondo).addEventListener("click", cerrar);
    }


    const pie =
        $(".modal-pie", fondo);

    (opciones.botones || []).forEach(
        boton => {

            const elemento =
                crearElemento(
                    `<button type="button" class="btn ${boton.clase || ""}">${boton.icono ? icono(boton.icono) : ""}${esc(boton.texto)}</button>`
                );

            if (boton.id) {
                elemento.id = boton.id;
            }

            elemento.addEventListener(
                "click",
                async () => {

                    if (!boton.accion) {
                        cerrar();
                        return;
                    }

                    elemento.disabled = true;

                    try {
                        await boton.accion(cerrar, raiz);
                    } finally {
                        elemento.disabled = false;
                    }
                }
            );

            pie.appendChild(elemento);
        }
    );


    document.body.appendChild(fondo);

    pilaModales.push(registro);


    if (opciones.alAbrir) {
        opciones.alAbrir(raiz, cerrar);
    }


    const primerCampo =
        $("[autofocus]", raiz) ||
        $("input:not([type=checkbox]):not([type=radio]):not([readonly]), select, textarea", raiz);

    if (primerCampo) {
        setTimeout(() => primerCampo.focus(), 30);
    }


    return { raiz, cerrar };
}


function confirmar({ titulo = "Confirmar", mensaje = "", textoSi = "Aceptar", peligro = false }) {

    return new Promise(
        resolver => {

            let respuesta = false;

            abrirModal({
                titulo,
                clase: "angosto",
                html: `<p>${mensaje}</p>`,
                botones: [
                    { texto: "Cancelar" },
                    {
                        texto: textoSi,
                        clase: peligro ? "btn-peligro" : "btn-primario",
                        accion: cerrar => {
                            respuesta = true;
                            cerrar();
                        }
                    }
                ],
                alCerrar: () => resolver(respuesta)
            });
        }
    );
}


function pedirTexto({ titulo, mensaje = "", etiqueta = "", marcador = "", textoSi = "Aceptar", peligro = false, opciones = null }) {

    return new Promise(
        resolver => {

            let respuesta = null;

            const campo =
                opciones
                    ? `<select id="pedirValor">${opciones.map(o => `<option>${esc(o)}</option>`).join("")}</select>
                       <input id="pedirOtro" class="oculto" placeholder="Escriba el motivo" style="margin-top:8px">`
                    : `<input id="pedirValor" placeholder="${esc(marcador)}">`;

            abrirModal({
                titulo,
                clase: "angosto",
                html: `
                    ${mensaje ? `<p style="margin-bottom:14px">${mensaje}</p>` : ""}
                    <div class="campo">
                        ${etiqueta ? `<label for="pedirValor">${esc(etiqueta)}</label>` : ""}
                        ${campo}
                    </div>
                    <p class="rojo chico oculto" id="pedirError" style="margin-top:6px">Este dato es obligatorio.</p>
                `,
                alAbrir(raiz) {

                    const valor = $("#pedirValor", raiz);
                    const otro = $("#pedirOtro", raiz);

                    if (opciones) {
                        valor.addEventListener(
                            "change",
                            () => otro.classList.toggle("oculto", valor.value !== "Otro")
                        );
                    }

                    raiz.addEventListener(
                        "keydown",
                        evento => {
                            if (evento.key === "Enter" && evento.target.tagName === "INPUT") {
                                evento.preventDefault();
                                $(".modal-pie .btn:last-child", raiz).click();
                            }
                        }
                    );
                },
                botones: [
                    { texto: "Cancelar" },
                    {
                        texto: textoSi,
                        clase: peligro ? "btn-peligro" : "btn-primario",
                        accion: (cerrar, raiz) => {

                            let texto =
                                $("#pedirValor", raiz).value.trim();

                            if (opciones && texto === "Otro") {
                                texto = $("#pedirOtro", raiz).value.trim();
                            }

                            if (!texto) {
                                $("#pedirError", raiz).classList.remove("oculto");
                                return;
                            }

                            respuesta = texto;
                            cerrar();
                        }
                    }
                ],
                alCerrar: () => resolver(respuesta)
            });
        }
    );
}


// ==========================================
// ARCHIVOS
// ==========================================

function descargarArchivo(nombre, contenido, tipo = "application/json") {

    const blob =
        new Blob([contenido], { type: tipo + ";charset=utf-8" });

    const enlace =
        document.createElement("a");

    enlace.href =
        URL.createObjectURL(blob);

    enlace.download =
        nombre;

    document.body.appendChild(enlace);

    enlace.click();

    setTimeout(
        () => {
            URL.revokeObjectURL(enlace.href);
            enlace.remove();
        },
        1000
    );
}


// Filas → texto CSV (con ";" para que Excel en español lo abra bien)
function aCSV(filas) {

    return "﻿" + filas
        .map(
            fila => fila
                .map(celda => {
                    const texto = String(celda ?? "");
                    return /[";\n\r]/.test(texto)
                        ? '"' + texto.replace(/"/g, '""') + '"'
                        : texto;
                })
                .join(";")
        )
        .join("\r\n");
}


// Texto CSV → filas (acepta ";" o ",")
function leerCSV(texto) {

    texto =
        String(texto || "").replace(/^﻿/, "");

    const primeraLinea =
        texto.split(/\r?\n/)[0] || "";

    const separador =
        (primeraLinea.match(/;/g) || []).length >= (primeraLinea.match(/,/g) || []).length
            ? ";"
            : ",";

    const filas = [];
    let fila = [];
    let celda = "";
    let enComillas = false;

    for (let i = 0; i < texto.length; i++) {

        const c = texto[i];

        if (enComillas) {

            if (c === '"' && texto[i + 1] === '"') {
                celda += '"';
                i++;
            } else if (c === '"') {
                enComillas = false;
            } else {
                celda += c;
            }

        } else if (c === '"') {
            enComillas = true;
        } else if (c === separador) {
            fila.push(celda);
            celda = "";
        } else if (c === "\n" || c === "\r") {

            if (c === "\r" && texto[i + 1] === "\n") {
                i++;
            }

            fila.push(celda);
            filas.push(fila);
            fila = [];
            celda = "";

        } else {
            celda += c;
        }
    }

    if (celda !== "" || fila.length) {
        fila.push(celda);
        filas.push(fila);
    }

    return filas.filter(f => f.some(c => String(c).trim() !== ""));
}


function leerArchivoTexto(archivo) {

    return new Promise(
        (resolver, rechazar) => {

            const lector =
                new FileReader();

            lector.onload = () => resolver(String(lector.result));
            lector.onerror = () => rechazar(new Error("No se pudo leer el archivo."));

            lector.readAsText(archivo, "utf-8");
        }
    );
}


// Imagen → dataURL reducida (logo en PNG, fotos en JPG)
function reducirImagen(archivo, maximo = 240, tipo = "image/png", calidad = 0.75) {

    return new Promise(
        (resolver, rechazar) => {

            const lector =
                new FileReader();

            lector.onerror = () => rechazar(new Error("No se pudo leer la imagen."));

            lector.onload = () => {

                const imagen =
                    new Image();

                imagen.onerror = () => rechazar(new Error("El archivo no es una imagen válida."));

                imagen.onload = () => {

                    const escala =
                        Math.min(1, maximo / Math.max(imagen.width, imagen.height));

                    const lienzo =
                        document.createElement("canvas");

                    lienzo.width = Math.round(imagen.width * escala);
                    lienzo.height = Math.round(imagen.height * escala);

                    const contexto =
                        lienzo.getContext("2d");

                    // JPG no tiene transparencia: fondo blanco
                    if (tipo === "image/jpeg") {
                        contexto.fillStyle = "#ffffff";
                        contexto.fillRect(0, 0, lienzo.width, lienzo.height);
                    }

                    contexto.drawImage(imagen, 0, 0, lienzo.width, lienzo.height);

                    resolver(lienzo.toDataURL(tipo, calidad));
                };

                imagen.src = String(lector.result);
            };

            lector.readAsDataURL(archivo);
        }
    );
}


// ==========================================
// IMPRIMIR (en un marco oculto)
// ==========================================

function esIOS() {

    return (
        /iPad|iPhone|iPod/.test(navigator.userAgent)
        ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}


function esCelular() {
    return window.matchMedia("(pointer: coarse)").matches;
}


function imprimirHTML(html) {

    // En iPhone/iPad imprimir desde un marco oculto imprime la
    // página completa: se usa una pestaña nueva.
    if (esIOS()) {

        const ventana =
            window.open("", "_blank");

        if (ventana) {
            ventana.document.open();
            ventana.document.write(html);
            ventana.document.close();
            setTimeout(() => ventana.print(), 500);
            return;
        }
    }

    const marco =
        document.createElement("iframe");

    marco.setAttribute("aria-hidden", "true");

    marco.style.cssText =
        "position:fixed;right:0;bottom:0;width:0;height:0;border:0";

    document.body.appendChild(marco);

    const documento =
        marco.contentWindow.document;

    documento.open();
    documento.write(html);
    documento.close();

    const quitar =
        () => setTimeout(() => marco.remove(), 500);

    setTimeout(
        () => {
            marco.contentWindow.addEventListener("afterprint", quitar);
            marco.contentWindow.focus();
            marco.contentWindow.print();
            setTimeout(quitar, 60000);
        },
        250
    );
}
