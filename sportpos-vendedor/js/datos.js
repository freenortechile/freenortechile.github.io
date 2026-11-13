// ==========================================
// SPORTPOS — DATOS DE LA TIENDA
// Productos, ventas, caja y movimientos
// ==========================================

"use strict";

const CATEGORIAS_BASE = [
    "Zapatillas running", "Zapatillas urbanas", "Zapatillas de fútbol", "Zapatillas de básquetbol", "Zapatillas niños",
    "Poleras", "Polerones", "Pantalones y calzas", "Shorts", "Camisetas de fútbol", "Chaquetas",
    "Ropa niños", "Poleras niños", "Polerones niños", "Pantalones niños", "Buzos y conjuntos niños",
    "Ropa bebé", "Zapatillas bebé",
    "Calcetines", "Mochilas y bolsos", "Accesorios", "Varios"
];

const UNIDADES = ["par", "unidad"];

const GENEROS = ["Hombre", "Mujer", "Unisex", "Niño", "Niña"];

// Grupos de tallas para agregar con un toque (siempre se puede escribir otra talla a mano)
const GRUPOS_TALLAS = [
    { id: "calzado",   texto: "Calzado adulto", unidad: "par",    tallas: ["35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46"] },
    { id: "calzadoN",  texto: "Calzado niños",  unidad: "par",    tallas: ["22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35"] },
    { id: "calzadoB",  texto: "Calzado bebé",   unidad: "par",    tallas: ["16", "17", "18", "19", "20", "21"] },
    { id: "ropa",      texto: "Ropa adulto",    unidad: "unidad", tallas: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] },
    { id: "ropaN",     texto: "Ropa niños",     unidad: "unidad", tallas: ["2", "4", "6", "8", "10", "12", "14", "16"] },
    { id: "ropaB",     texto: "Ropa bebé",      unidad: "unidad", tallas: ["0-3 m", "3-6 m", "6-9 m", "9-12 m", "12-18 m", "18-24 m"] }
];

const DIAS_CAMBIO = 30;
const MESES_GARANTIA = 6;

const METODOS_PAGO = {
    efectivo:      { texto: "Efectivo",      icono: "dinero" },
    debito:        { texto: "Débito",        icono: "tarjeta" },
    credito:       { texto: "Crédito",       icono: "tarjeta" },
    transferencia: { texto: "Transferencia", icono: "transferencia" }
};

const ROLES = {
    admin:    "Administrador",
    vendedor: "Vendedor"
};

// Cada archivo de js/modulos agrega aquí su pantalla
const Modulos = {};


// ==========================================
// LECTURA Y GUARDADO
// ==========================================

const Datos = {

    config: () => DB.leer("config", {}),
    guardarConfig: valor => DB.guardar("config", valor),

    usuarios: () => DB.leer("usuarios", []),
    // sin los usuarios borrados (el registro se guarda marcado para que el borrado llegue a todos los equipos)
    usuariosVigentes: () => DB.leer("usuarios", []).filter(u => u && !u.borrado),
    guardarUsuarios: valor => DB.guardar("usuarios", valor),

    productos: () => DB.leer("productos", []),
    guardarProductos: valor => DB.guardar("productos", valor),

    ventas: () => DB.leer("ventas", []),
    guardarVentas: valor => DB.guardar("ventas", valor),

    movimientos: () => DB.leer("movimientos", []),
    guardarMovimientos: valor => DB.guardar("movimientos", valor),

    cajaActual: () => DB.leer("caja", null),
    guardarCaja: valor => valor ? DB.guardar("caja", valor) : DB.borrar("caja"),

    posventa: () => DB.leer("posventa", []),
    guardarPosventa: valor => DB.guardar("posventa", valor),

    cierres: () => DB.leer("cierres", []),
    guardarCierres: valor => DB.guardar("cierres", valor),


    producto(id) {
        return this.productos().find(p => p.id === id) || null;
    },


    categorias() {
        return Array.from(new Set(CATEGORIAS_BASE.concat(this.productos().map(p => p.categoria).filter(Boolean)))).sort();
    },


    siguienteNumero(tipo) {

        const contadores = DB.leer("contadores", {});

        contadores[tipo] = (contadores[tipo] || 0) + 1;

        DB.guardar("contadores", contadores);

        return contadores[tipo];
    },


    registrarMovimiento(movimiento) {

        const lista = this.movimientos();

        lista.unshift(Object.assign({ id: nuevoId(), fecha: new Date().toISOString(), usuario: Sesion.nombre() }, movimiento));

        this.guardarMovimientos(lista.slice(0, 5000));
    }
};


// ==========================================
// PRODUCTOS Y STOCK
// ==========================================

function nombreCompleto(producto) {
    return producto ? producto.nombre : "";
}


