// ==========================================
// SPORTPOS — CAJA
// Apertura, ingresos y retiros, cierre con arqueo
// ==========================================

"use strict";

const DENOMINACIONES = [20000, 10000, 5000, 2000, 1000, 500, 100, 50, 10];


function abrirCajaModal(alTerminar) {

    if (Datos.cajaActual()) {
        if (alTerminar) alTerminar();
        return;
    }

    const ultimo =
        Datos.cierres()[0];

    abrirModal({
        titulo: "Abrir caja",
        clase: "angosto",
        html: `
            <p style="margin-bottom:14px">Cuente el dinero con que parte la caja (sencillo para dar vuelto).</p>
            <div class="campo">
                <label for="acFondo">Fondo inicial en efectivo</label>
                <input id="acFondo" type="text" inputmode="numeric" placeholder="0" style="height:46px;font-size:20px;font-weight:700;text-align:right">
                ${ultimo ? `<span class="ayuda">En el último cierre quedaron ${dinero(ultimo.contado)} contados.</span>` : ""}
            </div>
        `,
        alAbrir(raiz) {

            const campo = $("#acFondo", raiz);

            campo.addEventListener("input", () => {
                campo.value = campo.value.trim() ? numero(aEntero(campo.value)) : "";
            });

            campo.addEventListener("keydown", evento => {
                if (evento.key === "Enter") {
                    evento.preventDefault();
                    $(".modal-pie .btn-primario", raiz).click();
                }
            });
        },
        botones: [
            { texto: "Cancelar" },
            {
                texto: "Abrir caja",
                clase: "btn-primario",
                accion: (cerrar, raiz) => {

                    const usuario = Sesion.usuario();

                    Datos.guardarCaja({
                        id: nuevoId(),
                        abiertaEn: new Date().toISOString(),
                        abiertaPor: usuario.nombre,
                        abiertaPorId: usuario.id,
                        fondoInicial: Math.max(0, aEntero($("#acFondo", raiz).value)),
                        movimientos: []
                    });

                    cerrar();

                    avisar("Caja abierta. Ya puede vender.");

                    App.actualizarBarra();

                    if (alTerminar) alTerminar();
                }
            }
        ]
    });
}


