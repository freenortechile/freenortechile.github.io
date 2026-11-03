// ==========================================
// FREENORTE — MODO DEMOSTRACIÓN
// Se carga en cada sistema de /demos, antes de app.js.
// La primera vez deja el sistema listo con datos de
// ejemplo y la sesión iniciada (usuario demo / demo123).
// Los datos quedan solo en el navegador del visitante.
// ==========================================

(function () {

    "use strict";

    const sistema = (document.currentScript && document.currentScript.dataset.sistema) || (window.DEMO || {}).sistema;

    // Contraseña "demo123" ya protegida (PBKDF2, igual que los sistemas)
    const CLAVE = {
        sal: "d3m0f7e3n0r7e5a1b2c3d4e5f6a7b8c9",
        hash: "36d8685bf88a095ea3e886bea2abb06fe03f02e32b83d3407ae5f2c632b62958"
    };

    const NOMBRES = {
        farmacia: "Farmacia Demo",
        optica: "Óptica Demo",
        mineria: "Minera Demo",
        articulos: "Tienda Demo",
        perfumeria: "Perfumería Demo"
    };

    const PREFIJOS = {
        farmacia: "farma_",
        optica: "optica_",
        mineria: "faena_",
        articulos: "venta_"
    };

    const BASES_FOTOS = {
        farmacia: "farmapos",
        optica: "visionpos",
        mineria: "faenapro",
        articulos: "ventafacil",
        perfumeria: "perfumeria"
    };

    const ahora = new Date().toISOString();


    // ---------- Preparación la primera vez ----------

    function prepararSistemaNuevo() {

        // FarmaPOS, VisiónPOS, FaenaPro y MarkNorte comparten la misma base
        if (Datos.config().configurado) return;

        const config = {
            configurado: true,
            nombre: NOMBRES[sistema],
            rut: "",
            mensajeBoleta: "Gracias por su compra",
            anchoPapel: "80",
            imprimirAuto: false,
            recuperacion: { claveHash: CLAVE.hash, claveSal: CLAVE.sal },
            creado: ahora,
            demo: true
        };

        if (sistema === "optica") {
            config.garantia = "Garantía de 6 meses por defectos de fabricación del armazón.";
            config.diasEntrega = 7;
        }

        if (sistema === "mineria") {
            config.faenas = [{ id: "faena-demo", nombre: "Faena El Cobre", tipo: "Subterránea" }];
            config.mineral = "Cobre";
            config.unidadLey = "%";
            config.metaDiaria = 450;
            config.modulos = {};
        }

        Datos.guardarConfig(config);

        Datos.guardarUsuarios([{
            id: "demo-admin",
            nombre: "Usuario Demo",
            usuario: "demo",
            rol: "admin",
            activo: true,
            claveHash: CLAVE.hash,
            claveSal: CLAVE.sal,
            creado: ahora
        }]);

        DB.guardar("sesion", { usuarioId: "demo-admin", desde: ahora });

        cargarDatosEjemplo();

        if (!location.hash) history.replaceState(null, "", "#inicio");
    }


    function prepararPerfumeria() {

        if (leer(CLAVES.usuarios, []).length) return;

        guardar(CLAVES.config, Object.assign(obtenerConfig(), {
            nombreTienda: NOMBRES.perfumeria,
            recuperacion: { hash: CLAVE.hash, sal: CLAVE.sal, fecha: ahora }
        }));

        guardar(CLAVES.usuarios, [{
            id: "demo-admin",
            nombre: "Usuario Demo",
            usuario: "demo",
            passwordHash: CLAVE.hash,
            passwordSal: CLAVE.sal,
            rol: "Administrador",
            estado: "Activo",
            fechaRegistro: ahora
        }]);

        cargarDatosEjemplo();

        guardarSesion({ id: "demo-admin", nombre: "Usuario Demo", rol: "Administrador" });

        if (!location.hash) history.replaceState(null, "", "#inicio");
    }


    try {
        if (sistema === "perfumeria") prepararPerfumeria();
        else prepararSistemaNuevo();
    } catch (error) {
        console.error("No se pudo preparar la demostración:", error);
    }


    // ---------- Reiniciar la demostración ----------

    function reiniciar() {

        if (!confirm("¿Borrar lo que hizo en la demostración y empezar de nuevo?")) return;

        const prefijo = PREFIJOS[sistema];

        if (prefijo) {
            Object.keys(localStorage).filter(k => k.startsWith(prefijo)).forEach(k => localStorage.removeItem(k));
        } else {
            Object.values(CLAVES).forEach(k => localStorage.removeItem(k));
            ["sesionPerfumeria", "menuColapsado"].forEach(k => localStorage.removeItem(k));
        }

        try {
            indexedDB.deleteDatabase(BASES_FOTOS[sistema]);
        } catch (e) {
            // sin fotos
        }

        location.hash = "#inicio";
        location.reload();
    }


    // ---------- Barra de demostración ----------

    const estilos = document.createElement("style");

    estilos.textContent = `
        .fn-demo {
            position: fixed; left: 12px; bottom: 12px; z-index: 95;
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            padding: 7px 8px 7px 12px; border-radius: 999px;
            background: #05080f; color: #fff; font: 600 12.5px/1.2 "Segoe UI", system-ui, sans-serif;
            box-shadow: 0 10px 30px -8px rgba(0,0,0,.45); border: 1px solid rgba(34,211,238,.45);
        }
        .fn-demo b { color: #22d3ee; }
        .fn-demo span { color: #a5b2c7; font-weight: 500; }
        .fn-demo button, .fn-demo a {
            font: inherit; color: #03121b; background: #22d3ee; border: none; border-radius: 999px;
            padding: 6px 11px; cursor: pointer; text-decoration: none;
        }
        .fn-demo button { background: rgba(255,255,255,.12); color: #fff; }
        @media (max-width: 980px) {
            .fn-demo { left: 50%; transform: translateX(-50%); bottom: auto; top: 68px; font-size: 11.5px; padding: 5px 6px 5px 10px; }
            .fn-demo span { display: none; }
        }
    `;

    document.head.appendChild(estilos);

    const barra = document.createElement("div");

    barra.className = "fn-demo";
    barra.setAttribute("role", "note");
    barra.innerHTML = `
        <b>Demo</b><span>Usuario: demo · Clave: demo123</span>
        <button type="button">Reiniciar</button>
        <a href="../../index.html#sistemas">Volver a FREENORTE</a>
    `;

    barra.querySelector("button").addEventListener("click", reiniciar);

    // Los sistemas redibujan la página completa: la barra se vuelve a poner
    setInterval(() => {
        if (document.body && !document.body.contains(barra)) document.body.appendChild(barra);
    }, 700);
})();