// Nombre que se ve en la venta: "Nike Pegasus 40 · Negro · Talla 42"
function nombreVariante(p) {
    const modelo = [p.marca, p.modelo].filter(Boolean).join(" ").trim();
    return [modelo || p.base || "", p.color, p.talla ? "Talla " + p.talla : ""].filter(Boolean).join(" · ");
}


// Los servicios o productos "sin control" no descuentan stock
function controlaStock(producto) {
    return producto.controlaStock !== false;
}


function stockBajo(producto) {
    return controlaStock(producto) && aEntero(producto.stockMinimo) > 0 && Number(producto.stock) < aEntero(producto.stockMinimo);
}


function textoStock(producto) {

    if (!controlaStock(producto)) {
        return "Sin control de stock";
    }

    const n = Math.round(Number(producto.stock) * 100) / 100;
    const unidad = producto.unidad === "par" ? (n === 1 ? " par" : " pares") : producto.unidad && producto.unidad !== "unidad" ? " " + producto.unidad + (n === 1 ? "" : "s") : "";

    return n <= 0 ? "Sin stock" : formatoNumero.format(n) + (unidad || (n === 1 ? " unidad" : " unidades"));
}


function descontarStock(productos, productoId, cantidad) {

    const p = productos.find(x => x.id === productoId);

    if (!p || !controlaStock(p)) return true;

    if (Number(p.stock) < cantidad) return false;

    p.stock = Math.round((Number(p.stock) - cantidad) * 1000) / 1000;

    return true;
}


function devolverStock(productos, productoId, cantidad) {

    const p = productos.find(x => x.id === productoId);

    if (p && controlaStock(p)) {
        p.stock = Math.round((Number(p.stock) + cantidad) * 1000) / 1000;
    }
}


function detalleProducto(p) {
    return [p.categoria, p.marca].filter(Boolean).join(" · ");
}


function insigniaCategoria(p) {
    return p.categoria ? `<span class="badge b-azul">${esc(p.categoria)}</span>` : "";
}


// ==========================================
// SESIÓN
// ==========================================

const Sesion = {

    usuario() {

        const sesion = DB.leer("sesion", null);

        if (!sesion) return null;

        const usuario = Datos.usuarios().find(u => u.id === sesion.usuarioId);

        return usuario && usuario.activo && !usuario.borrado ? usuario : null;
    },

    iniciar(usuario) {
        DB.guardar("sesion", { usuarioId: usuario.id, desde: new Date().toISOString() });
    },

    cerrar() {
        DB.borrar("sesion");
    },

    esAdmin() {
        const u = this.usuario();
        return Boolean(u && u.rol === "admin");
    },

    nombre() {
        const u = this.usuario();
        return u ? u.nombre : "";
    }
};


// ==========================================
// CAJA
// ==========================================

function resumenCaja(caja) {

    const porMetodo = { efectivo: 0, debito: 0, credito: 0, transferencia: 0 };

    const ventas = Datos.ventas().filter(v => v.cajaId === caja.id);
    const validas = ventas.filter(v => v.estado !== "anulada");

    validas.forEach(v => { porMetodo[v.metodo] = (porMetodo[v.metodo] || 0) + v.total; });

    const totalVentas = validas.reduce((s, v) => s + v.total, 0);

    // Posventa: el dinero que se cobra o se devuelve en cambios, devoluciones y garantías
    let cobrosPosventa = 0;
    let devolucionesPosventa = 0;
    let cantidadPosventa = 0;

    Datos.posventa().filter(c => c.cajaId === caja.id && c.estado !== "anulado" && c.diferencia).forEach(c => {
        porMetodo[c.metodo || "efectivo"] = (porMetodo[c.metodo || "efectivo"] || 0) + c.diferencia;
        if (c.diferencia > 0) cobrosPosventa += c.diferencia; else devolucionesPosventa += -c.diferencia;
        cantidadPosventa++;
    });

    const movimientos = caja.movimientos || [];
    const ingresos = movimientos.filter(m => m.tipo === "ingreso").reduce((s, m) => s + m.monto, 0);
    const retiros = movimientos.filter(m => m.tipo === "retiro").reduce((s, m) => s + m.monto, 0);

    return {
        cantidadVentas: validas.length,
        cantidadAnuladas: ventas.length - validas.length,
        totalVentas,
        cantidadAbonos: cantidadPosventa,
        totalAbonos: cobrosPosventa,
        totalDevoluciones: devolucionesPosventa,
        totalCobrado: totalVentas + cobrosPosventa - devolucionesPosventa,
        porMetodo,
        ingresos,
        retiros,
        efectivoEsperado: (caja.fondoInicial || 0) + porMetodo.efectivo + ingresos - retiros
    };
}
