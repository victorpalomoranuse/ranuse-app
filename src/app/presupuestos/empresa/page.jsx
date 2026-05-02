'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const labelStyle = { display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 };
const inputStyle = { width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 0', fontSize: 14, fontFamily: 'inherit' };
const textareaStyle = { width: '100%', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, color: '#fff', padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' };
const selectStyle = { width: '100%', background: '#0a0a0a', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '8px 0', fontSize: 14, fontFamily: 'inherit', cursor: 'pointer' };

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#beb0a2', margin: 0, marginBottom: subtitle ? 4 : 16 }}>{title}</h2>
      {subtitle ? <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>{subtitle}</div> : null}
      <div style={{ paddingLeft: 16, borderLeft: '1px solid rgba(190,176,162,0.15)' }}>{children}</div>
    </div>
  );
}

export default function EmpresaPage() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    setSettings(data);
    setLoading(false);
  }

  function update(field, value) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  }

  async function handleLogoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('El logo debe ser menor a 2MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from('company').upload(fileName, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from('company').getPublicUrl(fileName);
      const url = urlData.publicUrl;
      if (settings && settings.logo_url) {
        const oldName = settings.logo_url.split('/').pop();
        if (oldName && oldName !== fileName) {
          await supabase.storage.from('company').remove([oldName]);
        }
      }
      await supabase.from('company_settings').update({ logo_url: url }).eq('id', 1);
      setSettings({ ...settings, logo_url: url });
    } catch (err) {
      alert('Error subiendo el logo: ' + err.message);
    }
    setUploadingLogo(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function removeLogo() {
    if (!settings || !settings.logo_url) return;
    if (!confirm('¿Eliminar el logo?')) return;
    const oldName = settings.logo_url.split('/').pop();
    if (oldName) await supabase.storage.from('company').remove([oldName]);
    await supabase.from('company_settings').update({ logo_url: null }).eq('id', 1);
    setSettings({ ...settings, logo_url: null });
  }

  async function guardar() {
    if (!settings) return;
    setSaving(true);
    const { id, updated_at, ultimo_numero, ultimo_anio, ...rest } = settings;
    await supabase.from('company_settings').update(rest).eq('id', 1);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading || !settings) {
    return (
      <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Cargando...
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', fontFamily: "'Jost', system-ui, sans-serif" }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;500;600&family=Jost:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; }
        input:focus, select:focus, textarea:focus { border-color: #beb0a2 !important; outline: none; }
      `}</style>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 60px' }}>
        <Link href="/presupuestos" style={{ color: '#888', fontSize: 12, textDecoration: 'none', letterSpacing: '0.1em', textTransform: 'uppercase' }}>← Volver a presupuestos</Link>

        <div style={{ marginTop: 16, marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', margin: 0 }}>Datos de mi empresa</h1>
          <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 12 }} />
          <p style={{ color: '#888', fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>Estos datos aparecerán en todos los PDFs de presupuesto. Se guardan una sola vez y puedes editarlos en cualquier momento.</p>
        </div>

        <Section title="Logotipo" subtitle="Aparecerá en la cabecera del PDF. Recomendado: PNG con fondo transparente.">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ width: 140, height: 140, background: settings.logo_url ? 'white' : 'rgba(255,255,255,0.04)', border: '1px solid rgba(190,176,162,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, flexShrink: 0 }}>
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#555', fontSize: 11, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Sin logo</div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/svg+xml" onChange={handleLogoUpload} style={{ display: 'none' }} />
              <button onClick={() => fileInputRef.current && fileInputRef.current.click()} disabled={uploadingLogo} style={{ background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '10px 20px', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: uploadingLogo ? 'default' : 'pointer', opacity: uploadingLogo ? 0.5 : 1, marginRight: 8 }}>
                {uploadingLogo ? 'Subiendo...' : (settings.logo_url ? 'Cambiar logo' : 'Subir logo')}
              </button>
              {settings.logo_url ? (
                <button onClick={removeLogo} style={{ background: 'transparent', color: '#888', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '10px 16px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Eliminar</button>
              ) : null}
              <div style={{ color: '#666', fontSize: 11, marginTop: 10 }}>PNG, JPG o SVG · Máximo 2MB</div>
            </div>
          </div>
        </Section>

        <Section title="Identificación">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Nombre comercial</label>
              <input style={inputStyle} value={settings.nombre_comercial || ''} onChange={e => update('nombre_comercial', e.target.value)} placeholder="Ranuse Design" />
            </div>
            <div>
              <label style={labelStyle}>Razón social</label>
              <input style={inputStyle} value={settings.razon_social || ''} onChange={e => update('razon_social', e.target.value)} placeholder="Tu nombre o sociedad" />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>CIF / NIF</label>
            <input style={inputStyle} value={settings.cif || ''} onChange={e => update('cif', e.target.value)} />
          </div>
        </Section>

        <Section title="Dirección">
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Dirección</label>
            <input style={inputStyle} value={settings.direccion || ''} onChange={e => update('direccion', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Código postal</label>
              <input style={inputStyle} value={settings.codigo_postal || ''} onChange={e => update('codigo_postal', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Ciudad</label>
              <input style={inputStyle} value={settings.ciudad || ''} onChange={e => update('ciudad', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Provincia</label>
              <input style={inputStyle} value={settings.provincia || ''} onChange={e => update('provincia', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>País</label>
            <input style={inputStyle} value={settings.pais || ''} onChange={e => update('pais', e.target.value)} />
          </div>
        </Section>

        <Section title="Contacto">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Teléfono</label>
              <input style={inputStyle} value={settings.telefono || ''} onChange={e => update('telefono', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>Email</label>
              <input style={inputStyle} value={settings.email || ''} onChange={e => update('email', e.target.value)} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Web</label>
            <input style={inputStyle} value={settings.web || ''} onChange={e => update('web', e.target.value)} placeholder="ranusedesign.com" />
          </div>
        </Section>

        <Section title="Datos bancarios" subtitle="Aparecerán en el PDF de presupuesto si los rellenas.">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Banco</label>
              <input style={inputStyle} value={settings.banco || ''} onChange={e => update('banco', e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>IBAN</label>
              <input style={inputStyle} value={settings.iban || ''} onChange={e => update('iban', e.target.value)} />
            </div>
          </div>
        </Section>

        <Section title="Numeración de presupuestos">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Prefijo</label>
              <input style={inputStyle} value={settings.prefijo_presupuesto || ''} onChange={e => update('prefijo_presupuesto', e.target.value)} placeholder="PRES" />
            </div>
            <div>
              <label style={labelStyle}>Reset anual</label>
              <select style={selectStyle} value={settings.reset_anual ? 'si' : 'no'} onChange={e => update('reset_anual', e.target.value === 'si')}>
                <option value="si">Sí (PRES-2026-001)</option>
                <option value="no">No (PRES-0001)</option>
              </select>
            </div>
          </div>
          <div style={{ color: '#666', fontSize: 11, marginTop: 8 }}>
            Último número generado: {settings.ultimo_numero || 0}{settings.ultimo_anio ? ` (año ${settings.ultimo_anio})` : ''}
          </div>
        </Section>

        <Section title="Valores por defecto" subtitle="Se aplicarán automáticamente al crear nuevos presupuestos.">
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Validez por defecto (días)</label>
            <input type="number" style={inputStyle} value={settings.validez_default_dias || 30} onChange={e => update('validez_default_dias', parseInt(e.target.value) || 30)} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Formas de pago por defecto</label>
            <textarea rows={2} style={textareaStyle} value={settings.formas_pago_default || ''} onChange={e => update('formas_pago_default', e.target.value)} placeholder="Ej: 50% al inicio, 50% a la entrega · Transferencia bancaria" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Notas por defecto</label>
            <textarea rows={2} style={textareaStyle} value={settings.notas_default || ''} onChange={e => update('notas_default', e.target.value)} />
          </div>
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 32, alignItems: 'center' }}>
          {saved ? <span style={{ color: '#7fd87f', fontSize: 12 }}>✓ Cambios guardados</span> : null}
          <button onClick={guardar} disabled={saving} style={{ background: '#beb0a2', color: '#0a0a0a', border: 'none', borderRadius: 4, padding: '14px 32px', fontSize: 12, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.5 : 1 }}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
