'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { formatEUR } from '@/lib/presupuestos';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CatalogoPage() {
  const [partidas, setPartidas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('partidas_catalogo').select('*').order('descripcion');
    setPartidas(data || []);
    setLoading(false);
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar esta partida del catálogo?')) return;
    await supabase.from('partidas_catalogo').delete().eq('id', id);
    load();
  }

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    if (!s) return partidas;
    return partidas.filter(p =>
      p.descripcion.toLowerCase().includes(s) ||
      (p.codigo || '').toLowerCase().includes(s) ||
      (p.capitulo || '').toLowerCase().includes(s)
    );
  }, [partidas, search]);

  const grouped = useMemo(() => {
    const g = {};
    for (const p of filtered) {
      const k = p.capitulo || 'Sin capítulo';
      if (!g[k]) g[k] = [];
      g[k].push(p);
    }
    return g;
  }, [filtered]);

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { border-color: #beb0a2 !important; outline: none; }
      `}</style>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 60px' }}>
        <Link href="/presupuestos" style={{ color: '#888', fontSize: 11, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Volver a presupuestos</Link>

        <div style={{ marginTop: 16, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', margin: 0 }}>Catálogo de partidas</h1>
            <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 12 }} />
            <div style={{ color: '#888', fontSize: 12, marginTop: 12 }}>{partidas.length} partida{partidas.length !== 1 ? 's' : ''} guardada{partidas.length !== 1 ? 's' : ''}</div>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            style={{ background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' }}>
            + Nueva partida
          </button>
        </div>

        <input placeholder="Buscar por descripción, código o capítulo..." value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '12px 16px', fontSize: 13, fontFamily: 'inherit', marginBottom: 24 }} />

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Cargando...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666', fontSize: 13 }}>Sin partidas en el catálogo</div>
        ) : (
          Object.entries(grouped).map(([cap, items]) => (
            <div key={cap} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#beb0a2', marginBottom: 10, fontWeight: 600 }}>{cap}</h2>
              <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
                {items.map((p, idx) => (
                  <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 80px 100px 100px 60px 120px', gap: 12, padding: '12px 18px', fontSize: 13, alignItems: 'center', borderTop: idx > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>{p.codigo || '—'}</div>
                    <div>{p.descripcion}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{p.unidad}</div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: '#666' }}>{formatEUR(p.precio_compra)}</div>
                    <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: '#beb0a2', fontWeight: 600 }}>{formatEUR(p.pvp)}</div>
                    <div style={{ textAlign: 'right', fontSize: 10, color: '#666' }}>{p.veces_usada || 0} usos</div>
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => { setEditing(p); setShowForm(true); }} style={{ fontSize: 11, color: '#888', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>Editar</button>
                      <button onClick={() => eliminar(p.id)} style={{ fontSize: 14, color: '#666', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {showForm && (
        <PartidaForm
          partida={editing}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function PartidaForm({ partida, onClose, onSaved }) {
  const [codigo, setCodigo] = useState(partida?.codigo || '');
  const [descripcion, setDescripcion] = useState(partida?.descripcion || '');
  const [capitulo, setCapitulo] = useState(partida?.capitulo || '');
  const [unidad, setUnidad] = useState(partida?.unidad || 'ud');
  const [precioCompra, setPrecioCompra] = useState(partida?.precio_compra ?? 0);
  const [pvp, setPvp] = useState(partida?.pvp ?? 0);
  const [margenDefault, setMargenDefault] = useState(partida?.margen_default ?? 0);
  const [notas, setNotas] = useState(partida?.notas || '');
  const [saving, setSaving] = useState(false);

  const margenCalc = pvp > 0 && precioCompra > 0 ? ((pvp - precioCompra) / pvp) * 100 : 0;

  async function save() {
    if (!descripcion.trim()) return;
    setSaving(true);
    const data = {
      codigo: codigo || null,
      descripcion,
      capitulo: capitulo || null,
      unidad,
      precio_compra: parseFloat(precioCompra) || 0,
      pvp: parseFloat(pvp) || 0,
      margen_default: parseFloat(margenDefault) || margenCalc,
      notas: notas || null,
    };
    if (partida) await supabase.from('partidas_catalogo').update(data).eq('id', partida.id);
    else await supabase.from('partidas_catalogo').insert(data);
    setSaving(false);
    onSaved();
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit' };
  const lbl = { display: 'block', color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a0a0a', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 28 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#beb0a2', margin: 0, marginBottom: 20 }}>
          {partida ? 'Editar partida' : 'Nueva partida'}
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Código</label>
            <input value={codigo} onChange={e => setCodigo(e.target.value)} placeholder="PYL15" style={inp} />
          </div>
          <div>
            <label style={lbl}>Capítulo</label>
            <input value={capitulo} onChange={e => setCapitulo(e.target.value)} placeholder="Pladur · Electricidad · Carpintería..." style={inp} />
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <label style={lbl}>Descripción *</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }}
            placeholder="Suministro y colocación de placa de pladur PYL15 sobre estructura M70..." />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={lbl}>Unidad</label>
            <input value={unidad} onChange={e => setUnidad(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>Precio compra (€)</label>
            <input type="number" step="0.01" value={precioCompra} onChange={e => setPrecioCompra(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>PVP (€)</label>
            <input type="number" step="0.01" value={pvp} onChange={e => setPvp(e.target.value)} style={{ ...inp, borderColor: '#beb0a2' }} />
          </div>
          <div>
            <label style={lbl}>Margen %</label>
            <input type="number" step="0.01" value={margenDefault} onChange={e => setMargenDefault(e.target.value)} placeholder={margenCalc.toFixed(1)} style={inp} />
            <div style={{ fontSize: 9, color: '#666', marginTop: 4 }}>Calc: {margenCalc.toFixed(1)}%</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Notas internas</label>
          <textarea value={notas} onChange={e => setNotas(e.target.value)} rows={2} style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#888', border: 'none', padding: '11px 20px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !descripcion.trim()}
            style={{ background: descripcion.trim() ? '#beb0a2' : '#333', color: descripcion.trim() ? '#0a0a0a' : '#666', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: descripcion.trim() ? 'pointer' : 'default' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
