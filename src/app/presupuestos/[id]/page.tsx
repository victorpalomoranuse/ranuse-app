'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Presupuesto, PresupuestoPartida, PartidaCatalogo, CompanySettings, PresupuestoEstado } from '@/lib/types';
import { calcularPartida, calcularPresupuesto, formatEUR } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PresupuestoEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [presupuesto, setPresupuesto] = useState<Presupuesto | null>(null);
  const [partidas, setPartidas] = useState<PresupuestoPartida[]>([]);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [catalogo, setCatalogo] = useState<PartidaCatalogo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [showInternalCosts, setShowInternalCosts] = useState(false);

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    const [pres, parts, conf, cat] = await Promise.all([
      supabase.from('presupuestos').select('*').eq('id', id).single(),
      supabase.from('presupuesto_partidas').select('*').eq('presupuesto_id', id).order('orden'),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('partidas_catalogo').select('*').order('descripcion'),
    ]);
    setPresupuesto(pres.data as Presupuesto);
    setPartidas((parts.data as PresupuestoPartida[]) || []);
    setSettings(conf.data as CompanySettings);
    setCatalogo((cat.data as PartidaCatalogo[]) || []);
    setLoading(false);
  }

  function updateField<K extends keyof Presupuesto>(field: K, value: Presupuesto[K]) {
    if (!presupuesto) return;
    setPresupuesto({ ...presupuesto, [field]: value });
  }

  async function guardar() {
    if (!presupuesto) return;
    setSaving(true);
    await supabase.from('presupuestos').update({
      numero: presupuesto.numero,
      cliente_nombre: presupuesto.cliente_nombre,
      cliente_cif: presupuesto.cliente_cif,
      cliente_direccion: presupuesto.cliente_direccion,
      cliente_codigo_postal: presupuesto.cliente_codigo_postal,
      cliente_ciudad: presupuesto.cliente_ciudad,
      cliente_email: presupuesto.cliente_email,
      cliente_telefono: presupuesto.cliente_telefono,
      fecha: presupuesto.fecha,
      validez_dias: presupuesto.validez_dias,
      formas_pago: presupuesto.formas_pago,
      notas: presupuesto.notas,
      condiciones: presupuesto.condiciones,
      descuento_global_pct: presupuesto.descuento_global_pct,
      estado: presupuesto.estado,
    }).eq('id', presupuesto.id);
    setSaving(false);
  }

  async function cambiarEstado(estado: PresupuestoEstado) {
    if (!presupuesto) return;
    const updates: any = { estado };
    if (estado === 'enviado') updates.fecha_envio = new Date().toISOString();
    if (estado === 'aceptado') updates.fecha_aceptacion = new Date().toISOString();
    await supabase.from('presupuestos').update(updates).eq('id', presupuesto.id);
    setPresupuesto({ ...presupuesto, ...updates });
  }

  async function addPartidaVacia() {
    const nueva = {
      presupuesto_id: id,
      descripcion: 'Nueva partida',
      unidad: 'ud',
      cantidad: 1,
      precio_compra: 0,
      pvp: 0,
      margen_pct: 0,
      descuento_pct: 0,
      orden: partidas.length,
    };
    const { data } = await supabase.from('presupuesto_partidas').insert(nueva).select().single();
    if (data) setPartidas([...partidas, data as PresupuestoPartida]);
  }

  async function addPartidaFromCatalogo(p: PartidaCatalogo) {
    const nueva = {
      presupuesto_id: id,
      partida_catalogo_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      capitulo: p.capitulo,
      unidad: p.unidad,
      cantidad: 1,
      precio_compra: p.precio_compra,
      pvp: p.pvp,
      margen_pct: p.margen_default,
      descuento_pct: 0,
      orden: partidas.length,
    };
    const { data } = await supabase.from('presupuesto_partidas').insert(nueva).select().single();
    if (data) {
      setPartidas([...partidas, data as PresupuestoPartida]);
      await supabase.from('partidas_catalogo')
        .update({ veces_usada: p.veces_usada + 1 })
        .eq('id', p.id);
    }
    setShowCatalogo(false);
  }

  async function updatePartida(idx: number, updates: Partial<PresupuestoPartida>) {
    const updated = [...partidas];
    updated[idx] = { ...updated[idx], ...updates };
    setPartidas(updated);
    await supabase.from('presupuesto_partidas').update(updates).eq('id', updated[idx].id);
  }

  async function deletePartida(idx: number) {
    const p = partidas[idx];
    await supabase.from('presupuesto_partidas').delete().eq('id', p.id);
    setPartidas(partidas.filter((_, i) => i !== idx));
  }

  async function guardarEnCatalogo(idx: number) {
    const p = partidas[idx];
    if (!p.descripcion) return;
    const yaExiste = catalogo.some(c => c.descripcion === p.descripcion && c.codigo === p.codigo);
    if (yaExiste) {
      alert('Esta partida ya existe en el catálogo');
      return;
    }
    await supabase.from('partidas_catalogo').insert({
      codigo: p.codigo,
      descripcion: p.descripcion,
      capitulo: p.capitulo,
      unidad: p.unidad,
      precio_compra: p.precio_compra,
      pvp: p.pvp,
      margen_default: p.margen_pct,
    });
    alert('Guardada en catálogo ✓');
    loadAll();
  }

  async function moverPartida(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= partidas.length) return;
    const updated = [...partidas];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setPartidas(updated);
    await Promise.all(updated.map((p, i) => supabase.from('presupuesto_partidas').update({ orden: i }).eq('id', p.id)));
  }

  const totales = useMemo(() => {
    return calcularPresupuesto(partidas, presupuesto?.descuento_global_pct || 0);
  }, [partidas, presupuesto?.descuento_global_pct]);

  function exportarPDF() {
    if (!presupuesto || !settings) return;
    const html = generarHTMLpresupuesto(presupuesto, partidas, settings, totales);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    setTimeout(() => {
      if (w) w.print();
    }, 500);
  }

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando...</div>;
  if (!presupuesto) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Presupuesto no encontrado</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link href="/presupuestos" className="text-xs opacity-60 hover:opacity-100">← Volver</Link>
            <h1 className="text-3xl font-light tracking-wide" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
              <input
                value={presupuesto.numero}
                onChange={e => updateField('numero', e.target.value)}
                className="bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 outline-none"
              />
            </h1>
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={presupuesto.estado}
              onChange={e => cambiarEstado(e.target.value as PresupuestoEstado)}
              className="bg-black border border-white/20 rounded px-3 py-2 text-sm"
            >
              <option value="borrador">Borrador</option>
              <option value="enviado">Enviado</option>
              <option value="aceptado">Aceptado</option>
              <option value="rechazado">Rechazado</option>
              <option value="caducado">Caducado</option>
            </select>
            <button onClick={() => setShowInternalCosts(s => !s)}
              className="px-3 py-2 text-xs border border-white/20 rounded">
              {showInternalCosts ? 'Ocultar costes' : 'Ver costes'}
            </button>
            <button onClick={guardar} disabled={saving}
              className="px-4 py-2 rounded text-sm border" style={{ borderColor: '#beb0a2', color: '#beb0a2' }}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </button>
            <button onClick={exportarPDF}
              className="px-4 py-2 rounded text-sm font-medium"
              style={{ background: '#beb0a2', color: '#0a0a0a' }}>
              Exportar PDF
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="border border-white/10 rounded p-4">
            <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Cliente</div>
            <input value={presupuesto.cliente_nombre || ''} onChange={e => updateField('cliente_nombre', e.target.value)}
              placeholder="Nombre o razón social"
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm mb-1 outline-none focus:border-white/30" />
            <input value={presupuesto.cliente_cif || ''} onChange={e => updateField('cliente_cif', e.target.value)}
              placeholder="CIF / NIF"
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm mb-1 outline-none focus:border-white/30" />
            <input value={presupuesto.cliente_direccion || ''} onChange={e => updateField('cliente_direccion', e.target.value)}
              placeholder="Dirección"
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm mb-1 outline-none focus:border-white/30" />
            <div className="grid grid-cols-2 gap-2">
              <input value={presupuesto.cliente_codigo_postal || ''} onChange={e => updateField('cliente_codigo_postal', e.target.value)}
                placeholder="C.P."
                className="bg-transparent border-b border-white/10 py-1 text-sm outline-none focus:border-white/30" />
              <input value={presupuesto.cliente_ciudad || ''} onChange={e => updateField('cliente_ciudad', e.target.value)}
                placeholder="Ciudad"
                className="bg-transparent border-b border-white/10 py-1 text-sm outline-none focus:border-white/30" />
            </div>
            <input value={presupuesto.cliente_email || ''} onChange={e => updateField('cliente_email', e.target.value)}
              placeholder="Email"
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm mt-1 outline-none focus:border-white/30" />
            <input value={presupuesto.cliente_telefono || ''} onChange={e => updateField('cliente_telefono', e.target.value)}
              placeholder="Teléfono"
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm mt-1 outline-none focus:border-white/30" />
          </div>
          <div className="border border-white/10 rounded p-4">
            <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Datos del presupuesto</div>
            <label className="block text-xs opacity-60 mt-2">Fecha</label>
            <input type="date" value={presupuesto.fecha}
              onChange={e => updateField('fecha', e.target.value)}
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm outline-none focus:border-white/30" />
            <label className="block text-xs opacity-60 mt-2">Validez (días)</label>
            <input type="number" value={presupuesto.validez_dias}
              onChange={e => updateField('validez_dias', parseInt(e.target.value) || 30)}
              className="w-full bg-transparent border-b border-white/10 py-1 text-sm outline-none focus:border-white/30" />
            <label className="block text-xs opacity-60 mt-2">Formas de pago</label>
            <textarea value={presupuesto.formas_pago || ''}
              onChange={e => updateField('formas_pago', e.target.value)}
              rows={2}
              placeholder="Ej: 50% al inicio, 50% a la entrega · Transferencia bancaria"
              className="w-full bg-transparent border border-white/10 rounded p-2 text-sm outline-none focus:border-white/30" />
          </div>
        </div>

        <div className="mb-4 flex justify-between items-center">
          <h2 className="text-lg" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>Partidas</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowCatalogo(true)}
              className="px-3 py-1.5 text-xs rounded border border-white/20">+ Desde catálogo</button>
            <button onClick={addPartidaVacia}
              className="px-3 py-1.5 text-xs rounded font-medium"
              style={{ background: '#beb0a2', color: '#0a0a0a' }}>+ Partida en blanco</button>
          </div>
        </div>

        <div className="border border-white/10 rounded-md overflow-x-auto mb-6">
          <table className="w-full text-xs">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-widest opacity-70">
              <tr>
                <th className="text-left px-2 py-2 w-8"></th>
                <th className="text-left px-2 py-2 w-20">Cód.</th>
                <th className="text-left px-2 py-2">Descripción</th>
                <th className="text-left px-2 py-2 w-20">Cap.</th>
                <th className="text-left px-2 py-2 w-14">Ud.</th>
                <th className="text-right px-2 py-2 w-16">Cant.</th>
                {showInternalCosts && <th className="text-right px-2 py-2 w-20" style={{ color: '#888' }}>P.Compra</th>}
                <th className="text-right px-2 py-2 w-20">PVP</th>
                <th className="text-right px-2 py-2 w-14">Dto%</th>
                <th className="text-right px-2 py-2 w-24">Total</th>
                {showInternalCosts && <th className="text-right px-2 py-2 w-24" style={{ color: '#888' }}>Benef.</th>}
                <th className="px-2 py-2 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p, idx) => {
                const c = calcularPartida(p);
                return (
                  <tr key={p.id} className="border-t border-white/5">
                    <td className="px-1 py-1 text-center">
                      <button onClick={() => moverPartida(idx, -1)} disabled={idx === 0}
                        className="opacity-40 hover:opacity-100 disabled:opacity-10 text-[10px] block">▲</button>
                      <button onClick={() => moverPartida(idx, 1)} disabled={idx === partidas.length - 1}
                        className="opacity-40 hover:opacity-100 disabled:opacity-10 text-[10px] block">▼</button>
                    </td>
                    <td><input value={p.codigo || ''} onChange={e => updatePartida(idx, { codigo: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 outline-none" /></td>
                    <td><input value={p.descripcion} onChange={e => updatePartida(idx, { descripcion: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 outline-none" /></td>
                    <td><input value={p.capitulo || ''} onChange={e => updatePartida(idx, { capitulo: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 outline-none" /></td>
                    <td><input value={p.unidad} onChange={e => updatePartida(idx, { unidad: e.target.value })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 outline-none" /></td>
                    <td><input type="number" step="0.01" value={p.cantidad} onChange={e => updatePartida(idx, { cantidad: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 text-right outline-none" /></td>
                    {showInternalCosts && (
                      <td><input type="number" step="0.01" value={p.precio_compra} onChange={e => updatePartida(idx, { precio_compra: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 text-right outline-none" style={{ color: '#888' }} /></td>
                    )}
                    <td><input type="number" step="0.01" value={p.pvp} onChange={e => updatePartida(idx, { pvp: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 text-right outline-none" /></td>
                    <td><input type="number" step="0.01" value={p.descuento_pct} onChange={e => updatePartida(idx, { descuento_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent border-b border-transparent hover:border-white/20 focus:border-white/40 px-1 py-1 text-right outline-none" /></td>
                    <td className="text-right px-2 py-1 font-medium">{formatEUR(c.total_neto)}</td>
                    {showInternalCosts && (
                      <td className="text-right px-2 py-1 text-[10px]" style={{ color: c.beneficio >= 0 ? '#7fd87f' : '#ff6b6b' }}>
                        {formatEUR(c.beneficio)}
                      </td>
                    )}
                    <td className="px-2 py-1 text-right">
                      <button onClick={() => guardarEnCatalogo(idx)} className="opacity-60 hover:opacity-100 text-xs mr-1" title="Guardar en catálogo">★</button>
                      <button onClick={() => deletePartida(idx)} className="opacity-40 hover:opacity-100">×</button>
                    </td>
                  </tr>
                );
              })}
              {partidas.length === 0 && (
                <tr><td colSpan={showInternalCosts ? 12 : 10} className="text-center py-8 opacity-50">Sin partidas. Añade desde catálogo o en blanco.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="border border-white/10 rounded p-4">
            <div className="text-xs uppercase tracking-widest opacity-60 mb-2">Notas y condiciones</div>
            <textarea value={presupuesto.notas || ''} onChange={e => updateField('notas', e.target.value)}
              rows={3} placeholder="Notas (visibles para el cliente)"
              className="w-full bg-transparent border border-white/10 rounded p-2 text-sm mb-2 outline-none focus:border-white/30" />
            <textarea value={presupuesto.condiciones || ''} onChange={e => updateField('condiciones', e.target.value)}
              rows={3} placeholder="Condiciones (ej: garantía, plazos, exclusiones...)"
              className="w-full bg-transparent border border-white/10 rounded p-2 text-sm outline-none focus:border-white/30" />
          </div>
          <div className="border border-white/10 rounded p-4">
            <div className="text-xs uppercase tracking-widest opacity-60 mb-3">Resumen</div>
            <Row label="Subtotal bruto" value={formatEUR(totales.subtotal_bruto)} />
            <Row label="Descuentos por partida" value={`− ${formatEUR(totales.total_descuentos_partidas)}`} muted />
            <Row label="Subtotal" value={formatEUR(totales.subtotal_neto)} />
            <div className="flex items-center justify-between text-sm py-1">
              <span className="opacity-70">Descuento global</span>
              <div className="flex items-center gap-2">
                <input type="number" step="0.01" value={presupuesto.descuento_global_pct}
                  onChange={e => updateField('descuento_global_pct', parseFloat(e.target.value) || 0)}
                  className="w-16 bg-transparent border border-white/20 rounded px-2 py-0.5 text-right text-sm" />
                <span className="opacity-60 text-xs">%</span>
                <span className="w-20 text-right">− {formatEUR(totales.descuento_global)}</span>
              </div>
            </div>
            <div className="border-t border-white/10 my-2" />
            <Row label="TOTAL (sin IVA)" value={formatEUR(totales.base_imponible)} highlight />
            {showInternalCosts && (
              <>
                <div className="border-t border-white/10 my-2" />
                <Row label="Coste total" value={formatEUR(totales.coste_total)} muted small />
                <Row label="Beneficio" value={formatEUR(totales.beneficio_total)} muted small />
                <Row label="Margen real" value={`${totales.margen_real_pct.toFixed(1)}%`} muted small />
              </>
            )}
          </div>
        </div>
      </div>

      {showCatalogo && (
        <CatalogoModal
          catalogo={catalogo}
          onClose={() => setShowCatalogo(false)}
          onPick={addPartidaFromCatalogo}
        />
      )}
    </div>
  );
}

function Row({ label, value, highlight, muted, small }: { label: string; value: string; highlight?: boolean; muted?: boolean; small?: boolean }) {
  return (
    <div className={`flex justify-between py-1 ${small ? 'text-xs' : 'text-sm'} ${muted ? 'opacity-60' : ''}`}>
      <span className={highlight ? 'font-medium' : 'opacity-70'}>{label}</span>
      <span className={highlight ? 'font-medium text-lg' : ''} style={highlight ? { color: '#beb0a2', fontFamily: 'Cormorant Garamond, serif' } : {}}>
        {value}
      </span>
    </div>
  );
}

function CatalogoModal({ catalogo, onClose, onPick }: { catalogo: PartidaCatalogo[]; onClose: () => void; onPick: (p: PartidaCatalogo) => void }) {
  const [search, setSearch] = useState('');
  const filtered = catalogo.filter(p => {
    const s = search.toLowerCase();
    return !s || p.descripcion.toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s) || (p.capitulo || '').toLowerCase().includes(s);
  });
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-black border border-white/20 rounded-lg p-6 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>Catálogo de partidas</h2>
          <button onClick={onClose} className="text-2xl opacity-60 hover:opacity-100">×</button>
        </div>
        <input
          autoFocus
          placeholder="Buscar por descripción, código o capítulo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm mb-4"
        />
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 && <div className="text-center py-8 opacity-50 text-sm">Sin resultados</div>}
          {filtered.map(p => (
            <button key={p.id} onClick={() => onPick(p)}
              className="w-full text-left p-3 border-b border-white/5 hover:bg-white/[0.03] transition">
              <div className="flex justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{p.descripcion}</div>
                  <div className="text-[11px] opacity-60 mt-0.5">
                    {p.codigo && <>{p.codigo} · </>}
                    {p.capitulo && <>{p.capitulo} · </>}
                    {p.unidad}
                    {p.veces_usada > 0 && <> · usada {p.veces_usada}×</>}
                  </div>
                </div>
                <div className="text-right text-sm" style={{ color: '#beb0a2' }}>{formatEUR(p.pvp)}/{p.unidad}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function generarHTMLpresupuesto(p: Presupuesto, partidas: PresupuestoPartida[], s: CompanySettings, t: ReturnType<typeof calcularPresupuesto>): string {
  const fechaFmt = new Date(p.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const validoHasta = new Date(p.fecha);
  validoHasta.setDate(validoHasta.getDate() + (p.validez_dias || 30));
  const validoHastaFmt = validoHasta.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });

  const grupos: Record<string, PresupuestoPartida[]> = {};
  for (const part of partidas) {
    const cap = part.capitulo || 'GENERAL';
    if (!grupos[cap]) grupos[cap] = [];
    grupos[cap].push(part);
  }

  const partidasHTML = Object.entries(grupos).map(([capitulo, items]) => `
    <tr class="capitulo-row"><td colspan="6">${capitulo}</td></tr>
    ${items.map(item => {
      const c = calcularPartida(item);
      return `
        <tr>
          <td class="codigo">${item.codigo || ''}</td>
          <td class="descripcion">${item.descripcion}</td>
          <td class="num">${item.cantidad.toFixed(2)} ${item.unidad}</td>
          <td class="num">${formatEUR(item.pvp)}</td>
          <td class="num">${item.descuento_pct > 0 ? item.descuento_pct.toFixed(0) + '%' : '—'}</td>
          <td class="num total">${formatEUR(c.total_neto)}</td>
        </tr>
      `;
    }).join('')}
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>${p.numero} - ${s.nombre_comercial || 'Ranuse Design'}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500&family=Jost:wght@300;400;500;600&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 18mm 14mm; }
  body { font-family: 'Jost', sans-serif; color: #0a0a0a; font-size: 10pt; line-height: 1.4; background: white; }

  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0a0a0a; padding-bottom: 14mm; margin-bottom: 10mm; }
  .logo-section { display: flex; align-items: center; gap: 8mm; }
  .logo { width: 18mm; height: 18mm; }
  .logo-text h1 { font-family: 'Cormorant Garamond', serif; font-size: 22pt; font-weight: 400; letter-spacing: 0.2em; }
  .logo-text .subtitle { font-size: 8pt; letter-spacing: 0.4em; opacity: 0.6; margin-top: -2pt; }

  .company-info { text-align: right; font-size: 8.5pt; line-height: 1.6; }
  .company-info .name { font-weight: 500; font-size: 10pt; margin-bottom: 1mm; }

  .doc-meta { display: flex; justify-content: space-between; gap: 8mm; margin-bottom: 10mm; }
  .doc-meta-block { flex: 1; }
  .doc-meta-block h3 { font-family: 'Cormorant Garamond', serif; font-size: 14pt; font-weight: 400; margin-bottom: 3mm; color: #0a0a0a; }
  .doc-meta-block .label-line { font-size: 7.5pt; letter-spacing: 0.25em; text-transform: uppercase; color: #beb0a2; margin-bottom: 1mm; }
  .doc-meta-block p { font-size: 9.5pt; line-height: 1.5; }

  .num-presupuesto { background: #0a0a0a; color: white; padding: 6mm; min-width: 60mm; }
  .num-presupuesto .num-label { font-size: 7.5pt; letter-spacing: 0.3em; text-transform: uppercase; color: #beb0a2; margin-bottom: 1mm; }
  .num-presupuesto .num-valor { font-family: 'Cormorant Garamond', serif; font-size: 18pt; }
  .num-presupuesto .num-fecha { font-size: 8pt; margin-top: 2mm; opacity: 0.8; }
  .num-presupuesto .num-validez { font-size: 8pt; opacity: 0.7; }

  table.partidas { width: 100%; border-collapse: collapse; margin-bottom: 8mm; font-size: 9pt; }
  table.partidas thead th { text-align: left; padding: 3mm 2mm; font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #beb0a2; border-bottom: 1px solid #0a0a0a; }
  table.partidas thead th.num { text-align: right; }
  table.partidas td { padding: 2.5mm 2mm; vertical-align: top; border-bottom: 0.3px solid #ddd; }
  table.partidas td.num { text-align: right; white-space: nowrap; }
  table.partidas td.codigo { font-family: monospace; font-size: 8pt; color: #777; width: 18mm; }
  table.partidas td.descripcion { width: 50%; }
  table.partidas td.total { font-weight: 500; }
  .capitulo-row td { background: #f5f1ec; padding: 2mm; font-weight: 500; font-size: 8.5pt; letter-spacing: 0.15em; text-transform: uppercase; color: #0a0a0a; border-bottom: 1px solid #beb0a2 !important; }

  .totales { margin-left: auto; width: 80mm; margin-bottom: 10mm; }
  .totales .row { display: flex; justify-content: space-between; padding: 1.5mm 0; font-size: 9.5pt; }
  .totales .row.muted { color: #777; font-size: 8.5pt; }
  .totales .row.total-final { border-top: 2px solid #0a0a0a; padding-top: 3mm; margin-top: 2mm; font-family: 'Cormorant Garamond', serif; font-size: 16pt; font-weight: 500; }
  .totales .iva-note { font-size: 7.5pt; color: #999; margin-top: 1mm; text-align: right; font-style: italic; }

  .info-section { margin-bottom: 6mm; padding: 4mm 5mm; background: #faf9f7; border-left: 3px solid #beb0a2; }
  .info-section h4 { font-size: 7.5pt; letter-spacing: 0.25em; text-transform: uppercase; color: #beb0a2; margin-bottom: 2mm; }
  .info-section p { font-size: 9pt; line-height: 1.5; white-space: pre-wrap; }

  .footer { position: fixed; bottom: 8mm; left: 14mm; right: 14mm; padding-top: 3mm; border-top: 0.5px solid #beb0a2; font-size: 7.5pt; text-align: center; color: #777; letter-spacing: 0.1em; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .footer { position: fixed; bottom: 0; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="logo-section">
      <svg class="logo" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,15 80,15 50,85" fill="#0a0a0a"/>
        <text x="50" y="55" text-anchor="middle" font-family="Cormorant Garamond, serif" font-size="32" fill="white" font-weight="500">TR</text>
      </svg>
      <div class="logo-text">
        <h1>RANUSE</h1>
        <div class="subtitle">DESIGN</div>
      </div>
    </div>
    <div class="company-info">
      ${s.razon_social ? `<div class="name">${s.razon_social}</div>` : ''}
      ${s.cif ? `<div>CIF ${s.cif}</div>` : ''}
      ${s.direccion ? `<div>${s.direccion}</div>` : ''}
      ${(s.codigo_postal || s.ciudad) ? `<div>${[s.codigo_postal, s.ciudad, s.provincia].filter(Boolean).join(' · ')}</div>` : ''}
      ${s.telefono ? `<div>${s.telefono}</div>` : ''}
      ${s.email ? `<div>${s.email}</div>` : ''}
      ${s.web ? `<div>${s.web}</div>` : ''}
    </div>
  </div>

  <div class="doc-meta">
    <div class="doc-meta-block">
      <div class="label-line">Cliente</div>
      <h3>${p.cliente_nombre}</h3>
      <p>
        ${p.cliente_cif ? `${p.cliente_cif}<br>` : ''}
        ${p.cliente_direccion ? `${p.cliente_direccion}<br>` : ''}
        ${(p.cliente_codigo_postal || p.cliente_ciudad) ? [p.cliente_codigo_postal, p.cliente_ciudad].filter(Boolean).join(' · ') + '<br>' : ''}
        ${p.cliente_email ? `${p.cliente_email}<br>` : ''}
        ${p.cliente_telefono ? `${p.cliente_telefono}` : ''}
      </p>
    </div>
    <div class="num-presupuesto">
      <div class="num-label">Presupuesto</div>
      <div class="num-valor">${p.numero}</div>
      <div class="num-fecha">${fechaFmt}</div>
      <div class="num-validez">Válido hasta ${validoHastaFmt}</div>
    </div>
  </div>

  <table class="partidas">
    <thead>
      <tr>
        <th>Cód.</th>
        <th>Descripción</th>
        <th class="num">Cant.</th>
        <th class="num">Precio</th>
        <th class="num">Dto.</th>
        <th class="num">Importe</th>
      </tr>
    </thead>
    <tbody>
      ${partidasHTML}
    </tbody>
  </table>

  <div class="totales">
    <div class="row"><span>Subtotal</span><span class="valor">${formatEUR(t.subtotal_neto)}</span></div>
    ${t.descuento_global > 0 ? `<div class="row muted"><span>Descuento ${p.descuento_global_pct}%</span><span class="valor">− ${formatEUR(t.descuento_global)}</span></div>` : ''}
    <div class="row total-final"><span>TOTAL</span><span class="valor">${formatEUR(t.base_imponible)}</span></div>
    <div class="iva-note">Importes sin IVA. IVA aplicable en factura.</div>
  </div>

  ${p.formas_pago ? `<div class="info-section">
    <h4>Formas de pago</h4>
    <p>${p.formas_pago}</p>
  </div>` : ''}

  ${p.notas ? `<div class="info-section">
    <h4>Notas</h4>
    <p>${p.notas}</p>
  </div>` : ''}

  ${p.condiciones ? `<div class="info-section">
    <h4>Condiciones</h4>
    <p>${p.condiciones}</p>
  </div>` : ''}

  ${s.iban ? `<div class="info-section">
    <h4>Datos bancarios</h4>
    <p>${s.banco ? s.banco + ' · ' : ''}${s.iban}</p>
  </div>` : ''}

  <div class="footer">
    ${s.nombre_comercial || 'RANUSE DESIGN'} ${s.web ? '· ' + s.web : ''} ${s.email ? '· ' + s.email : ''}
  </div>
</body>
</html>`;
}
