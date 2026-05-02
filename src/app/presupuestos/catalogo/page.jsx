'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function CapitulosCatalogoPage() {
  const [capitulos, setCapitulos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [partidasCount, setPartidasCount] = useState({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [caps, parts] = await Promise.all([
      supabase.from('capitulos_catalogo').select('*').order('orden'),
      supabase.from('partidas_catalogo').select('id, capitulo_catalogo_id'),
    ]);
    setCapitulos(caps.data || []);
    const counts = {};
    (parts.data || []).forEach(p => {
      if (p.capitulo_catalogo_id) {
        counts[p.capitulo_catalogo_id] = (counts[p.capitulo_catalogo_id] || 0) + 1;
      }
    });
    setPartidasCount(counts);
    setLoading(false);
  }

  async function eliminar(cap) {
    const count = partidasCount[cap.id] || 0;
    const msg = count > 0
      ? `¿Eliminar el capítulo "${cap.nombre}"? Las ${count} partida${count > 1 ? 's' : ''} asociada${count > 1 ? 's' : ''} quedará${count > 1 ? 'n' : ''} sin capítulo.`
      : `¿Eliminar el capítulo "${cap.nombre}"?`;
    if (!confirm(msg)) return;
    await supabase.from('capitulos_catalogo').delete().eq('id', cap.id);
    load();
  }

  async function moverCapitulo(cap, dir) {
    const idx = capitulos.findIndex(c => c.id === cap.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= capitulos.length) return;
    const updated = [...capitulos];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setCapitulos(updated);
    await Promise.all(updated.map((c, i) => supabase.from('capitulos_catalogo').update({ orden: (i + 1) * 10 }).eq('id', c.id)));
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { border-color: #beb0a2 !important; outline: none; }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 32px 60px' }}>
        <Link href="/presupuestos" style={{ color: '#888', fontSize: 11, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Volver a presupuestos</Link>

        <div style={{ marginTop: 16, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', margin: 0 }}>Capítulos del catálogo</h1>
            <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 12 }} />
            <p style={{ color: '#888', fontSize: 12, marginTop: 12, maxWidth: 580, lineHeight: 1.6 }}>
              Capítulos reutilizables que aparecen en el catálogo de partidas y al crear presupuestos. Cada partida del catálogo pertenece a uno de estos capítulos.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link href="/presupuestos/catalogo" style={btnSecundario}>Catálogo de partidas</Link>
            <button onClick={() => { setEditing(null); setShowForm(true); }} style={btnPrimario}>+ Nuevo capítulo</button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Cargando...</div>
        ) : capitulos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, color: '#666' }}>
            <div style={{ fontSize: 14, marginBottom: 6 }}>Sin capítulos</div>
            <div style={{ fontSize: 11, color: '#555' }}>Crea el primer capítulo para empezar a organizar tu catálogo</div>
          </div>
        ) : (
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 80px 1fr 100px 140px', padding: '12px 18px', background: 'rgba(255,255,255,0.03)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>
              <div></div>
              <div>Código</div>
              <div>Capítulo</div>
              <div style={{ textAlign: 'right' }}>Partidas</div>
              <div></div>
            </div>
            {capitulos.map((cap, idx) => (
              <div key={cap.id} style={{ display: 'grid', gridTemplateColumns: '40px 80px 1fr 100px 140px', padding: '14px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', alignItems: 'center', fontSize: 13 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button onClick={() => moverCapitulo(cap, -1)} disabled={idx === 0} style={btnIcon}>▲</button>
                  <button onClick={() => moverCapitulo(cap, 1)} disabled={idx === capitulos.length - 1} style={btnIcon}>▼</button>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#beb0a2', fontWeight: 600 }}>{cap.codigo}</div>
                <div>
                  <div style={{ fontSize: 14 }}>{cap.nombre}</div>
                  {cap.descripcion && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{cap.descripcion}</div>}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: '#888' }}>{partidasCount[cap.id] || 0}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button onClick={() => { setEditing(cap); setShowForm(true); }} style={{ fontSize: 11, color: '#888', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>Editar</button>
                  <button onClick={() => eliminar(cap)} style={{ fontSize: 14, color: '#666', background: 'transparent', border: 'none', cursor: 'pointer' }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <CapituloForm
          capitulo={editing}
          totalCapitulos={capitulos.length}
          onClose={() => { setShowForm(false); setEditing(null); }}
          onSaved={() => { setShowForm(false); setEditing(null); load(); }}
        />
      )}
    </div>
  );
}

function CapituloForm({ capitulo, totalCapitulos, onClose, onSaved }) {
  const [codigo, setCodigo] = useState(capitulo?.codigo || '');
  const [nombre, setNombre] = useState(capitulo?.nombre || '');
  const [descripcion, setDescripcion] = useState(capitulo?.descripcion || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!codigo.trim() || !nombre.trim()) return;
    setSaving(true);
    const data = {
      codigo: codigo.trim().toUpperCase(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
    };
    if (capitulo) {
      const { error } = await supabase.from('capitulos_catalogo').update(data).eq('id', capitulo.id);
      if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    } else {
      data.orden = (totalCapitulos + 1) * 10;
      const { error } = await supabase.from('capitulos_catalogo').insert(data);
      if (error) { alert('Error: ' + error.message); setSaving(false); return; }
    }
    setSaving(false);
    onSaved();
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '9px 12px', fontSize: 13, fontFamily: 'inherit' };
  const lbl = { display: 'block', color: '#888', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 5 };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a0a0a', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, width: '100%', maxWidth: 520, padding: 28 }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#beb0a2', margin: 0, marginBottom: 20 }}>
          {capitulo ? 'Editar capítulo' : 'Nuevo capítulo'}
        </h2>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Código *</label>
          <input value={codigo} onChange={e => setCodigo(e.target.value.toUpperCase())} placeholder="DEM, PYL, ELE..." maxLength={4} style={{ ...inp, fontFamily: 'monospace', textTransform: 'uppercase', fontWeight: 600 }} />
          <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>2-4 letras. Aparecerá en los códigos de partidas (ej. DEM-001).</div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>Nombre *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Demolición y trabajos previos" style={inp} />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={lbl}>Descripción</label>
          <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} rows={3} placeholder="Demoliciones, retirada de escombros..." style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ background: 'transparent', color: '#888', border: 'none', padding: '11px 20px', fontSize: 12, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={save} disabled={saving || !codigo.trim() || !nombre.trim()}
            style={{ background: codigo.trim() && nombre.trim() ? '#beb0a2' : '#333', color: codigo.trim() && nombre.trim() ? '#0a0a0a' : '#666', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: codigo.trim() && nombre.trim() ? 'pointer' : 'default' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btnPrimario = { background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnSecundario = { background: 'transparent', color: '#beb0a2', border: '1px solid rgba(190,176,162,0.4)', borderRadius: 4, padding: '10px 22px', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnIcon = { background: 'transparent', border: 'none', cursor: 'pointer', color: '#888', fontSize: 9, padding: '0 4px' };