const Caja = {

    render(vista) {

        const caja =
            Datos.cajaActual();

        vista.innerHTML = `
            <div id="cajaContenido"></div>
            ${Sesion.esAdmin() ? '<div id="cajaHistorial" style="margin-top:18px"></div>' : ""}
        `;

        if (caja) {
            this.pintarAbierta(caja);
        } else {
            this.pintarCerrada();
        }

        if (Sesion.esAdmin()) {
            this.pintarHistorial();
        }
    },


    pintarCerrada() {

        const ultimo =
            Datos.cierres()[0];

        $("#cajaContenido").innerHTML = `
            <div class="tarjeta">
                <div class="tarjeta-cuerpo" style="text-align:center;padding:40px 20px">
                    <div class="kpi-icono" style="margin:0 auto 14px;width:56px;height:56px">${icono("caja")}</div>
                    <h2>La caja está cerrada</h2>
                    <p class="texto-2" style="margin:6px 0 18px">Abra la caja al comenzar el turno para registrar las ventas.</p>
                    <button class="btn btn-primario btn-grande" id="btnAbrirCaja">${icono("caja")} Abrir caja</button>
                    ${ultimo ? `<p class="chico texto-3" style="margin-top:16px">Último cierre: ${fechaHora(ultimo.cerradaEn)} por ${esc(ultimo.cerradaPor)}</p>` : ""}
                </div>
            </div>
        `;

        $("#btnAbrirCaja").addEventListener("click", () => abrirCajaModal(() => App.refrescar()));
    },


    pintarAbierta(caja) {

        const r =
            resumenCaja(caja);

        const movimientos =
            (caja.movimientos || []).slice().reverse();

        $("#cajaContenido").innerHTML = `
            <div class="cabecera-vista">
                <div>
                    <h2>Caja abierta</h2>
                    <p class="sub">Abierta por ${esc(caja.abiertaPor)} el ${fechaHora(caja.abiertaEn)}</p>
                </div>
                <div class="fila">
                    <button class="btn" id="btnIngreso">${icono("mas")} Ingreso de dinero</button>
                    <button class="btn" id="btnRetiro">${icono("menos")} Retiro de dinero</button>
                    <button class="btn btn-primario" id="btnCerrarCaja">${icono("candado")} Cerrar caja</button>
                </div>
            </div>

            <div class="kpis">
                <div class="kpi">
                    <div class="kpi-icono verde">${icono("tendencia")}</div>
                    <div><div class="etiqueta">Ventas del turno</div><div class="valor">${dinero(r.totalCobrado)}</div><div class="detalle">${plural(r.cantidadVentas, "venta", "ventas")}${r.cantidadAnuladas ? " · " + r.cantidadAnuladas + " anuladas" : ""}${r.cantidadAbonos ? " · " + plural(r.cantidadAbonos, "cambio/devolución", "cambios/devoluciones") : ""}</div></div>
                </div>
                <div class="kpi">
                    <div class="kpi-icono">${icono("dinero")}</div>
                    <div><div class="etiqueta">Efectivo en caja (esperado)</div><div class="valor">${dinero(r.efectivoEsperado)}</div><div class="detalle">Fondo ${dinero(caja.fondoInicial)}</div></div>
                </div>
                <div class="kpi">
                    <div class="kpi-icono morado">${icono("tarjeta")}</div>
                    <div><div class="etiqueta">Tarjetas</div><div class="valor">${dinero(r.porMetodo.debito + r.porMetodo.credito)}</div><div class="detalle">Débito ${dinero(r.porMetodo.debito)} · Crédito ${dinero(r.porMetodo.credito)}</div></div>
                </div>
                <div class="kpi">
                    <div class="kpi-icono amarillo">${icono("transferencia")}</div>
                    <div><div class="etiqueta">Transferencias</div><div class="valor">${dinero(r.porMetodo.transferencia)}</div></div>
                </div>
            </div>

            <div class="dos-iguales">
                <div class="tarjeta">
                    <div class="tarjeta-cabeza"><h3>Cuadre de efectivo</h3></div>
                    <ul class="lista-simple">
                        <li><span>Fondo inicial</span><strong>${dinero(caja.fondoInicial)}</strong></li>
                        <li><span>+ Ventas en efectivo</span><strong>${dinero(r.porMetodo.efectivo)}</strong></li>
                        <li><span>+ Ingresos de dinero</span><strong>${dinero(r.ingresos)}</strong></li>
                        <li><span>− Retiros de dinero</span><strong>${dinero(r.retiros)}</strong></li>
                        <li style="background:var(--azul-claro)"><span class="negrita">Debe haber en caja</span><strong style="font-size:17px">${dinero(r.efectivoEsperado)}</strong></li>
                    </ul>
                </div>
                <div class="tarjeta">
                    <div class="tarjeta-cabeza"><h3>Ingresos y retiros</h3></div>
                    ${movimientos.length
                        ? `<ul class="lista-simple">${movimientos.map(m => `
                            <li>
                                <div>
                                    <div class="negrita">${esc(m.motivo)}</div>
                                    <div class="chico texto-2">${hora(m.fecha)} · ${esc(m.usuario)}</div>
                                </div>
                                <strong class="${m.tipo === "ingreso" ? "verde" : "rojo"}" title="${m.tipo === "devolucion" ? "Devolución a cliente" : ""}">${m.tipo === "ingreso" ? "+" : "−"}${dinero(m.monto)}</strong>
                            </li>`).join("")}</ul>`
                        : vacioHTML("dinero", "Sin movimientos", "Registre aquí el dinero que entra o sale de la caja fuera de las ventas.")}
                </div>
            </div>
        `;

        $("#btnIngreso").addEventListener("click", () => this.movimiento("ingreso"));
        $("#btnRetiro").addEventListener("click", () => this.movimiento("retiro"));
        $("#btnCerrarCaja").addEventListener("click", () => this.cerrar());
    },


    movimiento(tipo) {

        const esIngreso =
            tipo === "ingreso";

        abrirModal({
            titulo: esIngreso ? "Ingreso de dinero" : "Retiro de dinero",
            clase: "angosto",
            html: `
                <div class="rejilla">
                    <div class="campo">
                        <label class="requerido" for="mvMonto">Monto</label>
                        <input id="mvMonto" type="text" inputmode="numeric" placeholder="0" style="height:44px;font-size:18px;font-weight:700;text-align:right">
                    </div>
                    <div class="campo">
                        <label class="requerido" for="mvMotivo">Motivo</label>
                        <input id="mvMotivo" list="mvMotivos" placeholder="${esIngreso ? "Sencillo adicional" : "Pago a proveedor"}">
                        <datalist id="mvMotivos">
                            ${(esIngreso
                                ? ["Sencillo adicional", "Aporte del dueño", "Otro"]
                                : ["Pago a proveedor", "Depósito en banco", "Retiro del dueño", "Gastos menores", "Otro"]
                            ).map(o => `<option value="${o}">`).join("")}
                        </datalist>
                    </div>
                    <div id="mvError" class="mensaje-error oculto"></div>
                </div>
            `,
            alAbrir(raiz) {
                const campo = $("#mvMonto", raiz);
                campo.addEventListener("input", () => {
                    campo.value = campo.value.trim() ? numero(aEntero(campo.value)) : "";
                });
            },
            botones: [
                { texto: "Cancelar" },
                {
                    texto: esIngreso ? "Registrar ingreso" : "Registrar retiro",
                    clase: "btn-primario",
                    accion: (cerrar, raiz) => {

                        const monto = aEntero($("#mvMonto", raiz).value);
                        const motivo = $("#mvMotivo", raiz).value.trim();
                        const error = $("#mvError", raiz);

                        if (monto <= 0 || !motivo) {
                            error.textContent = "Escriba el monto y el motivo.";
                            error.classList.remove("oculto");
                            return;
                        }

                        const caja = Datos.cajaActual();

                        if (!esIngreso && monto > resumenCaja(caja).efectivoEsperado) {
                            error.textContent = "El retiro es mayor que el efectivo que debería haber en caja.";
                            error.classList.remove("oculto");
                            return;
                        }

                        caja.movimientos = caja.movimientos || [];

                        caja.movimientos.push({
                            id: nuevoId(),
                            tipo,
                            monto,
                            motivo,
                            fecha: new Date().toISOString(),
                            usuario: Sesion.nombre()
                        });

                        Datos.guardarCaja(caja);

                        cerrar();

                        avisar(esIngreso ? "Ingreso registrado." : "Retiro registrado.");

                        App.refrescar();
                    }
                }
            ]
        });
    },


    cerrar() {

        const caja =
            Datos.cajaActual();

        const r =
            resumenCaja(caja);

        abrirModal({
            titulo: "Cerrar caja",
            clase: "ancho",
            html: `
                <p style="margin-bottom:14px">Cuente el efectivo que hay en la caja y anote cuántos billetes y monedas de cada valor hay.</p>
                <div class="denominaciones">
                    ${DENOMINACIONES.map(valor => `
                        <div class="denominacion">
                            <label for="den${valor}">${dinero(valor)}</label>
                            <input id="den${valor}" data-den="${valor}" type="text" inputmode="numeric" placeholder="0">
                        </div>`).join("")}
                </div>
                <div class="resumen-arqueo">
                    <div><div class="chico texto-2">Debe haber</div><div class="v">${dinero(r.efectivoEsperado)}</div></div>
                    <div><div class="chico texto-2">Contado</div><div class="v" id="arqContado">$0</div></div>
                    <div id="arqCaja"><div class="chico">Diferencia</div><div class="v" id="arqDiferencia">${dinero(-r.efectivoEsperado)}</div></div>
                </div>
                <div class="campo" style="margin-top:14px">
                    <label for="arqObs">Observaciones</label>
                    <textarea id="arqObs" placeholder="Opcional. Explique cualquier diferencia."></textarea>
                </div>
                <div class="mensaje-info" style="margin-top:12px">
                    Ventas del turno: ${dinero(r.totalCobrado)} (${plural(r.cantidadVentas, "venta", "ventas")}) ·
                    Tarjetas ${dinero(r.porMetodo.debito + r.porMetodo.credito)} · Transferencias ${dinero(r.porMetodo.transferencia)}
                </div>
            `,
            alAbrir(raiz) {

                const actualizar = () => {

                    const contado =
                        $$("[data-den]", raiz).reduce(
                            (suma, campo) => suma + aEntero(campo.value) * Number(campo.dataset.den),
                            0
                        );

                    const diferencia =
                        contado - r.efectivoEsperado;

                    $("#arqContado", raiz).textContent = dinero(contado);
                    $("#arqDiferencia", raiz).textContent = (diferencia > 0 ? "+" : "") + dinero(diferencia);

                    const caja = $("#arqCaja", raiz);
                    caja.classList.toggle("ok", diferencia === 0);
                    caja.classList.toggle("mal", diferencia !== 0);
                };

                $$("[data-den]", raiz).forEach(campo => {
                    campo.addEventListener("input", () => {
                        campo.value = campo.value.replace(/[^\d]/g, "");
                        actualizar();
                    });
                });

                actualizar();
            },
            botones: [
                { texto: "Cancelar" },
                {
                    texto: "Cerrar caja",
                    clase: "btn-primario",
                    icono: "candado",
                    accion: async (cerrarModal, raiz) => {

                        const detalle = {};
                        let contado = 0;

                        $$("[data-den]", raiz).forEach(campo => {
                            const cantidad = aEntero(campo.value);
                            if (cantidad > 0) {
                                detalle[campo.dataset.den] = cantidad;
                                contado += cantidad * Number(campo.dataset.den);
                            }
                        });

                        const diferencia = contado - r.efectivoEsperado;

                        if (diferencia !== 0) {

                            const ok = await confirmar({
                                titulo: "Hay una diferencia",
                                mensaje: `La caja tiene una diferencia de <strong>${(diferencia > 0 ? "+" : "") + dinero(diferencia)}</strong>. ¿Cerrar de todas formas?`,
                                textoSi: "Cerrar igual"
                            });

                            if (!ok) return;
                        }

                        const usuario = Sesion.usuario();

                        const cierre = {
                            id: caja.id,
                            numero: Datos.siguienteNumero("cierre"),
                            abiertaEn: caja.abiertaEn,
                            abiertaPor: caja.abiertaPor,
                            cerradaEn: new Date().toISOString(),
                            cerradaPor: usuario.nombre,
                            fondoInicial: caja.fondoInicial,
                            movimientos: caja.movimientos || [],
                            resumen: resumenCaja(caja),
                            detalle,
                            contado,
                            diferencia,
                            observacion: $("#arqObs", raiz).value.trim()
                        };

                        const cierres = Datos.cierres();
                        cierres.unshift(cierre);

                        if (!Datos.guardarCierres(cierres)) return;

                        Datos.guardarCaja(null);
                        if (typeof RespaldoAuto !== "undefined") RespaldoAuto.guardar("cierre de caja");

                        cerrarModal();

                        App.refrescar();

                        abrirModal({
                            titulo: "Caja cerrada",
                            clase: "angosto",
                            html: `
                                <div class="venta-lista-exito">
                                    <div class="circulo">${icono("check")}</div>
                                    <div class="texto-2">Cierre N° ${cierre.numero}</div>
                                    <div style="font-size:24px;font-weight:800;margin:4px 0">${dinero(contado)}</div>
                                    <div class="${diferencia === 0 ? "verde" : "rojo"} negrita">
                                        ${diferencia === 0 ? "Caja cuadrada" : "Diferencia " + (diferencia > 0 ? "+" : "") + dinero(diferencia)}
                                    </div>
                                </div>
                            `,
                            botones: [
                                { texto: "Imprimir cierre", icono: "impresora", accion: () => Impresion.cierre(cierre) },
                                { texto: "Listo", clase: "btn-primario" }
                            ]
                        });
                    }
                }
            ]
        });
    },


    pintarHistorial() {

        const cierres =
            Datos.cierres().slice(0, 60);

        $("#cajaHistorial").innerHTML = `
            <div class="tarjeta">
                <div class="tarjeta-cabeza"><h3>Historial de cierres</h3><span class="chico texto-2">Últimos ${cierres.length}</span></div>
                ${cierres.length ? `
                    <div class="tabla-contenedor">
                        <table class="tabla">
                            <thead><tr>
                                <th>N°</th><th>Apertura</th><th>Cierre</th><th>Cerró</th>
                                <th class="num">Cobrado</th><th class="num">Esperado</th><th class="num">Contado</th><th class="num">Diferencia</th><th></th>
                            </tr></thead>
                            <tbody>
                                ${cierres.map(c => `
                                    <tr>
                                        <td>${c.numero}</td>
                                        <td class="nowrap">${fechaHora(c.abiertaEn)}</td>
                                        <td class="nowrap">${fechaHora(c.cerradaEn)}</td>
                                        <td>${esc(c.cerradaPor)}</td>
                                        <td class="num">${dinero(c.resumen.totalCobrado ?? c.resumen.totalVentas)}</td>
                                        <td class="num">${dinero(c.resumen.efectivoEsperado)}</td>
                                        <td class="num">${dinero(c.contado)}</td>
                                        <td class="num ${c.diferencia === 0 ? "verde" : "rojo"} negrita">${(c.diferencia > 0 ? "+" : "") + dinero(c.diferencia)}</td>
                                        <td class="acciones"><button class="btn btn-chico" data-imprimir="${c.id}">${icono("impresora")} Imprimir</button></td>
                                    </tr>`).join("")}
                            </tbody>
                        </table>
                    </div>` : vacioHTML("caja", "Aún no hay cierres", "Aquí aparecerán los cierres de caja anteriores.")}
            </div>
        `;

        $("#cajaHistorial").addEventListener("click", evento => {

            const boton = evento.target.closest("[data-imprimir]");

            if (boton) {
                const cierre = Datos.cierres().find(c => c.id === boton.dataset.imprimir);
                if (cierre) Impresion.cierre(cierre);
            }
        });
    }
};


Modulos.caja = {
    titulo: "Caja",
    icono: "caja",
    roles: ["admin", "vendedor"],
    render: vista => Caja.render(vista)
};
