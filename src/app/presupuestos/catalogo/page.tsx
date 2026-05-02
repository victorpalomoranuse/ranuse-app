'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { PartidaCatalogo } from '@/lib/types';
import { formatEUR } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function CatalogoPage() {
  const [partidas, setPartidas] = useState<PartidaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<PartidaCatalogo | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('partidas_catalogo').select('*').order('descripcion');
    setPartidas((data as PartidaCatalogo[]) || []);
    setLoading(false);
  }

  async function eliminar(id: string) {
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

  // Agrupar por capítulo
  const grouped = useMemo(() => {
    const g: Record<string, PartidaCatalogo[]> = {};
    for (const p of filtered) {
      const k = p.capitulo || 'Sin capítulo';
      if (!g[k]) g[k] = [];
      g[k].push(p);
    }
    return g;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto">
        <Link href="/presupuestos" className="text-xs opacity-60 hover:opacity-100">← Volver a presupuestos</Link>
        <div className="flex items-center justify-between mb-6 mt-2">
          <div>
            <h1 className="text-3xl font-light tracking-wide" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              Catálogo de partidas
            </h1>
            <p className="text-sm opacity-60 mt-1">{partidas.length} partidas guardadas</p>
          </div>
          <button
            onClick={() => { setEditing(null); setShowForm(true); }}
            className="px-4 py-2 rounded text-sm font-medium"
            style={{ background: '#beb0a2', color: '#0a0a0a' }}
          >+ Nueva partida</button>
        </div>

        <input
          placeholder="Buscar por descripción, código o capítulo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm mb-6"
        />

        {loading ? (
          <div className="text-center py-12 opacity-60">Cargando...</div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="text-center py-12 opacity-50 text-sm">Sin partidas</div>
        ) : (
          Object.entries(grouped).map(([capitulo, items]) => (
            <div key={capitulo} className="mb-6">
              <h2 className="text-xs uppercase tracking-widest opacity-60 mb-2" style={{ color: '#beb0a2' }}>{capitulo}</h2>
              <div className="border border-white/10 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest opacity-70">
                    <tr>
                      <th className="text-left px-3 py-2 w-20">Cód.</th>
                      <th className="text-left px-3 py-2">Descripción</th>
                      <th className="text-left px-3 py-2 w-14">Ud.</th>
                      <th className="text-right px-3 py-2 w-24" style={{ color: '#888' }}>Coste</th>
                      <th className="text-right px-3 py-2 w-24">PVP</th>
                      <th className="text-right px-3 py-2 w-16 opacity-60">Usos</th>
                      <th className="px-3 py-2 w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(p => (
                      <tr key={p.id} className="border-t border-white/5">
                        <td className="px-3 py-2 font-mono text-xs opacity-70">{p.codigo || '—'}</td>
                        <td className="px-3 py-2">{p.descripcion}</td>
                        <td className="px-3 py-2 text-xs">{p.unidad}</td>
                        <td className="px-3 py-2 text-right text-xs" style={{ color: '#888' }}>{formatEUR(p.precio_compra)}</td>
                        <td className="px-3 py-2 text-right" style={{ color: '#beb0a2' }}>{formatEUR(p.pvp)}</td>
                        <td className="px-3 py-2 text-right text-xs opacity-60">{p.veces_usada}</td>
                        <td className="px-3 py-2 text-right">
                          <button onClick={() => { setEditing(p); setShowForm(true); }} className="text-xs px-2 opacity-70 hover:opacity-100">Editar</button>
                          <button onClick={() => eliminar(p.id)} className="text-xs px-2 opacity-40 hover:opacity-100">×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

function PartidaForm({ partida, onClose, onSaved }: { partida: PartidaCatalogo | null; onClose: () => void; onSaved: () => void }) {
  const [codigo, setCodigo] = useState(partida?.codigo || '');
  const [descripcion, setDescripcion] = useState(partida?.descripcion || '');
  const [capitulo, setCapitulo] = useState(partida?.capitulo || '');
  const [unidad, setUnidad] = useState(partida?.unidad || 'ud');
  const [precioCompra, setPrecioCompra] = useState(partida?.precio_compra ?? 0);
  const [pvp, setPvp] = useState(partida?.pvp ?? 0);
  const [margenDefault, setMargenDefault] = useState(partida?.margen_default ?? 0);
  const [notas, setNotas] = useState(partida?.notas || '');
  const [saving, setSaving] = useState(false);

  // Calcular margen automáticamente
  const margenCalculado = pvp > 0 && precioCompra > 0 ? ((pvp - precioCompra) / pvp) * 100 : 0;

  async function save() {
    if (!descripcion.trim()) return;
    setSaving(true);
    const data = {
      codigo: codigo || null,
      descripcion,
      capitulo: capitulo || null,
      unidad,
      precio_compra: precioCompra,
      pvp,
      margen_default: margenDefault || margenCalculado,
      notas: notas || null,
    };
    if (partida) {
      await supabase.from('partidas_catalogo').update(data).eq('id', partida.id);
    } else {
      await supabase.from('partidas_catalogo').insert(data);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-white/20 rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl mb-4" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>
          {partida ? 'Editar partida' : 'Nueva partida'}
        </h2>
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs opacity-60 block mb-1">Código</label>
              <input value={codigo} onChange={e => setCodigo(e.target.value)}
                placeholder="PYL15"
                className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="text-xs opacity-60 block mb-1">Capítulo</label>
              <input value={capitulo} onChange={e => setCapitulo(e.target.value)}
                placeholder="Ej: Pladur · Electricidad · Carpintería"
                className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="text-xs opacity-60 block mb-1">Descripción *</label>
            <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)}
              rows={3}
              placeholder="Suministro y colocación de placa de pladur PYL15 sobre estructura M70 con aislamiento LM 40mm..."
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs opacity-60 block mb-1">Unidad</label>
              <input value={unidad} onChange={e => setUnidad(e.target.value)}
                className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs opacity-60 block mb-1">Precio compra (€)</label>
              <input type="number" step="0.01" value={precioCompra}
                onChange={e => setPrecioCompra(parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs opacity-60 block mb-1">PVP (€)</label>
              <input type="number" step="0.01" value={pvp}
                onChange={e => setPvp(parseFloat(e.target.value) || 0)}
                className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm"
                style={{ borderColor: '#beb0a2' }} />
            </div>
            <div>
              <label className="text-xs opacity-60 block mb-1">Margen %</label>
              <input type="number" step="0.01" value={margenDefault}
                onChange={e => setMargenDefault(parseFloat(e.target.value) || 0)}
                placeholder={margenCalculado.toFixed(1)}
                className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
              <div className="text-[10px] opacity-50 mt-1">Calculado: {margenCalculado.toFixed(1)}%</div>
            </div>
          </div>
          <div>
            <label className="text-xs opacity-60 block mb-1">Notas internas</label>
            <textarea value={notas} onChange={e => setNotas(e.target.value)}
              rows={2}
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
          </div>
        </div>
        <div className="flex gap-2 justify-end mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm opacity-60 hover:opacity-100">Cancelar</button>
          <button onClick={save} disabled={saving || !descripcion.trim()}
            className="px-4 py-2 text-sm rounded font-medium disabled:opacity-50"
            style={{ background: '#beb0a2', color: '#0a0a0a' }}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  );
}
