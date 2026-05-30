// Pizzeria SacraFamiglia — ciclo di lavoro a fasi:
// telefonata -> comanda -> preparazione (1+ pizze) -> scontrino -> consegna

const CENTRO = 220;
const SUPPLEMENTO = 1.5; // per ogni ingrediente speciale richiesto

// Calibrazione della foto base.jpg (1178x1068): centro e raggio della pizza in px.
// La pizza non riempie tutta la foto, quindi la riposizioniamo perché riempia
// e sia centrata nel cerchio. Regolabili se si cambia immagine.
const BASE_IMG = { w: 1178, h: 1068, cx: 589, cy: 505, r: 472 };

const FORMATI = {
  normale: { nome: "Normale", raggio: 168, base: 5 },
  famiglia: { nome: "Famiglia 👨‍👩‍👧‍👦", raggio: 205, base: 9 },
};

const INGREDIENTI = [
  { id: "vuoto", nome: "Solo base (margherita)", colore: "transparent", speciale: false },
  { id: "mozzarella", nome: "Mozzarella", colore: "#f6edcf", speciale: false },
  { id: "prosciutto", nome: "Prosciutto", colore: "#dd8088", speciale: true },
  { id: "gorgonzola", nome: "Gorgonzola", colore: "#d8d2b6", speciale: true },
  { id: "salamino", nome: "Salamino piccante", colore: "#a8302a", speciale: true },
  { id: "bufala", nome: "Bufala", colore: "#fdfdfd", speciale: true },
  { id: "patatine", nome: "Patatine fritte", colore: "#edb84b", speciale: true },
  { id: "wurstel", nome: "Würstel", colore: "#d98c79", speciale: true },
];

// Stile "realistico" di ogni condimento sulla pizza:
//  - tinta: velo semitrasparente steso su tutto lo spicchio (es. formaggio fuso)
//  - densita: quanti pezzi per pizza intera (scalati in base alla fetta)
//  - pezzo: funzione che disegna UN pezzo (string SVG) data posizione/scala/rotazione
const STILE = {
  mozzarella: {
    tinta: "rgba(255,249,230,0.55)", densita: 16,
    pezzo: (x, y, s, rot) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${s}" ry="${s * 0.78}" fill="#fdf8e8" opacity="0.95"/><ellipse cx="${-s * 0.25}" cy="${-s * 0.22}" rx="${s * 0.4}" ry="${s * 0.28}" fill="#fffdf6" opacity="0.9"/></g>`,
  },
  prosciutto: {
    tinta: "rgba(221,128,136,0.18)", densita: 11,
    pezzo: (x, y, s, rot) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${s}" ry="${s * 0.52}" fill="#dd8088"/><path d="M ${-s * 0.85} 0 Q 0 ${-s * 0.3} ${s * 0.85} 0" stroke="#f3c3c8" stroke-width="${s * 0.2}" fill="none" stroke-linecap="round"/><path d="M ${-s * 0.7} ${s * 0.18} Q 0 ${-s * 0.05} ${s * 0.7} ${s * 0.18}" stroke="#c66d76" stroke-width="${s * 0.14}" fill="none" stroke-linecap="round"/></g>`,
  },
  gorgonzola: {
    tinta: "rgba(238,232,210,0.6)", densita: 13,
    pezzo: (x, y, s, rot, rng) => {
      let g = `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${s}" ry="${s * 0.82}" fill="#efe9d2"/>`;
      for (let k = 0; k < 3; k++) g += `<circle cx="${(rng() - 0.5) * s * 1.2}" cy="${(rng() - 0.5) * s * 1.2}" r="${s * (0.12 + rng() * 0.1)}" fill="${k % 2 ? "#46656b" : "#5d7f86"}"/>`;
      return g + `</g>`;
    },
  },
  salamino: {
    tinta: "rgba(168,48,40,0.06)", densita: 17,
    pezzo: (x, y, s, rot, rng) => {
      let g = `<g transform="translate(${x} ${y}) rotate(${rot})"><circle r="${s}" fill="#a8302a" stroke="#7c241c" stroke-width="${s * 0.12}"/>`;
      for (let k = 0; k < 4; k++) g += `<circle cx="${(rng() - 0.5) * s * 1.3}" cy="${(rng() - 0.5) * s * 1.3}" r="${s * 0.13}" fill="#e6c9b4"/>`;
      return g + `</g>`;
    },
  },
  bufala: {
    tinta: "rgba(255,255,255,0.14)", densita: 10,
    pezzo: (x, y, s, rot) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><circle r="${s}" fill="#fdfdfd" stroke="#d9e3e0" stroke-width="${s * 0.08}"/><ellipse cx="${-s * 0.3}" cy="${-s * 0.3}" rx="${s * 0.36}" ry="${s * 0.24}" fill="#ffffff" opacity="0.85"/></g>`,
  },
  patatine: {
    tinta: "", densita: 20,
    pezzo: (x, y, s, rot) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><rect x="${-s}" y="${-s * 0.2}" width="${s * 2}" height="${s * 0.4}" rx="${s * 0.2}" fill="#edb84b" stroke="#cf9a31" stroke-width="${s * 0.08}"/><rect x="${-s * 0.8}" y="${-s * 0.12}" width="${s * 1.6}" height="${s * 0.12}" rx="${s * 0.06}" fill="#f6cd6c"/></g>`,
  },
  wurstel: {
    tinta: "rgba(217,140,121,0.12)", densita: 14,
    pezzo: (x, y, s, rot) =>
      `<g transform="translate(${x} ${y}) rotate(${rot})"><ellipse rx="${s}" ry="${s * 0.7}" fill="#d98c79" stroke="#c2705c" stroke-width="${s * 0.1}"/><ellipse rx="${s * 0.62}" ry="${s * 0.42}" fill="#e7a594"/></g>`,
  },
};

const DIVISIONI = [2, 3, 4, 6, 8];

