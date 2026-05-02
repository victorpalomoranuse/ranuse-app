'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import type { CompanySettings } from '../../../lib/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function EmpresaPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('company_settings').select('*').eq('id', 1).single();
    setSettings(data as CompanySettings);
    setLoading(false);
  }

  function update<K extends keyof CompanySettings>(field: K, value: CompanySettings[K]) {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
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

  if (loading || !settings) return <div className="min-h-screen bg-black text-white flex items-center justify-center">Cargando...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <div className="max-w-3xl mx-auto">
        <Link href="/presupuestos" className="text-xs opacity-60 hover:opacity-100">← Volver a presupuestos</Link>
        <h1 className="text-3xl font-light tracking-wide mb-2 mt-2" style={{ fontFamily: 'Cormorant Garamond, serif' }}>
          Datos de mi empresa
        </h1>
        <p className="text-sm opacity-60 mb-6">Estos datos aparecerán en todos los PDFs de presupuesto.</p>

        <Section title="Identificación">
          <Field label="Nombre comercial" value={settings.nombre_comercial} onChange={v => update('nombre_comercial', v)} placeholder="Ranuse Design" />
          <Field label="Razón social" value={settings.razon_social} onChange={v => update('razon_social', v)} placeholder="Tu nombre o sociedad" />
          <Field label="CIF / NIF" value={settings.cif} onChange={v => update('cif', v)} />
        </Section>

        <Section title="Dirección">
          <Field label="Dirección" value={settings.direccion} onChange={v => update('direccion', v)} />
          <div className="grid grid-cols-3 gap-3">
            <Field label="C.P." value={settings.codigo_postal} onChange={v => update('codigo_postal', v)} />
            <Field label="Ciudad" value={settings.ciudad} onChange={v => update('ciudad', v)} />
            <Field label="Provincia" value={settings.provincia} onChange={v => update('provincia', v)} />
          </div>
          <Field label="País" value={settings.pais} onChange={v => update('pais', v)} />
        </Section>

        <Section title="Contacto">
          <Field label="Teléfono" value={settings.telefono} onChange={v => update('telefono', v)} />
          <Field label="Email" value={settings.email} onChange={v => update('email', v)} />
          <Field label="Web" value={settings.web} onChange={v => update('web', v)} placeholder="ranusedesign.com" />
        </Section>

        <Section title="Datos bancarios (opcional)">
          <Field label="Banco" value={settings.banco} onChange={v => update('banco', v)} />
          <Field label="IBAN" value={settings.iban} onChange={v => update('iban', v)} />
        </Section>

        <Section title="Numeración de presupuestos">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prefijo" value={settings.prefijo_presupuesto} onChange={v => update('prefijo_presupuesto', v)} placeholder="PRES" />
            <div>
              <label className="text-xs uppercase tracking-widest opacity-60 mb-1 block">Reset anual</label>
              <select
                value={settings.reset_anual ? 'si' : 'no'}
                onChange={e => update('reset_anual', e.target.value === 'si')}
                className="w-full bg-black border border-white/20 rounded px-3 py-2 text-sm"
              >
                <option value="si">Sí (PRES-2026-001)</option>
                <option value="no">No (PRES-0001)</option>
              </select>
            </div>
          </div>
          <div className="text-xs opacity-50 mt-2">
            Último número generado: {settings.ultimo_numero || 0}{settings.ultimo_anio ? ` (año ${settings.ultimo_anio})` : ''}
          </div>
        </Section>

        <Section title="Valores por defecto en presupuestos">
          <div>
            <label className="text-xs uppercase tracking-widest opacity-60 mb-1 block">Validez por defecto (días)</label>
            <input type="number" value={settings.validez_default_dias}
              onChange={e => update('validez_default_dias', parseInt(e.target.value) || 30)}
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest opacity-60 mb-1 block">Formas de pago por defecto</label>
            <textarea value={settings.formas_pago_default || ''}
              onChange={e => update('formas_pago_default', e.target.value)}
              rows={2}
              placeholder="Ej: 50% al inicio, 50% a la entrega · Transferencia bancaria"
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest opacity-60 mb-1 block">Notas por defecto</label>
            <textarea value={settings.notas_default || ''}
              onChange={e => update('notas_default', e.target.value)}
              rows={2}
              className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm" />
          </div>
        </Section>

        <div className="flex justify-end gap-3 mt-6">
          {saved && <span className="text-sm self-center" style={{ color: '#7fd87f' }}>✓ Guardado</span>}
          <button
            onClick={guardar}
            disabled={saving}
            className="px-6 py-2.5 rounded text-sm font-medium"
            style={{ background: '#beb0a2', color: '#0a0a0a' }}
          >{saving ? 'Guardando...' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-white/10 rounded p-4 mb-4">
      <h2 className="text-base mb-3" style={{ fontFamily: 'Cormorant Garamond, serif', color: '#beb0a2' }}>{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string | null; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest opacity-60 mb-1 block">{label}</label>
      <input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent border border-white/20 rounded px-3 py-2 text-sm focus:border-white/40 outline-none"
      />
    </div>
  );
}
