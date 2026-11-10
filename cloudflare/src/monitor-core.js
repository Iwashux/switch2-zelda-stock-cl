const STORES = [
  {
    name: "Santo Games",
    url: "https://www.santogames.cl/nintendo-switch-2-the-legend-of-zelda-40%C2%BA-aniversario",
  },
  {
    name: "Play Service",
    url: "https://playservice.cl/producto/preventa-consola-nintendo-switch-2-the-legend-of-zelda-40th-anniversary/",
  },
  {
    name: "Mathogames",
    url: "https://www.mathogames.cl/consolas-switch-2/2570-consola-nintendo-switch-2-the-legend-of-zelda-40th-anniversary.html",
  },
  {
    name: "TodoJuegos",
    url: "https://www.todojuegos.cl/Productos/NS2/Consola-Switch-2-Zelda-40th-Aniversario/",
  },
  {
    name: "WePlay",
    url: "https://www.weplay.cl/consola-switch-2-the-legend-of-zelda-40th-aniversario.html",
  },
  {
    name: "WePlay (HK)",
    url: "https://www.weplay.cl/consola-nintendo-switch-2-zelda-aniversario-hk.html",
  },
  {
    name: "Paris",
    url: "https://www.paris.cl/consola-nintendo-switch-2-the-legend-of-zelda-40th-aniversario-609811999.html",
  },
];

const ML_STORE_URL = "https://www.mercadolibre.cl/tienda/nintendo";
const ZONA_GAMER_FB_URL = "https://web.facebook.com/p/Zona-Gamer-Iquique-100063732433382/";
const ZONA_GAMER_MIRROR_URL = "https://www.govern1.com/CL/Iquique/100213088361257/Zona-Gamer-Iquique";

// Con `parse`, la página ya trae nombre/precio/stock (la ficha no se abre:
// Falabella la protege con Cloudflare). Sin `parse`, se siguen los enlaces.
const RETAILER_WATCH_PAGES = [
  { name: "Falabella", url: "https://www.falabella.com/falabella-cl/search?Ntt=switch+2+zelda+40", parse: falabellaResults },
  { name: "PC Factory", url: "https://api.pcfactory.cl/pcfactory-services-catalogo/v1/catalogo/productos?page=0&size=24&search=switch+2+zelda", parse: pcFactoryResults },
  { name: "Bestmart", url: "https://bestmart.cl/collections/nintendo-switch-2-zelda-edicion-40-aniversario" },
  { name: "Ripley", url: "https://simple.ripley.cl/tecno/nintendo/consolas?s=mdco&type=catalog" },
  { name: "Lider", url: "https://www.lider.cl/browse/tecno/videojuegos/nintendo/66849718_80980590_97449970" },
  { name: "Sniper", url: "https://sniper.cl/collections/todos-los-productos" },
];

const STATE_PATH = "state/cloudflare-state.json";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/126 Safari/537.36 Switch2ZeldaCloudflareMonitor/1.0";

async function fetchExternal(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const NEGATIVE = [
  "agotado",
  "sin existencias",
  "sin stock",
  "fuera de stock",
  "sold out",
  "out of stock",
  "producto no disponible",
  "temporalmente agotado",
  "no tendra preventa",
  "no tendrá preventa",
];

const PURCHASE_SIGNALS = [
  "agregar al carrito",
  "añadir al carrito",
  "anadir al carrito",
  "comprar ahora",
  "reserva ahora",
  "reservar ahora",
];

const PREORDER_TERMS = [
  "preventa",
  "pre venta",
  "pre-venta",
  "reserva",
  "reservas",
  "reservar",
  "preorder",
  "pre-order",
  "pre order",
  "presale",
  "pre-sale",
];

const EDITION_TERMS = [
  "40th",
  "40.º",
  "40º",
  "40°",
  "40 aniversario",
  "aniversario 40",
  "40 años",
  "40th anniversary",
  "edición 40",
  "edicion 40",
  "edición zelda",
  "edicion zelda",
  "zelda edition",
  "zelda edición",
  "zelda edicion",
  "edición especial zelda",
  "edicion especial zelda",
];

const CHALLENGE = [
  "just a moment",
  "un momento",
  "checking your browser",
  "verify you are human",
  "verifique que es humano",
  "enable javascript and cookies",
  "attention required",
  "cf-chl-",
  "cloudflare ray id",
];

function normalize(text = "") {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function pageTitle(html = "") {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? normalize(m[1]) : null;
}

function metaDescription(html = "") {
  const tag = html.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]*>/i)?.[0] || "";
  return tag.match(/content=["']([^"']*)["']/i)?.[1] || "";
}

// El orden importa: la advertencia japonesa primero, y el texto explícito
// de la ficha gana al prefijo UPC (hay versiones HK con UPC 045496).
const REGION_RULES = [
  // (?!\p{L}) y no \b: en JS "é" cuenta como límite, y "japonés" (idioma) no es la región.
  [/japonesa|jap[oó]n(?!\p{L})|\bjapan(?:ese)?\b/iu, "⚠️ Japonesa: solo funciona en japonés y con cuentas japonesas"],
  [/hong\s*kong|\bhk\b/i, "Hong Kong"],
  [/\bUSA\b|\bEE\.?\s?UU\b/, "Americana"], // sin /i: "usa" también es un verbo
  [/americana|estados unidos|\b(?:formato|versi[oó]n)\s+us\b/i, "Americana"],
  [/europea|\b(?:formato|versi[oó]n)\s+eu\b/i, "Europea"],
  [/\bglobal\b/i, "Global"],
];

function detectRegion(text = "", gtin = null) {
  const clean = normalize(text);
  for (const [re, label] of REGION_RULES) if (re.test(clean)) return label;
  if (/^0?045496\d{6}$/.test(String(gtin || ""))) return "Americana (Nintendo of America)";
  return "Región no indicada";
}

function money(value) {
  if (value == null) return null;
  let s = String(value).replace(/CLP/gi, "").replace(/\$/g, "").replace(/\s/g, "").trim();
  if (/^\d{1,3}(?:\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  else if (/^\d+(?:\.\d{1,2})$/.test(s)) s = s.split(".")[0];
  const digits = s.replace(/\D/g, "");
  if (!digits) return null;
  const n = Number(digits);
  return n >= 500000 && n <= 2000000 ? n : null;
}

function walk(value, cb) {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, cb);
  } else if (value && typeof value === "object") {
    cb(value);
    for (const item of Object.values(value)) walk(item, cb);
  }
}

