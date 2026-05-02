'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('El logo debe ser menor a 2MB');
      return;
    }

    setUploadingLogo(true);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `logo-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from('company')
        .upload(fileName, file, { upsert: true, contentType: file.type });

      if (upErr) throw upErr;

      const { data: urlData } = supabase.storage.from('company').getPublicUrl(fileName);
      const url = urlData.publicUrl;

      if (settings?.logo_url) {
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
    if (!settings?.logo_url) return;
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

  if (loading || !settings) return (
    <div style={{ minHeight: '100dvh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      Cargando...
    </div>
  );

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
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 42, fontWeight: 400, letterSpacing: '0.04em', margin: 0 }}>
            Datos de mi empresa
          </h1>
          <div style={{ height: 1, background: '#beb0a2', width: 60, marginTop: 12 }} />
          <p style={{ color: '#888', fontSize: 13, marginTop: 14, lineHeight: 1.6 }}>
            Estos datos aparecerán en todos los PDFs de presupuesto. Se guardan una sola vez y puedes editarlos en cualquier momento.
          </p>
        </div>

        <Section title="Logotipo" subtitle="Aparecerá en la cabecera del PDF. Recomendado: PNG con fondo transparente, mínimo 400×400px.">
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{
              width: 140, height: 140,
              background: settings.logo_url ? 'white' : 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(190,176,162,0.3)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              flexShrink: 0
            }}>
              {settings.logo_url ? (
                <img src={settings.logo_url} alt="Logo" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <div style={{ color: '#555', fontSize: 11, textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
                  Sin logo
                </div>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingLogo}
                style={{
                  background: '#beb0a2',
                  color: '#0a0a0a',
                  border: 'none',
                  borderRadius: 4,
                  padding: '10px 20px',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  cursor: uploadingLogo ? 'default' : 'pointer',
                  opacity: uploadingLogo ? 0.5 : 1,
                  marginRight: 8
                }}
              >
                {uploadingLogo ? 'Subiendo...' : (settings.logo_url ? 'Cambiar logo' : 'Subir logo')}
              </button>
              {settings.logo_url && (
                <button
                  onClick={removeLogo}
                  style={{
                    background: 'transparent',
                    color: '#888',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 4,
                    padding: '10px 16px',
                    fontSize: 11,
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                  }}
                >
                  Eliminar
                </button>
              )}
              <div style={{ color: '#666', fontSize: 11, marginTop: 10 }}>PNG, JPG o SVG · Máximo 2MB</div>
            </div>
          </div>
        </Section>

        <Section title="Identificación">
          <Row>
            <Field label="Nombre comercial" value={settings.nombre_comercial} onChange={v => update('nombre_comercial', v)} placeholder="Ranuse Design" />
            <Field label="Razón social" value={settings.razon_social} onChange={v => update('razon_social', v)} placeholder="Tu nombre o sociedad" />
          </Row>
          <Field label="CIF / NIF" value={settings.cif} onChange={v => update('cif', v)} />
        </Section>

        <Section title="Dirección">
          <Field label="Dirección" value={settings.direccion} onChange={v => update('direccion', v)} />
          <Row cols={3}>
            <Field label="Código postal" value={settings.codigo_postal} onChange={v => update('codigo_postal', v)} />
            <Field label="Ciudad" value={settings.ciudad} onChange={v => update('ciudad', v)} />
            <Field label="Provincia" value={settings.provincia} onChange={v => update('provincia', v)} />
          </Row>
          <Field label="País" value={settings.pais} onChange={v => update('pais', v)} />
        </Section>

        <Section title="Contacto">
          <Row>
            <Field label="Teléfono" value={settings.telefono} onChange={v => update('telefono', v)} />
            <Field label="Email" value={settings.email} onChange={v => update('email', v)} />
          </Row>
          <Field label="Web" value={settings.web} onChange={v => update('web', v)} placeholder="ranusedesign.com" />
        </Section>

        <Section title="Datos bancarios" subtitle="Aparecerán en el PDF de presupuesto si los rellenas.">
          <Row>
            <Field label="Banco" value={settings.banco} onChange={v => update('banco', v)} />
            <Field label="IBAN" value={settings.iban} onChange={v => update('iban', v)} />
          </Row>
        </Section>

        <Section title="Numeración de presupuestos">
          <Row>
            <Field label="Prefijo" value={settings.prefijo_presupuesto} onChange={v => update('prefijo_presupuesto', v)} placeholder="PRES" />
            <SelectField
              label="Reset anual"
              value={settings.reset_anual ? 'si' : 'no'}
              onChange={v => update('reset_anual', v === 'si')}
              options={[
                { value: 'si', label: 'Sí (PRES-2026-001)' },
                { value: 'no', label: 'No (PRES-0001)' }
              ]}
            />
          </Row>
          <div style={{ color: '#666', fontSize: 11, marginTop: 8 }}>
            Último número generado: {settings.ultimo_numero || 0}{settings.ultimo_anio ? ` (año ${settings.ultimo_anio})` : ''}
          </div>
        </Section>

        <Section title="Valores por defecto" subtitle="Se aplicarán automáticamente al crear nuevos presupuestos.">
          <Field label="Validez por defecto (días)" type="number" value={settings.validez_default_dias} onChange={v => update('validez_default_dias', parseInt(v) || 30)} />
          <FieldArea label="Formas de pago por defecto" value={settings.formas_pago_default} onChange={v => update('formas_pago_default', v)} placeholder="Ej: 50% al inicio, 50% a la entrega · Transferencia bancaria" rows={2} />
          <FieldArea label="Notas por defecto" value={settings.notas_default} onChange={v => update('notas_default', v)} rows={2} />
        </Section>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, marginTop: 32, alignItems: 'center' }}>
          {saved && <span style={{ color: '#7fd87f', fontSize: 12 }}>✓ Cambios guardados</span>}
          <button
            onClick={guardar}
            disabled={saving}
            style={{
              background: '#beb0a2',
              color: '#0a0a0a',
              border: 'none',
              borderRadius: 4,
              padding: '14px 32px',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving ? 0.5 : 1
            }}
          >
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <div style={{ marginBottom: 36 }}>
      <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 500, color: '#beb0a2', margin: 0, marginBottom: subtitle ? 4 : 16 }}>
        {title}
      </h2>
      {subtitle && <div style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>{subtitle}</div>}
      <div style={{ paddingLeft: 16, borderLeft: '1px solid rgba(190,176,162,0.15)' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ children, cols = 2 }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14, marginBottom: 14 }}>{children}</div>;
}

function Field({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{label}</label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          padding: '8px 0',
          fontSize: 14,
          fontFamily: 'inherit',
          transition: 'border-color 0.2s'
        }}
      />
    </div>
  );
}

function FieldArea({ label, value, onChange, placeholder, rows = 3 }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{label}</label>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        style={{
          width: '100%',
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 4,
          color: '#fff',
          padding: '10px 12px',
          fontSize: 13,
          fontFamily: 'inherit',
          resize: 'vertical'
        }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', color: '#888', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: 6 }}>{label}</label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: '#0a0a0a',
          border: 'none',
          borderBottom: '1px solid rgba(255,255,255,0.15)',
          color: '#fff',
          padding: '8px 0',
          fontSize: 14,
          fontFamily: 'inherit',
          cursor: 'pointer'
        }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
