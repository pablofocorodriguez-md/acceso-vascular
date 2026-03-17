import { useState } from "react";

const APP_VERSION = "v1.4";
const LOGICA_VERSION = "v1.3";

const IRC_WARNING =
  "El paciente tiene IRC avanzada, prediálisis o está en diálisis. Considerar consulta con Nefrología antes de indicar PICC para preservar el patrimonio venoso ante una eventual necesidad de fístula arteriovenosa.";

const DL_WARNING =
  "Antes de solicitar PICC de doble lumen, verificar los tres criterios de justificación:\n1. ¿Las soluciones son realmente incompatibles entre sí?\n2. ¿Deben administrarse de forma simultánea e irremplazable?\n3. ¿No es posible escalonar la administración ni utilizar otro acceso disponible?\nEl doble lumen solo está justificado si no existe alternativa viable. Su uso innecesario aumenta el riesgo de trombosis y complicaciones asociadas al catéter.";

function decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen }) {
  const result = { main: null, alt: null, warnings: [], source: null, note: null, incluyePICC: false };
  const addWarning = (w) => result.warnings.push(w);

  if (hemodinamico) {
    result.main = "CVC no tunelizado — yugular";
    result.servicio = "Angiografía";
    result.alt = "CVC no tunelizado — subclavia (Cirugía), si hay contraindicación yugular";
    result.source = "MAGIC 2015 — criterio CVC en paciente crítico";
    return result;
  }

  const setPICC = () => {
    result.incluyePICC = true;
    if (irc) addWarning(IRC_WARNING);
    if (doubleLumen) addWarning(DL_WARNING);
  };

  if (terapias.includes("quimio")) {
    if (duracion === "D4") {
      result.main = "Port implantable";
      result.servicio = "Cirugía";
      result.alt = "Catéter tunelizado Hickman (Cirugía), si se prefiere acceso externo";
      result.source = "MAGIC 2015; ONS Access Device Standards 2017";
      return result;
    }
    if (duracion === "D3") {
      result.main = "PICC";
      result.servicio = "Angiografía";
      result.alt = "Port implantable, si se anticipa continuación > 3 meses";
      result.source = "MAGIC 2015";
      setPICC();
      return result;
    }
  }

  const requiereCentral = terapias.includes("npt") || terapias.includes("ph");

  if (duracion === "D1") {
    if (requiereCentral) {
      result.main = "PICC o CVC no tunelizado";
      result.servicio = "Angiografía";
      result.alt = "Midline y VVP contraindicados para NPT / pH extremo";
      result.source = "MAGIC 2015; ASPEN 2016";
      setPICC();
      return result;
    }
    if (terapias.includes("irritante") || terapias.includes("quimio")) {
      result.main = "PICC";
      result.servicio = "Angiografía";
      result.source = "MAGIC 2015 — excepción: irritante/vesicante indica PICC independientemente de la duración";
      setPICC();
      return result;
    }
    if (venas === "V1" && terapias.includes("estandar")) {
      result.main = "Vía venosa periférica (VVP)";
      result.servicio = "Enfermería";
      result.source = "MAGIC 2015";
      return result;
    }
    if (venas === "V2" || venas === "V3") {
      result.main = "Midline";
      result.servicio = "Angiografía";
      result.alt = "PICC, si se anticipa extensión > 5 días";
      result.source = "MAGIC 2015";
      return result;
    }
  }

  if (duracion === "D2") {
    if (terapias.includes("irritante")) {
      result.main = "PICC";
      result.servicio = "Angiografía";
      result.source = "MAGIC 2015; INS Standards 2021";
      setPICC();
      return result;
    }
    result.main = "Midline";
    result.servicio = "Angiografía";
    result.source = "MAGIC 2015";
    return result;
  }

  if (duracion === "D3") {
    result.main = "PICC";
    result.servicio = "Angiografía";
    result.alt = "Midline, si duración estimada ≤ 28 días y medicación periféricamente compatible";
    result.source = "MAGIC 2015; Paje et al., JAMA Intern Med 2025";
    result.note = "Paje et al. (2025) mostró menor riesgo de complicaciones mayores con midline vs. PICC en OPAT hasta 28 días. A partir de los 30 días, preferir PICC.";
    setPICC();
    return result;
  }

  if (duracion === "D4") {
    result.main = "PICC o Catéter tunelizado Hickman";
    result.servicio = "Angiografía / Cirugía";
    result.alt = "Hickman preferible si duración > 6 meses o acceso frecuente e intermitente";
    result.source = "MAGIC 2015";
    setPICC();
    return result;
  }

  return result;
}