function parseJsonLd(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["'][^"']*ld\+json[^"']*["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const candidates = [];

  for (const match of scripts) {
    try {
      const data = JSON.parse(match[1]);
      walk(data, (obj) => {
        const types = Array.isArray(obj["@type"]) ? obj["@type"] : [obj["@type"]];
        if (!types.includes("Product")) return;
        const name = String(obj.name || "");
        const low = name.toLowerCase();
        const score = ["switch", "zelda", "40"].reduce((n, token) => n + (low.includes(token) ? 1 : 0), 0);
        if (score >= 3) candidates.push({ score, obj });
      });
    } catch (_) {}
  }

  if (!candidates.length) return { price: null, availability: null, name: null, description: "", gtin: null };
  candidates.sort((a, b) => b.score - a.score);
  const obj = candidates[0].obj;
  const offers = Array.isArray(obj.offers) ? obj.offers : [obj.offers];
  const prices = [];
  let availability = null;

  for (const offer of offers) {
    if (!offer || typeof offer !== "object") continue;
    const currency = String(offer.priceCurrency || "").toUpperCase();
    const p = money(offer.price);
    if (p && (!currency || currency === "CLP")) prices.push(p);
    if (offer.availability) availability = String(offer.availability);
  }

  return {
    price: prices.length ? Math.min(...prices) : null,
    availability,
    name: obj.name ? String(obj.name) : null,
    description: typeof obj.description === "string" ? obj.description : "",
    gtin: [obj.gtin12, obj.gtin13, obj.gtin, obj.gtin14, obj.sku]
      .map((v) => String(v ?? ""))
      .find((v) => /^\d{12,14}$/.test(v)) || null,
  };
}

function fallbackPrice(text) {
  const values = [];
  for (const m of text.matchAll(/\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]{6,7})/g)) {
    const n = money(m[1]);
    if (n) values.push(n);
  }
  return values.length ? Math.min(...values) : null;
}

function mathogamesCurrentProductPrices(text) {
  const visible = normalize(text);

  const productMatch = visible.match(
    /consola\s+nintendo\s+switch\s*2.{0,180}the\s+legend\s+of\s+zelda.{0,120}40th\s+anniversary/i,
  );

  if (!productMatch || productMatch.index == null) {
    return { transfer: null, card: null };
  }

  // Solo miramos el bloque inmediatamente posterior al título del producto
  // para no capturar precios de productos relacionados o del catálogo.
  const block = visible.slice(productMatch.index, productMatch.index + 1800);

  const transferMatch = block.match(
    /por\s+transferencia\s+bancaria\s*\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]{6,7})/i,
  );
  const cardMatch = block.match(
    /con\s+tarjeta\s*\$\s*([0-9]{1,3}(?:[.\s][0-9]{3})+|[0-9]{6,7})/i,
  );

  return {
    transfer: transferMatch ? money(transferMatch[1]) : null,
    card: cardMatch ? money(cardMatch[1]) : null,
  };
}

function availabilityStatus(text, availability, http) {
  if (http === 404) return "page_missing";

  // La disponibilidad estructurada del producto es más fiable que palabras
  // sueltas del texto ("preventa", "disponible", etc.).
  const av = String(availability || "").toLowerCase();
  if (["outofstock", "soldout", "discontinued"].some((x) => av.includes(x))) {
    return "unavailable";
  }
  if (["instock", "preorder", "presale", "limitedavailability"].some((x) => av.includes(x))) {
    return "available";
  }

  const low = normalize(text).toLowerCase();
  if (NEGATIVE.some((x) => low.includes(x))) return "unavailable";

  // En el texto visible exigimos una acción real de compra/reserva. La mera
  // palabra "PREVENTA" sirve para descubrir el producto, pero NO demuestra
  // que la preventa esté abierta.
  if (PURCHASE_SIGNALS.some((x) => low.includes(x))) return "available";

  return "unknown";
}

