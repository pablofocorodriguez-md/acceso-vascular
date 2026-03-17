import { useState } from "react";

// ─── VERSIÓN ──────────────────────────────────────────────────────────────────
const APP_VERSION = "v1.3";
const LOGICA_VERSION = "v1.3";

// ─── CONSTANTES DE ADVERTENCIAS ───────────────────────────────────────────────

const IRC_WARNING =
  "El paciente tiene IRC avanzada, prediálisis o está en diálisis. Considerar consulta con Nefrología antes de indicar PICC para preservar el patrimonio venoso ante una eventual necesidad de fístula arteriovenosa.";

const DL_WARNING =
  "Antes de solicitar PICC de doble lumen, verificar los tres criterios de justificación:\n1. ¿Las soluciones son realmente incompatibles entre sí?\n2. ¿Deben administrarse de forma simultánea e irremplazable?\n3. ¿No es posible escalonar la administración ni utilizar otro acceso disponible?\nEl doble lumen solo está justificado si no existe alternativa viable. Su uso innecesario aumenta el riesgo de trombosis y complicaciones asociadas al catéter.";

// ─── MOTOR DE DECISIÓN ────────────────────────────────────────────────────────
function decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen }) {
  const result = { main: null, alt: null, warnings: [], source: null, incluyePICC: false };

  const addWarning = (w) => result.warnings.push(w);

  // BLOQUE A — Prioridad máxima
  if (hemodinamico) {
    result.main = "CVC no tunelizado — yugular (Angiografía)";
    result.alt = "CVC no tunelizado — subclavia (Cirugía), si hay contraindicación yugular";
    result.source = "MAGIC 2015 — criterio CVC en paciente crítico";
    return result;
  }

  const setPICC = () => {
    result.incluyePICC = true;
    if (irc) addWarning(IRC_WARNING);
    if (doubleLumen) addWarning(DL_WARNING);
  };

  // BLOQUE B — Quimioterapia
  if (terapias.includes("quimio")) {
    if (duracion === "D4") {
      result.main = "Port implantable (Cirugía)";
      result.alt = "Catéter tunelizado Hickman (Cirugía), si se prefiere acceso externo";
      result.source = "MAGIC 2015; ONS Access Device Standards 2017";
      return result;
    }
    if (duracion === "D3") {
      result.main = "PICC (Angiografía)";
      result.alt = "Port implantable, si se anticipa continuación > 3 meses";
      result.source = "MAGIC 2015";
      setPICC();
      return result;
    }
  }

  const requiereCentral = terapias.includes("npt") || terapias.includes("ph");

  // BLOQUE C — Selección por duración
  if (duracion === "D1") {
    if (requiereCentral) {
      result.main = "PICC o CVC no tunelizado (según disponibilidad y urgencia)";
      result.alt = "Midline y VVP contraindicados para NPT / pH extremo";
      result.source = "MAGIC 2015; ASPEN 2016";
      setPICC();
      return result;
    }
    if (terapias.includes("irritante") || terapias.includes("quimio")) {
      result.main = "PICC (Angiografía)";
      result.alt = null;
      result.source = "MAGIC 2015 — excepción: irritante/vesicante o quimioterapia indica PICC independientemente de la duración";
      setPICC();
      return result;
    }
    if (venas === "V1" && terapias.includes("estandar")) {
      result.main = "Vía venosa periférica — VVP (Enfermería)";
      result.source = "MAGIC 2015";
      return result;
    }
    if (venas === "V2" || venas === "V3") {
      result.main = "Midline (Angiografía)";
      result.alt = "PICC, si se anticipa extensión > 5 días";
      result.source = "MAGIC 2015";
      return result;
    }
  }

  if (duracion === "D2") {
    if (terapias.includes("irritante")) {
      result.main = "PICC (Angiografía)";
      result.source = "MAGIC 2015; INS Standards 2021";
      setPICC();
      return result;
    }
    result.main = "Midline (Angiografía)";
    result.source = "MAGIC 2015";
    return result;
  }

  if (duracion === "D3") {
    result.main = "PICC (Angiografía)";
    result.alt = "Midline (Angiografía), si la duración estimada es ≤ 28 días y la medicación es periféricamente compatible";
    result.source = "MAGIC 2015";
    result.note = "Evidencia post-MAGIC matiza el corte de 15 días: Paje et al. (JAMA Intern Med, 2025) mostró menor riesgo de complicaciones mayores con midline vs. PICC en OPAT hasta 28 días. A partir de los 30 días, preferir PICC.";
    setPICC();
    return result;
  }

  if (duracion === "D4") {
    result.main = "PICC o Catéter tunelizado Hickman (Cirugía) — equivalentes";
    result.alt = "Hickman preferible si duración > 6 meses o acceso frecuente e intermitente";
    result.source = "MAGIC 2015 — umbral 6 meses pendiente revisión con literatura post-MAGIC";
    setPICC();
    return result;
  }

  return result;
}

