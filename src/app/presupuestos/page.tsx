'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { Presupuesto, PresupuestoEstado, PresupuestoPartida } from '@/lib/types';
import { calcularPresupuesto, formatEUR } from '@/lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const ESTADO_COLORS: Record<PresupuestoEstado, string> = {
  borrador: '#888',
  enviado: '#3498db',
  aceptado: '#2ecc71',
  rechazado: '#e74c3c',
  caducado: '#95a5a6',
};

const ESTADO_LABELS: Record<PresupuestoEstado, string> = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
  caducado: 'Caducado',
};

type PresupuestoConTotales = Presupuesto & {
  total: number;
  beneficio: number;
};

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState<PresupuestoConTotales[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState<'todos' | PresupuestoEstado>('todos');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: presList } = await supabase
      .from('presupuestos')
      .select('*')
      .order('fecha', { ascending: false });
    if (!presList) { setLoading(false); return; }

    const ids = presList.map((p: any) => p.id);
    const { data: partidas } = ids.length
      ? await supabase.from('presupuesto_partidas').select('*').in('presupuesto_id', ids)
      : { data: [] };

    const enriched = (presList as Presupuesto[]).map(p => {
      const ps = ((partidas || []) as PresupuestoPartida[]).filter(x => x.presupuesto_id === p.id);
      const totales = calcularPresupuesto(ps, p.descuento_global_pct || 0);
      return {
        ...p,
        total: totales.base_imponible,
        beneficio: totales.beneficio_total,
      };
    });

    setPresupuestos(enriched);
    setLoading(false);
  }

  async function crearNuevo() {
    setCreating(true);
    const { data: numData } = await supabase.rpc('next_presupuesto_numero');
    const numero = numData || `PRES-${Date.now()}`;
    const { data: settings } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    const { data: nuevo } = await supabase.from('presupuestos').insert({
      numero,
      cliente_nombre: 'Cliente nuevo',
      validez_dias: settings?.validez_default_dias || 30,
      formas_pago: settings?.formas_pago_default || null,
      notas: settings?.notas_default || null,
    }).select().single();
    setCreating(false);
    if (nuevo) {
      window.location.href = `/presupuestos/${nuevo.id}`;
    }
  }

  async function duplicar(id: string) {
    const { data: orig } = await supabase.from('presupuestos').select('*').eq('id', id).single();
    const { data: partidas } = await supabase.from('presupuesto_partidas').select('*').eq('presupuesto_id', id);
    if (!orig) return;
    const { data: numData } = await supabase.rpc('next_presupuesto_numero');
    const numero = numData || `PRES-${Date.now()}`;
    const { id: _, created_at, updated_at, numero: __, ...rest } = orig as any;
    const { data: nuevo } = await supabase.from('presupuestos').insert({
      ...rest,
      numero,
      estado: 'borrador',
      fecha_envio: null,
      fecha_aceptacion: null,
      fecha: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (nuevo && partidas) {
      const nuevasPartidas = (partidas as any[]).map(p => {
        const { id: _, created_at, presupuesto_id, ...rest } = p;
        return { ...rest, presupuesto_id: nuevo.id };
      });
      if (nuevasPartidas.length > 0) {
        await supabase.from('presupuesto_partidas').insert(nuevasPartidas);
      }
      window.location.href = `/presupuestos/${nuevo.id}`;
    }
  }

  async function eliminar(id: string) {
    if (!confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) return;
    await supabase.from('presupuestos').delete().eq('id', id);
    loadAll();
  }

  const filtered = filterEstado === 'todos' ? presupuestos : presupuestos.filter(p => p.estado === filterEstado);

  const total_aceptados = presupuestos.filter(p => p.estado === 'aceptado').reduce((s, p) => s + p.total, 0);
  const total_pendientes = presupuestos.filter(p => p.estado === 'enviado').reduce((s, p) => s + p.total, 0);

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-light tracking-wide" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
            Presupuestos
          </h1>
          <div className="flex gap-2">
            <Link href="/presupuestos/catalogo" className="px-4 py-2 rounded-md text-sm border" style={{ borderColor: '#beb0a2', color: '#beb0a2' }}>
              Catálogo
            </Link>
            <Link href="/presupuestos/empresa" className="px-4 py-2 rounded-md text-sm border" style={{ borderColor: '#beb0a2', color: '#beb0a2' }}>
              Mi empresa
            </Link>
            <button
              onClick={crearNuevo}
              disabled={creating}
              className="px-4 py-2 rounded-md text-sm font-medium"
              style={{ background: '#beb0a2', color: '#0a0a0a' }}
            >{creating ? 'Creando...' : '+ Nuevo presupuesto'}</button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatCard label="Total presupuestos" value={presupuestos.length.toString()} />
          <StatCard label="Pendientes (enviados)" value={formatEUR(total_pendientes)} />
          <StatCard label="Aceptados (acumulado)" value={formatEUR(total_aceptados)} highlight />
        </div>

        <div className="flex gap-2 mb-4 flex-wrap">
          {(['todos', 'borrador', 'enviado', 'aceptado', 'rechazado'] as const).map(e => (
            <button
              key={e}
              onClick={() => setFilterEstado(e)}
              className={`px-3 py-1.5 text-xs rounded-full transition ${filterEstado === e ? '' : 'border border-white/20 opacity-70'}`}
              style={filterEstado === e ? { background: '#beb0a2', color: '#0a0a0a' } : {}}
            >
              {e === 'todos' ? 'Todos' : ESTADO_LABELS[e]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 opacity-60">Cargando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 opacity-50 text-sm">No hay presupuestos</div>
        ) : (
          <div className="border border-white/10 rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-widest opacity-70">
                <tr>
                  <th className="text-left px-4 py-3">Nº</th>
                  <th className="text-left px-4 py-3">Cliente</th>
                  <th className="text-left px-4 py-3">Fecha</th>
                  <th className="text-left px-4 py-3">Estado</th>
                  <th className="text-right px-4 py-3">Total</th>
                  <th className="text-right px-4 py-3 opacity-60">Beneficio</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-mono text-xs">{p.numero}</td>
                    <td className="px-4 py-3">{p.cliente_nombre}</td>
                    <td className="px-4 py-3 text-xs opacity-70">{p.fecha}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-widest px-2 py-1 rounded"
                        style={{ background: ESTADO_COLORS[p.estado] + '33', color: ESTADO_COLORS[p.estado] }}>
                        {ESTADO_LABELS[p.estado]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatEUR(p.total)}</td>
                    <td className="px-4 py-3 text-right text-xs opacity-60">{formatEUR(p.beneficio)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/presupuestos/${p.id}`} className="text-xs px-2 py-1 mr-1" style={{ color: '#beb0a2' }}>Editar</Link>
                      <button onClick={() => duplicar(p.id)} className="text-xs px-2 py-1 mr-1 opacity-60 hover:opacity-100">Duplicar</button>
                      <button onClick={() => eliminar(p.id)} className="text-xs px-2 py-1 opacity-40 hover:opacity-100">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="border border-white/10 rounded-md p-4" style={highlight ? { borderColor: '#beb0a2' } : {}}>
      <div className="text-xs uppercase tracking-widest opacity-60">{label}</div>
      <div className="text-2xl mt-1" style={highlight ? { color: '#beb0a2', fontFamily: 'Cormorant Garamond, serif' } : {}}>{value}</div>
    </div>
  );
}