// Mazzo di ordini. Ogni ordine ha 1+ pizze; ogni comanda copre tutta la pizza.
const ORDINI = [
  {
    cliente: "Famiglia Esposito",
    telefonata: "Pronto, pizzeria? Sono la famiglia Esposito. Ci fa una pizza metà salamino piccante e metà bufala?",
    pizze: [
      { formato: "normale", comanda: [ { ing: "salamino", n: 1, d: 2 }, { ing: "bufala", n: 1, d: 2 } ] },
    ],
  },
  {
    cliente: "Famiglia De Luca",
    telefonata: "Buonasera, famiglia De Luca. Vorremmo due pizze: una normale con un quarto di würstel e il resto mozzarella, e una formato famiglia metà patatine fritte e metà prosciutto.",
    pizze: [
      { formato: "normale", comanda: [ { ing: "wurstel", n: 1, d: 4 }, { ing: "mozzarella", n: 3, d: 4 } ] },
      { formato: "famiglia", comanda: [ { ing: "patatine", n: 1, d: 2 }, { ing: "prosciutto", n: 1, d: 2 } ] },
    ],
  },
  {
    cliente: "Famiglia Sorrentino",
    telefonata: "Salve! Una pizza formato famiglia divisa in tre: un terzo gorgonzola, un terzo salamino e un terzo bufala.",
    pizze: [
      { formato: "famiglia", comanda: [ { ing: "gorgonzola", n: 1, d: 3 }, { ing: "salamino", n: 1, d: 3 }, { ing: "bufala", n: 1, d: 3 } ] },
    ],
  },
  {
    cliente: "Famiglia Ferraro",
    telefonata: "Buongiorno, sono i Ferraro. Due pizze normali: una metà prosciutto e metà mozzarella, l'altra un quarto di gorgonzola e tre quarti di salamino.",
    pizze: [
      { formato: "normale", comanda: [ { ing: "prosciutto", n: 1, d: 2 }, { ing: "mozzarella", n: 1, d: 2 } ] },
      { formato: "normale", comanda: [ { ing: "gorgonzola", n: 1, d: 4 }, { ing: "salamino", n: 3, d: 4 } ] },
    ],
  },
  {
    cliente: "Famiglia Greco",
    telefonata: "Pronto? Famiglia Greco. Una pizza con un quarto di würstel, un quarto di patatine fritte e metà mozzarella, grazie!",
    pizze: [
      { formato: "normale", comanda: [ { ing: "wurstel", n: 1, d: 4 }, { ing: "patatine", n: 1, d: 4 }, { ing: "mozzarella", n: 1, d: 2 } ] },
    ],
  },
  {
    cliente: "Famiglia Mancini",
    telefonata: "Salve, i Mancini. Una pizza famiglia con tre quarti di bufala e un quarto di salamino piccante.",
    pizze: [
      { formato: "famiglia", comanda: [ { ing: "bufala", n: 3, d: 4 }, { ing: "salamino", n: 1, d: 4 } ] },
    ],
  },
  {
    cliente: "Famiglia Caruso",
    telefonata: "Buonasera, Caruso. Due pizze: una normale metà gorgonzola e metà bufala, e una famiglia con un terzo di salamino e due terzi di mozzarella.",
    pizze: [
      { formato: "normale", comanda: [ { ing: "gorgonzola", n: 1, d: 2 }, { ing: "bufala", n: 1, d: 2 } ] },
      { formato: "famiglia", comanda: [ { ing: "salamino", n: 1, d: 3 }, { ing: "mozzarella", n: 2, d: 3 } ] },
    ],
  },
];

// Tavolate del Livello 2. Ogni gruppo: tot. persone, genere, gusto e misura della fetta.
const TAVOLI = [
  {
    nome: "Tavolo dei più piccoli",
    gruppi: [
      { persone: 8, gen: "ragazzi", ing: "mozzarella", n: 1, d: 4 },
      { persone: 4, gen: "ragazze", ing: "salamino", n: 1, d: 4 },
    ],
  }, // 2 + 1 = 3 pizze esatte
  {
    nome: "Tavolo della 1ª B",
    gruppi: [
      { persone: 5, gen: "ragazzi", ing: "mozzarella", n: 1, d: 4 },
      { persone: 5, gen: "ragazze", ing: "bufala", n: 1, d: 4 },
    ],
  }, // 10/4 = 2 e 1/2 -> 3 pizze, avanza 1/2
  {
    nome: "Tavolo degli amici",
    gruppi: [
      { persone: 2, gen: "ragazzi", ing: "prosciutto", n: 1, d: 2 },
      { persone: 4, gen: "ragazze", ing: "mozzarella", n: 1, d: 4 },
    ],
  }, // 1 + 1 = 2 pizze, tagli misti 1/2 e 1/4
  {
    nome: "Tavolo della gita",
    gruppi: [
      { persone: 3, gen: "ragazze", ing: "bufala", n: 1, d: 3 },
      { persone: 2, gen: "ragazzi", ing: "mozzarella", n: 1, d: 2 },
    ],
  }, // 1 + 1 = 2 pizze, tagli misti 1/3 e 1/2
];

// ---- Stato ----
let modalita = "telefonata"; // "telefonata" (Livello 1) | "tavolo" (Livello 2)
let ordineCorrente = null;
let indicePizza = 0;
let raggioCorrente = FORMATI.normale.raggio;
let nSpicchi = 4;
let ingredienteAttivo = "prosciutto";
let stato = [];
let cassa = caricaCassa();

// Stato del Livello 2 (servizio al tavolo)
let tavoloCorrente = null;
let bisogniTav = null;
let pizzeTavolo = [];     // [{ nSpicchi, stato:[...] }] per ogni pizza da preparare
let idxPizzaTavolo = 0;
let nPizzeTavolo = 0;

// ---- Utility ----
function el(id) { return document.getElementById(id); }
function mcd(a, b) { return b === 0 ? a : mcd(b, a % b); }
function semplifica(n, d) { const g = mcd(n, d) || 1; return [n / g, d / g]; }
function fraz(n, d) { const [a, b] = semplifica(n, d); return b === 1 ? `${a}` : `${a}/${b}`; }
function sommaFraz(a, b) { return semplifica(a[0] * b[1] + b[0] * a[1], a[1] * b[1]); }
// Numero misto: 5/2 -> "2 e 1/2", 3/1 -> "3", 1/2 -> "1/2", 0 -> "0".
function frazMista(n, d) {
  const [sn, sd] = semplifica(n, d);
  if (sn === 0) return "0";
  if (sd === 1) return `${sn}`;
  const intero = Math.floor(sn / sd);
  const resto = sn - intero * sd;
  if (intero === 0) return `${resto}/${sd}`;
  return `${intero} e ${resto}/${sd}`;
}
function euro(v) { return "€ " + v.toFixed(2).replace(".", ","); }
function info(id) { return INGREDIENTI.find((i) => i.id === id) || {}; }
function coloreDi(id) { return info(id).colore || "transparent"; }
function nomeDi(id) { return info(id).nome || id; }

