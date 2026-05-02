'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Task, CalendarEvent, Project } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Prospecto = { id: number; nombre: string };

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DIAS = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

export default function CalendarioPage() {
  const [tab, setTab] = useState<'calendario' | 'tareas'>('calendario');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [prospectos, setProspectos] = useState<Prospecto[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState<null | 'task' | 'event'>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filterTasks, setFilterTasks] = useState<'todas' | 'hoy' | 'semana' | 'atrasadas' | 'pendientes'>('pendientes');

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const [t, e, pr, proj] = await Promise.all([
      supabase.from('tasks').select('*').order('fecha', { ascending: true, nullsFirst: false }),
      supabase.from('events').select('*').order('fecha_inicio', { ascending: true }),
      supabase.from('prospectos').select('id,nombre').order('nombre'),
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
    ]);
    setTasks((t.data as Task[]) || []);
    setEvents((e.data as CalendarEvent[]) || []);
    setProspectos((pr.data as Prospecto[]) || []);
    setProjects((proj.data as Project[]) || []);
    setLoading(false);
  }

  const daysOfMonth = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const offset = (firstDay.getDay() + 6) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < offset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(year, month, d));
    while (days.length % 7 !== 0) days.push(null);
    return days;
  }, [currentMonth]);

  function tasksForDay(d: Date) {
    const ymd = d.toISOString().slice(0, 10);
    return tasks.filter(t => t.fecha === ymd);
  }
  function eventsForDay(d: Date) {
    const ymd = d.toISOString().slice(0, 10);
    return events.filter(e => e.fecha_inicio.slice(0, 10) === ymd);
  }

  function changeMonth(delta: number) {
    const n = new Date(currentMonth);
    n.setMonth(n.getMonth() + delta);
    setCurrentMonth(n);
  }

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    const weekEndStr = weekEnd.toISOString().slice(0, 10);
    return tasks.filter(t => {
      if (filterTasks === 'pendientes') return !t.completada;
      if (filterTasks === 'hoy') return t.fecha === today && !t.completada;
      if (filterTasks === 'semana') return t.fecha && t.fecha >= today && t.fecha <= weekEndStr && !t.completada;
      if (filterTasks === 'atrasadas') return t.fecha && t.fecha < today && !t.completada;
      return true;
    });
  }, [tasks, filterTasks]);

  async function toggleTask(t: Task) {
    const completada = !t.completada;
    await supabase.from('tasks').update({
      completada,
      fecha_completada: completada ? new Date().toISOString() : null,
    }).eq('id', t.id);
    loadAll();
  }

  async function deleteTask(id: string) {
    if (!confirm('¿Eliminar tarea?')) return;
    await supabase.from('tasks').delete().eq('id', id);
    loadAll();
  }

  async function deleteEvent(id: string) {
    if (!confirm('¿Eliminar evento?')) return;
    await supabase.from('events').delete().eq('id', id);
    loadAll();
  }

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-light tracking-wide" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Tareas <span style={{ color: '#beb0a2' }}>&</span> Calendario
          </h1>
          <div className="flex gap-2">
            <button onClick={() => setShowNewModal('task')}
              className="px-4 py-2 rounded-md text-sm font-medium transition"
              style={{ background: '#beb0a2', color: '#0a0a0a' }}>+ Tarea</button>
            <button onClick={() => setShowNewModal('event')}
              className="px-4 py-2 rounded-md text-sm font-medium border transition"
              style={{ borderColor: '#beb0a2', color: '#beb0a2' }}>+ Evento</button>
          </div>
        </div>

        <div className="flex gap-1 mb-6 border-b border-white/10">
          <button onClick={() => setTab('calendario')}
            className={`px-4 py-2 text-sm transition ${tab === 'calendario' ? 'border-b-2' : 'opacity-60'}`}
            style={tab === 'calendario' ? { borderColor: '#beb0a2', color: '#beb0a2' } : {}}>Calendario</button>
          <button onClick={() => setTab('tareas')}
            className={`px-4 py-2 text-sm transition ${tab === 'tareas' ? 'border-b-2' : 'opacity-60'}`}
            style={tab === 'tareas' ? { borderColor: '#beb0a2', color: '#beb0a2' } : {}}>
            Tareas ({tasks.filter(t => !t.completada).length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 opacity-60">Cargando...</div>
        ) : tab === 'calendario' ? (
          <CalendarView
            currentMonth={currentMonth}
            daysOfMonth={daysOfMonth}
            tasksForDay={tasksForDay}
            eventsForDay={eventsForDay}
            onChangeMonth={changeMonth}
            onClickDay={(d) => { setSelectedDate(d); }}
          />
        ) : (
          <TaskListView
            tasks={filteredTasks}
            allTasks={tasks}
            prospectos={prospectos}
            projects={projects}
            filter={filterTasks}
            setFilter={setFilterTasks}
            onToggle={toggleTask}
            onDelete={deleteTask}
          />
        )}

        {selectedDate && tab === 'calendario' && (
          <DayDetailPanel
            date={selectedDate}
            tasks={tasksForDay(selectedDate)}
            events={eventsForDay(selectedDate)}
            prospectos={prospectos}
            projects={projects}
            onClose={() => setSelectedDate(null)}
            onToggleTask={toggleTask}
            onDeleteTask={deleteTask}
            onDeleteEvent={deleteEvent}
          />
        )}

        {showNewModal && (
          <NewItemModal
            type={showNewModal}
            prospectos={prospectos}
            projects={projects}
            initialDate={selectedDate || new Date()}
            onClose={() => setShowNewModal(null)}
            onSaved={() => { setShowNewModal(null); loadAll(); }}
          />
        )}
      </div>
    </div>
  );
}

