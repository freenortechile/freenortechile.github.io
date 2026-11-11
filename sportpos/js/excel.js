// ==========================================
// FREENORTE — EXCEL SIN LIBRERÍAS
// Leer:  .xlsx y .csv (UTF-8 o ANSI de Excel en Windows)
// Crear: .xlsx con encabezado, columnas en formato texto
//        (códigos de barras sin "7,8E+12") y listas desplegables
// ==========================================

"use strict";

const Excel = {

    // ---------- LEER ----------

    // Archivo (.xlsx o .csv) → filas [[texto, ...], ...]
    async leer(archivo) {

        const bytes = new Uint8Array(await archivo.arrayBuffer());
        const nombre = String(archivo.name || "").toLowerCase();

        // Un .xlsx es un ZIP: empieza con "PK"
        if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
            return this.leerXLSX(bytes);
        }

        if (/\.(xls|ods|numbers)$/.test(nombre) || (bytes[0] === 0xd0 && bytes[1] === 0xcf)) {
            throw new Error("Ese formato no se puede leer. En Excel use Archivo › Guardar como › Libro de Excel (.xlsx).");
        }

        return leerCSV(this.decodificarTexto(bytes));
    },


    // UTF-8 si es válido; si no, ANSI (lo que guarda Excel en Windows como "CSV delimitado")
    decodificarTexto(bytes) {
        try {
            return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
        } catch (error) {
            return new TextDecoder("windows-1252").decode(bytes);
        }
    },


    async leerXLSX(bytes) {

        if (typeof DecompressionStream === "undefined") {
            throw new Error("Este navegador no puede abrir archivos Excel. Actualícelo, o guarde la planilla como CSV UTF-8.");
        }

        const zip = this.abrirZip(bytes);
        const texto = async ruta => {
            const datos = await this.extraer(zip, ruta);
            return datos ? new TextDecoder("utf-8").decode(datos) : null;
        };
        const xml = t => new DOMParser().parseFromString(t, "application/xml");
        const todos = (nodo, etiqueta) => Array.from(nodo.getElementsByTagNameNS("*", etiqueta));

        const libro = await texto("xl/workbook.xml");
        if (!libro) throw new Error("El archivo no es un Excel válido.");

        // Hojas del libro: se prefiere la llamada "Productos"; si no, la primera visible
        const hojas = todos(xml(libro), "sheet").map(h => ({
            nombre: h.getAttribute("name") || "",
            oculta: (h.getAttribute("state") || "visible") !== "visible",
            rid: h.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id") || h.getAttribute("r:id")
        }));

        const hoja = hojas.find(h => normalizar(h.nombre) === "productos") || hojas.find(h => !h.oculta) || hojas[0];
        if (!hoja) throw new Error("El Excel no tiene hojas.");

        let ruta = "xl/worksheets/sheet1.xml";
        const relaciones = await texto("xl/_rels/workbook.xml.rels");

        if (relaciones && hoja.rid) {
            const rel = todos(xml(relaciones), "Relationship").find(r => r.getAttribute("Id") === hoja.rid);
            if (rel) {
                const destino = rel.getAttribute("Target") || "";
                ruta = destino.startsWith("/") ? destino.slice(1) : "xl/" + destino.replace(/^\.\//, "");
            }
        }

        // Textos compartidos
        const compartidos = [];
        const textosXML = await texto("xl/sharedStrings.xml");

        if (textosXML) {
            todos(xml(textosXML), "si").forEach(si => {
                compartidos.push(todos(si, "t").filter(t => t.parentNode.localName !== "rPh").map(t => t.textContent).join(""));
            });
        }

        const hojaXML = await texto(ruta);
        if (!hojaXML) throw new Error("No se encontró la hoja de productos en el Excel.");

        const filas = [];

        todos(xml(hojaXML), "row").forEach((fila, n) => {

            const numero = Number(fila.getAttribute("r")) || n + 1;
            const celdas = [];
            let siguiente = 0;

            todos(fila, "c").forEach(c => {

                const ref = c.getAttribute("r");
                const columna = ref ? this.indiceColumna(ref) : siguiente;
                siguiente = columna + 1;

                const tipo = c.getAttribute("t") || "n";
                const v = todos(c, "v")[0];
                let valor = "";

                if (tipo === "s") valor = v ? compartidos[Number(v.textContent)] ?? "" : "";
                else if (tipo === "inlineStr") valor = todos(c, "t").map(t => t.textContent).join("");
                else if (tipo === "str") valor = v ? v.textContent : "";
                else if (tipo === "b") valor = v && v.textContent === "1" ? "SI" : "NO";
                else if (tipo === "e") valor = "";
                else valor = v ? this.textoNumero(v.textContent) : "";

                celdas[columna] = valor;
            });

            filas[numero - 1] = Array.from(celdas, x => x ?? "");
        });

        return Array.from(filas, f => f || []).filter(f => f.some(c => String(c).trim() !== ""));
    },


    // "7.8012345678900E+12" → "7801234567890" · "89990.400000000001" → "89990.4"
    textoNumero(texto) {

        const n = Number(texto);

        if (!Number.isFinite(n)) return String(texto);

        if (Number.isInteger(n)) {
            return Math.abs(n) <= Number.MAX_SAFE_INTEGER ? String(n) : n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 0 });
        }

        return String(parseFloat(n.toPrecision(15)));
    },


    indiceColumna(ref) {
        const letras = String(ref).replace(/[^A-Z]/gi, "").toUpperCase();
        let n = 0;
        for (const l of letras) n = n * 26 + (l.charCodeAt(0) - 64);
        return n - 1;
    },


    letraColumna(i) {
        let s = "";
        for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s;
        return s;
    },


    // ---------- ZIP ----------

    abrirZip(bytes) {

        const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        let fin = -1;

        for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
            if (vista.getUint32(i, true) === 0x06054b50) { fin = i; break; }
        }

        if (fin < 0) throw new Error("El archivo Excel está dañado o incompleto.");

        const total = vista.getUint16(fin + 10, true);
        let p = vista.getUint32(fin + 16, true);
        const entradas = new Map();

        for (let i = 0; i < total; i++) {

            if (vista.getUint32(p, true) !== 0x02014b50) break;

            const metodo = vista.getUint16(p + 10, true);
            const comprimido = vista.getUint32(p + 20, true);
            const largoNombre = vista.getUint16(p + 28, true);
            const largoExtra = vista.getUint16(p + 30, true);
            const largoComentario = vista.getUint16(p + 32, true);
            const local = vista.getUint32(p + 42, true);
            const nombre = new TextDecoder("utf-8").decode(bytes.subarray(p + 46, p + 46 + largoNombre));

            entradas.set(nombre.replace(/\\/g, "/").toLowerCase(), { metodo, comprimido, local });

            p += 46 + largoNombre + largoExtra + largoComentario;
        }

        return { bytes, vista, entradas };
    },


    async extraer(zip, ruta) {

        const e = zip.entradas.get(ruta.toLowerCase());
        if (!e) return null;

        const inicio = e.local + 30 + zip.vista.getUint16(e.local + 26, true) + zip.vista.getUint16(e.local + 28, true);
        const datos = zip.bytes.subarray(inicio, inicio + e.comprimido);

        if (e.metodo === 0) return datos;
        if (e.metodo !== 8) throw new Error("El Excel usa una compresión no soportada.");

        const flujo = new Blob([datos]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(flujo).arrayBuffer());
    },


    // ---------- CREAR ----------

    // hojas: [{ nombre, filas, anchos, columnasTexto:[i], columnasNumero:[i], listas:[{columna, origen|valores, estricta}], oculta, sinEncabezado }]
    crear(hojas) {

        const x = t => String(t ?? "")
            .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

        const archivos = [];
        const MAX = 2000;

        hojas.forEach((h, n) => {

            const texto = new Set(h.columnasTexto || []);
            const numero = new Set(h.columnasNumero || []);
            const ancho = Math.max(1, ...h.filas.map(f => f.length), (h.anchos || []).length);
            const estilo = (i, encabezado) => encabezado ? 1 : texto.has(i) ? 2 : numero.has(i) ? 3 : 0;

            const cols = Array.from({ length: ancho }, (_, i) =>
                `<col min="${i + 1}" max="${i + 1}" width="${(h.anchos || [])[i] || 14}" customWidth="1"${estilo(i, false) ? ` style="${estilo(i, false)}"` : ""}/>`).join("");

            const filas = h.filas.map((fila, r) => {
                const encabezado = r === 0 && !h.sinEncabezado;
                const celdas = fila.map((valor, c) => {
                    const ref = this.letraColumna(c) + (r + 1);
                    const s = estilo(c, encabezado);
                    if (valor === null || valor === undefined || valor === "") return s ? `<c r="${ref}" s="${s}"/>` : "";
                    if (typeof valor === "number" && Number.isFinite(valor) && !texto.has(c)) return `<c r="${ref}"${s ? ` s="${s}"` : ""}><v>${valor}</v></c>`;
                    return `<c r="${ref}" t="inlineStr"${s ? ` s="${s}"` : ""}><is><t xml:space="preserve">${x(valor)}</t></is></c>`;
                }).join("");
                return `<row r="${r + 1}">${celdas}</row>`;
            }).join("");

            const listas = (h.listas || []).map(l => {
                const col = this.letraColumna(l.columna);
                const formula = l.origen ? x(l.origen) : `"${x(l.valores.join(","))}"`;
                return `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" errorStyle="${l.estricta ? "stop" : "warning"}" sqref="${col}2:${col}${MAX}"><formula1>${formula}</formula1></dataValidation>`;
            });

            const congelar = h.sinEncabezado ? "" : '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/>';

            archivos.push([`xl/worksheets/sheet${n + 1}.xml`,
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                `<sheetViews><sheetView workbookViewId="0"${n === 0 ? ' tabSelected="1"' : ""}>${congelar}</sheetView></sheetViews>` +
                '<sheetFormatPr defaultRowHeight="15"/>' +
                `<cols>${cols}</cols>` +
                `<sheetData>${filas}</sheetData>` +
                (listas.length ? `<dataValidations count="${listas.length}">${listas.join("")}</dataValidations>` : "") +
                '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>' +
                "</worksheet>"]);
        });

        archivos.unshift(
            ["[Content_Types].xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
                '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
                '<Default Extension="xml" ContentType="application/xml"/>' +
                '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
                '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
                hojas.map((_, n) => `<Override PartName="/xl/worksheets/sheet${n + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("") +
                "</Types>"],
            ["_rels/.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
                "</Relationships>"],
            ["xl/workbook.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
                '<bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
                hojas.map((h, n) => `<sheet name="${x(h.nombre.slice(0, 31))}" sheetId="${n + 1}"${h.oculta ? ' state="hidden"' : ""} r:id="rId${n + 1}"/>`).join("") +
                "</sheets></workbook>"],
            ["xl/_rels/workbook.xml.rels",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
                hojas.map((_, n) => `<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n + 1}.xml"/>`).join("") +
                `<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
                "</Relationships>"],
            ["xl/styles.xml",
                '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
                '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
                '<fonts count="2"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>' +
                '<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEA580C"/><bgColor indexed="64"/></patternFill></fill></fills>' +
                '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
                '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
                '<cellXfs count="4">' +
                '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
                '<xf numFmtId="49" fontId="1" fillId="2" borderId="0" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1"/>' +
                '<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
                '<xf numFmtId="3" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
                "</cellXfs>" +
                '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
                "</styleSheet>"]
        );

        return this.zip(archivos);
    },


    // ZIP sin compresión (Excel lo abre igual)
    zip(archivos) {

        const tabla = this._crc || (this._crc = Array.from({ length: 256 }, (_, n) => {
            let c = n;
            for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
            return c >>> 0;
        }));

        const crc32 = datos => {
            let c = 0xffffffff;
            for (let i = 0; i < datos.length; i++) c = tabla[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
            return (c ^ 0xffffffff) >>> 0;
        };

        const ahora = new Date();
        const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1);
        const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate();
        const cod = new TextEncoder();

        const partes = [];
        const central = [];
        let offset = 0;

        archivos.forEach(([nombre, contenido]) => {

            const n = cod.encode(nombre);
            const d = typeof contenido === "string" ? cod.encode(contenido) : contenido;
            const crc = crc32(d);

            const local = new DataView(new ArrayBuffer(30));
            local.setUint32(0, 0x04034b50, true);
            local.setUint16(4, 20, true);
            local.setUint16(6, 0x0800, true);
            local.setUint16(8, 0, true);
            local.setUint16(10, hora, true);
            local.setUint16(12, fecha, true);
            local.setUint32(14, crc, true);
            local.setUint32(18, d.length, true);
            local.setUint32(22, d.length, true);
            local.setUint16(26, n.length, true);
            local.setUint16(28, 0, true);

            const c = new DataView(new ArrayBuffer(46));
            c.setUint32(0, 0x02014b50, true);
            c.setUint16(4, 20, true);
            c.setUint16(6, 20, true);
            c.setUint16(8, 0x0800, true);
            c.setUint16(10, 0, true);
            c.setUint16(12, hora, true);
            c.setUint16(14, fecha, true);
            c.setUint32(16, crc, true);
            c.setUint32(20, d.length, true);
            c.setUint32(24, d.length, true);
            c.setUint16(28, n.length, true);
            c.setUint32(42, offset, true);

            partes.push(new Uint8Array(local.buffer), n, d);
            central.push(new Uint8Array(c.buffer), n);
            offset += 30 + n.length + d.length;
        });

        const largoCentral = central.reduce((s, p) => s + p.length, 0);
        const fin = new DataView(new ArrayBuffer(22));
        fin.setUint32(0, 0x06054b50, true);
        fin.setUint16(8, archivos.length, true);
        fin.setUint16(10, archivos.length, true);
        fin.setUint32(12, largoCentral, true);
        fin.setUint32(16, offset, true);

        const todo = partes.concat(central, [new Uint8Array(fin.buffer)]);
        const salida = new Uint8Array(todo.reduce((s, p) => s + p.length, 0));
        let p = 0;
        todo.forEach(parte => { salida.set(parte, p); p += parte.length; });

        return salida;
    }
};