function swatch(id) {
  return `<svg class="swatch" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${coloreDi(id)}" stroke="rgba(0,0,0,0.2)" /></svg>`;
}

// ---- Frazione "parlata" in italiano corretto (un quarto, tre quarti, metà...) ----
const ORDINALI = {
  2: ["mezzo", "mezzi"], 3: ["terzo", "terzi"], 4: ["quarto", "quarti"],
  5: ["quinto", "quinti"], 6: ["sesto", "sesti"], 7: ["settimo", "settimi"],
  8: ["ottavo", "ottavi"], 9: ["nono", "noni"], 10: ["decimo", "decimi"],
};
const CARDINALI = { 1: "un", 2: "due", 3: "tre", 4: "quattro", 5: "cinque", 6: "sei", 7: "sette", 8: "otto", 9: "nove", 10: "dieci" };
function frazParlata(n, d) {
  [n, d] = semplifica(n, d);
  if (d === 1) return n === 1 ? "una pizza intera" : `${CARDINALI[n] || n} pizze`;
  if (n === 1 && d === 2) return "metà";
  const o = ORDINALI[d];
  if (!o) return `${n} fratto ${d}`;
  const num = CARDINALI[n] || String(n);
  return `${num} ${n === 1 ? o[0] : o[1]}`;
}

function mostraFase(nome) {
  document.querySelectorAll(".fase").forEach((f) => f.classList.add("nascosta"));
  el("fase-" + nome).classList.remove("nascosta");
}

// ---- Cassa (localStorage) ----
function caricaCassa() {
  try { return JSON.parse(localStorage.getItem("cassa")) || { pizze: 0, incasso: 0 }; }
  catch { return { pizze: 0, incasso: 0 }; }
}
function salvaCassa() {
  localStorage.setItem("cassa", JSON.stringify(cassa));
  aggiornaCassa();
}
function aggiornaCassa() {
  el("cassa-pizze").textContent = cassa.pizze;
  el("cassa-incasso").textContent = euro(cassa.incasso);
}

// ---- Prezzi ----
function prezzoPizza(p) {
  const speciali = new Set(p.comanda.filter((r) => info(r.ing).speciale).map((r) => r.ing));
  return FORMATI[p.formato].base + speciali.size * SUPPLEMENTO;
}
function prezzoOrdine(o) { return o.pizze.reduce((s, p) => s + prezzoPizza(p), 0); }

// ====================================================================
// FASE 1: TELEFONATA
// ====================================================================
function nuovaTelefonata() {
  modalita = "telefonata";
  ordineCorrente = ORDINI[Math.floor(Math.random() * ORDINI.length)];
  indicePizza = 0;
  mostraFase("telefonata");
  Suoni.ring();
}

// ====================================================================
// FASE 2: COMANDA (tutte le pizze dell'ordine)
// ====================================================================
function mostraComanda() {
  Suoni.stopRing();
  Suoni.sblocca();
  el("fumetto-cliente").innerHTML =
    `<span class="chi">📞 ${ordineCorrente.cliente}</span>${ordineCorrente.telefonata}`;
  el("comanda-foglio").innerHTML = renderComandaCompleta(ordineCorrente);
  mostraFase("comanda");
  // Legge la telefonata a voce.
  Suoni.parla(ordineCorrente.telefonata);
}

function righeComanda(p) {
  return p.comanda
    .map((r) => `<li>${swatch(r.ing)}<span>${nomeDi(r.ing)}</span><span class="frazione">${fraz(r.n, r.d)}</span></li>`)
    .join("");
}

function renderComandaCompleta(ordine) {
  const tante = ordine.pizze.length > 1;
  const blocchi = ordine.pizze
    .map((p, i) => {
      const titolo = tante ? `Pizza ${i + 1} — ${FORMATI[p.formato].nome}` : FORMATI[p.formato].nome;
      return `<div class="pizza-blocco"><div class="pizza-titolo">🍕 ${titolo}</div><ul>${righeComanda(p)}</ul></div>`;
    })
    .join("");
  return `<div class="comanda-intestazione">🧾 Comanda — ${ordine.cliente}</div>${blocchi}`;
}

function renderComandaPizza(ordine, i) {
  const p = ordine.pizze[i];
  const tante = ordine.pizze.length > 1;
  const indic = tante ? `Pizza ${i + 1} di ${ordine.pizze.length} — ` : "";
  return `<div class="comanda-intestazione">🧾 ${indic}${FORMATI[p.formato].nome}</div><ul>${righeComanda(p)}</ul>`;
}

// ====================================================================
// FASE 3: PREPARAZIONE
// ====================================================================
function punto(g) {
  const rad = ((g - 90) * Math.PI) / 180;
  return { x: CENTRO + raggioCorrente * Math.cos(rad), y: CENTRO + raggioCorrente * Math.sin(rad) };
}
function pathSpicchio(a, b) {
  const p1 = punto(a), p2 = punto(b);
  const grande = b - a > 180 ? 1 : 0;
  return `M ${CENTRO} ${CENTRO} L ${p1.x} ${p1.y} A ${raggioCorrente} ${raggioCorrente} 0 ${grande} 1 ${p2.x} ${p2.y} Z`;
}