// ─── DATOS DEL FORMULARIO ─────────────────────────────────────────────────────

const DURACION_OPS = [
  { value: "D1", label: "≤ 5 días" },
  { value: "D2", label: "6 – 14 días" },
  { value: "D3", label: "15 días – 3 meses" },
  { value: "D4", label: "> 3 meses / largo plazo" },
];

const TERAPIA_OPS = [
  { value: "estandar", label: "Medicación estándar (ATB, fluidos, analgesia)" },
  { value: "irritante", label: "Medicación irritante o vesicante (no oncológica)", hint: "Vancomicina: periférica si ≤ 4 mg/mL y ≤ 5 días; de lo contrario, clasificar aquí." },
  { value: "quimio", label: "Quimioterapia", hint: "Incluye quimioterapia vesicante. No clasificar en irritante/vesicante." },
  { value: "npt", label: "Nutrición parenteral total (NPT)" },
  { value: "ph", label: "Osmolaridad > 900 mOsm/L o pH < 5 / > 9" },
];

const VENAS_OPS = [
  { value: "V1", label: "Bueno — venas visibles y palpables" },
  { value: "V2", label: "Dificultoso — requiere múltiples intentos" },
  { value: "V3", label: "Muy dificultoso / agotado" },
];

// ─── ESTILOS ──────────────────────────────────────────────────────────────────

