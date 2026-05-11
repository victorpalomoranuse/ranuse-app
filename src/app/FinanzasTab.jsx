"use client";
import { useState, useMemo } from "react";

const inputStyle = { width: "100%", background: "rgba(0,0,0,0.4)", color: "#fff", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, fontSize: 12, padding: "6px 8px", outline: "none" };

const TRIMESTRES = {
  Q1: { label: "T1 (Ene–Mar)", meses: ["01","02","03"] },
  Q2: { label: "T2 (Abr–Jun)", meses: ["04","05","06"] },
  Q3: { label: "T3 (Jul–Sep)", meses: ["07","08","09"] },
  Q4: { label: "T4 (Oct–Dic)", meses: ["10","11","12"] },
};

const TIPO_GASTO = {
  iva_deducible:     { label: "IVA deducible",     color: "#f87171" },
  iva_no_deducible:  { label: "IVA no deducible",  color: "#fb923c" },
  sin_iva:           { label: "Sin IVA",            color: "#94a3b8" },
  impuesto_real:     { label: "Pago impuesto",      color: "#a78bfa" },
};

const TIPO_INGRESO = {
  con_iva_con_retencion: { label: "IVA + retención IRPF" },
  con_iva_sin_retencion: { label: "IVA sin retención"    },
  sin_iva:               { label: "Sin IVA"               },
};

