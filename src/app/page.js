"use client";
import { useState, useEffect, useRef } from "react";

const PROSPECTS = {
  negociacion: [
    { nombre: "Aitor Van Den Brule", tipo: "Home Gym", mes: "Marzo" },
    { nombre: "Miquel Piqué", tipo: "Centro entrenamiento", mes: "Marzo" },
    { nombre: "Manuel Murcia", tipo: "Proyecto", mes: "Abril" },
    { nombre: "Jaime Salom", tipo: "Home Gym", mes: "Febrero" },
    { nombre: "Pedro Mba Obiang", tipo: "Home Gym", mes: "Marzo" },
    { nombre: "Aitor Ruibal", tipo: "Home Gym", mes: "Marzo" },
  ],
  activos: [
    { nombre: "Juan Iglesias", tipo: "Retirado", estado: "Vídeo contestado ✓", msgs: 3 },
    { nombre: "Dani Cárdenas", tipo: "Portero", estado: "Contestó DM", msgs: 1 },
    { nombre: "Sheila Guijarro", tipo: "Jugadora", estado: "Vídeo leído", msgs: 3 },
    { nombre: "Nerea Eizaguirre", tipo: "Jugadora", estado: "Contestó FU", msgs: 2 },
    { nombre: "Nerea Pérez Machado", tipo: "Jugadora", estado: "Vídeo leído", msgs: 3 },
    { nombre: "Jon Perez Bolo", tipo: "Entrenador", estado: "Vídeo leído", msgs: 3 },
    { nombre: "Carlos Clerc", tipo: "Jugador", estado: "Contestó", msgs: 1 },
  ],
  leidos: [
    { nombre: "Raúl Tamudo", msgs: 2 }, { nombre: "Pablo Hernández", msgs: 2 },
    { nombre: "Aythami Artiles", msgs: 2 }, { nombre: "Iturraspe", msgs: 2 },
    { nombre: "Edu Aguirre", msgs: 2 }, { nombre: "Manu Fuster", msgs: 1 },
    { nombre: "Iñigo Vicente", msgs: 1 }, { nombre: "Pedro León", msgs: 1 },
    { nombre: "Oscar Trejo", msgs: 1 },
  ],
  urgentes: [
    { nombre: "Guillermo Vallejo", estado: "4 mensajes sin respuesta", msgs: 4 },
    { nombre: "Hugo Fraile", estado: "Vídeo enviado, sin respuesta", msgs: 3 },
    { nombre: "Piti Medina", estado: "Follow up pendiente", msgs: 2 },
  ],
};