const s = {
  app: {
    fontFamily: "'DM Sans', system-ui, sans-serif",
    maxWidth: 600, margin: "0 auto", padding: "2rem 1.5rem", color: "#1a1a1a",
  },
  title: { fontSize: 22, fontWeight: 600, margin: 0, color: "#0f172a", letterSpacing: "-0.3px" },
  subtitle: { fontSize: 13, color: "#64748b", margin: "4px 0 1.5rem" },
  section: { marginBottom: "1.5rem" },
  label: {
    display: "block", fontSize: 13, fontWeight: 600, color: "#475569",
    marginBottom: "0.5rem", textTransform: "uppercase", letterSpacing: "0.05em",
  },
  col: { display: "flex", flexDirection: "column", gap: 6 },
  row: { display: "flex", gap: 8 },
  optBtn: (sel) => ({
    textAlign: "left", padding: "10px 14px", borderRadius: 8, fontFamily: "inherit",
    border: sel ? "1.5px solid #0ea5e9" : "1px solid #e2e8f0",
    background: sel ? "#f0f9ff" : "#fff",
    color: sel ? "#0369a1" : "#334155",
    fontSize: 14, cursor: "pointer", transition: "all 0.1s",
  }),
  chkBtn: (sel) => ({
    textAlign: "left", padding: "10px 14px", borderRadius: 8, fontFamily: "inherit",
    border: sel ? "1.5px solid #0ea5e9" : "1px solid #e2e8f0",
    background: sel ? "#f0f9ff" : "#fff",
    color: sel ? "#0369a1" : "#334155",
    fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center",
    gap: 10, transition: "all 0.1s",
  }),
  chkBox: (sel) => ({
    width: 16, height: 16, borderRadius: 4, flexShrink: 0,
    border: sel ? "none" : "1.5px solid #cbd5e1",
    background: sel ? "#0ea5e9" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
  }),
  togBtn: (sel, danger) => ({
    flex: 1, padding: "10px 14px", borderRadius: 8, fontFamily: "inherit",
    border: sel ? `1.5px solid ${danger ? "#ef4444" : "#0ea5e9"}` : "1px solid #e2e8f0",
    background: sel ? (danger ? "#fff5f5" : "#f0f9ff") : "#fff",
    color: sel ? (danger ? "#dc2626" : "#0369a1") : "#334155",
    fontSize: 14, cursor: "pointer", fontWeight: sel ? 600 : 400, transition: "all 0.1s",
  }),
  divider: { border: "none", borderTop: "1px solid #f1f5f9", margin: "1.5rem 0" },
  resultCard: {
    borderRadius: 12, border: "1.5px solid #bae6fd", background: "#f0f9ff",
    padding: "1.25rem 1.5rem",
  },
  rLabel: {
    fontSize: 11, fontWeight: 700, color: "#0369a1",
    textTransform: "uppercase", letterSpacing: "0.07em", margin: 0,
  },
  rMain: { fontSize: 18, fontWeight: 600, color: "#0c4a6e", margin: "6px 0 0", lineHeight: 1.4 },
  rAlt: { fontSize: 13, color: "#0369a1", margin: "10px 0 0", lineHeight: 1.5 },
  rSource: { fontSize: 11, color: "#94a3b8", margin: "10px 0 0", fontStyle: "italic" },
  rNote: { fontSize: 12, color: "#0369a1", background: "#e0f2fe", borderRadius: 6, margin: "12px 0 0", lineHeight: 1.6, padding: "8px 12px" },
  warnCard: {
    borderRadius: 10, border: "1.5px solid #fbbf24", background: "#fffbeb",
    padding: "0.875rem 1.25rem", marginTop: "0.75rem",
  },
  warnTitle: {
    fontSize: 11, fontWeight: 700, color: "#92400e", margin: "0 0 6px",
    textTransform: "uppercase", letterSpacing: "0.05em",
  },
  warnText: { fontSize: 13, color: "#92400e", margin: 0, lineHeight: 1.6, whiteSpace: "pre-line" },
  resetBtn: {
    marginTop: "1.25rem", padding: "8px 16px", borderRadius: 8,
    border: "1px solid #e2e8f0", background: "transparent",
    color: "#64748b", fontSize: 13, cursor: "pointer", fontFamily: "inherit",
  },
  p6Block: {
    marginTop: "0.5rem", borderRadius: 10,
    border: "1px dashed #bae6fd", background: "#f8fbff",
    padding: "1rem 1.25rem",
  },
  p6Badge: {
    display: "inline-block", fontSize: 11, fontWeight: 700, color: "#0369a1",
    background: "#e0f2fe", borderRadius: 4, padding: "2px 8px",
    textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10,
  },
};

