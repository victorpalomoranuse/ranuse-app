"use client";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const DIAS = ["L","M","X","J","V","S","D"];

const inputStyle = { width: "100%", background: "rgba(0,0,0,0.4)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12, padding: "6px 8px", outline: "none" };

// ===== Helpers de fecha (timezone-safe) =====
// Usamos siempre el día/mes/año LOCAL para evitar desfases con UTC.
function toYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Fecha de hoy en formato YYYY-MM-DD según hora local
function todayYMD() {
  return toYMD(new Date());
}

// Extrae el YYYY-MM-DD de un timestamp ISO mostrando la fecha LOCAL
// (no la UTC, que es lo que daría .slice(0,10))
function isoToLocalYMD(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return toYMD(d);
}

export default function CalendarioTab() {
  const [vista, setVista] = useState("calendario");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [events, setEvents] = useState([]);
  const [prospectos, setProspectos] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [filterTasks, setFilterTasks] = useState("pendientes");

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [t, e, pr, proj] = await Promise.all([
        supabase.from("tasks").select("*").order("fecha", { ascending: true, nullsFirst: false }),
        supabase.from("events").select("*").order("fecha_inicio", { ascending: true }),
        supabase.from("prospectos").select("id,nombre").order("nombre"),
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
      ]);
      setTasks(t.data || []);
      setEvents(e.data || []);
      setProspectos(pr.data || []);
      setProjects(proj.data || []);
    } catch (err) { console.error(err); }
    setLoading(false);
  }

  const daysOfMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const offset = (firstDay.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  function tasksForDay(d) {
    const ymd = toYMD(d);
    return tasks.filter(t => t.fecha === ymd);
  }
  function eventsForDay(d) {
    const ymd = toYMD(d);
    return events.filter(e => isoToLocalYMD(e.fecha_inicio) === ymd);
  }

  function changeMonth(delta) {
    const n = new Date(currentMonth);
    n.setMonth(n.getMonth() + delta);
    setCurrentMonth(n);
  }

  const filteredTasks = useMemo(() => {
    const today = todayYMD();
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekEndStr = toYMD(weekEnd);
    return tasks.filter(t => {
      if (filterTasks === "pendientes") return !t.completada;
      if (filterTasks === "hoy") return t.fecha === today && !t.completada;
      if (filterTasks === "semana") return t.fecha && t.fecha >= today && t.fecha <= weekEndStr && !t.completada;
      if (filterTasks === "atrasadas") return t.fecha && t.fecha < today && !t.completada;
      return true;
    });
  }, [tasks, filterTasks]);

  async function toggleTask(t) {
    const completada = !t.completada;
    await supabase.from("tasks").update({
      completada,
      fecha_completada: completada ? new Date().toISOString() : null,
    }).eq("id", t.id);
    loadAll();
  }

  async function deleteTask(id) {
    if (!confirm("¿Eliminar tarea?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    loadAll();
  }

  async function deleteEvent(id) {
    if (!confirm("¿Eliminar evento?")) return;
    await supabase.from("events").delete().eq("id", id);
    loadAll();
  }

  const today = todayYMD();
  const tareasPendientes = tasks.filter(t => !t.completada).length;
  const tareasHoy = tasks.filter(t => t.fecha === today && !t.completada).length;
  const tareasAtrasadas = tasks.filter(t => t.fecha && t.fecha < today && !t.completada).length;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setShowNew("task")} style={{ flex: 1, background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 10, padding: 10, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Tarea</button>
        <button onClick={() => setShowNew("event")} style={{ flex: 1, background: "rgba(190,176,162,0.12)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 10, padding: 10, color: "#beb0a2", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Evento</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Pendientes</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#beb0a2", fontFamily: "monospace" }}>{tareasPendientes}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Hoy</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#4ade80", fontFamily: "monospace" }}>{tareasHoy}</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: tareasAtrasadas > 0 ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 8, textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Atrasadas</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: tareasAtrasadas > 0 ? "#f87171" : "#666", fontFamily: "monospace" }}>{tareasAtrasadas}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={() => setVista("calendario")} style={{ flex: 1, background: vista === "calendario" ? "rgba(190,176,162,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${vista === "calendario" ? "#beb0a2" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: 8, color: vista === "calendario" ? "#beb0a2" : "#777", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>📅 Calendario</button>
        <button onClick={() => setVista("tareas")} style={{ flex: 1, background: vista === "tareas" ? "rgba(190,176,162,0.2)" : "rgba(255,255,255,0.05)", border: `1px solid ${vista === "tareas" ? "#beb0a2" : "rgba(255,255,255,0.1)"}`, borderRadius: 8, padding: 8, color: vista === "tareas" ? "#beb0a2" : "#777", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>✓ Lista de tareas</button>
      </div>

      {loading && <div style={{ color: "#666", textAlign: "center", padding: 30, fontSize: 12 }}>Cargando...</div>}

      {!loading && vista === "calendario" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <button onClick={() => changeMonth(-1)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#beb0a2", padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>←</button>
            <div style={{ color: "#beb0a2", fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}</div>
            <button onClick={() => changeMonth(1)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, color: "#beb0a2", padding: "4px 10px", cursor: "pointer", fontSize: 12 }}>→</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3, marginBottom: 4 }}>
            {DIAS.map(d => <div key={d} style={{ textAlign: "center", color: "#555", fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>{d}</div>)}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
            {daysOfMonth.map((d, i) => {
              if (!d) return <div key={i} style={{ aspectRatio: "1" }} />;
              const ymd = toYMD(d);
              const isToday = ymd === today;
              const dayTasks = tasksForDay(d);
              const dayEvents = eventsForDay(d);
              const total = dayTasks.length + dayEvents.length;
              return (
                <button key={i} onClick={() => setSelectedDate(d)}
                  style={{
                    aspectRatio: "1",
                    minHeight: 42,
                    background: total > 0 ? "rgba(190,176,162,0.08)" : "rgba(255,255,255,0.02)",
                    border: isToday ? "2px solid #beb0a2" : "1px solid rgba(255,255,255,0.05)",
                    borderRadius: 6,
                    color: isToday ? "#beb0a2" : "#fff",
                    fontWeight: isToday ? 700 : 400,
                    fontSize: 12,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    paddingTop: 4,
                    position: "relative"
                  }}>
                  <span>{d.getDate()}</span>
                  {total > 0 && <div style={{ display: "flex", gap: 2, marginTop: 2 }}>
                    {dayEvents.length > 0 && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#beb0a2" }} />}
                    {dayTasks.length > 0 && <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#4ade80" }} />}
                  </div>}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 10, fontSize: 10, color: "#666" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#beb0a2" }} /> Eventos
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80" }} /> Tareas
            </div>
          </div>
        </div>
      )}

      {!loading && vista === "tareas" && (
        <div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            {[
              { k: "pendientes", l: "Pendientes" },
              { k: "hoy", l: "Hoy" },
              { k: "semana", l: "Semana" },
              { k: "atrasadas", l: "Atrasadas" },
              { k: "todas", l: "Todas" },
            ].map(f => (
              <button key={f.k} onClick={() => setFilterTasks(f.k)}
                style={{
                  background: filterTasks === f.k ? "rgba(190,176,162,0.2)" : "rgba(255,255,255,0.05)",
                  border: `1px solid ${filterTasks === f.k ? "#beb0a2" : "rgba(255,255,255,0.1)"}`,
                  borderRadius: 20, padding: "4px 10px",
                  color: filterTasks === f.k ? "#beb0a2" : "#777",
                  fontSize: 11, cursor: "pointer"
                }}>{f.l}</button>
            ))}
          </div>
          {filteredTasks.length === 0 && <div style={{ color: "#666", textAlign: "center", padding: 20, fontSize: 12 }}>Sin tareas en este filtro</div>}
          {filteredTasks.map(t => {
            const atrasada = t.fecha && t.fecha < today && !t.completada;
            const prospecto = prospectos.find(p => p.id === t.prospecto_id);
            const project = projects.find(p => p.id === t.project_id);
            return (
              <div key={t.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 8, padding: "9px 11px", marginBottom: 5, display: "flex", alignItems: "flex-start", gap: 8 }}>
                <button onClick={() => toggleTask(t)}
                  style={{
                    width: 18, height: 18, marginTop: 1,
                    borderRadius: 4,
                    border: "2px solid",
                    borderColor: t.completada ? "#beb0a2" : "rgba(255,255,255,0.3)",
                    background: t.completada ? "#beb0a2" : "transparent",
                    color: "#000", fontSize: 11,
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{t.completada ? "✓" : ""}</button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: t.completada ? "line-through" : "none", opacity: t.completada ? 0.5 : 1 }}>{t.titulo}</div>
                  {t.descripcion && <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>{t.descripcion}</div>}
                  <div style={{ fontSize: 10, color: atrasada ? "#f87171" : "#666", marginTop: 3, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.fecha && <span>📅 {t.fecha}{t.hora ? ` ${t.hora.slice(0, 5)}` : ""}</span>}
                    {t.prioridad === "alta" && <span style={{ color: "#f59e0b" }}>● alta</span>}
                    {prospecto && <span>👤 {prospecto.nombre}</span>}
                    {project && <span>📁 {project.nombre}</span>}
                  </div>
                </div>
                <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 14 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          tasks={tasksForDay(selectedDate)}
          events={eventsForDay(selectedDate)}
          prospectos={prospectos}
          projects={projects}
          onClose={() => setSelectedDate(null)}
          onToggleTask={toggleTask}
          onDeleteTask={deleteTask}
          onDeleteEvent={deleteEvent}
          onAddTask={() => { setShowNew("task"); }}
          onAddEvent={() => { setShowNew("event"); }}
        />
      )}

      {showNew && (
        <NewItemModal
          type={showNew}
          prospectos={prospectos}
          projects={projects}
          initialDate={selectedDate || new Date()}
          onClose={() => setShowNew(null)}
          onSaved={() => { setShowNew(null); loadAll(); }}
        />
      )}
    </div>
  );
}

function DayPanel({ date, tasks, events, prospectos, projects, onClose, onToggleTask, onDeleteTask, onDeleteEvent, onAddTask, onAddEvent }) {
  const dia = date.getDate();
  const mes = MESES[date.getMonth()];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div style={{ background: "#0d0d0d", border: "1px solid rgba(190,176,162,0.3)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 520, maxHeight: "85vh", overflowY: "auto", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ color: "#beb0a2", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>{date.toLocaleDateString("es-ES", { weekday: "long" })}</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{dia} {mes}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", width: 32, height: 32, fontSize: 16, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
          <button onClick={onAddTask} style={{ flex: 1, background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 8, padding: 8, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>+ Tarea</button>
          <button onClick={onAddEvent} style={{ flex: 1, background: "rgba(190,176,162,0.12)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 8, padding: 8, color: "#beb0a2", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>+ Evento</button>
        </div>

        {events.length === 0 && tasks.length === 0 && (
          <div style={{ color: "#666", fontSize: 12, textAlign: "center", padding: 20 }}>Sin eventos ni tareas</div>
        )}

        {events.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Eventos</div>
            {events.map(e => (
              <div key={e.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, marginBottom: 5 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{e.titulo}</div>
                  <button onClick={() => onDeleteEvent(e.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>✕</button>
                </div>
                {e.descripcion && <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>{e.descripcion}</div>}
                <div style={{ fontSize: 10, color: "#666", marginTop: 3 }}>
                  {e.todo_el_dia ? "Todo el día" : new Date(e.fecha_inicio).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                  {e.ubicacion && ` · 📍 ${e.ubicacion}`}
                </div>
              </div>
            ))}
          </div>
        )}

        {tasks.length > 0 && (
          <div>
            <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Tareas</div>
            {tasks.map(t => (
              <div key={t.id} style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, marginBottom: 5, display: "flex", gap: 8 }}>
                <button onClick={() => onToggleTask(t)}
                  style={{
                    width: 18, height: 18, marginTop: 1,
                    borderRadius: 4,
                    border: "2px solid",
                    borderColor: t.completada ? "#beb0a2" : "rgba(255,255,255,0.3)",
                    background: t.completada ? "#beb0a2" : "transparent",
                    color: "#000", fontSize: 11,
                    cursor: "pointer", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center"
                  }}>{t.completada ? "✓" : ""}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, textDecoration: t.completada ? "line-through" : "none", opacity: t.completada ? 0.5 : 1 }}>{t.titulo}</div>
                  {t.hora && <div style={{ fontSize: 10, color: "#666" }}>{t.hora.slice(0, 5)}</div>}
                </div>
                <button onClick={() => onDeleteTask(t.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer" }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NewItemModal({ type, prospectos, projects, initialDate, onClose, onSaved }) {
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(toYMD(initialDate));
  const [hora, setHora] = useState("");
  const [horaFin, setHoraFin] = useState("");
  const [todoElDia, setTodoElDia] = useState(false);
  const [ubicacion, setUbicacion] = useState("");
  const [prioridad, setPrioridad] = useState("media");
  const [prospectoId, setProspectoId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [saving, setSaving] = useState(false);

  // Construye un Date LOCAL a partir de "YYYY-MM-DD" y "HH:MM"
  // y devuelve su ISO. Esto preserva la intención del usuario:
  // si el usuario marca el día 7 a las 09:00 hora de Madrid,
  // se guarda exactamente ese instante (que en UTC son las 07:00).
  function buildLocalISO(ymd, hhmm) {
    const [y, m, d] = ymd.split("-").map(Number);
    const [hh, mm] = (hhmm || "00:00").split(":").map(Number);
    const local = new Date(y, m - 1, d, hh, mm, 0);
    return local.toISOString();
  }

  async function save() {
    if (!titulo.trim()) return;
    setSaving(true);
    try {
      if (type === "task") {
        // tasks.fecha es un DATE (sin hora) → guardamos la cadena tal cual,
        // sin pasar por Date para evitar conversiones de zona horaria.
        await supabase.from("tasks").insert({
          titulo,
          descripcion: descripcion || null,
          fecha,
          hora: hora || null,
          prioridad,
          prospecto_id: prospectoId ? parseInt(prospectoId) : null,
          project_id: projectId || null,
        });
      } else {
        // events.fecha_inicio es TIMESTAMPTZ → construimos el ISO desde
        // hora local del usuario (no desde "YYYY-MM-DDTHH:MM:SS" plano,
        // que se interpretaría como UTC).
        const startISO = todoElDia
          ? buildLocalISO(fecha, "00:00")
          : buildLocalISO(fecha, hora || "09:00");
        const endISO = todoElDia
          ? buildLocalISO(fecha, "23:59")
          : horaFin ? buildLocalISO(fecha, horaFin) : null;
        await supabase.from("events").insert({
          titulo,
          descripcion: descripcion || null,
          fecha_inicio: startISO,
          fecha_fin: endISO,
          todo_el_dia: todoElDia,
          ubicacion: ubicacion || null,
          prospecto_id: prospectoId ? parseInt(prospectoId) : null,
          project_id: projectId || null,
        });
      }
    } catch (err) {
      alert("Error al guardar: " + err.message);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 200, display: "flex", justifyContent: "center", alignItems: "flex-end" }}>
      <div style={{ background: "#0d0d0d", border: "1px solid rgba(190,176,162,0.3)", borderRadius: "16px 16px 0 0", width: "100%", maxWidth: 520, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ color: "#beb0a2", fontSize: 14, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Nueva {type === "task" ? "Tarea" : "Evento"}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff", width: 28, height: 28, fontSize: 14, cursor: "pointer" }}>✕</button>
        </div>

        <input autoFocus placeholder="Título *" value={titulo} onChange={e => setTitulo(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
        <textarea placeholder="Descripción (opcional)" value={descripcion} onChange={e => setDescripcion(e.target.value)} style={{ ...inputStyle, minHeight: 50, marginBottom: 6, fontFamily: "inherit" }} />

        {type === "event" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#aaa", marginBottom: 6 }}>
            <input type="checkbox" checked={todoElDia} onChange={e => setTodoElDia(e.target.checked)} /> Todo el día
          </label>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} style={inputStyle} />
          {!todoElDia && <input type="time" value={hora} onChange={e => setHora(e.target.value)} style={inputStyle} />}
        </div>

        {type === "event" && !todoElDia && (
          <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)} placeholder="Hora fin" style={{ ...inputStyle, marginBottom: 6 }} />
        )}

        {type === "event" && (
          <input placeholder="Ubicación" value={ubicacion} onChange={e => setUbicacion(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
        )}

        {type === "task" && (
          <select value={prioridad} onChange={e => setPrioridad(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }}>
            <option value="baja">Prioridad baja</option>
            <option value="media">Prioridad media</option>
            <option value="alta">Prioridad alta</option>
          </select>
        )}

        <select value={prospectoId} onChange={e => setProspectoId(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }}>
          <option value="">— Sin prospecto —</option>
          {prospectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <select value={projectId} onChange={e => setProjectId(e.target.value)} style={{ ...inputStyle, marginBottom: 12 }}>
          <option value="">— Sin proyecto —</option>
          {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>

        <button onClick={save} disabled={saving || !titulo.trim()} style={{ width: "100%", background: titulo.trim() ? "linear-gradient(135deg, #beb0a2, #a89686)" : "#1a1a1a", border: "none", borderRadius: 8, padding: 11, color: titulo.trim() ? "#000" : "#444", fontSize: 13, fontWeight: 700, cursor: titulo.trim() ? "pointer" : "default" }}>
          {saving ? "Guardando..." : "Guardar"}
        </button>
      </div>
    </div>
  );
}
