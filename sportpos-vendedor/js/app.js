// ==========================================
// SPORTPOS — APLICACIÓN
// Primer uso, ingreso, menú y navegación
// ==========================================

"use strict";

const ORDEN_MENU = [
    { grupo: "Venta",      modulos: ["inicio", "vender", "ventas", "posventa", "caja"] },
    { grupo: "Productos",  modulos: ["productos", "inventario"] },
    { grupo: "Gestión",    modulos: ["reportes", "configuracion"] }
];


const App = {

    limpieza: null,
    intentosFallidos: 0,
    bloqueadoHasta: 0,


    iniciar() {

        const config =
            Datos.config();

        const soloVendedor = window.SPORT_MODO === "vendedor";

        if (!config.configurado) {
            if (soloVendedor) this.mostrarConectarVendedor();
            else this.mostrarPrimerUso();
            return;
        }

        // en la app de vendedores no puede quedar una sesion de administrador abierta
        if (soloVendedor && Sesion.usuario() && Sesion.usuario().rol === "admin") {
            Sesion.cerrar();
        }

        if (!Sesion.usuario()) {
            Sesion.cerrar();
            this.mostrarIngreso();
            return;
        }

        this.mostrarApp();
    },


    // ==========================================
    // PRIMER USO
    // ==========================================

    ladoPresentacion() {

        return `
            <div class="acceso-lado">
                <div class="marca">
                    <div class="marca-logo">${icono("bolsa")}</div>
                    ${SISTEMA.nombre}
                </div>
                <div>
                    <h1>Venda más y cambie sin enredos.</h1>
                    <p>El sistema de su tienda de zapatillas y ropa deportiva: tallas y colores, caja, cambios, devoluciones y garantías. Funciona en el computador y en el celular.</p>
                    <ul class="acceso-lista">
                        <li>${icono("carro")} Venta por talla y color, con lector de códigos</li>
                        <li>${icono("inventario")} Stock por talla y aviso de tallas por agotarse</li>
                        <li>${icono("cambio")} Cambios de talla, devoluciones y garantías</li>
                        <li>${icono("caja")} Apertura y cierre de caja con arqueo</li>
                    </ul>
                </div>
                <p style="font-size:12.5px">Versión ${SISTEMA.version}</p>
            </div>
        `;
    },


    // ==========================================
    // ENTRADA CON RUT (primera vez en cada equipo)
    // RUT + clave de la tienda: si la tienda existe se descargan sus datos;
    // si es nueva, se pide solo el nombre, el usuario y la contraseña.
    // ==========================================

    mostrarConectarVendedor() {
        this.mostrarEntradaRut();
    },


    mostrarPrimerUso() {
        if (Nube.configurada()) this.mostrarEntradaRut();
        else this.mostrarPrimerUsoLocal();
    },


    mostrarEntradaRut(mensaje) {

        const soloVendedor = window.SPORT_MODO === "vendedor";

        document.body.innerHTML = `
            <div class="acceso">
                ${this.ladoPresentacion()}
                <div class="acceso-form">
                    <form class="acceso-caja" id="formRut" novalidate>
                        <h2>${soloVendedor ? "SportPOS Vendedor" : "Bienvenido"}</h2>
                        <p class="sub">Escriba el RUT y la clave de la tienda. ${soloVendedor ? "Se descargan los productos y los usuarios." : "Si la tienda ya existe se descargan sus datos; si es nueva, se crea."}</p>
                        <div class="rejilla">
                            <div class="campo">
                                <label for="erRut">RUT de la tienda</label>
                                <input id="erRut" inputmode="text" autocomplete="username" autocapitalize="off" placeholder="76.123.456-7">
                            </div>
                            <div class="campo">
                                <label for="erClave">Clave de la tienda</label>
                                <input id="erClave" type="password" autocomplete="current-password" placeholder="Mínimo 6 caracteres">
                                <span class="ayuda">Es la misma en todos los equipos de la tienda (computador y celulares).</span>
                            </div>
                            <div id="erError" class="mensaje-error ${mensaje ? "" : "oculto"}">${mensaje ? esc(mensaje) : ""}</div>
                            <button class="btn btn-primario btn-grande" type="submit" id="erEntrar">Entrar ${icono("flecha")}</button>
                            ${soloVendedor ? "" : '<button type="button" class="btn btn-fantasma" id="erLocal">Usar este equipo sin nube</button>'}
                        </div>
                        <p class="chico texto-3 centro" style="margin-top:18px">${SISTEMA.nombre} versión ${SISTEMA.version}</p>
                    </form>
                </div>
            </div>
        `;

        setTimeout(() => $("#erRut").focus(), 30);

        $("#erRut").addEventListener("blur", e => {
            const v = e.target.value.trim();
            if (v && !v.includes("@") && validarRut(v)) e.target.value = formatearRut(v);
        });

        const bLocal = $("#erLocal");
        if (bLocal) bLocal.addEventListener("click", () => this.mostrarPrimerUsoLocal());

        $("#formRut").addEventListener("submit", async evento => {

            evento.preventDefault();

            const error = $("#erError");
            const boton = $("#erEntrar");
            const fallar = t => { error.textContent = t; error.classList.remove("oculto"); boton.disabled = false; boton.innerHTML = `Entrar ${icono("flecha")}`; };

            const texto = $("#erRut").value.trim();
            const clave = $("#erClave").value;

            if (!texto || !clave) return fallar("Escriba el RUT y la clave de la tienda.");
            if (!texto.includes("@") && !validarRut(texto)) return fallar("El RUT no es válido. Revise el número y el dígito verificador.");
            if (clave.length < 6) return fallar("La clave de la tienda tiene al menos 6 caracteres.");
            if (!navigator.onLine) return fallar("Se necesita internet la primera vez.");

            error.classList.add("oculto");
            boton.disabled = true;
            boton.textContent = "Buscando la tienda…";

            const correo = Nube.correoDeTienda(texto);

            try {
                await Nube.entrar(correo, clave, false);
            } catch (e) {
                const m = String((e && e.message) || e);
                if (!/incorrect/i.test(m)) return fallar(m);
                // no existe o la clave está mala: Supabase no dice cuál de las dos
                if (soloVendedor) return fallar("No encontramos una tienda con ese RUT y esa clave. Revise la clave con el administrador.");
                return this.preguntarTiendaNueva(texto, clave);
            }

            // la tienda existe
            try {
                const enNube = await Nube.cuentaEnNube();
                if (!enNube) {
                    if (soloVendedor) { await Nube.salir(); return fallar("La tienda aún no tiene datos. Primero configúrela en el computador."); }
                    return this.mostrarTiendaNueva(texto, true);
                }
                boton.textContent = "Descargando datos…";
                await Nube.primeraSincronizacion("nube");
                location.reload();
            } catch (e) {
                fallar(String((e && e.message) || e));
            }
        });
    },


    preguntarTiendaNueva(texto, clave) {

        abrirModal({
            titulo: "No encontramos esa tienda",
            clase: "angosto",
            html: `<p>No hay una tienda con el RUT <strong>${esc(texto)}</strong> y esa clave.</p>
                   <p style="margin-top:10px">Si la tienda ya existe, revise la clave. Si es una tienda nueva, créela ahora con esta clave.</p>
                   <div id="tnError" class="mensaje-error oculto" style="margin-top:12px"></div>`,
            botones: [
                { texto: "Revisar la clave", accion: cerrar => { cerrar(); this.mostrarEntradaRut(); $("#erRut").value = texto; $("#erClave").focus(); } },
                {
                    texto: "Crear tienda nueva",
                    clase: "btn-primario",
                    accion: async (cerrar, raiz) => {
                        const error = $("#tnError", raiz);
                        try {
                            await Nube.entrar(Nube.correoDeTienda(texto), clave, true);
                        } catch (e) {
                            const m = String((e && e.message) || e);
                            error.textContent = /ya tiene cuenta/i.test(m) ? "Ese RUT ya tiene una tienda: la clave no es correcta." : m;
                            error.classList.remove("oculto");
                            return;
                        }
                        cerrar();
                        this.mostrarTiendaNueva(texto, true);
                    }
                }
            ]
        });
    },


    // tienda nueva: solo nombre, usuario y contraseña (la cuenta de la nube ya está creada)
    mostrarTiendaNueva(rutTexto, conNube) {

        const esCorreo = String(rutTexto || "").includes("@");

        document.body.innerHTML = `
            <div class="acceso">
                ${this.ladoPresentacion()}
                <div class="acceso-form">
                    <form class="acceso-caja" id="formTienda" novalidate>
                        <h2>Tienda nueva</h2>
                        <p class="sub">${conNube ? "Último paso. " : ""}Estos datos se pueden cambiar después en Configuración.</p>
                        <div class="rejilla">
                            <div class="campo">
                                <label class="requerido" for="tnNombre">Nombre de la tienda</label>
                                <input id="tnNombre" placeholder="Sport Center">
                            </div>
                            <div class="campo">
                                <label ${conNube && !esCorreo ? "" : 'class="requerido"'} for="tnRut">RUT de la tienda</label>
                                <input id="tnRut" value="${esc(esCorreo ? "" : (validarRut(rutTexto || "") ? formatearRut(rutTexto) : (rutTexto || "")))}" ${conNube && !esCorreo ? "readonly" : ""} placeholder="76.123.456-7">
                            </div>
                            <div class="campo">
                                <label class="requerido" for="tnUsuario">Usuario del administrador</label>
                                <input id="tnUsuario" value="administrador" autocomplete="username" autocapitalize="off">
                            </div>
                            <div class="campo">
                                <label class="requerido" for="tnClave">Contraseña del administrador</label>
                                <input id="tnClave" type="password" autocomplete="new-password" placeholder="Mínimo 6 caracteres">
                                <label class="check" style="margin-top:4px"><input type="checkbox" id="tnVer"> Mostrar contraseña</label>
                            </div>
                            <div id="tnError2" class="mensaje-error oculto"></div>
                            <button class="btn btn-primario btn-grande" type="submit">Comenzar ${icono("flecha")}</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        setTimeout(() => $("#tnNombre").focus(), 30);

        $("#tnVer").addEventListener("change", e => { $("#tnClave").type = e.target.checked ? "text" : "password"; });
        $("#tnRut").addEventListener("blur", e => { if (validarRut(e.target.value)) e.target.value = formatearRut(e.target.value); });

        $("#formTienda").addEventListener("submit", async evento => {

            evento.preventDefault();

            const error = $("#tnError2");
            const fallar = t => { error.textContent = t; error.classList.remove("oculto"); };

            const nombre = $("#tnNombre").value.trim();
            const rut = $("#tnRut").value.trim();
            const usuario = normalizar($("#tnUsuario").value).replace(/\s+/g, "");
            const clave = $("#tnClave").value;

            if (!nombre || !usuario || !clave) return fallar("Complete los datos marcados con *.");
            if (rut && !validarRut(rut)) return fallar("El RUT de la tienda no es válido.");
            if (!conNube && !rut) return fallar("Escriba el RUT de la tienda.");
            if (clave.length < 6) return fallar("La contraseña debe tener al menos 6 caracteres.");

            const administrador = Object.assign(
                { id: nuevoId(), nombre: "Administrador", usuario, rol: "admin", activo: true, creado: new Date().toISOString() },
                await crearClave(clave)
            );

            const codigo = generarCodigoRecuperacion();

            Datos.guardarUsuarios([administrador]);

            Datos.guardarConfig({
                configurado: true,
                nombre,
                rut: rut ? formatearRut(rut) : "",
                quimico: "",
                mensajeBoleta: "Gracias por su compra",
                anchoPapel: "80",
                imprimirAuto: false,
                recuperacion: await crearClave(codigo.replace(/-/g, "")),
                creado: new Date().toISOString()
            });

            Sesion.iniciar(administrador);

            if (conNube) {
                try { await Nube.primeraSincronizacion("unir"); } catch (e) { /* se sube después, al volver internet */ }
            }

            mostrarCodigoRecuperacion(codigo, () => {
                location.hash = "#inicio";
                this.mostrarApp();
            });
        });
    },


    // sin nube: el mismo formulario corto, solo en este equipo
    mostrarPrimerUsoLocal() {
        this.mostrarTiendaNueva("", false);
    },


    // ==========================================
    // INGRESO
    // ==========================================

    mostrarIngreso() {

        const config =
            Datos.config();

        document.body.innerHTML = `
            <div class="acceso">
                ${this.ladoPresentacion()}
                <div class="acceso-form">
                    <form class="acceso-caja" id="formIngreso" novalidate>
                        <div class="marca" style="margin-bottom:26px">
                            <div class="marca-logo" style="background:var(--azul);color:#fff;${config.logo ? "background:#fff;border:1px solid var(--borde)" : ""}">
                                ${config.logo ? `<img src="${config.logo}" alt="">` : icono("bolsa")}
                            </div>
                            ${esc(config.nombre || "Tienda")}
                        </div>

                        <h2>Ingresar</h2>
                        <p class="sub">Escriba su usuario y contraseña.</p>

                        <div class="rejilla">
                            <div class="campo">
                                <label for="inUsuario">Usuario</label>
                                <input id="inUsuario" autocomplete="username" autofocus>
                            </div>
                            <div class="campo">
                                <label for="inClave">Contraseña</label>
                                <input id="inClave" type="password" autocomplete="current-password">
                            </div>

                            <div id="inError" class="mensaje-error oculto"></div>

                            <button class="btn btn-primario btn-grande" type="submit">Ingresar</button>

                            <button class="btn btn-fantasma" type="button" id="btnOlvide">¿Olvidó su contraseña?</button>
                            ${window.SPORT_MODO === "vendedor" && Nube.configurada() ? '<button class="btn btn-fantasma chico" type="button" id="btnOtraTienda">Conectar con otra tienda o con la clave nueva</button>' : ""}
                        </div>
                        <p class="chico texto-3 centro" style="margin-top:18px">${SISTEMA.nombre} versión ${SISTEMA.version}</p>
                    </form>
                </div>
            </div>
        `;

        setTimeout(() => $("#inUsuario").focus(), 30);

        // app de vendedores: volver a conectar (otra tienda, o la tienda pasó a RUT / cambió su clave)
        const bOtra = $("#btnOtraTienda");
        if (bOtra) bOtra.addEventListener("click", async () => {
            if (Nube.estado().conectado) {
                await Nube.sincronizar();
                if (Nube.estado().pendientes) { avisar("Hay ventas sin subir. Conéctese a internet y vuelva a intentar.", "error"); return; }
            }
            if (!(await confirmar({ titulo: "Volver a conectar", mensaje: "Este celular se desconecta y se borra su copia de los datos. Después se entra con el RUT y la clave de la tienda y se descarga todo de nuevo.", textoSi: "Continuar", peligro: true }))) return;
            await Nube.salir();
            ["productos", "ventas", "movimientos", "posventa", "usuarios", "cierres", "config", "caja", "contadores", "carrito", "sesion"].forEach(k => DB.borrar(k));
            this.mostrarEntradaRut();
        });


        $("#formIngreso").addEventListener(
            "submit",
            async evento => {

                evento.preventDefault();

                const error = $("#inError");

                const mostrarError = texto => {
                    error.textContent = texto;
                    error.classList.remove("oculto");
                };

                if (Date.now() < this.bloqueadoHasta) {
                    const segundos = Math.ceil((this.bloqueadoHasta - Date.now()) / 1000);
                    mostrarError(`Demasiados intentos. Espere ${segundos} segundos.`);
                    return;
                }

                const usuarioTexto = normalizar($("#inUsuario").value).replace(/\s+/g, "");
                const clave = $("#inClave").value;

                if (!usuarioTexto || !clave) {
                    mostrarError("Escriba su usuario y contraseña.");
                    return;
                }

                const boton = $("#formIngreso button[type=submit]");
                boton.disabled = true;

                // Puede haber dos usuarios con el mismo nombre de ingreso (por ejemplo, al unir
                // los datos de dos equipos en la nube). Se prueba la contraseña con cada uno.
                const candidatos =
                    Datos.usuariosVigentes().filter(u => normalizar(u.usuario).replace(/\s+/g, "") === usuarioTexto);

                let usuario = null;
                for (const u of candidatos) {
                    if (await verificarClave(u, clave)) { usuario = u; break; }
                }

                const correcto = Boolean(usuario);

                boton.disabled = false;

                if (!correcto) {

                    this.intentosFallidos++;

                    if (this.intentosFallidos >= 5) {
                        this.bloqueadoHasta = Date.now() + 30000;
                        this.intentosFallidos = 0;
                    }

                    mostrarError("Usuario o contraseña incorrectos.");
                    $("#inClave").value = "";
                    $("#inClave").focus();
                    return;
                }

                if (!usuario.activo) {
                    mostrarError("Este usuario está desactivado. Hable con el administrador.");
                    return;
                }

                if (window.SPORT_MODO === "vendedor" && usuario.rol === "admin") {
                    mostrarError("Esta aplicación es solo para vendedores. El administrador usa la aplicación SportPOS.");
                    return;
                }

                this.intentosFallidos = 0;

                const usuarios = Datos.usuarios();
                const registro = usuarios.find(u => u.id === usuario.id);
                registro.ultimoAcceso = new Date().toISOString();
                Datos.guardarUsuarios(usuarios);

                Sesion.iniciar(usuario);

                location.hash =
                    usuario.rol === "admin" ? "#inicio" : "#vender";

                this.mostrarApp();
            }
        );


        $("#btnOlvide").addEventListener("click", () => recuperarAcceso());
    },


    // ==========================================
    // ESTRUCTURA PRINCIPAL
    // ==========================================

    mostrarApp() {

        document.body.innerHTML = `
            <div class="app" id="app">
                <aside class="menu" id="menu">
                    <div class="menu-cabeza">
                        <div class="marca">
                            <div class="marca-logo" id="menuLogo"></div>
                            <div style="min-width:0">
                                <div class="nombre-farmacia" id="menuNombre"></div>
                                <div class="sistema">${SISTEMA.nombre}</div>
                            </div>
                        </div>
                    </div>
                    <nav class="menu-nav" id="menuNav"></nav>
                    <div class="menu-pie">
                        <div class="usuario-tarjeta" id="tarjetaUsuario" title="Mi cuenta">
                            <div class="avatar" id="avatarUsuario"></div>
                            <div class="datos">
                                <div class="nombre" id="nombreUsuario"></div>
                                <div class="rol" id="rolUsuario"></div>
                            </div>
                            <button class="btn btn-fantasma btn-icono" id="btnSalir" title="Cerrar sesión" aria-label="Cerrar sesión">${icono("salir")}</button>
                        </div>
                        <button class="btn btn-salir-movil" id="btnSalirMovil" type="button">${icono("salir")} Cerrar sesión</button>
                    </div>
                </aside>
                <div class="fondo-menu" id="fondoMenu"></div>
                <div class="principal">
                    <header class="barra">
                        <button class="btn btn-fantasma btn-icono btn-menu" id="btnMenu" aria-label="Abrir menú">${icono("menu")}</button>
                        <div class="marca-logo barra-logo" id="barraLogo"></div>
                        <h1 id="tituloVista"></h1>
                        <div class="espacio"></div>
                        <span class="reloj" id="reloj"></span>
                        <span class="estado-caja" id="estadoCaja"></span>
                    </header>
                    <main class="vista" id="vista"></main>
                </div>
                <nav class="nav-inferior" id="navInferior" aria-label="Menú principal"></nav>
            </div>
        `;

        this.pintarCabeceraMenu();


        $("#btnMenu").addEventListener("click", () => $("#app").classList.add("menu-abierto"));
        $("#fondoMenu").addEventListener("click", () => $("#app").classList.remove("menu-abierto"));

        [$("#btnSalir"), $("#btnSalirMovil")].forEach(boton => boton.addEventListener(
            "click",
            async evento => {

                evento.stopPropagation();

                const ok = await confirmar({
                    titulo: "Cerrar sesión",
                    mensaje: "¿Desea salir del sistema?",
                    textoSi: "Salir"
                });

                if (ok) {
                    Sesion.cerrar();
                    location.hash = "";
                    this.mostrarIngreso();
                }
            }
        ));

        $("#tarjetaUsuario").addEventListener("click", () => abrirMiCuenta());

        $("#estadoCaja").addEventListener("click", () => { location.hash = "#caja"; });


        const pintarReloj = () => {
            const reloj = $("#reloj");
            if (reloj) {
                reloj.textContent = fechaLarga() + " · " + hora(new Date().toISOString());
            }
        };

        pintarReloj();
        clearInterval(this.intervaloReloj);
        this.intervaloReloj = setInterval(pintarReloj, 20000);

        this.navegar();
    },


    pintarCabeceraMenu() {

        const config = Datos.config();
        const usuario = Sesion.usuario();

        const logo = $("#menuLogo");

        logo.classList.toggle("con-imagen", Boolean(config.logo));
        logo.innerHTML = config.logo ? `<img src="${config.logo}" alt="">` : icono("bolsa");

        $("#menuNombre").textContent = config.nombre || "Tienda";

        // En celular, el logo de la tienda va arriba a la izquierda
        const logoBarra = $("#barraLogo");

        logoBarra.classList.toggle("con-imagen", Boolean(config.logo));
        logoBarra.innerHTML = config.logo ? `<img src="${config.logo}" alt="">` : icono("bolsa");
        logoBarra.title = config.nombre || "Tienda";

        if (usuario) {
            $("#avatarUsuario").textContent = iniciales(usuario.nombre);
            $("#nombreUsuario").textContent = usuario.nombre;
            $("#rolUsuario").textContent = ROLES[usuario.rol] || usuario.rol;
        }
    },


    modulosPermitidos() {

        const usuario =
            Sesion.usuario();

        return Object.keys(Modulos).filter(
            nombre => usuario && Modulos[nombre].roles.includes(usuario.rol)
        );
    },


    pintarMenu(actual) {

        const permitidos =
            this.modulosPermitidos();

        $("#menuNav").innerHTML =
            ORDEN_MENU.map(
                seccion => {

                    const items =
                        seccion.modulos.filter(nombre => permitidos.includes(nombre));

                    if (!items.length) {
                        return "";
                    }

                    return `
                        <div class="menu-grupo">${seccion.grupo}</div>
                        ${items.map(nombre => {
                            const modulo = Modulos[nombre];
                            const contador = modulo.contador ? modulo.contador() : 0;
                            return `
                                <a href="#${nombre}" class="menu-item ${nombre === actual ? "activo" : ""}">
                                    ${icono(modulo.icono)}
                                    <span>${esc(modulo.menu || modulo.titulo)}</span>
                                    ${contador ? `<span class="contador">${contador > 99 ? "99+" : contador}</span>` : ""}
                                </a>
                            `;
                        }).join("")}
                    `;
                }
            ).join("");
    },


    // Barra inferior en celular: accesos principales + "Más"
    pintarNavInferior(actual) {

        const nav =
            $("#navInferior");

        if (!nav) {
            return;
        }

        const principales =
            ["inicio", "vender", "ventas", "caja"].filter(nombre => this.modulosPermitidos().includes(nombre));

        nav.innerHTML =
            principales.map(nombre => `
                <a href="#${nombre}" class="${nombre === actual ? "activo" : ""}">
                    ${icono(Modulos[nombre].icono)}
                    <span>${esc(Modulos[nombre].menu || Modulos[nombre].titulo)}</span>
                </a>
            `).join("") + `
                <button type="button" id="navMas" class="${principales.includes(actual) ? "" : "activo"}">
                    ${icono("menu")}
                    <span>Más</span>
                </button>
            `;

        $("#navMas").addEventListener("click", () => $("#app").classList.add("menu-abierto"));
    },


    actualizarBarra() {

        const estado =
            $("#estadoCaja");

        if (!estado) {
            return;
        }

        const caja =
            Datos.cajaActual();

        estado.classList.toggle("abierta", Boolean(caja));

        estado.innerHTML =
            caja
                ? '<span class="texto-largo">Caja abierta</span><span class="texto-corto">Abierta</span>'
                : '<span class="texto-largo">Caja cerrada</span><span class="texto-corto">Cerrada</span>';

        estado.title =
            caja ? "Abierta por " + caja.abiertaPor + " a las " + hora(caja.abiertaEn) : "Clic para abrir la caja";
    },


    navegar() {

        if (!$("#vista")) {
            return;
        }

        const usuario =
            Sesion.usuario();

        if (!usuario) {
            Sesion.cerrar();
            this.mostrarIngreso();
            return;
        }


        const permitidos =
            this.modulosPermitidos();

        let nombre =
            location.hash.replace("#", "").split("?")[0];

        if (!permitidos.includes(nombre)) {

            nombre =
                usuario.rol === "admin" ? "inicio" : "vender";

            if (location.hash !== "#" + nombre) {
                history.replaceState(null, "", "#" + nombre);
            }
        }


        if (typeof this.limpieza === "function") {
            this.limpieza();
        }

        this.limpieza = null;


        const modulo =
            Modulos[nombre];

        $("#tituloVista").textContent = modulo.titulo;
        document.title = modulo.titulo + " · " + (Datos.config().nombre || SISTEMA.nombre);

        $("#app").classList.remove("menu-abierto");

        this.pintarMenu(nombre);
        this.pintarNavInferior(nombre);
        this.actualizarBarra();

        // Contenedor nuevo en cada pantalla: así no se acumulan eventos
        const anterior = $("#vista");
        const vista = anterior.cloneNode(false);
        anterior.replaceWith(vista);
        window.scrollTo(0, 0);

        this.limpieza =
            modulo.render(vista) || null;
    },


    // Vuelve a dibujar la pantalla actual
    refrescar() {
        this.navegar();
    }
};


// ==========================================
// CÓDIGO DE RECUPERACIÓN
// ==========================================

function generarCodigoRecuperacion() {

    const letras =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    const bytes =
        new Uint8Array(16);

    crypto.getRandomValues(bytes);

    let codigo = "";

    bytes.forEach(
        (byte, i) => {
            codigo += letras[byte % letras.length];
            if (i % 4 === 3 && i < 15) {
                codigo += "-";
            }
        }
    );

    return codigo;
}


function mostrarCodigoRecuperacion(codigo, alTerminar) {

    const config =
        Datos.config();

    abrirModal({
        titulo: "Guarde su código de recuperación",
        cerrable: false,
        html: `
            <p style="margin-bottom:14px">Si el administrador olvida su contraseña, este código permite crear una nueva. <strong>Guárdelo en un lugar seguro</strong>: no se volverá a mostrar.</p>
            <div class="codigo-recuperacion">${esc(codigo)}</div>
            <div class="fila" style="margin-top:14px">
                <button class="btn" type="button" id="btnDescargarCodigo">${icono("descargar")} Descargar como archivo</button>
                <button class="btn" type="button" id="btnImprimirCodigo">${icono("impresora")} Imprimir</button>
            </div>
            <label class="check" style="margin-top:18px">
                <input type="checkbox" id="chkCodigoGuardado"> Ya guardé el código
            </label>
            <p class="rojo chico oculto" id="errCodigo" style="margin-top:6px">Marque la casilla para continuar.</p>
        `,
        alAbrir(raiz) {

            const texto =
                `${SISTEMA.nombre} — Código de recuperación\r\n` +
                `Tienda: ${config.nombre}\r\n` +
                `Código: ${codigo}\r\n` +
                `Generado: ${fechaHora(new Date().toISOString())}\r\n\r\n` +
                `Úselo en la pantalla de ingreso, en "¿Olvidó su contraseña?".`;

            $("#btnDescargarCodigo", raiz).addEventListener(
                "click",
                () => descargarArchivo("codigo-recuperacion-tienda.txt", texto, "text/plain")
            );

            $("#btnImprimirCodigo", raiz).addEventListener(
                "click",
                () => Impresion.documento(
                    "Código de recuperación",
                    "Guárdelo en un lugar seguro",
                    `<p style="font-size:14px">Si el administrador olvida su contraseña, use este código en la pantalla de ingreso, en "¿Olvidó su contraseña?".</p>
                     <p style="font-size:26px;font-family:Consolas,monospace;font-weight:700;letter-spacing:2px;border:2px dashed #1d5fd1;padding:16px;text-align:center">${esc(codigo)}</p>`
                )
            );
        },
        botones: [
            {
                texto: "Continuar",
                clase: "btn-primario",
                accion: (cerrar, raiz) => {

                    if (!$("#chkCodigoGuardado", raiz).checked) {
                        $("#errCodigo", raiz).classList.remove("oculto");
                        return;
                    }

                    cerrar();

                    if (alTerminar) {
                        alTerminar();
                    }
                }
            }
        ]
    });
}


function recuperarAcceso() {

    abrirModal({
        titulo: "Recuperar acceso",
        html: `
            <p style="margin-bottom:14px">Escriba el código de recuperación que se entregó al configurar la tienda y elija una contraseña nueva para un administrador.</p>
            <div class="rejilla">
                <div class="campo">
                    <label for="recCodigo">Código de recuperación</label>
                    <input id="recCodigo" placeholder="XXXX-XXXX-XXXX-XXXX" style="font-family:Consolas,monospace;text-transform:uppercase">
                </div>
                <div class="campo">
                    <label for="recUsuario">Usuario administrador</label>
                    <input id="recUsuario" autocomplete="username">
                </div>
                <div class="rejilla rejilla-2">
                    <div class="campo">
                        <label for="recClave">Contraseña nueva</label>
                        <input id="recClave" type="password" autocomplete="new-password">
                    </div>
                    <div class="campo">
                        <label for="recClave2">Repetir</label>
                        <input id="recClave2" type="password" autocomplete="new-password">
                    </div>
                </div>
                <div id="recError" class="mensaje-error oculto"></div>
            </div>
        `,
        botones: [
            { texto: "Cancelar" },
            {
                texto: "Cambiar contraseña",
                clase: "btn-primario",
                accion: async (cerrar, raiz) => {

                    const error = $("#recError", raiz);

                    const mostrarError = texto => {
                        error.textContent = texto;
                        error.classList.remove("oculto");
                    };

                    const codigo = $("#recCodigo", raiz).value.toUpperCase().replace(/[^A-Z0-9]/g, "");
                    const usuarioTexto = normalizar($("#recUsuario", raiz).value).replace(/\s+/g, "");
                    const clave = $("#recClave", raiz).value;

                    if (!codigo || !usuarioTexto || !clave) {
                        mostrarError("Complete todos los datos.");
                        return;
                    }

                    if (clave.length < 6) {
                        mostrarError("La contraseña debe tener al menos 6 caracteres.");
                        return;
                    }

                    if (clave !== $("#recClave2", raiz).value) {
                        mostrarError("Las contraseñas no coinciden.");
                        return;
                    }

                    const config = Datos.config();

                    if (!(await verificarClave(config.recuperacion, codigo))) {
                        mostrarError("El código de recuperación no es correcto.");
                        return;
                    }

                    const usuarios = Datos.usuarios();
                    const usuario = usuarios.find(u => u.usuario === usuarioTexto && u.rol === "admin" && !u.borrado);

                    if (!usuario) {
                        mostrarError("No existe un administrador con ese usuario.");
                        return;
                    }

                    Object.assign(usuario, await crearClave(clave), { activo: true });

                    Datos.guardarUsuarios(usuarios);

                    cerrar();

                    avisar("Contraseña cambiada. Ya puede ingresar.");
                }
            }
        ]
    });
}


// ==========================================
// MI CUENTA
// ==========================================

function abrirMiCuenta() {

    const usuario =
        Sesion.usuario();

    if (!usuario) {
        return;
    }

    abrirModal({
        titulo: "Mi cuenta",
        clase: "angosto",
        html: `
            <div class="fila" style="margin-bottom:18px">
                <div class="avatar" style="width:46px;height:46px;font-size:16px">${esc(iniciales(usuario.nombre))}</div>
                <div>
                    <div class="negrita">${esc(usuario.nombre)}</div>
                    <div class="texto-2 chico">Usuario: ${esc(usuario.usuario)} · ${esc(ROLES[usuario.rol] || usuario.rol)}</div>
                </div>
            </div>
            <div class="seccion-form" style="margin-bottom:12px">Cambiar mi contraseña</div>
            <div class="rejilla">
                <div class="campo">
                    <label for="mcActual">Contraseña actual</label>
                    <input id="mcActual" type="password" autocomplete="current-password">
                </div>
                <div class="campo">
                    <label for="mcNueva">Contraseña nueva</label>
                    <input id="mcNueva" type="password" autocomplete="new-password">
                </div>
                <div class="campo">
                    <label for="mcNueva2">Repetir contraseña nueva</label>
                    <input id="mcNueva2" type="password" autocomplete="new-password">
                </div>
                <div id="mcError" class="mensaje-error oculto"></div>
            </div>
        `,
        botones: [
            { texto: "Cerrar" },
            {
                texto: "Cambiar contraseña",
                clase: "btn-primario",
                accion: async (cerrar, raiz) => {

                    const error = $("#mcError", raiz);

                    const mostrarError = texto => {
                        error.textContent = texto;
                        error.classList.remove("oculto");
                    };

                    const usuarios = Datos.usuarios();
                    const registro = usuarios.find(u => u.id === usuario.id);
                    const nueva = $("#mcNueva", raiz).value;

                    if (!(await verificarClave(registro, $("#mcActual", raiz).value))) {
                        mostrarError("La contraseña actual no es correcta.");
                        return;
                    }

                    if (nueva.length < 6) {
                        mostrarError("La contraseña nueva debe tener al menos 6 caracteres.");
                        return;
                    }

                    if (nueva !== $("#mcNueva2", raiz).value) {
                        mostrarError("Las contraseñas nuevas no coinciden.");
                        return;
                    }

                    Object.assign(registro, await crearClave(nueva));

                    Datos.guardarUsuarios(usuarios);

                    cerrar();

                    avisar("Contraseña cambiada.");
                }
            }
        ]
    });
}


// ==========================================
// ARRANQUE
// ==========================================

window.addEventListener("hashchange", () => App.navegar());

document.addEventListener(
    "DOMContentLoaded",
    () => Fotos.cargarCache().finally(() => { App.iniciar(); setTimeout(() => Fotos.descargarFaltantes(), 4000); })
);