async function inspectStore(store) {
  try {
    const response = await fetchExternal(store.url, {
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "es-CL,es;q=0.9,en;q=0.7",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    const http = response.status;
    if (http === 404) return { ...store, http, status: "page_missing", price_clp: null, title: null };
    if ([403, 429].includes(http) || http >= 500) return { ...store, http, status: "error", price_clp: null, title: null };

    const html = await response.text();
    const title = pageTitle(html);
    const first = `${title || ""} ${normalize(html.slice(0, 30000))}`.toLowerCase();
    if (CHALLENGE.some((x) => first.includes(x))) {
      return { ...store, http, status: "error", price_clp: null, title };
    }

    const jsonld = parseJsonLd(html);
    const visible = normalize(html);
    let price = jsonld.price || fallbackPrice(visible);
    let status = availabilityStatus(visible, jsonld.availability, http);
    const host = new URL(store.url).hostname.toLowerCase();

    if (host.includes("todojuegos.cl") && visible.toLowerCase().includes("precio x confirmar")) price = null;

    if (host.includes("mathogames.cl")) {
      const mathoPrices = mathogamesCurrentProductPrices(visible);
      // Para Mathogames mostramos el valor por transferencia como precio base.
      // Si no está disponible, usamos el valor con tarjeta.
      if (mathoPrices.transfer != null) price = mathoPrices.transfer;
      else if (mathoPrices.card != null) price = mathoPrices.card;
    }

    if (host.includes("santogames.cl")) {
      // Santo Games tiene "PREVENTA" fijo en la descripción y "agregar al
      // carrito" en productos relacionados: solo vale el JSON-LD del producto.
      // Sin JSON-LD la lectura no es concluyente (causaba avisos falsos que
      // duraban 1-12 min).
      const av = String(jsonld.availability || "").toLowerCase();
      const structuredAvailable = ["instock", "preorder", "presale", "limitedavailability"]
        .some((x) => av.includes(x));

      if (!av) status = "unknown";
      else if (!structuredAvailable) status = "unavailable";
      if (price == null) status = "unavailable";
    }

    // Solo texto de la propia ficha: la página completa trae productos
    // relacionados con otros UPC y palabras como "global" en scripts.
    const productText = [jsonld.name, jsonld.description, title, metaDescription(html)].join(" ");
    const gtin = jsonld.gtin || productText.match(/\b0?045496\d{6}\b/)?.[0];

    return {
      ...store,
      http,
      status,
      price_clp: price,
      title: jsonld.name || title,
      region: detectRegion(productText, gtin),
    };
  } catch (_) {
    return { ...store, http: null, status: "error", price_clp: null, title: null };
  }
}

function hasPreorderSignal(text) {
  const low = normalize(text).toLowerCase();
  return PREORDER_TERMS.some((term) => low.includes(term));
}

function target40Nearby(text) {
  const low = normalize(text).toLowerCase();
  const strictPatterns = [
    /switch\s*2.{0,260}zelda.{0,260}(?:40(?:th|\.?º|°)?|40\s*(?:aniversario|anniversary|años)|aniversario\s*40)/i,
    /zelda.{0,260}(?:40(?:th|\.?º|°)?|40\s*(?:aniversario|anniversary|años)|aniversario\s*40).{0,260}switch\s*2/i,
    /(?:40(?:th|\.?º|°)?|40\s*(?:aniversario|anniversary|años)|aniversario\s*40).{0,260}zelda.{0,260}switch\s*2/i,
  ];
  if (strictPatterns.some((re) => re.test(low))) return true;

  // Variante frecuente en preventas: la tienda omite "40th" del título y usa
  // "edición Zelda", "edición especial Zelda", etc.
  const hasSwitch2 = /switch\s*2|nintendo\s*switch\s*2/i.test(low);
  const hasZelda = low.includes("zelda");
  const hasEdition = EDITION_TERMS.some((term) => low.includes(term));
  const hasPreorder = PREORDER_TERMS.some((term) => low.includes(term));
  const looksLikeConsole = /consola|console|sistema|bundle|pack/i.test(low);

  return hasSwitch2 && hasZelda && hasEdition && hasPreorder && looksLikeConsole;
}

async function inspectMercadoLibreOfficial() {
  try {
    const response = await fetchExternal(ML_STORE_URL, {
      headers: { "user-agent": USER_AGENT, "accept-language": "es-CL,es;q=0.9" },
      redirect: "follow",
    });

    if (!response.ok) {
      return { monitor_status: `http_${response.status}`, item: null };
    }

    const html = await response.text();
    const title = pageTitle(html);
    const first = `${title || ""} ${normalize(html.slice(0, 25000))}`.toLowerCase();

    if (CHALLENGE.some((x) => first.includes(x))) {
      return { monitor_status: "blocked_or_challenge", item: null };
    }

    if (!target40Nearby(html)) {
      return { monitor_status: "not_found", item: null };
    }

    const visible = normalize(html);
    const price = fallbackPrice(visible);

    return {
      monitor_status: "candidate_detected",
      item: {
        name: "Mercado Libre · Nintendo Oficial",
        url: ML_STORE_URL,
        http: response.status,
        status: "available",
        price_clp: price,
        title: "Nintendo Switch 2 Zelda 40th Anniversary detectada en Tienda Oficial Nintendo",
        source: "mercadolibre_official",
      },
    };
  } catch (_) {
    return { monitor_status: "fetch_error", item: null };
  }
}


function targetExcerpt(text) {
  const normalized = normalize(text);
  const lower = normalized.toLowerCase();
  const anchors = [
    "zelda", "switch 2", "40th", "40 aniversario", "aniversario 40",
    "40º", "40°", "40 años", "preventa", "pre venta", "pre-venta",
    "reserva", "pre-order", "edición zelda", "edicion zelda"
  ];

  for (const anchor of anchors) {
    let index = lower.indexOf(anchor);
    while (index >= 0) {
      const start = Math.max(0, index - 600);
      const end = Math.min(normalized.length, index + 900);
      const excerpt = normalized.slice(start, end);
      if (target40Nearby(excerpt)) return excerpt;
      index = lower.indexOf(anchor, index + anchor.length);
    }
  }
  return target40Nearby(normalized) ? normalized.slice(0, 1400) : null;
}


function decodeHref(value = "") {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/gi, "/");
}

function catalogCandidateLinks(html, baseUrl) {
  const out = [];
  const seen = new Set();

  for (const match of html.matchAll(/<a\b([^>]*?)href=["\']([^"\']+)["\']([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const attrs = String(match[1] || "") + " " + String(match[3] || "");
    const href = decodeHref(match[2] || "").trim();
    const inner = match[4] || "";
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;

    const altTexts = [...inner.matchAll(/\b(?:alt|title)=["\']([^"\']+)["\']/gi)]
      .map((m) => m[1])
      .join(" ");
    const anchorTitle = attrs.match(/\btitle=["\']([^"\']+)["\']/i)?.[1] || "";
    const label = normalize(inner + " " + altTexts + " " + anchorTitle);
    if (!target40Nearby(label)) continue;

    try {
      const url = new URL(href, baseUrl);
      if (!/^https?:$/.test(url.protocol)) continue;
      url.hash = "";
      const clean = url.toString();
      if (seen.has(clean)) continue;
      seen.add(clean);
      out.push({ url: clean, label });
    } catch (_) {}
  }

  return out;
}

function falabellaResults(html) {
  const data = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i)?.[1];
  if (!data) return [];
  const byUrl = new Map();
  walk(JSON.parse(data), (obj) => {
    if (typeof obj.displayName !== "string" || typeof obj.url !== "string") return;
    if (!target40Nearby(obj.displayName)) return;
    const prices = [].concat(obj.prices || [])
      .filter((p) => !p.crossed)
      .flatMap((p) => [].concat(p.price || []))
      .map(money)
      .filter(Boolean);
    byUrl.set(obj.url, {
      url: obj.url,
      http: 200,
      // shortcut: el buscador de Falabella solo lista productos con stock; si empieza a mostrar agotados, leer otro campo.
      status: "available",
      price_clp: prices.length ? Math.min(...prices) : null,
      title: obj.displayName,
      seller: obj.sellerName || null,
      region: detectRegion(obj.displayName),
    });
  });
  return [...byUrl.values()];
}

function pcFactoryResults(body) {
  const items = JSON.parse(body)?.content?.items || [];
  return items
    .filter((item) => target40Nearby(item.nombre || ""))
    .map((item) => ({
      url: `https://www.pcfactory.cl/producto/${item.slug}`,
      http: 200,
      // stock llega como "3", "+100" o "0".
      status: Number(String(item.stock || "0").replace(/\D/g, "")) > 0 ? "available" : "unavailable",
      price_clp: money(Math.round(Number(item.precio?.efectivo))),
      title: item.nombre,
      region: detectRegion(item.nombre),
    }));
}

function isExternalSeller(seller) {
  return Boolean(seller) && !/^falabella(\.com)?$/i.test(seller.trim());
}

async function inspectRetailerCatalogs() {
  const candidates = [];
  const statuses = [];

  for (const retailer of RETAILER_WATCH_PAGES) {
    try {
      const r = await fetchExternal(retailer.url, {
        redirect: "follow",
        headers: {
          "user-agent": USER_AGENT,
          "accept-language": "es-CL,es;q=0.9",
          // JSON para la API de PC Factory (sin él responde 406).
          accept: "text/html,application/xhtml+xml,application/json;q=0.9",
        },
      });

      if (!r.ok) {
        statuses.push(retailer.name + ":http_" + r.status);
        continue;
      }

      const html = await r.text();
      const title = pageTitle(html) || "";
      const first = (title + " " + normalize(html.slice(0, 30000))).toLowerCase();
      if (CHALLENGE.some((x) => first.includes(x))) {
        statuses.push(retailer.name + ":blocked");
        continue;
      }

      if (retailer.parse) {
        const found = retailer.parse(html);
        for (const item of found) {
          candidates.push({ name: retailer.name + " · catálogo", ...item, source: "retailer_catalog", retailer: retailer.name });
        }
        statuses.push(retailer.name + ":" + (found.length ? "candidate_" + found.length : "not_found"));
        continue;
      }

      const links = catalogCandidateLinks(html, retailer.url);
      if (!links.length) {
        statuses.push(retailer.name + ":not_found");
        continue;
      }

      let accepted = 0;
      for (const link of links.slice(0, 5)) {
        const current = await inspectStore({
          name: retailer.name + " · catálogo",
          url: link.url,
        });
        if (["error", "unknown", "page_missing"].includes(current.status)) continue;
        candidates.push({ ...current, source: "retailer_catalog", retailer: retailer.name });
        accepted += 1;
      }

      statuses.push(retailer.name + ":" + (accepted ? "candidate_" + accepted : "candidate_unreadable"));
    } catch (_) {
      statuses.push(retailer.name + ":fetch_error");
    }
  }

  return {
    monitor_status: statuses.join("+") || "not_checked",
    candidates,
  };
}

function fingerprint(text) {
  let hash = 2166136261;
  const value = normalize(text).toLowerCase();
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function inspectZonaGamerIquique(includeSearch = false) {
  const candidates = [];
  const statuses = [];

  // 1) Intento directo a la página pública de Facebook.
  try {
    const r = await fetchExternal(ZONA_GAMER_FB_URL, {
      redirect: "follow",
      headers: {
        "user-agent": USER_AGENT,
        "accept-language": "es-CL,es;q=0.9",
        accept: "text/html,application/xhtml+xml",
      },
    });

    if (!r.ok) {
      statuses.push(`facebook_http_${r.status}`);
    } else {
      const html = await r.text();
      const title = pageTitle(html) || "";
      const first = `${title} ${normalize(html.slice(0, 30000))}`.toLowerCase();
      const fbBlocked = [
        ...CHALLENGE,
        "log in to facebook",
        "inicia sesión en facebook",
        "create new account",
      ].some((x) => first.includes(x));

      if (fbBlocked) {
        statuses.push("facebook_blocked_or_login");
      } else {
        const excerpt = targetExcerpt(html);
        if (excerpt) {
          candidates.push({
            name: "Zona Gamer Iquique · Facebook",
            url: ZONA_GAMER_FB_URL,
            status: "available",
            price_clp: fallbackPrice(excerpt),
            title: "Posible publicación Switch 2 Zelda 40th en Zona Gamer Iquique",
            source: "zona_gamer_facebook",
            fingerprint: fingerprint(excerpt),
          });
          statuses.push("facebook_candidate_detected");
        } else {
          statuses.push("facebook_not_found");
        }
      }
    }
  } catch (_) {
    statuses.push("facebook_fetch_error");
  }

  // 2) Espejo público de publicaciones de Zona Gamer Iquique.
  try {
    const r = await fetchExternal(ZONA_GAMER_MIRROR_URL, {
      redirect: "follow",
      headers: { "user-agent": USER_AGENT, "accept-language": "es-CL,es;q=0.9" },
    });
    if (!r.ok) {
      statuses.push(`mirror_http_${r.status}`);
    } else {
      const html = await r.text();
      const excerpt = targetExcerpt(html);
      if (excerpt) {
        candidates.push({
          name: "Zona Gamer Iquique · publicación pública",
          url: ZONA_GAMER_MIRROR_URL,
          status: "available",
          price_clp: fallbackPrice(excerpt),
          title: "Posible publicación Switch 2 Zelda 40th en Zona Gamer Iquique",
          source: "zona_gamer_mirror",
          fingerprint: fingerprint(excerpt),
        });
        statuses.push("mirror_candidate_detected");
      } else {
        statuses.push("mirror_not_found");
      }
    }
  } catch (_) {
    statuses.push("mirror_fetch_error");
  }

  // 3) Respaldo por buscador. Solo se usa en las rondas amplias.
  if (includeSearch) {
    const queries = [
      '"Zona Gamer Iquique" "Switch 2" Zelda 40',
      '"Zona Gamer Iquique" "Nintendo Switch 2" "40th"',
      '"Zona Gamer Iquique" preventa "Switch 2" Zelda',
      '"Zona Gamer Iquique" reserva "Switch 2" Zelda',
      '"Zona Gamer Iquique" "edición Zelda" "Switch 2"',
    ];

    for (const query of queries) {
      for (const item of await bingRss(query)) {
        let host = "";
        try {
          host = new URL(item.url).hostname.toLowerCase();
        } catch (_) {
          continue;
        }

        const isZonaMirror =
          host === "govern1.com" ||
          host.endsWith(".govern1.com");
        const isAllowedSource = isSocialHost(host) || isZonaMirror;
        if (!isAllowedSource) continue;

        const corpus = `${item.title || ""} ${item.description || ""}`;
        const normalizedCorpus = normalize(corpus).toLowerCase();

        // Bing puede devolver resultados que coinciden con Zelda/40th pero que
        // no pertenecen a Zona Gamer. Exigimos una mención explícita del local.
        if (!normalizedCorpus.includes("zona gamer iquique")) continue;
        if (!target40Nearby(corpus)) continue;
        if (!hasPreorderSignal(corpus)) continue;

        const excerpt = targetExcerpt(corpus) || corpus;

        candidates.push({
          name: "Zona Gamer Iquique · resultado indexado",
          url: item.url,
          status: "available",
          price_clp: fallbackPrice(excerpt),
          title: item.title || "Publicación Zona Gamer Iquique",
          source: "zona_gamer_search",
          fingerprint: fingerprint(`${item.url}|${excerpt}`),
        });
      }
    }
    statuses.push("search_checked");
  }

  const unique = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const key = candidate.fingerprint || candidate.url;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(candidate);
  }

  return {
    monitor_status: statuses.join("+") || "not_checked",
    candidates: unique,
  };
}

function xmlDecode(s = "") {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

async function bingRss(query) {
  const url = `https://www.bing.com/search?${new URLSearchParams({ q: query, format: "rss", cc: "cl", setlang: "es" })}`;
  try {
    const r = await fetchExternal(url, { headers: { "user-agent": USER_AGENT } });
    if (!r.ok) return [];
    const xml = await r.text();
    const out = [];
    for (const item of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
      const block = item[1];
      const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "";
      const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "";
      const description = block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "";
      if (link) out.push({
        title: xmlDecode(title).trim(),
        url: xmlDecode(link).trim(),
        description: normalize(xmlDecode(description)),
      });
    }
    return out;
  } catch (_) {
    return [];
  }
}

async function discoverNewStores(knownUrls) {
const queries = [
    '"Nintendo Switch 2" Zelda "40th Anniversary" Chile',
    '"Nintendo Switch 2" Zelda "40 aniversario" Chile',
    '"Switch 2" Zelda 40 preventa Chile',
    '"Switch 2" Zelda "pre-venta" Chile',
    '"Switch 2" Zelda reserva Chile',
    '"Switch 2" "edición Zelda" preventa Chile',
    '"Switch 2" "edicion Zelda" preventa Chile',
    '"Consola Switch 2" Zelda preventa Chile',
    '"Nintendo Switch 2" Zelda preorder Chile',
    '"Nintendo Switch 2" Zelda "40 años" Chile',
    '"The Legend of Zelda" "Switch 2" preventa Chile',
    '"Zelda 40th" "Switch 2" preventa',
    'site:falabella.com/falabella-cl "Switch 2" Zelda "40" consola',
    'site:simple.ripley.cl "Switch 2" Zelda "40" consola',
    'site:paris.cl "Switch 2" Zelda "40" consola',
    'site:lider.cl "Switch 2" Zelda "40" consola',
    'site:pcfactory.cl "Switch 2" Zelda "40" consola',
    'site:sniper.cl "Switch 2" Zelda "40" consola',
  ];
  const seen = new Set(knownUrls);
  const candidates = [];

  const batches = await Promise.all(queries.map((query) => bingRss(query)));

  for (const item of batches.flat()) {
    let url;
    try {
      const u = new URL(item.url.split("#", 1)[0]);
      if (!u.hostname.endsWith(".cl") && u.hostname !== "mercadolibre.cl" && !u.hostname.endsWith(".mercadolibre.cl")) continue;
      if (u.hostname === "mercadolibre.cl" || u.hostname.endsWith(".mercadolibre.cl")) continue;
      url = u.toString();
    } catch (_) {
      continue;
    }

    if (seen.has(url)) continue;
    seen.add(url);
    candidates.push({ item, url });
    if (candidates.length >= 24) break;
  }

  const inspected = await Promise.all(
    candidates.map(async ({ item, url }) => {
      try {
        const current = await inspectStore({
          name: new URL(url).hostname.replace(/^www\./, ""),
          url,
        });

        if (["error", "unknown", "page_missing"].includes(current.status)) return null;
        const corpus = `${item.title || ""} ${current.title || ""}`;
        if (!target40Nearby(corpus)) return null;
        return { ...current, source: "discovery" };
      } catch (_) {
        return null;
      }
    }),
  );

  return inspected.filter(Boolean);
}

const SOCIAL_HOSTS = [
  "facebook.com",
  "web.facebook.com",
  "instagram.com",
  "www.instagram.com",
  "threads.net",
  "www.threads.net",
];

function isSocialHost(hostname) {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  return SOCIAL_HOSTS.some((allowed) => {
    const clean = allowed.replace(/^www\./, "");
    return host === clean || host.endsWith("." + clean);
  });
}

async function discoverSocialPreorders() {
const queries = [
    'site:facebook.com "Switch 2" Zelda preventa Chile',
    'site:facebook.com "Nintendo Switch 2" "edición Zelda" Chile',
    'site:facebook.com "Switch 2" Zelda "40 aniversario" Chile',
    'site:instagram.com "Switch 2" Zelda preventa Chile',
    'site:instagram.com "Nintendo Switch 2" Zelda "40th" Chile',
    'site:instagram.com "edición Zelda" "Switch 2" preventa Chile',
  ];
  const found = [];
  const seen = new Set();
  const batches = await Promise.all(queries.map((query) => bingRss(query)));

  for (const item of batches.flat()) {
    let host = "";
    try {
      host = new URL(item.url).hostname;
    } catch (_) {
      continue;
    }
    if (!isSocialHost(host)) continue;

    const corpus = `${item.title || ""} ${item.description || ""}`;
    if (!target40Nearby(corpus)) continue;
    if (!hasPreorderSignal(corpus)) continue;

    const key = `${item.url}|${normalize(corpus).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const excerpt = targetExcerpt(corpus) || corpus;
    found.push({
      name: `Red social · ${host.replace(/^www\\./, "")}`,
      url: item.url,
      status: "available",
      price_clp: fallbackPrice(excerpt),
      title: item.title || "Posible preventa Switch 2 Zelda",
      source: "social_search",
      fingerprint: fingerprint(excerpt),
    });
  }

  return found;
}

function formatPrice(n) {
  if (n == null) return "—";
  return `$${new Intl.NumberFormat("es-CL").format(n)}`;
}

function statusLabel(status) {
  return {
    available: "🟢 disponible / preventa",
    unavailable: "🔴 agotado / sin stock",
    page_missing: "⚪ página retirada",
    unknown: "🟡 no concluyente",
    error: "⚠️ error temporal",
  }[status] || status;
}

function actionableChange(oldSnap, current, isNew = false) {
  // Una URL nueva agotada/no concluyente se registra silenciosamente.
  if (isNew) return current.status === "available";
  if (!oldSnap) return false;

  if (oldSnap.status !== "available" && current.status === "available") return true;

  // Un cambio de precio solo es accionable cuando realmente se puede comprar.
  if (
    current.status === "available" &&
    current.price_clp != null &&
    oldSnap.price_clp !== current.price_clp
  ) {
    return true;
  }

  return false;
}

function sameSnapshot(a, b) {
  return (
    a?.status === b?.status &&
    a?.price_clp === b?.price_clp &&
    a?.http === b?.http &&
    a?.title === b?.title &&
    a?.seller === b?.seller &&
    a?.region === b?.region
  );
}

function describe(current, oldSnap = null, isNew = false) {
  let heading = `### 🔔 Cambio detectado: ${current.name}`;
  if (isNew) heading = `### 🆕 Nueva publicación: ${current.name}`;
  else if (oldSnap?.status !== "available" && current.status === "available") heading = `### 🚨 STOCK / PREVENTA DISPONIBLE: ${current.name}`;
  else if (oldSnap?.price_clp !== current.price_clp && current.price_clp != null) heading = `### 💰 Cambio de precio: ${current.name}`;

  return [
    heading,
    "",
    `- Estado: ${oldSnap ? statusLabel(oldSnap.status) : "—"} → **${statusLabel(current.status)}**`,
    `- Precio: ${formatPrice(oldSnap?.price_clp)} → **${formatPrice(current.price_clp)}**`,
    `- Región: ${current.region || "Región no indicada"}`,
    ...(current.seller
      ? [`- Vendedor: ${current.seller}${isExternalSeller(current.seller) ? " ⚠️ **vendedor externo (no es Falabella)**" : ""}`]
      : []),
    `- Enlace: ${current.url}`,
  ].join("\n");
}

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(text) {
  const clean = text.replace(/\s/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function githubHeaders(env) {
  return {
    authorization: `Bearer ${env.GITHUB_TOKEN}`,
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    "user-agent": "switch2-zelda-cloudflare-worker",
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function githubGetWithRetry(env, url, attempts = 3, timeoutMs = 12000) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        headers: githubHeaders(env),
        signal: controller.signal,
      });

      if (response.ok || response.status === 404) {
        return response;
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`GitHub GET transient error: ${response.status}`);
      } else {
        return response;
      }
    } catch (err) {
      lastError = err;
    } finally {
      clearTimeout(timer);
    }

    if (attempt < attempts) {
      await sleep(800 * attempt);
    }
  }

  throw lastError || new Error("GitHub GET failed after retries");
}

async function loadState(env) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${STATE_PATH}`;
  const r = await githubGetWithRetry(env, url);
  if (r.status === 404) {
    return {
      sha: null,
      state: { version: 1, initialized: false, stores: {}, discovered: {} },
    };
  }
  if (!r.ok) throw new Error(`GitHub state GET failed: ${r.status}`);
  const payload = await r.json();
  return { sha: payload.sha, state: JSON.parse(base64ToUtf8(payload.content)) };
}

async function saveState(env, state, sha) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/contents/${STATE_PATH}`;
  const body = {
    message: "chore: actualizar estado Cloudflare monitor [skip ci]",
    content: utf8ToBase64(`${JSON.stringify(state, null, 2)}\n`),
    branch: "main",
  };
  if (sha) body.sha = sha;

  const r = await fetch(url, {
    method: "PUT",
    headers: { ...githubHeaders(env), "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`GitHub state PUT failed: ${r.status} ${await r.text()}`);
}

async function createIssue(env, title, body) {
  const url = `https://api.github.com/repos/${env.GITHUB_REPOSITORY}/issues`;
  const owner = env.GITHUB_REPOSITORY.split("/")[0];

  // Asignar al dueño hace que GitHub le notifique el Issue.
  let payload = { title, body, assignees: [owner] };

  let r = await fetch(url, {
    method: "POST",
    headers: { ...githubHeaders(env), "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  // GitHub rechaza (422) un assignee sin permisos: se crea igual sin asignar.
  if (r.status === 422) {
    payload = { title, body };
    r = await fetch(url, {
      method: "POST",
      headers: { ...githubHeaders(env), "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  if (!r.ok) {
    throw new Error(`GitHub issue POST failed: ${r.status} ${await r.text()}`);
  }
}

function telegramPlainText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function sendTelegram(env, title, body) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    console.warn("TELEGRAM SKIPPED · faltan TELEGRAM_BOT_TOKEN o TELEGRAM_CHAT_ID");
    return { sent: false, reason: "not_configured" };
  }

  const text = [
    "🚨 " + title,
    "",
    telegramPlainText(body),
  ].join("\n").slice(0, 4000);

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const r = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: false,
    }),
  });

  if (!r.ok) {
    const detail = await r.text();
    console.error(`TELEGRAM ERROR · ${r.status} · ${detail}`);
    return { sent: false, reason: `http_${r.status}` };
  }

  console.log("TELEGRAM OK · alerta enviada al grupo");
  return { sent: true, reason: null };
}

async function sendNtfy(env, title, message, clickUrl) {
  if (!env.NTFY_TOPIC) {
    console.warn("NTFY SKIPPED · falta NTFY_TOPIC");
    return { sent: false, reason: "not_configured" };
  }

  const headers = {
    // Los headers HTTP solo admiten ASCII: se quitan tildes y emojis.
    Title: title.normalize("NFD").replace(/[^\x20-\x7E]/g, "").replace(/\s+/g, " ").trim(),
    Priority: "high",
    Tags: "rotating_light,video_game",
    Click: new URL(clickUrl).href,
  };
  if (env.NTFY_EMAIL) headers.Email = env.NTFY_EMAIL;

  const r = await fetch(`https://ntfy.sh/${encodeURIComponent(env.NTFY_TOPIC)}`, {
    method: "POST",
    headers,
    body: message,
  });

  if (!r.ok) {
    console.error(`NTFY ERROR · ${r.status} · ${await r.text()}`);
    return { sent: false, reason: `http_${r.status}` };
  }

  console.log(`NTFY OK${env.NTFY_EMAIL ? " · con correo" : ""}`);
  return { sent: true, reason: null };
}

function ntfyMessage(current) {
  return [
    `${statusLabel(current.status)} · ${formatPrice(current.price_clp)}`,
    `Región: ${current.region || "Región no indicada"}`,
    ...(current.seller
      ? [`Vendedor: ${current.seller}${isExternalSeller(current.seller) ? " ⚠️ externo (no es Falabella)" : ""}`]
      : []),
    current.title || "",
  ].filter(Boolean).join("\n");
}

async function runMonitor(env, scheduledTime = Date.now(), forceDiscovery = false) {
  const dryRun = Boolean(env.DRY_RUN);
  if (!dryRun && !env.GITHUB_TOKEN) throw new Error("Missing GITHUB_TOKEN secret");
  // DRY_RUN: estado entregado por el llamador; sin commit, Issue ni avisos.
  const { sha, state } = dryRun
    ? { sha: null, state: structuredClone(env.DRY_RUN_STATE || { version: 1, initialized: false, stores: {}, discovered: {} }) }
    : await loadState(env);
  state.stores ||= {};
  state.discovered ||= {};
  state.retailer_discovered ||= {};
  state.pending_available ||= {};
  const initialized = Boolean(state.initialized);
  const alerts = [];
  const pushes = [];
  const addAlert = (current, old, isNew) => {
    alerts.push(describe(current, old, isNew));
    // Push y correo solo con disponibilidad real: nada de cambios de precio
    // ni posibles posts en redes sociales (esos van solo a Issue/Telegram).
    const becameAvailable = current.status === "available" && (isNew || old?.status !== "available");
    const social = current.source === "social_search" || String(current.source || "").startsWith("zona_gamer");
    if (becameAvailable && !social) pushes.push(current);
  };
  const checks = [];
  let dirty = false;
  let reliableStores = 0;
  let skippedStores = 0;
  let discoveredNew = 0;

  const knownResults = await Promise.all(
    STORES.map((store) => inspectStore(store)),
  );

  for (const current of knownResults) {
    checks.push({
      name: current.name,
      status: current.status,
      price_clp: current.price_clp,
      http: current.http,
      region: current.region,
    });

    if (["error", "unknown"].includes(current.status)) {
      skippedStores += 1;

      // La confirmación debe ser consecutiva. Un error/unknown entre medio
      // invalida el candidato de disponibilidad.
      if (state.pending_available[current.url]) {
        delete state.pending_available[current.url];
        dirty = true;
      }
      continue;
    }

    reliableStores += 1;

    const old = state.stores[current.url]?.snapshot || null;
    const snapshot = {
      http: current.http,
      status: current.status,
      price_clp: current.price_clp,
      title: current.title,
      region: current.region,
    };

    const isAvailabilityTransition =
      initialized &&
      old &&
      old.status !== "available" &&
      current.status === "available";

    if (isAvailabilityTransition) {
      const pending = state.pending_available[current.url];
      const signature = JSON.stringify({
        status: current.status,
        price_clp: current.price_clp,
        title: current.title,
      });

      const count =
        pending && pending.signature === signature
          ? Number(pending.count || 0) + 1
          : 1;

      state.pending_available[current.url] = {
        count,
        signature,
        first_seen_at: pending?.first_seen_at || new Date(scheduledTime).toISOString(),
        last_seen_at: new Date(scheduledTime).toISOString(),
      };
      dirty = true;

      // No cambiamos el estado principal ni alertamos hasta tener dos
      // lecturas fiables consecutivas (~1 minuto de confirmación).
      if (count < 2) {
        continue;
      }

      delete state.pending_available[current.url];
      dirty = true;
      addAlert(current, old, false);
    } else {
      if (state.pending_available[current.url]) {
        delete state.pending_available[current.url];
        dirty = true;
      }

      if (initialized && old && actionableChange(old, current, false)) {
        addAlert(current, old, false);
      }
    }

    if (!old || !sameSnapshot(old, snapshot)) {
      state.stores[current.url] = {
        name: current.name,
        snapshot,
        last_changed_at: new Date(scheduledTime).toISOString(),
      };
      dirty = true;
    }
  }

  const mlCheck = await inspectMercadoLibreOfficial();
  const mercadoLibreResult = mlCheck.monitor_status;
  const ml = mlCheck.item;
  if (ml) {
    const key = "mercadolibre:nintendo-official:zelda40";
    const old = state.stores[key]?.snapshot || null;
    const snapshot = {
      http: ml.http,
      status: ml.status,
      price_clp: ml.price_clp,
      title: ml.title,
      url: ml.url,
    };
    if (initialized && (!old || actionableChange(old, ml, !old))) addAlert(ml, old, !old);
    if (!old || !sameSnapshot(old, snapshot)) {
      state.stores[key] = {
        name: ml.name,
        snapshot,
        last_changed_at: new Date(scheduledTime).toISOString(),
      };
      dirty = true;
    }
  }

  const minute = new Date(scheduledTime).getUTCMinutes();
  const discoveryRan = forceDiscovery || minute % 15 === 0;
  const socialRan = forceDiscovery || minute % 5 === 0;
  const retailerScanRan = forceDiscovery || minute % 2 === 0;
  let zonaGamerResult = "not_checked";
  let retailerCatalogResult = "not_checked";

  if (retailerScanRan) {
    const catalog = await inspectRetailerCatalogs();
    retailerCatalogResult = catalog.monitor_status;

    for (const current of catalog.candidates) {
      checks.push({
        name: current.name,
        status: current.status,
        price_clp: current.price_clp,
        http: current.http,
        region: current.region,
        seller: current.seller,
      });
      const old = state.stores[current.url]?.snapshot || null;
      const snapshot = {
        http: current.http,
        status: current.status,
        price_clp: current.price_clp,
        title: current.title,
        region: current.region,
        ...(current.seller ? { seller: current.seller } : {}),
      };

      if (!state.retailer_discovered[current.url]) {
        state.retailer_discovered[current.url] = {
          name: current.name,
          url: current.url,
          retailer: current.retailer,
          found_at: new Date(scheduledTime).toISOString(),
        };
        dirty = true;
      }

      const needsConfirmation =
        current.status === "available" &&
        (!old || old.status !== "available");

      if (needsConfirmation) {
        const pending = state.pending_available[current.url];
        const signature = JSON.stringify({
          status: current.status,
          price_clp: current.price_clp,
          title: current.title,
        });
        const count =
          pending && pending.signature === signature
            ? Number(pending.count || 0) + 1
            : 1;

        state.pending_available[current.url] = {
          count,
          signature,
          first_seen_at: pending?.first_seen_at || new Date(scheduledTime).toISOString(),
          last_seen_at: new Date(scheduledTime).toISOString(),
        };
        dirty = true;

        if (count < 2) {
          continue;
        }

        delete state.pending_available[current.url];
        dirty = true;
        addAlert(current, old, !old);
      } else {
        if (state.pending_available[current.url]) {
          delete state.pending_available[current.url];
          dirty = true;
        }

        if (initialized && old && actionableChange(old, current, false)) {
          addAlert(current, old, false);
        }
      }

      if (!old || !sameSnapshot(old, snapshot)) {
        state.stores[current.url] = {
          name: current.name,
          snapshot,
          last_changed_at: new Date(scheduledTime).toISOString(),
        };
        dirty = true;
      }
    }
  }

  if (socialRan) {
    const zona = await inspectZonaGamerIquique(discoveryRan);
    zonaGamerResult = zona.monitor_status;
    state.social_discovered ||= {};

    for (const current of zona.candidates) {
      const key = `zona-gamer:${current.fingerprint}`;
      if (state.social_discovered[key]) continue;

      state.social_discovered[key] = {
        name: current.name,
        url: current.url,
        source: current.source,
        fingerprint: current.fingerprint,
        found_at: new Date(scheduledTime).toISOString(),
      };

      if (initialized) {
        addAlert(current, null, true);
      }
      dirty = true;
    }
  }
  if (discoveryRan) {
    state.social_discovered ||= {};
    for (const current of await discoverSocialPreorders()) {
      const key = `social-search:${current.fingerprint}`;
      if (state.social_discovered[key]) continue;

      state.social_discovered[key] = {
        name: current.name,
        url: current.url,
        source: current.source,
        fingerprint: current.fingerprint,
        found_at: new Date(scheduledTime).toISOString(),
      };

      if (initialized && actionableChange(null, current, true)) {
        addAlert(current, null, true);
      }
      discoveredNew += 1;
      dirty = true;
    }

    const knownUrls = new Set([
      ...STORES.map((s) => s.url),
      ...Object.keys(state.discovered),
    ]);
    const found = await discoverNewStores(knownUrls);
    for (const current of found) {
      if (state.discovered[current.url]) continue;
      state.discovered[current.url] = {
        name: current.name,
        url: current.url,
        found_at: new Date(scheduledTime).toISOString(),
      };
      state.stores[current.url] = {
        name: current.name,
        snapshot: {
          http: current.http,
          status: current.status,
          price_clp: current.price_clp,
          title: current.title,
          region: current.region,
        },
        last_changed_at: new Date(scheduledTime).toISOString(),
      };
      if (initialized && actionableChange(null, current, true)) {
        addAlert(current, null, true);
      }
      discoveredNew += 1;
      dirty = true;
    }
  }

  if (!initialized) {
    state.initialized = true;
    dirty = true;
  }
  state.version = 1;

  if (dirty && !dryRun) await saveState(env, state, sha);

  let telegramResult = { sent: false, reason: "no_alerts" };
  let ntfySent = 0;

  if (alerts.length && dryRun) {
    console.log("[DRY_RUN] Issue y Telegram omitidos. Contenido:\n" + alerts.join("\n\n"));
    for (const current of pushes) console.log(`[DRY_RUN] ntfy omitido · ${current.name} · ${current.url}`);
    telegramResult = { sent: false, reason: "dry_run" };
  } else if (alerts.length) {
    const body = [
      "# Switch 2 Zelda 40th — alerta",
      "",
      ...alerts,
      "",
      "---",
      `Revisión: ${new Date(scheduledTime).toISOString()}`,
      "Monitor automático: Cloudflare → GitHub Actions.",
    ].join("\n");

    const title = `Switch 2 Zelda 40th: ${alerts.length} novedad(es)`;

    // El estado ya se guardó: si el Issue falla, igual hay que intentar los
    // otros canales, o la alerta se perdería. El error se relanza al final.
    let issueError = null;
    try {
      await createIssue(env, `🚨 ${title}`, body);
    } catch (err) {
      issueError = err;
      console.error("ISSUE ERROR", err?.stack || String(err));
    }

    try {
      telegramResult = await sendTelegram(env, title, body);
    } catch (err) {
      telegramResult = { sent: false, reason: "exception" };
      console.error("TELEGRAM EXCEPTION", err?.stack || String(err));
    }

    // Un push por tienda, cada uno con su propio enlace "Click".
    for (const current of pushes) {
      try {
        const r = await sendNtfy(env, `Zelda 40: disponible en ${current.name}`, ntfyMessage(current), current.url);
        if (r.sent) ntfySent += 1;
      } catch (err) {
        console.error("NTFY EXCEPTION", err?.stack || String(err));
      }
    }

    if (issueError) throw issueError;
  }

  return {
    alerts: alerts.length,
    telegram_sent: telegramResult.sent,
    telegram_reason: telegramResult.reason,
    ntfy_pushes: pushes.length,
    ntfy_sent: ntfySent,
    dry_run: dryRun,
    dirty,
    initialized: true,
    checked_stores: STORES.length,
    reliable_stores: reliableStores,
    skipped_stores: skippedStores,
    mercado_libre: mercadoLibreResult,
    retailer_catalogs: retailerCatalogResult,
    retailer_scan_ran: retailerScanRan,
    zona_gamer: zonaGamerResult,
    social_ran: socialRan,
    discovery_ran: discoveryRan,
    discovered_new: discoveredNew,
    pending_availability_confirmations: Object.keys(state.pending_available || {}).length,
    stores: checks,
  };
}

// Además de runMonitor: usados por test-alerts.mjs y selftest.mjs.
export { runMonitor, sendTelegram, sendNtfy, falabellaResults, pcFactoryResults, isExternalSeller, detectRegion };
