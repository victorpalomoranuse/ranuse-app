"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const ESTADO_COLORS = {
  borrador: "#888",
  enviado: "#3b82f6",
  aceptado: "#4ade80",
  rechazado: "#f87171",
  caducado: "#666",
};
const ESTADO_LABELS = {
  borrador: "Borrador",
  enviado: "Enviado",
  aceptado: "Aceptado",
  rechazado: "Rechazado",
  caducado: "Caducado",
};

function formatEUR(n) {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(n || 0);
}

function calcTotales(partidas, descGlobal) {
  let subtotal_bruto = 0, descPart = 0, coste = 0;
  for (const p of partidas) {
    const bruto = (p.cantidad || 0) * (p.pvp || 0);
    subtotal_bruto += bruto;
    descPart += bruto * ((p.descuento_pct || 0) / 100);
    coste += (p.cantidad || 0) * (p.precio_compra || 0);
  }
  const subtotal_neto = subtotal_bruto - descPart;
  const descG = subtotal_neto * ((descGlobal || 0) / 100);
  const total = subtotal_neto - descG;
  const beneficio = total - coste;
  return { total, beneficio };
}

export default function PresupuestosTab() {
  const [presupuestos, setPresupuestos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterEstado, setFilterEstado] = useState("todos");
  const [creating, setCreating] = useState(false);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const { data: presList } = await supabase.from("presupuestos").select("*").order("fecha", { ascending: false });
      if (!presList) { setLoading(false); return; }
      const ids = presList.map(p => p.id);
      const { data: partidas } = ids.length
        ? await supabase.from("presupuesto_partidas").select("*").in("presupuesto_id", ids)
        : { data: [] };
      const enriched = presList.map(p => {
        const ps = (partidas || []).filter(x => x.presupuesto_id === p.id);
        const t = calcTotales(ps, p.descuento_global_pct || 0);
        return { ...p, total: t.total, beneficio: t.beneficio };
      });
      setPresupuestos(enriched);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  async function crearNuevo() {
    setCreating(true);
    try {
      const { data: numData } = await supabase.rpc("next_presupuesto_numero");
      const numero = numData || `PRES-${Date.now()}`;
      const { data: settings } = await supabase.from("company_settings").select("*").eq("id", 1).single();
      const { data: nuevo } = await supabase.from("presupuestos").insert({
        numero,
        cliente_nombre: "Cliente nuevo",
        validez_dias: settings?.validez_default_dias || 30,
        formas_pago: settings?.formas_pago_default || null,
        notas: settings?.notas_default || null,
      }).select().single();
      if (nuevo) {
        window.location.href = `/presupuestos/${nuevo.id}`;
      }
    } catch (e) { alert("Error: " + e.message); }
    setCreating(false);
  }

  async function eliminar(id) {
    if (!confirm("¿Eliminar este presupuesto? Esta acción no se puede deshacer.")) return;
    await supabase.from("presupuestos").delete().eq("id", id);
    loadAll();
  }

  async function duplicar(id) {
    const { data: orig } = await supabase.from("presupuestos").select("*").eq("id", id).single();
    const { data: partidas } = await supabase.from("presupuesto_partidas").select("*").eq("presupuesto_id", id);
    if (!orig) return;
    const { data: numData } = await supabase.rpc("next_presupuesto_numero");
    const numero = numData || `PRES-${Date.now()}`;
    const { id: _, created_at, updated_at, numero: __, ...rest } = orig;
    const { data: nuevo } = await supabase.from("presupuestos").insert({
      ...rest, numero, estado: "borrador", fecha_envio: null, fecha_aceptacion: null,
      fecha: new Date().toISOString().slice(0, 10),
    }).select().single();
    if (nuevo && partidas) {
      const nuevasPartidas = partidas.map(p => {
        const { id: _, created_at, presupuesto_id, ...rest } = p;
        return { ...rest, presupuesto_id: nuevo.id };
      });
      if (nuevasPartidas.length > 0) {
        await supabase.from("presupuesto_partidas").insert(nuevasPartidas);
      }
      window.location.href = `/presupuestos/${nuevo.id}`;
    }
  }

  const filtered = filterEstado === "todos" ? presupuestos : presupuestos.filter(p => p.estado === filterEstado);
  const totalAceptados = presupuestos.filter(p => p.estado === "aceptado").reduce((s, p) => s + p.total, 0);
  const totalPendientes = presupuestos.filter(p => p.estado === "enviado").reduce((s, p) => s + p.total, 0);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
      <button onClick={crearNuevo} disabled={creating}
        style={{ width: "100%", background: creating ? "#1a1a1a" : "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 10, padding: 11, color: creating ? "#444" : "#000", fontSize: 13, fontWeight: 700, cursor: creating ? "default" : "pointer", marginBottom: 10 }}>
        {creating ? "Creando..." : "+ Nuevo presupuesto"}
      </button>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <a href="/presupuestos/empresa" style={{ flex: 1, background: "rgba(190,176,162,0.12)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 8, padding: "8px 10px", color: "#beb0a2", fontSize: 11, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
          🏢 Mi empresa
        </a>
        <a href="/presupuestos/catalogo" style={{ flex: 1, background: "rgba(190,176,162,0.12)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 8, padding: "8px 10px", color: "#beb0a2", fontSize: 11, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>
          📋 Catálogo
        </a>
      </div>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginBottom: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: 10, textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Total</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{presupuestos.length}</div>
        </div>
        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 8, padding: 10, textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Pendientes</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6", fontFamily: "monospace" }}>{formatEUR(totalPendientes)}</div>
        </div>
        <div style={{ background: "rgba(190,176,162,0.1)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 8, padding: 10, textAlign: "center" }}>
          <div style={{ color: "#666", fontSize: 9, textTransform: "uppercase", letterSpacing: 0.5 }}>Cerrado</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#beb0a2", fontFamily: "monospace" }}>{formatEUR(totalAceptados)}</div>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
        {["todos", "borrador", "enviado", "aceptado", "rechazado"].map(e => (
          <button key={e} onClick={() => setFilterEstado(e)}
            style={{
              background: filterEstado === e ? "rgba(190,176,162,0.2)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${filterEstado === e ? "#beb0a2" : "rgba(255,255,255,0.1)"}`,
              borderRadius: 20, padding: "4px 10px",
              color: filterEstado === e ? "#beb0a2" : "#777",
              fontSize: 11, cursor: "pointer"
            }}>
            {e === "todos" ? "Todos" : ESTADO_LABELS[e]}
          </button>
        ))}
      </div>

      {/* Listado */}
      {loading && <div style={{ color: "#666", textAlign: "center", padding: 30, fontSize: 12 }}>Cargando...</div>}
      {!loading && filtered.length === 0 && <div style={{ color: "#666", textAlign: "center", padding: 30, fontSize: 12 }}>No hay presupuestos</div>}

      {!loading && filtered.map(p => (
        <div key={p.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, padding: "10px 12px", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: ESTADO_COLORS[p.estado], flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#beb0a2", fontFamily: "monospace" }}>{p.numero}</div>
              <div style={{ fontSize: 12, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.cliente_nombre}</div>
              <div style={{ color: "#666", fontSize: 10, marginTop: 2 }}>
                📅 {p.fecha} · <span style={{ color: ESTADO_COLORS[p.estado] }}>{ESTADO_LABELS[p.estado]}</span>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#beb0a2" }}>{formatEUR(p.total)}</div>
              <div style={{ fontSize: 9, color: p.beneficio >= 0 ? "#4ade80" : "#f87171", fontFamily: "monospace" }}>↑ {formatEUR(p.beneficio)}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5 }}>
            <a href={`/presupuestos/${p.id}`} style={{ flex: 1, background: "rgba(190,176,162,0.12)", border: "1px solid rgba(190,176,162,0.3)", borderRadius: 6, padding: "6px 8px", color: "#beb0a2", fontSize: 10, fontWeight: 600, textAlign: "center", textDecoration: "none" }}>Editar</a>
            <button onClick={() => duplicar(p.id)} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 10px", color: "#888", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>Duplicar</button>
            <button onClick={() => eliminar(p.id)} style={{ background: "rgba(248,113,113,0.05)", border: "1px solid rgba(248,113,113,0.2)", borderRadius: 6, padding: "6px 10px", color: "#f87171", fontSize: 10, fontWeight: 600, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