// Generatore pseudo-casuale deterministico (mulberry32): stessi pezzi a ogni ridisegno.
function rng32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function semeIngrediente(id, i) {
  let s = (i + 1) * 131 + nSpicchi * 17;
  for (const c of id) s += c.charCodeAt(0);
  return s;
}
// Un punto pseudo-casuale dentro lo spicchio (con margine dai bordi).
function puntoInSpicchio(rng, a, b) {
  const ang = a + (0.14 + 0.72 * rng()) * (b - a);
  const rad = (0.18 + 0.74 * Math.sqrt(rng())) * raggioCorrente;
  const r = ((ang - 90) * Math.PI) / 180;
  return { x: CENTRO + rad * Math.cos(r), y: CENTRO + rad * Math.sin(r) };
}
// Disegna i pezzi sparsi di un condimento dentro uno spicchio (string SVG).
function pezziSpicchio(id, i, a, b) {
  const st = STILE[id];
  if (!st) return "";
  const rng = rng32(semeIngrediente(id, i));
  const n = Math.max(2, Math.round((st.densita * (b - a)) / 360));
  let out = "";
  for (let k = 0; k < n; k++) {
    const p = puntoInSpicchio(rng, a, b);
    const s = raggioCorrente * (0.085 + rng() * 0.05);
    const rot = rng() * 360;
    out += st.pezzo(p.x.toFixed(1), p.y.toFixed(1), s.toFixed(1), rot.toFixed(0), rng);
  }
  return out;
}

function iniziaPreparazione() {
  indicePizza = 0;
  preparaPizzaCorrente();
}

function preparaPizzaCorrente() {
  const p = ordineCorrente.pizze[indicePizza];
  raggioCorrente = FORMATI[p.formato].raggio;
  nSpicchi = 4;
  stato = new Array(nSpicchi).fill("vuoto");

  const tante = ordineCorrente.pizze.length > 1;
  el("intestazione-prep").textContent = tante
    ? `Stai preparando la pizza ${indicePizza + 1} di ${ordineCorrente.pizze.length} — formato ${FORMATI[p.formato].nome}`
    : `Formato ${FORMATI[p.formato].nome}`;

  el("comanda-appesa").innerHTML = renderComandaPizza(ordineCorrente, indicePizza);
  el("nav-pizze").classList.add("nascosta");
  el("btn-verifica").textContent = "Pizza pronta! 🔔";
  creaBottoniDivisori();
  creaBottoniIngredienti();
  disegnaPizza();
  mostraFase("preparazione");
}

function disegnaPizza() {
  const gBase = el("base"), gS = el("spicchi"), gT = el("tagli");
  const R = raggioCorrente;
  // Base = foto reale (base.jpg) ritagliata a cerchio. Scaliamo e centriamo
  // sul centro reale della pizza, così riempie il cerchio ed è centrata.
  const f = R / BASE_IMG.r;
  const iw = (BASE_IMG.w * f).toFixed(1), ih = (BASE_IMG.h * f).toFixed(1);
  const ix = (CENTRO - BASE_IMG.cx * f).toFixed(1), iy = (CENTRO - BASE_IMG.cy * f).toFixed(1);
  gBase.innerHTML =
    `<circle cx="${CENTRO}" cy="${CENTRO}" r="${R + 4}" fill="#c98b3b" />` +
    `<clipPath id="clip-base"><circle cx="${CENTRO}" cy="${CENTRO}" r="${R}" /></clipPath>` +
    `<image href="base.jpg" x="${ix}" y="${iy}" width="${iw}" height="${ih}" ` +
    `preserveAspectRatio="none" clip-path="url(#clip-base)" />`;

  // Spicchi: per ognuno un'area cliccabile + il velo e i pezzi del condimento.
  const passo = 360 / nSpicchi;
  let html = "";
  for (let i = 0; i < nSpicchi; i++) {
    const a = i * passo, b = (i + 1) * passo;
    const d = pathSpicchio(a, b);
    const id = stato[i];
    html += `<g class="spicchio" data-i="${i}">`;
    html += `<path d="${d}" fill="transparent" pointer-events="all" />`;
    if (id !== "vuoto") {
      const st = STILE[id];
      if (st && st.tinta) html += `<path d="${d}" fill="${st.tinta}" pointer-events="none" />`;
      html += `<clipPath id="clip-sp-${i}"><path d="${d}" /></clipPath>`;
      html += `<g clip-path="url(#clip-sp-${i})" pointer-events="none">${pezziSpicchio(id, i, a, b)}</g>`;
    }
    html += `</g>`;
  }
  gS.innerHTML = html;
  gS.querySelectorAll(".spicchio").forEach((g) => {
    const i = +g.dataset.i;
    g.addEventListener("click", () => {
      stato[i] = stato[i] === ingredienteAttivo ? "vuoto" : ingredienteAttivo;
      Suoni.click();
      disegnaPizza();
    });
  });

  // Linee di taglio sopra tutto: alone scuro + tratto chiaro, ben visibili sulla foto.
  let halo = "", linee = "";
  for (let i = 0; i < nSpicchi; i++) {
    const pt = punto(i * passo);
    const coord = `x1="${CENTRO}" y1="${CENTRO}" x2="${pt.x.toFixed(1)}" y2="${pt.y.toFixed(1)}"`;
    halo += `<line ${coord} class="linea-taglio-alone" />`;
    linee += `<line ${coord} class="linea-taglio" />`;
  }
  gT.innerHTML = halo + linee;

  aggiornaRiepilogo();
  if (modalita === "tavolo") aggiornaTallyTavolo();
}

function contaIngredienti() {
  const c = {};
  stato.forEach((id) => { c[id] = (c[id] || 0) + 1; });
  return c;
}

function aggiornaRiepilogo() {
  const c = contaIngredienti();
  const ul = el("riepilogo");
  ul.innerHTML = "";
  Object.keys(c).filter((id) => id !== "vuoto").forEach((id) => {
    const li = document.createElement("li");
    li.innerHTML = `${swatch(id)}<span>${nomeDi(id)}</span><span class="frazione">${fraz(c[id], nSpicchi)}</span>`;
    ul.appendChild(li);
  });
  if (!ul.children.length) ul.innerHTML = '<li class="vuota">Pizza ancora vuota.</li>';
}

function creaBottoniDivisori() {
  const cont = el("divisori"); cont.innerHTML = "";
  DIVISIONI.forEach((n) => {
    const b = document.createElement("button");
    b.textContent = `${n} parti`;
    b.classList.toggle("attivo", n === nSpicchi);
    b.addEventListener("click", () => {
      nSpicchi = n;
      stato = new Array(n).fill("vuoto");
      Suoni.taglio();
      [...cont.children].forEach((c) => c.classList.remove("attivo"));
      b.classList.add("attivo");
      disegnaPizza();
    });
    cont.appendChild(b);
  });
}

