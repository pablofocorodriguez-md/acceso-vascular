import { useState } from "react";

const APP_VERSION = "v1.4";
const LOGICA_VERSION = "v1.4";

const IRC_WARNING = "IRC avanzada, prediálisis o diálisis. Consultar Nefrología antes de indicar PICC para preservar patrimonio venoso ante eventual fístula arteriovenosa.";
const DL_WARNING = "Verificar antes de solicitar doble lumen:\n1. ¿Las soluciones son realmente incompatibles?\n2. ¿Deben administrarse simultáneamente?\n3. ¿No es posible escalonar ni usar otro acceso?\nSolo justificado si no existe alternativa viable.";

// Devuelve { main, servicio, alt, note, bridge, warnings[], source, incluyePICC }
// bridge: cuando P4=H1 + D3/D4 → resultado del árbol evaluado sin P4
// bridge es null en todos los demás casos
function decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen }) {
  const result = { main: null, servicio: null, alt: null, note: null, bridge: null, warnings: [], source: null, incluyePICC: false };
  const addWarning = (w) => result.warnings.push(w);
  const setPICC = () => {
    result.incluyePICC = true;
    if (irc) addWarning(IRC_WARNING);
    if (doubleLumen) addWarning(DL_WARNING);
  };

  // BLOQUE A — prioridad máxima
  if (hemodinamico) {
    result.main = "CVC no tunelizado — yugular"; result.servicio = "Angiografía";
    result.alt = "CVC subclavia (Cirugía) si hay contraindicación yugular";
    result.source = "MAGIC 2015 — CVC en paciente crítico";
    // Opción B: D3/D4 → CVC es puente; calcular acceso definitivo
    if (duracion === "D3" || duracion === "D4") {
      const br = decidir({ duracion, terapias, venas, hemodinamico: false, irc, doubleLumen });
      result.bridge = br;
      result.incluyePICC = br.incluyePICC; // P6 aplica si el definitivo es PICC
    }
    return result;
  }

  // BLOQUE B — quimioterapia
  if (terapias.includes("quimio")) {
    if (duracion === "D4") {
      result.main = "Port implantable"; result.servicio = "Cirugía";
      result.alt = "Hickman (Cirugía) si se prefiere acceso externo";
      result.source = "MAGIC 2015; ONS 2017"; return result;
    }
    if (duracion === "D3") {
      result.main = "PICC"; result.servicio = "Angiografía";
      result.alt = "Port implantable si se anticipa continuación > 3 meses";
      result.source = "MAGIC 2015"; setPICC(); return result;
    }
  }

  const requiereCentral = terapias.includes("npt") || terapias.includes("ph");

  // BLOQUE C — selección por duración
  if (duracion === "D1") {
    if (requiereCentral) {
      result.main = "PICC o CVC no tunelizado"; result.servicio = "Angiografía";
      result.alt = "Midline y VVP contraindicados para NPT / pH extremo";
      result.source = "MAGIC 2015; ASPEN 2016"; setPICC(); return result;
    }
    if (terapias.includes("irritante") || terapias.includes("quimio")) {
      result.main = "PICC"; result.servicio = "Angiografía";
      result.source = "MAGIC 2015 — irritante/vesicante indica PICC independientemente de la duración";
      setPICC(); return result;
    }
    if (venas === "V1" && terapias.includes("estandar")) {
      result.main = "Vía venosa periférica (VVP)"; result.servicio = "Enfermería";
      result.source = "MAGIC 2015"; return result;
    }
    if (venas === "V2" || venas === "V3") {
      result.main = "Midline"; result.servicio = "Angiografía";
      result.alt = "Si se anticipa extensión, el midline puede mantenerse hasta ~28 días con medicación periféricamente compatible (Paje 2025). Considerar PICC si la duración supera ese umbral o la medicación no es compatible.";
      result.source = "MAGIC 2015; Paje et al., JAMA Intern Med 2025"; return result;
    }
  }

  if (duracion === "D2") {
    if (terapias.includes("irritante")) {
      result.main = "PICC"; result.servicio = "Angiografía";
      result.source = "MAGIC 2015; INS 2021"; setPICC(); return result;
    }
    result.main = "Midline"; result.servicio = "Angiografía";
    result.source = "MAGIC 2015"; return result;
  }

  if (duracion === "D3") {
    result.main = "PICC"; result.servicio = "Angiografía";
    result.alt = "Midline si duración ≤ 28 días y medicación periféricamente compatible";
    result.source = "MAGIC 2015; Paje et al., JAMA Intern Med 2025";
    result.note = "Paje et al. (2025): menor riesgo de complicaciones con midline vs. PICC en OPAT hasta 28 días. Preferir PICC a partir de los 30 días.";
    setPICC(); return result;
  }

  if (duracion === "D4") {
    result.main = "PICC o Hickman"; result.servicio = "Angiografía / Cirugía";
    result.alt = "Hickman preferible si duración > 6 meses o acceso frecuente e intermitente";
    result.source = "MAGIC 2015"; setPICC(); return result;
  }

  return result;
}

