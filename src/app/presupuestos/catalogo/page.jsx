'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { formatEUR, pvpDesdeMargen, margenDesdeCostePvp, beneficioRealPct } from '@/lib/presupuestos';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CatalogoPage() {
  const [partidas, setPartidas] = useState([]);
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroCapId, setFiltroCapId] = useState('todos');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [parts, caps] = await Promise.all([
      supabase.from('partidas_catalogo').select('*').order('descripcion'),
      supabase.from('capitulos_catalogo').select('*').order('orden'),
    ]);
    setPartidas(parts.data || []);
    setCapitulos(caps.data || []);
    setLoading(false);
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta partida del catálogo?')) return;
    await supabase.from('partidas_catalogo').delete().eq('id', id);
    load();
  }

  const capById = useMemo(() => {
    const m = {};
    capitulos.forEach(c => m[c.id] = c);
    return m;
  }, [capitulos]);

  const filtered = useMemo(() => {
    let list = partidas;
    if (filtroCapId !== 'todos') {
      list = list.filter(p => p.capitulo_catalogo_id === filtroCapId);
    }
    const s = search.toLowerCase();
    if (s) {
      list = list.filter(p =>
        p.descripcion.toLowerCase().includes(s) ||
        (p.codigo || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [partidas, search, filtroCapId]);

  // Agrupar por capítulo del catálogo
  const grouped = useMemo(() => {
    const g = {};
    for (const p of filtered) {
      const cap = capById[p.capitulo_catalogo_id];
      const k = cap ? `${cap.codigo} · ${cap.nombre}` : 'Sin capítulo';
      const orden = cap ? cap.orden : 9999;
      if (!g[k]) g[k] = { items: [], orden };
      g[k].items.push(p);
    }
    return g;
  }, [filtered, capById]);

  const groupedSorted = useMemo(() => {
    return Object.entries(grouped).sort((a, b) => a[1].orden - b[1].orden);
  }, [grouped]);

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { border-color: #beb0a2 !important; outline: none; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 60px' }}>
        <Link href="/presupuestos" style={{ color: '#888', fontSize: 11, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Volver a presupuestos</Link>

        <div style={{ marginTop: 16, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', margin: 0 }}>Catálogo de partidas</h1>
            <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 12 }} />
            <div style={{ color: '#888', fontSize: 12, marginTop: 12 }}>{partidas.length} partida{partidas.length !== 1 ? 's' : ''} · {capitulos.length} capítulos</div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/presupuestos/capitulos" style={btnSecundario}>Capítulos</Link>
            <button onClick={() => { setEditing(null); setShowForm(true); }} disabled={capitulos.length === 0} style={{ ...btnPrimario, opacity: capitulos.length === 0 ? 0.4 : 1 }}>
              + Nueva partida
            </button>
          </div>
        </div>

        {capitulos.length === 0 && (
          <div style={{ padding: 24, border: '1px solid rgba(255,165,0,0.4)', borderRadius: 8, background: 'rgba(255,165,0,0.05)', marginBottom: 24, fontSize: 13 }}>
            <strong style={{ color: '#ffa500' }}>Antes de crear partidas, debes crear capítulos.</strong>
            <div style={{ color: '#aaa', fontSize: 12, marginTop: 6 }}>
              Cada partida debe pertenecer a un capítulo. Ve a <Link href="/presupuestos/capitulos" style={{ color: '#beb0a2', textDecoration: 'underline' }}>Capítulos</Link> para crear los tuyos (Demolición, Pladur, Electricidad...).
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
          <input placeholder="Buscar por descripción o código..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, minWidth: 240, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '12px 16px', fontSize: 13, fontFamily: 'inherit' }} />
          <select value={filtroCapId} onChange={e => setFiltroCapId(e.target.value)}
            style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '12px 16px', fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', minWidth: 220 }}>
            <option value="todos">Todos los capítulos</option>
            {capitulos.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Cargando...</div>
        ) : groupedSorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666', fontSize: 13 }}>Sin partidas en el catálogo</div>
        ) : (
          groupedSorted.map(([cap, { items }]) => (
            <div key={cap} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#beb0a2', marginBottom: 10, fontWeight: 600 }}>{cap}</h2>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                {items.map((p, idx) => {
                  const benef = beneficioRealPct(p.precio_compra, p.pvp);
                  return (
                    <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 70px 90px 90px 70px 60px 120px', gap: 12, padding: '12px 18px', fontSize: 13, alignItems: 'center', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{p.codigo || '—'}</div>
                      <div>{p.descripcion}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>{p.unidad}</div>
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{formatEUR(p.precio_compra)}</div>
                      <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#beb0a2', fontWeight: 600 }}>{formatEUR(p.pvp)}</div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#7fd87f' }}>{(p.margen_default || 0).toFixed(0)}%</div>
                      <div style={{ textAlign: 'right', fontSize: 10, color: '#666' }}>{p.veces_usada || 0}</div>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button onClick={() => { setEditing(p); setShowForm(true); }} style={{ fontSize: 11, color: '#888', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>Editar</button>
                        <button onClick={() => eliminar(p.id)} style={{ fontSize: 14, color: '#666', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <PartidaForm
          partida={editing}
          capitulos={capitulos}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PartidaForm({ partida, capitulos, onClose, onSaved }) {
  const [capituloId, setCapituloId] = useState(partida?.capitulo_catalogo_id || '');
  const [codigo, setCodigo] = useState(partida?.codigo || '');
  const [descripcion, setDescripcion] = useState(partida?.descripcion || '');
  const [unidad, setUnidad] = useState(partida?.unidad || 'ud');
  const [precioCompra, setPrecioCompra] = useState(partida?.precio_compra ?? 0);
  const [margen, setMargen] = useState(partida?.margen_default ?? 30);
  const [pvpManual, setPvpManual] = useState(partida?.pvp ?? 0);
  const [usarPvpManual, setUsarPvpManual] = useState(false);
  const [notas, setNotas] = useState(partida?.notas || '');
  const [saving, setSaving] = useState(false);

  // Sugerir código a partir del capítulo elegido
  useEffect(() => {
    if (!capituloId || partida) return;
    const cap = capitulos.find(c => c.id === capituloId);
    if (cap && !codigo) {
      // Sugiere CAP- y deja que el usuario complete los dígitos
      setCodigo(cap.codigo + '-');
    }
  }, [capituloId]);

  // PVP calculado a partir del margen y el coste
  const pvpCalculado = pvpDesdeMargen(precioCompra, margen);
  const pvpFinal = usarPvpManual ? Number(pvpManual) || 0 : pvpCalculado;
  const margenFinal = usarPvpManual ? margenDesdeCostePvp(precioCompra, pvpFinal) : Number(margen) || 0;
  const beneficioPctFinal = beneficioRealPct(precioCompra, pvpFinal);

  async function save() {
    if (!descripcion.trim() || !capituloId) return;
    setSaving(true);
    const data = {
      capitulo_catalogo_id: capituloId,
      codigo: codigo || null,
      descripcion,
      unidad,
      precio_compra: parseFloat(precioCompra) || 0,
      pvp: parseFloat(pvpFinal.toFixed(2)) || 0,
      margen_default: parseFloat(margenFinal.toFixed(2)) || 0,
      notas: notas || null,
    };
    // Mantener compatibilidad con campo antiguo "capitulo" como texto
    const cap = capitulos.find(c => c.id === capituloId);
    if (cap) data.capitulo = cap.nombre;

    if (partida) {
      const { error } = await supabase.from('partidas_catalogo').update(data).eq('id', partida.id);
      if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('partidas_catalogo').insert(data);
      if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit' };
  const lbl = { display: 'block', color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a0a0a', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, width: '100%', maxWidth: 720, maxHeight: '92vh', overflowY: 'auto', padding: 28 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#beb0a2', margin: 0, marginBottom: 20 }}>
          {partida ? 'Editar partida' : 'Nueva partida'}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Capítulo *</label>
            <select value={capituloId} onChange={e => setCapituloId(e.target.value)} style={{ ...inp, cursor: 'pointer' }}>
              <option value="">— Selecciona capítulo —</option>
              {capitulos.map(c => <option key={c.id} value={c.id}>{c.codigo} · {c.nombre}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Código</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="DEM-001" style={{ ...inp, fontFamily: 'monospace' }} />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Descripción *</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="Suministro y colocación de placa de pladur PYL15 sobre estructura M70..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div>
            <label style={lbl}>Unidad</label>
            <input value={unidad} onChange={e => setUnidad(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Precio compra (€)</label>
            <input type="number" step="0.01" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Margen sobre coste (%)</label>
            <input type="number" step="0.1" value={margen} onChange={e => { setMargen(e.target.value); setUsarPvpManual(false); }} style={{ ...inp, opacity: usarPvpManual ? 0.4 : 1 }} disabled={usarPvpManual} />
          </div>
        </div>

        {/* Resumen del cálculo */}
        <div style={{ padding: 14, background: 'rgba(190,176,162,0.05)', border: '1px solid rgba(190,176,162,0.2)', borderRadius: 6, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 12 }}>
            <Stat label="PVP" valor={formatEUR(pvpFinal)} highlight />
            <Stat label="Beneficio" valor={formatEUR(pvpFinal - precioCompra)} color="#7fd87f" />
            <Stat label="Beneficio real" valor={`${beneficioPctFinal.toFixed(1)}%`} color="#7fd87f" muted />
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#aaa', cursor: 'pointer' }}>
            <input type="checkbox" checked={usarPvpManual} onChange={e => {
              const v = e.target.checked;
              setUsarPvpManual(v);
              if (v) setPvpManual(pvpCalculado.toFixed(2));
            }} />
            Forzar PVP manualmente (ignorar margen)
          </label>
          {usarPvpManual && (
            <div style={{ marginTop: 10 }}>
              <label style={lbl}>PVP manual (€)</label>
              <input type="number" step="0.01" value={pvpManual} onChange={e => setPvpManual(e.target.value)} style={inp} />
              <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>El margen se recalcula automáticamente.</div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Notas internas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#888', border: 'none', padding: '11px 20px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !descripcion.trim() || !capituloId}
            style={{ background: descripcion.trim() && capituloId ? '#beb0a2' : '#333', color: descripcion.trim() && capituloId ? '#0a0a0a' : '#666', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: descripcion.trim() && capituloId ? 'pointer' : 'default' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, valor, highlight, color, muted }) {
  return (
    <div>
      <div style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: highlight ? "'Cormorant Garamond', serif" : 'monospace', fontSize: highlight ? 22 : 14, color: color || '#fff', fontWeight: highlight ? 500 : 400, opacity: muted ? 0.7 : 1 }}>{valor}</div>
    </div>
  );
}

const btnPrimario = { background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnSecundario = { background: 'transparent', color: '#beb0a2', border: '1px solid rgba(190,176,162,0.4)', borderRadius: 4, padding: '10px 22px', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
