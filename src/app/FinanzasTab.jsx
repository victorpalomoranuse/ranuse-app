"use client";
import { useState, useMemo } from "react";
import DashboardFinanzas from "./DashboardFinanzas";

const inputStyle = {
  width: "100%",
  background: "rgba(0,0,0,0.4)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 6,
  fontSize: 12,
  padding: "6px 8px",
  outline: "none",
};

const TRIMESTRES = {
  Q1: { label: "T1 (Ene–Mar)", meses: ["01","02","03"] },
  Q2: { label: "T2 (Abr–Jun)", meses: ["04","05","06"] },
  Q3: { label: "T3 (Jul–Sep)", meses: ["07","08","09"] },
  Q4: { label: "T4 (Oct–Dic)", meses: ["10","11","12"] },
};

const PCT_IVA = [21, 10, 4];

function fmt(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmt2(n) {
  return Number(n || 0).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Siempre devuelve la base imponible
function getBase(mov) {
  const imp = Number(mov.importe) || 0;
  const pct = Number(mov.pct_iva_mov) || 21;
  const modo = mov.modo_iva || ((mov.iva_incluido === true || mov.iva_incluido === "true") ? "incluido" : "sin_iva");
  if (modo === "incluido") return imp / (1 + pct / 100);
  if (modo === "base") return imp;
  return imp; // sin_iva
}

// Retención neta (lo que te retienen del cobro)
function getRetencion(mov) {
  if (mov.tipo !== "ingreso") return 0;
  const base = getBase(mov);
  const pctRet = Number(mov.pct_retencion) || 0;
  if (pctRet > 0) return base * pctRet / 100;
  return Number(mov.irpf_retenido) || 0;
}

function IvaSelector({ modo, pct, importe, retencion, onModo, onPct, onRetencion, tipo }) {
  const imp = Number(importe) || 0;
  const pctNum = Number(pct) || 21;
  const esPersonalizado = !PCT_IVA.includes(pctNum);

  let base = imp, ivaAmt = 0, total = imp;
  if (modo === "incluido") { base = imp / (1 + pctNum / 100); ivaAmt = imp - base; total = imp; }
  else if (modo === "base") { base = imp; ivaAmt = imp * pctNum / 100; total = imp + ivaAmt; }

  const retAmt = tipo === "ingreso" ? (Number(retencion) || 0) : 0;

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Modo IVA */}
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", marginBottom: 6 }}>
        {[["sin_iva","Sin IVA"],["base","Base imp."],["incluido","IVA incl."]].map(([val, label]) => (
          <button key={val} onClick={() => onModo(val)}
            style={{ flex: 1, padding: "6px 4px", fontSize: 10, fontWeight: 600, border: "none", cursor: "pointer",
              background: modo === val ? "#beb0a2" : "rgba(0,0,0,0.3)",
              color: modo === val ? "#000" : "#555" }}>
            {label}
          </button>
        ))}
      </div>

      {/* % IVA */}
      {modo !== "sin_iva" && (
        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap" }}>% IVA</span>
          <div style={{ display: "flex", gap: 4 }}>
            {PCT_IVA.map(p => (
              <button key={p} onClick={() => onPct(p)}
                style={{ padding: "4px 8px", fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${pctNum === p ? "#beb0a2" : "rgba(255,255,255,0.1)"}`,
                  background: pctNum === p ? "rgba(190,176,162,0.2)" : "rgba(0,0,0,0.3)",
                  color: pctNum === p ? "#beb0a2" : "#555" }}>
                {p}%
              </button>
            ))}
            <input type="number" placeholder="otro" value={esPersonalizado ? pctNum : ""}
              onChange={e => onPct(parseFloat(e.target.value) || 21)}
              style={{ ...inputStyle, width: 52, fontSize: 10, padding: "4px 6px" }} />
          </div>
        </div>
      )}

      {/* Retención IRPF solo en ingresos */}
      {tipo === "ingreso" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap" }}>Ret. IRPF %</span>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 7, 15, 19].map(p => (
              <button key={p} onClick={() => onRetencion(p)}
                style={{ padding: "4px 7px", fontSize: 10, fontWeight: 600, borderRadius: 4, cursor: "pointer",
                  border: `1px solid ${Number(retencion) === p ? "#beb0a2" : "rgba(255,255,255,0.1)"}`,
                  background: Number(retencion) === p ? "rgba(190,176,162,0.2)" : "rgba(0,0,0,0.3)",
                  color: Number(retencion) === p ? "#beb0a2" : "#555" }}>
                {p}%
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Desglose en tiempo real */}
      {imp > 0 && (
        <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 4, padding: "6px 8px", fontSize: 10 }}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <span style={{ color: "#888" }}>Base: <span style={{ color: "#beb0a2", fontFamily: "monospace", fontWeight: 700 }}>{fmt2(base)}€</span></span>
            {modo !== "sin_iva" && <span style={{ color: "#888" }}>IVA ({pctNum}%): <span style={{ color: "#666", fontFamily: "monospace" }}>{fmt2(ivaAmt)}€</span></span>}
            {modo === "base" && <span style={{ color: "#888" }}>Total c/IVA: <span style={{ color: "#555", fontFamily: "monospace" }}>{fmt2(total)}€</span></span>}
            {retAmt > 0 && <span style={{ color: "#888" }}>Ret.: <span style={{ color: "#f87171", fontFamily: "monospace" }}>−{fmt2(retAmt)}€</span></span>}
            {retAmt > 0 && <span style={{ color: "#888" }}>Cobras: <span style={{ color: "#4ade80", fontFamily: "monospace", fontWeight: 700 }}>{fmt2(base - retAmt)}€</span></span>}
          </div>
        </div>
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

function Tarjeta({ label, valor, color, grande }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 12 }}>
      <div style={{ fontSize: 9, color: "#777", marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: grande ? 22 : 16, fontWeight: 700, color }}>{fmt(valor)}€</div>
    </div>
  );
}

export default function FinanzasTab({
  finanzasUnlocked, finanzasPwdInput, setFinanzasPwdInput, finanzasError, setFinanzasError, unlockFinanzas,
  finanzasData, categoriasFin, finanzasPwd = "",
  cuadresCaja = [], crearCuadre, borrarCuadre,
  crearMov, setCrearMov, nuevoMov, setNuevoMov, crearMovimiento, borrarMovimiento, recargarFinanzas,
  crearCategoria, setCrearCategoria, nuevaCategoria, setNuevaCategoria, crearCategoriaFin, borrarCategoriaFin,
}) {
  const [vista, setVista] = useState("movimientos");
  const [filtroAno, setFiltroAno] = useState("all");
  const [filtroQ, setFiltroQ] = useState("all");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [verCategorias, setVerCategorias] = useState(false);
  const [verCuadres, setVerCuadres] = useState(false);
  const [editandoMov, setEditandoMov] = useState(null);
  const [editCampos, setEditCampos] = useState({});
  const [proyectoAbierto, setProyectoAbierto] = useState(null);
  const [nuevoCuadre, setNuevoCuadre] = useState({
    fecha: new Date().toISOString().slice(0, 10),
    cuenta: "banco", saldo_real: "", nota: "",
  });

  const movimientos = finanzasData?.movimientos || [];

  const anos = useMemo(() => {
    const set = new Set(movimientos.map(m => m.fecha?.slice(0, 4)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [movimientos]);

  const movFiltrados = useMemo(() => {
    return movimientos.filter(m => {
      const ano = m.fecha?.slice(0, 4);
      const mes = m.fecha?.slice(5, 7);
      if (filtroAno !== "all" && ano !== filtroAno) return false;
      if (filtroQ !== "all" && !TRIMESTRES[filtroQ].meses.includes(mes)) return false;
      if (filtroTipo !== "all" && m.tipo !== filtroTipo) return false;
      return true;
    });
  }, [movimientos, filtroAno, filtroQ, filtroTipo]);

  // Todos los cálculos usan base imponible
  const resumen = useMemo(() => {
    let cobrado = 0, gastado = 0, banco = 0, caja = 0;
    for (const m of movFiltrados) {
      const b = getBase(m);
      if (m.tipo === "ingreso") {
        cobrado += b;
        if (m.cuenta === "caja") caja += b; else banco += b;
      } else {
        gastado += b;
        if (m.cuenta === "caja") caja -= b; else banco -= b;
      }
    }
    return { cobrado, gastado, saldo: cobrado - gastado, banco, caja };
  }, [movFiltrados]);

  const porCat = useMemo(() => {
    const ing = {}, gas = {};
    for (const m of movFiltrados) {
      const cat = m.categoria || "(sin categoría)";
      const b = getBase(m);
      if (m.tipo === "ingreso") ing[cat] = (ing[cat] || 0) + b;
      else gas[cat] = (gas[cat] || 0) + b;
    }
    return {
      ingresos: Object.entries(ing).sort((a, b) => b[1] - a[1]),
      gastos: Object.entries(gas).sort((a, b) => b[1] - a[1]),
    };
  }, [movFiltrados]);

  const porProyecto = useMemo(() => {
    const map = {};
    for (const m of movFiltrados) {
      if (!m.proyecto) continue;
      const p = m.proyecto.trim();
      if (!map[p]) map[p] = { cobrado: 0, gastado: 0, movimientos: [], fechaInicio: m.fecha };
      const b = getBase(m);
      map[p].movimientos.push(m);
      if (m.fecha < map[p].fechaInicio) map[p].fechaInicio = m.fecha;
      if (m.tipo === "ingreso") map[p].cobrado += b;
      else map[p].gastado += b;
    }
    return Object.entries(map)
      .map(([nombre, d]) => ({ nombre, ...d, margen: d.cobrado - d.gastado }))
      .sort((a, b) => b.cobrado - a.cobrado);
  }, [movFiltrados]);

  const periodoLabel = filtroAno === "all" ? "Acumulado total"
    : filtroQ === "all" ? `Año ${filtroAno}` : `${TRIMESTRES[filtroQ].label} ${filtroAno}`;

  const guardarEdicion = async () => {
    if (!editandoMov) return;
    await fetch("/api/finanzas", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-finanzas-password": finanzasPwd },
      body: JSON.stringify({ id: editandoMov, ...editCampos }),
    });
    setEditandoMov(null);
    setEditCampos({});
    if (recargarFinanzas) recargarFinanzas();
  };

  if (!finanzasUnlocked) return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
      <div style={{ maxWidth: 320, margin: "40px auto", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(190,176,162,0.2)", borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 28, textAlign: "center", marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", marginBottom: 4 }}>Finanzas</div>
        <div style={{ fontSize: 11, color: "#888", textAlign: "center", marginBottom: 16 }}>Acceso restringido.</div>
        <input type="password" autoFocus value={finanzasPwdInput}
          onChange={e => { setFinanzasPwdInput(e.target.value); setFinanzasError(""); }}
          onKeyDown={e => e.key === "Enter" && unlockFinanzas()}
          placeholder="Contraseña" style={{ ...inputStyle, marginBottom: 8 }} />
        {finanzasError && <div style={{ color: "#f87171", fontSize: 11, marginBottom: 8 }}>{finanzasError}</div>}
        <button onClick={unlockFinanzas} style={{ width: "100%", background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 8, padding: 9, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Entrar</button>
      </div>
    </div>
  );

  if (!finanzasData) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#666" }}>Cargando...</div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>

      {/* NAVEGACIÓN */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        {[["movimientos","📋 Movimientos"],["dashboard","📊 Dashboard"]].map(([v, l]) => (
          <button key={v} onClick={() => setVista(v)} style={{
            flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer",
            background: vista === v ? "linear-gradient(135deg, #beb0a2, #a89686)" : "rgba(255,255,255,0.05)",
            color: vista === v ? "#000" : "#666",
          }}>{l}</button>
        ))}
      </div>

      {vista === "dashboard" && <DashboardFinanzas movimientos={movimientos} />}

      {vista === "movimientos" && <>

        {/* FILTROS */}
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

        {/* TRES NÚMEROS GORDOS — siempre bases */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(190,176,162,0.15)", borderRadius: 12, padding: "10px 8px", marginBottom: 14 }}>
          <div style={{ fontSize: 8, color: "#555", textAlign: "center", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: 10 }}>Bases imponibles · {periodoLabel}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            <Tarjeta label="Cobrado" valor={resumen.cobrado} color="#4ade80" />
            <Tarjeta label="Gastado" valor={resumen.gastado} color="#f87171" />
            <Tarjeta label="Saldo" valor={resumen.saldo} color={resumen.saldo >= 0 ? "#beb0a2" : "#f87171"} grande />
          </div>
        </div>

        {/* CUENTAS */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: "#777", marginBottom: 4 }}>Banco</div>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: resumen.banco >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(resumen.banco)}€</div>
          </div>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: "#777", marginBottom: 4 }}>Caja</div>
            <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, color: resumen.caja >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(resumen.caja)}€</div>
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
          <button onClick={() => setCrearMov(!crearMov)}
            style={{ flex: 1, background: crearMov ? "rgba(255,255,255,0.08)" : "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 8, padding: 9, color: crearMov ? "#beb0a2" : "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            {crearMov ? "✕ Cancelar" : "➕ Añadir"}
          </button>
          <button onClick={() => setVerCuadres(!verCuadres)}
            style={{ background: verCuadres ? "rgba(255,255,255,0.08)" : "rgba(190,176,162,0.1)", border: "1px solid rgba(190,176,162,0.25)", borderRadius: 8, padding: "9px 12px", color: "#beb0a2", fontSize: 11, cursor: "pointer" }}>⚖️</button>
          <button onClick={() => setVerCategorias(!verCategorias)}
            style={{ background: "rgba(190,176,162,0.1)", border: "1px solid rgba(190,176,162,0.25)", borderRadius: 8, padding: "9px 12px", color: "#beb0a2", fontSize: 11, cursor: "pointer" }}>🏷️</button>
        </div>

        {/* CUADRES */}
        {verCuadres && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#beb0a2", fontWeight: 700, marginBottom: 10 }}>⚖️ Cuadres de caja</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
              {["banco", "caja"].map(cuenta => {
                const calculado = cuenta === "banco" ? resumen.banco : resumen.caja;
                const ultimo = cuadresCaja.find(c => c.cuenta === cuenta);
                const dif = ultimo ? Number(ultimo.saldo_real) - calculado : null;
                return (
                  <div key={cuenta} style={{ background: "rgba(0,0,0,0.3)", borderRadius: 8, padding: 10 }}>
                    <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>{cuenta}</div>
                    <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Calculado</div>
                    <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: calculado >= 0 ? "#beb0a2" : "#f87171", marginBottom: 6 }}>{fmt(calculado)}€</div>
                    {ultimo && <>
                      <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>Último cuadre · {ultimo.fecha}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 15, fontWeight: 700, color: "#e0e0e0", marginBottom: 4 }}>{fmt(ultimo.saldo_real)}€</div>
                      <div style={{ fontSize: 11, fontWeight: 600, color: dif === 0 ? "#4ade80" : dif > 0 ? "#f59e0b" : "#f87171" }}>
                        {dif === 0 ? "✓ Cuadrado" : dif > 0 ? `+${fmt(dif)}€ de más` : `${fmt(dif)}€ de menos`}
                      </div>
                    </>}
                  </div>
                );
              })}
            </div>
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
              <button onClick={async () => { await crearCuadre(nuevoCuadre); setNuevoCuadre(c => ({ ...c, saldo_real: "", nota: "" })); }}
                disabled={!nuevoCuadre.saldo_real}
                style={{ width: "100%", background: nuevoCuadre.saldo_real ? "linear-gradient(135deg, #beb0a2, #a89686)" : "#1a1a1a", border: "none", borderRadius: 6, padding: 8, color: nuevoCuadre.saldo_real ? "#000" : "#444", fontSize: 12, fontWeight: 700, cursor: nuevoCuadre.saldo_real ? "pointer" : "default" }}>
                Guardar cuadre
              </button>
            </div>
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
            <div style={{ display: "flex", gap: 5, marginBottom: 10 }}>
              {[["ingreso","+ Ingreso","rgba(34,197,94,0.18)","#4ade80"],["gasto","− Gasto","rgba(248,113,113,0.18)","#f87171"]].map(([t, label, bg, col]) => (
                <button key={t} onClick={() => setNuevoMov(m => ({ ...m, tipo: t, categoria: "" }))}
                  style={{ flex: 1, background: nuevoMov.tipo === t ? bg : "rgba(0,0,0,0.3)", border: `1px solid ${nuevoMov.tipo === t ? col : "rgba(255,255,255,0.08)"}`, borderRadius: 6, padding: 8, color: nuevoMov.tipo === t ? col : "#666", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  {label}
                </button>
              ))}
            </div>
            <input type="date" value={nuevoMov.fecha} onChange={e => setNuevoMov(m => ({ ...m, fecha: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />
            <input type="number" placeholder="Importe (€)" value={nuevoMov.importe} onChange={e => setNuevoMov(m => ({ ...m, importe: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />

            <IvaSelector
              modo={nuevoMov.modo_iva || "sin_iva"}
              pct={nuevoMov.pct_iva_mov || 21}
              importe={nuevoMov.importe}
              retencion={nuevoMov.pct_retencion || 0}
              tipo={nuevoMov.tipo}
              onModo={v => setNuevoMov(m => ({ ...m, modo_iva: v }))}
              onPct={v => setNuevoMov(m => ({ ...m, pct_iva_mov: v }))}
              onRetencion={v => setNuevoMov(m => ({ ...m, pct_retencion: v }))}
            />

            <select value={nuevoMov.categoria || ""} onChange={e => setNuevoMov(m => ({ ...m, categoria: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
              <option value="">Categoría...</option>
              {categoriasFin.filter(c => c.tipo === nuevoMov.tipo).map(c => (
                <option key={c.id} value={c.nombre}>{c.nombre}</option>
              ))}
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

        {/* PROYECTOS */}
        {porProyecto.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#beb0a2", fontWeight: 700, marginBottom: 10 }}>Proyectos · clientes</div>
            {porProyecto.map(p => {
              const abierto = proyectoAbierto === p.nombre;
              return (
                <div key={p.nombre} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <div onClick={() => setProyectoAbierto(abierto ? null : p.nombre)}
                    style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", cursor: "pointer" }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>{p.nombre}</div>
                      <div style={{ fontSize: 10, color: "#666", marginTop: 2 }}>desde {p.fechaInicio} · {p.movimientos.length} mov.</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: p.margen >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(p.margen)}€</div>
                      <div style={{ fontSize: 10, color: "#666" }}>{abierto ? "▲" : "▼"}</div>
                    </div>
                  </div>
                  {abierto && (
                    <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, marginBottom: 10 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
                        <div style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.15)", borderRadius: 6, padding: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#4ade80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Cobrado</div>
                          <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#4ade80" }}>{fmt(p.cobrado)}€</div>
                        </div>
                        <div style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", borderRadius: 6, padding: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#f87171", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Gastado</div>
                          <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: "#f87171" }}>{fmt(p.gastado)}€</div>
                        </div>
                        <div style={{ background: "rgba(190,176,162,0.08)", border: "1px solid rgba(190,176,162,0.2)", borderRadius: 6, padding: 10, textAlign: "center" }}>
                          <div style={{ fontSize: 9, color: "#beb0a2", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Margen</div>
                          <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: p.margen >= 0 ? "#beb0a2" : "#f87171" }}>{fmt(p.margen)}€</div>
                        </div>
                      </div>
                      {p.movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha)).map(m => {
                        const b = getBase(m);
                        return (
                          <div key={m.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 11 }}>
                            <span style={{ color: "#777" }}>{m.fecha} · {m.descripcion || m.categoria || "—"}</span>
                            <span style={{ fontFamily: "monospace", color: m.tipo === "ingreso" ? "#4ade80" : "#f87171", fontWeight: 600 }}>
                              {m.tipo === "ingreso" ? "+" : "−"}{fmt(b)}€
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* LISTA MOVIMIENTOS */}
        <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
          {[["all","Todos"],["ingreso","Ingresos"],["gasto","Gastos"]].map(([v, l]) => (
            <FiltroBtn key={v} label={l} active={filtroTipo === v} onClick={() => setFiltroTipo(v)} small />
          ))}
        </div>
        <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#666", marginBottom: 8 }}>
          {movFiltrados.length} movimientos · {periodoLabel}
        </div>

        {movFiltrados.map(m => {
          const isEditing = editandoMov === m.id;
          const color = m.tipo === "ingreso" ? "#4ade80" : "#f87171";
          const b = getBase(m);
          const imp = Number(m.importe) || 0;
          const modoIva = m.modo_iva || (m.iva_incluido === true ? "incluido" : "sin_iva");
          const tieneIva = modoIva !== "sin_iva" && Math.abs(imp - b) > 0.5;
          return (
            <div key={m.id} style={{ background: "rgba(255,255,255,0.025)", border: `1px solid ${isEditing ? "rgba(190,176,162,0.3)" : "rgba(255,255,255,0.06)"}`, borderRadius: 8, marginBottom: 5 }}>
              <div style={{ padding: "9px 12px", display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m.descripcion || m.categoria || "(sin descripción)"}
                  </div>
                  <div style={{ color: "#555", fontSize: 10, marginTop: 1 }}>
                    {m.fecha}
                    {m.categoria ? ` · ${m.categoria}` : ""}
                    {m.cuenta ? ` · ${m.cuenta}` : ""}
                    {m.proyecto ? <span style={{ color: "#beb0a2" }}> · {m.proyecto}</span> : null}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color }}>
                    {m.tipo === "ingreso" ? "+" : "−"}{fmt(b)}€
                  </div>
                  {tieneIva && (
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#555" }}>bruto {fmt(imp)}€</div>
                  )}
                </div>
                <button onClick={() => {
                  if (isEditing) { setEditandoMov(null); setEditCampos({}); }
                  else {
                    setEditandoMov(m.id);
                    setEditCampos({
                      fecha: m.fecha, importe: m.importe,
                      modo_iva: m.modo_iva || "sin_iva",
                      pct_iva_mov: m.pct_iva_mov || 21,
                      pct_retencion: m.pct_retencion || 0,
                      categoria: m.categoria || "", cuenta: m.cuenta || "banco",
                      proyecto: m.proyecto || "", descripcion: m.descripcion || "",
                    });
                  }
                }} style={{ background: "none", border: "none", color: isEditing ? "#beb0a2" : "#444", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✎</button>
                <button onClick={() => borrarMovimiento(m.id)} style={{ background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, flexShrink: 0 }}>✕</button>
              </div>

              {isEditing && (
                <div style={{ padding: "0 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 9, color: "#888", textTransform: "uppercase", letterSpacing: 1, margin: "8px 0" }}>Editar</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>Fecha</div>
                      <input type="date" value={editCampos.fecha || ""} onChange={e => setEditCampos(f => ({ ...f, fecha: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 9, color: "#666", marginBottom: 3 }}>Importe (€)</div>
                      <input type="number" value={editCampos.importe || ""} onChange={e => setEditCampos(f => ({ ...f, importe: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <IvaSelector
                    modo={editCampos.modo_iva || "sin_iva"}
                    pct={editCampos.pct_iva_mov || 21}
                    importe={editCampos.importe}
                    retencion={editCampos.pct_retencion || 0}
                    tipo={m.tipo}
                    onModo={v => setEditCampos(f => ({ ...f, modo_iva: v }))}
                    onPct={v => setEditCampos(f => ({ ...f, pct_iva_mov: v }))}
                    onRetencion={v => setEditCampos(f => ({ ...f, pct_retencion: v }))}
                  />
                  <select value={editCampos.categoria || ""} onChange={e => setEditCampos(f => ({ ...f, categoria: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                    <option value="">Categoría...</option>
                    {categoriasFin.filter(c => c.tipo === m.tipo).map(c => (
                      <option key={c.id} value={c.nombre}>{c.nombre}</option>
                    ))}
                  </select>
                  <select value={editCampos.cuenta || "banco"} onChange={e => setEditCampos(f => ({ ...f, cuenta: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }}>
                    <option value="banco">Banco</option>
                    <option value="caja">Caja</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                  <input placeholder="Proyecto / cliente" value={editCampos.proyecto || ""} onChange={e => setEditCampos(f => ({ ...f, proyecto: e.target.value }))} style={{ ...inputStyle, marginBottom: 6 }} />
                  <input placeholder="Descripción" value={editCampos.descripcion || ""} onChange={e => setEditCampos(f => ({ ...f, descripcion: e.target.value }))} style={{ ...inputStyle, marginBottom: 8 }} />
                  <button onClick={guardarEdicion} style={{ width: "100%", background: "linear-gradient(135deg, #beb0a2, #a89686)", border: "none", borderRadius: 6, padding: 8, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
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

      </>}
    </div>
  );
}
