// ==========================================
// SPORTPOS — SINCRONIZACIÓN EN LA NUBE (Supabase)
// Los mismos datos en el celular y en el computador.
//  - Funciona sin internet: los cambios quedan guardados y se suben al volver la conexión.
//  - Cada registro (producto, venta, caso de posventa…) se sincroniza por separado.
//  - Si dos equipos cambian el mismo registro, queda el último cambio.
// No sincroniza: sesión de cada equipo, carrito, ancho de papel e impresión automática, fotos.
// ==========================================

"use strict";

const Nube = (function () {

    const COLECCIONES = ["productos", "ventas", "movimientos", "posventa", "usuarios", "cierres"];
    const DOCUMENTOS = ["config", "caja", "contadores"];
    const LOCALES_CONFIG = ["anchoPapel", "imprimirAuto"];     // de cada equipo: no se sincronizan
    const CLAVE_ESTADO = "nube_estado";                         // se guarda sin pasar por la nube

    let cliente = null;
    let usuario = null;
    let canal = null;
    let aplicando = false;
    let ocupado = false;
    let pendienteOtraVez = false;
    let temporizador = null;
    let refresco = null;
    let ultimoError = "";
    let enLinea = navigator.onLine !== false;
    const escuchas = [];

    const ESTADO_VACIO = { ultima: "1970-01-01T00:00:00Z", hashes: {}, cuenta: "" };


    // ---------- utilidades ----------

    function configurada() {
        const c = window.NUBE_CONFIG || {};
        return Boolean(c.url && c.clave && window.supabase);
    }

    function canon(v) {
        if (v === null || typeof v !== "object") return JSON.stringify(v === undefined ? null : v);
        if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
        return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    }

    function hash(texto) {
        let h = 5381;
        for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0;
        return (h >>> 0).toString(36) + texto.length.toString(36);
    }

    function leerEstado() {
        try {
            const t = localStorage.getItem(PREFIJO + CLAVE_ESTADO);
            return t ? Object.assign({}, ESTADO_VACIO, JSON.parse(t)) : clonar(ESTADO_VACIO);
        } catch (e) { return clonar(ESTADO_VACIO); }
    }

    function guardarEstado(e) {
        try { localStorage.setItem(PREFIJO + CLAVE_ESTADO, JSON.stringify(e)); } catch (x) { /* sin espacio */ }
    }

    function idDe(coleccion, r) {
        if (!r) return null;
        if (r.id !== undefined && r.id !== null) return String(r.id);
        if (coleccion === "cierres" && r.numero !== undefined) return "n" + r.numero;
        return null;
    }

    function avisarCambio() {
        escuchas.forEach(f => { try { f(); } catch (e) { /* nada */ } });
    }

    // La tabla de la nube no acepta datos vacíos (null). Un documento que no existe en este
    // equipo (caja cerrada, contadores aún sin ventas) se sube con esta marca y al bajarlo se
    // vuelve a convertir en "no existe".
    const VACIO = { _vacio: true };
    const esVacio = d => d === null || d === undefined || (typeof d === "object" && !Array.isArray(d) && d._vacio === true);
    const paraSubir = d => (d === null || d === undefined) ? VACIO : d;

    // valor de un documento tal como se sube
    function valorDocumento(nombre) {
        let v = DB.leer(nombre, null);
        if (nombre === "config" && v) {
            v = Object.assign({}, v);
            LOCALES_CONFIG.forEach(k => delete v[k]);
        }
        return v;
    }


    // ---------- cuenta de la tienda por RUT ----------
    // La nube (Supabase) identifica cuentas por correo. Con el RUT se arma un correo interno
    // fijo (no recibe mensajes): 76123456-7@tiendas.freenorte.cl. Si se escribe un correo
    // (tiendas antiguas), se usa tal cual.
    const DOMINIO_RUT = "tiendas.freenorte.cl";

    function correoDeTienda(texto) {
        const t = String(texto || "").trim();
        if (t.includes("@")) return t.toLowerCase();
        const limpio = t.replace(/[^0-9kK]/g, "").toLowerCase();
        return limpio.slice(0, -1) + "-" + limpio.slice(-1) + "@" + DOMINIO_RUT;
    }

    function rutDeCorreo(correo) {
        const m = String(correo || "").match(/^(\d+)-([0-9k])@tiendas\.freenorte\.cl$/i);
        return m ? formatearRut(m[1] + m[2].toUpperCase()) : "";
    }


    // ---------- conexión ----------

    function crearCliente() {
        if (cliente || !configurada()) return cliente;
        const c = window.NUBE_CONFIG;
        cliente = window.supabase.createClient(c.url, c.clave, {
            auth: { persistSession: true, autoRefreshToken: true, storageKey: window.SPORT_MODO === "vendedor" ? "sportpos-vendedor-nube-auth" : "sportpos-nube-auth" },
            realtime: { params: { eventsPerSecond: 10 } }
        });
        return cliente;
    }

    async function iniciar() {

        if (!configurada()) return;

        crearCliente();

        try {
            const { data } = await cliente.auth.getSession();
            usuario = data && data.session ? data.session.user : null;
        } catch (e) { usuario = null; }

        cliente.auth.onAuthStateChange((evento, sesion) => {
            usuario = sesion ? sesion.user : null;
            avisarCambio();
        });

        window.addEventListener("online", () => { enLinea = true; avisarCambio(); sincronizar(); });
        window.addEventListener("offline", () => { enLinea = false; avisarCambio(); });
        document.addEventListener("visibilitychange", () => { if (!document.hidden) sincronizar(); });
        setInterval(() => { if (!document.hidden) sincronizar(); }, 45000);

        if (usuario) {
            suscribir();
            sincronizar();
        }

        avisarCambio();
    }

    function suscribir() {

        if (!cliente || !usuario || canal) return;

        canal = cliente
            .channel("docs-" + usuario.id)
            .on("postgres_changes", { event: "*", schema: "public", table: "docs", filter: "user_id=eq." + usuario.id }, carga => {
                if (carga.new && carga.new.coleccion) {
                    aplicarFila(carga.new, leerEstado(), false);
                    refrescarPantalla();
                }
            })
            .subscribe();
    }

    function desuscribir() {
        if (canal && cliente) { try { cliente.removeChannel(canal); } catch (e) { /* nada */ } }
        canal = null;
    }

    async function entrar(correo, clave, crear) {

        if (!configurada()) throw new Error("La nube no está configurada en este sistema.");

        crearCliente();

        const r = crear
            ? await cliente.auth.signUp({ email: correo, password: clave })
            : await cliente.auth.signInWithPassword({ email: correo, password: clave });

        if (r.error) {
            const m = String(r.error.message || r.error);
            if (/invalid login/i.test(m)) throw new Error("RUT (o correo) o clave incorrectos.");
            if (/already registered|already been registered/i.test(m)) throw new Error("Ese correo ya tiene cuenta. Use «Entrar».");
            if (/password/i.test(m) && /6|short|weak/i.test(m)) throw new Error("La contraseña debe tener al menos 6 caracteres.");
            if (/email.*confirm|confirm/i.test(m)) throw new Error("Falta confirmar el correo. Revise su bandeja o apague «Confirm email» en Supabase.");
            throw new Error(m);
        }

        if (!r.data.session) throw new Error("La cuenta se creó pero pide confirmar el correo. Apague «Confirm email» en Supabase (Authentication, Providers, Email).");

        usuario = r.data.session.user;

        const e = leerEstado();
        if (e.cuenta && e.cuenta !== usuario.id) {
            // otra cuenta distinta: se parte de cero
            guardarEstado(Object.assign(clonar(ESTADO_VACIO), { cuenta: usuario.id }));
        } else {
            e.cuenta = usuario.id;
            guardarEstado(e);
        }

        suscribir();
        avisarCambio();
        return usuario;
    }

    // crea una cuenta sin tocar la conexión actual de este equipo
    async function crearCuenta(correo, clave) {
        if (!configurada()) throw new Error("La nube no está configurada en este sistema.");
        const c = window.NUBE_CONFIG;
        const aparte = window.supabase.createClient(c.url, c.clave, { auth: { persistSession: false, autoRefreshToken: false, storageKey: "sportpos-cuenta-nueva" } });
        const r = await aparte.auth.signUp({ email: correo, password: clave });
        if (r.error) {
            const m = String(r.error.message || r.error);
            if (/already registered|already been registered/i.test(m)) throw new Error("Ese RUT ya tiene una tienda en la nube.");
            if (/password/i.test(m)) throw new Error("La clave debe tener al menos 6 caracteres.");
            throw new Error(m);
        }
        try { await aparte.auth.signOut(); } catch (e) { /* nada */ }
    }

    async function salir() {
        desuscribir();
        try { if (cliente) await cliente.auth.signOut(); } catch (e) { /* nada */ }
        usuario = null;
        guardarEstado(clonar(ESTADO_VACIO));
        avisarCambio();
    }


    // ---------- subir cambios ----------

    function cambiosPendientes() {

        const estado = leerEstado();
        const lista = [];

        COLECCIONES.forEach(col => {
            const hs = estado.hashes[col] || {};
            const registros = DB.leer(col, []);
            (Array.isArray(registros) ? registros : []).forEach(r => {
                if (!r || typeof r !== "object") return;
                const id = idDe(col, r);
                if (id === null) return;
                const h = hash(canon(r));
                if (hs[id] !== h) lista.push({ coleccion: col, id, datos: r, h });
            });
        });

        DOCUMENTOS.forEach(nombre => {
            const v = valorDocumento(nombre);
            const h = hash(canon(v));
            const hs = estado.hashes[nombre] || {};
            if (hs._ !== h) lista.push({ coleccion: nombre, id: "_", datos: v, h });
        });

        return lista;
    }

    function marcarSubidos(trozo) {
        const estado = leerEstado();
        trozo.forEach(c => {
            estado.hashes[c.coleccion] = estado.hashes[c.coleccion] || {};
            estado.hashes[c.coleccion][c.id] = c.h;
        });
        guardarEstado(estado);
    }

    const filaDe = c => ({ coleccion: c.coleccion, id: c.id, datos: paraSubir(c.datos) });

    async function empujar() {

        const lista = cambiosPendientes();

        if (!lista.length) return 0;

        const fallidos = [];

        for (let i = 0; i < lista.length; i += 150) {

            const trozo = lista.slice(i, i + 150);
            const { error } = await cliente.from("docs").upsert(trozo.map(filaDe), { onConflict: "user_id,coleccion,id" });

            if (!error) { marcarSubidos(trozo); continue; }

            // sin conexión o sesión vencida: se reintenta todo después
            if (!navigator.onLine || error.status === 401 || /jwt|fetch|network/i.test(String(error.message))) throw error;

            // un registro con problemas no debe trancar a los demás: se suben de a uno
            for (const c of trozo) {
                const r = await cliente.from("docs").upsert([filaDe(c)], { onConflict: "user_id,coleccion,id" });
                if (r.error) fallidos.push(c.coleccion + " " + c.id + ": " + (r.error.message || r.error));
                else marcarSubidos([c]);
            }
        }

        if (fallidos.length) {
            console.warn("[Nube] no se pudieron subir:", fallidos);
            throw new Error(fallidos.length + " cambio(s) no se pudieron subir. Primero: " + fallidos[0]);
        }

        return lista.length;
    }


    // ---------- bajar cambios ----------

    function escribirLocal(clave, valor) {
        aplicando = true;
        try {
            if (valor === null || valor === undefined) DB.borrar(clave);
            else DB.guardar(clave, valor);
        } finally { aplicando = false; }
    }

    // forzar = true: la nube manda (se pisa lo local)
    function aplicarFila(fila, estado, forzar) {

        const col = fila.coleccion;
        const id = String(fila.id);
        const datos = esVacio(fila.datos) ? null : fila.datos;

        estado.hashes[col] = estado.hashes[col] || {};

        if (DOCUMENTOS.includes(col)) {

            const actual = valorDocumento(col);
            const sinSubir = hash(canon(actual)) !== estado.hashes[col]._;

            if (sinSubir && !forzar) return false;

            if (col === "config") {
                const local = DB.leer("config", {}) || {};
                const nuevo = Object.assign({}, datos || {});
                LOCALES_CONFIG.forEach(k => { if (local[k] !== undefined) nuevo[k] = local[k]; });
                escribirLocal("config", nuevo);
                estado.hashes.config._ = hash(canon(datos));
            } else if (col === "contadores") {
                const local = DB.leer("contadores", {}) || {};
                const unido = Object.assign({}, datos || {});
                Object.keys(local).forEach(k => { unido[k] = Math.max(Number(unido[k]) || 0, Number(local[k]) || 0); });
                escribirLocal("contadores", unido);
                estado.hashes.contadores._ = hash(canon(datos));
            } else {
                escribirLocal(col, datos);
                estado.hashes[col]._ = hash(canon(datos));
            }
            guardarEstado(estado);
            return true;
        }

        if (!COLECCIONES.includes(col)) return false;

        // registro dañado o vacío en la nube: no se toca lo local
        if (!datos || typeof datos !== "object" || Array.isArray(datos)) return false;

        const lista = DB.leer(col, []);
        const i = lista.findIndex(r => idDe(col, r) === id);

        if (i >= 0) {
            const sinSubir = hash(canon(lista[i])) !== estado.hashes[col][id];
            if (sinSubir && !forzar) return false;
            if (canon(lista[i]) === canon(datos)) { estado.hashes[col][id] = hash(canon(datos)); guardarEstado(estado); return false; }
            lista[i] = datos;
        } else {
            lista.unshift(datos);
        }

        // lo más nuevo primero
        const fechaDe = r => String(r.fecha || r.cerradaEn || r.creado || "");
        if (["ventas", "movimientos", "posventa", "cierres"].includes(col)) {
            lista.sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
        }

        escribirLocal(col, lista);
        estado.hashes[col][id] = hash(canon(datos));
        guardarEstado(estado);
        return true;
    }

    // Aplica de una vez un bloque de filas bajadas de la nube. Cada colección se lee y se
    // guarda UNA sola vez por bloque (antes era una vez por fila: con miles de registros
    // la descarga tardaba minutos y la pantalla quedaba pegada en "Descargando datos…").
    function aplicarLote(filas, forzar) {

        const estado = leerEstado();
        const listas = {};
        let cambios = 0;

        for (const fila of filas) {

            const col = fila.coleccion;

            if (DOCUMENTOS.includes(col)) { if (aplicarFila(fila, estado, forzar)) cambios++; continue; }
            if (!COLECCIONES.includes(col)) continue;

            const datos = esVacio(fila.datos) ? null : fila.datos;
            if (!datos || typeof datos !== "object" || Array.isArray(datos)) continue;

            estado.hashes[col] = estado.hashes[col] || {};

            let L = listas[col];
            if (!L) {
                const leida = DB.leer(col, []);
                const lista = Array.isArray(leida) ? leida : [];
                const pos = new Map();
                lista.forEach((r, i) => { const k = idDe(col, r); if (k !== null && !pos.has(k)) pos.set(k, i); });
                L = listas[col] = { lista, pos, nuevos: new Map(), sucio: false };
            }

            const id = String(fila.id);
            const h = hash(canon(datos));

            if (L.nuevos.has(id)) { L.nuevos.set(id, datos); estado.hashes[col][id] = h; continue; }

            const i = L.pos.get(id);
            if (i !== undefined) {
                const hl = hash(canon(L.lista[i]));
                if (hl !== estado.hashes[col][id] && !forzar) continue;   // cambio local sin subir: gana lo local
                estado.hashes[col][id] = h;
                if (hl === h) continue;
                L.lista[i] = datos;
            } else {
                L.nuevos.set(id, datos);
                estado.hashes[col][id] = h;
            }
            L.sucio = true;
            cambios++;
        }

        const fechaDe = r => String(r.fecha || r.cerradaEn || r.creado || "");
        Object.keys(listas).forEach(col => {
            const L = listas[col];
            if (!L.sucio) return;
            // los nuevos van primero (como antes), lo más nuevo arriba
            const lista = Array.from(L.nuevos.values()).reverse().concat(L.lista);
            if (["ventas", "movimientos", "posventa", "cierres"].includes(col)) lista.sort((a, b) => fechaDe(b).localeCompare(fechaDe(a)));
            escribirLocal(col, lista);
        });

        guardarEstado(estado);
        return cambios;
    }

    async function traer(todo, forzar, alAvanzar) {

        const estado = leerEstado();
        let desde = todo ? "1970-01-01T00:00:00Z" : estado.ultima;
        let cambios = 0;
        let leidas = 0;

        for (;;) {

            const { data, error } = await cliente
                .from("docs")
                .select("coleccion,id,datos,actualizado")
                .gte("actualizado", desde)
                .order("actualizado", { ascending: true })
                .order("id", { ascending: true })
                .limit(1000);

            if (error) throw error;
            if (!data || !data.length) break;

            cambios += aplicarLote(data, forzar);
            leidas += data.length;
            if (alAvanzar) { try { alAvanzar(leidas); } catch (x) { /* nada */ } }
            await new Promise(r => setTimeout(r, 0));   // deja respirar la pantalla entre bloques

            const ultima = data[data.length - 1].actualizado;
            const e2 = leerEstado();
            e2.ultima = ultima;
            guardarEstado(e2);

            if (data.length < 1000 || ultima === desde) break;
            desde = ultima;
        }

        return cambios;
    }

    async function cuentaEnNube() {
        const { count, error } = await cliente.from("docs").select("id", { count: "exact", head: true });
        if (error) throw error;
        return count || 0;
    }


    // ---------- ciclo ----------

    async function sincronizar() {

        if (!cliente || !usuario || !enLinea) return;

        if (ocupado) { pendienteOtraVez = true; return; }

        ocupado = true;

        try {
            const bajados = await traer(false, false);
            if (bajados || !revisadoAlIniciar) { quitarRepetidosPorCodigo(); revisadoAlIniciar = true; }
            await empujar();
            ultimoError = "";
            if (bajados) refrescarPantalla();
        } catch (e) {
            ultimoError = String((e && e.message) || e);
        } finally {
            ocupado = false;
            avisarCambio();
            if (pendienteOtraVez) { pendienteOtraVez = false; setTimeout(sincronizar, 500); }
        }
    }

    function cambio(clave) {

        if (aplicando || !usuario) { avisarCambio(); return; }
        if (!COLECCIONES.includes(clave) && !DOCUMENTOS.includes(clave)) return;

        clearTimeout(temporizador);
        temporizador = setTimeout(sincronizar, 700);
        avisarCambio();
    }

    function refrescarPantalla() {

        clearTimeout(refresco);
        refresco = setTimeout(() => {
            // no se redibuja con un cuadro abierto o escribiendo
            const escribiendo = document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
            if (typeof pilaModales !== "undefined" && pilaModales.length) return refrescarPantalla();
            if (escribiendo) return refrescarPantalla();
            if (typeof App !== "undefined" && App.refrescar && document.getElementById("app")) App.refrescar();
            // productos nuevos desde otro equipo: bajar sus fotos
            if (typeof Fotos !== "undefined" && Fotos.descargarFaltantes) Fotos.descargarFaltantes();
        }, 600);
    }

    // ---------- productos iguales con distinto id (cargados por separado en cada equipo) ----------

    // mismo producto = mismo código de barras; sin código: mismo nombre, marca, modelo, color y talla
    function claveProducto(p) {
        const c = String((p && p.codigoBarras) || "").replace(/\s/g, "");
        if (c) return "c:" + c;
        return "n:" + [p.nombre, p.marca, p.modelo, p.color, p.talla].map(x => normalizar(x || "")).join("|");
    }

    // cambia el producto de las ventas, movimientos y casos de posventa según el mapa {idViejo: idNuevo}
    function cambiarProductoEn(lista, mapa) {
        let n = 0;
        const fijar = o => { if (o && mapa[o.productoId]) { o.productoId = mapa[o.productoId]; n++; } };
        (lista || []).forEach(r => {
            if (!r || typeof r !== "object") return;
            fijar(r);
            (r.items || []).forEach(fijar);
            (r.devueltos || []).forEach(fijar);
            (r.entregados || []).forEach(fijar);
        });
        return n;
    }

    // Equipo que se une a una tienda que ya tiene datos: los productos, usuarios y configuración
    // vienen de la nube; de este equipo solo se suben sus ventas (descontando el stock en la nube).
    function incorporarVentasLocales(local) {

        const productos = DB.leer("productos", []) || [];
        const porId = new Map(productos.map(p => [p.id, p]));
        const porClave = new Map();
        productos.forEach(p => { if (p && !p.borrado) { const k = claveProducto(p); if (!porClave.has(k)) porClave.set(k, p); } });

        const mapa = {};
        (local.productos || []).forEach(p => {
            if (!p || !p.id) return;
            if (porId.has(p.id)) return;
            const igual = porClave.get(claveProducto(p));
            if (igual) mapa[p.id] = igual.id;
        });

        const ventas = DB.leer("ventas", []) || [];
        const yaEstan = new Set(ventas.map(v => v && v.id));
        const contadores = DB.leer("contadores", {}) || {};
        let numero = Math.max(Number(contadores.venta) || 0, ...ventas.map(v => Number(v && v.numero) || 0));
        let subidas = 0, sinProducto = 0;

        const nuevas = (local.ventas || []).filter(v => v && v.id && !yaEstan.has(v.id))
            .sort((a, b) => String(a.fecha || "").localeCompare(String(b.fecha || "")));

        nuevas.forEach(v => {
            const venta = clonar(v);
            cambiarProductoEn([venta], mapa);
            venta.numeroOtroEquipo = venta.numero;
            venta.numero = ++numero;
            if (venta.estado !== "anulada") {
                (venta.items || []).forEach(it => {
                    const p = porId.get(it.productoId);
                    if (!p) { sinProducto++; return; }
                    if (typeof controlaStock === "function" && !controlaStock(p)) return;
                    p.stock = Math.round(((Number(p.stock) || 0) - (Number(it.cantidad) || 0)) * 1000) / 1000;
                });
            }
            ventas.push(venta);
            subidas++;
        });

        // salidas de bodega hechas en este equipo (bajas): también descuentan el stock de la nube
        const movimientos = DB.leer("movimientos", []) || [];
        const movYa = new Set(movimientos.map(m => m && m.id));
        let salidas = 0;
        (local.movimientos || []).forEach(m => {
            if (!m || !m.id || movYa.has(m.id) || m.tipo !== "baja" || !(Number(m.unidades) < 0) || m.detalle === "Producto borrado") return;
            const mov = clonar(m);
            cambiarProductoEn([mov], mapa);
            const p = porId.get(mov.productoId);
            if (p && (typeof controlaStock !== "function" || controlaStock(p))) {
                p.stock = Math.round(((Number(p.stock) || 0) + Number(mov.unidades)) * 1000) / 1000;
            }
            movimientos.push(mov);
            salidas++;
        });

        if (subidas || salidas) {
            ventas.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
            movimientos.sort((a, b) => String(b.fecha || "").localeCompare(String(a.fecha || "")));
            contadores.venta = numero;
            DB.guardar("ventas", ventas);
            DB.guardar("movimientos", movimientos);
            DB.guardar("productos", productos);
            DB.guardar("contadores", contadores);
        }

        return { ventas: subidas, salidas, sinProducto };
    }

    // "Unir ambos": lo que es el mismo producto (o el mismo usuario) en los dos lados queda una sola vez
    function quitarRepetidosAlUnir() {

        const estado = leerEstado();
        const enNube = estado.hashes.productos || {};
        const productos = DB.leer("productos", []) || [];
        const porClave = new Map();
        productos.forEach(p => { if (p && !p.borrado && enNube[p.id]) { const k = claveProducto(p); if (!porClave.has(k)) porClave.set(k, p); } });

        const mapa = {};
        const quedan = productos.filter(p => {
            if (!p || enNube[p.id] || p.borrado) return true;
            const igual = porClave.get(claveProducto(p));
            if (!igual) return true;
            mapa[p.id] = igual.id;
            return false;
        });

        if (Object.keys(mapa).length) {
            // las ventas de este equipo (aún no subidas) descontaron su copia: se descuentan del producto de la nube
            const ventasNube = estado.hashes.ventas || {};
            const porId = new Map(quedan.map(p => [p.id, p]));
            (DB.leer("ventas", []) || []).forEach(v => {
                if (!v || ventasNube[v.id] || v.estado === "anulada") return;
                (v.items || []).forEach(it => {
                    const p = mapa[it.productoId] && porId.get(mapa[it.productoId]);
                    if (p && (typeof controlaStock !== "function" || controlaStock(p))) {
                        p.stock = Math.round(((Number(p.stock) || 0) - (Number(it.cantidad) || 0)) * 1000) / 1000;
                    }
                });
            });
            DB.guardar("productos", quedan);
            ["ventas", "movimientos", "posventa"].forEach(col => {
                const lista = DB.leer(col, []) || [];
                if (cambiarProductoEn(lista, mapa)) DB.guardar(col, lista);
            });
        }

        // usuarios: el mismo nombre de ingreso queda una vez (el de la nube)
        const usuariosNube = estado.hashes.usuarios || {};
        const usuarios = DB.leer("usuarios", []) || [];
        const ingresosNube = new Set(usuarios.filter(u => u && usuariosNube[u.id] && !u.borrado).map(u => normalizar(u.usuario)));
        const usuariosQuedan = usuarios.filter(u => !u || usuariosNube[u.id] || !ingresosNube.has(normalizar(u.usuario)));
        if (usuariosQuedan.length !== usuarios.length) DB.guardar("usuarios", usuariosQuedan);

        return Object.keys(mapa).length;
    }

    // Productos que ya quedaron repetidos (de una unión anterior): se deja uno por grupo
    function buscarRepetidos() {
        const grupos = new Map();
        (DB.leer("productos", []) || []).forEach(p => {
            if (!p || p.borrado) return;
            const k = claveProducto(p);
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push(p);
        });
        return Array.from(grupos.values()).filter(g => g.length > 1).map(g =>
            g.slice().sort((a, b) => String(a.creado || "9").localeCompare(String(b.creado || "9"))));
    }

    // regla de stock para el que queda: "antiguo" (el del más antiguo), "menor" o "suma"
    function quitarRepetidos(regla) {
        const productos = DB.leer("productos", []) || [];
        const porId = new Map(productos.map(p => [p.id, p]));
        const mapa = {};
        let quitados = 0;
        buscarRepetidos().forEach(grupo => {
            const queda = porId.get(grupo[0].id);
            const stocks = grupo.map(p => Number(p.stock) || 0);
            if (regla === "menor") queda.stock = Math.min(...stocks);
            else if (regla === "suma") queda.stock = stocks.reduce((a, b) => a + b, 0);
            grupo.slice(1).forEach(r => {
                const p = porId.get(r.id);
                Object.assign(p, { borrado: true, activo: false, borradoEn: new Date().toISOString(), borradoPor: "repetido", repetidoDe: queda.id });
                mapa[p.id] = queda.id;
                quitados++;
            });
        });
        if (!quitados) return 0;
        DB.guardar("productos", productos);
        ["ventas", "movimientos", "posventa"].forEach(col => {
            const lista = DB.leer(col, []) || [];
            if (cambiarProductoEn(lista, mapa)) DB.guardar(col, lista);
        });
        return quitados;
    }

    // Mismo código de barras en dos productos distintos (cada equipo importó la misma planilla):
    // queda el más antiguo y los demás se marcan borrados. Todos los equipos eligen el mismo
    // (el de "creado" más antiguo y, si empatan, el id menor), así quedan iguales.
    function quitarRepetidosPorCodigo() {
        const productos = DB.leer("productos", []) || [];
        const grupos = new Map();
        productos.forEach(p => {
            if (!p || p.borrado) return;
            const c = String(p.codigoBarras || "").replace(/\s/g, "");
            if (!c) return;
            if (!grupos.has(c)) grupos.set(c, []);
            grupos.get(c).push(p);
        });
        const mapa = {};
        grupos.forEach(g => {
            if (g.length < 2) return;
            g.sort((a, b) => String(a.creado || "9").localeCompare(String(b.creado || "9")) || String(a.id).localeCompare(String(b.id)));
            g.slice(1).forEach(p => {
                Object.assign(p, { borrado: true, activo: false, borradoEn: new Date().toISOString(), borradoPor: "repetido", repetidoDe: g[0].id });
                mapa[p.id] = g[0].id;
            });
        });
        const n = Object.keys(mapa).length;
        if (!n) return 0;
        DB.guardar("productos", productos);
        ["ventas", "movimientos", "posventa"].forEach(col => {
            const lista = DB.leer(col, []) || [];
            if (cambiarProductoEn(lista, mapa)) DB.guardar(col, lista);
        });
        console.info("[Nube] productos repetidos por código quitados:", n);
        return n;
    }

    let resultadoUnion = null;
    let revisadoAlIniciar = false;

    // primera conexión:
    //  "nube"   = bajar todo y reemplazar este equipo
    //  "ventas" = productos, usuarios y configuración de la nube + se suben solo las ventas de este equipo
    //  "unir"   = juntar lo de aquí con lo de la nube (sin repetir productos ni usuarios)
    async function primeraSincronizacion(modo, alAvanzar) {

        guardarEstado(Object.assign(clonar(ESTADO_VACIO), { cuenta: usuario.id }));
        resultadoUnion = null;

        if (modo === "nube" || modo === "ventas") {
            const local = modo === "ventas" ? { productos: DB.leer("productos", []), ventas: DB.leer("ventas", []), movimientos: DB.leer("movimientos", []) } : null;
            aplicando = true;
            try { COLECCIONES.concat(DOCUMENTOS).forEach(k => DB.borrar(k)); } finally { aplicando = false; }
            await traer(true, true, alAvanzar);
            const repetidos = quitarRepetidosPorCodigo();
            if (repetidos) await empujar();
            if (local) {
                resultadoUnion = incorporarVentasLocales(local);
                await empujar();
            }
        } else {
            await traer(true, false, alAvanzar);   // lo que solo existe en la nube se agrega; lo local gana en choques
            resultadoUnion = { productosRepetidos: quitarRepetidosAlUnir() };
            await empujar();
        }

        ultimoError = "";
        avisarCambio();
        refrescarPantalla();
        return resultadoUnion;
    }

    function estado() {
        return {
            configurada: configurada(),
            conectado: Boolean(usuario),
            correo: usuario ? usuario.email : "",
            enLinea,
            sincronizando: ocupado,
            pendientes: usuario ? cambiosPendientes().length : 0,
            ultima: leerEstado().ultima,
            error: ultimoError
        };
    }

    function alCambiar(f) { escuchas.push(f); }


    // ---------- enganche con DB: cada guardado avisa a la nube ----------

    (function enganchar() {
        const guardar = DB.guardar.bind(DB);
        const borrar = DB.borrar.bind(DB);
        DB.guardar = function (clave, valor) { const ok = guardar(clave, valor); if (ok) cambio(clave); return ok; };
        DB.borrar = function (clave) { borrar(clave); cambio(clave); };
    })();


    return { iniciar, entrar, salir, sincronizar, primeraSincronizacion, cuentaEnNube, estado, alCambiar, configurada, correoDeTienda, rutDeCorreo, crearCuenta, buscarRepetidos, quitarRepetidos, claveProducto };

})();


