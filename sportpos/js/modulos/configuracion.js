// ==========================================
// SPORTPOS — CONFIGURACIÓN
// Tienda, comprobante, usuarios, respaldo
// ==========================================

"use strict";

const Configuracion = {

    pestana: "farmacia",


    render(vista) {

        vista.innerHTML = `
            <div class="pestanas" id="cfPestanas">
                <button class="pestana" data-pestana="farmacia">${icono("tienda")} <span>Tienda</span></button>
                <button class="pestana" data-pestana="comprobante">${icono("impresora")} <span class="texto-largo">Comprobante</span><span class="texto-corto">Impresión</span></button>
                <button class="pestana" data-pestana="usuarios">${icono("usuarios")} <span>Usuarios</span></button>
                <button class="pestana" data-pestana="nube">${icono("base")} <span>Nube</span></button>
                <button class="pestana" data-pestana="respaldo">${icono("base")} <span>Respaldo</span></button>
                <button class="pestana" data-pestana="sistema">${icono("llave")} <span class="texto-largo">Seguridad y sistema</span><span class="texto-corto">Sistema</span></button>
            </div>
            <div id="cfContenido"></div>
        `;

        $("#cfPestanas").addEventListener("click", evento => {
            const boton = evento.target.closest("[data-pestana]");
            if (boton) {
                this.pestana = boton.dataset.pestana;
                this.pintar();
            }
        });

        this.pintar();
    },


    pintar() {

        $$("#cfPestanas .pestana").forEach(p => p.classList.toggle("activa", p.dataset.pestana === this.pestana));

        // Contenedor nuevo: así no se acumulan eventos de la pestaña anterior
        const anterior = $("#cfContenido");
        anterior.replaceWith(anterior.cloneNode(false));

        const pintores = {
            farmacia: () => this.pintarFarmacia(),
            comprobante: () => this.pintarComprobante(),
            usuarios: () => this.pintarUsuarios(),
            nube: () => NubeUI.pintar($("#cfContenido")),
            respaldo: () => this.pintarRespaldo(),
            sistema: () => this.pintarSistema()
        };

        (pintores[this.pestana] || pintores.farmacia)();
    },


    // ==========================================
    // DATOS DE LA FARMACIA
    // ==========================================

    pintarFarmacia() {

        const c = Datos.config();

        $("#cfContenido").innerHTML = `
            <div class="tarjeta" style="max-width:860px">
                <div class="tarjeta-cabeza"><h3>Datos de la tienda</h3><span class="chico texto-2">Aparecen en el comprobante y los informes</span></div>
                <div class="tarjeta-cuerpo">
                    <div class="fila" style="align-items:flex-start;gap:20px;margin-bottom:18px">
                        <div class="logo-vista" id="cfLogoVista">${c.logo ? `<img src="${c.logo}" alt="Logo">` : icono("tienda")}</div>
                        <div>
                            <div class="negrita" style="margin-bottom:4px">Logo</div>
                            <p class="chico texto-2" style="margin-bottom:10px">Imagen PNG o JPG. Se ajusta automáticamente.</p>
                            <div class="fila">
                                <label class="btn btn-chico">${icono("subir")} Subir logo<input type="file" id="cfLogo" accept="image/*" class="oculto"></label>
                                ${c.logo ? '<button class="btn btn-chico btn-peligro" id="cfQuitarLogo">Quitar</button>' : ""}
                            </div>
                        </div>
                    </div>
                    <div class="rejilla rejilla-2">
                        <div class="campo"><label class="requerido" for="cfNombre">Nombre de fantasía</label><input id="cfNombre" value="${esc(c.nombre || "")}"></div>
                        <div class="campo"><label for="cfRazon">Razón social</label><input id="cfRazon" value="${esc(c.razonSocial || "")}"></div>
                        <div class="campo"><label for="cfRut">RUT</label><input id="cfRut" value="${esc(c.rut || "")}" placeholder="76.123.456-7"></div>
                        <div class="campo"><label for="cfTelefono">Teléfono</label><input id="cfTelefono" value="${esc(c.telefono || "")}"></div>
                        <div class="campo"><label for="cfDireccion">Dirección</label><input id="cfDireccion" value="${esc(c.direccion || "")}"></div>
                        <div class="campo"><label for="cfComuna">Comuna / ciudad</label><input id="cfComuna" value="${esc(c.comuna || "")}"></div>
                        <div class="campo"><label for="cfCorreo">Correo</label><input id="cfCorreo" type="email" value="${esc(c.correo || "")}"></div>
                        <div class="campo"><label for="cfQuimico">Giro</label><input id="cfQuimico" value="${esc(c.quimico || "")}" placeholder="Venta de zapatillas y ropa deportiva"></div>
                        <div class="campo"><label for="cfResolucion">Horario de atención</label><input id="cfResolucion" value="${esc(c.resolucion || "")}" placeholder="Lun a sáb 9:00 a 20:00"></div>
                        <div id="cfError" class="mensaje-error col-todo oculto"></div>
                        <div class="col-todo"><button class="btn btn-primario" id="cfGuardar">${icono("check")} Guardar datos</button></div>
                    </div>
                </div>
            </div>
        `;

        $("#cfRut").addEventListener("blur", e => { if (e.target.value.trim()) e.target.value = formatearRut(e.target.value); });

        $("#cfLogo").addEventListener("change", async evento => {

            const archivo = evento.target.files[0];

            if (!archivo) return;

            try {
                const config = Datos.config();
                config.logo = await reducirImagen(archivo, 240);
                Datos.guardarConfig(config);
                App.pintarCabeceraMenu();
                this.pintarFarmacia();
                avisar("Logo actualizado.");
            } catch (error) {
                avisar(error.message, "error");
            }
        });

        const quitar = $("#cfQuitarLogo");

        if (quitar) {
            quitar.addEventListener("click", () => {
                const config = Datos.config();
                delete config.logo;
                Datos.guardarConfig(config);
                App.pintarCabeceraMenu();
                this.pintarFarmacia();
            });
        }

        $("#cfGuardar").addEventListener("click", () => {

            const error = $("#cfError");
            const nombre = $("#cfNombre").value.trim();
            const rut = $("#cfRut").value.trim();

            if (!nombre) {
                error.textContent = "Escriba el nombre de la tienda.";
                error.classList.remove("oculto");
                return;
            }

            if (rut && !validarRut(rut)) {
                error.textContent = "El RUT no es válido.";
                error.classList.remove("oculto");
                return;
            }

            const config = Datos.config();

            Object.assign(config, {
                nombre,
                razonSocial: $("#cfRazon").value.trim(),
                rut: rut ? formatearRut(rut) : "",
                telefono: $("#cfTelefono").value.trim(),
                direccion: $("#cfDireccion").value.trim(),
                comuna: $("#cfComuna").value.trim(),
                correo: $("#cfCorreo").value.trim(),
                quimico: $("#cfQuimico").value.trim(),
                resolucion: $("#cfResolucion").value.trim()
            });

            Datos.guardarConfig(config);

            error.classList.add("oculto");

            App.pintarCabeceraMenu();

            avisar("Datos guardados.");
        });
    },


    // ==========================================
    // COMPROBANTE
    // ==========================================

    pintarComprobante() {

        const c = Datos.config();

        $("#cfContenido").innerHTML = `
            <div class="tarjeta" style="max-width:700px">
                <div class="tarjeta-cabeza"><h3>Comprobante de venta</h3></div>
                <div class="tarjeta-cuerpo">
                    <div class="rejilla">
                        <div class="campo">
                            <label for="cbAncho">Ancho del papel de la impresora</label>
                            <select id="cbAncho">
                                <option value="80" ${c.anchoPapel !== "58" ? "selected" : ""}>80 mm (la más común)</option>
                                <option value="58" ${c.anchoPapel === "58" ? "selected" : ""}>58 mm (pequeña)</option>
                            </select>
                        </div>
                        <div class="campo">
                            <label for="cbMensaje">Mensaje al pie</label>
                            <input id="cbMensaje" value="${esc(c.mensajeBoleta || "")}" placeholder="Gracias por su preferencia">
                        </div>
                        <label class="check"><input type="checkbox" id="cbAuto" ${c.imprimirAuto ? "checked" : ""}> Imprimir automáticamente al terminar cada venta</label>
                        <div class="mensaje-aviso">
                            Este comprobante es un documento interno. La boleta electrónica oficial se emite con su sistema autorizado por el SII.
                        </div>
                        <div class="fila">
                            <button class="btn btn-primario" id="cbGuardar">${icono("check")} Guardar</button>
                            <button class="btn" id="cbPrueba">${icono("impresora")} Imprimir prueba</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const guardar = () => {
            const config = Datos.config();
            config.anchoPapel = $("#cbAncho").value;
            config.mensajeBoleta = $("#cbMensaje").value.trim();
            config.imprimirAuto = $("#cbAuto").checked;
            Datos.guardarConfig(config);
        };

        $("#cbGuardar").addEventListener("click", () => {
            guardar();
            avisar("Configuración guardada.");
        });

        $("#cbPrueba").addEventListener("click", () => {

            guardar();

            Impresion.boleta({
                numero: 0,
                fecha: new Date().toISOString(),
                usuarioNombre: Sesion.nombre(),
                estado: "valida",
                items: [
                    { nombre: "Nike Pegasus 40 · Negro · Talla 42", cantidad: 1, precio: 119990, subtotal: 119990 },
                    { nombre: "Nike Calcetines x3 · Blanco · Talla M", cantidad: 2, precio: 11990, subtotal: 23980 }
                ],
                subtotal: 143970,
                descuento: 0,
                total: 143970,
                metodo: "efectivo",
                recibido: 150000,
                vuelto: 3850
            });
        });
    },


    // ==========================================
    // USUARIOS
    // ==========================================

    pintarUsuarios() {

        const usuarios = Datos.usuariosVigentes();
        const actual = Sesion.usuario();

        // nombres de ingreso repetidos (pasa al unir dos equipos en la nube)
        const veces = {};
        usuarios.forEach(u => { veces[u.usuario] = (veces[u.usuario] || 0) + 1; });
        const repetidos = Object.keys(veces).filter(k => veces[k] > 1);

        $("#cfContenido").innerHTML = `
            <div class="tarjeta">
                <div class="tarjeta-cabeza">
                    <div><h3>Usuarios</h3><p class="chico texto-2">El vendedor ve: Inicio, Vender, Ventas (las suyas), Caja y Productos (sin editar).</p></div>
                    <button class="btn btn-primario" id="usNuevo">${icono("mas")} Nuevo usuario</button>
                </div>
                ${repetidos.length ? `<div class="mensaje-aviso" style="margin:0 16px 12px">Hay usuarios con el mismo nombre de ingreso: <strong>${repetidos.map(esc).join(", ")}</strong>. Toque <strong>Editar</strong> en uno de ellos y cámbiele el usuario (por ejemplo, su nombre) para que cada persona tenga el suyo.</div>` : ""}
                <div class="tabla-contenedor">
                    <table class="tabla">
                        <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th><th>Último ingreso</th><th></th></tr></thead>
                        <tbody>
                            ${usuarios.map(u => `
                                <tr class="${u.activo ? "" : "anulada"}">
                                    <td><div class="fila"><div class="avatar" style="width:32px;height:32px;font-size:12px">${esc(iniciales(u.nombre))}</div><span class="negrita">${esc(u.nombre)}</span>${u.id === actual.id ? '<span class="badge b-azul">Usted</span>' : ""}</div></td>
                                    <td>${esc(u.usuario)}</td>
                                    <td>${esc(ROLES[u.rol] || u.rol)}</td>
                                    <td>${u.activo ? '<span class="badge b-ok">Activo</span>' : '<span class="badge">Desactivado</span>'}</td>
                                    <td class="nowrap">${u.ultimoAcceso ? fechaHora(u.ultimoAcceso) : '<span class="texto-3">Nunca</span>'}</td>
                                    <td class="acciones">
                                        <button class="btn btn-chico" data-editar="${u.id}">${icono("editar")} Editar</button>
                                        <button class="btn btn-chico" data-clave="${u.id}">${icono("llave")} Contraseña</button>
                                        ${u.id === actual.id ? "" : `<button class="btn btn-chico btn-peligro" data-borrar="${u.id}" title="Borrar usuario">${icono("basura")} Borrar</button>`}
                                    </td>
                                </tr>`).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        $("#usNuevo").addEventListener("click", () => this.formularioUsuario(null));

        $("#cfContenido").addEventListener("click", evento => {
            const editar = evento.target.closest("[data-editar]");
            const clave = evento.target.closest("[data-clave]");
            if (editar) this.formularioUsuario(editar.dataset.editar);
            if (clave) this.cambiarClave(clave.dataset.clave);
            const borrar = evento.target.closest("[data-borrar]");
            if (borrar) this.borrarUsuario(borrar.dataset.borrar);
        });
    },


    // Borra un usuario. El registro queda marcado como borrado (no se elimina) para que:
    //  - el borrado llegue por la nube a los demás equipos (celulares, vendedores);
    //  - las ventas antiguas sigan mostrando quién las hizo.
    async borrarUsuario(id) {

        const usuarios = Datos.usuarios();
        const registro = usuarios.find(u => u.id === id);
        const actual = Sesion.usuario();

        if (!registro || registro.borrado) return;

        if (actual && registro.id === actual.id) {
            avisar("No puede borrar el usuario con el que está trabajando.", "error");
            return;
        }

        const quedanAdmins = usuarios.some(u => u.id !== id && u.rol === "admin" && u.activo && !u.borrado);
        if (registro.rol === "admin" && !quedanAdmins) {
            avisar("Debe quedar al menos un administrador activo.", "error");
            return;
        }

        const ok = await confirmar({
            titulo: "Borrar usuario",
            mensaje: `¿Borrar a <strong>${esc(registro.nombre)}</strong> (usuario <strong>${esc(registro.usuario)}</strong>)? Ya no podrá ingresar en ningún equipo. Sus ventas anteriores se mantienen.`,
            textoSi: "Borrar",
            peligro: true
        });

        if (!ok) return;

        Object.assign(registro, { borrado: true, activo: false, borradoEn: new Date().toISOString() });
        Datos.guardarUsuarios(usuarios);

        avisar("Usuario borrado.");
        this.pintar();
    },


    formularioUsuario(id) {

        const usuario = id ? Datos.usuarios().find(u => u.id === id) : null;
        const esActual = usuario && usuario.id === Sesion.usuario().id;

        abrirModal({
            titulo: usuario ? "Editar usuario" : "Nuevo usuario",
            html: `
                <div class="rejilla rejilla-2">
                    <div class="campo col-todo"><label class="requerido" for="ufNombre">Nombre y apellido</label><input id="ufNombre" value="${esc(usuario ? usuario.nombre : "")}"></div>
                    <div class="campo"><label class="requerido" for="ufUsuario">Usuario para ingresar</label><input id="ufUsuario" value="${esc(usuario ? usuario.usuario : "")}" autocomplete="off"></div>
                    <div class="campo">
                        <label for="ufRol">Rol</label>
                        <select id="ufRol" ${esActual ? "disabled" : ""}>
                            ${Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${usuario && usuario.rol === k ? "selected" : ""}>${t}</option>`).join("")}
                        </select>
                    </div>
                    ${!usuario ? `
                        <div class="campo"><label class="requerido" for="ufClave">Contraseña</label><input id="ufClave" type="password" autocomplete="new-password"></div>
                        <div class="campo"><label class="requerido" for="ufClave2">Repetir contraseña</label><input id="ufClave2" type="password" autocomplete="new-password"></div>
                    ` : `
                        <label class="check col-todo"><input type="checkbox" id="ufActivo" ${usuario.activo ? "checked" : ""} ${esActual ? "disabled" : ""}> Usuario activo (puede ingresar)</label>
                    `}
                    <div id="ufError" class="mensaje-error col-todo oculto"></div>
                </div>
            `,
            botones: [
                { texto: "Cancelar" },
                {
                    texto: usuario ? "Guardar" : "Crear usuario",
                    clase: "btn-primario",
                    accion: async (cerrar, raiz) => {

                        const error = $("#ufError", raiz);

                        const mostrarError = texto => {
                            error.textContent = texto;
                            error.classList.remove("oculto");
                        };

                        const nombre = $("#ufNombre", raiz).value.trim();
                        const acceso = normalizar($("#ufUsuario", raiz).value).replace(/\s+/g, "");
                        const rol = $("#ufRol", raiz).value;
                        const usuarios = Datos.usuarios();

                        if (!nombre || !acceso) {
                            mostrarError("Escriba el nombre y el usuario.");
                            return;
                        }

                        if (usuarios.some(u => u.usuario === acceso && u.id !== id && !u.borrado)) {
                            mostrarError("Ese usuario ya existe. Elija otro.");
                            return;
                        }

                        if (!usuario) {

                            const clave = $("#ufClave", raiz).value;

                            if (clave.length < 6) {
                                mostrarError("La contraseña debe tener al menos 6 caracteres.");
                                return;
                            }

                            if (clave !== $("#ufClave2", raiz).value) {
                                mostrarError("Las contraseñas no coinciden.");
                                return;
                            }

                            usuarios.push(Object.assign(
                                { id: nuevoId(), nombre, usuario: acceso, rol, activo: true, creado: new Date().toISOString() },
                                await crearClave(clave)
                            ));

                        } else {

                            const registro = usuarios.find(u => u.id === id);
                            const nuevoRol = esActual ? registro.rol : rol;
                            const activo = esActual ? true : $("#ufActivo", raiz).checked;

                            // Siempre debe quedar al menos un administrador activo
                            const quedanAdmins = usuarios.some(u =>
                                u.id !== id && u.rol === "admin" && u.activo && !u.borrado
                            ) || (nuevoRol === "admin" && activo);

                            if (!quedanAdmins) {
                                mostrarError("Debe quedar al menos un administrador activo.");
                                return;
                            }

                            Object.assign(registro, { nombre, usuario: acceso, rol: nuevoRol, activo });
                        }

                        Datos.guardarUsuarios(usuarios);

                        cerrar();

                        avisar(usuario ? "Usuario actualizado." : "Usuario creado.");

                        App.pintarCabeceraMenu();

                        this.pintar();
                    }
                }
            ]
        });
    },


    cambiarClave(id) {

        const usuario = Datos.usuarios().find(u => u.id === id);

        abrirModal({
            titulo: "Nueva contraseña para " + usuario.nombre,
            clase: "angosto",
            html: `
                <div class="rejilla">
                    <div class="campo"><label for="ccClave">Contraseña nueva</label><input id="ccClave" type="password" autocomplete="new-password"></div>
                    <div class="campo"><label for="ccClave2">Repetir</label><input id="ccClave2" type="password" autocomplete="new-password"></div>
                    <div id="ccError" class="mensaje-error oculto"></div>
                </div>
            `,
            botones: [
                { texto: "Cancelar" },
                {
                    texto: "Guardar contraseña",
                    clase: "btn-primario",
                    accion: async (cerrar, raiz) => {

                        const clave = $("#ccClave", raiz).value;
                        const error = $("#ccError", raiz);

                        if (clave.length < 6 || clave !== $("#ccClave2", raiz).value) {
                            error.textContent = clave.length < 6 ? "Mínimo 6 caracteres." : "Las contraseñas no coinciden.";
                            error.classList.remove("oculto");
                            return;
                        }

                        const usuarios = Datos.usuarios();
                        Object.assign(usuarios.find(u => u.id === id), await crearClave(clave));
                        Datos.guardarUsuarios(usuarios);

                        cerrar();

                        avisar("Contraseña cambiada.");
                    }
                }
            ]
        });
    },


    // ==========================================
    // RESPALDO
    // ==========================================

    pintarRespaldo() {

        const c = Datos.config();

        $("#cfContenido").innerHTML = `
            <div class="dos-iguales" style="max-width:980px">
                <div class="tarjeta">
                    <div class="tarjeta-cabeza"><h3>Descargar respaldo</h3></div>
                    <div class="tarjeta-cuerpo">
                        <p style="margin-bottom:12px">Guarda todos los datos (productos, ventas, caja, fotos y usuarios) en un archivo. Hágalo al menos una vez por semana y guárdelo en un pendrive o en su correo.</p>
                        <p class="chico texto-2" style="margin-bottom:14px">Último respaldo: <strong>${c.ultimoRespaldo ? fechaHora(c.ultimoRespaldo) : "nunca"}</strong></p>
                        <button class="btn btn-primario" id="rsDescargar">${icono("descargar")} Descargar respaldo</button>
                    </div>
                </div>
                <div class="tarjeta">
                    <div class="tarjeta-cabeza"><h3>Restaurar respaldo</h3></div>
                    <div class="tarjeta-cuerpo">
                        <p style="margin-bottom:12px">Reemplaza <strong>todos</strong> los datos de este equipo por los del archivo. Úselo para recuperar información o pasar el sistema a otro computador.</p>
                        <div class="campo" style="margin-bottom:12px"><input type="file" id="rsArchivo" accept=".json,application/json" aria-label="Archivo de respaldo"></div>
                        <button class="btn btn-peligro" id="rsRestaurar">${icono("subir")} Restaurar</button>
                    </div>
                </div>
            </div>
        `;

        $("#rsDescargar").addEventListener("click", async () => {

            const config = Datos.config();
            config.ultimoRespaldo = new Date().toISOString();
            Datos.guardarConfig(config);

            const datos = {};

            DB.claves()
                .filter(clave => !["sesion", "carrito"].includes(clave) && !clave.startsWith("foto_"))
                .forEach(clave => { datos[clave] = DB.leer(clave); });

            let fotos = {};

            try {
                fotos = await Fotos.todas();
            } catch (error) {
                avisar("No se pudieron incluir las fotos en el respaldo.", "aviso");
            }

            const respaldo = {
                sistema: SISTEMA.nombre,
                version: SISTEMA.version,
                fecha: config.ultimoRespaldo,
                farmacia: config.nombre,
                datos,
                fotos
            };

            const nombre = normalizar(config.nombre || "tienda").replace(/[^a-z0-9]+/g, "-");

            descargarArchivo(`respaldo-${nombre}-${hoyISO()}.json`, JSON.stringify(respaldo));

            avisar("Respaldo descargado.");

            this.pintarRespaldo();
        });

        $("#rsRestaurar").addEventListener("click", async () => {

            const archivo = $("#rsArchivo").files[0];

            if (!archivo) {
                avisar("Elija el archivo de respaldo.", "aviso");
                return;
            }

            let respaldo;

            try {
                respaldo = JSON.parse(await leerArchivoTexto(archivo));
            } catch (error) {
                avisar("El archivo no es un respaldo válido.", "error");
                return;
            }

            if (!respaldo || respaldo.sistema !== SISTEMA.nombre || !respaldo.datos || !respaldo.datos.config || !respaldo.datos.usuarios) {
                avisar("El archivo no es un respaldo de " + SISTEMA.nombre + ".", "error");
                return;
            }

            const ok = await confirmar({
                titulo: "Restaurar respaldo",
                mensaje: `Se reemplazarán todos los datos actuales por el respaldo de <strong>${esc(respaldo.farmacia || "")}</strong> del ${fechaHora(respaldo.fecha)}. Después deberá ingresar de nuevo.`,
                textoSi: "Restaurar",
                peligro: true
            });

            if (!ok) return;

            DB.claves().forEach(clave => DB.borrar(clave));

            Object.entries(respaldo.datos).forEach(([clave, valor]) => DB.guardar(clave, valor));

            try {
                await Fotos.reemplazarTodas(respaldo.fotos || {});
            } catch (error) {
                avisar("Los datos se restauraron, pero no las fotos.", "aviso");
            }

            location.hash = "";
            location.reload();
        });
    },


    // ==========================================
    // SEGURIDAD Y SISTEMA
    // ==========================================

    pintarSistema() {

        const hayProductos = Datos.productos().length > 0;

        const instalada = Instalacion.instalada();
        const publicado = location.protocol.startsWith("http");

        $("#cfContenido").innerHTML = `
            <div class="dos-iguales" style="max-width:980px">
                <div class="tarjeta" style="grid-column:1 / -1">
                    <div class="tarjeta-cabeza"><h3>Usar en celular (Android y iPhone)</h3>${instalada ? '<span class="badge b-ok">Instalada</span>' : ""}</div>
                    <div class="tarjeta-cuerpo">
                        <p style="margin-bottom:12px">El sistema se puede instalar en el celular o el computador como una aplicación: queda un ícono en la pantalla de inicio, se abre a pantalla completa y funciona sin internet.</p>
                        ${publicado
                            ? `<button class="btn btn-primario" id="ssInstalar" ${instalada ? "disabled" : ""}>${icono("celular")} ${instalada ? "Ya está instalada" : "Instalar aplicación"}</button>`
                            : `<div class="mensaje-aviso" style="margin-bottom:12px">Para instalarlo en un celular, primero hay que publicar el sistema en internet (por ejemplo en Netlify). Abierto con doble clic solo funciona en este computador.</div>
                               <button class="btn" id="ssInstalar">${icono("celular")} Ver cómo instalar</button>`}
                    </div>
                </div>
                <div class="tarjeta">
                    <div class="tarjeta-cabeza"><h3>Código de recuperación</h3></div>
                    <div class="tarjeta-cuerpo">
                        <p style="margin-bottom:14px">Permite crear una contraseña nueva para un administrador si la olvida. Si perdió el código, genere uno nuevo (el anterior deja de funcionar).</p>
                        <button class="btn" id="ssCodigo">${icono("llave")} Generar código nuevo</button>
                    </div>
                </div>
                <div class="tarjeta">
                    <div class="tarjeta-cabeza"><h3>Datos de ejemplo</h3></div>
                    <div class="tarjeta-cuerpo">
                        <p style="margin-bottom:14px">Carga productos de ejemplo de varias categorías para practicar.</p>
                        <button class="btn" id="ssEjemplo" ${hayProductos ? "disabled" : ""}>${icono("bolsa")} Cargar datos de ejemplo</button>
                        ${hayProductos ? '<p class="chico texto-3" style="margin-top:8px">Solo disponible cuando no hay productos.</p>' : ""}
                    </div>
                </div>
                <div class="tarjeta" style="grid-column:1 / -1;border-color:#f5c2c2">
                    <div class="tarjeta-cabeza"><h3 class="rojo">Borrar datos</h3></div>
                    <div class="tarjeta-cuerpo">
                        <p style="margin-bottom:14px">Elimina productos, ventas, caja y movimientos. Se mantienen los datos de la tienda y los usuarios. Descargue un respaldo antes.</p>
                        <button class="btn btn-peligro" id="ssBorrar">${icono("basura")} Borrar datos de operación</button>
                    </div>
                </div>
            </div>
            <p class="chico texto-3" style="margin-top:18px">${SISTEMA.nombre} versión ${SISTEMA.version} · Los datos se guardan en este navegador y equipo.</p>
        `;

        $("#ssCodigo").addEventListener("click", async () => {

            const ok = await confirmar({
                titulo: "Generar código nuevo",
                mensaje: "El código anterior dejará de funcionar. ¿Continuar?",
                textoSi: "Generar"
            });

            if (!ok) return;

            const codigo = generarCodigoRecuperacion();
            const config = Datos.config();

            config.recuperacion = await crearClave(codigo.replace(/-/g, ""));

            Datos.guardarConfig(config);

            mostrarCodigoRecuperacion(codigo);
        });

        $("#ssEjemplo").addEventListener("click", () => {
            cargarDatosEjemplo();
            avisar("Datos de ejemplo cargados.");
            App.refrescar();
        });

        $("#ssInstalar").addEventListener("click", () => Instalacion.instalar());

        $("#ssBorrar").addEventListener("click", async () => {

            const texto = await pedirTexto({
                titulo: "Borrar datos de operación",
                mensaje: 'Esta acción no se puede deshacer. Para confirmar escriba <strong>BORRAR</strong>.',
                marcador: "BORRAR",
                textoSi: "Borrar todo",
                peligro: true
            });

            if (texto !== "BORRAR") {
                if (texto !== null) avisar("No se borró nada: debe escribir BORRAR.", "aviso");
                return;
            }

            ["productos", "ventas", "movimientos", "caja", "cierres", "contadores", "carrito"].forEach(clave => DB.borrar(clave));

            try {
                await Fotos.reemplazarTodas({});
            } catch (error) {
                // sin fotos que borrar
            }

            avisar("Datos borrados.");

            App.refrescar();
        });
    }
};


Modulos.configuracion = {
    titulo: "Configuración",
    icono: "ajustes",
    roles: ["admin"],
    render: vista => Configuracion.render(vista)
};
