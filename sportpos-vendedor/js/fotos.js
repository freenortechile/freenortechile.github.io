// ==========================================
// SPORTPOS — FOTOS
// Fotos de productos y de recetas. Se guardan en
// IndexedDB (más espacio que localStorage).
// Claves: "p:<productoId>"
// ==========================================

"use strict";

const Fotos = {

    // Fotos de productos en memoria (para dibujar listas rápido)
    cache: new Map(),

    base: undefined,


    abrir() {

        if (this.base !== undefined) {
            return Promise.resolve(this.base);
        }

        return new Promise(
            resolver => {

                try {

                    const pedido =
                        indexedDB.open(window.SPORT_MODO === "vendedor" ? "sportpos-vendedor" : "sportpos", 1);

                    pedido.onupgradeneeded = () => pedido.result.createObjectStore("fotos");
                    pedido.onsuccess = () => resolver(this.base = pedido.result);
                    pedido.onerror = () => resolver(this.base = null);
                    pedido.onblocked = () => resolver(this.base = null);

                } catch (error) {
                    resolver(this.base = null);
                }
            }
        );
    },


    // Ejecuta una operación y espera a que termine
    async operar(modo, accion) {

        const base =
            await this.abrir();

        return new Promise(
            (resolver, rechazar) => {

                const transaccion =
                    base.transaction("fotos", modo);

                const pedido =
                    accion(transaccion.objectStore("fotos"));

                transaccion.oncomplete = () => resolver(pedido ? pedido.result : undefined);
                transaccion.onerror = () => rechazar(transaccion.error);
                transaccion.onabort = () => rechazar(transaccion.error || new Error("No se pudo guardar la foto."));
            }
        );
    },


    async guardar(clave, dato) {

        if (clave.startsWith("p:") || clave.startsWith("f:")) {
            this.cache.set(clave, dato);
        }

        if (!(await this.abrir())) {
            DB.guardar("foto_" + clave, dato);
            return;
        }

        await this.operar("readwrite", tienda => tienda.put(dato, clave));
    },


    async leer(clave) {

        if (this.cache.has(clave)) {
            return this.cache.get(clave);
        }

        if (!(await this.abrir())) {
            return DB.leer("foto_" + clave, null);
        }

        return (await this.operar("readonly", tienda => tienda.get(clave))) || null;
    },


    async borrar(clave) {

        this.cache.delete(clave);

        if (!(await this.abrir())) {
            DB.borrar("foto_" + clave);
            return;
        }

        await this.operar("readwrite", tienda => tienda.delete(clave));
    },


    // Todas las fotos { clave: dataURL } (para el respaldo)
    async todas() {

        const resultado = {};

        if (!(await this.abrir())) {

            DB.claves()
                .filter(clave => clave.startsWith("foto_"))
                .forEach(clave => { resultado[clave.slice(5)] = DB.leer(clave); });

            return resultado;
        }

        const claves = await this.operar("readonly", tienda => tienda.getAllKeys());
        const valores = await this.operar("readonly", tienda => tienda.getAll());

        claves.forEach((clave, i) => { resultado[clave] = valores[i]; });

        return resultado;
    },


    async reemplazarTodas(fotos) {

        this.cache.clear();

        if (!(await this.abrir())) {

            DB.claves().filter(clave => clave.startsWith("foto_")).forEach(clave => DB.borrar(clave));

            Object.entries(fotos || {}).forEach(([clave, dato]) => DB.guardar("foto_" + clave, dato));

        } else {

            await this.operar("readwrite", tienda => {
                tienda.clear();
                Object.entries(fotos || {}).forEach(([clave, dato]) => tienda.put(dato, clave));
                return null;
            });
        }

        await this.cargarCache();
    },


    // Carga en memoria solo las fotos de productos
    async cargarCache() {

        this.cache.clear();

        try {

            if (!(await this.abrir())) {

                DB.claves()
                    .filter(clave => clave.startsWith("foto_p:") || clave.startsWith("foto_f:"))
                    .forEach(clave => this.cache.set(clave.slice(5), DB.leer(clave)));

                return;
            }

            for (const prefijo of ["p:", "f:"]) {

                const rango = IDBKeyRange.bound(prefijo, prefijo + "\uffff");

                const claves = await this.operar("readonly", tienda => tienda.getAllKeys(rango));
                const valores = await this.operar("readonly", tienda => tienda.getAll(rango));

                claves.forEach((clave, i) => this.cache.set(clave, valores[i]));
            }

        } catch (error) {
            console.warn("No se pudieron cargar las fotos.", error);
        }
    },


    // ---------- fotos desde internet (GitHub) ----------
    // Cada producto puede tener "fotoArchivo" (ej. puma-395561-01.jpg). Ese dato viaja
    // por la nube, y cada equipo baja la foto desde FOTOS_URL y la guarda una sola vez
    // por archivo (clave "f:<archivo>"), aunque la usen varias tallas.

    remotas: null,
    remotasHora: 0,
    descargando: false,


    urlBase() {
        const base = String(window.FOTOS_URL || "").trim();
        return base && !base.endsWith("/") ? base + "/" : base;
    },


    urlDe(archivo) {
        const base = this.urlBase();
        return base && archivo ? base + encodeURIComponent(archivo) : null;
    },


    mapaRemotas() {

        if (!this.remotas || Date.now() - this.remotasHora > 2000) {

            const mapa = new Map();

            try {
                (Datos.productos() || []).forEach(p => { if (p && p.fotoArchivo) mapa.set(p.id, String(p.fotoArchivo)); });
            } catch (e) { /* sin datos todavía */ }

            this.remotas = mapa;
            this.remotasHora = Date.now();
        }

        return this.remotas;
    },


    olvidarRemotas() {
        this.remotas = null;
    },


    producto(id) {

        const propia = this.cache.get("p:" + id);
        if (propia) return propia;

        const archivo = this.mapaRemotas().get(id);
        if (!archivo) return null;

        return this.cache.get("f:" + archivo) || this.urlDe(archivo);
    },


    // Baja y guarda las fotos que faltan en este equipo (en segundo plano)
    async descargarFaltantes() {

        if (this.descargando || !this.urlBase() || navigator.onLine === false) return 0;

        this.descargando = true;
        this.olvidarRemotas();

        let bajadas = 0;

        try {

            const pendientes = new Set();

            this.mapaRemotas().forEach((archivo, id) => {
                if (!this.cache.has("p:" + id) && !this.cache.has("f:" + archivo)) pendientes.add(archivo);
            });

            const lista = Array.from(pendientes);

            const trabajar = async () => {

                while (lista.length) {

                    const archivo = lista.shift();

                    try {
                        const respuesta = await fetch(this.urlDe(archivo), { cache: "force-cache" });
                        if (!respuesta.ok) continue;
                        const dato = await reducirImagen(await respuesta.blob(), 500, "image/jpeg", 0.75);
                        await this.guardar("f:" + archivo, dato);
                        bajadas++;
                    } catch (e) {
                        if (navigator.onLine === false) return;
                    }
                }
            };

            await Promise.all([trabajar(), trabajar(), trabajar(), trabajar()]);

        } finally {
            this.descargando = false;
        }

        return bajadas;
    }
};