function creaBottoniIngredienti() {
  const cont = el("ingredienti"); cont.innerHTML = "";
  INGREDIENTI.filter((i) => i.id !== "vuoto").forEach((ing) => {
    const b = document.createElement("button");
    b.innerHTML = `${swatch(ing.id)}${ing.nome}`;
    b.classList.toggle("attivo", ing.id === ingredienteAttivo);
    b.addEventListener("click", () => {
      ingredienteAttivo = ing.id;
      [...cont.children].forEach((c) => c.classList.remove("attivo"));
      b.classList.add("attivo");
    });
    cont.appendChild(b);
  });
}

// ====================================================================
// FASE 4: VERIFICA
// ====================================================================
function controlla(p) {
  const c = contaIngredienti();
  const problemi = [];
  p.comanda.forEach((r) => {
    const messi = c[r.ing] || 0;
    const [an, ad] = semplifica(messi, nSpicchi);
    const [bn, bd] = semplifica(r.n, r.d);
    if (an !== bn || ad !== bd) {
      problemi.push(`Il cliente voleva ${fraz(r.n, r.d)} di ${nomeDi(r.ing).toLowerCase()}, tu ne hai messo ${fraz(messi, nSpicchi)}.`);
    }
  });
  const richiesti = new Set(p.comanda.map((r) => r.ing));
  Object.keys(c).forEach((id) => {
    if (id !== "vuoto" && !richiesti.has(id)) {
      problemi.push(`Hai messo ${nomeDi(id).toLowerCase()}, ma non era nell'ordine.`);
    }
  });
  if ((c["vuoto"] || 0) > 0) {
    problemi.push(`Hai lasciato ${fraz(c["vuoto"], nSpicchi)} di pizza senza condimento.`);
  }
  return problemi;
}

function verificaPizza() {
  const p = ordineCorrente.pizze[indicePizza];
  const problemi = controlla(p);
  if (problemi.length) { Suoni.errore(); mostraErrore(problemi); return; }
  Suoni.successo();
  if (indicePizza < ordineCorrente.pizze.length - 1) mostraPizzaPronta();
  else mostraScontrino();
}

function mostraErrore(problemi) {
  el("scontrino").classList.add("nascosta");
  el("esito").className = "esito ko";
  el("esito").innerHTML = "❌ Non corrisponde alla comanda:<ul>" +
    problemi.map((p) => `<li>${p}</li>`).join("") + "</ul>";
  const bottoni = el("bottoni-esito"); bottoni.innerHTML = "";
  const b = document.createElement("button");
  b.className = "azione secondaria";
  b.textContent = "Torna al banco 👨‍🍳";
  b.addEventListener("click", () => mostraFase("preparazione"));
  bottoni.appendChild(b);
  mostraFase("scontrino");
}

function mostraPizzaPronta() {
  el("scontrino").classList.add("nascosta");
  el("esito").className = "esito ok";
  el("esito").innerHTML = `✅ Pizza ${indicePizza + 1} pronta! Manca ancora qualcosa per la famiglia.`;
  const bottoni = el("bottoni-esito"); bottoni.innerHTML = "";
  const b = document.createElement("button");
  b.className = "azione";
  b.textContent = "Prepara la prossima pizza →";
  b.addEventListener("click", () => { indicePizza += 1; preparaPizzaCorrente(); });
  bottoni.appendChild(b);
  mostraFase("scontrino");
}

function mostraScontrino() {
  const totale = prezzoOrdine(ordineCorrente);
  el("esito").className = "esito ok";
  el("esito").innerHTML = "✅ Ordine completo! Batti lo scontrino.";
  el("scontrino").classList.remove("nascosta");
  el("scontrino").innerHTML = renderScontrino(ordineCorrente);
  const bottoni = el("bottoni-esito"); bottoni.innerHTML = "";
  const b = document.createElement("button");
  b.className = "azione";
  b.textContent = "Consegna l'ordine 🛵";
  b.addEventListener("click", () => consegna(totale));
  bottoni.appendChild(b);
  mostraFase("scontrino");
}

function renderScontrino(ordine) {
  const blocchi = ordine.pizze
    .map((p, i) => {
      const desc = p.comanda
        .map((r) => `<div class="riga-sc"><span>${fraz(r.n, r.d)} ${nomeDi(r.ing).toLowerCase()}</span></div>`)
        .join("");
      return `<div class="sc-pizza">Pizza ${i + 1} — ${FORMATI[p.formato].nome}</div>${desc}` +
        `<div class="riga-sc"><span>subtotale</span><span>${euro(prezzoPizza(p))}</span></div>`;
    })
    .join("<hr />");
  return `<div class="sc-testata">PIZZERIA SACRAFAMIGLIA</div>` +
    `<div class="sc-sub">Cliente: ${ordine.cliente}</div><hr />${blocchi}<hr />` +
    `<div class="riga-sc totale"><span>TOTALE</span><span>${euro(prezzoOrdine(ordine))}</span></div>` +
    `<div class="sc-grazie">Grazie e arrivederci!</div>`;
}

// ====================================================================
// FASE 5: CONSEGNA
// ====================================================================
function consegna(totale) {
  cassa.pizze += ordineCorrente.pizze.length;
  cassa.incasso += totale;
  salvaCassa();
  Suoni.cassa();
  nuovaTelefonata();
}

// ====================================================================
// LIVELLO 2 — SERVIZIO AL TAVOLO
// ====================================================================

// Calcola i fabbisogni del tavolo: quanta pizza per gusto, totale, pizze da
// infornare (arrotondato per eccesso) e avanzo.
function bisogniTavolo(t) {
  const perIng = {};
  let tot = [0, 1];
  t.gruppi.forEach((g) => {
    const f = [g.persone * g.n, g.d];
    perIng[g.ing] = perIng[g.ing] ? sommaFraz(perIng[g.ing], f) : semplifica(f[0], f[1]);
    tot = sommaFraz(tot, f);
  });
  const [N, D] = tot;
  const nPizze = Math.ceil(N / D);
  const leftover = semplifica(nPizze * D - N, D);
  return { perIng, tot: [N, D], nPizze, floor: Math.floor(N / D), leftover };
}

