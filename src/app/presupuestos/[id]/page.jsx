'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { calcularPartida, calcularCapitulo, calcularPresupuesto, formatEUR, pvpDesdeMargen, margenDesdeCostePvp, beneficioRealPct } from '@/lib/presupuestos';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ESTADO_LABELS = { borrador: 'Borrador', enviado: 'Enviado', aceptado: 'Aceptado', rechazado: 'Rechazado', caducado: 'Caducado' };

export default function PresupuestoEditorPage() {
  const params = useParams();
  const id = params.id;

  const [presupuesto, setPresupuesto] = useState(null);
  const [capitulos, setCapitulos] = useState([]); // capítulos del presupuesto
  const [partidas, setPartidas] = useState([]);
  const [settings, setSettings] = useState(null);
  const [capitulosCatalogo, setCapitulosCatalogo] = useState([]); // capítulos globales
  const [partidasCatalogo, setPartidasCatalogo] = useState([]); // partidas globales
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [showCapPicker, setShowCapPicker] = useState(false);
  const [showPartidasPicker, setShowPartidasPicker] = useState(null); // capId al que añadir

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    const [pres, caps, parts, conf, capsCat, partsCat] = await Promise.all([
      supabase.from('presupuestos').select('*').eq('id', id).single(),
      supabase.from('presupuesto_capitulos').select('*').eq('presupuesto_id', id).order('orden'),
      supabase.from('presupuesto_partidas').select('*').eq('presupuesto_id', id).order('orden'),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('capitulos_catalogo').select('*').order('orden'),
      supabase.from('partidas_catalogo').select('*').order('descripcion'),
    ]);
    setPresupuesto(pres.data);
    setCapitulos(caps.data || []);
    setPartidas(parts.data || []);
    setSettings(conf.data);
    setCapitulosCatalogo(capsCat.data || []);
    setPartidasCatalogo(partsCat.data || []);
    setLoading(false);
  }

  function updateField(field, value) {
    if (!presupuesto) return;
    setPresupuesto({ ...presupuesto, [field]: value });
  }

  async function guardar() {
    if (!presupuesto) return;
    setSaving(true);
    const { id: _, created_at, updated_at, ...rest } = presupuesto;
    await supabase.from('presupuestos').update(rest).eq('id', id);
    setSaving(false);
  }

  async function cambiarEstado(estado) {
    const updates = { estado };
    if (estado === 'enviado') updates.fecha_envio = new Date().toISOString();
    if (estado === 'aceptado') updates.fecha_aceptacion = new Date().toISOString();
    await supabase.from('presupuestos').update(updates).eq('id', id);
    setPresupuesto({ ...presupuesto, ...updates });
  }

  // === CAPÍTULOS DEL PRESUPUESTO ===
  async function addCapituloDesdeC(capCat) {
    // Verificar si ya existe en el presupuesto
    const yaExiste = capitulos.some(c => c.capitulo_catalogo_id === capCat.id);
    if (yaExiste) {
      alert(`El capítulo "${capCat.nombre}" ya está en este presupuesto.`);
      return;
    }
    const { data } = await supabase.from('presupuesto_capitulos').insert({
      presupuesto_id: id,
      capitulo_catalogo_id: capCat.id,
      nombre: capCat.nombre,
      orden: capitulos.length,
    }).select().single();
    if (data) setCapitulos([...capitulos, data]);
    setShowCapPicker(false);
  }

  async function addCapituloLibre() {
    const nombre = prompt('Nombre del capítulo (libre, sin vincular a catálogo)');
    if (!nombre || !nombre.trim()) return;
    const { data } = await supabase.from('presupuesto_capitulos').insert({
      presupuesto_id: id,
      nombre: nombre.trim(),
      orden: capitulos.length,
    }).select().single();
    if (data) setCapitulos([...capitulos, data]);
    setShowCapPicker(false);
  }

  async function renombrarCapitulo(capId, nuevoNombre) {
    if (!nuevoNombre.trim()) return;
    setCapitulos(capitulos.map(c => c.id === capId ? { ...c, nombre: nuevoNombre } : c));
    await supabase.from('presupuesto_capitulos').update({ nombre: nuevoNombre }).eq('id', capId);
  }

  async function eliminarCapitulo(capId) {
    const cap = capitulos.find(c => c.id === capId);
    const partidasCap = partidas.filter(p => p.capitulo_id === capId);
    const msg = partidasCap.length > 0
      ? `¿Eliminar el capítulo "${cap.nombre}" y sus ${partidasCap.length} partida${partidasCap.length > 1 ? 's' : ''}?`
      : `¿Eliminar el capítulo "${cap.nombre}"?`;
    if (!confirm(msg)) return;
    await supabase.from('presupuesto_capitulos').delete().eq('id', capId);
    setCapitulos(capitulos.filter(c => c.id !== capId));
    setPartidas(partidas.filter(p => p.capitulo_id !== capId));
  }

  async function moverCapitulo(capId, dir) {
    const idx = capitulos.findIndex(c => c.id === capId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= capitulos.length) return;
    const updated = [...capitulos];
    [updated[idx], updated[newIdx]] = [updated[newIdx], updated[idx]];
    setCapitulos(updated);
    await Promise.all(updated.map((c, i) => supabase.from('presupuesto_capitulos').update({ orden: i }).eq('id', c.id)));
  }

  // === PARTIDAS ===
  async function addPartidaVacia(capId) {
    const partidasCap = partidas.filter(p => p.capitulo_id === capId);
    const { data } = await supabase.from('presupuesto_partidas').insert({
      presupuesto_id: id, capitulo_id: capId,
      descripcion: 'Nueva partida', unidad: 'ud', cantidad: 1,
      precio_compra: 0, pvp: 0, margen_pct: 0, descuento_pct: 0,
      orden: partidasCap.length,
    }).select().single();
    if (data) setPartidas([...partidas, data]);
  }

  async function addPartidasFromCatalogo(capId, partidasElegidas) {
    const partidasCap = partidas.filter(x => x.capitulo_id === capId);
    const baseOrden = partidasCap.length;
    const inserts = partidasElegidas.map((p, i) => ({
      presupuesto_id: id, capitulo_id: capId, partida_catalogo_id: p.id,
      codigo: p.codigo, descripcion: p.descripcion, unidad: p.unidad,
      cantidad: 1, precio_compra: p.precio_compra, pvp: p.pvp,
      margen_pct: p.margen_default, descuento_pct: 0, orden: baseOrden + i,
    }));
    const { data } = await supabase.from('presupuesto_partidas').insert(inserts).select();
    if (data) setPartidas([...partidas, ...data]);
    // Incrementar contadores
    for (const p of partidasElegidas) {
      await supabase.from('partidas_catalogo').update({ veces_usada: (p.veces_usada || 0) + 1 }).eq('id', p.id);
    }
    setShowPartidasPicker(null);
  }

  async function updatePartida(partidaId, updates) {
    setPartidas(partidas.map(p => p.id === partidaId ? { ...p, ...updates } : p));
    await supabase.from('presupuesto_partidas').update(updates).eq('id', partidaId);
  }

  // CAMBIO DE COSTE → recalcula PVP usando el margen actual
  async function updatePrecioCompra(partidaId, nuevoCoste) {
    const p = partidas.find(x => x.id === partidaId);
    if (!p) return;
    const coste = parseFloat(nuevoCoste) || 0;
    const margen = Number(p.margen_pct) || 0;
    const nuevoPvp = pvpDesdeMargen(coste, margen);
    await updatePartida(partidaId, { precio_compra: coste, pvp: parseFloat(nuevoPvp.toFixed(2)) });
  }

  // CAMBIO DE MARGEN → recalcula PVP a partir del coste
  async function updateMargen(partidaId, nuevoMargen) {
    const p = partidas.find(x => x.id === partidaId);
    if (!p) return;
    const margen = parseFloat(nuevoMargen) || 0;
    const coste = Number(p.precio_compra) || 0;
    const nuevoPvp = pvpDesdeMargen(coste, margen);
    await updatePartida(partidaId, { margen_pct: margen, pvp: parseFloat(nuevoPvp.toFixed(2)) });
  }

  // CAMBIO DE PVP → recalcula margen
  async function updatePvp(partidaId, nuevoPvp) {
    const p = partidas.find(x => x.id === partidaId);
    if (!p) return;
    const pvp = parseFloat(nuevoPvp) || 0;
    const coste = Number(p.precio_compra) || 0;
    const nuevoMargen = margenDesdeCostePvp(coste, pvp);
    await updatePartida(partidaId, { pvp: pvp, margen_pct: parseFloat(nuevoMargen.toFixed(2)) });
  }

  async function deletePartida(partidaId) {
    await supabase.from('presupuesto_partidas').delete().eq('id', partidaId);
    setPartidas(partidas.filter(p => p.id !== partidaId));
  }

  async function moverPartida(partidaId, dir) {
    const p = partidas.find(x => x.id === partidaId);
    const partidasCap = partidas.filter(x => x.capitulo_id === p.capitulo_id).sort((a, b) => a.orden - b.orden);
    const idx = partidasCap.findIndex(x => x.id === partidaId);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= partidasCap.length) return;
    [partidasCap[idx], partidasCap[newIdx]] = [partidasCap[newIdx], partidasCap[idx]];
    const updated = partidas.map(x => {
      const found = partidasCap.findIndex(y => y.id === x.id);
      return found >= 0 ? { ...x, orden: found } : x;
    });
    setPartidas(updated);
    await Promise.all(partidasCap.map((x, i) => supabase.from('presupuesto_partidas').update({ orden: i }).eq('id', x.id)));
  }

  const totales = useMemo(() => calcularPresupuesto(partidas, presupuesto?.descuento_global_pct || 0), [partidas, presupuesto?.descuento_global_pct]);

  async function exportarPDF() {
    setExportingPdf(true);
    try {
      const { default: jsPDF } = await import('jspdf');
      const autoTableMod = await import('jspdf-autotable');
      const autoTable = autoTableMod.default;
      const { generarPDF } = await import('@/lib/pdfGenerator');
      await generarPDF({ jsPDF, autoTable, presupuesto, capitulos, partidas, settings, totales });
    } catch (err) {
      console.error(err);
      alert('Error generando PDF: ' + err.message);
    }
    setExportingPdf(false);
  }

  if (loading) return <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando...</div>;
  if (!presupuesto) return <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Presupuesto no encontrado</div>;

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { border-color: #beb0a2 !important; outline: none; }
        input[type='number']::-webkit-inner-spin-button, input[type='number']::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        input[type='number'] { -moz-appearance: textfield; }
      `}</style>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', maxWidth: 1400, margin: '0 auto', minHeight: '100dvh' }}>
        <div style={{ padding: '32px 40px 60px' }}>
          <Link href="/presupuestos" style={{ color: '#888', fontSize: 11, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Volver al listado</Link>

          <div style={{ marginTop: 16, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <input value={presupuesto.numero} onChange={e => updateField('numero', e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', outline: 'none', width: 320, padding: 0 }} />
              <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 8 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={presupuesto.estado} onChange={e => cambiarEstado(e.target.value)}
                style={{ background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '9px 14px', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer' }}>
                {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => setShowInternal(!showInternal)} style={btnGhost}>{showInternal ? 'Ocultar costes' : 'Ver costes'}</button>
              <button onClick={guardar} disabled={saving} style={{ ...btnSecundario, opacity: saving ? 0.5 : 1 }}>{saving ? 'Guardando...' : 'Guardar'}</button>
              <button onClick={exportarPDF} disabled={exportingPdf} style={{ ...btnPrimario, opacity: exportingPdf ? 0.5 : 1 }}>{exportingPdf ? 'Generando...' : 'Exportar PDF'}</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 40 }}>
            <Bloque titulo="Cliente">
              <Input label="Nombre o razón social" value={presupuesto.cliente_nombre} onChange={v => updateField('cliente_nombre', v)} />
              <Input label="CIF / NIF" value={presupuesto.cliente_cif} onChange={v => updateField('cliente_cif', v)} />
              <Input label="Dirección" value={presupuesto.cliente_direccion} onChange={v => updateField('cliente_direccion', v)} />
              <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 10 }}>
                <Input label="C.P." value={presupuesto.cliente_codigo_postal} onChange={v => updateField('cliente_codigo_postal', v)} />
                <Input label="Ciudad" value={presupuesto.cliente_ciudad} onChange={v => updateField('cliente_ciudad', v)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Email" value={presupuesto.cliente_email} onChange={v => updateField('cliente_email', v)} />
                <Input label="Teléfono" value={presupuesto.cliente_telefono} onChange={v => updateField('cliente_telefono', v)} />
              </div>
            </Bloque>

            <Bloque titulo="Datos del presupuesto">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Input label="Fecha" type="date" value={presupuesto.fecha} onChange={v => updateField('fecha', v)} />
                <Input label="Validez (días)" type="number" value={presupuesto.validez_dias} onChange={v => updateField('validez_dias', parseInt(v) || 30)} />
              </div>
              <Textarea label="Formas de pago" value={presupuesto.formas_pago} onChange={v => updateField('formas_pago', v)} placeholder="Ej: 50% al inicio, 50% a la entrega · Transferencia bancaria" rows={3} />
            </Bloque>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#beb0a2', margin: 0 }}>Capítulos y partidas</h2>
            <button onClick={() => setShowCapPicker(true)} style={btnPrimario}>+ Añadir capítulo</button>
          </div>

          {capitulos.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, color: '#666', fontSize: 13 }}>
              Aún no hay capítulos.<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>Pulsa "+ Añadir capítulo" para empezar</span>
            </div>
          )}

          {capitulos.map((cap, capIdx) => {
            const partidasCap = partidas.filter(p => p.capitulo_id === cap.id).sort((a, b) => a.orden - b.orden);
            const totCap = calcularCapitulo(partidasCap);
            // Buscar el capítulo del catálogo para sus partidas
            const capCatalogo = capitulosCatalogo.find(cc => cc.id === cap.capitulo_catalogo_id);
            const partidasDisponibles = capCatalogo
              ? partidasCatalogo.filter(p => p.capitulo_catalogo_id === capCatalogo.id)
              : partidasCatalogo;

            return (
              <CapituloCard
                key={cap.id}
                capitulo={cap}
                capCatalogo={capCatalogo}
                capIdx={capIdx}
                totalCapitulos={capitulos.length}
                partidas={partidasCap}
                totales={totCap}
                showInternal={showInternal}
                onRenombrar={(n) => renombrarCapitulo(cap.id, n)}
                onEliminar={() => eliminarCapitulo(cap.id)}
                onMover={(dir) => moverCapitulo(cap.id, dir)}
                onAddVacia={() => addPartidaVacia(cap.id)}
                onAddPartidasCatalogo={() => setShowPartidasPicker({ capId: cap.id, partidas: partidasDisponibles, capNombre: cap.nombre })}
                onUpdatePartida={updatePartida}
                onUpdatePrecioCompra={updatePrecioCompra}
                onUpdateMargen={updateMargen}
                onUpdatePvp={updatePvp}
                onDeletePartida={deletePartida}
                onMoverPartida={moverPartida}
              />
            );
          })}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 40 }}>
            <Bloque titulo="Notas">
              <Textarea label="Notas (visibles en el PDF)" value={presupuesto.notas} onChange={v => updateField('notas', v)} rows={4} />
            </Bloque>
            <Bloque titulo="Condiciones">
              <Textarea label="Condiciones (garantía, plazos, exclusiones...)" value={presupuesto.condiciones} onChange={v => updateField('condiciones', v)} rows={4} />
            </Bloque>
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ position: 'sticky', top: 0, height: '100dvh', overflowY: 'auto', borderLeft: '1px solid rgba(255,255,255,0.08)', padding: '32px 28px', background: '#0d0d0d' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#888', marginBottom: 12 }}>Resumen económico</div>

          <ResumenLinea label="Subtotal bruto" valor={formatEUR(totales.subtotal_bruto)} />
          {totales.total_descuentos_partidas > 0 && (
            <ResumenLinea label="Descuentos por partida" valor={`− ${formatEUR(totales.total_descuentos_partidas)}`} muted />
          )}
          <ResumenLinea label="Subtotal" valor={formatEUR(totales.subtotal_neto)} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', fontSize: 13 }}>
            <span style={{ color: '#aaa' }}>Descuento global</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="number" value={presupuesto.descuento_global_pct || 0} onChange={e => updateField('descuento_global_pct', parseFloat(e.target.value) || 0)}
                style={{ width: 50, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', borderRadius: 3, padding: '3px 6px', textAlign: 'right', fontSize: 12 }} />
              <span style={{ color: '#666', fontSize: 12 }}>%</span>
            </div>
          </div>
          {totales.descuento_global > 0 && <ResumenLinea label="" valor={`− ${formatEUR(totales.descuento_global)}`} muted small />}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 12, paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#beb0a2' }}>Total</span>
              <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 500, color: '#beb0a2' }}>{formatEUR(totales.base_imponible)}</span>
            </div>
            <div style={{ fontSize: 10, color: '#666', textAlign: 'right', marginTop: 4 }}>Sin IVA · Se factura aparte</div>
          </div>

          {showInternal && (
            <div style={{ marginTop: 28, padding: 16, background: 'rgba(255,255,255,0.03)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#888', marginBottom: 12 }}>Datos internos</div>
              <ResumenLinea label="Coste total" valor={formatEUR(totales.coste_total)} small muted />
              <ResumenLinea label="Beneficio" valor={formatEUR(totales.beneficio_total)} small color={totales.beneficio_total >= 0 ? '#7fd87f' : '#ff6b6b'} />
              <ResumenLinea label="Margen real" valor={`${totales.margen_real_pct.toFixed(1)}%`} small muted />
            </div>
          )}

          <div style={{ marginTop: 28, fontSize: 10, color: '#666', lineHeight: 1.5 }}>
            <div style={{ marginBottom: 4 }}>Capítulos: <span style={{ color: '#aaa' }}>{capitulos.length}</span></div>
            <div>Partidas: <span style={{ color: '#aaa' }}>{partidas.length}</span></div>
          </div>
        </div>
      </div>

      {showCapPicker && (
        <CapituloPicker
          capitulosCatalogo={capitulosCatalogo}
          capitulosUsados={capitulos}
          onClose={() => setShowCapPicker(false)}
          onPick={addCapituloDesdeC}
          onPickLibre={addCapituloLibre}
        />
      )}

      {showPartidasPicker && (
        <PartidasPicker
          capId={showPartidasPicker.capId}
          capNombre={showPartidasPicker.capNombre}
          partidasDisponibles={showPartidasPicker.partidas}
          onClose={() => setShowPartidasPicker(null)}
          onAdd={(elegidas) => addPartidasFromCatalogo(showPartidasPicker.capId, elegidas)}
        />
      )}
    </div>
  );
}

// ============================================================
// CAPÍTULO PICKER (modal "+ Añadir capítulo")
// ============================================================
function CapituloPicker({ capitulosCatalogo, capitulosUsados, onClose, onPick, onPickLibre }) {
  const idsUsados = new Set(capitulosUsados.map(c => c.capitulo_catalogo_id).filter(Boolean));
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a0a0a', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, width: '100%', maxWidth: 600, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#beb0a2' }}>Añadir capítulo</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ padding: '14px 24px 8px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#888' }}>Desde el catálogo</div>
          {capitulosCatalogo.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#666', fontSize: 12 }}>
              No hay capítulos en el catálogo.<br />
              <Link href="/presupuestos/capitulos" style={{ color: '#beb0a2', textDecoration: 'underline', fontSize: 11 }}>Ir a gestionar capítulos</Link>
            </div>
          ) : capitulosCatalogo.map(cap => {
            const yaUsado = idsUsados.has(cap.id);
            return (
              <button key={cap.id} onClick={() => !yaUsado && onPick(cap)} disabled={yaUsado}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'transparent', color: yaUsado ? '#555' : '#fff', cursor: yaUsado ? 'not-allowed' : 'pointer', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontFamily: 'monospace', fontSize: 12, color: yaUsado ? '#444' : '#beb0a2', fontWeight: 600, minWidth: 50 }}>{cap.codigo}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14 }}>{cap.nombre}</div>
                    {cap.descripcion && <div style={{ fontSize: 11, color: yaUsado ? '#444' : '#888', marginTop: 2 }}>{cap.descripcion}</div>}
                  </div>
                  {yaUsado && <span style={{ fontSize: 9, color: '#666', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ya añadido</span>}
                </div>
              </button>
            );
          })}
          <div style={{ padding: '14px 24px 8px', fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#888', marginTop: 8 }}>O...</div>
          <button onClick={onPickLibre}
            style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 24px', background: 'transparent', color: '#beb0a2', cursor: 'pointer', border: 'none', fontSize: 13 }}>
            + Crear capítulo libre (sin vincular al catálogo)
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PARTIDAS PICKER (modal con checkboxes)
// ============================================================
function PartidasPicker({ capNombre, partidasDisponibles, onClose, onAdd }) {
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');

  const filtered = partidasDisponibles.filter(p => {
    const s = search.toLowerCase();
    return !s || p.descripcion.toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s);
  });

  function toggle(id) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id); else n.add(id);
    setSelected(n);
  }

  function toggleTodos() {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(p => p.id)));
  }

  function confirmar() {
    const elegidas = partidasDisponibles.filter(p => selected.has(p.id));
    onAdd(elegidas);
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a0a0a', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, width: '100%', maxWidth: 800, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#beb0a2' }}>Añadir partidas</h3>
            <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ fontSize: 11, color: '#888' }}>Capítulo: <span style={{ color: '#aaa' }}>{capNombre}</span></div>
        </div>

        <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <input autoFocus placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '9px 14px', fontSize: 13 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#aaa', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleTodos} />
            Todas
          </label>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>
              {partidasDisponibles.length === 0
                ? <>No hay partidas en este capítulo.<br /><Link href="/presupuestos/catalogo" style={{ color: '#beb0a2', textDecoration: 'underline', fontSize: 11 }}>Crear partidas en el catálogo</Link></>
                : 'Sin resultados'}
            </div>
          )}
          {filtered.map(p => {
            const isSel = selected.has(p.id);
            return (
              <button key={p.id} onClick={() => toggle(p.id)}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '12px 24px', background: isSel ? 'rgba(190,176,162,0.08)' : 'transparent', borderBottom: '1px solid rgba(255,255,255,0.05)', color: '#fff', cursor: 'pointer', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input type="checkbox" checked={isSel} readOnly style={{ pointerEvents: 'none' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13 }}>
                      {p.codigo && <span style={{ fontFamily: 'monospace', color: '#888', marginRight: 8 }}>{p.codigo}</span>}
                      {p.descripcion}
                    </div>
                    <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>
                      {p.unidad}
                      {p.veces_usada > 0 && <> · usada {p.veces_usada}×</>}
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#beb0a2', whiteSpace: 'nowrap' }}>{formatEUR(p.pvp)}/{p.unidad}</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, color: '#888' }}>{selected.size} seleccionada{selected.size !== 1 ? 's' : ''}</div>
          <button onClick={confirmar} disabled={selected.size === 0}
            style={{ background: selected.size > 0 ? '#beb0a2' : '#333', color: selected.size > 0 ? '#0a0a0a' : '#666', border: 'none', borderRadius: 4, padding: '11px 24px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: selected.size > 0 ? 'pointer' : 'default' }}>
            Insertar {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// CAPÍTULO CARD
// ============================================================
function CapituloCard({ capitulo, capCatalogo, capIdx, totalCapitulos, partidas, totales, showInternal, onRenombrar, onEliminar, onMover, onAddVacia, onAddPartidasCatalogo, onUpdatePartida, onUpdatePrecioCompra, onUpdateMargen, onUpdatePvp, onDeletePartida, onMoverPartida }) {
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreLocal, setNombreLocal] = useState(capitulo.nombre);

  return (
    <div style={{ marginBottom: 24, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: 'rgba(190,176,162,0.08)', borderBottom: '1px solid rgba(190,176,162,0.2)', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => onMover(-1)} disabled={capIdx === 0} style={{ ...btnIcon, fontSize: 9 }}>▲</button>
          <button onClick={() => onMover(1)} disabled={capIdx === totalCapitulos - 1} style={{ ...btnIcon, fontSize: 9 }}>▼</button>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 4, background: '#beb0a2', color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
          {capIdx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editandoNombre ? (
            <input autoFocus value={nombreLocal} onChange={e => setNombreLocal(e.target.value)}
              onBlur={() => { onRenombrar(nombreLocal); setEditandoNombre(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { onRenombrar(nombreLocal); setEditandoNombre(false); } if (e.key === 'Escape') { setNombreLocal(capitulo.nombre); setEditandoNombre(false); } }}
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #beb0a2', color: '#fff', fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, outline: 'none', width: '100%', padding: '2px 0' }} />
          ) : (
            <div onClick={() => { setNombreLocal(capitulo.nombre); setEditandoNombre(true); }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#fff', cursor: 'text', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {capCatalogo && <span style={{ color: '#888', marginRight: 8, fontSize: 14, fontFamily: 'monospace' }}>{capCatalogo.codigo}</span>}
              {capitulo.nombre}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>{partidas.length} partida{partidas.length !== 1 ? 's' : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Subtotal</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#beb0a2', fontWeight: 500 }}>{formatEUR(totales.subtotal_neto)}</div>
        </div>
        <button onClick={onEliminar} style={{ ...btnIcon, fontSize: 16, color: '#666', marginLeft: 8 }}>×</button>
      </div>

      {partidas.length === 0 ? (
        <div style={{ padding: 28, textAlign: 'center', color: '#666', fontSize: 12 }}>Sin partidas en este capítulo</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                <th style={th(40)}></th>
                <th style={th(80)}>Cód.</th>
                <th style={{ ...th(0), textAlign: 'left', minWidth: 240 }}>Descripción</th>
                <th style={th(60)}>Ud.</th>
                <th style={{ ...th(70), textAlign: 'right' }}>Cant.</th>
                {showInternal && <th style={{ ...th(90), textAlign: 'right', color: '#666' }}>P.Compra</th>}
                {showInternal && <th style={{ ...th(70), textAlign: 'right', color: '#666' }}>Margen%</th>}
                <th style={{ ...th(90), textAlign: 'right' }}>PVP</th>
                <th style={{ ...th(60), textAlign: 'right' }}>Dto%</th>
                <th style={{ ...th(110), textAlign: 'right' }}>Total</th>
                {showInternal && <th style={{ ...th(100), textAlign: 'right', color: '#666' }}>Benef.</th>}
                <th style={th(50)}></th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p, idx) => {
                const c = calcularPartida(p);
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ ...td, padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <button onClick={() => onMoverPartida(p.id, -1)} disabled={idx === 0} style={{ ...btnIcon, fontSize: 8, display: 'block', width: '100%' }}>▲</button>
                      <button onClick={() => onMoverPartida(p.id, 1)} disabled={idx === partidas.length - 1} style={{ ...btnIcon, fontSize: 8, display: 'block', width: '100%' }}>▼</button>
                    </td>
                    <td style={td}><InlineInput value={p.codigo} onChange={v => onUpdatePartida(p.id, { codigo: v })} /></td>
                    <td style={td}><InlineInput value={p.descripcion} onChange={v => onUpdatePartida(p.id, { descripcion: v })} multiline /></td>
                    <td style={td}><InlineInput value={p.unidad} onChange={v => onUpdatePartida(p.id, { unidad: v })} /></td>
                    <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.cantidad} onChange={v => onUpdatePartida(p.id, { cantidad: parseFloat(v) || 0 })} align="right" /></td>
                    {showInternal && <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.precio_compra} onChange={v => onUpdatePrecioCompra(p.id, v)} align="right" muted /></td>}
                    {showInternal && <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={Number(p.margen_pct).toFixed(1)} onChange={v => onUpdateMargen(p.id, v)} align="right" muted /></td>}
                    <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.pvp} onChange={v => onUpdatePvp(p.id, v)} align="right" /></td>
                    <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.descuento_pct} onChange={v => onUpdatePartida(p.id, { descuento_pct: parseFloat(v) || 0 })} align="right" /></td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatEUR(c.total_neto)}</td>
                    {showInternal && <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: c.beneficio >= 0 ? '#7fd87f' : '#ff6b6b' }}>{formatEUR(c.beneficio)}</td>}
                    <td style={{ ...td, textAlign: 'right' }}>
                      <button onClick={() => onDeletePartida(p.id)} style={{ ...btnIcon, fontSize: 14, color: '#666' }}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onAddPartidasCatalogo} style={btnGhost}>+ Partidas del catálogo</button>
        <button onClick={onAddVacia} style={btnGhost}>+ Partida en blanco</button>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES UI
// ============================================================
function Bloque({ titulo, children }) {
  return (
    <div>
      <div style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#beb0a2', marginBottom: 14 }}>{titulo}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text', placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#666', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>{label}</label>
      <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '6px 0', fontSize: 13, fontFamily: 'inherit' }} />
    </div>
  );
}

function Textarea({ label, value, onChange, rows = 3, placeholder }) {
  return (
    <div>
      <label style={{ display: 'block', color: '#666', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 4 }}>{label}</label>
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={rows} placeholder={placeholder}
        style={{ width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit', resize: 'vertical' }} />
    </div>
  );
}

function InlineInput({ value, onChange, type = 'text', align = 'left', muted = false, multiline = false }) {
  if (multiline) {
    return (
      <textarea value={value || ''} onChange={e => onChange(e.target.value)} rows={1}
        style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: muted ? '#888' : '#fff', padding: '4px 6px', fontSize: 13, fontFamily: 'inherit', textAlign: align, resize: 'vertical', minHeight: 28 }}
        onFocus={e => e.target.style.border = '1px solid rgba(190,176,162,0.4)'}
        onBlur={e => e.target.style.border = '1px solid transparent'} />
    );
  }
  return (
    <input type={type} value={value === null || value === undefined ? '' : value} onChange={e => onChange(e.target.value)}
      style={{ width: '100%', background: 'transparent', border: '1px solid transparent', color: muted ? '#888' : '#fff', padding: '4px 6px', fontSize: 13, fontFamily: 'inherit', textAlign: align, borderRadius: 3 }}
      onFocus={e => e.target.style.border = '1px solid rgba(190,176,162,0.4)'}
      onBlur={e => e.target.style.border = '1px solid transparent'} />
  );
}

function ResumenLinea({ label, valor, muted, color, small }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: small ? 11 : 13 }}>
      {label && <span style={{ color: muted ? '#666' : '#aaa' }}>{label}</span>}
      <span style={{ fontFamily: 'monospace', color: color || (muted ? '#666' : '#fff'), fontWeight: 500, marginLeft: 'auto' }}>{valor}</span>
    </div>
  );
}

const btnPrimario = { background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block' };
const btnSecundario = { background: 'transparent', color: '#beb0a2', border: '1px solid rgba(190,176,162,0.4)', borderRadius: 4, padding: '9px 18px', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer' };
const btnGhost = { background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '8px 14px', fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer' };
const btnIcon = { background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 };
const th = (w) => ({ textAlign: 'left', padding: '10px 6px', fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#888', fontWeight: 600, width: w || 'auto', minWidth: w || 'auto' });
const td = { padding: '4px 4px', verticalAlign: 'middle' };