// ==========================================
// PANTALLAS: cuadro de conexión, pestaña de Configuración e indicador
// ==========================================

const NubeUI = {

    // cuadro para entrar o crear la cuenta de la tienda
    conectar(opciones = {}) {

        const primerUso = Boolean(opciones.primerUso);

        abrirModal({
            titulo: "Conectar con la nube",
            clase: "angosto",
            html: `
                <p class="texto-2" style="margin:0 0 12px">${primerUso
                    ? "Use la cuenta de la tienda que ya creó en otro equipo. Se descargarán sus productos, ventas y usuarios."
                    : "Una sola cuenta para todos los equipos de la tienda (celular y computador). No es el usuario de ventas del sistema."}</p>
                <div class="campo"><label for="nbCorreo">RUT de la tienda</label><input id="nbCorreo" autocomplete="username" autocapitalize="off" placeholder="76.123.456-7" value="${esc(primerUso ? "" : (Datos.config().rut || ""))}"><span class="ayuda">Si su tienda se conectó antes con un correo, puede escribir el correo.</span></div>
                <div class="campo" style="margin-top:10px"><label for="nbClave">Clave de la tienda</label><input id="nbClave" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres"></div>
                ${primerUso ? "" : '<label class="check" style="margin-top:10px"><input type="checkbox" id="nbCrear"> Es la primera vez: crear la cuenta de la tienda</label>'}
                <div id="nbError" class="mensaje-error oculto" style="margin-top:12px"></div>
            `,
            botones: [
                { texto: "Cancelar" },
                {
                    texto: primerUso ? "Descargar mis datos" : "Conectar",
                    clase: "btn-primario",
                    accion: async (cerrar, raiz) => {

                        const error = $("#nbError", raiz);
                        const fallar = t => { error.textContent = t; error.classList.remove("oculto"); };
                        const texto = $("#nbCorreo", raiz).value.trim();
                        const clave = $("#nbClave", raiz).value;
                        const crear = !primerUso && $("#nbCrear", raiz).checked;

                        if (!texto || !clave) { fallar("Escriba el RUT y la clave de la tienda."); return; }
                        if (!texto.includes("@") && !validarRut(texto)) { fallar("El RUT no es válido."); return; }

                        const correo = Nube.correoDeTienda(texto);

                        error.classList.add("oculto");

                        try {
                            await Nube.entrar(correo, clave, crear);
                            const enNube = await Nube.cuentaEnNube();
                            const hayLocal = Datos.productos().length > 0 || Datos.ventas().length > 0;

                            if (primerUso) {
                                if (!enNube) { await Nube.salir(); fallar("Esa cuenta aún no tiene datos en la nube. Configure primero el equipo principal."); return; }
                                await Nube.primeraSincronizacion("nube");
                                cerrar();
                                location.reload();
                                return;
                            }

                            if (enNube && hayLocal) {
                                // la tienda ya está en la nube: este equipo toma sus productos y solo sube sus ventas y salidas
                                const r = await Nube.primeraSincronizacion("ventas");
                                cerrar();
                                const partes = [];
                                if (r && r.ventas) partes.push(`${r.ventas} venta(s)`);
                                if (r && r.salidas) partes.push(`${r.salidas} salida(s)`);
                                avisar("Listo: este equipo quedó con los productos de la nube." + (partes.length ? " Se subieron " + partes.join(" y ") + " de este equipo." : ""));
                                if (typeof App !== "undefined") App.refrescar();
                                return;
                            }

                            await Nube.primeraSincronizacion(enNube ? "nube" : "unir");
                            cerrar();
                            avisar(enNube ? "Datos descargados de la nube." : "Listo: sus datos ya están en la nube.");
                            if (Configuracion && Configuracion.pestana === "nube") Configuracion.pintar();
                        } catch (e) {
                            fallar(String((e && e.message) || e));
                        }
                    }
                }
            ]
        });
    },

    // Pasa la tienda de una cuenta con correo a una cuenta con RUT. Se crea la cuenta nueva
    // y se suben todos los datos de este equipo. Los demás equipos se vuelven a conectar con RUT.
    pasarARut() {

        const e = Nube.estado();

        if (e.pendientes || e.error) {
            avisar("Primero toque «Sincronizar ahora» y espere a que diga «Al día».", "error");
            return;
        }

        abrirModal({
            titulo: "Pasar la tienda a RUT",
            clase: "angosto",
            html: `
                <p class="texto-2" style="margin:0 0 12px">Desde ahora los equipos se conectan con el RUT y una clave de la tienda. Después, en cada celular hay que volver a entrar con ese RUT y esa clave.</p>
                <div class="campo"><label for="prRut">RUT de la tienda</label><input id="prRut" value="${esc(Datos.config().rut || "")}" placeholder="76.123.456-7"></div>
                <div class="campo" style="margin-top:10px"><label for="prClave">Clave de la tienda (nueva)</label><input id="prClave" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres"></div>
                <div id="prError" class="mensaje-error oculto" style="margin-top:12px"></div>`,
            botones: [
                { texto: "Cancelar" },
                {
                    texto: "Pasar a RUT",
                    clase: "btn-primario",
                    accion: async (cerrar, raiz) => {
                        const error = $("#prError", raiz);
                        const fallar = t => { error.textContent = t; error.classList.remove("oculto"); };
                        const rut = $("#prRut", raiz).value.trim();
                        const clave = $("#prClave", raiz).value;
                        if (!validarRut(rut)) return fallar("El RUT no es válido.");
                        if (clave.length < 6) return fallar("La clave debe tener al menos 6 caracteres.");
                        const correoNuevo = Nube.correoDeTienda(rut);
                        // 1) se crea la cuenta del RUT aparte: si falla, este equipo sigue conectado como antes
                        try {
                            await Nube.crearCuenta(correoNuevo, clave);
                        } catch (x) {
                            return fallar(String((x && x.message) || x));
                        }
                        // 2) este equipo se cambia a la cuenta nueva y sube todo
                        await Nube.salir();
                        await Nube.entrar(correoNuevo, clave, false);
                        await Nube.primeraSincronizacion("unir");
                        const cfg = Datos.config(); if (!cfg.rut) { cfg.rut = formatearRut(rut); Datos.guardarConfig(cfg); }
                        cerrar();
                        avisar("Listo: la tienda ahora se conecta con RUT " + formatearRut(rut) + ".");
                        Configuracion.pintar();
                    }
                }
            ]
        });
    },

    // la nube ya tiene datos y este equipo también
    elegirModo() {
        const ventasAqui = Datos.ventas().length;
        const listo = (r, texto) => {
            const extra = r && r.ventas ? ` Se subieron ${r.ventas} venta(s) de este equipo.` : "";
            const rep = r && r.productosRepetidos ? ` ${r.productosRepetidos} producto(s) ya estaban en la nube y no se repitieron.` : "";
            avisar(texto + extra + rep);
            App.refrescar();
        };
        abrirModal({
            titulo: "La nube ya tiene datos",
            clase: "angosto",
            cerrable: false,
            html: `
                <p class="texto-2" style="margin:0 0 12px">Esta cuenta ya tiene la tienda guardada y este equipo también tiene datos. ¿Qué hacemos?</p>
                <div class="mensaje-info" style="margin:0 0 10px"><strong>Recomendado para un segundo equipo:</strong><br>
                    <strong>Usar la tienda de la nube y subir mis ventas:</strong> los productos, el stock, los usuarios y la configuración quedan iguales a la nube. De este equipo solo se suben sus ventas${ventasAqui ? ` (${ventasAqui})` : ""} y se descuentan del stock. Los productos <strong>no se repiten</strong>.</div>
                <p style="margin:0 0 8px"><strong>Usar todo lo de la nube:</strong> este equipo queda igual que la nube. Lo de aquí, incluidas sus ventas, no se sube.</p>
                <p style="margin:0" class="chico texto-2"><strong>Unir ambos</strong> (solo si este equipo tiene productos que la nube no tiene): se juntan los dos; un producto con el mismo código de barras queda una sola vez.</p>`,
            botones: [
                { texto: "Desconectar", accion: async cerrar => { await Nube.salir(); cerrar(); if (Configuracion.pestana === "nube") Configuracion.pintar(); } },
                { texto: "Unir ambos", accion: async cerrar => { const r = await Nube.primeraSincronizacion("unir"); cerrar(); listo(r, "Datos unidos."); } },
                { texto: "Usar todo lo de la nube", accion: async cerrar => { await Nube.primeraSincronizacion("nube"); cerrar(); listo(null, "Datos descargados de la nube."); } },
                { texto: "Usar la nube y subir mis ventas", clase: "btn-primario", accion: async cerrar => { const r = await Nube.primeraSincronizacion("ventas"); cerrar(); listo(r, "Listo: este equipo quedó con la tienda de la nube."); } }
            ]
        });
    },

    // productos repetidos (quedaron de una unión anterior)
    revisarRepetidos() {

        const grupos = Nube.buscarRepetidos();

        if (!grupos.length) {
            avisar("No hay productos repetidos.");
            return;
        }

        const total = grupos.reduce((n, g) => n + g.length - 1, 0);
        const filas = grupos.slice(0, 60).map(g => `
            <tr>
                <td>${esc(g[0].nombre)}${g[0].talla ? ` <span class="texto-2">· T ${esc(g[0].talla)}</span>` : ""}<div class="chico texto-3">${esc(g[0].codigoBarras || "sin código")}</div></td>
                <td class="num">${g.length}</td>
                <td class="num">${g.map(p => numero(Number(p.stock) || 0)).join(" / ")}</td>
            </tr>`).join("");

        abrirModal({
            titulo: "Productos repetidos",
            html: `
                <p class="texto-2" style="margin:0 0 10px">Hay <strong>${numero(total)}</strong> producto(s) repetido(s) en <strong>${numero(grupos.length)}</strong> grupo(s) (mismo código de barras, o mismo nombre y talla si no tienen código). Se deja <strong>uno por grupo</strong> (el más antiguo) y los demás se borran en todos los equipos. Sus ventas pasan al que queda.</p>
                <div class="tabla-contenedor" style="max-height:300px;overflow:auto;margin-bottom:12px">
                    <table class="tabla"><thead><tr><th>Producto</th><th class="num">Copias</th><th class="num">Stock de cada copia</th></tr></thead><tbody>${filas}</tbody></table>
                    ${grupos.length > 60 ? `<p class="chico texto-3" style="margin:6px 0 0">… y ${numero(grupos.length - 60)} grupo(s) más.</p>` : ""}
                </div>
                <div class="campo"><label for="rpRegla">Stock que queda</label>
                    <select id="rpRegla">
                        <option value="antiguo">El del producto más antiguo (el primero que se cargó)</option>
                        <option value="menor">El menor de las copias</option>
                        <option value="suma">La suma de las copias</option>
                    </select>
                    <span class="ayuda">Después revise el stock de estos productos en el inventario.</span>
                </div>`,
            botones: [
                { texto: "Cancelar" },
                {
                    texto: `Quitar ${numero(total)} repetido(s)`, clase: "btn-primario",
                    accion: async (cerrar, raiz) => {
                        const n = Nube.quitarRepetidos($("#rpRegla", raiz).value);
                        cerrar();
                        avisar(`Listo: se quitaron ${numero(n)} producto(s) repetido(s).`);
                        if (typeof App !== "undefined") App.refrescar();
                    }
                }
            ]
        });
    },

    // pestaña "Nube" de Configuración
    pintar(contenedor) {

        const e = Nube.estado();

        if (!e.configurada) {
            contenedor.innerHTML = `<div class="tarjeta"><div class="tarjeta-cuerpo"><div class="mensaje-aviso">La nube no está configurada en esta copia del sistema.</div></div></div>`;
            return;
        }

        const ultima = e.ultima && e.ultima > "1971" ? fechaHora(e.ultima) : "—";

        contenedor.innerHTML = `
            <div class="tarjeta" style="max-width:640px">
                <div class="tarjeta-cabeza"><h3>Sincronización en la nube</h3></div>
                <div class="tarjeta-cuerpo">
                    ${e.conectado ? `
                        <div class="ficha-datos" style="margin-bottom:14px">
                            <div><div class="etiqueta">Cuenta</div><div class="dato">${Nube.rutDeCorreo(e.correo) ? "RUT " + esc(Nube.rutDeCorreo(e.correo)) : esc(e.correo)}</div></div>
                            <div><div class="etiqueta">Estado</div><div class="dato">${!e.enLinea ? "Sin internet" : e.error ? "Con problemas" : e.sincronizando ? "Sincronizando…" : e.pendientes ? "Pendiente de subir" : "Al día"}</div></div>
                            <div><div class="etiqueta">Cambios por subir</div><div class="dato">${e.pendientes}</div></div>
                            <div><div class="etiqueta">Última descarga</div><div class="dato">${esc(ultima)}</div></div>
                        </div>
                        ${e.error ? `<div class="mensaje-error" style="margin-bottom:12px">${esc(e.error)}</div>` : ""}
                        ${Nube.rutDeCorreo(e.correo) || window.SPORT_MODO === "vendedor" ? "" : `<div class="mensaje-info" style="margin-bottom:12px">Esta tienda se conecta con correo. Puede pasarla a <strong>RUT + clave</strong> para conectar los celulares más fácil. <button class="btn btn-chico" id="nbPasarRut" style="margin-left:6px">Pasar a RUT</button></div>`}
                        <p class="chico texto-2" style="margin:0 0 14px">Los equipos conectados a esta cuenta comparten productos, ventas, caja, posventa y usuarios. Si no hay internet, el sistema sigue funcionando y sube los cambios al volver.</p>
                        <div style="display:flex;gap:8px;flex-wrap:wrap">
                            <button class="btn btn-primario" id="nbSincronizar">Sincronizar ahora</button>
                            <button class="btn" id="nbRepetidos">Revisar productos repetidos</button>
                            <button class="btn btn-peligro" id="nbDesconectar">Desconectar este equipo</button>
                        </div>`
                    : `
                        <p class="texto-2" style="margin:0 0 14px">Conecte este equipo a la cuenta de la tienda para ver los mismos datos en el celular y en el computador.</p>
                        <button class="btn btn-primario" id="nbConectar">Conectar con la nube</button>`}
                    <p class="chico texto-3" style="margin:16px 0 0">No se sincronizan las fotos de productos, el carrito ni la configuración de impresora de cada equipo.</p>
                </div>
            </div>`;

        if (e.conectado && e.enLinea) {
            Nube.cuentaEnNube().then(n => {
                const celda = document.createElement("div");
                celda.innerHTML = `<div class="etiqueta">Registros en la nube</div><div class="dato">${numero(n)}</div>`;
                const ficha = $(".ficha-datos", contenedor);
                if (ficha) ficha.appendChild(celda);
            }).catch(() => { });
        }

        const bRut = $("#nbPasarRut", contenedor);
        if (bRut) bRut.addEventListener("click", () => NubeUI.pasarARut());

        const bConectar = $("#nbConectar", contenedor);
        if (bConectar) bConectar.addEventListener("click", () => NubeUI.conectar());

        const bSync = $("#nbSincronizar", contenedor);
        if (bSync) bSync.addEventListener("click", async () => { bSync.disabled = true; await Nube.sincronizar(); Configuracion.pintar(); });

        const bRep = $("#nbRepetidos", contenedor);
        if (bRep) bRep.addEventListener("click", () => NubeUI.revisarRepetidos());

        const bDes = $("#nbDesconectar", contenedor);
        if (bDes) bDes.addEventListener("click", async () => {
            if (!(await confirmar({ titulo: "Desconectar este equipo", mensaje: "Este equipo dejará de sincronizar. Sus datos se quedan aquí y en la nube no se borra nada.", textoSi: "Desconectar", peligro: true }))) return;
            await Nube.salir();
            Configuracion.pintar();
        });
    },

    // nubecita en la barra superior
    indicador() {

        const barra = document.querySelector(".barra");
        if (!barra || !Nube.configurada()) return;

        let boton = document.getElementById("btnNube");

        if (!boton) {
            boton = document.createElement("button");
            boton.type = "button";
            boton.id = "btnNube";
            boton.className = "btn btn-fantasma btn-icono";
            boton.addEventListener("click", () => { if (window.SPORT_MODO === "vendedor") return; Configuracion.pestana = "nube"; location.hash = "#configuracion"; if (typeof App !== "undefined" && document.getElementById("cfPestanas")) Configuracion.pintar(); });
            const tema = document.getElementById("btnTema");
            if (tema) barra.insertBefore(boton, tema); else barra.appendChild(boton);
        }

        const e = Nube.estado();
        const color = !e.conectado ? "var(--texto-3)" : (!e.enLinea || e.error) ? "var(--amarillo)" : e.pendientes || e.sincronizando ? "var(--amarillo)" : "var(--verde)";
        const texto = !e.conectado ? "Nube: sin conectar" : !e.enLinea ? "Sin internet: se sube al volver (" + e.pendientes + " pendientes)" : e.error ? "Nube con problemas: " + e.error : e.pendientes ? "Subiendo cambios…" : "Nube: al día";

        boton.style.color = color;
        boton.title = texto;
        boton.setAttribute("aria-label", texto);
        boton.innerHTML = '<svg class="icono" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 18a4 4 0 0 1-.6-7.96A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z"/>' +
            (e.conectado && e.enLinea && !e.error && !e.pendientes ? '<path d="M9.5 13.5l2 2 3.5-3.5"/>' : "") + '</svg>';
    }
};


Nube.alCambiar(() => NubeUI.indicador());

document.addEventListener("DOMContentLoaded", () => {
    Nube.iniciar();
    new MutationObserver(() => NubeUI.indicador()).observe(document.body, { childList: true });
    NubeUI.indicador();
});

// botón "ya uso SportPOS en otro equipo" de la pantalla de primer uso
document.addEventListener("click", e => {
    if (e.target.closest("#puNube")) NubeUI.conectar({ primerUso: true });
});