function fmt(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function calcularFiscal(movimientos) {
  let ingresos = 0, gastos = 0;
  let ivaRepercutido = 0, ivaSoportadoDeducible = 0;
  let irpfRetenido = 0;
  let baseIngresos = 0, baseGastosDeducibles = 0;
  let impuestosRealesPagados = 0;
  let caja = 0, banco = 0;

  for (const m of movimientos) {
    const imp = Number(m.importe) || 0;
    const pctIva = Number(m.pct_iva_mov) || 21;
    const ivaIncluido = m.iva_incluido === true;
    const tipoGasto = m.tipo_gasto || "sin_iva";
    const tipoIngreso = m.tipo_ingreso || "sin_iva";
    const irpfMov = Number(m.irpf_retenido) || 0;

    if (m.cuenta === "caja") caja += m.tipo === "ingreso" ? imp : -imp;
    else banco += m.tipo === "ingreso" ? imp : -imp;

    if (m.tipo === "ingreso") {
      ingresos += imp;
      irpfRetenido += irpfMov;
      if (tipoIngreso !== "sin_iva") {
        const base = ivaIncluido ? imp / (1 + pctIva / 100) : imp;
        const iva = ivaIncluido ? imp - base : base * (pctIva / 100);
        ivaRepercutido += iva;
        baseIngresos += base;
      } else {
        baseIngresos += imp;
      }
    } else {
      // gasto
      if (tipoGasto === "impuesto_real") {
        impuestosRealesPagados += imp;
        gastos += imp;
      } else {
        gastos += imp;
        if (tipoGasto === "iva_deducible") {
          const base = ivaIncluido ? imp / (1 + pctIva / 100) : imp;
          const iva = ivaIncluido ? imp - base : base * (pctIva / 100);
          ivaSoportadoDeducible += iva;
          baseGastosDeducibles += base;
        } else if (tipoGasto === "iva_no_deducible") {
          // IVA pagado pero no deducible — va al gasto total pero no al cálculo de IVA
          const base = ivaIncluido ? imp / (1 + pctIva / 100) : imp;
          baseGastosDeducibles += base;
        } else {
          // sin_iva: cuota autónomo, seguros, etc.
          baseGastosDeducibles += imp;
        }
      }
    }
  }

  const ivaNeto = ivaRepercutido - ivaSoportadoDeducible;
  const beneficioNeto = baseIngresos - baseGastosDeducibles;
  const provisionIrpf = Math.max(0, beneficioNeto * 0.20);
  const irpfPendiente = Math.max(0, provisionIrpf - irpfRetenido);
  const tuyo = beneficioNeto - Math.max(0, ivaNeto) - irpfPendiente;

  return {
    ingresos, gastos,
    caja_neta: ingresos - gastos,
    banco, caja,
    iva_repercutido: ivaRepercutido,
    iva_soportado: ivaSoportadoDeducible,
    iva_neto: ivaNeto,
    irpf_retenido: irpfRetenido,
    provision_irpf: provisionIrpf,
    irpf_pendiente: irpfPendiente,
    impuestos_reales_pagados: impuestosRealesPagados,
    beneficio_neto: beneficioNeto,
    tuyo,
  };
}

export default function FinanzasTab({
  finanzasUnlocked, finanzasPwdInput, setFinanzasPwdInput, finanzasError, setFinanzasError, unlockFinanzas,
  finanzasData, categoriasFin,
  crearMov, setCrearMov, nuevoMov, setNuevoMov, crearMovimiento, borrarMovimiento,
  crearCategoria, setCrearCategoria, nuevaCategoria, setNuevaCategoria, crearCategoriaFin, borrarCategoriaFin,
}) {
  const [filtroAno, setFiltroAno] = useState("all");
  const [filtroQ, setFiltroQ] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [verCategorias, setVerCategorias] = useState(false);

  // Años disponibles
  const anos = useMemo(() => {
    if (!finanzasData?.movimientos) return [];
    const set = new Set(finanzasData.movimientos.map(m => m.fecha?.slice(0, 4)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [finanzasData]);

  // Movimientos filtrados
  const movFiltrados = useMemo(() => {
    if (!finanzasData?.movimientos) return [];
    return finanzasData.movimientos.filter(m => {
      const ano = m.fecha?.slice(0, 4);
      const mes = m.fecha?.slice(5, 7);
      if (filtroAno !== "all" && ano !== filtroAno) return false;
      if (filtroQ !== "all" && !TRIMESTRES[filtroQ].meses.includes(mes)) return false;
      if (filtroTipo !== "all" && m.tipo !== filtroTipo) return false;
      return true;
    });
  }, [finanzasData, filtroAno, filtroQ, filtroTipo]);

  const fiscal = useMemo(() => calcularFiscal(movFiltrados), [movFiltrados]);

  // Desglose por categoría
  const porCat = useMemo(() => {
    const ing = {}, gas = {};
    for (const m of movFiltrados) {
      const cat = m.categoria || "(sin categoría)";
      const imp = Number(m.importe) || 0;
      if (m.tipo === "ingreso") ing[cat] = (ing[cat] || 0) + imp;
      else gas[cat] = (gas[cat] || 0) + imp;
    }
    return {
      ingresos: Object.entries(ing).sort((a,b) => b[1]-a[1]),
      gastos: Object.entries(gas).sort((a,b) => b[1]-a[1]),
    };
  }, [movFiltrados]);

  // Proyectos
  const porProyecto = useMemo(() => {
    const map = {};
    for (const m of movFiltrados) {
      if (!m.proyecto) continue;
      const p = m.proyecto.trim();
      if (!map[p]) map[p] = { ingresos: 0, gastos: 0, fechaInicio: m.fecha };
      if (m.tipo === "ingreso") map[p].ingresos += Number(m.importe) || 0;
      else map[p].gastos += Number(m.importe) || 0;
      if (m.fecha < map[p].fechaInicio) map[p].fechaInicio = m.fecha;
    }
    return Object.entries(map)
      .map(([nombre, d]) => ({ nombre, ...d, margen: d.ingresos - d.gastos }))
      .sort((a, b) => b.ingresos - a.ingresos);
  }, [movFiltrados]);
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ maxWidth: 320, margin: "40px auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(190,176,162,0.2)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>Finanzas</div>
        <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginBottom: 16 }}>Acceso restringido.</div>
        <input type="password" autoFocus value={finanzasPwdInput} onChange={e => { setFinanzasPwdInput(e.target.value); setFinanzasError(""); }} onKeyDown={e => e.key === "Enter" && unlockFinanzas()} placeholder="Contraseña" style={{ ...inputStyle, marginBottom: 8 }} />
        {finanzasError && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>{finanzasError}</div>}
        <button onClick={unlockFinanzas} style={{ width: "100%", background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 8, padding: 9, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Entrar</button>
      </div>
    </div>
  );

  if (!finanzasData) return <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Cargando...</div>;

  const periodoLabel = filtroAno === "all" ? "Acumulado total" : filtroQ === "all" ? `Año ${filtroAno}` : `${TRIMESTRES[filtroQ].label} ${filtroAno}`;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

      {/* FILTROS AÑO / TRIMESTRE */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
          <FiltroBtn label="Todo" active={filtroAno === "all"} onClick={() => { setFiltroAno("all"); setFiltroQ("all"); }} />
          {anos.map(a => <FiltroBtn key={a} label={a} active={filtroAno === a} onClick={() => { setFiltroAno(a); setFiltroQ("all"); }} />)}
        </div>
        {filtroAno !== "all" && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FiltroBtn label="Año completo" active={filtroQ === "all"} onClick={() => setFiltroQ("all")} small />
            {Object.entries(TRIMESTRES).map(([k, v]) => (
              <FiltroBtn key={k} label={v.label} active={filtroQ === k} onClick={() => setFiltroQ(k)} small />
            ))}
          </div>
        )}
      </div>

      {/* NÚMERO GORDO */}
      <div style={{ background: "linear-gradient(135deg, rgba(190,176,162,0.14), rgba(190,176,162,0.04))", border: "1px solid rgba(190,176,162,0.35)", borderRadius: 16, padding: "18px 16px", marginBottom: 14, textAlign: "center" }}>
        <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "#888", marginBottom: 6 }}>Lo que es tuyo — {periodoLabel}</div>
        <div style={{ fontFamily: "monospace", fontSize: 44, fontWeight: 700, color: fiscal.tuyo >= 0 ? "#beb0a2" : "#f87171", lineHeight: 1 }}>{fmt(fiscal.tuyo)}€</div>
        <div style={{ fontSize: 10, color: "#666", marginTop: 8 }}>Beneficio neto − IVA pendiente − IRPF pendiente</div>
      </div>

      {/* TARJETAS RESUMEN */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        <Tarjeta label="Cobrado" valor={fiscal.ingresos} color="#4ade80" sub="bruto" />
        <Tarjeta label="Gastado" valor={fiscal.gastos} color="#f87171" sub="total salidas" />
        <Tarjeta label="Beneficio neto" valor={fiscal.beneficio_neto} color={fiscal.beneficio_neto >= 0 ? "#4ade80" : "#f87171"} sub="sin IVA" />
        <Tarjeta label="Caja neta" valor={fiscal.caja_neta} color={fiscal.caja_neta >= 0 ? "#beb0a2" : "#f87171"} sub="todas las cuentas" />
      </div>

      {/* IMPUESTOS: PREVISIÓN VS REAL */}
      <div style={{ background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 14, marginBottom: 14 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b", fontWeight: 700, marginBottom: 12 }}>Impuestos</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>

          {/* IVA */}
          <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 9, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>IVA</div>
            <FilaImp label="Repercutido" valor={fiscal.iva_repercutido} color="#4ade80" />
            <FilaImp label="Soportado ded." valor={fiscal.iva_soportado} color="#f87171" prefijo="−" />
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 6, paddingTop: 6 }}>
              <FilaImp label="Neto a pagar" valor={fiscal.iva_neto} color={fiscal.iva_neto > 0 ? "#f59e0b" : "#4ade80"} negrita />
            </div>
          </div>

          {/* IRPF */}
          <div style={{ background: "rgba(0,0,0,0.35)", borderRadius: 8, padding: 10 }}>
            <div style={{ fontSize: 9, color: "#888", marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>IRPF</div>
            <FilaImp label="Provisión (20%)" valor={fiscal.provision_irpf} color="#f59e0b" />
            <FilaImp label="Ya retenido" valor={fiscal.irpf_retenido} color="#4ade80" prefijo="−" />
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 6, paddingTop: 6 }}>
              <FilaImp label="Pendiente" valor={fiscal.irpf_pendiente} color={fiscal.irpf_pendiente > 0 ? "#f59e0b" : "#4ade80"} negrita />
            </div>
          </div>
        </div>

        {/* Pagos reales registrados */}
        <div style={{ borderTop: "1px solid rgba(245,158,11,0.15)", paddingTop: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 10, color: "#888" }}>Impuestos realmente pagados</div>
              <div style={{ fontSize: 9, color: "#666" }}>Modelos 303, 130, etc. registrados</div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: "#a78bfa" }}>{fmt(fiscal.impuestos_reales_pagados)}€</div>
          </div>
          {fiscal.impuestos_reales_pagados > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, color: "#666" }}>
              Previsión vs real: {fiscal.impuestos_reales_pagados > (fiscal.iva_neto + fiscal.provision_irpf)
                ? <span style={{ color: "#f87171" }}>has pagado {fmt(fiscal.impuestos_reales_pagados - fiscal.iva_neto - fiscal.provision_irpf)}€ más de lo previsto</span>
                : <span style={{ color: "#4ade80" }}>quedan {fmt((fiscal.iva_neto + fiscal.provision_irpf) - fiscal.impuestos_reales_pagados)}€ por pagar según previsión</span>
              }
            </div>
          )}
        </div>
      </div>

      {/* CATEGORÍAS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
        {porCat.ingresos.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Ingresos</div>
            {porCat.ingresos.map(([cat, total]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
                <span style={{ color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{cat}</span>
                <span style={{ fontFamily: "monospace", color: "#4ade80", fontWeight: 600 }}>{fmt(total)}€</span>
              </div>
            ))}
          </div>
        )}
        {porCat.gastos.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 10 }}>
            <div style={{ fontSize: 9, color: "#f87171", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Gastos</div>
            {porCat.gastos.map(([cat, total]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
                <span style={{ color: "#aaa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "55%" }}>{cat}</span>
                <span style={{ fontFamily: "monospace", color: "#f87171", fontWeight: 600 }}>{fmt(total)}€</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* BOTONES ACCIÓN */}
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setCrearMov(!crearMov)} style={{ flex: 1, background: crearMov ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 8, padding: 9, color: crearMov ? "#beb0a2" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          {crearMov ? "✕ Cancelar" : "➕ Añadir"}
        </button>
        <button onClick={() => setVerCategorias(!verCategorias)} style={{ background: "rgba(190,176,162,0.1)", border: "1px solid rgba(190,176,162,0.25)", borderRadius: 8, padding: "9px 12px", color: "#beb0a2", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🏷️</button>
      </div>

      {/* FORMULARIO NUEVO MOVIMIENTO */}
      {crearMov && (
        <div style={{ background: "rgba(190,176,162,0.04)", border: "1px solid rgba(190,176,162,0.25)", borderRadius: 10, padding: 12, marginBottom: 14 }}>

          {/* TIPO: ingreso / gasto / impuesto */}
          <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
            {[["ingreso","+ Ingreso","rgba(34,197,94,0.18)","#4ade80"],["gasto","− Gasto","rgba(248,113,113,0.18)","#f87171"]].map(([t, label, bg, col]) => (
              <button key={t} onClick={() => setNuevoMov(m => ({ ...m, tipo: t, tipo_gasto: t === "gasto" ? "iva_deducible" : m.tipo_gasto, tipo_ingreso: t === "ingreso" ? "con_iva_con_retencion" : m.tipo_ingreso, categoria: "" }))}
                style={{ flex: 1, background: nuevoMov.tipo === t ? bg : "rgba(0,0,0,0.3)", border: `1px solid ${nuevoMov.tipo === t ? col : "rgba(255,255,255,0.08)"}`, borderRadius: 6, padding: 8, color: nuevoMov.tipo === t ? col : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                {label}
              </button>
            ))}
          </div>

          {/* SUBTIPO según tipo */}
          {nuevoMov.tipo === "ingreso" && (
            <select value={nuevoMov.tipo_ingreso || "con_iva_con_retencion"} onChange={e => setNuevoMov(m => ({ ...m, tipo_ingreso: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
              {Object.entries(TIPO_INGRESO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}
          {nuevoMov.tipo === "gasto" && (
            <select value={nuevoMov.tipo_gasto || "iva_deducible"} onChange={e => setNuevoMov(m => ({ ...m, tipo_gasto: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
              {Object.entries(TIPO_GASTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          )}

          <input type="date" value={nuevoMov.fecha} onChange={e => setNuevoMov(m => ({ ...m, fecha: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />

          <input type="number" placeholder="Importe (€)" value={nuevoMov.importe} onChange={e => setNuevoMov(m => ({ ...m, importe: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />

          {/* IVA incluido — solo si aplica */}
          {nuevoMov.tipo === "ingreso" && nuevoMov.tipo_ingreso !== "sin_iva" && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: "#aaa" }}>IVA incluido en el importe</label>
                <input type="checkbox" checked={nuevoMov.iva_incluido || false} onChange={e => setNuevoMov(m => ({ ...m, iva_incluido: e.target.checked }))} style={{ accentColor: "#beb0a2", width: 14, height: 14 }} />
              </div>
              {nuevoMov.iva_incluido && nuevoMov.importe && (
                <div style={{ fontSize: 10, color: "#666", background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "4px 8px" }}>
                  Base: {(Number(nuevoMov.importe) / 1.21).toFixed(2)}€ · IVA: {(Number(nuevoMov.importe) - Number(nuevoMov.importe) / 1.21).toFixed(2)}€
                </div>
              )}
            </div>
          )}
          {nuevoMov.tipo === "gasto" && ["iva_deducible","iva_no_deducible"].includes(nuevoMov.tipo_gasto) && (
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                <label style={{ fontSize: 11, color: "#aaa" }}>IVA incluido en el importe</label>
                <input type="checkbox" checked={nuevoMov.iva_incluido || false} onChange={e => setNuevoMov(m => ({ ...m, iva_incluido: e.target.checked }))} style={{ accentColor: "#beb0a2", width: 14, height: 14 }} />
              </div>
              {nuevoMov.iva_incluido && nuevoMov.importe && (
                <div style={{ fontSize: 10, color: "#666", background: "rgba(0,0,0,0.2)", borderRadius: 4, padding: "4px 8px" }}>
                  Base: {(Number(nuevoMov.importe) / 1.21).toFixed(2)}€ · IVA: {(Number(nuevoMov.importe) - Number(nuevoMov.importe) / 1.21).toFixed(2)}€
                </div>
              )}
            </div>
          )}

          {/* IRPF retenido — solo ingresos con retención */}
          {nuevoMov.tipo === "ingreso" && nuevoMov.tipo_ingreso === "con_iva_con_retencion" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>IRPF retenido €</label>
              <input type="number" placeholder="0" value={nuevoMov.irpf_retenido || ""} onChange={e => setNuevoMov(m => ({ ...m, irpf_retenido: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
            </div>
          )}

          <select value={nuevoMov.categoria || ""} onChange={e => setNuevoMov(m => ({ ...m, categoria: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
            <option value="">Categoría...</option>
            {categoriasFin.filter(c => c.tipo === nuevoMov.tipo).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
          </select>

          <select value={nuevoMov.cuenta || "banco"} onChange={e => setNuevoMov(m => ({ ...m, cuenta: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
            <option value="banco">Banco</option>
            <option value="caja">Caja</option>
            <option value="tarjeta">Tarjeta</option>
          </select>

          <input placeholder="Proyecto / cliente (opcional)" value={nuevoMov.proyecto || ""} onChange={e => setNuevoMov(m => ({ ...m, proyecto: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />

          <input placeholder="Descripción (opcional)" value={nuevoMov.descripcion || ""} onChange={e => setNuevoMov(m => ({ ...m, descripcion: e.target.value }))} style={{ ...inputStyle, marginBottom: 8 }} />

          <button onClick={crearMovimiento} disabled={!nuevoMov.importe || !nuevoMov.fecha}
            style={{ width: "100%", background: nuevoMov.importe && nuevoMov.fecha ? "linear-gradient(135deg, #beb0a2, #a89686)" : "#1a1a1a", border: "none", borderRadius: 8, padding: 9, color: nuevoMov.importe && nuevoMov.fecha ? "#000" : "#444", fontSize: 12, fontWeight: 700, cursor: nuevoMov.importe && nuevoMov.fecha ? "pointer" : "default" }}>
            Guardar
          </button>
        </div>
      )}

      {/* CATEGORÍAS */}
      {verCategorias && (
        <div style={{ background: "rgba(190,176,162,0.04)", border: "1px solid rgba(190,176,162,0.2)", borderRadius: 10, padding: 12, marginBottom: 14 }}>
          <div style={{ color: "#beb0a2", fontSize: 10, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Categorías</div>
          <div style={{ display: "flex", gap: 5, marginBottom: 6 }}>
            <input placeholder="Nombre" value={nuevaCategoria.nombre} onChange={e => setNuevaCategoria(c => ({ ...c, nombre: e.target.value }))} style={inputStyle} />
            <select value={nuevaCategoria.tipo} onChange={e => setNuevaCategoria(c => ({ ...c, tipo: e.target.value }))} style={{ ...inputStyle, width: 90 }}>
              <option value="ingreso">Ingreso</option>
              <option value="gasto">Gasto</option>
            </select>
            <button onClick={crearCategoriaFin} disabled={!nuevaCategoria.nombre.trim()}
              style={{ background: nuevaCategoria.nombre.trim() ? "#beb0a2" : "#1a1a1a", color: nuevaCategoria.nombre.trim() ? "#000" : "#444", border: "none", borderRadius: 6, padding: "0 12px", fontSize: 14, fontWeight: 700, cursor: nuevaCategoria.nombre.trim() ? "pointer" : "default" }}>+</button>
          </div>
          {categoriasFin.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 11 }}>
              <span style={{ color: c.tipo === "ingreso" ? "#4ade80" : "#f87171" }}>● {c.nombre}</span>
              <button onClick={() => borrarCategoriaFin(c.id)} style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 11 }}>✕</button>
            </div>
          ))}
        </div>
      )}

      {/* PROYECTOS / CLIENTES */}
      {porProyecto.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#beb0a2", fontWeight: 700, marginBottom: 10 }}>Proyectos · clientes</div>
          {porProyecto.map(p => (
            <div key={p.nombre} style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>{p.nombre}</span>
                <span style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: p.margen >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(p.margen)}€</span>
              </div>
              <div style={{ display: "flex", gap: 12, fontSize: 10 }}>
                <span style={{ color: "#666" }}>desde {p.fechaInicio}</span>
                <span style={{ color: "#4ade80" }}>+{fmt(p.ingresos)}€</span>
                {p.gastos > 0 && <span style={{ color: "#f87171" }}>−{fmt(p.gastos)}€</span>}
                <span style={{ color: p.margen >= 0 ? "#4ade80" : "#f87171" }}>
                  {p.ingresos > 0 ? `${Math.round((p.margen / p.ingresos) * 100)}% margen` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FILTRO TIPO + LISTA MOVIMIENTOS */}
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        {[["all","Todos"],["ingreso","Ingresos"],["gasto","Gastos"]].map(([v, l]) => (
          <FiltroBtn key={v} label={l} active={filtroTipo === v} onClick={() => setFiltroTipo(v)} small />
        ))}
      </div>

      <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666", marginBottom: 8 }}>
        {movFiltrados.length} movimientos · {periodoLabel}
      </div>

      {movFiltrados.map(m => {
        const tipoLabel = m.tipo === "ingreso"
          ? TIPO_INGRESO[m.tipo_ingreso]?.label || ""
          : TIPO_GASTO[m.tipo_gasto]?.label || "";
        const tipoColor = m.tipo === "ingreso" ? "#4ade80" : (TIPO_GASTO[m.tipo_gasto]?.color || "#f87171");
        return (
          <div key={m.id} style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "9px 12px", marginBottom: 5, display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: tipoColor, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.descripcion || m.categoria || "(sin descripción)"}</div>
              <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>
                {m.fecha} · {m.categoria || "—"} · {m.cuenta || "banco"}
                {m.proyecto ? <span style={{ color: "#beb0a2" }}> · {m.proyecto}</span> : null}
                {tipoLabel ? <span style={{ color: "#444" }}> · {tipoLabel}</span> : null}
                {m.irpf_retenido > 0 ? <span style={{ color: "#888" }}> · ret. {fmt(m.irpf_retenido)}€</span> : null}
                {m.origen === "venta_crm" ? <span style={{ color: "#555" }}> · CRM</span> : null}
              </div>
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: tipoColor, flexShrink: 0 }}>
              {m.tipo === "ingreso" ? "+" : "−"}{fmt(Number(m.importe))}€
            </div>
            {m.origen !== "venta_crm" && (
              <button onClick={() => borrarMovimiento(m.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
            )}
          </div>
        );
      })}

      {movFiltrados.length === 0 && (
        <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: "30px 0" }}>No hay movimientos en este período.</div>
      )}
    </div>
  );
}

function FiltroBtn({ label, active, onClick, small }) {
  return (
    <button onClick={onClick} style={{
      background: active ? "rgba(190,176,162,0.18)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? "rgba(190,176,162,0.5)" : "rgba(255,255,255,0.08)"}`,
      borderRadius: 20, padding: small ? "4px 10px" : "5px 12px",
      color: active ? "#beb0a2" : "#555", fontSize: small ? 10 : 11,
      fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}

function Tarjeta({ label, valor, color, sub }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 9, color: "#777", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color }}>{fmt(valor)}€</div>
      {sub && <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FilaImp({ label, valor, color, prefijo = "", negrita = false }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", fontSize: 11 }}>
      <span style={{ color: "#888" }}>{label}</span>
      <span style={{ fontFamily: "monospace", color, fontWeight: negrita ? 700 : 500 }}>{prefijo}{fmt(Math.abs(valor))}€</span>
    </div>
  );
}
