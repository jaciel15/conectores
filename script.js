(() => {
  "use strict";

  const STORAGE_KEY = "cg_conectores_v2";
  const CONFIG_KEY = "cg_config_v2";
  const THEME_KEY = "cg_theme";

  const SENALES = [
    { id: "BATT", label: "+12V / BATT", color: "#e53935", text: "#fff" },
    { id: "GND", label: "GND / Tierra", color: "#111111", text: "#fff" },
    { id: "ACC", label: "ACC / IGN", color: "#fb8c00", text: "#111" },
    { id: "RPM", label: "RPM / Tacho", color: "#8e24aa", text: "#fff" },
    { id: "SPEED", label: "SPEED / VSS", color: "#6d4c41", text: "#fff" },
    { id: "FUEL", label: "Combustible", color: "#43a047", text: "#fff" },
    { id: "TEMP", label: "Temperatura", color: "#00897b", text: "#fff" },
    { id: "OIL", label: "Aceite", color: "#c0ca33", text: "#111" },
    { id: "ILLUM", label: "Iluminación", color: "#fdd835", text: "#111" },
    { id: "HI", label: "Luz alta", color: "#1e88e5", text: "#fff" },
    { id: "TURN_L", label: "Direccional Izq", color: "#00acc1", text: "#fff" },
    { id: "TURN_R", label: "Direccional Der", color: "#26c6da", text: "#111" },
    { id: "NEUTRAL", label: "Neutral", color: "#7cb342", text: "#111" },
    { id: "CAN_H", label: "CAN-H", color: "#5e35b1", text: "#fff" },
    { id: "CAN_L", label: "CAN-L", color: "#3949ab", text: "#fff" },
    { id: "NC", label: "NC / Vacío", color: "#90a4ae", text: "#111" },
  ];

  const COLORES = [
    "#e53935", "#fb8c00", "#fdd835", "#43a047", "#00897b", "#1e88e5",
    "#8e24aa", "#6d4c41", "#111111", "#ffffff", "#90a4ae", "#00acc1",
    "#c0ca33", "#d81b60", "#5e35b1", "#3949ab", "#ef6c00", "#26a69a",
  ];

  const state = {
    vistaAnterior: "menu",
    scanDataUrl: null,
    clusterDataUrl: null,
    conectorDataUrl: null,
    pinsScan: [],
    pinsNuevo: [],
    editingId: null,
    currentPinTarget: null,
    currentPinIndex: null,
    selectedSignal: null,
    selectedColor: null,
    dbPath: { categoria: null, marca: null, modelo: null },
    detalleId: null,
  };

  const $ = (id) => document.getElementById(id);

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function loadConfig() {
    try {
      return JSON.parse(localStorage.getItem(CONFIG_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveConfig(cfg) {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  }

  function loadConnectors() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveConnectors(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function uid() {
    return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function applyTheme(theme) {
    const t = theme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", t);
    localStorage.setItem(THEME_KEY, t);
    const btn = $("btn-tema");
    if (btn) btn.textContent = t === "dark" ? "☀ Claro" : "🌙 Oscuro";
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme") || "light";
    applyTheme(cur === "dark" ? "light" : "dark");
  }

  function showVista(name) {
    document.querySelectorAll(".vista").forEach((v) => v.classList.remove("visible"));
    const el = $("vista-" + name);
    if (el) el.classList.add("visible");
    const topbar = $("topbar");
    if (name === "menu") topbar.classList.add("hidden");
    else topbar.classList.remove("hidden");
    state.vistaAnterior = name;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cerrarVista() {
    if (state.vistaAnterior === "detalle") {
      showVista("db");
      renderDB();
      return;
    }
    if (state.vistaAnterior === "nuevo" && state.editingId) {
      state.editingId = null;
      showVista("db");
      renderDB();
      return;
    }
    showVista("menu");
  }

  function setPreview(boxId, dataUrl, placeholder) {
    const box = $(boxId);
    if (!box) return;
    if (dataUrl) box.innerHTML = `<img src="${dataUrl}" alt="preview">`;
    else box.innerHTML = `<div class="placeholder">${placeholder || "Sin foto"}</div>`;
  }

  function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      if (!file) return resolve(null);
      if (file.size > 6 * 1024 * 1024) {
        reject(new Error("La imagen supera 6MB. Usa una foto más ligera."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("No se pudo leer la imagen"));
      reader.readAsDataURL(file);
    });
  }

  async function compressImage(dataUrl, maxSide = 1280, quality = 0.72) {
    if (!dataUrl) return null;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxSide / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  function dataUrlToInlinePart(dataUrl) {
    const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl || "");
    if (!m) return null;
    return { mimeType: m[1], data: m[2] };
  }

  function parseAIJson(text) {
    if (!text) throw new Error("Respuesta vacía de la IA");
    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("La IA no devolvió JSON válido");
    return JSON.parse(match[0]);
  }

  async function analyzeConnectorWithAI(dataUrl) {
    const cfg = loadConfig();
    if (!cfg.apiKey) {
      throw new Error("Configura tu Gemini API Key en Configuración");
    }
    const part = dataUrlToInlinePart(dataUrl);
    if (!part) throw new Error("Imagen inválida");

    const model = cfg.model || "gemini-2.0-flash";
    const prompt = `Eres un experto en conectores eléctricos de motos y autos para velocímetros digitales 12V.
Analiza la foto y cuenta las cavidades/pines del conector visible.
Devuelve SOLO JSON válido con este esquema:
{
  "rows": number,
  "pins": number,
  "columns": number,
  "confidence": number,
  "notes": string,
  "orientation": "front"|"back"|"unknown"
}
Reglas:
- rows = filas horizontales de pines.
- pins = total de cavidades/pines visibles (incluye vacíos si se ven).
- columns = pines por fila más común o ceil(pins/rows).
- confidence 0 a 1.
- Si la imagen no muestra un conector claro, pon pins=0 y notes explicando.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: part.mimeType, data: part.data } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error("Error IA (" + res.status + "): " + errText.slice(0, 180));
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
    const parsed = parseAIJson(text);
    const rows = Math.max(0, parseInt(parsed.rows, 10) || 0);
    const pins = Math.max(0, parseInt(parsed.pins, 10) || 0);
    const columns = Math.max(1, parseInt(parsed.columns, 10) || (rows ? Math.ceil(pins / rows) : 1));
    return {
      rows,
      pins,
      columns,
      confidence: Number(parsed.confidence) || 0,
      notes: parsed.notes || "",
      orientation: parsed.orientation || "unknown",
    };
  }

  function makePins(count, existing) {
    const out = [];
    for (let i = 1; i <= count; i++) {
      const prev = existing && existing.find((p) => p.n === i);
      out.push(prev || { n: i, signal: "", label: "", color: "", text: "" });
    }
    return out;
  }

  function slugify(parts) {
    return parts
      .filter(Boolean)
      .map((p) => String(p).trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_-]/g, ""))
      .join("_") + "_";
  }

  function getMetaForTarget(target) {
    if (target === "scan") {
      return {
        marca: normalizeKey($("scan-marca")?.value) || "GENÉRICO",
        modelo: normalizeKey($("scan-modelo")?.value) || "CONECTOR",
        version: normalizeKey($("scan-version")?.value) || "V1",
        modulo: $("scan-modulo")?.value || "DASH",
        voltaje: "12V",
        forma: $("scan-forma-pin")?.value || "rect",
        filas: parseInt($("scan-filas")?.value, 10) || 1,
        notas: "",
      };
    }
    return {
      marca: normalizeKey($("marca")?.value) || "GENÉRICO",
      modelo: normalizeKey($("modelo")?.value) || "CONECTOR",
      version: normalizeKey($("version")?.value) || "V1",
      modulo: $("modulo-tipo")?.value || "DASH",
      voltaje: $("voltaje")?.value || "12V",
      forma: $("forma-pin")?.value || "rect",
      filas: parseInt($("nuevo-filas")?.value, 10) || 1,
      notas: $("notas")?.value || "",
    };
  }

  function usedLegend(pins) {
    const map = new Map();
    pins.forEach((p) => {
      if (!p.signal && !p.label) return;
      const key = p.signal || p.label;
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          label: p.label || p.signal,
          color: p.color || "#90a4ae",
        });
      }
    });
    if (!map.size) {
      return SENALES.slice(0, 4).map((s) => ({ id: s.id, label: s.label, color: s.color }));
    }
    return [...map.values()];
  }

  function renderPinout(containerId, pins, columns, onClick, meta = {}) {
    const el = $(containerId);
    if (!el) return;
    const filas = Math.max(1, meta.filas || 1);
    const cols = Math.max(1, columns || Math.ceil((pins.length || 1) / filas));
    const forma = meta.forma || "rect";
    const marca = meta.marca || "GENÉRICO";
    const modelo = meta.modelo || "CONECTOR";
    const version = meta.version || "V1";
    const modulo = meta.modulo || "DASH";
    const voltaje = meta.voltaje || "12V";
    const notas = meta.notas || "";
    const slug = meta.slug || slugify([marca, modelo, version, modulo]);
    const editable = typeof onClick === "function";
    const legend = usedLegend(pins);

    el.className = "ficha-host";
    el.innerHTML = "";
    el.style.gridTemplateColumns = "";

    const card = document.createElement("article");
    card.className = "ficha-pinout";
    card.innerHTML = `
      <header class="ficha-head">
        <div class="ficha-brand">${escapeHtml(marca)} ${escapeHtml(modelo)}</div>
        <div class="ficha-mod">MÓDULO: ${escapeHtml(modulo)} · ${escapeHtml(voltaje)} · ${escapeHtml(version)} · ${pins.length} PINES</div>
      </header>
      <div class="ficha-body">
        <div class="port-frame" aria-label="Conector físico">
          <div class="port-bevel">
            <div class="plug-body">
              <div class="plug-keyway" aria-hidden="true">
                <span></span><span></span><span></span>
              </div>
              <div class="plug-cavity">
                <div class="pin-matrix rows-${filas}" style="--cols:${cols};--rows:${filas}"></div>
              </div>
              <div class="plug-rail" aria-hidden="true"></div>
            </div>
          </div>
        </div>
        <div class="ficha-leyenda"></div>
        ${notas
          ? `<p class="ficha-nota"><strong>NOTA:</strong> ${escapeHtml(notas)}</p>`
          : `<p class="ficha-nota muted-note">Vista frontal · carcasa negra · inserto gris · pines metálicos</p>`}
      </div>
      <footer class="ficha-foot">${escapeHtml(slug)}</footer>
    `;

    const matrix = card.querySelector(".pin-matrix");
    pins.forEach((pin, idx) => {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = `pin-cell shape-${forma}${pin.color ? " filled" : ""}`;
      cell.dataset.index = String(idx);
      cell.title = pin.label || pin.signal || `Pin ${pin.n}`;
      if (!editable) cell.disabled = true;

      const signalColor = pin.color || "";
      const faceStyle = signalColor
        ? `--signal:${signalColor};--signal-text:${pin.text || contrastText(signalColor)}`
        : "";

      cell.innerHTML = `
        <span class="pin-num">${pin.n}</span>
        <span class="pin-blade" style="${faceStyle}">
          <span class="blade-metal"></span>
          <span class="blade-tip"></span>
        </span>
        <span class="pin-tag">${pin.label || pin.signal ? escapeHtml(pin.label || pin.signal) : ""}</span>
      `;

      if (editable) cell.addEventListener("click", () => onClick(pin, idx, pins));
      matrix.appendChild(cell);
    });

    const remainder = pins.length % cols;
    if (remainder > 0) {
      for (let i = 0; i < cols - remainder; i++) {
        const empty = document.createElement("div");
        empty.className = "pin-cell empty-slot";
        empty.innerHTML = `<span class="pin-num">&nbsp;</span><span class="pin-blade ghost"><span class="blade-metal"></span></span><span class="pin-tag"></span>`;
        matrix.appendChild(empty);
      }
    }

    const ley = card.querySelector(".ficha-leyenda");
    ley.innerHTML = legend.map((item) =>
      `<span class="ley-item"><i class="ley-swatch" style="background:${item.color}"></i>${escapeHtml(item.label || item.id)}</span>`
    ).join("");

    el.appendChild(card);
  }

  function contrastText(hex) {
    const c = (hex || "#000").replace("#", "");
    const full = c.length === 3 ? c.split("").map((x) => x + x).join("") : c;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 160 ? "#111111" : "#ffffff";
  }

  function renderLeyenda() {
    /* leyenda ahora vive dentro de la ficha */
  }

  function refreshPinoutTarget(target) {
    if (target === "scan") {
      const meta = getMetaForTarget("scan");
      const cols = Math.ceil(state.pinsScan.length / Math.max(1, meta.filas));
      renderPinout("pinout-scan", state.pinsScan, cols, (p, i) => openPinModal(p, i, "scan"), meta);
    } else {
      const meta = getMetaForTarget("nuevo");
      const cols = Math.ceil(state.pinsNuevo.length / Math.max(1, meta.filas));
      renderPinout("pinout-nuevo", state.pinsNuevo, cols, (p, i) => openPinModal(p, i, "nuevo"), meta);
    }
  }

  function openPinModal(pin, index, pinsArrayName) {
    state.currentPinTarget = pinsArrayName;
    state.currentPinIndex = index;
    state.selectedSignal = pin.signal || "";
    state.selectedColor = pin.color || "";
    $("modal-pin-titulo").textContent = `PIN ${pin.n}`;
    $("pin-custom").value = pin.label || pin.signal || "";

    const list = $("lista-senales");
    list.innerHTML = "";
    SENALES.forEach((s) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = s.label;
      b.style.background = s.color;
      b.style.color = s.text;
      if (state.selectedSignal === s.id) b.classList.add("selected");
      b.addEventListener("click", () => {
        state.selectedSignal = s.id;
        state.selectedColor = s.color;
        $("pin-custom").value = s.id;
        [...list.children].forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
        [...$("lista-colores").children].forEach((x) => {
          x.classList.toggle("selected", x.dataset.color.toLowerCase() === s.color.toLowerCase());
        });
      });
      list.appendChild(b);
    });

    const colors = $("lista-colores");
    colors.innerHTML = "";
    COLORES.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "color-swatch";
      b.dataset.color = c;
      b.style.background = c;
      if ((state.selectedColor || "").toLowerCase() === c.toLowerCase()) b.classList.add("selected");
      b.addEventListener("click", () => {
        state.selectedColor = c;
        [...colors.children].forEach((x) => x.classList.remove("selected"));
        b.classList.add("selected");
      });
      colors.appendChild(b);
    });

    $("modal-pin").classList.add("open");
  }

  function applyPinModal() {
    const arr = state.currentPinTarget === "scan" ? state.pinsScan : state.pinsNuevo;
    const pin = arr[state.currentPinIndex];
    if (!pin) return;
    const label = ($("pin-custom").value || state.selectedSignal || "").trim().toUpperCase();
    const signal = state.selectedSignal || label;
    const known = SENALES.find((s) => s.id === signal);
    pin.signal = signal;
    pin.label = label || signal;
    pin.color = state.selectedColor || (known ? known.color : "#90a4ae");
    pin.text = contrastText(pin.color);
    $("modal-pin").classList.remove("open");
    refreshPinoutTarget(state.currentPinTarget);
  }

  function setAiBadge(id, type, text) {
    const el = $(id);
    el.className = "ai-badge " + type;
    el.classList.remove("hidden");
    el.innerHTML = text;
  }

  async function runAI(source) {
    const dataUrl = source === "scan" ? state.scanDataUrl : state.conectorDataUrl;
    const badge = source === "scan" ? "ai-status-scan" : "ai-status-nuevo";
    if (!dataUrl) {
      toast("Primero agrega una foto del conector");
      return;
    }
    setAiBadge(badge, "warn", `<span class="spinner"></span> Analizando conector...`);
    try {
      const result = await analyzeConnectorWithAI(dataUrl);
      if (!result.pins) {
        setAiBadge(badge, "error", "No se detectó un conector claro. Ajusta filas/pines a mano.");
        return;
      }
      if (source === "scan") {
        $("scan-filas").value = result.rows || 1;
        $("scan-pines").value = result.pins;
      } else {
        $("nuevo-filas").value = result.rows || 1;
        $("nuevo-pines").value = result.pins;
      }
      const conf = Math.round((result.confidence || 0) * 100);
      setAiBadge(badge, "ok", `Detectado: ${result.rows || "?"} filas · ${result.pins} pines (${conf}%)${result.notes ? " — " + result.notes : ""}`);
      toast("IA lista: revisa filas/pines y genera el pinout");
    } catch (err) {
      setAiBadge(badge, "error", err.message || "Error de IA");
      toast(err.message || "Error de IA");
    }
  }

  function generateFromScan() {
    const filas = parseInt($("scan-filas").value, 10);
    const pines = parseInt($("scan-pines").value, 10);
    if (!filas || !pines || filas < 1 || pines < 1) {
      toast("Indica filas y pines (usa IA o escribe a mano)");
      return;
    }
    state.pinsScan = makePins(pines, state.pinsScan);
    $("resultado-scan").classList.remove("hidden");
    refreshPinoutTarget("scan");
  }

  function generateNuevo() {
    const filas = parseInt($("nuevo-filas").value, 10);
    const pines = parseInt($("nuevo-pines").value, 10);
    if (!filas || !pines || filas < 1 || pines < 1) {
      toast("Indica filas y pines");
      return;
    }
    state.pinsNuevo = makePins(pines, state.pinsNuevo);
    $("resultado-nuevo").classList.remove("hidden");
    refreshPinoutTarget("nuevo");
  }

  function normalizeKey(s) {
    return String(s || "").trim().replace(/\s+/g, " ");
  }

  function buildConnectorPayload(from) {
    if (from === "scan") {
      const categoria = $("scan-categoria").value;
      const marca = normalizeKey($("scan-marca").value);
      const modelo = normalizeKey($("scan-modelo").value);
      const version = normalizeKey($("scan-version").value) || "V1";
      const filas = parseInt($("scan-filas").value, 10);
      const pines = parseInt($("scan-pines").value, 10);
      const forma = $("scan-forma-pin").value || "rect";
      const modulo = $("scan-modulo").value || "DASH";
      if (!marca || !modelo) throw new Error("Marca y modelo son obligatorios");
      if (!state.pinsScan.length) throw new Error("Genera el pinout primero");
      return {
        id: state.editingId || uid(),
        categoria,
        marca,
        modelo,
        version,
        modulo,
        forma,
        voltaje: "12V",
        filas,
        pines,
        columns: Math.ceil(pines / filas),
        pins: state.pinsScan,
        fotoConector: state.scanDataUrl,
        fotoCluster: null,
        notas: "",
        slug: slugify([marca, modelo, version, modulo]),
        updatedAt: Date.now(),
      };
    }

    const categoria = $("categoria").value;
    const marca = normalizeKey($("marca").value);
    const modelo = normalizeKey($("modelo").value);
    const version = normalizeKey($("version").value) || "V1";
    const filas = parseInt($("nuevo-filas").value, 10);
    const pines = parseInt($("nuevo-pines").value, 10);
    const forma = $("forma-pin").value || "rect";
    const modulo = $("modulo-tipo").value || "DASH";
    if (!marca || !modelo) throw new Error("Marca y modelo son obligatorios");
    if (!state.pinsNuevo.length) throw new Error("Genera el pinout primero");
    return {
      id: state.editingId || uid(),
      categoria,
      marca,
      modelo,
      version,
      modulo,
      forma,
      voltaje: $("voltaje").value || "12V",
      filas,
      pines,
      columns: Math.ceil(pines / filas),
      pins: state.pinsNuevo,
      fotoConector: state.conectorDataUrl,
      fotoCluster: state.clusterDataUrl,
      notas: $("notas").value.trim(),
      slug: slugify([marca, modelo, version, modulo]),
      updatedAt: Date.now(),
    };
  }

  function upsertConnector(item) {
    const list = loadConnectors();
    const idx = list.findIndex((x) => x.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.unshift(item);
    saveConnectors(list);
  }

  function saveFrom(from) {
    try {
      const item = buildConnectorPayload(from);
      upsertConnector(item);
      state.editingId = null;
      toast(`Guardado: ${item.marca} ${item.modelo} ${item.version}`);
      state.dbPath = {
        categoria: item.categoria,
        marca: item.marca,
        modelo: item.modelo,
      };
      showVista("db");
      renderDB();
    } catch (err) {
      toast(err.message || "No se pudo guardar");
    }
  }

  function uniqueSorted(arr) {
    return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" }));
  }

  function renderDB() {
    const list = loadConnectors();
    const crumbs = $("db-crumbs");
    const box = $("lista-db");
    const path = state.dbPath;

    const crumbParts = [
      { key: "root", label: "Inicio", active: !path.categoria },
      path.categoria && { key: "categoria", label: titleCase(path.categoria), active: !path.marca },
      path.marca && { key: "marca", label: path.marca, active: !path.modelo },
      path.modelo && { key: "modelo", label: path.modelo, active: true },
    ].filter(Boolean);

    crumbs.innerHTML = crumbParts.map((c) =>
      `<button type="button" class="crumb ${c.active ? "active" : ""}" data-crumb="${c.key}">${c.label}</button>`
    ).join("");

    crumbs.querySelectorAll("[data-crumb]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const k = btn.dataset.crumb;
        if (k === "root") state.dbPath = { categoria: null, marca: null, modelo: null };
        if (k === "categoria") state.dbPath = { categoria: path.categoria, marca: null, modelo: null };
        if (k === "marca") state.dbPath = { categoria: path.categoria, marca: path.marca, modelo: null };
        renderDB();
      });
    });

    if (!path.categoria) {
      const cats = uniqueSorted(list.map((x) => x.categoria));
      const defaults = ["MOTOCICLETAS", "AUTOS"];
      const all = uniqueSorted([...defaults, ...cats]);
      box.innerHTML = all.map((cat) => {
        const n = list.filter((x) => x.categoria === cat).length;
        return `<div class="folder-item" data-cat="${escapeAttr(cat)}"><div><strong>${titleCase(cat)}</strong><span>${n} conectores</span></div><span>›</span></div>`;
      }).join("") || `<div class="empty">Aún no hay conectores guardados</div>`;
      box.querySelectorAll("[data-cat]").forEach((el) => {
        el.addEventListener("click", () => {
          state.dbPath = { categoria: el.dataset.cat, marca: null, modelo: null };
          renderDB();
        });
      });
      return;
    }

    if (!path.marca) {
      const marcas = uniqueSorted(list.filter((x) => x.categoria === path.categoria).map((x) => x.marca));
      box.innerHTML = marcas.length
        ? marcas.map((m) => {
          const n = list.filter((x) => x.categoria === path.categoria && same(x.marca, m)).length;
          return `<div class="folder-item" data-marca="${escapeAttr(m)}"><div><strong>${m}</strong><span>${n} modelos/versiones</span></div><span>›</span></div>`;
        }).join("")
        : `<div class="empty">Sin marcas en ${titleCase(path.categoria)}. Crea un conector nuevo.</div>`;
      box.querySelectorAll("[data-marca]").forEach((el) => {
        el.addEventListener("click", () => {
          state.dbPath = { categoria: path.categoria, marca: el.dataset.marca, modelo: null };
          renderDB();
        });
      });
      return;
    }

    if (!path.modelo) {
      const modelos = uniqueSorted(
        list.filter((x) => x.categoria === path.categoria && same(x.marca, path.marca)).map((x) => x.modelo)
      );
      box.innerHTML = modelos.length
        ? modelos.map((m) => {
          const versions = uniqueSorted(
            list.filter((x) => x.categoria === path.categoria && same(x.marca, path.marca) && same(x.modelo, m)).map((x) => x.version)
          );
          return `<div class="folder-item" data-modelo="${escapeAttr(m)}"><div><strong>${m}</strong><span>Versiones: ${versions.join(", ") || "—"}</span></div><span>›</span></div>`;
        }).join("")
        : `<div class="empty">Sin modelos para ${path.marca}</div>`;
      box.querySelectorAll("[data-modelo]").forEach((el) => {
        el.addEventListener("click", () => {
          state.dbPath = { categoria: path.categoria, marca: path.marca, modelo: el.dataset.modelo };
          renderDB();
        });
      });
      return;
    }

    const items = list
      .filter((x) => x.categoria === path.categoria && same(x.marca, path.marca) && same(x.modelo, path.modelo))
      .sort((a, b) => String(a.version).localeCompare(String(b.version), "es"));

    box.innerHTML = items.length
      ? items.map((item) => {
        const img = item.fotoConector || item.fotoCluster || "";
        return `<div class="card-item" data-id="${item.id}">
          ${img ? `<img src="${img}" alt="">` : `<div class="preview-box" style="min-height:78px;width:78px;"><div class="placeholder">Sin foto</div></div>`}
          <div>
            <h3>${escapeHtml(item.version || "V1")}</h3>
            <p>${escapeHtml(item.marca)} ${escapeHtml(item.modelo)} · ${item.pines || 0} pines · ${item.voltaje || "12V"}</p>
          </div>
        </div>`;
      }).join("")
      : `<div class="empty">Sin versiones guardadas</div>`;

    box.querySelectorAll("[data-id]").forEach((el) => {
      el.addEventListener("click", () => openDetalle(el.dataset.id));
    });
  }

  function dbAtras() {
    const p = state.dbPath;
    if (p.modelo) state.dbPath.modelo = null;
    else if (p.marca) state.dbPath.marca = null;
    else if (p.categoria) state.dbPath.categoria = null;
    else {
      showVista("menu");
      return;
    }
    renderDB();
  }

  function openDetalle(id) {
    const item = loadConnectors().find((x) => x.id === id);
    if (!item) return;
    state.detalleId = id;
    $("detalle-titulo").textContent = `${item.marca} ${item.modelo}`;
    $("detalle-meta").textContent = `${titleCase(item.categoria)} · ${item.version} · ${item.voltaje} · ${item.filas} filas · ${item.pines} pines${item.notas ? " · " + item.notas : ""}`;
    setPreview("detalle-foto", item.fotoConector || item.fotoCluster, "Sin foto");
    renderPinout(
      "pinout-detalle",
      item.pins || [],
      item.columns || Math.ceil((item.pines || 1) / (item.filas || 1)),
      null,
      {
        marca: item.marca,
        modelo: item.modelo,
        version: item.version,
        modulo: item.modulo || "DASH",
        voltaje: item.voltaje || "12V",
        forma: item.forma || "rect",
        filas: item.filas || 1,
        notas: item.notas || "",
        slug: item.slug,
      }
    );
    showVista("detalle");
  }

  function editCurrent() {
    const item = loadConnectors().find((x) => x.id === state.detalleId);
    if (!item) return;
    state.editingId = item.id;
    $("categoria").value = item.categoria || "MOTOCICLETAS";
    $("voltaje").value = item.voltaje || "12V";
    $("marca").value = item.marca || "";
    $("modelo").value = item.modelo || "";
    $("version").value = item.version || "V1";
    $("nuevo-filas").value = item.filas || "";
    $("nuevo-pines").value = item.pines || "";
    $("notas").value = item.notas || "";
    if ($("forma-pin")) $("forma-pin").value = item.forma || "rect";
    if ($("modulo-tipo")) $("modulo-tipo").value = item.modulo || "DASH";
    state.clusterDataUrl = item.fotoCluster || null;
    state.conectorDataUrl = item.fotoConector || null;
    state.pinsNuevo = (item.pins || []).map((p) => ({ ...p }));
    setPreview("preview-cluster", state.clusterDataUrl, "Foto cluster");
    setPreview("preview-conector", state.conectorDataUrl, "Foto conector");
    if (state.pinsNuevo.length) {
      $("resultado-nuevo").classList.remove("hidden");
      refreshPinoutTarget("nuevo");
    } else {
      $("resultado-nuevo").classList.add("hidden");
    }
    showVista("nuevo");
    toast("Modo edición: guarda para actualizar");
  }

  function deleteCurrent() {
    if (!state.detalleId) return;
    if (!confirm("¿Borrar este conector?")) return;
    const list = loadConnectors().filter((x) => x.id !== state.detalleId);
    saveConnectors(list);
    state.detalleId = null;
    toast("Conector borrado");
    showVista("db");
    renderDB();
  }

  function same(a, b) {
    return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
  }

  function titleCase(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replace(/'/g, "&#39;");
  }

  function fillConfigForm() {
    const cfg = loadConfig();
    $("api-key").value = cfg.apiKey || "";
    $("modelo-ia").value = cfg.model || "gemini-2.0-flash";
  }

  async function testAI() {
    const cfg = loadConfig();
    if (!cfg.apiKey) {
      toast("Falta la API key");
      return;
    }
    toast("Probando conexión...");
    try {
      const model = cfg.model || "gemini-2.0-flash";
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: "Responde solo: OK" }] }] }),
      });
      if (!res.ok) throw new Error("HTTP " + res.status);
      toast("IA conectada correctamente");
    } catch (err) {
      toast("No se pudo conectar: " + (err.message || "error"));
    }
  }

  function runSplash() {
    const bar = $("loading-bar");
    const status = $("status");
    const mensajes = [
      "Cargando módulos...",
      "Preparando escáner...",
      "Inicializando Pinout Engine...",
      "Conectando base de datos...",
      "Sistema listo...",
    ];
    let percent = 0;
    let i = 0;
    const timer = setInterval(() => {
      percent += 10;
      if (bar) bar.style.width = percent + "%";
      if (status && i < mensajes.length) {
        status.textContent = mensajes[i];
        i += 1;
      }
      if (percent >= 100) {
        clearInterval(timer);
        setTimeout(() => {
          $("splash").style.display = "none";
          $("app").style.display = "block";
          $("topbar").classList.add("hidden");
        }, 350);
      }
    }, 120);
  }

  function bind() {
    $("btn-tema").addEventListener("click", toggleTheme);
    $("btn-tema-claro").addEventListener("click", () => applyTheme("light"));
    $("btn-tema-oscuro").addEventListener("click", () => applyTheme("dark"));
    $("btn-tema-menu").addEventListener("click", () => applyTheme("dark"));
    $("btn-tema-menu-claro").addEventListener("click", () => applyTheme("light"));
    $("btn-cerrar-vista").addEventListener("click", cerrarVista);

    $("btn-escanear").addEventListener("click", () => showVista("escanear"));
    $("btn-nuevo").addEventListener("click", () => {
      state.editingId = null;
      showVista("nuevo");
    });
    $("btn-db").addEventListener("click", () => {
      showVista("db");
      renderDB();
    });
    $("btn-config").addEventListener("click", () => {
      fillConfigForm();
      showVista("config");
    });

    $("btn-db-atras").addEventListener("click", dbAtras);
    $("btn-detalle-atras").addEventListener("click", () => {
      showVista("db");
      renderDB();
    });
    $("btn-editar").addEventListener("click", editCurrent);
    $("btn-detalle-borrar").addEventListener("click", deleteCurrent);

    $("btn-abrir-camara").addEventListener("click", () => $("input-foto-scan").click());
    $("input-foto-scan").addEventListener("change", async (e) => {
      try {
        const raw = await readFileAsDataURL(e.target.files[0]);
        state.scanDataUrl = await compressImage(raw);
        setPreview("preview-scan", state.scanDataUrl, "Sin foto");
        $("btn-analizar-scan").disabled = !state.scanDataUrl;
        setAiBadge("ai-status-scan", "warn", "Foto lista. Analiza con IA o escribe filas/pines.");
      } catch (err) {
        toast(err.message);
      }
    });
    $("btn-analizar-scan").addEventListener("click", () => runAI("scan"));
    $("btn-generar-desde-scan").addEventListener("click", generateFromScan);
    $("btn-guardar-scan").addEventListener("click", () => saveFrom("scan"));

    $("foto-cluster").addEventListener("change", async (e) => {
      try {
        const raw = await readFileAsDataURL(e.target.files[0]);
        state.clusterDataUrl = await compressImage(raw);
        setPreview("preview-cluster", state.clusterDataUrl, "Foto cluster");
      } catch (err) {
        toast(err.message);
      }
    });
    $("foto-conector").addEventListener("change", async (e) => {
      try {
        const raw = await readFileAsDataURL(e.target.files[0]);
        state.conectorDataUrl = await compressImage(raw);
        setPreview("preview-conector", state.conectorDataUrl, "Foto conector");
        setAiBadge("ai-status-nuevo", "warn", "Foto lista para detectar filas/pines");
      } catch (err) {
        toast(err.message);
      }
    });
    $("btn-ia-nuevo").addEventListener("click", () => runAI("nuevo"));
    $("btn-generar-nuevo").addEventListener("click", generateNuevo);
    $("btn-guardar-nuevo").addEventListener("click", () => saveFrom("nuevo"));

    ["forma-pin", "modulo-tipo", "marca", "modelo", "version", "notas", "nuevo-filas"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (state.pinsNuevo.length) refreshPinoutTarget("nuevo");
      });
      el.addEventListener("input", () => {
        if (state.pinsNuevo.length && (id === "marca" || id === "modelo" || id === "version" || id === "notas")) {
          refreshPinoutTarget("nuevo");
        }
      });
    });
    ["scan-forma-pin", "scan-modulo", "scan-marca", "scan-modelo", "scan-version", "scan-filas"].forEach((id) => {
      const el = $(id);
      if (!el) return;
      el.addEventListener("change", () => {
        if (state.pinsScan.length) refreshPinoutTarget("scan");
      });
      el.addEventListener("input", () => {
        if (state.pinsScan.length && (id === "scan-marca" || id === "scan-modelo" || id === "scan-version")) {
          refreshPinoutTarget("scan");
        }
      });
    });

    $("btn-guardar-config").addEventListener("click", () => {
      saveConfig({
        apiKey: $("api-key").value.trim(),
        model: $("modelo-ia").value,
      });
      toast("Configuración guardada");
    });
    $("btn-probar-ia").addEventListener("click", testAI);

    $("btn-cerrar-modal").addEventListener("click", () => $("modal-pin").classList.remove("open"));
    $("btn-aplicar-pin").addEventListener("click", applyPinModal);
    $("modal-pin").addEventListener("click", (e) => {
      if (e.target === $("modal-pin")) $("modal-pin").classList.remove("open");
    });
  }

  function openFromHash() {
    const hash = (location.hash || "").replace("#", "").toLowerCase();
    const forced = sessionStorage.getItem("cg_open");
    if (forced) sessionStorage.removeItem("cg_open");
    const target = forced || hash;
    if (target === "db") {
      showVista("db");
      renderDB();
    } else if (target === "nuevo" || target === "new") {
      state.editingId = null;
      showVista("nuevo");
    } else if (target === "escanear" || target === "scan") {
      showVista("escanear");
    } else if (target === "config") {
      fillConfigForm();
      showVista("config");
    }
  }

  function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    bind();
    runSplash();
    setTimeout(openFromHash, 700);
    window.addEventListener("hashchange", openFromHash);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
