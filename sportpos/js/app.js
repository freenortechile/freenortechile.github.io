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


    // app de vendedores: no se crea la tienda aqui, solo se conecta a la que ya existe
    mostrarConectarVendedor() {

        document.body.innerHTML = `
            <div class="acceso">
                ${this.ladoPresentacion()}
                <div class="acceso-form">
                    <div class="acceso-caja">
                        <h2>SportPOS Vendedor</h2>
                        <p class="sub">Esta aplicación es solo para vendedores. Conéctela con la cuenta de la tienda para descargar productos y usuarios.</p>
                        <div class="rejilla">
                            <button type="button" class="btn btn-primario btn-grande" id="puNube">Conectar con la tienda</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },


    mostrarPrimerUso() {

        document.body.innerHTML = `
            <div class="acceso">
                ${this.ladoPresentacion()}
                <div class="acceso-form">
                    <form class="acceso-caja ancha" id="formPrimerUso" novalidate>
                        <h2>Bienvenido</h2>
                        <p class="sub">Configure su tienda en un minuto. Podrá cambiar estos datos después.</p>

                        <div class="rejilla rejilla-2">
                            <div class="seccion-form col-todo">Datos de la tienda</div>
                            <div class="campo col-todo">
                                <label class="requerido" for="puNombre">Nombre de la tienda</label>
                                <input id="puNombre" placeholder="Sport Center" autofocus>
                            </div>
                            <div class="campo">
                                <label for="puRut">RUT</label>
                                <input id="puRut" placeholder="76.123.456-7">
                            </div>
                            <div class="campo">
                                <label for="puQuimico">Giro</label>
                                <input id="puQuimico" placeholder="Venta de zapatillas y ropa deportiva">
                            </div>

                            <div class="seccion-form col-todo">Usuario administrador</div>
                            <div class="campo">
                                <label class="requerido" for="puAdminNombre">Su nombre</label>
                                <input id="puAdminNombre" placeholder="María González">
                            </div>
                            <div class="campo">
                                <label class="requerido" for="puUsuario">Usuario para ingresar</label>
                                <input id="puUsuario" placeholder="maria" autocomplete="username">
                            </div>
                            <div class="campo">
                                <label class="requerido" for="puClave">Contraseña</label>
                                <input id="puClave" type="password" autocomplete="new-password">
                                <span class="ayuda">Mínimo 6 caracteres</span>
                            </div>
                            <div class="campo">
                                <label class="requerido" for="puClave2">Repetir contraseña</label>
                                <input id="puClave2" type="password" autocomplete="new-password">
                            </div>

                            <label class="check col-todo">
                                <input type="checkbox" id="puEjemplo" checked>
                                Cargar productos de ejemplo para probar
                            </label>

                            <div id="puError" class="mensaje-error col-todo oculto"></div>

                            <button class="btn btn-primario btn-grande col-todo" type="submit">
                                Comenzar ${icono("flecha")}
                            </button>
                            ${Nube.configurada() ? '<button type="button" class="btn btn-fantasma btn-bloque col-todo" id="puNube">Ya uso SportPOS en otro equipo: conectar con la nube</button>' : ""}
                        </div>
                    </form>
                </div>
            </div>
        `;


        $("#puRut").addEventListener(
            "blur",
            evento => {
                if (evento.target.value.trim()) {
                    evento.target.value = formatearRut(evento.target.value);
                }
            }
        );


        $("#formPrimerUso").addEventListener(
            "submit",
            async evento => {

                evento.preventDefault();

                const error = $("#puError");

                const mostrarError = texto => {
                    error.textContent = texto;
                    error.classList.remove("oculto");
                };

                const nombre = $("#puNombre").value.trim();
                const rut = $("#puRut").value.trim();
                const adminNombre = $("#puAdminNombre").value.trim();
                const usuario = normalizar($("#puUsuario").value).replace(/\s+/g, "");
                const clave = $("#puClave").value;
                const clave2 = $("#puClave2").value;

                if (!nombre || !adminNombre || !usuario || !clave) {
                    mostrarError("Complete los datos marcados con *.");
                    return;
                }

                if (rut && !validarRut(rut)) {
                    mostrarError("El RUT de la tienda no es válido.");
                    return;
                }

                if (clave.length < 6) {
                    mostrarError("La contraseña debe tener al menos 6 caracteres.");
                    return;
                }

                if (clave !== clave2) {
                    mostrarError("Las contraseñas no coinciden.");
                    return;
                }


                const administrador = Object.assign(
                    {
                        id: nuevoId(),
                        nombre: adminNombre,
                        usuario,
                        rol: "admin",
                        activo: true,
                        creado: new Date().toISOString()
                    },
                    await crearClave(clave)
                );

                const codigo =
                    generarCodigoRecuperacion();

                Datos.guardarUsuarios([administrador]);

                Datos.guardarConfig({
                    configurado: true,
                    nombre,
                    rut: rut ? formatearRut(rut) : "",
                    quimico: $("#puQuimico").value.trim(),
                    mensajeBoleta: "Gracias por su compra",
                    anchoPapel: "80",
                    imprimirAuto: false,
                    recuperacion: await crearClave(codigo.replace(/-/g, "")),
                    creado: new Date().toISOString()
                });

                if ($("#puEjemplo").checked && typeof cargarDatosEjemplo === "function") {
                    cargarDatosEjemplo();
                }

                Sesion.iniciar(administrador);

                mostrarCodigoRecuperacion(
                    codigo,
                    () => {
                        location.hash = "#inicio";
                        this.mostrarApp();
                    }
                );
            }
        );
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
                        </div>
                    </form>
                </div>
            </div>
        `;

        setTimeout(() => $("#inUsuario").focus(), 30);


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

                const usuario =
                    Datos.usuarios().find(u => u.usuario === usuarioTexto);

                const correcto =
                    usuario && await verificarClave(usuario, clave);

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
                    const usuario = usuarios.find(u => u.usuario === usuarioTexto && u.rol === "admin");

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