// Quanto ha effettivamente messo lo studente, per gusto, su tutte le pizze.
function prodottoTavolo() {
  const perIng = {};
  pizzeTavolo.forEach((pz) => {
    const c = {};
    pz.stato.forEach((id) => { if (id !== "vuoto") c[id] = (c[id] || 0) + 1; });
    Object.keys(c).forEach((id) => {
      const f = [c[id], pz.nSpicchi];
      perIng[id] = perIng[id] ? sommaFraz(perIng[id], f) : semplifica(f[0], f[1]);
    });
  });
  return perIng;
}

function righeTavolo(t) {
  return t.gruppi
    .map((g) => {
      const faccia = g.gen === "ragazze" ? "👧" : "👦";
      return `<li>${swatch(g.ing)}<span>${g.persone} ${faccia} ${g.gen} — una fetta da <strong>${fraz(g.n, g.d)}</strong> di ${nomeDi(g.ing).toLowerCase()}</span></li>`;
    })
    .join("");
}
function renderTavoloRiepilogo(t) {
  return `<div class="comanda-intestazione">🍽️ ${t.nome}</div><ul>${righeTavolo(t)}</ul>`;
}

function nuovoTavolo() {
  modalita = "tavolo";
  tavoloCorrente = TAVOLI[Math.floor(Math.random() * TAVOLI.length)];
  bisogniTav = bisogniTavolo(tavoloCorrente);
  mostraTavolo();
}

function frasiTavolo() {
  return "Ecco l'ordine del " + tavoloCorrente.nome + ". " +
    tavoloCorrente.gruppi
      .map((g) => `${g.persone} ${g.gen}, una fetta da ${frazParlata(g.n, g.d)} di ${nomeDi(g.ing).toLowerCase()}`)
      .join("; ") + ".";
}

function mostraTavolo() {
  el("fumetto-cameriere").innerHTML =
    `<span class="chi">🧑‍🍳 Il cameriere</span>Ecco l'ordine del <strong>${tavoloCorrente.nome}</strong>! Quante pizze prepari e come le tagli?`;
  el("tavolo-foglio").innerHTML = renderTavoloRiepilogo(tavoloCorrente);
  mostraFase("tavolo");
  Suoni.parla(frasiTavolo());
}

