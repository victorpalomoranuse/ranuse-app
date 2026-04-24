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
  venta:      { label: "Venta",      color: "#d4a853", emoji: "💰" },
};

const ORDEN_ESTADOS = ["venta", "interesado", "leido", "no_leido", "inviable", "rechazado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [prospectos, setProspectos] = useState([]);
  const [metricasCohorte, setMetricasCohorte] = useState([]);
  const [metricasCaja, setMetricasCaja] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "¡Buenas, Víctor! 👋\n\nTengo tus prospectos cargados desde Supabase. Puedes pedirme cosas como:\n\n• *\"Rubén Yáñez me ha contestado, pasa a interesado\"*\n• *\"Marca a Pedro Mba como venta de 4500€ el 15 de abril\"*\n• *\"Genera un DM para un portero de Hypermotion\"*\n• *\"¿A quién toca hacer seguimiento hoy?\"*" }
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
  const [agrupacion, setAgrupacion] = useState("mes");
  const [editando, setEditando] = useState(null); // prospecto id abierto en editor
  const [vistaMetricas, setVistaMetricas] = useState("cohorte"); // cohorte | caja
  const [editObjetivos, setEditObjetivos] = useState(false);

  useEffect(() => { cargarTodo(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  async function cargarTodo() {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch("/api/prospectos").then(r => r.json()),
        fetch("/api/objetivos").then(r => r.json()),
      ]);
      setProspectos(pRes.prospectos || []);
      setMetricasCohorte(pRes.metricasCohorte || []);
      setMetricasCaja(pRes.metricasCaja || []);
      setObjetivos(oRes.objetivos || []);
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
      cargarTodo();
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

  const guardarProspecto = async (id, cambios) => {
    await fetch("/api/prospectos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...cambios }),
    });
    cargarTodo();
  };

  const guardarObjetivo = async (id, cambios) => {
    await fetch("/api/objetivos", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...cambios }),
    });
    cargarTodo();
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
        return MESES.indexOf(b) - MESES.indexOf(a);
      })
    : ORDEN_ESTADOS.filter(e => grupos[e]);

  const mesesDisponibles = Array.from(new Set(prospectos.map(p => p.mes_primer_contacto).filter(Boolean)));

  // Totales para pestaña Objetivos
  const totales = prospectos.reduce((acc, p) => {
    acc.prospeccion += 1;
    if (p.estado === "interesado" || p.estado === "venta") acc.interesados += 1;
    if (p.estado === "venta") {
      acc.ventas += 1;
      acc.facturacion += Number(p.importe_venta) || 0;
    }
    return acc;
  }, { prospeccion: 0, interesados: 0, ventas: 0, facturacion: 0 });

  const objAnual = objetivos.find(o => o.tipo === "anual" && o.periodo === "2026");

  const prospectoEnEdicion = editando != null ? prospectos.find(p => p.id === editando) : null;

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
            {[["chat", "Chat"], ["prospectos", "Prospectos"], ["buscador", "🔍 Buscador"], ["metricas", "Métricas"], ["objetivos", "🎯 Objetivos"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? "2px solid #d4a853" : "2px solid transparent", color: tab === id ? "#d4a853" : "#555", padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {/* CHAT */}
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

          {/* PROSPECTOS */}
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
              <div style={{ color: "#666", textAlign: "center", padding: 30, fontSize: 13 }}>No hay prospectos con estos filtros.</div>
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
                      <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, marginBottom: 6 }}>
                        <div onClick={() => setEditando(editando === p.id ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer" }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfgEstado.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                            <div style={{ color: "#666", fontSize: 11 }}>
                              {[p.perfil, p.mes_primer_contacto, p.estado === "venta" && p.importe_venta ? `💰 ${p.importe_venta}€` : null].filter(Boolean).join(" · ")}
                            </div>
                          </div>
                          <div style={{ color: "#555", fontSize: 10 }}>{editando === p.id ? "▲" : "▼"}</div>
                        </div>

                        {editando === p.id && (
                          <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                            <Campo label="Estado">
                              <select value={p.estado} onChange={e => guardarProspecto(p.id, { estado: e.target.value })} style={inputStyle}>
                                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                              </select>
                            </Campo>
                            <Campo label="Mes primer contacto">
                              <select value={p.mes_primer_contacto || ""} onChange={e => guardarProspecto(p.id, { mes_primer_contacto: e.target.value || null })} style={inputStyle}>
                                <option value="">—</option>
                                {MESES.map(m => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </Campo>
                            <Campo label="Fecha respondió">
                              <input type="date" defaultValue={p.fecha_respuesta || ""} onBlur={e => guardarProspecto(p.id, { fecha_respuesta: e.target.value })} style={inputStyle} />
                            </Campo>
                            <Campo label="Fecha vídeo enviado">
                              <input type="date" defaultValue={p.fecha_video || ""} onBlur={e => guardarProspecto(p.id, { fecha_video: e.target.value })} style={inputStyle} />
                            </Campo>
                            <Campo label="Fecha llamada 1">
                              <input type="date" defaultValue={p.fecha_llamada1 || ""} onBlur={e => guardarProspecto(p.id, { fecha_llamada1: e.target.value })} style={inputStyle} />
                            </Campo>
                            <Campo label="Asistió llamada 1">
                              <select value={p.asistio_llamada1 === true ? "si" : p.asistio_llamada1 === false ? "no" : ""} onChange={e => guardarProspecto(p.id, { asistio_llamada1: e.target.value === "si" ? true : e.target.value === "no" ? false : null })} style={inputStyle}>
                                <option value="">—</option>
                                <option value="si">Sí</option>
                                <option value="no">No</option>
                              </select>
                            </Campo>
                            <Campo label="Fecha llamada 2">
                              <input type="date" defaultValue={p.fecha_llamada2 || ""} onBlur={e => guardarProspecto(p.id, { fecha_llamada2: e.target.value })} style={inputStyle} />
                            </Campo>
                            <Campo label="Fecha venta">
                              <input type="date" defaultValue={p.fecha_venta || ""} onBlur={e => guardarProspecto(p.id, { fecha_venta: e.target.value })} style={inputStyle} />
                            </Campo>
                            <Campo label="Importe venta (€)">
                              <input type="number" defaultValue={p.importe_venta || ""} onBlur={e => guardarProspecto(p.id, { importe_venta: e.target.value ? Number(e.target.value) : null })} style={inputStyle} placeholder="4500" />
                            </Campo>
                            <Campo label="Comentarios">
                              <textarea defaultValue={p.comentarios || ""} onBlur={e => guardarProspecto(p.id, { comentarios: e.target.value })} style={{ ...inputStyle, minHeight: 50, fontFamily: "inherit" }} />
                            </Campo>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>}

          {/* BUSCADOR */}
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

          {/* MÉTRICAS */}
          {tab === "metricas" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <Pill label="📅 Cohorte (mes de contacto)" active={vistaMetricas === "cohorte"} onClick={() => setVistaMetricas("cohorte")} />
              <Pill label="💶 Caja (mes de venta)" active={vistaMetricas === "caja"} onClick={() => setVistaMetricas("caja")} />
            </div>

            {vistaMetricas === "cohorte" && (
              <>
                <p style={{ color: "#666", fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>
                  De los prospectos contactados cada mes, cómo avanzan por el embudo (aunque la venta cierre meses después).
                </p>
                {metricasCohorte.map(m => (
                  <div key={m.mes} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <strong style={{ fontSize: 14, textTransform: "capitalize" }}>{m.mes}</strong>
                      <span style={{ color: "#d4a853", fontFamily: "monospace", fontSize: 11 }}>{m.facturacion.toLocaleString("es-ES")}€</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, fontSize: 11 }}>
                      <Metrica titulo="Contactados" valor={m.contactados} />
                      <Metrica titulo={`Responden (${m.pct_responden}%)`} valor={m.responden} color="#4ade80" />
                      <Metrica titulo={`Obj+Bloqueo (${m.pct_objetivo_bloqueo}%)`} valor={m.objetivo_bloqueo} color="#22c55e" />
                      <Metrica titulo="Vídeos" valor={m.videos} color="#f59e0b" />
                      <Metrica titulo={`Agendas (${m.pct_diseno_llamada}%)`} valor={m.agendas} color="#3b82f6" />
                      <Metrica titulo={`Asist. (${m.pct_asistencia}%)`} valor={m.asistencias} color="#3b82f6" />
                      <Metrica titulo="Llamada 2" valor={m.llamadas2} color="#3b82f6" />
                      <Metrica titulo={`Ventas (${m.pct_cierre}%)`} valor={m.ventas} color="#d4a853" />
                    </div>
                  </div>
                ))}
                {metricasCohorte.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>No hay datos aún.</div>}
              </>
            )}

            {vistaMetricas === "caja" && (
              <>
                <p style={{ color: "#666", fontSize: 11, marginBottom: 10, lineHeight: 1.5 }}>
                  Ventas y facturación según la fecha real en la que cerraron.
                </p>
                {metricasCaja.map(m => (
                  <div key={m.periodo} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: 14 }}>{m.periodo}</strong>
                      <span style={{ color: "#d4a853", fontFamily: "monospace", fontSize: 16, fontWeight: 700 }}>{m.facturacion.toLocaleString("es-ES")}€</span>
                    </div>
                    <div style={{ color: "#666", fontSize: 11, marginTop: 4 }}>{m.ventas} venta{m.ventas !== 1 ? "s" : ""}</div>
                  </div>
                ))}
                {metricasCaja.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Aún no hay ventas registradas con fecha.</div>}
              </>
            )}
          </div>}

          {/* OBJETIVOS */}
          {tab === "objetivos" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ color: "#d4a853", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Progreso 2026</div>
              <Pill label={editObjetivos ? "✓ Terminar" : "✏️ Editar"} active={editObjetivos} onClick={() => setEditObjetivos(!editObjetivos)} />
            </div>

            {objAnual && (
              <>
                <BarraObjetivo titulo="Prospección" actual={totales.prospeccion} objetivo={objAnual.prospeccion} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { prospeccion: v })} />
                <BarraObjetivo titulo="Interesados" actual={totales.interesados} objetivo={objAnual.interesados} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { interesados: v })} />
                <BarraObjetivo titulo="Ventas" actual={totales.ventas} objetivo={objAnual.ventas} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { ventas: v })} />
                <BarraObjetivo titulo="Facturación (€)" actual={totales.facturacion} objetivo={objAnual.facturacion} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { facturacion: v })} formato="euros" />
              </>
            )}

            <div style={{ color: "#d4a853", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 10 }}>Objetivos mensuales</div>
            {objetivos.filter(o => o.tipo === "mensual").map(o => (
              <div key={o.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, width: 65 }}>{o.periodo}</div>
                {editObjetivos ? (
                  <>
                    <CampoNum label="P" valor={o.prospeccion} onBlur={v => guardarObjetivo(o.id, { prospeccion: v })} />
                    <CampoNum label="I" valor={o.interesados} onBlur={v => guardarObjetivo(o.id, { interesados: v })} />
                    <CampoNum label="V" valor={o.ventas} onBlur={v => guardarObjetivo(o.id, { ventas: v })} />
                    <CampoNum label="€" valor={o.facturacion} onBlur={v => guardarObjetivo(o.id, { facturacion: v })} ancho={65} />
                  </>
                ) : (
                  <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#aaa" }}>
                    <span>P: <b style={{ color: "#fff" }}>{o.prospeccion}</b></span>
                    <span>I: <b style={{ color: "#fff" }}>{o.interesados}</b></span>
                    <span>V: <b style={{ color: "#fff" }}>{o.ventas}</b></span>
                    <span>€: <b style={{ color: "#d4a853" }}>{Number(o.facturacion).toLocaleString("es-ES")}</b></span>
                  </div>
                )}
              </div>
            ))}
          </div>}

        </div>
      </div>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  background: "rgba(0,0,0,0.4)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  fontSize: 12,
  padding: "6px 8px",
  outline: "none",
};

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ color: "#888", fontSize: 10, marginBottom: 3 }}>{label}</div>
      {children}
    </div>
  );
}