const DURACION_OPS = [
  { value: "D1", label: "≤ 5 días" },
  { value: "D2", label: "6 – 14 días" },
  { value: "D3", label: "15 días – 3 meses" },
  { value: "D4", label: "> 3 meses" },
];
const TERAPIA_OPS = [
  { value: "estandar", label: "Estándar", sub: "ATB, fluidos, analgesia" },
  { value: "irritante", label: "Irritante / vesicante", sub: "no oncológica" },
  { value: "quimio", label: "Quimioterapia", sub: "incluye vesicante oncológico" },
  { value: "npt", label: "NPT", sub: "nutrición parenteral total" },
  { value: "ph", label: "pH / osmol extrema", sub: "> 900 mOsm o pH < 5 / > 9" },
];
const VENAS_OPS = [
  { value: "V1", label: "Buenas", sub: "visibles y palpables" },
  { value: "V2", label: "Dificultosas", sub: "múltiples intentos" },
  { value: "V3", label: "Agotadas", sub: "sin acceso periférico" },
];
const DISPOSITIVOS = [
  { dev: "VVP", serv: "Enfermería" },
  { dev: "Midline", serv: "Angiografía" },
  { dev: "PICC", serv: "Angiografía" },
  { dev: "CVC yugular", serv: "Angiografía" },
  { dev: "CVC subclavia", serv: "Cirugía" },
  { dev: "Port", serv: "Cirugía" },
  { dev: "Hickman", serv: "Cirugía" },
];