// ---- Fase calcolo: domande a scelta multipla ----
function mescola(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function domandaPizze(nPizze, floor) {
  const cand = [nPizze, floor, nPizze + 1, nPizze - 1, nPizze + 2];
  const visti = new Set();
  const opzioni = [];
  cand.forEach((x) => {
    if (x > 0 && !visti.has(x) && opzioni.length < 4) {
      visti.add(x);
      opzioni.push({ label: x === 1 ? "1 pizza" : `${x} pizze`, giusta: x === nPizze });
    }
  });
  return { testo: "Quante pizze intere devi infornare?", opzioni: mescola(opzioni) };
}

function domandaFraz(testo, corretta) {
  const [n, d] = semplifica(corretta[0], corretta[1]);
  const cand = [[n, d], semplifica(n + d, d)];
  if (n - d > 0) cand.push(semplifica(n - d, d));
  if (d > 1) cand.push(semplifica(n + 1, d));
  if (d > 1 && n - 1 > 0) cand.push(semplifica(n - 1, d));
  const visti = new Set();
  const opzioni = [];
  cand.forEach((c) => {
    const k = c[0] + "/" + c[1];
    if (!visti.has(k) && opzioni.length < 4) {
      visti.add(k);
      opzioni.push({ label: frazMista(c[0], c[1]), giusta: c[0] === n && c[1] === d });
    }
  });
  return { testo, opzioni: mescola(opzioni) };
}

function mostraCalcolo() {
  Suoni.zittisci();
  const b = bisogniTav;
  const domande = [
    domandaFraz("Quanta pizza serve in tutto? (conta in pizze, anche con la frazione)", b.tot),
    domandaPizze(b.nPizze, b.floor),
  ];
  if (b.leftover[0] > 0) domande.push(domandaFraz("Quanta pizza avanza?", b.leftover));
  renderCalcolo(domande);
  mostraFase("calcolo");
}

function renderCalcolo(domande) {
  el("calcolo-tavolo").innerHTML = renderTavoloRiepilogo(tavoloCorrente);
  const cont = el("calcolo-domande");
  cont.innerHTML = "";
  el("btn-prepara-tavolo").classList.add("nascosta");
  let risolte = 0;
  const totale = domande.length;
  domande.forEach((dq, qi) => {
    const div = document.createElement("div");
    div.className = "domanda";
    const h = document.createElement("p");
    h.className = "domanda-testo";
    h.textContent = `${qi + 1}. ${dq.testo}`;
    div.appendChild(h);
    const opts = document.createElement("div");
    opts.className = "bottoni";
    let fatta = false;
    dq.opzioni.forEach((op) => {
      const bo = document.createElement("button");
      bo.textContent = op.label;
      bo.addEventListener("click", () => {
        if (fatta) return;
        if (op.giusta) {
          fatta = true;
          risolte++;
          bo.classList.add("giusta");
          Suoni.successo();
          [...opts.children].forEach((c) => (c.disabled = true));
          if (risolte === totale) el("btn-prepara-tavolo").classList.remove("nascosta");
        } else {
          bo.classList.add("sbagliata");
          bo.disabled = true;
          Suoni.errore();
        }
      });
      opts.appendChild(bo);
    });
    div.appendChild(opts);
    cont.appendChild(div);
  });
}

// ---- Fase preparazione (più pizze, navigabili) ----
function iniziaPreparazioneTavolo() {
  Suoni.zittisci();
  nPizzeTavolo = bisogniTav.nPizze;
  pizzeTavolo = Array.from({ length: nPizzeTavolo }, () => ({ nSpicchi: 4, stato: new Array(4).fill("vuoto") }));
  idxPizzaTavolo = 0;
  raggioCorrente = FORMATI.normale.raggio;
  nSpicchi = 4;
  stato = new Array(4).fill("vuoto");
  el("intestazione-prep").textContent = `Servizio al tavolo — prepara ${nPizzeTavolo} pizze e distribuisci i condimenti`;
  el("btn-verifica").textContent = "Servi il tavolo! 🔔";
  creaBottoniDivisori();
  creaBottoniIngredienti();
  renderNavTavolo();
  disegnaPizza(); // disegna e aggiorna il tally
  mostraFase("preparazione");
}

function caricaPizzaTavolo(i) {
  pizzeTavolo[idxPizzaTavolo] = { nSpicchi, stato: [...stato] }; // salva la corrente
  idxPizzaTavolo = i;
  nSpicchi = pizzeTavolo[i].nSpicchi;
  stato = [...pizzeTavolo[i].stato];
  creaBottoniDivisori();
  renderNavTavolo();
  disegnaPizza();
}

function renderNavTavolo() {
  const nav = el("nav-pizze");
  nav.classList.remove("nascosta");
  let html = `<div class="nav-pizze-tit">Pizze da preparare (${nPizzeTavolo}) — clicca per spostarti:</div><div class="nav-pizze-bottoni">`;
  for (let i = 0; i < nPizzeTavolo; i++) {
    html += `<button class="${i === idxPizzaTavolo ? "attivo" : ""}" data-i="${i}">Pizza ${i + 1}</button>`;
  }
  html += `</div>`;
  nav.innerHTML = html;
  nav.querySelectorAll("button[data-i]").forEach((b) => {
    b.addEventListener("click", () => caricaPizzaTavolo(parseInt(b.dataset.i, 10)));
  });
}

// Riepilogo "messo / da mettere" per ogni gusto del tavolo.
function aggiornaTallyTavolo() {
  pizzeTavolo[idxPizzaTavolo] = { nSpicchi, stato: [...stato] };
  const prod = prodottoTavolo();
  const righe = Object.keys(bisogniTav.perIng)
    .map((id) => {
      const req = bisogniTav.perIng[id];
      const got = prod[id] || [0, 1];
      const ok = got[0] === req[0] && got[1] === req[1];
      return `<li>${swatch(id)}<span>${nomeDi(id)}</span><span class="frazione">${frazMista(got[0], got[1])} / ${frazMista(req[0], req[1])} ${ok ? "✅" : ""}</span></li>`;
    })
    .join("");
  el("comanda-appesa").innerHTML =
    `<div class="comanda-intestazione">🍽️ ${tavoloCorrente.nome} — l'ordine</div>` +
    `<ul>${righeTavolo(tavoloCorrente)}</ul>` +
    `<div class="tally-sep">Avanzamento — messo / da mettere</div>` +
    `<ul class="tally-lista">${righe}</ul>` +
    `<p class="aiuto">Conteggio in pizze, su tutte le pizze del tavolo.</p>`;
}

// ---- Verifica del tavolo ----
function verificaTavolo() {
  pizzeTavolo[idxPizzaTavolo] = { nSpicchi, stato: [...stato] };
  const prod = prodottoTavolo();
  const problemi = [];
  Object.keys(bisogniTav.perIng).forEach((id) => {
    const req = bisogniTav.perIng[id];
    const got = prod[id] || [0, 1];
    if (got[0] !== req[0] || got[1] !== req[1]) {
      problemi.push(`Serve ${frazMista(req[0], req[1])} di ${nomeDi(id).toLowerCase()} in tutto, tu ne hai messo ${frazMista(got[0], got[1])}.`);
    }
  });
  Object.keys(prod).forEach((id) => {
    if (!bisogniTav.perIng[id]) {
      problemi.push(`Hai messo ${nomeDi(id).toLowerCase()}, ma nessuno al tavolo l'ha chiesto.`);
    }
  });
  if (problemi.length) { Suoni.errore(); mostraErroreTavolo(problemi); return; }
  Suoni.successo();
  mostraScontrinoTavolo();
}

function mostraErroreTavolo(problemi) {
  el("scontrino").classList.add("nascosta");
  el("esito").className = "esito ko";
  el("esito").innerHTML = "❌ Il tavolo non è servito bene:<ul>" +
    problemi.map((p) => `<li>${p}</li>`).join("") + "</ul>";
  const bottoni = el("bottoni-esito");
  bottoni.innerHTML = "";
  const b = document.createElement("button");
  b.className = "azione secondaria";
  b.textContent = "Torna al banco 👨‍🍳";
  b.addEventListener("click", () => mostraFase("preparazione"));
  bottoni.appendChild(b);
  mostraFase("scontrino");
}

function prezzoTavolo() {
  return pizzeTavolo.reduce((s, pz) => {
    const speciali = new Set(pz.stato.filter((id) => id !== "vuoto" && info(id).speciale));
    return s + FORMATI.normale.base + speciali.size * SUPPLEMENTO;
  }, 0);
}

function renderScontrinoTavolo() {
  const blocchi = pizzeTavolo
    .map((pz, i) => {
      const c = {};
      pz.stato.forEach((id) => { if (id !== "vuoto") c[id] = (c[id] || 0) + 1; });
      const desc = Object.keys(c).length
        ? Object.keys(c).map((id) => `<div class="riga-sc"><span>${fraz(c[id], pz.nSpicchi)} ${nomeDi(id).toLowerCase()}</span></div>`).join("")
        : `<div class="riga-sc"><span>(margherita)</span></div>`;
      const speciali = new Set(Object.keys(c).filter((id) => info(id).speciale));
      const prezzo = FORMATI.normale.base + speciali.size * SUPPLEMENTO;
      return `<div class="sc-pizza">Pizza ${i + 1}</div>${desc}<div class="riga-sc"><span>subtotale</span><span>${euro(prezzo)}</span></div>`;
    })
    .join("<hr />");
  return `<div class="sc-testata">PIZZERIA SACRAFAMIGLIA</div>` +
    `<div class="sc-sub">${tavoloCorrente.nome}</div><hr />${blocchi}<hr />` +
    `<div class="riga-sc totale"><span>TOTALE</span><span>${euro(prezzoTavolo())}</span></div>` +
    `<div class="sc-grazie">Buon appetito!</div>`;
}

function mostraScontrinoTavolo() {
  const ragazzi = tavoloCorrente.gruppi.reduce((s, g) => s + g.persone, 0);
  el("esito").className = "esito ok";
  el("esito").innerHTML = `✅ Tavolo servito! Hai accontentato ${ragazzi} ragazzi. Batti lo scontrino.`;
  el("scontrino").classList.remove("nascosta");
  el("scontrino").innerHTML = renderScontrinoTavolo();
  const bottoni = el("bottoni-esito");
  bottoni.innerHTML = "";
  const b = document.createElement("button");
  b.className = "azione";
  b.textContent = "Servi il tavolo 🍽️";
  b.addEventListener("click", consegnaTavolo);
  bottoni.appendChild(b);
  mostraFase("scontrino");
}

function consegnaTavolo() {
  cassa.pizze += nPizzeTavolo;
  cassa.incasso += prezzoTavolo();
  salvaCassa();
  Suoni.cassa();
  nuovoTavolo();
}

// ====================================================================
// HOME + INTRO (foto della pizzeria -> video di benvenuto)
// ====================================================================

function avviaGioco() {
  Suoni.sblocca();
  aggiornaCassa();
  nuovaTelefonata();
}

// Dissolvenza generica per gli schermi a tutto schermo (home, intro, stacco).
function dissolvi(id) {
  const e = el(id);
  e.classList.add("via");
  setTimeout(() => e.classList.add("nascosta"), 600);
}

// Mostra lo schermo di stacco prima di iniziare a prendere le telefonate.
function mostraStacco() {
  el("stacco").classList.remove("nascosta", "via");
}

function chiudiIntro() {
  const intro = el("intro");
  if (intro.classList.contains("via")) return; // già chiusa
  const v = el("intro-video");
  try { v.pause(); } catch (e) {}
  dissolvi("intro");
  mostraStacco();
}

// Mostra il video e prova a riprodurlo; se fallisce, entra subito nel gioco.
function avviaVideoIntro() {
  const intro = el("intro");
  const v = el("intro-video");
  intro.classList.remove("nascosta");
  el("btn-salta").classList.remove("nascosta");
  v.muted = false;
  v.play().catch(() => chiudiIntro()); // se non parte, entra subito nel gioco
}

function gestisciIntro() {
  const v = el("intro-video");

  // "Entra nella pizzeria": chiude la home e fa partire il video.
  el("btn-entra").addEventListener("click", () => {
    Suoni.sblocca(); // sblocca l'audio col primo gesto dell'utente
    dissolvi("home");
    avviaVideoIntro();
  });

  // "Salta l'introduzione": salta il video e passa allo stacco.
  el("btn-salta-intro").addEventListener("click", () => {
    Suoni.sblocca();
    dissolvi("home");
    mostraStacco();
  });

  el("btn-salta").addEventListener("click", chiudiIntro);
  v.addEventListener("ended", chiudiIntro);

  // Livello 1 — Pizze al telefono: chiude lo stacco e parte la prima telefonata.
  el("btn-livello1").addEventListener("click", () => {
    Suoni.sblocca();
    dissolvi("stacco");
    avviaGioco();
  });

  // Livello 2 — Servizio al tavolo: chiude lo stacco e arriva il primo tavolo.
  el("btn-livello2").addEventListener("click", () => {
    Suoni.sblocca();
    aggiornaCassa();
    dissolvi("stacco");
    nuovoTavolo();
  });
}

// ---- Musica di sottofondo via player YouTube nascosto ----
const YT_VIDEO_ID = "Q-wM5Ch8JM8";
let ytPlayer = null;
let ytPronto = false;
let musicaAccesa = false;

// Carica l'API IFrame di YouTube (una sola volta).
function caricaYouTube() {
  if (window.YT && window.YT.Player) { creaPlayerYT(); return; }
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

// YouTube chiama questa funzione globale quando l'API è pronta.
window.onYouTubeIframeAPIReady = function () {
  creaPlayerYT();
};

function creaPlayerYT() {
  if (ytPlayer) return;
  ytPlayer = new YT.Player("yt-musica", {
    videoId: YT_VIDEO_ID,
    playerVars: {
      autoplay: 0,
      controls: 0,
      loop: 1,
      playlist: YT_VIDEO_ID, // necessario per il loop di un singolo video
      modestbranding: 1,
    },
    events: {
      onReady: () => {
        ytPronto = true;
        if (musicaAccesa && ytPlayer) ytPlayer.playVideo(); // l'utente aveva già acceso
      },
    },
  });
}

function aggiornaBottoneMusica() {
  const btn = el("btn-musica");
  btn.textContent = musicaAccesa ? "🎵 Musica: ON" : "🎵 Musica: OFF";
  btn.classList.toggle("attivo", musicaAccesa);
  btn.setAttribute("aria-pressed", musicaAccesa ? "true" : "false");
}

// Interruttore on/off della musica di sottofondo.
function gestisciMusica() {
  caricaYouTube();
  el("btn-musica").addEventListener("click", () => {
    musicaAccesa = !musicaAccesa;
    if (ytPronto && ytPlayer) {
      if (musicaAccesa) ytPlayer.playVideo();
      else ytPlayer.pauseVideo();
    }
    aggiornaBottoneMusica();
  });
}

// ---- Avvio ----
el("btn-rispondi").addEventListener("click", mostraComanda);
el("btn-prepara").addEventListener("click", () => { Suoni.zittisci(); iniziaPreparazione(); });
el("btn-verifica").addEventListener("click", () => {
  if (modalita === "tavolo") verificaTavolo();
  else verificaPizza();
});
el("btn-rileggi").addEventListener("click", () => Suoni.parla(ordineCorrente.telefonata));

// Livello 2 — Servizio al tavolo
el("btn-calcola").addEventListener("click", () => { Suoni.zittisci(); mostraCalcolo(); });
el("btn-prepara-tavolo").addEventListener("click", iniziaPreparazioneTavolo);
el("btn-rileggi-tavolo").addEventListener("click", () => Suoni.parla(frasiTavolo()));

aggiornaCassa();
gestisciIntro();
gestisciMusica();