const DURACION_OPS = [
  { value: "D1", label: "≤ 5 días" },
  { value: "D2", label: "6 – 14 días" },
  { value: "D3", label: "15 días – 3 meses" },
  { value: "D4", label: "> 3 meses / largo plazo" },
];

const TERAPIA_OPS = [
  { value: "estandar", label: "Medicación estándar", sub: "ATB, fluidos, analgesia" },
  { value: "irritante", label: "Irritante o vesicante", sub: "no oncológica — vancomicina periférica si ≤ 4 mg/mL y ≤ 5 días" },
  { value: "quimio", label: "Quimioterapia", sub: "incluye vesicante oncológico" },
  { value: "npt", label: "NPT", sub: "nutrición parenteral total" },
  { value: "ph", label: "pH / osmolaridad extrema", sub: "osmol > 900 mOsm/L o pH < 5 / > 9" },
];

const VENAS_OPS = [
  { value: "V1", label: "Buenas", sub: "visibles y palpables" },
  { value: "V2", label: "Dificultosas", sub: "requiere múltiples intentos" },
  { value: "V3", label: "Agotadas", sub: "muy dificultoso o sin acceso" },
];

function Checkmark({ sel }) {
  return (
    <div style={{
      width: 15, height: 15, borderRadius: 3, flexShrink: 0,
      border: sel ? "none" : "1.5px solid #cbd5e1",
      background: sel ? "#0284c7" : "transparent",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      {sel && (
        <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
          <path d="M1 3.5l2.5 2.5 4.5-5" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

function PreguntaLabel({ num, texto }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: "#0284c7",
        background: "#e0f2fe", borderRadius: 4, padding: "2px 7px",
        letterSpacing: "0.03em", flexShrink: 0,
      }}>P{num}</span>
      <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>{texto}</span>
    </div>
  );
}

export default function App() {
  const [duracion, setDuracion] = useState(null);
  const [terapias, setTerapias] = useState([]);
  const [venas, setVenas] = useState(null);
  const [hemodinamico, setHemodinamico] = useState(null);
  const [irc, setIrc] = useState(null);
  const [doubleLumen, setDoubleLumen] = useState(null);

  const toggleTerapia = (val) =>
    setTerapias((prev) => prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]);

  const listoSinP6 = duracion !== null && terapias.length > 0 && venas !== null && hemodinamico !== null && irc !== null;
  const resultadoParcial = listoSinP6 ? decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen: false }) : null;
  const mostrarP6 = resultadoParcial?.incluyePICC === true;
  const listo = listoSinP6 && (!mostrarP6 || doubleLumen !== null);
  const resultado = listo ? decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen: doubleLumen === true }) : null;

  // Progreso para el panel derecho cuando no hay resultado
  const progreso = [duracion, terapias.length > 0, venas, hemodinamico !== null, irc !== null].filter(Boolean).length;

  const reset = () => { setDuracion(null); setTerapias([]); setVenas(null); setHemodinamico(null); setIrc(null); setDoubleLumen(null); };

  const optBtn = (sel) => ({
    textAlign: "left", padding: "9px 12px", borderRadius: 7, fontFamily: "inherit",
    border: sel ? "1.5px solid #0284c7" : "1px solid #e2e8f0",
    background: sel ? "#f0f9ff" : "#fff",
    color: sel ? "#075985" : "#334155",
    fontSize: 13, cursor: "pointer", transition: "border-color 0.1s, background 0.1s",
    width: "100%",
  });

  const chkBtn = (sel) => ({
    ...optBtn(sel), display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 12px",
  });

  const togBtn = (sel, danger) => ({
    flex: 1, padding: "9px 12px", borderRadius: 7, fontFamily: "inherit", textAlign: "center",
    border: sel ? `1.5px solid ${danger ? "#ef4444" : "#0284c7"}` : "1px solid #e2e8f0",
    background: sel ? (danger ? "#fff5f5" : "#f0f9ff") : "#fff",
    color: sel ? (danger ? "#dc2626" : "#075985") : "#334155",
    fontSize: 13, cursor: "pointer", fontWeight: sel ? 600 : 400, transition: "all 0.1s",
  });

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: "100vh", background: "#f8fafc", padding: "0" }}>

      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e2e8f0", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 17, fontWeight: 600, margin: 0, color: "#0f172a", letterSpacing: "-0.2px" }}>
            Selección de acceso vascular
          </h1>
          <p style={{ fontSize: 12, color: "#94a3b8", margin: "2px 0 0", fontFamily: "monospace" }}>
            código {APP_VERSION} · lógica {LOGICA_VERSION}
          </p>
        </div>
        <span style={{ fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>Basado en MAGIC 2015</span>
      </div>

      {/* Layout */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 0.9fr)",
        gap: 0,
        maxWidth: 1000,
        margin: "0 auto",
        minHeight: "calc(100vh - 57px)",
      }}>

        {/* Columna izquierda — preguntas */}
        <div style={{ padding: "24px 20px 40px 24px", borderRight: "1px solid #e2e8f0" }}>

          {/* P1 */}
          <div style={{ marginBottom: 24 }}>
            <PreguntaLabel num={1} texto="Duración estimada de la terapia IV" />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {DURACION_OPS.map((op) => (
                <button key={op.value} style={optBtn(duracion === op.value)} onClick={() => setDuracion(op.value)}>
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* P2 */}
          <div style={{ marginBottom: 24 }}>
            <PreguntaLabel num={2} texto="Tipo de terapia (múltiple)" />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {TERAPIA_OPS.map((op) => {
                const sel = terapias.includes(op.value);
                return (
                  <button key={op.value} style={chkBtn(sel)} onClick={() => toggleTerapia(op.value)}>
                    <div style={{ paddingTop: 2 }}><Checkmark sel={sel} /></div>
                    <span>
                      {op.label}
                      {op.sub && <span style={{ display: "block", fontSize: 11, color: sel ? "#0284c7" : "#94a3b8", marginTop: 1, fontWeight: 400 }}>{op.sub}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* P3 */}
          <div style={{ marginBottom: 24 }}>
            <PreguntaLabel num={3} texto="Patrimonio venoso periférico" />
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {VENAS_OPS.map((op) => (
                <button key={op.value} style={chkBtn(venas === op.value)} onClick={() => setVenas(op.value)}>
                  <div style={{ paddingTop: 2 }}><Checkmark sel={venas === op.value} /></div>
                  <span>
                    {op.label}
                    <span style={{ display: "block", fontSize: 11, color: venas === op.value ? "#0284c7" : "#94a3b8", marginTop: 1, fontWeight: 400 }}>{op.sub}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* P4 */}
          <div style={{ marginBottom: 24 }}>
            <PreguntaLabel num={4} texto="¿PVC o múltiples drogas vasoactivas?" />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={togBtn(hemodinamico === true, true)} onClick={() => setHemodinamico(true)}>Sí</button>
              <button style={togBtn(hemodinamico === false, false)} onClick={() => setHemodinamico(false)}>No</button>
            </div>
          </div>

          {/* P5 */}
          <div style={{ marginBottom: 24 }}>
            <PreguntaLabel num={5} texto="¿IRC avanzada, prediálisis o diálisis?" />
            <div style={{ display: "flex", gap: 8 }}>
              <button style={togBtn(irc === true, false)} onClick={() => setIrc(true)}>Sí</button>
              <button style={togBtn(irc === false, false)} onClick={() => setIrc(false)}>No</button>
            </div>
          </div>

          {/* P6 condicional */}
          {mostrarP6 && (
            <div style={{ marginBottom: 24, padding: "14px 16px", borderRadius: 8, border: "1px dashed #bae6fd", background: "#f0f9ff" }}>
              <div style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#0284c7", background: "#bae6fd", borderRadius: 4, padding: "2px 7px", letterSpacing: "0.03em" }}>
                  P6 · adicional
                </span>
              </div>
              <PreguntaLabel num={6} texto="¿Soluciones incompatibles simultáneas?" />
              <div style={{ display: "flex", gap: 8 }}>
                <button style={togBtn(doubleLumen === true, false)} onClick={() => setDoubleLumen(true)}>Sí</button>
                <button style={togBtn(doubleLumen === false, false)} onClick={() => setDoubleLumen(false)}>No</button>
              </div>
            </div>
          )}

          <button onClick={reset} style={{ fontSize: 12, color: "#94a3b8", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, padding: "6px 14px", cursor: "pointer", fontFamily: "inherit" }}>
            Reiniciar
          </button>
        </div>

        {/* Columna derecha — resultado */}
        <div style={{ padding: "24px 24px 40px 20px", position: "sticky", top: 0, alignSelf: "start" }}>

          {resultado ? (
            <div>
              {/* Resultado principal */}
              <div style={{ borderRadius: 10, border: "1.5px solid #7dd3fc", background: "#f0f9ff", padding: "16px 18px", marginBottom: 10 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.07em", margin: "0 0 6px" }}>
                  Recomendación
                </p>
                <p style={{ fontSize: 20, fontWeight: 700, color: "#0c4a6e", margin: "0 0 4px", lineHeight: 1.3 }}>
                  {resultado.main}
                </p>
                {resultado.servicio && (
                  <p style={{ fontSize: 12, color: "#0369a1", margin: "4px 0 0", fontWeight: 500 }}>
                    → {resultado.servicio}
                  </p>
                )}
                {resultado.alt && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #bae6fd" }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Alternativa</p>
                    <p style={{ fontSize: 13, color: "#0369a1", margin: 0, lineHeight: 1.5 }}>{resultado.alt}</p>
                  </div>
                )}
                {resultado.source && (
                  <p style={{ fontSize: 11, color: "#94a3b8", margin: "10px 0 0", fontStyle: "italic" }}>
                    {resultado.source}
                  </p>
                )}
              </div>

              {/* Nota de evidencia */}
              {resultado.note && (
                <div style={{ borderRadius: 8, background: "#f0f9ff", border: "1px solid #bae6fd", padding: "10px 14px", marginBottom: 10 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" }}>Nota de evidencia</p>
                  <p style={{ fontSize: 12, color: "#0369a1", margin: 0, lineHeight: 1.6 }}>{resultado.note}</p>
                </div>
              )}

              {/* Advertencias */}
              {resultado.warnings.map((w, i) => (
                <div key={i} style={{ borderRadius: 8, border: "1.5px solid #fbbf24", background: "#fffbeb", padding: "12px 14px", marginBottom: 8 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 5px" }}>⚠ Advertencia</p>
                  <p style={{ fontSize: 12, color: "#92400e", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" }}>{w}</p>
                </div>
              ))}
            </div>
          ) : (
            // Estado vacío / en progreso
            <div style={{ paddingTop: 8 }}>
              <div style={{ borderRadius: 10, border: "1px dashed #cbd5e1", padding: "24px 18px", textAlign: "center" }}>
                <div style={{ marginBottom: 16 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} style={{
                      display: "inline-block", width: 28, height: 4, borderRadius: 2,
                      background: n <= progreso ? "#0284c7" : "#e2e8f0",
                      margin: "0 2px", transition: "background 0.2s",
                    }} />
                  ))}
                </div>
                <p style={{ fontSize: 13, color: "#94a3b8", margin: 0, lineHeight: 1.6 }}>
                  {progreso === 0
                    ? "Completá las preguntas para ver la recomendación"
                    : `${5 - progreso} pregunta${5 - progreso !== 1 ? "s" : ""} restante${5 - progreso !== 1 ? "s" : ""}`
                  }
                </p>
              </div>

              <div style={{ marginTop: 20, padding: "14px 16px", borderRadius: 8, background: "#f8fafc", border: "1px solid #f1f5f9" }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px" }}>
                  Dispositivos disponibles
                </p>
                {[
                  ["VVP", "Enfermería"],
                  ["Midline", "Angiografía"],
                  ["PICC", "Angiografía"],
                  ["CVC yugular", "Angiografía"],
                  ["CVC subclavia", "Cirugía"],
                  ["Port implantable", "Cirugía"],
                  ["Hickman", "Cirugía"],
                ].map(([dev, serv]) => (
                  <div key={dev} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
                    <span style={{ fontSize: 13, color: "#334155" }}>{dev}</span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{serv}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