function Chk({ sel }) {
  return (
    <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, border: sel ? "none" : "1.5px solid #cbd5e1", background: sel ? "#0284c7" : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {sel && <svg width="8" height="6" viewBox="0 0 8 6" fill="none"><path d="M1 3l2 2 4-4" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
  );
}

export default function App() {
  const [duracion, setDuracion] = useState(null);
  const [terapias, setTerapias] = useState([]);
  const [venas, setVenas] = useState(null);
  const [hemo, setHemo] = useState(null);
  const [irc, setIrc] = useState(null);
  const [dl, setDl] = useState(null);

  const toggle = (val) => setTerapias(p => p.includes(val) ? p.filter(v => v !== val) : [...p, val]);
  const listoSinP6 = duracion && terapias.length > 0 && venas && hemo !== null && irc !== null;
  const rParcial = listoSinP6 ? decidir({ duracion, terapias, venas, hemodinamico: hemo, irc, doubleLumen: false }) : null;
  const mostrarP6 = rParcial?.incluyePICC === true;
  const listo = listoSinP6 && (!mostrarP6 || dl !== null);
  const r = listo ? decidir({ duracion, terapias, venas, hemodinamico: hemo, irc, doubleLumen: dl === true }) : null;
  const progreso = [duracion, terapias.length > 0, venas, hemo !== null, irc !== null].filter(Boolean).length;
  const reset = () => { setDuracion(null); setTerapias([]); setVenas(null); setHemo(null); setIrc(null); setDl(null); };

  const ob = (sel) => ({ textAlign: "left", padding: "7px 10px", borderRadius: 6, fontFamily: "inherit", border: sel ? "1.5px solid #0284c7" : "1px solid #e2e8f0", background: sel ? "#f0f9ff" : "#fff", color: sel ? "#075985" : "#334155", fontSize: 12, cursor: "pointer", width: "100%", transition: "all 0.1s" });
  const cb = (sel) => ({ ...ob(sel), display: "flex", alignItems: "flex-start", gap: 8 });
  const tb = (sel, danger) => ({ flex: 1, padding: "7px 10px", borderRadius: 6, fontFamily: "inherit", textAlign: "center", border: sel ? `1.5px solid ${danger ? "#ef4444" : "#0284c7"}` : "1px solid #e2e8f0", background: sel ? (danger ? "#fff5f5" : "#f0f9ff") : "#fff", color: sel ? (danger ? "#dc2626" : "#075985") : "#334155", fontSize: 12, cursor: "pointer", fontWeight: sel ? 600 : 400, transition: "all 0.1s" });

  const PL = ({ n, t }) => (
    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 7 }}>
      <span style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", background: "#e0f2fe", borderRadius: 3, padding: "1px 6px", flexShrink: 0 }}>P{n}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em" }}>{t}</span>
    </div>
  );

  const todasAdvertencias = r ? [...r.warnings, ...(r.bridge?.warnings ?? [])] : [];

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", background: "#f8fafc", minHeight: "100vh" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: "#0f172a" }}>Selección de acceso vascular</h1>
          <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "monospace" }}>código {APP_VERSION} · lógica {LOGICA_VERSION}</span>
        </div>
        <span style={{ fontSize: 10, color: "#94a3b8", fontStyle: "italic" }}>MAGIC 2015</span>
      </div>

      {/* Layout dos columnas */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", maxWidth: 960, margin: "0 auto", minHeight: "calc(100vh - 41px)" }}>

        {/* Izquierda */}
        <div style={{ padding: "16px 16px 32px 20px", borderRight: "1px solid #e2e8f0" }}>

          <div style={{ marginBottom: 14 }}>
            <PL n={1} t="Duración de la terapia IV" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
              {DURACION_OPS.map(op => <button key={op.value} style={ob(duracion === op.value)} onClick={() => setDuracion(op.value)}>{op.label}</button>)}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <PL n={2} t="Tipo de terapia (múltiple)" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {TERAPIA_OPS.map(op => {
                const sel = terapias.includes(op.value);
                return (
                  <button key={op.value} style={cb(sel)} onClick={() => toggle(op.value)}>
                    <div style={{ paddingTop: 2 }}><Chk sel={sel} /></div>
                    <span>
                      <span style={{ fontSize: 12 }}>{op.label}</span>
                      <span style={{ display: "block", fontSize: 10, color: sel ? "#0284c7" : "#94a3b8", marginTop: 1 }}>{op.sub}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <PL n={3} t="Patrimonio venoso" />
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {VENAS_OPS.map(op => (
                <button key={op.value} style={cb(venas === op.value)} onClick={() => setVenas(op.value)}>
                  <div style={{ paddingTop: 2 }}><Chk sel={venas === op.value} /></div>
                  <span>
                    <span style={{ fontSize: 12 }}>{op.label}</span>
                    <span style={{ display: "block", fontSize: 10, color: venas === op.value ? "#0284c7" : "#94a3b8", marginTop: 1 }}>{op.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <PL n={4} t="¿PVC o múltiples vasoactivos actualmente?" />
            <div style={{ display: "flex", gap: 6 }}>
              <button style={tb(hemo === true, true)} onClick={() => setHemo(true)}>Sí</button>
              <button style={tb(hemo === false, false)} onClick={() => setHemo(false)}>No</button>
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <PL n={5} t="¿IRC avanzada, prediálisis o diálisis?" />
            <div style={{ display: "flex", gap: 6 }}>
              <button style={tb(irc === true, false)} onClick={() => setIrc(true)}>Sí</button>
              <button style={tb(irc === false, false)} onClick={() => setIrc(false)}>No</button>
            </div>
          </div>

          {mostrarP6 && (
            <div style={{ marginBottom: 14, padding: "12px 14px", borderRadius: 7, border: "1px dashed #7dd3fc", background: "#f0f9ff" }}>
              <div style={{ marginBottom: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", background: "#bae6fd", borderRadius: 3, padding: "1px 6px" }}>P6 · adicional</span>
              </div>
              <PL n={6} t="¿Soluciones incompatibles simultáneas?" />
              <div style={{ display: "flex", gap: 6 }}>
                <button style={tb(dl === true, false)} onClick={() => setDl(true)}>Sí</button>
                <button style={tb(dl === false, false)} onClick={() => setDl(false)}>No</button>
              </div>
            </div>
          )}

          <button onClick={reset} style={{ fontSize: 11, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 5, padding: "5px 12px", cursor: "pointer", fontFamily: "inherit" }}>
            Reiniciar
          </button>
        </div>

        {/* Derecha */}
        <div style={{ padding: "16px 20px 32px 16px", position: "sticky", top: 0, alignSelf: "start", maxHeight: "calc(100vh - 41px)", overflowY: "auto" }}>

          {/* Barra progreso */}
          <div style={{ display: "flex", gap: 3, marginBottom: 12 }}>
            {[1,2,3,4,5].map(n => (
              <div key={n} style={{ flex: 1, height: 3, borderRadius: 2, background: n <= progreso ? "#0284c7" : "#e2e8f0", transition: "background 0.2s" }} />
            ))}
          </div>

          {r ? (
            <>
              {/* Card principal */}
              <div style={{ borderRadius: 10, border: "1.5px solid #7dd3fc", background: "#f0f9ff", padding: "14px 16px", marginBottom: 8 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 5px" }}>
                  {r.bridge ? "Dispositivo inmediato" : "Recomendación"}
                </p>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#0c4a6e", margin: "0 0 3px", lineHeight: 1.25 }}>{r.main}</p>
                {r.servicio && <p style={{ fontSize: 11, color: "#0369a1", margin: "3px 0 0", fontWeight: 500 }}>→ {r.servicio}</p>}
                {r.alt && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #bae6fd" }}>
                    <p style={{ fontSize: 9, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 3px" }}>Alternativa</p>
                    <p style={{ fontSize: 12, color: "#0369a1", margin: 0, lineHeight: 1.5 }}>{r.alt}</p>
                  </div>
                )}
                {r.source && <p style={{ fontSize: 10, color: "#94a3b8", margin: "8px 0 0", fontStyle: "italic" }}>{r.source}</p>}
              </div>

              {/* Card acceso definitivo (bridge) — solo P4=H1 + D3/D4 */}
              {r.bridge && (
                <div style={{ borderRadius: 10, border: "1.5px dashed #94a3b8", background: "#f8fafc", padding: "14px 16px", marginBottom: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 2px" }}>Acceso definitivo</p>
                  <p style={{ fontSize: 10, color: "#94a3b8", margin: "0 0 8px", fontStyle: "italic" }}>Planificar al estabilizarse — el CVC es un puente</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#334155", margin: "0 0 3px", lineHeight: 1.25 }}>{r.bridge.main}</p>
                  {r.bridge.servicio && <p style={{ fontSize: 11, color: "#475569", margin: "3px 0 0", fontWeight: 500 }}>→ {r.bridge.servicio}</p>}
                  {r.bridge.alt && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 3px" }}>Alternativa</p>
                      <p style={{ fontSize: 12, color: "#475569", margin: 0, lineHeight: 1.5 }}>{r.bridge.alt}</p>
                    </div>
                  )}
                  {r.bridge.note && (
                    <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 3px" }}>Nota de evidencia</p>
                      <p style={{ fontSize: 11, color: "#475569", margin: 0, lineHeight: 1.6 }}>{r.bridge.note}</p>
                    </div>
                  )}
                  {r.bridge.source && <p style={{ fontSize: 10, color: "#94a3b8", margin: "8px 0 0", fontStyle: "italic" }}>{r.bridge.source}</p>}
                </div>
              )}

              {/* Nota de evidencia — solo cuando no hay bridge */}
              {r.note && !r.bridge && (
                <div style={{ borderRadius: 7, background: "#f0f9ff", border: "1px solid #bae6fd", padding: "10px 12px", marginBottom: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Nota de evidencia</p>
                  <p style={{ fontSize: 11, color: "#0369a1", margin: 0, lineHeight: 1.6 }}>{r.note}</p>
                </div>
              )}

              {todasAdvertencias.map((w, i) => (
                <div key={i} style={{ borderRadius: 7, border: "1.5px solid #fbbf24", background: "#fffbeb", padding: "10px 12px", marginBottom: 8 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>⚠ Advertencia</p>
                  <p style={{ fontSize: 11, color: "#92400e", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{w}</p>
                </div>
              ))}
            </>
          ) : (
            <div style={{ borderRadius: 8, border: "1px dashed #cbd5e1", padding: "12px", marginBottom: 10, textAlign: "center" }}>
              <p style={{ fontSize: 12, color: "#94a3b8", margin: 0 }}>
                {progreso === 0 ? "Completá las preguntas para ver la recomendación" : `${5 - progreso} pregunta${5 - progreso !== 1 ? "s" : ""} restante${5 - progreso !== 1 ? "s" : ""}`}
              </p>
            </div>
          )}

          {/* Dispositivos — siempre visible */}
          <div style={{ borderRadius: 8, border: "1px solid #f1f5f9", overflow: "hidden", marginTop: 8 }}>
            <div style={{ background: "#f8fafc", padding: "7px 12px", borderBottom: "1px solid #f1f5f9" }}>
              <p style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>Dispositivos disponibles</p>
            </div>
            {DISPOSITIVOS.map(({ dev, serv }, i) => {
              const esRec = r && r.main && r.main.toLowerCase().includes(dev.toLowerCase());
              const esBridge = r?.bridge?.main && r.bridge.main.toLowerCase().includes(dev.toLowerCase());
              return (
                <div key={dev} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 12px", borderBottom: i < DISPOSITIVOS.length - 1 ? "1px solid #f1f5f9" : "none", background: esRec ? "#f0f9ff" : esBridge ? "#f8fafc" : "#fff", transition: "background 0.2s" }}>
                  <span style={{ fontSize: 12, color: esRec ? "#0284c7" : esBridge ? "#64748b" : "#334155", fontWeight: (esRec || esBridge) ? 600 : 400 }}>{dev}</span>
                  <span style={{ fontSize: 10, color: esRec ? "#0284c7" : esBridge ? "#64748b" : "#94a3b8" }}>{serv}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