const LIGAS = ["Hypermotion", "LaLiga", "Liga F", "Kings League", "Serie A", "Ligue 1", "Liga Portugal", "Bundesliga"];
const PERFILES = ["Jugadores", "Porteros", "Retirados", "Entrenadores", "Jugadoras", "Árbitros", "Kings League"];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "¡Buenas, Víctor! 👋 Tengo todos tus datos cargados.\n\nAhora mismo tienes **6 en negociación**, **7 conversaciones activas** y **9 que leyeron sin contestar**.\n\n¿Qué necesitas hoy?" }
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [finderFilters, setFinderFilters] = useState({ liga: "Hypermotion", perfil: "Jugadores", cantidad: 5 });
  const [finderResults, setFinderResults] = useState(null);
  const [finderLoading, setFinderLoading] = useState(false);
  const [generated, setGenerated] = useState([]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

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

  const renderMsg = (m, i) => {
    const isUser = m.role === "user";
    const parts = m.content.split(/(\*\*\*[\s\S]*?\*\*\*|\*\*.*?\*\*)/g);
    const formatted = parts.map((p, j) => {
      if (p.startsWith("***") && p.endsWith("***")) return (
        <div key={j} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.3)", borderRadius: 8, padding: "10px 12px", margin: "8px 0", fontFamily: "monospace", fontSize: 12, color: "#e0e0e0", whiteSpace: "pre-wrap" }}>{p.slice(3, -3).trim()}</div>
      );
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={j} style={{ color: "#d4a853" }}>{p.slice(2, -2)}</strong>;
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

  const Row = ({ p, urgent }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, background: urgent ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.03)", border: `1px solid ${urgent ? "rgba(248,113,113,0.2)" : "rgba(255,255,255,0.07)"}`, marginBottom: 7 }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: urgent ? "#f87171" : "#4ade80", flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{p.nombre}</div>
        <div style={{ color: "#555", fontSize: 11 }}>{p.tipo || p.estado || ""}{p.mes ? ` · ${p.mes}` : ""}</div>
      </div>
      {p.msgs && <div style={{ color: "#444", fontSize: 11, background: "rgba(255,255,255,0.05)", padding: "2px 7px", borderRadius: 10 }}>msg {p.msgs}</div>}
    </div>
  );

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{ background: active ? "rgba(212,168,83,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${active ? "#d4a853" : "rgba(255,255,255,0.1)"}`, borderRadius: 20, padding: "5px 11px", color: active ? "#d4a853" : "#777", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>
  );

  const quickActions = ["¿Quién toca hoy?", "DM para portero Hypermotion", "Estado Juan Iglesias", "Métricas abril", "Seguimientos urgentes"];

  return (
    <div style={{ height: "100dvh", background: "#0d0d0d", display: "flex", flexDirection: "column", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ padding: "14px 18px 0", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg, #d4a853, #7a4f1a)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, color: "#fff" }}>R</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#fff" }}>Ranuse Assistant</div>
            <div style={{ fontSize: 10, color: "#4ade80" }}>● Activo</div>
          </div>
        </div>
        <div style={{ display: "flex", overflowX: "auto", gap: 0, paddingBottom: 1 }}>
          {[["chat", "Chat"], ["buscador", "🔍 Buscador"], ["prospectos", "Prospectos"], ["metricas", "Métricas"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", borderBottom: tab === id ? "2px solid #d4a853" : "2px solid transparent", color: tab === id ? "#d4a853" : "#555", padding: "7px 13px", cursor: "pointer", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {tab === "chat" && <>
          <div style={{ padding: "8px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {quickActions.map((q, i) => <button key={i} onClick={() => setInput(q)} style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 20, padding: "4px 11px", color: "#d4a853", fontSize: 11, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>{q}</button>)}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "14px" }}>
            {msgs.map(renderMsg)}
            {chatLoading && <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#555", fontSize: 13 }}><div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #d4a853, #b8863a)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#000" }}>R</div>Pensando...</div>}
            <div ref={endRef} />
          </div>
          <div style={{ padding: "10px 14px", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", gap: 8, flexShrink: 0 }}>
            <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMsg()} placeholder="Escribe o usa 🎤 del teclado..." style={{ flex: 1, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: "10px 13px", color: "#fff", fontSize: 13, outline: "none" }} />
            <button onClick={sendMsg} disabled={chatLoading || !input.trim()} style={{ background: chatLoading || !input.trim() ? "#1a1a1a" : "linear-gradient(135deg, #d4a853, #c49240)", border: "none", borderRadius: 12, padding: "10px 15px", color: chatLoading || !input.trim() ? "#444" : "#000", cursor: chatLoading || !input.trim() ? "default" : "pointer", fontSize: 16, fontWeight: 700 }}>→</button>
          </div>
        </>}

        {tab === "buscador" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <p style={{ color: "#666", fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>La IA busca jugadores reales <strong style={{ color: "#d4a853" }}>que no están en tu Sheet</strong> y encajan con tu negocio.</p>
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
              {finderLoading ? "Buscando..." : "🔍 Buscar prospectos nuevos"}
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
                    <div style={{ color: "#fff", fontWeight: 700, fontSize: 14 }}>{j.nombre}</div>
                    <div style={{ color: "#555", fontSize: 11, marginTop: 2 }}>{j.posicion} · {j.club} · {j.edad} años</div>
                  </div>
                  <div style={{ background: "rgba(212,168,83,0.1)", border: "1px solid rgba(212,168,83,0.2)", borderRadius: 6, padding: "2px 7px", color: "#d4a853", fontSize: 10, marginLeft: 8, whiteSpace: "nowrap" }}>{j.tipo_mensaje}</div>
                </div>
                <p style={{ color: "#999", fontSize: 12, marginBottom: 10, lineHeight: 1.4 }}>💡 {j.perfil}</p>
                <button onClick={() => { setGenerated(g => [...g, j.nombre]); setTab("chat"); setInput(`Genera el DM para ${j.nombre}, ${j.posicion} del ${j.club} (${j.liga}). Usa el tipo "${j.tipo_mensaje}".`); }}
                  disabled={done} style={{ width: "100%", background: done ? "rgba(74,222,128,0.1)" : "rgba(212,168,83,0.12)", border: `1px solid ${done ? "rgba(74,222,128,0.3)" : "rgba(212,168,83,0.3)"}`, borderRadius: 8, padding: 9, color: done ? "#4ade80" : "#d4a853", fontSize: 12, fontWeight: 600, cursor: done ? "default" : "pointer" }}>
                  {done ? "✓ DM generado" : "→ Generar DM"}
                </button>
              </div>
            );
          })}
        </div>}

        {tab === "prospectos" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {[
            { label: "🔥 En negociación", data: PROSPECTS.negociacion, color: "#d4a853", urgent: false },
            { label: "✅ Conversaciones activas", data: PROSPECTS.activos, color: "#4ade80", urgent: false },
            { label: "👁 Leyeron sin contestar", data: PROSPECTS.leidos, color: "#f59e0b", urgent: false },
            { label: "⚡ Seguimiento urgente", data: PROSPECTS.urgentes, color: "#f87171", urgent: true },
          ].map(s => (
            <div key={s.label} style={{ marginBottom: 20 }}>
              <div style={{ color: s.color, fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{s.label} ({s.data.length})</div>
              {s.data.map((p, i) => <Row key={i} p={p} urgent={s.urgent} />)}
            </div>
          ))}
        </div>}

        {tab === "metricas" && <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
            {[
              { label: "Contactados Abril", value: "194", sub: "▼ vs 204 Marzo", c: "#d4a853" },
              { label: "Responden Abril", value: "6.2%", sub: "▼ vs 9.3% Marzo", c: "#f87171" },
              { label: "Mejor mes", value: "25%", sub: "Febrero (8 contactados)", c: "#4ade80" },
              { label: "En negociación", value: "6", sub: "Activos ahora", c: "#d4a853" },
            ].map((s, i) => (
              <div key={i} style={{ background: "rgba(255,255,255,0.04)", border: `1px solid ${s.c}22`, borderRadius: 12, padding: "13px 14px" }}>
                <div style={{ color: s.c, fontSize: 20, fontWeight: 700, fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ color: "#666", fontSize: 10, marginTop: 2 }}>{s.label}</div>
                <div style={{ color: s.c, fontSize: 10, marginTop: 3, opacity: 0.7 }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
            <div style={{ color: "#555", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>Embudo Abril 2026</div>
            {[
              { label: "Contactados", v: 194, pct: 100, c: "#d4a853" },
              { label: "Responden DM", v: 12, pct: 6.2, c: "#f59e0b" },
              { label: "Ven el vídeo", v: 6, pct: 50, c: "#4ade80" },
              { label: "Avanzan", v: 0, pct: 0, c: "#a78bfa" },
            ].map((r, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#bbb" }}>{r.label}</span>
                  <span style={{ fontSize: 12, color: r.c, fontWeight: 700 }}>{r.v} <span style={{ color: "#444", fontWeight: 400 }}>({r.pct}%)</span></span>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 4, height: 5 }}>
                  <div style={{ background: r.c, width: `${Math.max(r.pct, 0.5)}%`, height: "100%", borderRadius: 4, opacity: 0.8 }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ background: "rgba(212,168,83,0.07)", border: "1px solid rgba(212,168,83,0.18)", borderRadius: 12, padding: 13 }}>
            <div style={{ color: "#d4a853", fontSize: 12, fontWeight: 700, marginBottom: 5 }}>💡 Insight clave</div>
            <div style={{ color: "#888", fontSize: 12, lineHeight: 1.6 }}>El mensaje con humor supera al formal largo. Febrero con 25% demuestra que <strong style={{ color: "#ddd" }}>calidad {">"} cantidad</strong>. Con 6 en negociación, el foco ahora es <strong style={{ color: "#ddd" }}>cerrar, no contactar más</strong>.</div>
          </div>
        </div>}
      </div>
    </div>
  );
}
