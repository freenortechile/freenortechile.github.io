// ==========================================
// SPORTPOS — LECTOR DE CÓDIGOS (cámara y foto)
// Lee casi cualquier código impreso: caja de cartón, etiqueta térmica, papel brillante,
// códigos chicos, torcidos, borrosos, en perspectiva, con poca luz, claro sobre oscuro.
// Formatos: EAN-13, EAN-8, UPC-A, UPC-E, Code 128, Code 39, Code 93, ITF, Codabar, QR, Data Matrix, PDF417, Aztec.
// Funciona sin internet (la librería viene incluida) y reemplaza al lector anterior de movil.js.
// ==========================================

"use strict";

(function () {

    const URL_ZXING = "js/vendor/zxing-library.min.js";

    let ZX = null;
    let hints = null;
    let lector = null;
    let lienzo = null;
    let ctx = null;

    async function prepararZXing() {

        if (ZX) return ZX;

        await cargarScript(URL_ZXING);

        ZX = window.ZXing;

        const F = ZX.BarcodeFormat;

        hints = new Map();
        hints.set(ZX.DecodeHintType.POSSIBLE_FORMATS, [
            F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR,
            F.QR_CODE, F.DATA_MATRIX, F.PDF_417, F.AZTEC
        ]);
        hints.set(ZX.DecodeHintType.TRY_HARDER, true);

        lector = new ZX.MultiFormatReader();

        lienzo = document.createElement("canvas");
        ctx = lienzo.getContext("2d", { willReadFrequently: true });

        return ZX;
    }


    // Códigos lineales: se pide leer lo mismo dos veces para no aceptar una lectura falsa
    // (los códigos 2D, como QR, ya traen corrección de errores)
    function sinVerificador(formato) {
        const F = ZX.BarcodeFormat;
        return [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128, F.CODE_39, F.CODE_93, F.ITF, F.CODABAR].includes(formato);
    }


    // Dibuja (recortado, escalado y girado) la imagen o el cuadro de video en el lienzo
    function preparar(origen, ow, oh, rec, anchoDestino, giro) {

        const sx = rec[0] * ow, sy = rec[1] * oh, sw = rec[2] * ow, sh = rec[3] * oh;
        const esc = Math.min(3, anchoDestino / sw);
        const w = Math.max(32, Math.round(sw * esc)), h = Math.max(32, Math.round(sh * esc));
        const girado = giro % 180 !== 0;

        lienzo.width = girado ? h : w;
        lienzo.height = girado ? w : h;

        ctx.save();
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, lienzo.width, lienzo.height);
        ctx.translate(lienzo.width / 2, lienzo.height / 2);
        ctx.rotate(giro * Math.PI / 180);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(origen, sx, sy, sw, sh, -w / 2, -h / 2, w, h);
        ctx.restore();

        return ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    }


    // Escala de grises; "estirar" ensancha el contraste (papel gris, etiqueta térmica, poca luz)
    function luminancia(datos, estirar) {

        const d = datos.data;
        const n = datos.width * datos.height;
        const y = new Uint8ClampedArray(n);
        const hist = new Uint32Array(256);

        for (let i = 0, j = 0; i < n; i++, j += 4) {
            const v = (d[j] * 306 + d[j + 1] * 601 + d[j + 2] * 117) >> 10;
            y[i] = v;
            hist[v]++;
        }

        if (estirar) {

            let acc = 0, bajo = 0, alto = 255;

            for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.01) { bajo = v; break; } }
            acc = 0;
            for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= n * 0.99) { alto = v; break; } }

            if (alto - bajo > 20) {
                const k = 255 / (alto - bajo);
                for (let i = 0; i < n; i++) y[i] = (y[i] - bajo) * k;
            }
        }

        return y;
    }


    function decodificar(datos, estirar, binarizador, invertir) {

        let fuente = new ZX.RGBLuminanceSource(luminancia(datos, estirar), datos.width, datos.height);

        if (invertir) fuente = new ZX.InvertedLuminanceSource(fuente);

        const mapa = new ZX.BinaryBitmap(binarizador === "G" ? new ZX.GlobalHistogramBinarizer(fuente) : new ZX.HybridBinarizer(fuente));

        try {
            const r = lector.decode(mapa, hints);
            return { texto: r.getText(), formato: r.getBarcodeFormat() };
        } catch (e) {
            return null;
        }
    }


    // Formas de mirar el mismo cuadro. En vivo se prueban de a dos por cuadro para no pesar.
    const ESTRATEGIAS = [
        { rec: [0, 0, 1, 1],             ancho: 1280, giro: 0,  est: false, bin: "H", inv: false },
        { rec: [0.06, 0.18, 0.88, 0.64], ancho: 1500, giro: 0,  est: true,  bin: "H", inv: false },
        { rec: [0, 0, 1, 1],             ancho: 1280, giro: 0,  est: true,  bin: "G", inv: false },
        { rec: [0.22, 0.22, 0.56, 0.56], ancho: 1100, giro: 0,  est: true,  bin: "H", inv: false },
        { rec: [0.06, 0.18, 0.88, 0.64], ancho: 1500, giro: 0,  est: true,  bin: "H", inv: true },
        { rec: [0.2, 0.05, 0.6, 0.9],    ancho: 1100, giro: 90, est: true,  bin: "H", inv: false },
        { rec: [0, 0, 1, 1],             ancho: 1000, giro: 0,  est: true,  bin: "G", inv: true },
        { rec: [0, 0, 1, 1],             ancho: 800,  giro: 0,  est: true,  bin: "H", inv: false },
        { rec: [0.1, 0.15, 0.8, 0.7],    ancho: 700,  giro: 0,  est: true,  bin: "G", inv: false },
        { rec: [0.1, 0.15, 0.8, 0.7],    ancho: 600,  giro: 0,  est: true,  bin: "H", inv: false }
    ];


    function aplicar(origen, ow, oh, e) {
        return decodificar(preparar(origen, ow, oh, e.rec, e.ancho, e.giro), e.est, e.bin, e.inv);
    }


    // ---------- leer un código desde una foto o imagen ----------
    async function decodificarImagen(archivo) {

        await prepararZXing();

        const imagen = await createImageBitmap(archivo);
        const ow = imagen.width, oh = imagen.height;
        const largos = Array.from(new Set([Math.min(ow, 2000), 1200, 700].filter(a => a >= 320)));
        const recortes = [[0, 0, 1, 1], [0.1, 0.15, 0.8, 0.7]];
        const lecturas = {};
        let primera = null;
        let intentos = 0;

        for (const rec of recortes) {
            for (const ancho of largos) {
                for (const giro of [0, 90]) {
                    for (const [est, bin, inv] of [[false, "H", false], [true, "H", false], [true, "G", false], [true, "H", true]]) {

                        // deja respirar a la pantalla
                        if (++intentos % 4 === 0) await new Promise(res => setTimeout(res, 0));

                        const r = aplicar(imagen, ow, oh, { rec, ancho, giro, est, bin, inv });

                        if (!r) continue;

                        if (!sinVerificador(r.formato)) { imagen.close(); return Object.assign(r, { confirmado: true }); }

                        lecturas[r.texto] = (lecturas[r.texto] || 0) + 1;
                        if (!primera) primera = r;
                        if (lecturas[r.texto] >= 2) { imagen.close(); return Object.assign(r, { confirmado: true }); }
                    }
                }
            }
        }

        imagen.close();

        // una sola lectura: se devuelve, pero la pantalla pide confirmarla
        return primera ? Object.assign(primera, { confirmado: false }) : null;
    }


    // ---------- pantalla del escáner ----------
    function escanear() {

        return new Promise(resolver => {

            if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                // sin cámara: igual se puede subir una foto o escribir el código
            }

            let terminado = false;
            let flujo = null;
            let temporizador = null;
            let resultado = null;
            let ronda = 0;
            let anterior = null;

            const detener = () => {
                terminado = true;
                clearTimeout(temporizador);
                if (flujo) flujo.getTracks().forEach(pista => pista.stop());
            };

            const { raiz, cerrar } = abrirModal({
                titulo: "Escanear código de barras",
                html: `
                    <div class="escaner">
                        <video id="escVideo" playsinline muted autoplay></video>
                        <div class="escaner-marco"></div>
                    </div>
                    <p class="centro texto-2" id="escEstado" style="margin-top:12px">Abriendo la cámara…</p>
                    <div id="escHerr" style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin-top:8px"></div>
                    <p class="centro chico texto-3" style="margin-top:6px">Acerque o aleje hasta ver nítidas las barras. Sirve cualquier papel, caja o etiqueta.</p>
                    <div style="display:flex;gap:8px;margin-top:14px">
                        <input id="escManual" placeholder="¿No lo lee? Escriba el código" inputmode="text" autocomplete="off" style="flex:1">
                        <button type="button" class="btn" id="escUsar">Usar</button>
                    </div>
                    <div style="margin-top:8px">
                        <button type="button" class="btn btn-bloque" id="escFoto">${icono("camara")} Subir o sacar una foto del código</button>
                        <input type="file" id="escArchivo" accept="image/*" style="display:none">
                    </div>
                `,
                botones: [{ texto: "Cancelar" }],
                alCerrar: () => {
                    detener();
                    resolver(resultado);
                }
            });

            const video = $("#escVideo", raiz);
            const estado = $("#escEstado", raiz);
            const herr = $("#escHerr", raiz);

            const encontrado = texto => {
                if (terminado || !texto) return;
                resultado = String(texto).trim();
                if (navigator.vibrate) navigator.vibrate(80);
                cerrar();
            };

            // escribir el código a mano
            const usarManual = () => {
                const t = $("#escManual", raiz).value.trim();
                if (t) encontrado(t);
            };
            $("#escUsar", raiz).addEventListener("click", usarManual);
            $("#escManual", raiz).addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); usarManual(); } });

            // foto del código
            $("#escFoto", raiz).addEventListener("click", () => $("#escArchivo", raiz).click());
            $("#escArchivo", raiz).addEventListener("change", async e => {
                const archivo = e.target.files[0];
                if (!archivo) return;
                estado.textContent = "Analizando la foto…";
                try {
                    const r = await decodificarImagen(archivo);
                    if (r && r.confirmado) encontrado(r.texto);
                    else if (r) {
                        estado.innerHTML = `Se leyó <strong>${esc(r.texto)}</strong>. ¿Es el número que ve impreso? <button type="button" class="btn btn-chico btn-primario" id="escConfirma">Sí, usar</button>`;
                        $("#escConfirma", raiz).addEventListener("click", () => encontrado(r.texto));
                    }
                    else estado.innerHTML = '<span class="rojo">No se encontró un código en la foto. Pruebe con otra foto más cerca y con buena luz.</span>';
                } catch (error) {
                    estado.innerHTML = '<span class="rojo">No se pudo leer la foto.</span>';
                }
                e.target.value = "";
            });

            const falla = error => {

                if (terminado) return;

                const permiso = error && (error.name === "NotAllowedError" || error.name === "SecurityError");
                const sinCamara = error && (error.name === "NotFoundError" || error.name === "OverconstrainedError");
                const ocupada = error && error.name === "NotReadableError";

                estado.innerHTML = `<span class="rojo">${
                    permiso ? "No hay permiso para usar la cámara. Actívelo en los ajustes."
                    : sinCamara ? "No se encontró una cámara. Puede subir una foto o escribir el código."
                    : ocupada ? "La cámara está siendo usada por otra aplicación."
                    : "No se pudo abrir la cámara. " + esc(error && error.message ? error.message : "")
                }</span>`;
            };

            (async () => {

                try {

                    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                        estado.innerHTML = '<span class="rojo">Este equipo no permite usar la cámara aquí. Suba una foto o escriba el código.</span>';
                        return;
                    }

                    // cámara en la mejor resolución posible, con enfoque automático continuo
                    try {
                        flujo = await navigator.mediaDevices.getUserMedia({
                            video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
                            audio: false
                        });
                    } catch (e1) {
                        flujo = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                    }

                    if (terminado) { detener(); return; }

                    video.srcObject = flujo;
                    await video.play();

                    // Vista previa dibujada: en algunos iPhone (app agregada a la pantalla
                    // de inicio) el video queda negro aunque la cámara funciona y lee
                    // los códigos. Dibujar cada cuadro en un lienzo lo muestra igual.
                    const lienzo = document.createElement("canvas");
                    lienzo.setAttribute("aria-hidden", "true");
                    lienzo.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
                    video.insertAdjacentElement("afterend", lienzo);
                    const pincel = lienzo.getContext("2d");
                    const pintarVista = () => {
                        if (terminado || !lienzo.isConnected) return;
                        const w = lienzo.clientWidth, h = lienzo.clientHeight;
                        const vw = video.videoWidth, vh = video.videoHeight;
                        if (w && h && vw && vh && video.readyState >= 2) {
                            const dpr = Math.min(window.devicePixelRatio || 1, 2);
                            const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
                            if (lienzo.width !== cw || lienzo.height !== ch) { lienzo.width = cw; lienzo.height = ch; }
                            const escala = Math.max(cw / vw, ch / vh);
                            const dw = vw * escala, dh = vh * escala;
                            try { pincel.drawImage(video, (cw - dw) / 2, (ch - dh) / 2, dw, dh); } catch (e6) { /* cuadro aún no listo */ }
                        }
                        requestAnimationFrame(pintarVista);
                    };
                    requestAnimationFrame(pintarVista);

                    // enfoque continuo, linterna y zoom (si la cámara los tiene)
                    const pista = flujo.getVideoTracks()[0];
                    const cap = pista.getCapabilities ? pista.getCapabilities() : {};

                    try {
                        if (cap.focusMode && cap.focusMode.includes("continuous")) await pista.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
                    } catch (e2) { /* sin control de enfoque */ }

                    if (cap.torch) {
                        let luz = false;
                        const b = document.createElement("button");
                        b.type = "button"; b.className = "btn btn-chico"; b.textContent = "Linterna";
                        b.addEventListener("click", async () => {
                            luz = !luz;
                            try { await pista.applyConstraints({ advanced: [{ torch: luz }] }); b.classList.toggle("btn-primario", luz); } catch (e3) { /* sin linterna */ }
                        });
                        herr.appendChild(b);
                    }

                    if (cap.zoom && cap.zoom.max > cap.zoom.min) {
                        const z = document.createElement("input");
                        z.type = "range"; z.min = cap.zoom.min; z.max = Math.min(cap.zoom.max, cap.zoom.min * 5);
                        z.step = cap.zoom.step || 0.1; z.value = cap.zoom.min; z.style.width = "140px"; z.title = "Zoom";
                        z.addEventListener("input", () => pista.applyConstraints({ advanced: [{ zoom: Number(z.value) }] }).catch(() => { }));
                        herr.appendChild(document.createTextNode("Zoom"));
                        herr.appendChild(z);
                    }

                    estado.textContent = "Cargando lector…";

                    await prepararZXing();

                    if (terminado) return;

                    // lector del navegador (rápido), si existe
                    let nativo = null;

                    if ("BarcodeDetector" in window) {
                        try {
                            const formatos = await BarcodeDetector.getSupportedFormats();
                            if (formatos.length) nativo = new BarcodeDetector({ formats: formatos });
                        } catch (e4) { /* se usa solo ZXing */ }
                    }

                    estado.textContent = "Apunte al código de barras";

                    const tic = async () => {

                        if (terminado) return;

                        try {

                            if (video.readyState >= 2 && video.videoWidth) {

                                if (nativo) {
                                    try {
                                        const codigos = await nativo.detect(video);
                                        if (codigos.length) { encontrado(codigos[0].rawValue); return; }
                                    } catch (e5) { /* cuadro aún no listo */ }
                                }

                                // dos formas de mirar el cuadro por vuelta, rotando entre todas
                                for (let k = 0; k < 2; k++) {
                                    const r = aplicar(video, video.videoWidth, video.videoHeight, ESTRATEGIAS[ronda % ESTRATEGIAS.length]);
                                    ronda++;
                                    if (!r) continue;
                                    if (!sinVerificador(r.formato) || (anterior && anterior.texto === r.texto && Date.now() - anterior.t < 3000)) {
                                        encontrado(r.texto);
                                        return;
                                    }
                                    anterior = { texto: r.texto, t: Date.now() };
                                }
                            }

                        } catch (error) {
                            // cuadro no válido: se sigue
                        }

                        temporizador = setTimeout(tic, 60);
                    };

                    tic();

                } catch (error) {
                    falla(error);
                }
            })();
        });
    }


    // reemplaza al lector anterior (movil.js)
    window.escanearCodigo = escanear;
    window.Lector = { decodificarImagen, preparar: prepararZXing, ESTRATEGIAS };

})();
