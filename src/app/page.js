"use client";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";

const LIGAS = ["Hypermotion", "LaLiga", "Liga F", "Kings League", "Serie A", "Ligue 1", "Liga Portugal", "Bundesliga"];
const PERFILES = ["Jugadores", "Porteros", "Retirados", "Entrenadores", "Jugadoras", "Árbitros", "Kings League"];

const ESTADOS = {
  no_leido:   { label: "No leído",   color: "#3b82f6", emoji: "🔵" },
  leido:      { label: "Leído",      color: "#f59e0b", emoji: "🟡" },
  interesado: { label: "Interesado", color: "#22c55e", emoji: "🟢" },
  inviable:   { label: "Inviable",   color: "#9ca3af", emoji: "⚪" },
  rechazado:  { label: "Rechazado",  color: "#f87171", emoji: "🔴" },
  venta:      { label: "Venta",      color: "#beb0a2", emoji: "💰" },
};

const ORDEN_ESTADOS = ["venta", "interesado", "leido", "no_leido", "inviable", "rechazado"];
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [prospectos, setProspectos] = useState([]);
  const [metricasCohorte, setMetricasCohorte] = useState([]);
  const [metricasCaja, setMetricasCaja] = useState([]);
  const [objetivos, setObjetivos] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [analisis, setAnalisis] = useState([]);
  const [loading, setLoading] = useState(true);

  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "¡Buenas, Víctor! 👋 Tengo tus **447 prospectos** listos.\n\nAhora tengo superpoderes. Puedes pedirme:\n\n• *\"Genera un DM para Borja Mayoral tipo jugadores corto\"*\n• *\"Guarda esta estructura como 'portero humor'\"*\n• *\"Rubén Yáñez me contestó, pasa a interesado\"*\n• *\"Marca a Pedro Mba como venta de 4500€\"*\n• *\"¿A quién toca hacer seguimiento?\"*\n• *\"¿Qué plantilla funciona mejor?\"*" }
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
  const [editando, setEditando] = useState(null);
  const [vistaMetricas, setVistaMetricas] = useState("cohorte");
  const [editObjetivos, setEditObjetivos] = useState(false);
  const [nuevaPlantilla, setNuevaPlantilla] = useState({ nombre: "", estructura: "", descripcion: "" });
  const [editandoPlantilla, setEditandoPlantilla] = useState(null);
  const [crearProspecto, setCrearProspecto] = useState(false);
  const [nuevoProspecto, setNuevoProspecto] = useState({ nombre: "", perfil: "", liga: "", mes_primer_contacto: "abril", estado: "no_leido", comentarios: "" });
  const [anadirMensaje, setAnadirMensaje] = useState(false);
  const [nuevoMensaje, setNuevoMensaje] = useState({ texto: "", plantilla_id: "" });

  // Mensajes del prospecto abierto
  const [mensajesProspecto, setMensajesProspecto] = useState([]);

  useEffect(() => { cargarTodo(); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (editando != null) {
      fetch(`/api/mensajes?prospecto_id=${editando}`).then(r => r.json()).then(d => setMensajesProspecto(d.mensajes || []));
    } else {
      setMensajesProspecto([]);
    }
  }, [editando]);

  async function cargarTodo() {
    setLoading(true);
    try {
      const [pRes, oRes, plRes, aRes] = await Promise.all([
        fetch("/api/prospectos").then(r => r.json()),
        fetch("/api/objetivos").then(r => r.json()),
        fetch("/api/plantillas").then(r => r.json()),
        fetch("/api/mensajes").then(r => r.json()),
      ]);
      setProspectos(pRes.prospectos || []);
      setMetricasCohorte(pRes.metricasCohorte || []);
      setMetricasCaja(pRes.metricasCaja || []);
      setObjetivos(oRes.objetivos || []);
      setPlantillas(plRes.plantillas || []);
      setAnalisis(aRes.analisis || []);
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
      const res = await fetch("/api/finder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(finderFilters) });
      const data = await res.json();
      setFinderResults(data);
    } catch { setFinderResults({ error: "Error al buscar." }); }
    setFinderLoading(false);
  };

  const guardarProspecto = async (id, cambios) => {
    await fetch("/api/prospectos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...cambios }) });
    cargarTodo();
  };

  const guardarObjetivo = async (id, cambios) => {
    await fetch("/api/objetivos", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...cambios }) });
    cargarTodo();
  };

  const guardarPlantilla = async (cambios, id) => {
    await fetch("/api/plantillas", { method: id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id, ...cambios } : cambios) });
    cargarTodo();
  };

  const borrarPlantilla = async (id) => {
    if (!confirm("¿Borrar esta plantilla?")) return;
    await fetch(`/api/plantillas?id=${id}`, { method: "DELETE" });
    cargarTodo();
  };

  const borrarMensaje = async (id) => {
    if (!confirm("¿Borrar este mensaje?")) return;
    await fetch(`/api/mensajes?id=${id}`, { method: "DELETE" });
    if (editando) fetch(`/api/mensajes?prospecto_id=${editando}`).then(r => r.json()).then(d => setMensajesProspecto(d.mensajes || []));
  };

  const crearProspectoManual = async () => {
    if (!nuevoProspecto.nombre.trim()) return;
    const res = await fetch("/api/prospectos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nuevoProspecto) });
    const data = await res.json();
    if (data.ok) {
      setNuevoProspecto({ nombre: "", perfil: "", liga: "", mes_primer_contacto: "abril", estado: "no_leido", comentarios: "" });
      setCrearProspecto(false);
      cargarTodo();
    } else {
      alert("Error: " + (data.error || "no se pudo crear"));
    }
  };

  const guardarNuevoMensaje = async () => {
    if (!nuevoMensaje.texto.trim() || !editando) return;
    const body = { prospecto_id: editando, texto: nuevoMensaje.texto };
    if (nuevoMensaje.plantilla_id) {
      const pl = plantillas.find(p => p.id === Number(nuevoMensaje.plantilla_id));
      if (pl) { body.plantilla_id = pl.id; body.tipo_mensaje = pl.nombre; }
    }
    const res = await fetch("/api/mensajes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.ok) {
      setNuevoMensaje({ texto: "", plantilla_id: "" });
      setAnadirMensaje(false);
      fetch(`/api/mensajes?prospecto_id=${editando}`).then(r => r.json()).then(d => setMensajesProspecto(d.mensajes || []));
      cargarTodo();
    } else {
      alert("Error: " + (data.error || "no se pudo guardar"));
    }
  };

  const renderMsg = (m, i) => {
    const isUser = m.role === "user";
    const parts = String(m.content).split(/(\*\*\*[\s\S]*?\*\*\*|\*\*.*?\*\*|\*.*?\*)/g);
    const formatted = parts.map((p, j) => {
      if (p.startsWith("***") && p.endsWith("***")) return (
        <div key={j} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 8, padding: "10px 12px", margin: "8px 0", fontFamily: "monospace", fontSize: 12, color: "#e0e0e0", whiteSpace: "pre-wrap" }}>{p.slice(3, -3).trim()}</div>
      );
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} style={{ color: "#beb0a2" }}>{p.slice(2, -2)}</strong>;
      if (p.startsWith("*") && p.endsWith("*")) return <em key={j} style={{ color: "#aaa" }}>{p.slice(1, -1)}</em>;
      return p;
    });
    return (
      <div key={i} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
        {!isUser && <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", marginRight: 8, flexShrink: 0, marginTop: 2, overflow: "hidden", border: "1px solid rgba(190,176,162,0.3)" }}><img src="/logo-ranuse.png" alt="R" style={{ width: 18, height: 18, objectFit: "contain" }} /></div>}
        <div style={{ maxWidth: "82%", background: isUser ? "linear-gradient(135deg, #beb0a2, #a89686)" : "rgba(255,255,255,0.06)", border: isUser ? "none" : "1px solid rgba(255,255,255,0.1)", borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px", padding: "10px 14px", color: isUser ? "#000" : "#e0e0e0", fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
          {formatted}
        </div>
      </div>
    );
  };

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{ background: active ? "rgba(212,168,83,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "#beb0a2" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "5px 11px", color: active ? "#beb0a2" : "#777", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  const quickActions = ["¿A quién seguir hoy?", "Qué plantilla funciona mejor", "Resumen de abril", "Prospectos interesados"];

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

  const totales = prospectos.reduce((acc, p) => {
    acc.prospeccion += 1;
    if (p.estado === "interesado" || p.estado === "venta") acc.interesados += 1;
    if (p.estado === "venta") { acc.ventas += 1; acc.facturacion += Number(p.importe_venta) || 0; }
    return acc;
  }, { prospeccion: 0, interesados: 0, ventas: 0, facturacion: 0 });

  const objAnual = objetivos.find(o => o.tipo === "anual" && o.periodo === "2026");

  return (
    <div style={{ minHeight: "100dvh", background: "#0d0d0d", color: "#fff", fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <style jsx global>{`
        * { box-sizing: border-box; }
        body { margin: 0; background: #0d0d0d; font-family: 'Montserrat', sans-serif; font-weight: 400; }
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&display=swap');
        h1, h2, h3, strong, .title { font-weight: 600; letter-spacing: -0.01em; }
        @media (min-width: 900px) {
          .ranuse-container { max-width: 1100px !important; padding: 20px; }
        }
      `}</style>

      <div className="ranuse-container" style={{ maxWidth: 520, margin: "0 auto", display: "flex", flexDirection: "column", height: "100dvh" }}>
        <div style={{ padding: "14px 18px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: "#0d0d0d", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid rgba(190,176,162,0.3)" }}><img src="/logo-ranuse.png" alt="Ranuse" style={{ width: 26, height: 26, objectFit: "contain" }} /></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Ranuse Assistant</div>
              <div style={{ fontSize: 10, color: loading ? "#888" : "#4ade80" }}>● {loading ? "Sincronizando..." : `${prospectos.length} prospectos · ${plantillas.length} plantillas`}</div>
            </div>
          </div>
          <div style={{ display: "flex", overflowX: "auto", gap: 0 }}>
            {[["chat", "Chat"], ["prospectos", "Prospectos"], ["buscador", "🔍 Buscador"], ["plantillas", "📝 Plantillas"], ["metricas", "Métricas"], ["objetivos", "🎯 Objetivos"], ["analisis", "📊 Análisis"]].map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? "2px solid #beb0a2" : "2px solid transparent", color: tab === id ? "#beb0a2" : "#555", padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>

          {tab === "chat" && <>
            <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 6, overflowX: "auto" }}>
                {quickActions.map((q, i) => <button key={i} onClick={() => setInput(q)} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 20, padding: "4px 11px", color: "#beb0a2", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{q}</button>)}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
              {msgs.map(renderMsg)}
              {chatLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 13 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a1a", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid rgba(190,176,162,0.3)" }}><img src="/logo-ranuse.png" alt="R" style={{ width: 18, height: 18, objectFit: "contain" }} /></div>Pensando...</div>}
              <div ref={endRef} />
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0 }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg()} placeholder="Dile al agente lo que quieres..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none" }} />
              <button onClick={sendMsg} disabled={chatLoading || !input.trim()} style={{ background: chatLoading || !input.trim() ? "#1a1a1a" : "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 12, padding: "10px 15px", color: chatLoading || !input.trim() ? "#444" : "#000", cursor: chatLoading || !input.trim() ? "default" : "pointer", fontSize: 16, fontWeight: 700 }}>→</button>
            </div>
          </>}

          {tab === "prospectos" && <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            <button onClick={() => setCrearProspecto(!crearProspecto)} style={{ width: "100%", background: crearProspecto ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 10, padding: 11, color: crearProspecto ? "#beb0a2" : "#000", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>{crearProspecto ? "✕ Cancelar" : "➕ Nuevo prospecto"}</button>
            {crearProspecto && <div style={{ background: "rgba(190,176,162,0.05)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
              <input placeholder="Nombre completo *" value={nuevoProspecto.nombre} onChange={e => setNuevoProspecto(p => ({ ...p, nombre: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />
              <select value={nuevoProspecto.perfil} onChange={e => setNuevoProspecto(p => ({ ...p, perfil: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                <option value="">Perfil...</option>{PERFILES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <select value={nuevoProspecto.liga} onChange={e => setNuevoProspecto(p => ({ ...p, liga: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                <option value="">Liga...</option>{LIGAS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
              <select value={nuevoProspecto.mes_primer_contacto} onChange={e => setNuevoProspecto(p => ({ ...p, mes_primer_contacto: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                {MESES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <select value={nuevoProspecto.estado} onChange={e => setNuevoProspecto(p => ({ ...p, estado: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <textarea placeholder="Comentarios (opcional)" value={nuevoProspecto.comentarios} onChange={e => setNuevoProspecto(p => ({ ...p, comentarios: e.target.value }))} style={{ ...inputStyle, minHeight: 50, marginBottom: 8, fontFamily: "inherit" }} />
              <button onClick={crearProspectoManual} disabled={!nuevoProspecto.nombre.trim()} style={{ width: "100%", background: nuevoProspecto.nombre.trim() ? "linear-gradient(135deg, #beb0a2, #a89686)" : "#1a1a1a", border: "none", borderRadius: 8, padding: 9, color: nuevoProspecto.nombre.trim() ? "#000" : "#444", fontSize: 12, fontWeight: 700, cursor: nuevoProspecto.nombre.trim() ? "pointer" : "default" }}>Crear prospecto</button>
            </div>}
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar por nombre..." style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "9px 12px", color: "#fff", fontSize: 13, marginBottom: 10 }} />

            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              <Pill label="Agrupar por mes" active={agrupacion === "mes"} onClick={() => setAgrupacion("mes")} />
              <Pill label="Agrupar por estado" active={agrupacion === "estado"} onClick={() => setAgrupacion("estado")} />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              <Pill label="Todos los estados" active={filtroEstado==="all"} onClick={() => setFiltroEstado("all")} />
              {Object.entries(ESTADOS).map(([k, v]) => <Pill key={k} label={`${v.emoji} ${v.label}`} active={filtroEstado===k} onClick={() => setFiltroEstado(k)} />)}
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
              <Pill label="Todos los meses" active={filtroMes==="all"} onClick={() => setFiltroMes("all")} />
              {mesesDisponibles.map(m => <Pill key={m} label={m} active={filtroMes===m} onClick={() => setFiltroMes(m)} />)}
            </div>

            {loading && <div style={{ color: "#666", textAlign: "center", padding: 30 }}>Cargando...</div>}
            {!loading && prospectosFiltrados.length === 0 && <div style={{ color: "#666", textAlign: "center", padding: 30, fontSize: 13 }}>No hay prospectos con estos filtros.</div>}

            {!loading && clavesOrdenadas.map(clave => {
              const grupo = grupos[clave];
              if (!grupo?.length) return null;
              let label, color;
              if (agrupacion === "mes") {
                label = clave === "sin_mes" ? "Sin mes asignado" : clave.charAt(0).toUpperCase() + clave.slice(1);
                color = "#beb0a2";
              } else {
                const cfg = ESTADOS[clave] || { label: clave, color: "#666", emoji: "" };
                label = `${cfg.emoji} ${cfg.label}`;
                color = cfg.color;
              }
              return (
                <div key={clave} style={{ marginBottom: 18 }}>
                  <div style={{ color, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{label} ({grupo.length})</div>
                  {grupo.map(p => {
                    const cfgEstado = ESTADOS[p.estado] || { color: "#666", label: p.estado };
                    return (
                      <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, marginBottom: 6 }}>
                        <div onClick={() => setEditando(editando === p.id ? null : p.id)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", cursor: "pointer" }}>
                          <div style={{ width: 7, height: 7, borderRadius: "50%", background: cfgEstado.color, flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.nombre}</div>
                            <div style={{ color: "#666", fontSize: 11 }}>{[p.perfil, p.mes_primer_contacto, p.estado === "venta" && p.importe_venta ? `💰 ${p.importe_venta}€` : null, p.num_mensajes > 0 ? `📨 ${p.num_mensajes} msg${p.num_mensajes > 1 ? "s" : ""}` : null].filter(Boolean).join(" · ")}</div>
                          </div>
                          <div style={{ color: "#555", fontSize: 10 }}>{editando === p.id ? "▲" : "▼"}</div>
                        </div>

                        {editando === p.id && (
                          <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                            <Campo label="Estado"><select value={p.estado} onChange={e => guardarProspecto(p.id, { estado: e.target.value })} style={inputStyle}>{Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Campo>
                            <Campo label="Mes primer contacto"><select value={p.mes_primer_contacto || ""} onChange={e => guardarProspecto(p.id, { mes_primer_contacto: e.target.value || null })} style={inputStyle}><option value="">—</option>{MESES.map(m => <option key={m} value={m}>{m}</option>)}</select></Campo>
                            <Campo label="Fecha respondió"><input type="date" defaultValue={p.fecha_respuesta || ""} onBlur={e => guardarProspecto(p.id, { fecha_respuesta: e.target.value })} style={inputStyle} /></Campo>
                            <Campo label="Fecha vídeo enviado"><input type="date" defaultValue={p.fecha_video || ""} onBlur={e => guardarProspecto(p.id, { fecha_video: e.target.value })} style={inputStyle} /></Campo>
                            <Campo label="Fecha llamada 1"><input type="date" defaultValue={p.fecha_llamada1 || ""} onBlur={e => guardarProspecto(p.id, { fecha_llamada1: e.target.value })} style={inputStyle} /></Campo>
                            <Campo label="Asistió llamada 1"><select value={p.asistio_llamada1 === true ? "si" : p.asistio_llamada1 === false ? "no" : ""} onChange={e => guardarProspecto(p.id, { asistio_llamada1: e.target.value === "si" ? true : e.target.value === "no" ? false : null })} style={inputStyle}><option value="">—</option><option value="si">Sí</option><option value="no">No</option></select></Campo>
                            <Campo label="Fecha llamada 2"><input type="date" defaultValue={p.fecha_llamada2 || ""} onBlur={e => guardarProspecto(p.id, { fecha_llamada2: e.target.value })} style={inputStyle} /></Campo>
                            <Campo label="Fecha venta"><input type="date" defaultValue={p.fecha_venta || ""} onBlur={e => guardarProspecto(p.id, { fecha_venta: e.target.value })} style={inputStyle} /></Campo>
                            <Campo label="Importe venta (€)"><input type="number" defaultValue={p.importe_venta || ""} onBlur={e => guardarProspecto(p.id, { importe_venta: e.target.value ? Number(e.target.value) : null })} style={inputStyle} placeholder="4500" /></Campo>
                            <Campo label="Comentarios"><textarea defaultValue={p.comentarios || ""} onBlur={e => guardarProspecto(p.id, { comentarios: e.target.value })} style={{ ...inputStyle, minHeight: 50, fontFamily: "inherit" }} /></Campo>

                            <button onClick={() => setAnadirMensaje(!anadirMensaje)} style={{ width: "100%", background: anadirMensaje ? "rgba(255,255,255,0.08)" : "rgba(190,176,162,0.12)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 8, padding: 8, color: "#beb0a2", fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 8, marginBottom: 8 }}>{anadirMensaje ? "✕ Cancelar" : "➕ Añadir mensaje enviado"}</button>
                            {anadirMensaje && <div style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 8, padding: 8, marginBottom: 8 }}>
                              <select value={nuevoMensaje.plantilla_id} onChange={e => setNuevoMensaje(m => ({ ...m, plantilla_id: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                                <option value="">Sin plantilla</option>
                                {plantillas.map(pl => <option key={pl.id} value={pl.id}>{pl.nombre}</option>)}
                              </select>
                              <textarea placeholder="Texto del mensaje enviado..." value={nuevoMensaje.texto} onChange={e => setNuevoMensaje(m => ({ ...m, texto: e.target.value }))} style={{ ...inputStyle, minHeight: 60, marginBottom: 6, fontFamily: "inherit" }} />
                              <button onClick={guardarNuevoMensaje} disabled={!nuevoMensaje.texto.trim()} style={{ width: "100%", background: nuevoMensaje.texto.trim() ? "linear-gradient(135deg, #beb0a2, #a89686)" : "#1a1a1a", border: "none", borderRadius: 6, padding: 7, color: nuevoMensaje.texto.trim() ? "#000" : "#444", fontSize: 11, fontWeight: 700, cursor: nuevoMensaje.texto.trim() ? "pointer" : "default" }}>Guardar como #{mensajesProspecto.length + 1} {mensajesProspecto.length > 0 ? "(seguimiento)" : "(inicial)"}</button>
                            </div>}
                            {mensajesProspecto.length > 0 && (
                              <div style={{ marginTop: 10 }}>
                                <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>📨 Historial ({mensajesProspecto.length})</div>
                                {mensajesProspecto.map(m => (
                                  <div key={m.id} style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 6, padding: "6px 8px", marginBottom: 5, fontSize: 11 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                                      <span style={{ color: "#beb0a2", fontWeight: 700 }}>#{m.secuencia} · {m.tipo_mensaje || "sin plantilla"}</span>
                                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                                        <span style={{ color: "#666", fontSize: 10 }}>{m.enviado_en}</span>
                                        <button onClick={() => borrarMensaje(m.id)} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", fontSize: 10 }}>✕</button>
                                      </div>
                                    </div>
                                    <div style={{ color: "#ccc", fontSize: 11, whiteSpace: "pre-wrap", maxHeight: 60, overflow: "hidden" }}>{m.texto}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>}

          {tab === "buscador" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>La IA busca jugadores reales <strong style={{ color: "#beb0a2" }}>en BeSoccer y Transfermarkt</strong> que no están en tu base de datos.</p>
            <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}>Filtros</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>Liga</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{LIGAS.map(l => <Pill key={l} label={l} active={finderFilters.liga === l} onClick={() => setFinderFilters(f => ({ ...f, liga: l }))} />)}</div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 6 }}>Perfil</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{PERFILES.map(p => <Pill key={p} label={p} active={finderFilters.perfil === p} onClick={() => setFinderFilters(f => ({ ...f, perfil: p }))} />)}</div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <div style={{ color: "#666", fontSize: 11, marginBottom: 4 }}>Cantidad: <span style={{ color: "#beb0a2", fontWeight: 700 }}>{finderFilters.cantidad}</span></div>
                <input type="range" min={3} max={10} value={finderFilters.cantidad} onChange={e => setFinderFilters(f => ({ ...f, cantidad: +e.target.value }))} style={{ width: "100%", accentColor: "#beb0a2" }} />
              </div>
              <button onClick={buscar} disabled={finderLoading} style={{ width: "100%", background: finderLoading ? "#1a1a1a" : "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 10, padding: 12, color: finderLoading ? "#444" : "#000", fontWeight: 700, fontSize: 13, cursor: finderLoading ? "default" : "pointer" }}>{finderLoading ? "Buscando..." : "🔍 Buscar prospectos nuevos"}</button>
            </div>
            {finderResults?.error && <div style={{ color: "#f87171", fontSize: 12, padding: "8px 12px", background: "rgba(248,113,113,0.1)", borderRadius: 8 }}>{finderResults.error}</div>}
            {finderResults?.razonamiento && <p style={{ color: "#666", fontSize: 12, marginBottom: 12, fontStyle: "italic" }}>{finderResults.razonamiento}</p>}
            {finderResults?.jugadores?.map((j, i) => {
              const done = generated.includes(j.nombre);
              return (
                <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "12px 14px", marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div><div style={{ fontWeight: 700, fontSize: 14 }}>{j.nombre}</div><div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{j.posicion} · {j.club} · {j.edad} años</div></div>
                    <div style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, padding: "2px 7px", color: "#beb0a2", fontSize: 10 }}>{j.tipo_mensaje}</div>
                  </div>
                  <p style={{ color: "#999", fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>💡 {j.perfil}</p>
                  <button onClick={() => { setGenerated(g => [...g, j.nombre]); setTab("chat"); setInput(`Genera el DM para ${j.nombre}, ${j.posicion} del ${j.club}. Tipo: "${j.tipo_mensaje}".`); }} disabled={done} style={{ width: "100%", background: done ? "rgba(74,222,128,0.1)" : "rgba(212,168,83,0.12)", border: `1px solid ${done ? "rgba(74,222,128,0.3)" : "rgba(212,168,83,0.3)"}`, borderRadius: 8, padding: 9, color: done ? "#4ade80" : "#beb0a2", fontSize: 12, fontWeight: 600, cursor: done ? "default" : "pointer" }}>{done ? "✓ DM generado" : "→ Generar DM"}</button>
                </div>
              );
            })}
          </div>}

          {tab === "plantillas" && <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>Plantillas guardadas. Puedes crearlas hablando con el agente (<em>"guarda esto como X"</em>) o desde aquí.</p>

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>➕ Nueva plantilla</div>
              <input placeholder="Nombre (ej: jugadores corto)" value={nuevaPlantilla.nombre} onChange={e => setNuevaPlantilla(p => ({ ...p, nombre: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />
              <textarea placeholder="Estructura del mensaje..." value={nuevaPlantilla.estructura} onChange={e => setNuevaPlantilla(p => ({ ...p, estructura: e.target.value }))} style={{ ...inputStyle, minHeight: 80, marginBottom: 6, fontFamily: "inherit" }} />
              <input placeholder="Descripción (opcional)" value={nuevaPlantilla.descripcion} onChange={e => setNuevaPlantilla(p => ({ ...p, descripcion: e.target.value }))} style={{ ...inputStyle, marginBottom: 8 }} />
              <button onClick={async () => { if (nuevaPlantilla.nombre && nuevaPlantilla.estructura) { await guardarPlantilla(nuevaPlantilla); setNuevaPlantilla({ nombre: "", estructura: "", descripcion: "" }); } }} style={{ width: "100%", background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 8, padding: 9, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Guardar plantilla</button>
            </div>

            {plantillas.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Aún no tienes plantillas guardadas.</div>}
            {plantillas.map(pl => (
              <div key={pl.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <strong style={{ color: "#beb0a2", fontSize: 13, textTransform: "uppercase" }}>{pl.nombre}</strong>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setEditandoPlantilla(editandoPlantilla === pl.id ? null : pl.id)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#888", fontSize: 10, padding: "2px 7px", cursor: "pointer" }}>{editandoPlantilla === pl.id ? "✓" : "✎"}</button>
                    <button onClick={() => borrarPlantilla(pl.id)} style={{ background: "none", border: "1px solid rgba(248,113,113,0.3)", borderRadius: 6, color: "#f87171", fontSize: 10, padding: "2px 7px", cursor: "pointer" }}>🗑</button>
                  </div>
                </div>
                {pl.descripcion && <div style={{ color: "#888", fontSize: 11, fontStyle: "italic", marginBottom: 6 }}>{pl.descripcion}</div>}
                {editandoPlantilla === pl.id ? (
                  <textarea defaultValue={pl.estructura} onBlur={e => { guardarPlantilla({ estructura: e.target.value }, pl.id); setEditandoPlantilla(null); }} style={{ ...inputStyle, minHeight: 100, fontFamily: "inherit" }} />
                ) : (
                  <div style={{ background: "rgba(0,0,0,0.3)", borderRadius: 6, padding: 8, color: "#ccc", fontSize: 11, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>{pl.estructura}</div>
                )}
              </div>
            ))}
          </div>}

          {tab === "metricas" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
              <Pill label="📅 Cohorte" active={vistaMetricas === "cohorte"} onClick={() => setVistaMetricas("cohorte")} />
              <Pill label="💶 Caja" active={vistaMetricas === "caja"} onClick={() => setVistaMetricas("caja")} />
            </div>

            {vistaMetricas === "cohorte" && <>
              <p style={{ color: "#666", fontSize: 11, marginBottom: 10 }}>Embudo por mes de primer contacto.</p>
              {metricasCohorte.map(m => (
                <div key={m.mes} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <strong style={{ fontSize: 14, textTransform: "capitalize" }}>{m.mes}</strong>
                    <span style={{ color: "#beb0a2", fontFamily: "monospace", fontSize: 11 }}>{m.facturacion.toLocaleString("es-ES")}€</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10, fontSize: 11 }}>
                    <Metrica titulo="Contactados" valor={m.contactados} />
                    <Metrica titulo={`Responden (${m.pct_responden}%)`} valor={m.responden} color="#4ade80" />
                    <Metrica titulo={`Obj+Bloqueo (${m.pct_objetivo_bloqueo}%)`} valor={m.objetivo_bloqueo} color="#22c55e" />
                    <Metrica titulo="Vídeos" valor={m.videos} color="#f59e0b" />
                    <Metrica titulo={`Agendas (${m.pct_diseno_llamada}%)`} valor={m.agendas} color="#3b82f6" />
                    <Metrica titulo={`Asist. (${m.pct_asistencia}%)`} valor={m.asistencias} color="#3b82f6" />
                    <Metrica titulo="Llamada 2" valor={m.llamadas2} color="#3b82f6" />
                    <Metrica titulo={`Ventas (${m.pct_cierre}%)`} valor={m.ventas} color="#beb0a2" />
                  </div>
                </div>
              ))}
              {metricasCohorte.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>No hay datos.</div>}
            </>}

            {vistaMetricas === "caja" && <>
              <p style={{ color: "#666", fontSize: 11, marginBottom: 10 }}>Facturación según fecha real de venta.</p>
              {metricasCaja.map(m => (
                <div key={m.periodo} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: 14 }}>{m.periodo}</strong>
                    <span style={{ color: "#beb0a2", fontFamily: "monospace", fontSize: 16, fontWeight: 700 }}>{m.facturacion.toLocaleString("es-ES")}€</span>
                  </div>
                  <div style={{ color: "#666", fontSize: 11, marginTop: 4 }}>{m.ventas} venta{m.ventas !== 1 ? "s" : ""}</div>
                </div>
              ))}
              {metricasCaja.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Aún no hay ventas con fecha.</div>}
            </>}
          </div>}

          {tab === "objetivos" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" }}>Progreso 2026</div>
              <Pill label={editObjetivos ? "✓ Terminar" : "✏️ Editar"} active={editObjetivos} onClick={() => setEditObjetivos(!editObjetivos)} />
            </div>

            {objAnual && <>
              <BarraObjetivo titulo="Prospección" actual={totales.prospeccion} objetivo={objAnual.prospeccion} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { prospeccion: v })} />
              <BarraObjetivo titulo="Interesados" actual={totales.interesados} objetivo={objAnual.interesados} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { interesados: v })} />
              <BarraObjetivo titulo="Ventas" actual={totales.ventas} objetivo={objAnual.ventas} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { ventas: v })} />
              <BarraObjetivo titulo="Facturación" actual={totales.facturacion} objetivo={objAnual.facturacion} editar={editObjetivos} onChange={v => guardarObjetivo(objAnual.id, { facturacion: v })} formato="euros" />
            </>}

            <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginTop: 24, marginBottom: 10 }}>Objetivos mensuales</div>
            {objetivos.filter(o => o.tipo === "mensual").map(o => (
              <div key={o.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 10, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, width: 65 }}>{o.periodo}</div>
                {editObjetivos ? <>
                  <CampoNum label="P" valor={o.prospeccion} onBlur={v => guardarObjetivo(o.id, { prospeccion: v })} />
                  <CampoNum label="I" valor={o.interesados} onBlur={v => guardarObjetivo(o.id, { interesados: v })} />
                  <CampoNum label="V" valor={o.ventas} onBlur={v => guardarObjetivo(o.id, { ventas: v })} />
                  <CampoNum label="€" valor={o.facturacion} onBlur={v => guardarObjetivo(o.id, { facturacion: v })} ancho={65} />
                </> : <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#aaa" }}><span>P: <b style={{ color: "#fff" }}>{o.prospeccion}</b></span><span>I: <b style={{ color: "#fff" }}>{o.interesados}</b></span><span>V: <b style={{ color: "#fff" }}>{o.ventas}</b></span><span>€: <b style={{ color: "#beb0a2" }}>{Number(o.facturacion).toLocaleString("es-ES")}</b></span></div>}
              </div>
            ))}
          </div>}

          {tab === "analisis" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 14 }}>Qué plantillas tienen mejor tasa de respuesta y venta. Solo se analizan mensajes guardados (no seguimientos).</p>
            {analisis.length === 0 && <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 30 }}>Aún no hay mensajes guardados para analizar. Empieza a guardarlos desde el chat.</div>}
            {analisis.map((a, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 13, marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                  <strong style={{ fontSize: 13, textTransform: "uppercase", color: "#beb0a2" }}>{a.nombre}</strong>
                  <span style={{ color: a.tasa_respuesta >= 20 ? "#4ade80" : a.tasa_respuesta >= 10 ? "#beb0a2" : "#f87171", fontFamily: "monospace", fontSize: 14, fontWeight: 700 }}>{a.tasa_respuesta}%</span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5, marginBottom: 8 }}>
                  <div style={{ background: a.tasa_respuesta >= 20 ? "#4ade80" : a.tasa_respuesta >= 10 ? "#beb0a2" : "#f87171", width: `${Math.min(a.tasa_respuesta, 100)}%`, height: "100%", borderRadius: 4, opacity: 0.8 }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, fontSize: 11 }}>
                  <div><div style={{ color: "#666" }}>Enviados</div><div style={{ fontFamily: "monospace", color: "#fff", fontSize: 14 }}>{a.enviados}</div></div>
                  <div><div style={{ color: "#666" }}>Respuestas</div><div style={{ fontFamily: "monospace", color: "#4ade80", fontSize: 14 }}>{a.respondidos}</div></div>
                  <div><div style={{ color: "#666" }}>Interesados</div><div style={{ fontFamily: "monospace", color: "#22c55e", fontSize: 14 }}>{a.interesados}</div></div>
                  <div><div style={{ color: "#666" }}>Ventas</div><div style={{ fontFamily: "monospace", color: "#beb0a2", fontSize: 14 }}>{a.ventas}</div></div>
                </div>
              </div>
            ))}
          </div>}

        </div>
      </div>
    </div>
  );
}

const inputStyle = { width: "100%", background: "rgba(0,0,0,0.4)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12, padding: "6px 8px", outline: "none" };

function Campo({ label, children }) { return <div style={{ marginBottom: 8 }}><div style={{ color: "#888", fontSize: 10, marginBottom: 3 }}>{label}</div>{children}</div>; }
function CampoNum({ label, valor, onBlur, ancho = 45 }) { return <div style={{ display: "flex", alignItems: "center", gap: 3 }}><span style={{ color: "#666", fontSize: 10 }}>{label}</span><input type="number" defaultValue={valor} onBlur={e => onBlur(Number(e.target.value) || 0)} style={{ ...inputStyle, width: ancho, padding: "3px 6px", fontSize: 11 }} /></div>; }
function Metrica({ titulo, valor, color = "#fff" }) { return <div><div style={{ color: "#666", fontSize: 10 }}>{titulo}</div><div style={{ fontFamily: "monospace", fontSize: 16, color }}>{valor}</div></div>; }
function BarraObjetivo({ titulo, actual, objetivo, editar, onChange, formato }) {
  const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
  const fmt = (n) => formato === "euros" ? `${Number(n).toLocaleString("es-ES")}€` : Number(n).toLocaleString("es-ES");
  return <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 14, marginBottom: 10 }}>
    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
      <strong style={{ fontSize: 13 }}>{titulo}</strong>
      <div style={{ fontSize: 11, color: "#aaa" }}><span style={{ color: "#beb0a2", fontWeight: 700 }}>{fmt(actual)}</span> / {editar ? <input type="number" defaultValue={objetivo} onBlur={e => onChange(Number(e.target.value) || 0)} style={{ ...inputStyle, display: "inline-block", width: 80, padding: "2px 6px", fontSize: 11 }} /> : fmt(objetivo)}</div>
    </div>
    <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 6 }}><div style={{ background: pct >= 100 ? "#4ade80" : "#beb0a2", width: `${pct}%`, height: "100%", borderRadius: 4 }} /></div>
    <div style={{ color: "#666", fontSize: 10, marginTop: 4 }}>{pct.toFixed(1)}% completado</div>
  </div>;
}