function CampoNum({ label, valor, onBlur, ancho = 45 }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      <span style={{ color: "#666", fontSize: 10 }}>{label}</span>
      <input type="number" defaultValue={valor} onBlur={e => onBlur(Number(e.target.value) || 0)} style={{ ...inputStyle, width: ancho, padding: "3px 6px", fontSize: 11 }} />
    </div>
  );
}

function Metrica({ titulo, valor, color = "#fff" }) {
  return (
    <div>
      <div style={{ color: "#666", fontSize: 10 }}>{titulo}</div>
      <div style={{ fontFamily: "monospace", fontSize: 16, color }}>{valor}</div>
    </div>
  );
}

function BarraObjetivo({ titulo, actual, objetivo, editar, onChange, formato }) {
  const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
  const fmt = (n) => formato === "euros" ? `${Number(n).toLocaleString("es-ES")}€` : Number(n).toLocaleString("es-ES");
  return (
    <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>{titulo}</strong>
        <div style={{ fontSize: 11, color: "#aaa" }}>
          <span style={{ color: "#d4a853", fontWeight: 700 }}>{fmt(actual)}</span> / {editar ? (
            <input type="number" defaultValue={objetivo} onBlur={e => onChange(Number(e.target.value) || 0)} style={{ ...inputStyle, display: "inline-block", width: 80, padding: "2px 6px", fontSize: 11 }} />
          ) : fmt(objetivo)}
        </div>
      </div>
      <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6 }}>
        <div style={{ background: pct >= 100 ? "#4ade80" : "#d4a853", width: `${pct}%`, height: "100%", borderRadius: 4, transition: "width 0.3s" }} />
      </div>
      <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>{pct.toFixed(1)}% completado</div>
    </div>
  );
}