function Checkmark({ sel }) {
  return (
    <div style={s.chkBox(sel)}>
      {sel && (
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4l3 3 5-6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
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
    setTerapias((prev) =>
      prev.includes(val) ? prev.filter((v) => v !== val) : [...prev, val]
    );

  const listoSinP6 =
    duracion !== null && terapias.length > 0 &&
    venas !== null && hemodinamico !== null && irc !== null;

  const resultadoParcial = listoSinP6
    ? decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen: false })
    : null;

  const mostrarP6 = resultadoParcial?.incluyePICC === true;

  const listo = listoSinP6 && (!mostrarP6 || doubleLumen !== null);

  const resultado = listo
    ? decidir({ duracion, terapias, venas, hemodinamico, irc, doubleLumen: doubleLumen === true })
    : null;

  const reset = () => {
    setDuracion(null); setTerapias([]); setVenas(null);
    setHemodinamico(null); setIrc(null); setDoubleLumen(null);
  };

  return (
    <div style={s.app}>
      <h1 style={s.title}>Selección de acceso vascular</h1>
      <p style={s.subtitle}>Basado en criterios MAGIC 2015</p>
      <p style={{ fontSize: 11, color: "#94a3b8", margin: "-0.75rem 0 1.5rem", fontFamily: "monospace" }}>
        código {APP_VERSION} · lógica {LOGICA_VERSION}
      </p>

      {/* P1 */}
      <div style={s.section}>
        <span style={s.label}>P1 — Duración estimada de la terapia IV</span>
        <div style={s.col}>
          {DURACION_OPS.map((op) => (
            <button key={op.value} style={s.optBtn(duracion === op.value)} onClick={() => setDuracion(op.value)}>
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* P2 */}
      <div style={s.section}>
        <span style={s.label}>P2 — Tipo de terapia (selección múltiple)</span>
        <div style={s.col}>
          {TERAPIA_OPS.map((op) => {
            const sel = terapias.includes(op.value);
            return (
              <button key={op.value} style={s.chkBtn(sel)} onClick={() => toggleTerapia(op.value)}>
                <Checkmark sel={sel} />
                <span>
                  {op.label}
                  {op.hint && (
                    <span style={{ display: "block", fontSize: 11, color: sel ? "#0369a1" : "#94a3b8", marginTop: 2, fontWeight: 400 }}>
                      {op.hint}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* P3 */}
      <div style={s.section}>
        <span style={s.label}>P3 — Estado del patrimonio venoso periférico</span>
        <div style={s.col}>
          {VENAS_OPS.map((op) => (
            <button key={op.value} style={s.optBtn(venas === op.value)} onClick={() => setVenas(op.value)}>
              {op.label}
            </button>
          ))}
        </div>
      </div>

      {/* P4 */}
      <div style={s.section}>
        <span style={s.label}>P4 — ¿Requiere monitoreo de PVC o múltiples drogas vasoactivas?</span>
        <div style={s.row}>
          <button style={s.togBtn(hemodinamico === true, true)} onClick={() => setHemodinamico(true)}>Sí</button>
          <button style={s.togBtn(hemodinamico === false, false)} onClick={() => setHemodinamico(false)}>No</button>
        </div>
      </div>

      {/* P5 */}
      <div style={s.section}>
        <span style={s.label}>P5 — ¿IRC avanzada (estadio 4–5), prediálisis o en diálisis?</span>
        <div style={s.row}>
          <button style={s.togBtn(irc === true, false)} onClick={() => setIrc(true)}>Sí</button>
          <button style={s.togBtn(irc === false, false)} onClick={() => setIrc(false)}>No</button>
        </div>
      </div>

      {/* P6 — condicional */}
      {mostrarP6 && (
        <div style={s.section}>
          <div style={s.p6Block}>
            <span style={s.p6Badge}>Pregunta adicional</span>
            <span style={s.label}>
              P6 — ¿Considera que el paciente requiere administración simultánea de soluciones incompatibles?
            </span>
            <div style={s.row}>
              <button style={s.togBtn(doubleLumen === true, false)} onClick={() => setDoubleLumen(true)}>Sí</button>
              <button style={s.togBtn(doubleLumen === false, false)} onClick={() => setDoubleLumen(false)}>No</button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTADO */}
      {resultado && (
        <>
          <hr style={s.divider} />
          <div style={s.resultCard}>
            <p style={s.rLabel}>Recomendación principal</p>
            <p style={s.rMain}>{resultado.main}</p>
            {resultado.alt && (
              <p style={s.rAlt}><strong>Alternativa:</strong> {resultado.alt}</p>
            )}
            {resultado.source && (
              <p style={s.rSource}>Fuente: {resultado.source}</p>
            )}
            {resultado.note && (
              <p style={s.rNote}><strong>Nota de evidencia:</strong> {resultado.note}</p>
            )}
          </div>

          {resultado.warnings.map((w, i) => (
            <div key={i} style={s.warnCard}>
              <p style={s.warnTitle}>Advertencia</p>
              <p style={s.warnText}>{w}</p>
            </div>
          ))}

          <button style={s.resetBtn} onClick={reset}>Reiniciar</button>
        </>
      )}
    </div>
  );
}