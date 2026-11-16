// ==========================================
// SPORTPOS — VENDER
// Búsqueda, carrito, monto libre y cobro
// ==========================================

"use strict";

const Vender = {

    filtro: "",
    texto: "",


    carrito() {
        return DB.leer("carrito", { items: [], descuento: { valor: 0, tipo: "monto" } });
    },

    guardarCarrito(carrito) {
        DB.guardar("carrito", carrito);
    },


    enCarrito(carrito, productoId, excepto = -1) {
        return carrito.items.reduce((s, item, i) => item.productoId === productoId && i !== excepto ? s + item.cantidad : s, 0);
    },


    lineas(carrito) {

        const productos = new Map(Datos.productos().map(p => [p.id, p]));

        return carrito.items
            .map((item, indice) => {

                // Monto libre: no es un producto del catálogo
                if (item.libre) {
                    const producto = { id: "libre", nombre: item.nombre, precio: item.precio, controlaStock: false, costo: 0, unidad: "unidad" };
                    return { indice, item, producto, precio: item.precio, subtotal: Math.round(item.precio * item.cantidad) };
                }

                const producto = productos.get(item.productoId);
                if (!producto) return null;
                const precio = aEntero(producto.precio);
                return { indice, item, producto, precio, subtotal: Math.round(precio * item.cantidad) };
            })
            .filter(Boolean);
    },


    totales(carrito) {

        const lineas = this.lineas(carrito);
        const subtotal = lineas.reduce((s, l) => s + l.subtotal, 0);
        const valor = Math.max(0, Number(carrito.descuento.valor) || 0);

        let descuento = carrito.descuento.tipo === "porcentaje"
            ? Math.round(subtotal * Math.min(valor, 100) / 100)
            : Math.round(valor);

        descuento = Math.min(descuento, subtotal);

        const neto = subtotal - descuento;
        const iva = false ? Math.round(neto * 0.19) : 0;

        return {
            lineas,
            subtotal,
            descuento,
            iva,
            total: neto + iva,
            unidades: lineas.reduce((s, l) => s + l.item.cantidad, 0)
        };
    },


    agregar(productoId, cantidad = 1) {

        const producto = Datos.producto(productoId);

        if (!producto) return false;

        const carrito = this.carrito();
        const total = this.enCarrito(carrito, productoId) + cantidad;

        if (controlaStock(producto) && total > Number(producto.stock)) {
            avisar(Number(producto.stock) <= 0 ? `${producto.nombre}: sin stock.` : `${producto.nombre}: stock insuficiente (quedan ${Number(producto.stock)}).`, "error");
            return false;
        }

        const existente = carrito.items.find(i => i.productoId === productoId);

        if (existente) existente.cantidad += cantidad;
        else carrito.items.push({ productoId, cantidad });

        this.guardarCarrito(carrito);

        return true;
    },


    cambiarCantidad(indice, cantidad) {

        const carrito = this.carrito();
        const item = carrito.items[indice];

        if (!item) return;

        cantidad = Math.max(0, Math.round(cantidad * 1000) / 1000);

        if (cantidad === 0) {
            carrito.items.splice(indice, 1);
            this.guardarCarrito(carrito);
            return;
        }

        const producto = item.libre ? null : Datos.producto(item.productoId);

        if (producto && controlaStock(producto) && cantidad > Number(producto.stock)) {
            avisar(`Stock insuficiente: quedan ${Number(producto.stock)} de ${producto.nombre}.`, "error");
            cantidad = Math.max(1, Number(producto.stock));
        }

        item.cantidad = cantidad;

        this.guardarCarrito(carrito);
    },


    buscar() {

        const palabras = normalizar(this.texto).split(/\s+/).filter(Boolean);

        let lista = Datos.productos().filter(p => p.activo !== false);

        if (this.filtro) {
            lista = lista.filter(p => p.categoria === this.filtro);
        }

        if (!palabras.length) {

            const vendidos = new Map();

            Datos.ventas().slice(0, 400).forEach(v => {
                if (v.estado === "anulada") return;
                v.items.forEach(i => vendidos.set(i.productoId, (vendidos.get(i.productoId) || 0) + i.cantidad));
            });

            return {
                titulo: vendidos.size ? "Más vendidos" : "Productos",
                lista: lista
                    .sort((a, b) => (vendidos.get(b.id) || 0) - (vendidos.get(a.id) || 0) || a.nombre.localeCompare(b.nombre))
                    .slice(0, 30)
            };
        }

        const encontrados = lista.filter(p => {
            const pajar = normalizar([p.nombre, p.marca, p.ubicacion, p.codigoBarras, p.categoria].join(" "));
            return palabras.every(x => pajar.includes(x));
        }).sort((a, b) => a.nombre.localeCompare(b.nombre));

        return {
            titulo: plural(encontrados.length, "resultado", "resultados"),
            lista: encontrados.slice(0, 60),
            total: encontrados.length
        };
    },


    // ==========================================
    // PANTALLA
    // ==========================================

    render(vista) {

        vista.innerHTML = `
            <div id="vAvisoCaja"></div>
            <div class="vender">
                <section class="vender-lista">
                    <div class="buscador-grande">
                        ${icono("buscar")}
                        <input id="vBuscar" placeholder="Buscar producto o escanear código de barras" autocomplete="off">
                        <span class="atajo">F2</span>
                        <button class="btn-escanear" type="button" id="vEscanear" title="Escanear con la cámara" aria-label="Escanear código con la cámara">${icono("codigo")}</button>
                    </div>
                    <div class="fila-entre">
                        <div class="chips" id="vFiltros"></div>
                        <div class="fila" style="gap:8px">
                            <span class="texto-2 chico" id="vConteo"></span>
                            <button class="btn btn-chico" type="button" id="vLibre">${icono("dinero")} Monto libre</button>
                        </div>
                    </div>
                    <div class="resultados" id="vResultados"></div>
                </section>
                <aside class="carrito" id="vCarrito"></aside>
            </div>
            <div class="fondo-carrito" id="vFondoCarrito"></div>
            <button class="btn btn-primario boton-flotante-carrito oculto" id="vIrCarrito" type="button"></button>
        `;

        const buscador = $("#vBuscar");
        buscador.value = this.texto;

        this.pintarAvisoCaja();
        this.pintarFiltros();
        this.pintarResultados();
        this.pintarCarrito();

        $("#vLibre").addEventListener("click", () => this.agregarLibre());

        buscador.addEventListener("input", () => {
            this.texto = buscador.value;
            this.pintarResultados();
        });

        buscador.addEventListener("keydown", evento => {

            if (evento.key === "Escape") {
                buscador.value = "";
                this.texto = "";
                this.pintarResultados();
                return;
            }

            if (evento.key !== "Enter") return;

            evento.preventDefault();

            const texto = buscador.value.trim();

            if (!texto) return;

            const porCodigo = Datos.productos().find(p => p.activo !== false && p.codigoBarras && p.codigoBarras === texto);
            const resultado = porCodigo ? [porCodigo] : this.buscar().lista;

            if (resultado.length === 1) {
                if (this.agregar(resultado[0].id)) {
                    buscador.value = "";
                    this.texto = "";
                    this.pintarResultados();
                    this.pintarCarrito();
                }
            } else if (!resultado.length) {
                avisar("No se encontró: " + texto, "aviso");
            }
        });

        $("#vFiltros").addEventListener("click", evento => {
            const chip = evento.target.closest("[data-filtro]");
            if (!chip) return;
            this.filtro = chip.dataset.filtro;
            this.pintarFiltros();
            this.pintarResultados();
        });

        $("#vResultados").addEventListener("click", evento => {

            const boton = evento.target.closest("[data-agregar]");

            if (boton) {
                if (this.agregar(boton.dataset.agregar)) {
                    this.pintarCarrito();
                    this.pintarResultados();
                }
                return;
            }

            const ficha = evento.target.closest("[data-ficha]");

            if (ficha) verFichaProducto(ficha.dataset.ficha);
        });

        this.eventosCarrito();

        $("#vIrCarrito").addEventListener("click", () => this.mostrarCarritoMovil(true));
        $("#vFondoCarrito").addEventListener("click", () => this.mostrarCarritoMovil(false));

        $("#vEscanear").addEventListener("click", async () => {

            const codigo = await escanearCodigo();

            if (!codigo) return;

            const producto = Datos.productos().find(p => p.activo !== false && p.codigoBarras === codigo);

            if (!producto) {
                buscador.value = codigo;
                this.texto = codigo;
                this.pintarResultados();
                avisar("No hay un producto con el código " + codigo + ".", "aviso");
                return;
            }

            if (this.agregar(producto.id)) {
                avisar("Agregado: " + producto.nombre);
                this.pintarCarrito();
                this.pintarResultados();
            }
        });

        const teclas = evento => {

            if (pilaModales.length) return;

            if (evento.key === "F2") {
                evento.preventDefault();
                buscador.focus();
                buscador.select();
            }

            if (evento.key === "F9") {
                evento.preventDefault();
                this.cobrar();
            }
        };

        document.addEventListener("keydown", teclas);

        if (!esCelular()) setTimeout(() => buscador.focus(), 50);

        return () => {
            document.removeEventListener("keydown", teclas);
            document.body.classList.remove("carrito-abierto");
        };
    },


    // Venta de algo sin código: se escribe el monto
    agregarLibre() {

        abrirModal({
            titulo: "Monto libre",
            clase: "angosto",
            html: `
                <div class="rejilla">
                    <div class="campo"><label for="mlMonto">Monto</label><input id="mlMonto" type="text" inputmode="numeric" style="height:46px;font-size:20px;font-weight:700;text-align:right" placeholder="0"></div>
                    <div class="campo"><label for="mlNombre">Descripción</label><input id="mlNombre" placeholder="Artículo varios"></div>
                </div>
            `,
            alAbrir(raiz) {
                const m = $("#mlMonto", raiz);
                m.addEventListener("input", () => { m.value = m.value.trim() ? numero(aEntero(m.value)) : ""; });
                raiz.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $(".modal-pie .btn-primario", raiz).click(); } });
            },
            botones: [
                { texto: "Cancelar" },
                {
                    texto: "Agregar",
                    clase: "btn-primario",
                    accion: (cerrar, raiz) => {
                        const monto = aEntero($("#mlMonto", raiz).value);
                        if (monto <= 0) { avisar("Escriba el monto.", "aviso"); return; }
                        const carrito = this.carrito();
                        carrito.items.push({ libre: true, productoId: null, nombre: $("#mlNombre", raiz).value.trim() || "Artículo varios", precio: monto, cantidad: 1 });
                        this.guardarCarrito(carrito);
                        cerrar();
                        this.pintarCarrito();
                    }
                }
            ]
        });
    },


    mostrarCarritoMovil(visible) {
        document.body.classList.toggle("carrito-abierto", visible);
    },


    pintarAvisoCaja() {

        const contenedor = $("#vAvisoCaja");

        if (!contenedor) return;

        if (Datos.cajaActual()) {
            contenedor.innerHTML = "";
            return;
        }

        contenedor.innerHTML = `
            <div class="aviso-caja">
                ${icono("caja")}
                <span>La caja está cerrada. Ábrala para comenzar a vender.</span>
                <span class="espacio"></span>
                <button class="btn btn-chico btn-primario" type="button" id="vAbrirCaja">Abrir caja</button>
            </div>
        `;

        $("#vAbrirCaja").addEventListener("click", () => abrirCajaModal(() => {
            this.pintarAvisoCaja();
            App.actualizarBarra();
        }));
    },


    pintarFiltros() {

        const usadas = Array.from(new Set(Datos.productos().filter(p => p.activo !== false).map(p => p.categoria).filter(Boolean))).sort();
        const tipos = [["", "Todos"], ...usadas.map(c => [c, c])];

        $("#vFiltros").innerHTML = tipos.map(([k, t]) => `<button class="chip ${this.filtro === k ? "activo" : ""}" data-filtro="${esc(k)}">${esc(t)}</button>`).join("");
    },


    pintarResultados() {

        const contenedor = $("#vResultados");

        if (!contenedor) return;

        const { titulo, lista, total } = this.buscar();
        const carrito = this.carrito();

        $("#vConteo").textContent = total > lista.length ? `Mostrando ${lista.length} de ${total}` : titulo;

        if (!Datos.productos().length) {
            contenedor.innerHTML = vacioHTML("inventario", "Aún no hay productos", "Agregue su catálogo en Productos.", Sesion.esAdmin() ? '<a class="btn btn-primario" href="#productos">Ir a Productos</a>' : "");
            return;
        }

        if (!lista.length) {
            contenedor.innerHTML = vacioHTML("buscar", "Sin resultados", "Pruebe con la marca, el modelo o el color.");
            return;
        }

        contenedor.innerHTML = lista.map(p => {

            const controla = controlaStock(p);
            const libre = controla ? Number(p.stock) - this.enCarrito(carrito, p.id) : Infinity;
            const foto = Fotos.producto(p.id);
            const color = !controla ? "texto-3" : libre <= 0 ? "rojo" : stockBajo(p) ? "amarillo" : "verde";

            return `
                <div class="resultado ${controla && Number(p.stock) <= 0 ? "sin-stock" : ""}">
                    <button type="button" class="resultado-foto" data-ficha="${p.id}" aria-label="Ver ficha">
                        ${foto ? `<img src="${foto}" alt="" loading="lazy">` : icono("inventario")}
                    </button>
                    <div style="min-width:0">
                        <div class="nombre">${esc(p.nombre)}</div>
                        <div class="detalle">${esc([p.marca, p.codigoBarras].filter(Boolean).join(" · "))}</div>
                        <div class="insignias">
                            ${insigniaUbicacion(p)}
                            ${insigniaCategoria(p)}
                            <button class="badge" type="button" data-ficha="${p.id}" style="cursor:pointer">Ficha</button>
                        </div>
                    </div>
                    <div class="resultado-lado">
                        <div class="precio">${dinero(p.precio)}</div>
                        <div class="stock ${color}">${!controla ? "Sin control de stock" : libre <= 0 ? "Sin stock" : "Stock: " + formatoNumero.format(Math.round(libre * 100) / 100)}</div>
                        <div class="botones-agregar">
                            <button class="btn btn-primario" type="button" data-agregar="${p.id}" ${controla && libre <= 0 ? "disabled" : ""}>+ Agregar</button>
                        </div>
                    </div>
                </div>
            `;
        }).join("");
    },


    pintarCarrito() {

        const contenedor = $("#vCarrito");

        if (!contenedor) return;

        const carrito = this.carrito();
        const t = this.totales(carrito);

        if (t.lineas.length !== carrito.items.length) {
            carrito.items = t.lineas.map(l => l.item);
            this.guardarCarrito(carrito);
        }

        const flotante = $("#vIrCarrito");
        flotante.classList.toggle("oculto", !t.lineas.length);
        flotante.textContent = `Ver venta · ${plural(t.unidades, "producto", "productos")} · ${dinero(t.total)}`;

        if (!t.lineas.length) this.mostrarCarritoMovil(false);

        const items = t.lineas.length
            ? t.lineas.map(l => `
                <div class="item-carrito">
                    <div class="fila-1">
                        <div style="min-width:0">
                            <div class="nombre">${esc(l.producto.nombre)}</div>
                            <div class="chico texto-2">${dinero(l.precio)} ${l.producto.unidad && l.producto.unidad !== "unidad" ? "el " + esc(l.producto.unidad) : "c/u"}</div>
                        </div>
                        <button class="quitar" type="button" data-quitar="${l.indice}" aria-label="Quitar">${icono("cerrar")}</button>
                    </div>
                    <div class="fila-2">
                        <div class="cantidad">
                            <button type="button" data-menos="${l.indice}" aria-label="Menos">−</button>
                            <input type="text" inputmode="decimal" data-cant="${l.indice}" value="${l.item.cantidad}" aria-label="Cantidad">
                            <button type="button" data-mas="${l.indice}" aria-label="Más">+</button>
                        </div>
                        <span class="subtotal">${dinero(l.subtotal)}</span>
                    </div>
                </div>`).join("")
            : `<div class="vacio" style="padding:34px 16px">${icono("carro")}<h3>Venta vacía</h3><p class="chico">Busque un producto o escanee su código.</p></div>`;

        contenedor.innerHTML = `
            <div class="carrito-cabeza">
                <h3>Venta actual</h3>
                <div class="fila" style="gap:4px">
                    ${t.lineas.length ? '<button class="btn btn-fantasma btn-chico" type="button" id="vVaciar">Vaciar</button>' : ""}
                    <button class="btn btn-fantasma btn-icono solo-movil" type="button" id="vCerrarCarrito" aria-label="Cerrar venta">${icono("cerrar")}</button>
                </div>
            </div>
            <div class="carrito-items">${items}</div>
            <div class="carrito-totales">
                <div class="linea-total"><span>Subtotal</span><span>${dinero(t.subtotal)}</span></div>
                <div class="descuento-fila">
                    <span class="texto-2" style="font-size:13.5px;flex:1">Descuento</span>
                    <input type="text" inputmode="numeric" id="vDescuento" value="${carrito.descuento.valor || ""}" placeholder="0" style="width:90px;text-align:right">
                    <select id="vDescuentoTipo" aria-label="Tipo de descuento">
                        <option value="monto" ${carrito.descuento.tipo !== "porcentaje" ? "selected" : ""}>$</option>
                        <option value="porcentaje" ${carrito.descuento.tipo === "porcentaje" ? "selected" : ""}>%</option>
                    </select>
                </div>
                ${t.descuento ? `<div class="linea-total"><span>Descuento aplicado</span><span class="rojo">-${dinero(t.descuento)}</span></div>` : ""}
                ${t.iva ? `<div class="linea-total"><span>IVA (19%)</span><span>${dinero(t.iva)}</span></div>` : ""}
                <div class="linea-total grande"><span>Total</span><span>${dinero(t.total)}</span></div>
                <button class="btn btn-exito btn-grande btn-bloque" type="button" id="vCobrar" ${t.lineas.length ? "" : "disabled"}>
                    Cobrar ${dinero(t.total)} <span style="opacity:.75;font-size:12px;font-weight:600">F9</span>
                </button>
                <p class="chico texto-3 centro" style="margin-top:8px">${false ? "Precios netos: se suma el IVA (19%)" : "Precios con IVA incluido"}</p>
            </div>
        `;
    },


    eventosCarrito() {

        const contenedor = $("#vCarrito");

        const redibujar = () => {
            this.pintarCarrito();
            this.pintarResultados();
        };

        contenedor.addEventListener("click", async evento => {

            const objetivo = evento.target.closest("button");

            if (!objetivo) return;

            if (objetivo.id === "vCobrar") { this.cobrar(); return; }
            if (objetivo.id === "vCerrarCarrito") { this.mostrarCarritoMovil(false); return; }

            if (objetivo.id === "vVaciar") {
                if (await confirmar({ titulo: "Vaciar venta", mensaje: "¿Quitar todos los productos de la venta actual?", textoSi: "Vaciar", peligro: true })) {
                    this.guardarCarrito({ items: [], descuento: { valor: 0, tipo: "monto" } });
                    redibujar();
                }
                return;
            }

            const carrito = this.carrito();

            if (objetivo.dataset.quitar !== undefined) {
                carrito.items.splice(Number(objetivo.dataset.quitar), 1);
                this.guardarCarrito(carrito);
                redibujar();
                return;
            }

            if (objetivo.dataset.menos !== undefined) {
                const i = Number(objetivo.dataset.menos);
                this.cambiarCantidad(i, carrito.items[i].cantidad - 1);
                redibujar();
                return;
            }

            if (objetivo.dataset.mas !== undefined) {
                const i = Number(objetivo.dataset.mas);
                this.cambiarCantidad(i, carrito.items[i].cantidad + 1);
                redibujar();
            }
        });

        contenedor.addEventListener("change", evento => {

            const t = evento.target;

            if (t.dataset.cant !== undefined) {
                this.cambiarCantidad(Number(t.dataset.cant), Number(String(t.value).replace(",", ".")) || 0);
                redibujar();
                return;
            }

            if (t.id === "vDescuento" || t.id === "vDescuentoTipo") {
                const carrito = this.carrito();
                carrito.descuento = { valor: Math.max(0, aEntero($("#vDescuento").value)), tipo: $("#vDescuentoTipo").value };
                this.guardarCarrito(carrito);
                this.pintarCarrito();
            }
        });

        contenedor.addEventListener("keydown", evento => {
            if (evento.key === "Enter" && evento.target.tagName === "INPUT") {
                evento.preventDefault();
                evento.target.blur();
            }
        });
    },


    // ==========================================
    // COBRAR
    // ==========================================

    async cobrar() {

        const carrito = this.carrito();
        const t = this.totales(carrito);

        if (!t.lineas.length) {
            avisar("Agregue productos a la venta.", "aviso");
            return;
        }

        if (!Datos.cajaActual()) {
            abrirCajaModal(() => {
                this.pintarAvisoCaja();
                App.actualizarBarra();
                this.cobrar();
            });
            return;
        }

        for (const l of t.lineas) {
            if (controlaStock(l.producto) && this.enCarrito(carrito, l.producto.id) > Number(l.producto.stock)) {
                avisar("Stock insuficiente de " + l.producto.nombre + ".", "error");
                return;
            }
        }

        const pago = await pedirPago(t.total);

        if (!pago) return;

        const venta = this.registrarVenta(t, pago);

        if (!venta) return;

        this.mostrarCarritoMovil(false);
        this.pintarCarrito();
        this.pintarResultados();

        this.mostrarExito(venta);
    },


    registrarVenta(t, pago) {

        const caja = Datos.cajaActual();
        const usuario = Sesion.usuario();
        const productos = Datos.productos();

        for (const l of t.lineas) {
            if (!descontarStock(productos, l.producto.id, l.item.cantidad)) {
                avisar("Stock insuficiente de " + l.producto.nombre + ".", "error");
                return null;
            }
        }

        const venta = {
            id: nuevoId(),
            numero: Datos.siguienteNumero("venta"),
            fecha: new Date().toISOString(),
            items: t.lineas.map(l => ({
                productoId: l.producto.id,
                nombre: l.producto.nombre,
                categoria: l.producto.categoria || "",
                cantidad: l.item.cantidad,
                precio: l.precio,
                subtotal: l.subtotal,
                costo: Math.round((Number(l.producto.costo) || 0) * l.item.cantidad)
            })),
            subtotal: t.subtotal,
            descuento: t.descuento,
            iva: t.iva || 0,
            total: t.total,
            metodo: pago.metodo,
            recibido: pago.recibido,
            vuelto: pago.vuelto,
            usuarioId: usuario.id,
            usuarioNombre: usuario.nombre,
            cajaId: caja.id,
            estado: "valida"
        };

        const ventas = Datos.ventas();
        ventas.unshift(venta);

        if (!Datos.guardarVentas(ventas)) return null;

        Datos.guardarProductos(productos);

        this.guardarCarrito({ items: [], descuento: { valor: 0, tipo: "monto" } });

        return venta;
    },


    mostrarExito(venta) {

        if (Datos.config().imprimirAuto) Impresion.boleta(venta);

        abrirModal({
            titulo: "Venta registrada",
            clase: "angosto",
            html: `
                <div class="venta-lista-exito">
                    <div class="circulo">${icono("check")}</div>
                    <div class="texto-2">Venta N° ${String(venta.numero).padStart(6, "0")}</div>
                    <div style="font-size:28px;font-weight:800;margin:4px 0">${dinero(venta.total)}</div>
                    <div class="texto-2">${esc(METODOS_PAGO[venta.metodo].texto)}</div>
                    ${venta.metodo === "efectivo" ? `<div class="vuelto" style="margin-top:16px;font-size:22px"><span>Vuelto</span><span>${dinero(venta.vuelto)}</span></div>` : ""}
                </div>
            `,
            alCerrar: () => {
                const buscador = $("#vBuscar");
                if (buscador && !esCelular()) buscador.focus();
            },
            botones: [
                { texto: "Compartir", icono: "compartir", accion: () => compartirVenta(venta) },
                { texto: "Imprimir", icono: "impresora", accion: () => Impresion.boleta(venta) },
                { texto: "Nueva venta", clase: "btn-primario" }
            ]
        });
    }
};