function CalendarView({
  currentMonth, daysOfMonth, tasksForDay, eventsForDay, onChangeMonth, onClickDay,
}: {
  currentMonth: Date;
  daysOfMonth: (Date | null)[];
  tasksForDay: (d: Date) => Task[];
  eventsForDay: (d: Date) => CalendarEvent[];
  onChangeMonth: (delta: number) => void;
  onClickDay: (d: Date) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onChangeMonth(-1)} className="px-3 py-1 rounded hover:bg-white/5">←</button>
        <h2 className="text-xl" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>
          {MESES[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <button onClick={() => onChangeMonth(1)} className="px-3 py-1 rounded hover:bg-white/5">→</button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DIAS.map(d => (
          <div key={d} className="text-center text-xs uppercase tracking-widest opacity-60 py-2">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {daysOfMonth.map((d, i) => {
          if (!d) return <div key={i} className="aspect-square" />;
          const ymd = d.toISOString().slice(0, 10);
          const isToday = ymd === today;
          const dayTasks = tasksForDay(d);
          const dayEvents = eventsForDay(d);
          const hasItems = dayTasks.length + dayEvents.length > 0;
          return (
            <button
              key={i}
              onClick={() => onClickDay(d)}
              className={`aspect-square min-h-[80px] p-2 rounded text-left transition border ${isToday ? '' : 'border-white/5 hover:border-white/20'} ${hasItems ? 'bg-white/[0.03]' : ''}`}
              style={isToday ? { borderColor: '#beb0a2', borderWidth: 2 } : {}}
            >
              <div className={`text-sm ${isToday ? 'font-bold' : ''}`} style={isToday ? { color: '#beb0a2' } : {}}>
                {d.getDate()}
              </div>
              <div className="space-y-0.5 mt-1">
                {dayEvents.slice(0, 2).map(e => (
                  <div key={e.id} className="text-[10px] truncate px-1 rounded" style={{ background: e.color || '#beb0a2', color: '#0a0a0a' }}>
                    {e.titulo}
                  </div>
                ))}
                {dayTasks.slice(0, 2).map(t => (
                  <div key={t.id} className={`text-[10px] truncate px-1 ${t.completada ? 'line-through opacity-40' : ''}`}>
                    • {t.titulo}
                  </div>
                ))}
                {(dayEvents.length + dayTasks.length) > 4 && (
                  <div className="text-[9px] opacity-50">+{(dayEvents.length + dayTasks.length) - 4} más</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TaskListView({
  tasks, prospectos, projects, filter, setFilter, onToggle, onDelete,
}: {
  tasks: Task[];
  allTasks: Task[];
  prospectos: Prospecto[];
  projects: Project[];
  filter: string;
  setFilter: (f: any) => void;
  onToggle: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const prospectoName = (id: number | null) => prospectos.find(p => p.id === id)?.nombre;
  const projectName = (id: string | null) => projects.find(p => p.id === id)?.nombre;

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {[
          { k: 'pendientes', l: 'Pendientes' },
          { k: 'hoy', l: 'Hoy' },
          { k: 'semana', l: 'Esta semana' },
          { k: 'atrasadas', l: 'Atrasadas' },
          { k: 'todas', l: 'Todas' },
        ].map(f => (
          <button
            key={f.k}
            onClick={() => setFilter(f.k)}
            className={`px-3 py-1.5 text-xs rounded-full transition ${filter === f.k ? '' : 'border border-white/20 opacity-70'}`}
            style={filter === f.k ? { background: '#beb0a2', color: '#0a0a0a' } : {}}
          >{f.l}</button>
        ))}
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && <div className="text-center py-8 opacity-50 text-sm">Sin tareas en este filtro</div>}
        {tasks.map(t => {
          const today = new Date().toISOString().slice(0, 10);
          const atrasada = t.fecha && t.fecha < today && !t.completada;
          return (
            <div key={t.id} className="flex items-start gap-3 p-3 rounded-md border border-white/10 hover:border-white/20 transition">
              <button
                onClick={() => onToggle(t)}
                className={`w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${t.completada ? '' : 'border-white/40'}`}
                style={t.completada ? { background: '#beb0a2', borderColor: '#beb0a2' } : {}}
              >
                {t.completada && <span className="text-black text-xs">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${t.completada ? 'line-through opacity-50' : ''}`}>{t.titulo}</div>
                {t.descripcion && <div className="text-xs opacity-60 mt-0.5">{t.descripcion}</div>}
                <div className="flex gap-3 text-[11px] opacity-60 mt-1 flex-wrap">
                  {t.fecha && <span style={atrasada ? { color: '#ff6b6b' } : {}}>📅 {t.fecha}{t.hora ? ` ${t.hora.slice(0, 5)}` : ''}</span>}
                  {t.prioridad === 'alta' && <span style={{ color: '#ff9f43' }}>● alta</span>}
                  {t.prospecto_id && <span>👤 {prospectoName(t.prospecto_id)}</span>}
                  {t.project_id && <span>📁 {projectName(t.project_id)}</span>}
                </div>
              </div>
              <button onClick={() => onDelete(t.id)} className="opacity-40 hover:opacity-100 text-sm">×</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DayDetailPanel({
  date, tasks, events, prospectos, projects, onClose, onToggleTask, onDeleteTask, onDeleteEvent,
}: {
  date: Date;
  tasks: Task[];
  events: CalendarEvent[];
  prospectos: Prospecto[];
  projects: Project[];
  onClose: () => void;
  onToggleTask: (t: Task) => void;
  onDeleteTask: (id: string) => void;
  onDeleteEvent: (id: string) => void;
}) {
  return (
    <div className="fixed right-0 top-0 h-full w-full sm:w-96 bg-black border-l border-white/10 p-6 overflow-y-auto z-40 shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <div className="text-xs opacity-60 uppercase tracking-widest">{DIAS[(date.getDay() + 6) % 7]}</div>
          <div className="text-2xl" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>
            {date.getDate()} {MESES[date.getMonth()]}
          </div>
        </div>
        <button onClick={onClose} className="text-2xl opacity-60 hover:opacity-100">×</button>
      </div>
      {events.length === 0 && tasks.length === 0 && (
        <div className="text-sm opacity-50 py-8 text-center">Sin eventos ni tareas</div>
      )}
      {events.length > 0 && (
        <div className="mb-6">
          <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Eventos</div>
          {events.map(e => (
            <div key={e.id} className="p-3 rounded mb-2 border border-white/10">
              <div className="flex justify-between">
                <div className="font-medium text-sm">{e.titulo}</div>
                <button onClick={() => onDeleteEvent(e.id)} className="opacity-40 hover:opacity-100">×</button>
              </div>
              {e.descripcion && <div className="text-xs opacity-60 mt-1">{e.descripcion}</div>}
              <div className="text-[11px] opacity-60 mt-1">
                {e.todo_el_dia ? 'Todo el día' : new Date(e.fecha_inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                {e.ubicacion && ` · ${e.ubicacion}`}
              </div>
            </div>
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <div>
          <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Tareas</div>
          {tasks.map(t => (
            <div key={t.id} className="flex gap-2 p-3 rounded mb-2 border border-white/10">
              <button
                onClick={() => onToggleTask(t)}
                className="w-5 h-5 mt-0.5 rounded border-2 flex items-center justify-center flex-shrink-0"
                style={t.completada ? { background: '#beb0a2', borderColor: '#beb0a2' } : { borderColor: 'rgba(255,255,255,0.4)' }}
              >
                {t.completada && <span className="text-black text-xs">✓</span>}
              </button>
              <div className="flex-1">
                <div className={`text-sm ${t.completada ? 'line-through opacity-50' : ''}`}>{t.titulo}</div>
                {t.hora && <div className="text-[11px] opacity-60">{t.hora.slice(0, 5)}</div>}
              </div>
              <button onClick={() => onDeleteTask(t.id)} className="opacity-40 hover:opacity-100">×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function NewItemModal({
  type, prospectos, projects, initialDate, onClose, onSaved,
}: {
  type: 'task' | 'event';
  prospectos: Prospecto[];
  projects: Project[];
  initialDate: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fecha, setFecha] = useState(initialDate.toISOString().slice(0, 10));
  const [hora, setHora] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [todoElDia, setTodoElDia] = useState(false);
  const [ubicacion, setUbicacion] = useState('');
  const [prioridad, setPrioridad] = useState<'baja' | 'media' | 'alta'>('media');
  const [prospectoId, setProspectoId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!titulo.trim()) return;
    setSaving(true);
    if (type === 'task') {
      await supabase.from('tasks').insert({
        titulo,
        descripcion: descripcion || null,
        fecha,
        hora: hora || null,
        prioridad,
        prospecto_id: prospectoId ? parseInt(prospectoId) : null,
        project_id: projectId || null,
      });
    } else {
      const startISO = todoElDia
        ? new Date(fecha + 'T00:00:00').toISOString()
        : new Date(fecha + 'T' + (hora || '09:00') + ':00').toISOString();
      const endISO = todoElDia
        ? new Date(fecha + 'T23:59:59').toISOString()
        : horaFin ? new Date(fecha + 'T' + horaFin + ':00').toISOString() : null;
      await supabase.from('events').insert({
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
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-white/20 rounded-lg p-6 w-full max-w-md">
        <h2 className="text-xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>
          Nueva {type === 'task' ? 'Tarea' : 'Evento'}
        </h2>
        <div className="space-y-3">
          <input
            autoFocus
            placeholder="Título"
            value={titulo}
            onChange={e => setTitulo(e.target.value)}
            className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Descripción (opcional)"
            value={descripcion}
            onChange={e => setDescripcion(e.target.value)}
            rows={2}
            className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm"
          />
          {type === 'event' && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={todoElDia} onChange={e => setTodoElDia(e.target.checked)} />
              Todo el día
            </label>
          )}
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              className="bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
            {!todoElDia && (
              <input type="time" value={hora} onChange={e => setHora(e.target.value)}
                placeholder="Hora"
                className="bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
            )}
          </div>
          {type === 'event' && !todoElDia && (
            <input type="time" value={horaFin} onChange={e => setHoraFin(e.target.value)}
              placeholder="Hora fin"
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
          )}
          {type === 'event' && (
            <input
              placeholder="Ubicación"
              value={ubicacion}
              onChange={e => setUbicacion(e.target.value)}
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm"
            />
          )}
          {type === 'task' && (
            <select value={prioridad} onChange={e => setPrioridad(e.target.value as any)}
              className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm">
              <option value="baja">Prioridad baja</option>
              <option value="media">Prioridad media</option>
              <option value="alta">Prioridad alta</option>
            </select>
          )}
          <select value={prospectoId} onChange={e => setProspectoId(e.target.value)}
            className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm">
            <option value="">— Sin prospecto —</option>
            {prospectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm">
            <option value="">— Sin proyecto —</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm opacity-60 hover:opacity-100">Cancelar</button>
          <button
            onClick={save}
            disabled={saving || !titulo.trim()}
            className="px-4 py-2 text-sm rounded font-medium disabled:opacity-50"
            style={{ background: '#beb0a2', color: '#0a0a0a' }}
          >{saving ? 'Guardando...' : 'Guardar'}</button>
        </div>
      </div>
    </div>
  );
}
