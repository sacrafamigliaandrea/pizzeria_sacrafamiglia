// Pizzeria SacraFamiglia — ciclo di lavoro a fasi:
// telefonata -> comanda -> preparazione (1+ pizze) -> scontrino -> consegna

const CENTRO = 220;
const SUPPLEMENTO = 1.5; // per ogni ingrediente speciale richiesto

const FORMATI = {
  normale: { nome: "Normale", raggio: 168, base: 5 },
  famiglia: { nome: "Famiglia 👨‍👩‍👧‍👦", raggio: 205, base: 9 },
};

const INGREDIENTI = [
  { id: "vuoto", nome: "Solo base (margherita)", fill: "transparent", speciale: false },
  { id: "mozzarella", nome: "Mozzarella", fill: "url(#texture-mozzarella)", speciale: false },
  { id: "prosciutto", nome: "Prosciutto", fill: "url(#texture-prosciutto)", speciale: true },
  { id: "gorgonzola", nome: "Gorgonzola", fill: "url(#texture-gorgonzola)", speciale: true },
  { id: "salamino", nome: "Salamino piccante", fill: "url(#texture-salamino)", speciale: true },
  { id: "bufala", nome: "Bufala", fill: "url(#texture-bufala)", speciale: true },
  { id: "patatine", nome: "Patatine fritte", fill: "url(#texture-patatine)", speciale: true },
  { id: "wurstel", nome: "Würstel", fill: "url(#texture-wurstel)", speciale: true },
];

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

// ---- Stato ----
let ordineCorrente = null;
let indicePizza = 0;
let raggioCorrente = FORMATI.normale.raggio;
let nSpicchi = 4;
let ingredienteAttivo = "prosciutto";
let stato = [];
let cassa = caricaCassa();

// ---- Utility ----
function el(id) { return document.getElementById(id); }
function mcd(a, b) { return b === 0 ? a : mcd(b, a % b); }
function semplifica(n, d) { const g = mcd(n, d) || 1; return [n / g, d / g]; }
function fraz(n, d) { const [a, b] = semplifica(n, d); return b === 1 ? `${a}` : `${a}/${b}`; }
function euro(v) { return "€ " + v.toFixed(2).replace(".", ","); }
function info(id) { return INGREDIENTI.find((i) => i.id === id) || {}; }
function fillDi(id) { return info(id).fill || "transparent"; }
function nomeDi(id) { return info(id).nome || id; }

function swatch(id) {
  return `<svg class="swatch" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="11" fill="${fillDi(id)}" stroke="rgba(0,0,0,0.2)" /></svg>`;
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
  creaBottoniDivisori();
  creaBottoniIngredienti();
  disegnaPizza();
  mostraFase("preparazione");
}

function disegnaPizza() {
  const gBase = el("base"), gS = el("spicchi"), gT = el("tagli");
  gBase.innerHTML =
    `<circle cx="${CENTRO}" cy="${CENTRO}" r="${raggioCorrente + 4}" fill="#a9682b" />` +
    `<circle cx="${CENTRO}" cy="${CENTRO}" r="${raggioCorrente}" fill="url(#impasto)" />`;
  gS.innerHTML = ""; gT.innerHTML = "";
  const passo = 360 / nSpicchi;
  for (let i = 0; i < nSpicchi; i++) {
    const a = i * passo, b = (i + 1) * passo;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathSpicchio(a, b));
    path.setAttribute("class", "spicchio");
    path.setAttribute("fill", fillDi(stato[i]));
    path.addEventListener("click", () => {
      stato[i] = stato[i] === ingredienteAttivo ? "vuoto" : ingredienteAttivo;
      Suoni.click();
      disegnaPizza();
    });
    gS.appendChild(path);
    const pt = punto(a);
    const linea = document.createElementNS("http://www.w3.org/2000/svg", "line");
    linea.setAttribute("x1", CENTRO); linea.setAttribute("y1", CENTRO);
    linea.setAttribute("x2", pt.x); linea.setAttribute("y2", pt.y);
    linea.setAttribute("class", "linea-taglio");
    gT.appendChild(linea);
  }
  aggiornaRiepilogo();
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

// ---- Avvio ----
el("btn-rispondi").addEventListener("click", mostraComanda);
el("btn-prepara").addEventListener("click", iniziaPreparazione);
el("btn-verifica").addEventListener("click", verificaPizza);
aggiornaCassa();
nuovaTelefonata();
