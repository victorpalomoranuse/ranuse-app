"use client";
import { useState, useEffect, useRef } from "react";

const LIGAS = ["Hypermotion", "LaLiga", "Liga F", "Kings League", "Serie A", "Ligue 1", "Liga Portugal", "Bundesliga"];
const PERFILES = ["Jugadores", "Porteros", "Retirados", "Entrenadores", "Jugadoras", "Árbitros", "Kings League"];

const ESTADOS = {
  no_leido:   { label: "No leído",   color: "#3b82f6", emoji: "🔵" },
  leido:      { label: "Leído",      color: "#f59e0b", emoji: "🟡" },
  interesado: { label: "Interesado", color: "#22c55e", emoji: "🟢" },
  inviable:   { label: "Inviable",   color: "#9ca3af", emoji: "⚪" },
  rechazado:  { label: "Rechazado",  color: "#f87171", emoji: "🔴" },
};

const ORDEN_ESTADOS = ["interesado", "leido", "no_leido", "inviable", "rechazado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [prospectos, setProspectos] = useState([]);
  const [metricas, setMetricas] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [loading, setLoading] = useState(true);

  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "¡Buenas, Víctor! 👋\n\nTengo tus prospectos cargados desde Supabase. Puedes pedirme cosas como:\n\n• *\"Rubén Yáñez me ha contestado, pasa a interesado\"*\n• *\"Marca a Pedro Mba como rechazado\"*\n• *\"Genera un DM para un portero de Hypermotion\"*\n• *\"¿A quién toca hacer seguimiento hoy?\"*" }
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const endRef = useRef(null);

  const [finderFilters, setFinderFilters] = useState({ liga: "Hypermotion", perfil: "Jugadores", cantidad: 5 });
  const [finderResults, setFinderResults] = useState(null);
  const [finderLoading, setFinderLoading] = useState(false);
  const [generated, setGenerated] = useState([]);

  const [filtroEstado, setFiltroEstado] = useState("all");
  const [filtroMes, setFiltroMes] = useState("all");
  const [busqueda, setBusqueda] = useState("");
  const [agrupacion, setAgrupacion] = useState("mes"); // "mes" o "estado"

  useEffect(() => { cargarDatos(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function cargarDatos() {
    setLoading(true);
    try {
      const res = await fetch("/api/prospectos");
      const data = await res.json();
      setProspectos(data.prospectos || []);
      setMetricas(data.metricas || []);
      setAnalisis(data.analisis || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const sendMsg = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: "user", content: input };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      setMsgs(prev => [...prev, { role: "assistant", content: data.content || data.error || "Error." }]);
      cargarDatos();
    } catch { setMsgs(prev => [...prev, { role: "assistant", content: "Error de conexión." }]); }
    setChatLoading(false);
  };

  const buscar = async () => {
    setFinderLoading(true);
    setFinderResults(null);
    try {
      const res = await fetch("/api/finder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(finderFilters),
      });
      const data = await res.json();
      setFinderResults(data);
    } catch { setFinderResults({ error: "Error al buscar." }); }
    setFinderLoading(false);
  };

  const actualizarEstado = async (id, nuevoEstado) => {
    await fetch("/api/prospectos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, estado: nuevoEstado }),
    });
    cargarDatos();
  };

  const renderMsg = (m, i) => {
    const isUser = m.role === "user";
    const parts = String(m.content).split(/(\*\*\*[\s\S]*?\*\*\*|\*\*.*?\*\*|\*.*?\*)/g);
    const formatted = parts.map((p, j) => {
      if (p.startsWith("***") && p.endsWith("***")) return (
        <div key={j} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 8, padding: "10px 12px", margin: "8px 0", fontFamily: "monospace", fontSize: 12, color: "#e0e0e0", whiteSpace: "pre-wrap" }}>{p.slice(3, -3).trim()}</div>
      );
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} style={{ color: "#d4a853" }}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*")) return <em key={j} style={{ color: "#aaa" }}>{p.slice(1, -1)}</em>;
      return p;
    });
    return (
      <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
        {!isUser && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #d4a853, #b8863a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000", marginRight: 8, flexShrink: 0, marginTop: 2 }}>R</div>}
        <div style={{ maxWidth: "82%", background: isUser ? "linear-gradient(135deg, #d4a853, #c49240)" : "rgba(255,255,255,0.06)", border: isUser ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px", color: isUser ? "#000" : "#e0e0e0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {formatted}
        </div>
      </div>
    );
  };

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{ background: active ? "rgba(212,168,83,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "#d4a853" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "5px 11px", color: active ? "#d4a853" : "#777", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  const quickActions = ["¿A quién hago seguimiento hoy?", "DM para portero Hypermotion", "Resumen de abril", "Prospectos interesados"];

  const prospectosFiltrados = prospectos.filter(p => {
    if (filtroEstado !== "all" && p.estado !== filtroEstado) return false;
    if (filtroMes !== "all" && p.mes_primer_contacto !== filtroMes) return false;
    if (busqueda && !p.nombre.toLowerCase().includes(busqueda.toLowerCase())) return false;
    return true;
  });

  // Agrupación
  const grupos = {};
  if (agrupacion === "mes") {
    for (const p of prospectosFiltrados) {
      const k = p.mes_primer_contacto || "sin_mes";
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(p);
    }
  } else {
    for (const p of prospectosFiltrados) {
      const k = p.estado || "no_leido";
      if (!grupos[k]) grupos[k] = [];
      grupos[k].push(p);
    }
  }

  const clavesOrdenadas = agrupacion === "mes"
    ? Object.keys(grupos).sort((a, b) => {
        if (a === "sin_mes") return 1;
        if (b === "sin_mes") return -1;
        return MESES.indexOf(b) - MESES.indexOf(a); // meses recientes primero
      })
    : ORDEN_ESTADOS.filter(e => grupos[e]);

  const mesesDisponibles = Array.from(new Set(prospectos.map(p => p.mes_primer_contacto).filter(Boolean)));

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #0d0d0d; }
        @media (min-width: 900px) {
          .ranuse-container { max-width: 1100px !important; padding: 20px; }
        }
      `}</style>

      <div className="ranuse-container" style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", height: "100dvh" }}>
        <div style={{ padding: "14px 18px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #d4a853, #7a4f1a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>R</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Ranuse Assistant</div>
              <div style={{ fontSize: 10, color: loading ? "#888" : "#4ade80" }}>● {loading ? "Sincronizando..." : `${prospectos.length} prospectos · En vivo`}</div>
            </div>
          </div>
          <div style={{ display: "flex", overflowX: "auto", gap: 0 }}>
            {[["chat", "Chat"], ["prospectos", "Prospectos"], ["buscador", "🔍 Buscador"], ["metricas", "Métricas"], ["analisis", "Análisis"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? "2px solid #d4a853" : "2px solid transparent", color: tab === id ? "#d4a853" : "#555", padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {tab === "chat" && <>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {quickActions.map((q, i) => <button key={i} onClick={() => setInput(q)} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 20, padding: "4px 11px", color: "#d4a853", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{q}</button>)}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {msgs.map(renderMsg)}
              {chatLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 13 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #d4a853, #b8863a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000" }}>R</div>Pensando...</div>}
              <div ref={endRef} />
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg()} placeholder="Escribe o dicta..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none" }} />
              <button onClick={sendMsg} disabled={chatLoading || !input.trim()} style={{ background: chatLoading || !input.trim() ? "#1a1a1a" : "linear-gradient(135deg, #d4a853, #c49240)", border: "none", borderRadius: 12, padding: "10px 15px", color: chatLoading || !input.trim() ? "#444" : "#000", cursor: chatLoading || !input.trim() ? "default" : "pointer", fontSize: 16, fontWeight: 700 }}>→</button>
            </div>
          </>}

          {tab === "prospectos" && <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre..." style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, marginBottom: 10 }} />

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <Pill label="Agrupar por mes" active={agrupacion === "mes"} onClick={() => setAgrupacion("mes")} />
              <Pill label="Agrupar por estado" active={agrupacion === "estado"} onClick={() => setAgrupacion("estado")} />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Pill label="Todos los estados" active={filtroEstado==="all"} onClick={() => setFiltroEstado("all")} />
              {Object.entries(ESTADOS).map(([k, v]) => (
                <Pill key={k} label={`${v.emoji} ${v.label}`} active={filtroEstado===k} onClick={() => setFiltroEstado(k)} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <Pill label="Todos los meses" active={filtroMes==="all"} onClick={() => setFiltroMes("all")} />
              {mesesDisponibles.map(m => (
                <Pill key={m} label={m} active={filtroMes===m} onClick={() => setFiltroMes(m)} />
              ))}
            </div>

            {loading && <div style={{ color: "#666", textAlign: "center", padding: 30 }}>Cargando...</div>}

            {!loading && prospectosFiltrados.length === 0 && (
              <div style={{ color: "#666", textAlign: "center", padding: 30, fontSize: 13 }}>
                No hay prospectos con estos filtros.
              </div>
            )}

            {!loading && clavesOrdenadas.map(clave => {
              const grupo = grupos[clave];
              if (!grupo?.length) return null;

              let label, color;
              if (agrupacion === "mes") {
                label = clave === "sin_mes" ? "Sin mes asignado" : clave.charAt(0).toUpperCase() + clave.slice(1);
                color = "#d4a853";
              } else {
                const cfg = ESTADOS[clave] || { label: clave, color: "#666", emoji: "" };
                label = `${cfg.emoji} ${cfg.label}`;
                color = cfg.color;
              }

              return (
                <div key={clave} style={{ marginBottom: 18 }}>
                  <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    {label} ({grupo.length})
                  </div>
                  {grupo.map(p => {
                    const cfgEstado = ESTADOS[p.estado] || { color: "#666", label: p.estado };
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6 }}>
                        <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfgEstado.color, flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                          <div style={{ color: "#666", fontSize: 11 }}>
                            {[p.perfil, p.mes_primer_contacto].filter(Boolean).join(" · ")}
                          </div>
                        </div>
                        <select value={p.estado} onChange={e => actualizarEstado(p.id, e.target.value)} style={{ background: "rgba(0,0,0,0.4)", color: cfgEstado.color, border: `1px solid ${cfgEstado.color}55`, borderRadius: 6, fontSize: 10, padding: "3px 5px" }}>
                          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>}

          {tab === "buscador" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>La IA busca jugadores reales <strong style={{ color: "#d4a853" }}>en BeSoccer y Transfermarkt</strong> que no están en tu base de datos.</p>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ color: "#d4a853", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Filtros</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>Liga</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {LIGAS.map(l => <Pill key={l} label={l} active={finderFilters.liga === l} onClick={() => setFinderFilters(f => ({ ...f, liga: l }))} />)}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>Perfil</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PERFILES.map(p => <Pill key={p} label={p} active={finderFilters.perfil === p} onClick={() => setFinderFilters(f => ({ ...f, perfil: p }))} />)}
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 4 }}>Cantidad: <span style={{ color: "#d4a853", fontWeight: 700 }}>{finderFilters.cantidad}</span></div>
                <input type="range" min={3} max={10} value={finderFilters.cantidad} onChange={e => setFinderFilters(f => ({ ...f, cantidad: +e.target.value }))} style={{ width: "100%", accentColor: "#d4a853" }} />
              </div>
              <button onClick={buscar} disabled={finderLoading} style={{ width: "100%", background: finderLoading ? "#1a1a1a" : "linear-gradient(135deg, #d4a853, #c49240)", border: "none", borderRadius: 10, padding: 12, color: finderLoading ? "#444" : "#000", fontWeight: 700, fontSize: 13, cursor: finderLoading ? "default" : "pointer" }}>
                {finderLoading ? "Buscando en BeSoccer y Transfermarkt..." : "🔍 Buscar prospectos nuevos"}
              </button>
            </div>
            {finderResults?.error && <div style={{ color: "#f87171", fontSize: 12, padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 8 }}>{finderResults.error}</div>}
            {finderResults?.razonamiento && <p style={{ color: "#666", fontSize: 12, marginBottom: 12, fontStyle: "italic", lineHeight: 1.5 }}>{finderResults.razonamiento}</p>}
            {finderResults?.jugadores?.map((j, i) => {
              const done = generated.includes(j.nombre);
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{j.nombre}</div>
                      <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{j.posicion} · {j.club} · {j.edad} años</div>
                    </div>
                    <div style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, padding: "2px 7px", color: "#d4a853", fontSize: 10, whiteSpace: "nowrap" }}>{j.tipo_mensaje}</div>
                  </div>
                  <p style={{ color: "#999", fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>💡 {j.perfil}</p>
                  <button onClick={() => { setGenerated(g => [...g, j.nombre]); setTab("chat"); setInput(`Genera el DM para ${j.nombre}, ${j.posicion} del ${j.club}. Tipo: "${j.tipo_mensaje}".`); }}
                    disabled={done} style={{ width: "100%", background: done ? "rgba(74,222,128,0.1)" : "rgba(212,168,83,0.12)", border: `1px solid ${done ? "rgba(74,222,128,0.3)" : "rgba(212,168,83,0.3)"}`, borderRadius: 8, padding: 9, color: done ? "#4ade80" : "#d4a853", fontSize: 12, fontWeight: 600, cursor: done ? "default" : "pointer" }}>
                    {done ? "✓ DM generado" : "→ Generar DM"}
                  </button>
                </div>
              );
            })}
          </div>}

          {tab === "metricas" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ color: "#d4a853", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Evolución mes a mes</div>
            {metricas.map(m => {
              const tasa = m.contactados > 0 ? ((m.responden / m.contactados) * 100).toFixed(1) : "0";
              return (
                <div key={m.mes} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                    <strong style={{ fontSize: 14 }}>{m.mes}</strong>
                    <span style={{ color: "#d4a853", fontFamily: "monospace" }}>{tasa}% respuesta</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, fontSize: 11 }}>
                    <div><div style={{ color: "#666" }}>Contactados</div><div style={{ fontFamily: "monospace", fontSize: 16, color: "#fff" }}>{m.contactados}</div></div>
                    <div><div style={{ color: "#666" }}>Responden</div><div style={{ fontFamily: "monospace", fontSize: 16, color: "#4ade80" }}>{m.responden}</div></div>
                    <div><div style={{ color: "#666" }}>Negociación</div><div style={{ fontFamily: "monospace", fontSize: 16, color: "#d4a853" }}>{m.negociaciones}</div></div>
                  </div>
                </div>
              );
            })}
            {metricas.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>No hay métricas aún.</div>}
            <div style={{ color: "#666", fontSize: 11, textAlign: "center", padding: 16, marginTop: 10, border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 10 }}>
              🚧 Las métricas completas con embudo y objetivos están en la FASE B.
            </div>
          </div>}

          {tab === "analisis" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
              Qué tipo de primer mensaje tiene <strong style={{ color: "#d4a853" }}>mejor tasa de respuesta</strong>.
            </p>
            {analisis.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Sin datos suficientes aún.</div>}
            {analisis.map((a, i) => {
              const pct = a.tasa_respuesta_pct || 0;
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 13, marginBottom: 9 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                    <strong style={{ fontSize: 13 }}>{a.tipo_mensaje || "Sin clasificar"}</strong>
                    <span style={{ color: pct >= 20 ? "#4ade80" : pct >= 10 ? "#d4a853" : "#f87171", fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>{pct}%</span>
                  </div>
                  <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5, marginBottom: 5 }}>
                    <div style={{ background: pct >= 20 ? "#4ade80" : pct >= 10 ? "#d4a853" : "#f87171", width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 4, opacity: 0.8 }} />
                  </div>
                  <div style={{ color: "#666", fontSize: 11 }}>{a.respondidos} respuestas de {a.total_enviados} enviados</div>
                </div>
              );
            })}
          </div>}

        </div>
      </div>
    </div>
  );
}
