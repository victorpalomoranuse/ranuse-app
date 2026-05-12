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
    const ivaIncluido = m.iva_incluido === true || m.iva_incluido === "true";
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
        // El importe del gasto es la base — lo que pagas en realidad es imp - irpfMov
        gastos += imp - irpfMov; // lo que realmente sale de tu bolsillo
        if (tipoGasto === "iva_deducible") {
          const base = ivaIncluido ? imp / (1 + pctIva / 100) : imp;
          const iva = ivaIncluido ? imp - base : base * (pctIva / 100);
          ivaSoportadoDeducible += iva;
          baseGastosDeducibles += base;
        } else if (tipoGasto === "iva_no_deducible") {
          const base = ivaIncluido ? imp / (1 + pctIva / 100) : imp;
          baseGastosDeducibles += base;
        } else {
          // sin_iva
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
  finanzasData, categoriasFin, finanzasPwd = "",
  cuadresCaja = [], crearCuadre, borrarCuadre,
  crearMov, setCrearMov, nuevoMov, setNuevoMov, crearMovimiento, borrarMovimiento, recargarFinanzas,
  crearCategoria, setCrearCategoria, nuevaCategoria, setNuevaCategoria, crearCategoriaFin, borrarCategoriaFin,
}) {
  const [proyectoAbierto, setProyectoAbierto] = useState(null);
  const [editandoMov, setEditandoMov] = useState(null);
  const [editFiscal, setEditFiscal] = useState({});
  const [filtroAno, setFiltroAno] = useState("all");
  const [filtroQ, setFiltroQ] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [verCategorias, setVerCategorias] = useState(false);
  const [verCuadres, setVerCuadres] = useState(false);
  const [nuevoCuadre, setNuevoCuadre] = useState({ fecha: new Date().toISOString().slice(0, 10), cuenta: "banco", saldo_real: "", nota: "" });

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
      if (!map[p]) map[p] = { ingresos: 0, gastos: 0, fechaInicio: m.fecha, baseIngresos: 0, ivaIngresos: 0, irpfRetenido: 0, baseGastos: 0, movimientos: [] };
      const imp = Number(m.importe) || 0;
      const pctIva = Number(m.pct_iva_mov) || 21;
      const ivaIncluido = m.iva_incluido === true || m.iva_incluido === "true";
      const irpfMov = Number(m.irpf_retenido) || 0;
      const base = ivaIncluido ? imp / (1 + pctIva / 100) : imp;
      const iva = ivaIncluido ? imp - base : 0;

      map[p].movimientos.push(m);
      if (m.fecha < map[p].fechaInicio) map[p].fechaInicio = m.fecha;

      if (m.tipo === "ingreso") {
        map[p].ingresos += imp;
        map[p].baseIngresos += base;
        map[p].ivaIngresos += iva;
        map[p].irpfRetenido += irpfMov;
      } else {
        map[p].gastos += imp - irpfMov;
        map[p].baseGastos += base;
      }
    }
    return Object.entries(map)
      .map(([nombre, d]) => ({ nombre, ...d, margen: d.baseIngresos - d.baseGastos }))
      .sort((a, b) => b.ingresos - a.ingresos);
  }, [movFiltrados]);

  if (!finanzasUnlocked) return (
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
        <button onClick={() => setVerCuadres(!verCuadres)} style={{ background: verCuadres ? "rgba(255,255,255,0.08)" : "rgba(190,176,162,0.1)", border: "1px solid rgba(190,176,162,0.25)", borderRadius: 8, padding: "9px 12px", color: "#beb0a2", fontSize: 11, fontWeight: 600, cursor: "pointer" }} title="Cuadres de caja">⚖️</button>
        <button onClick={() => setVerCategorias(!verCategorias)} style={{ background: "rgba(190,176,162,0.1)", border: "1px solid rgba(190,176,162,0.25)", borderRadius: 8, padding: "9px 12px", color: "#beb0a2", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>🏷️</button>
      </div>

      {/* CUADRES DE CAJA */}
      {verCuadres && (
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
          <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#beb0a2", fontWeight: 700, marginBottom: 10 }}>⚖️ Cuadres de caja</div>

          {/* Saldos calculados vs reales */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {["banco", "caja"].map(cuenta => {
              const calculado = cuenta === "banco" ? fiscal.banco : fiscal.caja;
              const ultimoCuadre = cuadresCaja.find(c => c.cuenta === cuenta);
              const diferencia = ultimoCuadre ? Number(ultimoCuadre.saldo_real) - calculado : null;
              return (
                <div key={cuenta} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{cuenta}</div>
                  <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Calculado</div>
                  <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: calculado >= 0 ? "#beb0a2" : "#f87171", marginBottom: 6 }}>{fmt(calculado)}€</div>
                  {ultimoCuadre && <>
                    <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Último cuadre · {ultimoCuadre.fecha}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#e0e0e0", marginBottom: 4 }}>{fmt(ultimoCuadre.saldo_real)}€</div>
                    <div style={{ fontSize: 11, color: diferencia === 0 ? "#4ade80" : diferencia > 0 ? "#f59e0b" : "#f87171", fontWeight: 600 }}>
                      {diferencia === 0 ? "✓ Cuadrado" : diferencia > 0 ? `+${fmt(diferencia)}€ de más` : `${fmt(diferencia)}€ de menos`}
                    </div>
                  </>}
                </div>
              );
            })}
          </div>

          {/* Formulario nuevo cuadre */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
            <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Registrar cuadre</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <select value={nuevoCuadre.cuenta} onChange={e => setNuevoCuadre(c => ({ ...c, cuenta: e.target.value }))} style={{ ...inputStyle, width: 90 }}>
                <option value="banco">Banco</option>
                <option value="caja">Caja</option>
              </select>
              <input type="date" value={nuevoCuadre.fecha} onChange={e => setNuevoCuadre(c => ({ ...c, fecha: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <input type="number" placeholder="Saldo real (€)" value={nuevoCuadre.saldo_real} onChange={e => setNuevoCuadre(c => ({ ...c, saldo_real: e.target.value }))} style={inputStyle} />
              <input placeholder="Nota (opcional)" value={nuevoCuadre.nota} onChange={e => setNuevoCuadre(c => ({ ...c, nota: e.target.value }))} style={inputStyle} />
            </div>
            <button onClick={async () => { await crearCuadre(nuevoCuadre); setNuevoCuadre(c => ({ ...c, saldo_real: "", nota: "" })); }} disabled={!nuevoCuadre.saldo_real}
              style={{ width: "100%", background: nuevoCuadre.saldo_real ? "linear-gradient(135deg, #beb0a2, #a89686)" : "#1a1a1a", border: "none", borderRadius: 6, padding: 8, color: nuevoCuadre.saldo_real ? "#000" : "#444", fontSize: 12, fontWeight: 700, cursor: nuevoCuadre.saldo_real ? "pointer" : "default" }}>
              Guardar cuadre
            </button>
          </div>

          {/* Historial */}
          {cuadresCaja.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 10 }}>
              <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Historial</div>
              {cuadresCaja.slice(0, 10).map(c => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
                  <div>
                    <span style={{ color: "#888", textTransform: "capitalize" }}>{c.cuenta}</span>
                    <span style={{ color: "#555" }}> · {c.fecha}</span>
                    {c.nota && <span style={{ color: "#555" }}> · {c.nota}</span>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "monospace", color: "#beb0a2", fontWeight: 600 }}>{fmt(c.saldo_real)}€</span>
                    <button onClick={() => borrarCuadre(c.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 11 }}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

          {/* IRPF retenido — ingresos con retención */}
          {nuevoMov.tipo === "ingreso" && nuevoMov.tipo_ingreso === "con_iva_con_retencion" && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>IRPF retenido €</label>
              <input type="number" placeholder="0" value={nuevoMov.irpf_retenido || ""} onChange={e => setNuevoMov(m => ({ ...m, irpf_retenido: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
            </div>
          )}
          {/* IRPF retenido — gastos con retención (pagas menos de la base) */}
          {nuevoMov.tipo === "gasto" && ["iva_deducible","iva_no_deducible","sin_iva"].includes(nuevoMov.tipo_gasto) && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <label style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>IRPF retenido €</label>
              <input type="number" placeholder="0 (si te retienen)" value={nuevoMov.irpf_retenido || ""} onChange={e => setNuevoMov(m => ({ ...m, irpf_retenido: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
              {nuevoMov.irpf_retenido > 0 && nuevoMov.importe && (
                <span style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap" }}>
                  Pagas: {(Number(nuevoMov.importe) - nuevoMov.irpf_retenido).toFixed(2)}€
                </span>
              )}
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
          {porProyecto.map(p => {
            const abierto = proyectoAbierto === p.nombre;
            const pctMargen = p.baseIngresos > 0 ? Math.round((p.margen / p.baseIngresos) * 100) : 0;
            return (
              <div key={p.nombre} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                {/* CABECERA — clic para expandir */}
                <div onClick={() => setProyectoAbierto(abierto ? null : p.nombre)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", cursor: "pointer" }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>{p.nombre}</div>
                    <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>desde {p.fechaInicio} · {p.movimientos.length} mov.</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: p.margen >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(p.margen)}€ neto</div>
                    <div style={{ fontSize: 10, color: p.margen >= 0 ? "#4ade80" : "#f87171" }}>{pctMargen}% margen · {abierto ? "▲" : "▼"}</div>
                  </div>
                </div>

                {/* DESGLOSE EXPANDIDO */}
                {abierto && (
                  <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
                      {/* INGRESOS */}
                      <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 9, color: "#4ade80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Ingresos</div>
                        <div style={{ fontSize: 10, color: "#888", display: "flex", justifyContent: "space-between" }}><span>Bruto</span><span style={{ fontFamily: "monospace", color: "#4ade80" }}>{fmt(p.ingresos)}€</span></div>
                        {p.ivaIngresos > 0 && <div style={{ fontSize: 10, color: "#888", display: "flex", justifyContent: "space-between" }}><span>IVA repercutido</span><span style={{ fontFamily: "monospace", color: "#666" }}>{fmt(p.ivaIngresos)}€</span></div>}
                        {p.irpfRetenido > 0 && <div style={{ fontSize: 10, color: "#888", display: "flex", justifyContent: "space-between" }}><span>IRPF retenido</span><span style={{ fontFamily: "monospace", color: "#888" }}>−{fmt(p.irpfRetenido)}€</span></div>}
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 6, paddingTop: 6, fontSize: 11, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                          <span style={{ color: "#aaa" }}>Base neta</span>
                          <span style={{ fontFamily: "monospace", color: "#4ade80" }}>{fmt(p.baseIngresos)}€</span>
                        </div>
                      </div>
                      {/* GASTOS */}
                      <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 6, padding: 10 }}>
                        <div style={{ fontSize: 9, color: "#f87171", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Gastos</div>
                        <div style={{ fontSize: 10, color: "#888", display: "flex", justifyContent: "space-between" }}><span>Total pagado</span><span style={{ fontFamily: "monospace", color: "#f87171" }}>{fmt(p.gastos)}€</span></div>
                        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", marginTop: 6, paddingTop: 6, fontSize: 11, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                          <span style={{ color: "#aaa" }}>Base deducible</span>
                          <span style={{ fontFamily: "monospace", color: "#f87171" }}>{fmt(p.baseGastos)}€</span>
                        </div>
                      </div>
                    </div>
                    {/* RESULTADO */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(190,176,162,0.06)", borderRadius: 6, padding: "8px 12px" }}>
                      <span style={{ fontSize: 11, color: "#888" }}>Margen neto (base ingresos − base gastos)</span>
                      <span style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: p.margen >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(p.margen)}€</span>
                    </div>
                    {/* MOVIMIENTOS DEL PROYECTO */}
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Movimientos</div>
                      {p.movimientos.sort((a,b) => b.fecha.localeCompare(a.fecha)).map(m => (
                        <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
                          <span style={{ color: "#777" }}>{m.fecha} · {m.descripcion || m.categoria || "—"}</span>
                          <span style={{ fontFamily: "monospace", color: m.tipo === "ingreso" ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                            {m.tipo === "ingreso" ? "+" : "−"}{fmt(Number(m.importe))}€
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
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
        const isEditing = editandoMov === m.id;

        const guardarFiscal = async () => {
          await fetch("/api/finanzas", {
            method: "PATCH",
            headers: { "Content-Type": "application/json", "x-finanzas-password": finanzasPwd },
            body: JSON.stringify({ id: m.id, ...editFiscal }),
          });
          setEditandoMov(null);
          setEditFiscal({});
          if (recargarFinanzas) recargarFinanzas();
        };

        return (
          <div key={m.id} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isEditing ? "rgba(190,176,162,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, marginBottom: 5 }}>
            <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: tipoColor, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.descripcion || m.categoria || "(sin descripción)"}</div>
                <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>
                  {m.fecha} · {m.categoria || "—"} · {m.cuenta || "banco"}
                  {m.proyecto ? <span style={{ color: "#beb0a2" }}> · {m.proyecto}</span> : null}
                  {tipoLabel ? <span style={{ color: "#555" }}> · {tipoLabel}</span> : null}
                  {(m.iva_incluido === true || m.iva_incluido === "true") && Number(m.importe) > 0 && (() => {
                    const pct = Number(m.pct_iva_mov) || 21;
                    const base = Number(m.importe) / (1 + pct / 100);
                    const iva = Number(m.importe) - base;
                    return <span style={{ color: "#666" }}> · Base {fmt(base)}€ · IVA {fmt(iva)}€</span>;
                  })()}
                  {m.irpf_retenido > 0 ? <span style={{ color: "#888" }}> · ret. {fmt(m.irpf_retenido)}€</span> : null}
                  {m.origen === "venta_crm" ? <span style={{ color: "#555" }}> · CRM</span> : null}
                </div>
              </div>
              <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: tipoColor, flexShrink: 0 }}>
                {m.tipo === "ingreso" ? "+" : "−"}{fmt(Number(m.importe))}€
              </div>
              <button onClick={() => {
                if (isEditing) { setEditandoMov(null); setEditFiscal({}); }
                else { setEditandoMov(m.id); setEditFiscal({ tipo_ingreso: m.tipo_ingreso || "con_iva_con_retencion", tipo_gasto: m.tipo_gasto || "iva_deducible", iva_incluido: m.iva_incluido || false, irpf_retenido: m.irpf_retenido || 0, proyecto: m.proyecto || "", categoria: m.categoria || "" }); }
              }} style={{ background: "none", border: "none", color: isEditing ? "#beb0a2" : "#444", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✎</button>
              <button onClick={() => borrarMovimiento(m.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
            </div>

            {isEditing && (
              <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, margin: "8px 0 8px" }}>Editar campos fiscales</div>
                {m.tipo === "ingreso" ? (
                  <select value={editFiscal.tipo_ingreso} onChange={e => setEditFiscal(f => ({ ...f, tipo_ingreso: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                    {Object.entries(TIPO_INGRESO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                ) : (
                  <select value={editFiscal.tipo_gasto} onChange={e => setEditFiscal(f => ({ ...f, tipo_gasto: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                    {Object.entries(TIPO_GASTO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                )}
                {m.tipo === "ingreso" && editFiscal.tipo_ingreso !== "sin_iva" && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#aaa" }}>IVA incluido en el importe</label>
                    <input type="checkbox" checked={editFiscal.iva_incluido} onChange={e => setEditFiscal(f => ({ ...f, iva_incluido: e.target.checked }))} style={{ accentColor: "#beb0a2", width: 14, height: 14 }} />
                  </div>
                )}
                {m.tipo === "ingreso" && editFiscal.tipo_ingreso === "con_iva_con_retencion" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>IRPF retenido €</label>
                    <input type="number" value={editFiscal.irpf_retenido} onChange={e => setEditFiscal(f => ({ ...f, irpf_retenido: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
                  </div>
                )}
                {m.tipo === "gasto" && ["iva_deducible","iva_no_deducible","sin_iva"].includes(editFiscal.tipo_gasto) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: "#aaa", whiteSpace: "nowrap" }}>IRPF retenido €</label>
                    <input type="number" placeholder="0 (si te retienen)" value={editFiscal.irpf_retenido || ""} onChange={e => setEditFiscal(f => ({ ...f, irpf_retenido: parseFloat(e.target.value) || 0 }))} style={inputStyle} />
                  </div>
                )}
                <input placeholder="Proyecto / cliente" value={editFiscal.proyecto} onChange={e => setEditFiscal(f => ({ ...f, proyecto: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />
                <select value={editFiscal.categoria} onChange={e => setEditFiscal(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, marginBottom: 8 }}>
                  <option value="">Categoría...</option>
                  {categoriasFin.filter(c => c.tipo === m.tipo).map(c => <option key={c.id} value={c.nombre}>{c.nombre}</option>)}
                </select>
                <button onClick={guardarFiscal} style={{ width: "100%", background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 6, padding: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Guardar cambios
                </button>
              </div>
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