// ==========================================
// COBRO (se usa también en otras pantallas)
// ==========================================

function pedirPago(total) {

    return new Promise(resolver => {

        let respuesta = null;
        let metodo = "efectivo";

        const sugeridos = [1000, 2000, 5000, 10000, 20000]
            .map(paso => Math.ceil(total / paso) * paso)
            .filter((v, i, l) => v > total && l.indexOf(v) === i)
            .slice(0, 3);

        abrirModal({
            titulo: "Cobrar",
            html: `
                <div class="total-cobro">
                    <div class="texto-2">Total a pagar</div>
                    <div class="monto">${dinero(total)}</div>
                </div>
                <div class="metodos-pago" id="pgMetodos">
                    ${Object.entries(METODOS_PAGO).map(([k, m]) => `<button type="button" class="metodo ${k === metodo ? "activo" : ""}" data-metodo="${k}">${icono(m.icono)} ${m.texto}</button>`).join("")}
                </div>
                <div id="pgEfectivo" style="margin-top:16px">
                    <div class="campo">
                        <label for="pgRecibido">Monto recibido</label>
                        <input id="pgRecibido" type="text" inputmode="numeric" placeholder="${numero(total)}" style="height:46px;font-size:20px;font-weight:700;text-align:right">
                    </div>
                    <div class="montos-rapidos" style="margin-top:8px">
                        <button class="btn btn-chico" type="button" data-monto="${total}">Exacto</button>
                        ${sugeridos.map(v => `<button class="btn btn-chico" type="button" data-monto="${v}">${dinero(v)}</button>`).join("")}
                    </div>
                    <div class="vuelto" id="pgVuelto" style="margin-top:12px"><span>Vuelto</span><span id="pgVueltoMonto">$0</span></div>
                </div>
                <div id="pgError" class="mensaje-error oculto" style="margin-top:12px"></div>
            `,
            alAbrir(raiz) {

                const recibido = $("#pgRecibido", raiz);

                const actualizar = () => {
                    const caja = $("#pgVuelto", raiz);
                    if (!recibido.value.trim()) {
                        caja.classList.remove("falta");
                        caja.firstElementChild.textContent = "Vuelto";
                        $("#pgVueltoMonto", raiz).textContent = "$0";
                        return;
                    }
                    const vuelto = aEntero(recibido.value) - total;
                    caja.classList.toggle("falta", vuelto < 0);
                    caja.firstElementChild.textContent = vuelto < 0 ? "Falta" : "Vuelto";
                    $("#pgVueltoMonto", raiz).textContent = dinero(Math.abs(vuelto));
                };

                recibido.addEventListener("input", () => {
                    recibido.value = recibido.value.trim() ? numero(aEntero(recibido.value)) : "";
                    actualizar();
                });

                $$("[data-monto]", raiz).forEach(b => b.addEventListener("click", () => {
                    recibido.value = numero(Number(b.dataset.monto));
                    actualizar();
                }));

                $("#pgMetodos", raiz).addEventListener("click", evento => {
                    const boton = evento.target.closest("[data-metodo]");
                    if (!boton) return;
                    metodo = boton.dataset.metodo;
                    $$(".metodo", raiz).forEach(b => b.classList.toggle("activo", b === boton));
                    $("#pgEfectivo", raiz).classList.toggle("oculto", metodo !== "efectivo");
                });

                raiz.addEventListener("keydown", evento => {
                    if (evento.key === "Enter") {
                        evento.preventDefault();
                        $("#pgConfirmar", raiz).click();
                    }
                });
            },
            botones: [
                { texto: "Cancelar" },
                {
                    texto: "Confirmar venta",
                    id: "pgConfirmar",
                    clase: "btn-exito",
                    icono: "check",
                    accion: (cerrar, raiz) => {

                        let recibido = total;

                        if (metodo === "efectivo") {
                            const texto = $("#pgRecibido", raiz).value.trim();
                            recibido = texto ? aEntero(texto) : total;
                            if (recibido < total) {
                                const error = $("#pgError", raiz);
                                error.textContent = "El monto recibido es menor que el total.";
                                error.classList.remove("oculto");
                                return;
                            }
                        }

                        respuesta = { metodo, recibido, vuelto: metodo === "efectivo" ? recibido - total : 0 };
                        cerrar();
                    }
                }
            ],
            alCerrar: () => resolver(respuesta)
        });
    });
}


Modulos.vender = {
    titulo: "Vender",
    icono: "carro",
    roles: ["admin", "vendedor"],
    render: vista => Vender.render(vista)
};
