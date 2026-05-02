'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { calcularPartida, calcularCapitulo, calcularPresupuesto, formatEUR } from '@/lib/presupuestos';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ESTADO_LABELS = {
  borrador: 'Borrador', enviado: 'Enviado', aceptado: 'Aceptado', rechazado: 'Rechazado', caducado: 'Caducado'
};

export default function PresupuestoEditorPage() {
  const params = useParams();
  const id = params.id;

  const [presupuesto, setPresupuesto] = useState(null);
  const [capitulos, setCapitulos] = useState([]);
  const [partidas, setPartidas] = useState([]);
  const [settings, setSettings] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showInternal, setShowInternal] = useState(false);
  const [showCatalogo, setShowCatalogo] = useState(false);
  const [catalogoTargetCapId, setCatalogoTargetCapId] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => { loadAll(); }, [id]);

  async function loadAll() {
    setLoading(true);
    const [pres, caps, parts, conf, cat] = await Promise.all([
      supabase.from('presupuestos').select('*').eq('id', id).single(),
      supabase.from('presupuesto_capitulos').select('*').eq('presupuesto_id', id).order('orden'),
      supabase.from('presupuesto_partidas').select('*').eq('presupuesto_id', id).order('orden'),
      supabase.from('company_settings').select('*').eq('id', 1).single(),
      supabase.from('partidas_catalogo').select('*').order('descripcion'),
    ]);
    setPresupuesto(pres.data);
    setCapitulos(caps.data || []);
    setPartidas(parts.data || []);
    setSettings(conf.data);
    setCatalogo(cat.data || []);
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

  // === CAPÍTULOS ===
  async function addCapitulo() {
    const nombre = prompt('Nombre del capítulo (ej: Demolición, Pladur, Electricidad)');
    if (!nombre || !nombre.trim()) return;
    const { data } = await supabase.from('presupuesto_capitulos').insert({
      presupuesto_id: id,
      nombre: nombre.trim(),
      orden: capitulos.length,
    }).select().single();
    if (data) setCapitulos([...capitulos, data]);
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
      presupuesto_id: id,
      capitulo_id: capId,
      descripcion: 'Nueva partida',
      unidad: 'ud',
      cantidad: 1,
      precio_compra: 0,
      pvp: 0,
      margen_pct: 0,
      descuento_pct: 0,
      orden: partidasCap.length,
    }).select().single();
    if (data) setPartidas([...partidas, data]);
  }

  async function addPartidaFromCatalogo(capId, p) {
    const partidasCap = partidas.filter(x => x.capitulo_id === capId);
    const { data } = await supabase.from('presupuesto_partidas').insert({
      presupuesto_id: id,
      capitulo_id: capId,
      partida_catalogo_id: p.id,
      codigo: p.codigo,
      descripcion: p.descripcion,
      unidad: p.unidad,
      cantidad: 1,
      precio_compra: p.precio_compra,
      pvp: p.pvp,
      margen_pct: p.margen_default,
      descuento_pct: 0,
      orden: partidasCap.length,
    }).select().single();
    if (data) {
      setPartidas([...partidas, data]);
      await supabase.from('partidas_catalogo').update({ veces_usada: (p.veces_usada || 0) + 1 }).eq('id', p.id);
    }
    setShowCatalogo(false);
    setCatalogoTargetCapId(null);
  }

  async function updatePartida(partidaId, updates) {
    setPartidas(partidas.map(p => p.id === partidaId ? { ...p, ...updates } : p));
    await supabase.from('presupuesto_partidas').update(updates).eq('id', partidaId);
  }

  async function deletePartida(partidaId) {
    await supabase.from('presupuesto_partidas').delete().eq('id', partidaId);
    setPartidas(partidas.filter(p => p.id !== partidaId));
  }

  async function guardarEnCatalogo(partidaId) {
    const p = partidas.find(x => x.id === partidaId);
    if (!p || !p.descripcion) return;
    const yaExiste = catalogo.some(c => c.descripcion === p.descripcion);
    if (yaExiste) {
      alert('Esta partida ya existe en el catálogo');
      return;
    }
    const cap = capitulos.find(c => c.id === p.capitulo_id);
    await supabase.from('partidas_catalogo').insert({
      codigo: p.codigo,
      descripcion: p.descripcion,
      capitulo: cap?.nombre || null,
      unidad: p.unidad,
      precio_compra: p.precio_compra,
      pvp: p.pvp,
      margen_default: p.margen_pct,
    });
    alert('✓ Guardada en catálogo');
    loadAll();
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

  // Totales
  const totales = useMemo(() => calcularPresupuesto(partidas, presupuesto?.descuento_global_pct || 0), [partidas, presupuesto?.descuento_global_pct]);

  async function exportarPDF() {
    setExportingPdf(true);
    try {
      // jsPDF se carga dinámicamente para no romper el SSR
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

  if (loading) return <Cargando />;
  if (!presupuesto) return <Cargando texto="Presupuesto no encontrado" />;

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
        {/* === COLUMNA PRINCIPAL === */}
        <div style={{ padding: '32px 40px 60px' }}>
          <Link href="/presupuestos" style={{ color: '#888', fontSize: 11, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Volver al listado</Link>

          {/* Cabecera */}
          <div style={{ marginTop: 16, marginBottom: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap' }}>
            <div>
              <input value={presupuesto.numero} onChange={e => updateField('numero', e.target.value)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', outline: 'none', width: 320, padding: 0 }} />
              <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 8 }} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <select value={presupuesto.estado} onChange={e => cambiarEstado(e.target.value)} style={selectChip}>
                {Object.entries(ESTADO_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <button onClick={() => setShowInternal(!showInternal)} style={btnGhost}>
                {showInternal ? 'Ocultar costes' : 'Ver costes'}
              </button>
              <button onClick={guardar} disabled={saving} style={{ ...btnSecundario, opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={exportarPDF} disabled={exportingPdf} style={{ ...btnPrimario, opacity: exportingPdf ? 0.5 : 1 }}>
                {exportingPdf ? 'Generando...' : 'Exportar PDF'}
              </button>
            </div>
          </div>

          {/* Datos cliente y presupuesto */}
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

          {/* CAPÍTULOS */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 400, color: '#beb0a2', margin: 0 }}>
              Capítulos y partidas
            </h2>
            <button onClick={addCapitulo} style={btnPrimario}>+ Nuevo capítulo</button>
          </div>

          {capitulos.length === 0 && (
            <div style={{ padding: 60, textAlign: 'center', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8, color: '#666', fontSize: 13 }}>
              Aún no hay capítulos.<br />
              <span style={{ fontSize: 11, opacity: 0.7 }}>Crea uno con "+ Nuevo capítulo" (ej: Demolición, Pladur, Electricidad...)</span>
            </div>
          )}

          {capitulos.map((cap, capIdx) => {
            const partidasCap = partidas.filter(p => p.capitulo_id === cap.id).sort((a, b) => a.orden - b.orden);
            const totCap = calcularCapitulo(partidasCap);
            return (
              <CapituloCard
                key={cap.id}
                capitulo={cap}
                capIdx={capIdx}
                totalCapitulos={capitulos.length}
                partidas={partidasCap}
                totales={totCap}
                showInternal={showInternal}
                onRenombrar={(n) => renombrarCapitulo(cap.id, n)}
                onEliminar={() => eliminarCapitulo(cap.id)}
                onMover={(dir) => moverCapitulo(cap.id, dir)}
                onAddVacia={() => addPartidaVacia(cap.id)}
                onAddCatalogo={() => { setCatalogoTargetCapId(cap.id); setShowCatalogo(true); }}
                onUpdatePartida={updatePartida}
                onDeletePartida={deletePartida}
                onMoverPartida={moverPartida}
                onGuardarEnCatalogo={guardarEnCatalogo}
              />
            );
          })}

          {/* Notas y condiciones */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 40 }}>
            <Bloque titulo="Notas">
              <Textarea label="Notas (visibles en el PDF)" value={presupuesto.notas} onChange={v => updateField('notas', v)} rows={4} />
            </Bloque>
            <Bloque titulo="Condiciones">
              <Textarea label="Condiciones (garantía, plazos, exclusiones...)" value={presupuesto.condiciones} onChange={v => updateField('condiciones', v)} rows={4} />
            </Bloque>
          </div>
        </div>

        {/* === SIDEBAR DE TOTALES === */}
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
          {totales.descuento_global > 0 && (
            <ResumenLinea label="" valor={`− ${formatEUR(totales.descuento_global)}`} muted small />
          )}

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

      {/* MODAL CATÁLOGO */}
      {showCatalogo && (
        <CatalogoModal
          catalogo={catalogo}
          onClose={() => { setShowCatalogo(false); setCatalogoTargetCapId(null); }}
          onPick={(p) => addPartidaFromCatalogo(catalogoTargetCapId, p)}
        />
      )}
    </div>
  );
}

// ============================================================
// CAPÍTULO CARD
// ============================================================
function CapituloCard({ capitulo, capIdx, totalCapitulos, partidas, totales, showInternal, onRenombrar, onEliminar, onMover, onAddVacia, onAddCatalogo, onUpdatePartida, onDeletePartida, onMoverPartida, onGuardarEnCatalogo }) {
  const [editandoNombre, setEditandoNombre] = useState(false);
  const [nombreLocal, setNombreLocal] = useState(capitulo.nombre);

  return (
    <div style={{ marginBottom: 24, border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header capítulo */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 20px', background: 'rgba(190,176,162,0.08)', borderBottom: '1px solid rgba(190,176,162,0.2)', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => onMover(-1)} disabled={capIdx === 0} style={{ ...btnIcon, fontSize: 9, padding: '0 4px' }}>▲</button>
          <button onClick={() => onMover(1)} disabled={capIdx === totalCapitulos - 1} style={{ ...btnIcon, fontSize: 9, padding: '0 4px' }}>▼</button>
        </div>
        <div style={{ width: 36, height: 36, borderRadius: 4, background: '#beb0a2', color: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 600, flexShrink: 0 }}>
          {capIdx + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {editandoNombre ? (
            <input
              autoFocus
              value={nombreLocal}
              onChange={e => setNombreLocal(e.target.value)}
              onBlur={() => { onRenombrar(nombreLocal); setEditandoNombre(false); }}
              onKeyDown={e => { if (e.key === 'Enter') { onRenombrar(nombreLocal); setEditandoNombre(false); } if (e.key === 'Escape') { setNombreLocal(capitulo.nombre); setEditandoNombre(false); } }}
              style={{ background: 'transparent', border: 'none', borderBottom: '1px solid #beb0a2', color: '#fff', fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, outline: 'none', width: '100%', padding: '2px 0' }}
            />
          ) : (
            <div onClick={() => { setNombreLocal(capitulo.nombre); setEditandoNombre(true); }}
              style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#fff', cursor: 'text', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {capitulo.nombre}
            </div>
          )}
          <div style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
            {partidas.length} partida{partidas.length !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Subtotal</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: '#beb0a2', fontWeight: 500 }}>{formatEUR(totales.subtotal_neto)}</div>
        </div>
        <button onClick={onEliminar} style={{ ...btnIcon, fontSize: 16, color: '#666', marginLeft: 8 }}>×</button>
      </div>

      {/* Tabla de partidas */}
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
                <th style={{ ...th(90), textAlign: 'right' }}>PVP</th>
                <th style={{ ...th(60), textAlign: 'right' }}>Dto%</th>
                <th style={{ ...th(110), textAlign: 'right' }}>Total</th>
                {showInternal && <th style={{ ...th(100), textAlign: 'right', color: '#666' }}>Benef.</th>}
                <th style={th(70)}></th>
              </tr>
            </thead>
            <tbody>
              {partidas.map((p, idx) => {
                const c = calcularPartida(p);
                return (
                  <tr key={p.id} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ ...td, padding: '6px 4px', textAlign: 'center', verticalAlign: 'middle' }}>
                      <button onClick={() => onMoverPartida(p.id, -1)} disabled={idx === 0} style={{ ...btnIcon, fontSize: 8, padding: 0, display: 'block', width: '100%' }}>▲</button>
                      <button onClick={() => onMoverPartida(p.id, 1)} disabled={idx === partidas.length - 1} style={{ ...btnIcon, fontSize: 8, padding: 0, display: 'block', width: '100%' }}>▼</button>
                    </td>
                    <td style={td}><InlineInput value={p.codigo} onChange={v => onUpdatePartida(p.id, { codigo: v })} /></td>
                    <td style={td}><InlineInput value={p.descripcion} onChange={v => onUpdatePartida(p.id, { descripcion: v })} multiline /></td>
                    <td style={td}><InlineInput value={p.unidad} onChange={v => onUpdatePartida(p.id, { unidad: v })} /></td>
                    <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.cantidad} onChange={v => onUpdatePartida(p.id, { cantidad: parseFloat(v) || 0 })} align="right" /></td>
                    {showInternal && <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.precio_compra} onChange={v => onUpdatePartida(p.id, { precio_compra: parseFloat(v) || 0 })} align="right" muted /></td>}
                    <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.pvp} onChange={v => onUpdatePartida(p.id, { pvp: parseFloat(v) || 0 })} align="right" /></td>
                    <td style={{ ...td, textAlign: 'right' }}><InlineInput type="number" value={p.descuento_pct} onChange={v => onUpdatePartida(p.id, { descuento_pct: parseFloat(v) || 0 })} align="right" /></td>
                    <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{formatEUR(c.total_neto)}</td>
                    {showInternal && <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontSize: 11, color: c.beneficio >= 0 ? '#7fd87f' : '#ff6b6b' }}>{formatEUR(c.beneficio)}</td>}
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button onClick={() => onGuardarEnCatalogo(p.id)} title="Guardar en catálogo" style={{ ...btnIcon, fontSize: 14, padding: '0 4px' }}>★</button>
                      <button onClick={() => onDeletePartida(p.id)} style={{ ...btnIcon, fontSize: 14, padding: '0 4px', color: '#666' }}>×</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Botones añadir partida */}
      <div style={{ display: 'flex', gap: 8, padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <button onClick={onAddCatalogo} style={btnGhost}>+ Desde catálogo</button>
        <button onClick={onAddVacia} style={btnGhost}>+ Partida en blanco</button>
      </div>
    </div>
  );
}

// ============================================================
// MODAL CATÁLOGO
// ============================================================
function CatalogoModal({ catalogo, onClose, onPick }) {
  const [search, setSearch] = useState('');
  const filtered = catalogo.filter(p => {
    const s = search.toLowerCase();
    return !s || p.descripcion.toLowerCase().includes(s) || (p.codigo || '').toLowerCase().includes(s) || (p.capitulo || '').toLowerCase().includes(s);
  });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0a0a0a', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, width: '100%', maxWidth: 720, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#beb0a2' }}>Catálogo de partidas</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: '#888', fontSize: 22, cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <input autoFocus placeholder="Buscar por descripción, código o capítulo..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, color: '#fff', padding: '10px 14px', fontSize: 13 }} />
        </div>
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', color: '#666' }}>Sin resultados</div>}
          {filtered.map(p => (
            <button key={p.id} onClick={() => onPick(p)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'transparent', color: '#fff', cursor: 'pointer', border: 'none', borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14 }}>{p.descripcion}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    {p.codigo && <>{p.codigo} · </>}
                    {p.capitulo && <>{p.capitulo} · </>}
                    {p.unidad}
                    {p.veces_usada > 0 && <> · usada {p.veces_usada}×</>}
                  </div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 14, color: '#beb0a2', whiteSpace: 'nowrap' }}>{formatEUR(p.pvp)}/{p.unidad}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// COMPONENTES UI
// ============================================================
function Cargando({ texto = 'Cargando...' }) {
  return <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#888', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{texto}</div>;
}

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

// ============================================================
// ESTILOS
// ============================================================
const btnPrimario = {
  background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4,
  padding: '10px 20px', fontSize: 11, fontWeight: 600, letterSpacing: '0.1em',
  textTransform: 'uppercase', cursor: 'pointer', textDecoration: 'none', display: 'inline-block'
};

const btnSecundario = {
  background: 'transparent', color: '#beb0a2', border: '1px solid rgba(190,176,162,0.4)',
  borderRadius: 4, padding: '9px 18px', fontSize: 11, fontWeight: 500, letterSpacing: '0.1em',
  textTransform: 'uppercase', cursor: 'pointer'
};

const btnGhost = {
  background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4, padding: '8px 14px', fontSize: 11, letterSpacing: '0.05em', cursor: 'pointer'
};

const btnIcon = {
  background: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', padding: '2px 6px', lineHeight: 1
};

const selectChip = {
  background: '#0a0a0a', color: '#fff', border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: 4, padding: '9px 14px', fontSize: 11, letterSpacing: '0.1em', cursor: 'pointer'
};

const th = (w) => ({
  textAlign: 'left', padding: '10px 6px', fontSize: 9, letterSpacing: '0.15em',
  textTransform: 'uppercase', color: '#888', fontWeight: 600,
  width: w || 'auto', minWidth: w || 'auto'
});

const td = { padding: '4px 4px', verticalAlign: 'middle' };