// Si una foto de internet no carga (sin conexión o no existe), no mostrar el ícono roto
document.addEventListener("error", evento => {
    const img = evento.target;
    const base = Fotos.urlBase();
    if (img && img.tagName === "IMG" && base && String(img.src).startsWith(base)) {
        img.style.visibility = "hidden";
    }
}, true);


// ==========================================
// TOMAR O ELEGIR UNA FOTO
// En celular, "camara" abre directo la cámara trasera
// ==========================================

function elegirFoto(camara, alElegir) {

    const entrada =
        document.createElement("input");

    entrada.type = "file";
    entrada.accept = "image/*";

    if (camara) {
        entrada.setAttribute("capture", "environment");
    }

    entrada.style.display = "none";

    entrada.addEventListener("change", () => {

        const archivo = entrada.files && entrada.files[0];

        entrada.remove();

        if (archivo) {
            alElegir(archivo);
        }
    });

    document.body.appendChild(entrada);

    entrada.click();
}


// Campo de foto para formularios. Devuelve { valor, cambiado }
function campoFoto(contenedor, { inicial = null, maximo = 480, calidad = 0.75, vacio = "Sin foto" } = {}) {

    const estado = {
        valor: inicial,
        cambiado: false
    };

    const celular =
        esCelular();

    const pintar = () => {

        contenedor.innerHTML = `
            <div class="campo-foto">
                <button type="button" class="foto-vista" data-foto="ver" aria-label="Ver foto" ${estado.valor ? "" : "disabled"}>
                    ${estado.valor ? `<img src="${estado.valor}" alt="">` : `${icono("camara")}<span>${esc(vacio)}</span>`}
                </button>
                <div class="campo-foto-botones">
                    ${celular
                        ? `<button type="button" class="btn btn-chico btn-primario" data-foto="camara">${icono("camara")} Tomar foto</button>
                           <button type="button" class="btn btn-chico" data-foto="galeria">${icono("imagen")} Galería</button>`
                        : `<button type="button" class="btn btn-chico" data-foto="galeria">${icono("subir")} Subir foto</button>`}
                    ${estado.valor ? `<button type="button" class="btn btn-chico btn-peligro" data-foto="quitar">${icono("basura")} Quitar</button>` : ""}
                </div>
            </div>
        `;
    };

    contenedor.addEventListener("click", evento => {

        const boton = evento.target.closest("[data-foto]");

        if (!boton) return;

        const accion = boton.dataset.foto;

        if (accion === "ver") {
            if (estado.valor) verFoto(estado.valor);
            return;
        }

        if (accion === "quitar") {
            estado.valor = null;
            estado.cambiado = true;
            pintar();
            return;
        }

        elegirFoto(accion === "camara", async archivo => {

            try {
                estado.valor = await reducirImagen(archivo, maximo, "image/jpeg", calidad);
                estado.cambiado = true;
                pintar();
            } catch (error) {
                avisar(error.message, "error");
            }
        });
    });

    pintar();

    return estado;
}


function verFoto(url, titulo = "Foto") {

    abrirModal({
        titulo,
        clase: "ancho",
        html: `<img src="${url}" alt="" style="display:block;max-width:100%;max-height:75vh;margin:0 auto;border-radius:10px">`,
        botones: [{ texto: "Cerrar", clase: "btn-primario" }]
    });
}
