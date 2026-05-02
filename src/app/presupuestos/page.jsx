'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { calcularPresupuesto, formatEUR } from '@/lib/presupuestos';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ESTADO_COLORS = { borrador: '#888', enviado: '#3498db', aceptado: '#7fd87f', rechazado: '#e74c3c', caducado: '#666' };
const ESTADO_LABELS = { borrador: 'Borrador', enviado: 'Enviado', aceptado: 'Aceptado', rechazado: 'Rechazado', caducado: 'Caducado' };

export default function PresupuestosPage() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState('todos');
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    const { data: presList } = await supabase.from('presupuestos').select('*').order('fecha', { ascending: false });
    if (!presList) { setLoading(false); return; }
    const ids = presList.map(p => p.id);
    const { data: partidas } = ids.length
      ? await supabase.from('presupuesto_partidas').select('*').in('presupuesto_id', ids)
      : { data: [] };
    const enriched = presList.map(p => {
      const ps = (partidas || []).filter(x => x.presupuesto_id === p.id);
      const totales = calcularPresupuesto(ps, p.descuento_global_pct || 0);
      return { ...p, total: totales.base_imponible, beneficio: totales.beneficio_total };
    });
    setPresupuestos(enriched);
    setLoading(false);
  }

  async function crearNuevo() {
    setCreating(true);
    try {
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
      if (nuevo) window.location.href = `/presupuestos/${nuevo.id}`;
    } catch (e) { alert('Error: ' + e.message); }
    setCreating(false);
  }

  async function duplicar(id) {
    const { data: orig } = await supabase.from('presupuestos').select('*').eq('id', id).single();
    const { data: capitulos } = await supabase.from('presupuesto_capitulos').select('*').eq('presupuesto_id', id).order('orden');
    const { data: partidas } = await supabase.from('presupuesto_partidas').select('*').eq('presupuesto_id', id);
    if (!orig) return;
    const { data: numData } = await supabase.rpc('next_presupuesto_numero');
    const numero = numData || `PRES-${Date.now()}`;
    const { id: _, created_at, updated_at, numero: __, ...rest } = orig;
    const { data: nuevo } = await supabase.from('presupuestos').insert({
      ...rest, numero, estado: 'borrador', fecha_envio: null, fecha_aceptacion: null,
      fecha: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (!nuevo) return;
    const capMap = {};
    for (const cap of (capitulos || [])) {
      const { id: oldId, created_at, presupuesto_id, ...capRest } = cap;
      const { data: newCap } = await supabase.from('presupuesto_capitulos').insert({ ...capRest, presupuesto_id: nuevo.id }).select().single();
      if (newCap) capMap[oldId] = newCap.id;
    }
    if (partidas && partidas.length) {
      const nuevasPartidas = partidas.map(p => {
        const { id: _, created_at, presupuesto_id, capitulo_id, ...rest } = p;
        return { ...rest, presupuesto_id: nuevo.id, capitulo_id: capMap[capitulo_id] || null };
      });
      await supabase.from('presupuesto_partidas').insert(nuevasPartidas);
    }
    window.location.href = `/presupuestos/${nuevo.id}`;
  }

  async function eliminar(id) {
    if (!confirm('¿Eliminar este presupuesto? Esta acción no se puede deshacer.')) return;
    await supabase.from('presupuestos').delete().eq('id', id);
    loadAll();
  }

  const filtered = filterEstado === 'todos' ? presupuestos : presupuestos.filter(p => p.estado === filterEstado);
  const totalAceptados = presupuestos.filter(p => p.estado === 'aceptado').reduce((s, p) => s + p.total, 0);
  const totalPendientes = presupuestos.filter(p => p.estado === 'enviado').reduce((s, p) => s + p.total, 0);

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px 60px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 400, letterSpacing: '0.04em', margin: 0 }}>Presupuestos</h1>
            <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 12 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link href="/presupuestos/capitulos" style={btnSecundario}>Capítulos</Link>
            <Link href="/presupuestos/catalogo" style={btnSecundario}>Catálogo</Link>
            <Link href="/presupuestos/empresa" style={btnSecundario}>Mi empresa</Link>
            <button onClick={crearNuevo} disabled={creating} style={{ ...btnPrimario, opacity: creating ? 0.5 : 1 }}>
              {creating ? 'Creando...' : '+ Nuevo presupuesto'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          <StatCard label="Total presupuestos" value={String(presupuestos.length)} />
          <StatCard label="Pendientes (enviados)" value={formatEUR(totalPendientes)} color="#3498db" />
          <StatCard label="Aceptados (acumulado)" value={formatEUR(totalAceptados)} color="#beb0a2" highlight />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['todos', 'borrador', 'enviado', 'aceptado', 'rechazado'].map(e => (
            <button key={e} onClick={() => setFilterEstado(e)} style={{
              background: filterEstado === e ? '#beb0a2' : 'transparent',
              color: filterEstado === e ? '#0a0a0a' : '#888',
              border: '1px solid ' + (filterEstado === e ? '#beb0a2' : 'rgba(255,255,255,0.15)'),
              borderRadius: 100, padding: '6px 14px', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', fontWeight: 500
            }}>
              {e === 'todos' ? 'Todos' : ESTADO_LABELS[e]}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>Cargando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#666', fontSize: 13 }}>No hay presupuestos en este filtro.</div>
        ) : (
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px 130px 130px 180px', padding: '12px 20px', background: 'rgba(255,255,255,0.03)', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', fontWeight: 600 }}>
              <div>Nº</div><div>Cliente</div><div>Fecha</div><div>Estado</div>
              <div style={{ textAlign: 'right' }}>Total</div>
              <div style={{ textAlign: 'right', opacity: 0.6 }}>Beneficio</div>
              <div></div>
            </div>
            {filtered.map(p => (
              <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 100px 100px 130px 130px 180px', padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.06)', alignItems: 'center', fontSize: 13 }}>
                <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#beb0a2' }}>{p.numero}</div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cliente_nombre}</div>
                <div style={{ fontSize: 12, color: '#888' }}>{p.fecha}</div>
                <div>
                  <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 3, background: ESTADO_COLORS[p.estado] + '22', color: ESTADO_COLORS[p.estado], fontWeight: 600 }}>
                    {ESTADO_LABELS[p.estado]}
                  </span>
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatEUR(p.total)}</div>
                <div style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: '#666' }}>{formatEUR(p.beneficio)}</div>
                <div style={{ textAlign: 'right', display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <Link href={`/presupuestos/${p.id}`} style={{ fontSize: 11, color: '#beb0a2', textDecoration: 'none', padding: '4px 10px', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 3 }}>Editar</Link>
                  <button onClick={() => duplicar(p.id)} style={{ fontSize: 11, color: '#888', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 3, padding: '4px 10px', cursor: 'pointer' }}>Duplicar</button>
                  <button onClick={() => eliminar(p.id)} style={{ fontSize: 14, color: '#666', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px' }}>×</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const btnPrimario = { background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnSecundario = { background: 'transparent', color: '#beb0a2', border: '1px solid rgba(190,176,162,0.4)', borderRadius: 4, padding: '10px 20px', fontSize: 12, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };

function StatCard({ label, value, color, highlight }) {
  return (
    <div style={{ border: highlight ? '1px solid #beb0a2' : '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '20px 24px', background: highlight ? 'rgba(190,176,162,0.05)' : 'transparent' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: highlight ? "'Cormorant Garamond', serif" : 'inherit', fontSize: highlight ? 32 : 24, fontWeight: 500, color: color || '#fff' }}>{value}</div>
    </div>
  );
}
