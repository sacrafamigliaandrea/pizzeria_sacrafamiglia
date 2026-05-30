// Suoni sintetizzati con la Web Audio API (niente file audio, funziona offline).
// Nota: i browser bloccano l'audio finché l'utente non interagisce: il primo
// squillo potrebbe essere muto, dal primo click in poi tutto suona.
const Suoni = (() => {
  let ctx;
  let ringTimer = null;

  function ac() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function tono(freq, durata, tipo = "sine", vol = 0.2, ritardo = 0) {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = tipo;
    o.frequency.value = freq;
    o.connect(g);
    g.connect(c.destination);
    const t = c.currentTime + ritardo;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + durata);
    o.start(t);
    o.stop(t + durata + 0.03);
  }

  function squillo() {
    // doppio trillo tipo telefono
    tono(480, 0.4, "sine", 0.16);
    tono(620, 0.4, "sine", 0.12);
    tono(480, 0.4, "sine", 0.16, 0.5);
    tono(620, 0.4, "sine", 0.12, 0.5);
  }

  // ---- Lettura vocale della comanda (Web Speech API) ----
  function parla(testo) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(testo);
    u.lang = "it-IT";
    u.rate = 0.98;
    u.pitch = 1.0;
    const voci = window.speechSynthesis.getVoices();
    const vIt = voci.find((v) => v.lang && v.lang.toLowerCase().startsWith("it"));
    if (vIt) u.voice = vIt;
    window.speechSynthesis.speak(u);
  }

  function zittisci() {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  return {
    sblocca: ac,
    ring() { this.stopRing(); squillo(); ringTimer = setInterval(squillo, 2600); },
    stopRing() { if (ringTimer) { clearInterval(ringTimer); ringTimer = null; } },
    click() { tono(220, 0.07, "square", 0.10); },
    taglio() { tono(150, 0.13, "sawtooth", 0.12); },
    successo() { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.18, "triangle", 0.16, i * 0.09)); },
    errore() { tono(160, 0.28, "sawtooth", 0.16); tono(120, 0.3, "sawtooth", 0.14, 0.06); },
    cassa() { tono(1318, 0.07, "square", 0.14); tono(1568, 0.18, "square", 0.14, 0.08); },
    parla, zittisci,
  };
})();
