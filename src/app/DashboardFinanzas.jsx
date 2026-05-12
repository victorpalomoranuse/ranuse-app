"use client";
import { useMemo } from "react";

function fmt(n) {
  const num = Number(n || 0);
  if (Math.abs(num) >= 1000) return (num / 1000).toFixed(1).replace(".", ",") + "k";
  return num.toLocaleString("es-ES", { maximumFractionDigits: 0 });
}

function getModoIva(m) {
  if (m.modo_iva) return m.modo_iva;
  if (m.iva_incluido === true || m.iva_incluido === "true") return "incluido";
  return "base";
}

function calcIVA(imp, modo, pct) {
  const i = Number(imp) || 0;
  const p = Number(pct) || 21;
  if (modo === "incluido") { const base = i / (1 + p / 100); return { base, iva: i - base }; }
  if (modo === "base") { return { base: i, iva: i * (p / 100) }; }
  return { base: i, iva: 0 };
}

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const COLORES_CAT = ["#beb0a2","#4ade80","#60a5fa","#f59e0b","#a78bfa","#f87171","#34d399","#fb923c","#e879f9","#38bdf8"];

// ── Gráfica de barras agrupadas ──────────────────────────────────────────────
function BarChart({ data, keys, colors, height = 180 }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map(d => Math.max(...keys.map(k => Math.abs(d[k] || 0)))), 1);
  const barW = Math.min(28, Math.floor(320 / data.length / keys.length));
  const gap = 4;
  const groupW = keys.length * (barW + gap);
  const totalW = data.length * (groupW + 12);

  return (
    <svg width="100%" viewBox={`0 0 ${totalW} ${height + 30}`} style={{ overflow: "visible" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={0} x2={totalW} y1={height * (1 - t)} y2={height * (1 - t)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {data.map((d, i) => (
        <g key={i} transform={`translate(${i * (groupW + 12) + 6}, 0)`}>
          {keys.map((k, j) => {
            const val = Math.abs(d[k] || 0);
            const h = (val / maxVal) * height;
            return (
              <g key={k}>
                <rect x={j * (barW + gap)} y={height - h} width={barW} height={h}
                  fill={colors[j]} opacity={0.85} rx={2} />
                {h > 16 && (
                  <text x={j * (barW + gap) + barW / 2} y={height - h - 3}
                    textAnchor="middle" fontSize={8} fill={colors[j]} opacity={0.8}>
                    {fmt(d[k])}
                  </text>
                )}
              </g>
            );
          })}
          <text x={groupW / 2 - gap} y={height + 14} textAnchor="middle" fontSize={9} fill="#555">
            {d.label}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ── Gráfica de línea ─────────────────────────────────────────────────────────
function LineChart({ data, keys, colors, height = 140 }) {
  if (data.length < 2) return null;
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => Math.abs(d[k] || 0))), 1);
  const W = 320, H = height;
  const xStep = W / (data.length - 1);

  const points = (key) => data.map((d, i) => [i * xStep, H - (Math.abs(d[key] || 0) / maxVal) * H]);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} style={{ overflow: "visible" }}>
      {[0, 0.25, 0.5, 0.75, 1].map(t => (
        <line key={t} x1={0} x2={W} y1={H * (1 - t)} y2={H * (1 - t)}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1} />
      ))}
      {keys.map((k, ki) => {
        const pts = points(k);
        const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0]} ${p[1]}`).join(" ");
        const areaD = `M ${pts[0][0]} ${H} L ${pts.map(p => `${p[0]} ${p[1]}`).join(" L ")} L ${pts[pts.length-1][0]} ${H} Z`;
        return (
          <g key={k}>
            <path d={areaD} fill={colors[ki]} opacity={0.08} />
            <path d={d} fill="none" stroke={colors[ki]} strokeWidth={2} opacity={0.9} />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={3} fill={colors[ki]} />)}
          </g>
        );
      })}
      {data.map((d, i) => (
        <text key={i} x={i * xStep} y={H + 14} textAnchor="middle" fontSize={9} fill="#555">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

// ── Donut chart ──────────────────────────────────────────────────────────────
function DonutChart({ data, size = 120 }) {
  if (!data.length) return null;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2, cy = size / 2, r = size * 0.38, ri = size * 0.24;
  let angle = -Math.PI / 2;

  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + sweep);
    const y2 = cy + r * Math.sin(angle + sweep);
    const xi1 = cx + ri * Math.cos(angle);
    const yi1 = cy + ri * Math.sin(angle);
    const xi2 = cx + ri * Math.cos(angle + sweep);
    const yi2 = cy + ri * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi2} ${yi2} A ${ri} ${ri} 0 ${large} 0 ${xi1} ${yi1} Z`;
    angle += sweep;
    return { ...d, path };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} opacity={0.85} />)}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={10} fill="#aaa" fontWeight={700}>
        {data.length} cat.
      </text>
    </svg>
  );
}

// ── Panel trimestral ─────────────────────────────────────────────────────────
function PanelTrimestral({ movimientos }) {
  const trimestres = useMemo(() => {
    const map = {};
    for (const m of movimientos) {
      const ano = m.fecha?.slice(0, 4);
      const mes = parseInt(m.fecha?.slice(5, 7) || "0");
      if (!ano || !mes) continue;
      const q = Math.ceil(mes / 3);
      const key = `${ano}-Q${q}`;
      if (!map[key]) map[key] = { key, label: `T${q} ${ano}`, ivaRepercutido: 0, ivaSoportado: 0, irpfRetenido: 0, baseIngresos: 0, baseGastos: 0, impuestosReales: 0 };
      const imp = Number(m.importe) || 0;
      const pct = Number(m.pct_iva_mov) || 21;
      const modo = getModoIva(m);
      const { base, iva } = calcIVA(imp, modo, pct);
      const tipoG = m.tipo_gasto || "sin_iva";
      const tipoI = m.tipo_ingreso || "sin_iva";
      if (m.tipo === "ingreso") {
        map[key].baseIngresos += base;
        if (tipoI !== "sin_iva" && modo !== "sin_iva") map[key].ivaRepercutido += iva;
        map[key].irpfRetenido += Number(m.irpf_retenido) || 0;
      } else {
        if (tipoG === "impuesto_real") { map[key].impuestosReales += imp; }
        else {
          map[key].baseGastos += base;
          if (tipoG === "iva_deducible" && modo !== "sin_iva") map[key].ivaSoportado += iva;
        }
      }
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
  }, [movimientos]);

  if (!trimestres.length) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#f59e0b", fontWeight: 700, marginBottom: 10 }}>⚡ Por trimestre</div>
      {trimestres.map(t => {
        const ivaNeto = t.ivaRepercutido - t.ivaSoportado;
        const beneficio = t.baseIngresos - t.baseGastos;
        const provIrpf = Math.max(0, beneficio * 0.20);
        const irpfPend = Math.max(0, provIrpf - t.irpfRetenido);
        const totalPrev = ivaNeto + irpfPend;
        const liquidado = t.impuestosReales > 0;
        const diff = t.impuestosReales - totalPrev;

        return (
          <div key={t.key} style={{ background: liquidado ? "rgba(74,222,128,0.04)" : "rgba(245,158,11,0.04)", border: `1px solid ${liquidado ? "rgba(74,222,128,0.15)" : "rgba(245,158,11,0.15)"}`, borderRadius: 10, padding: 12, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#e0e0e0" }}>{t.label}</span>
                <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 10, background: liquidado ? "rgba(74,222,128,0.15)" : "rgba(245,158,11,0.15)", color: liquidado ? "#4ade80" : "#f59e0b", fontWeight: 600 }}>
                  {liquidado ? "✓ Liquidado" : "Pendiente"}
                </span>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, color: liquidado ? "#4ade80" : "#f59e0b", fontWeight: 700 }}>
                  {liquidado ? `Pagado: ${t.impuestosReales.toLocaleString("es-ES", { maximumFractionDigits: 0 })}€` : `Prev: ${totalPrev.toLocaleString("es-ES", { maximumFractionDigits: 0 })}€`}
                </div>
                {liquidado && diff !== 0 && (
                  <div style={{ fontSize: 9, color: diff > 0 ? "#f87171" : "#4ade80" }}>
                    {diff > 0 ? `+${Math.abs(diff).toLocaleString("es-ES", { maximumFractionDigits: 0 })}€ de más` : `−${Math.abs(diff).toLocaleString("es-ES", { maximumFractionDigits: 0 })}€ menos de lo previsto`}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 6 }}>
              <MiniStat label="Beneficio" valor={beneficio} color="#4ade80" />
              <MiniStat label="IVA neto" valor={ivaNeto} color="#f59e0b" />
              <MiniStat label="IRPF pend." valor={irpfPend} color="#fb923c" />
              <MiniStat label="IRPF ret." valor={t.irpfRetenido} color="#beb0a2" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MiniStat({ label, valor, color }) {
  return (
    <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 6, padding: "6px 8px" }}>
      <div style={{ fontSize: 8, color: "#666", marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color }}>{fmt(valor)}€</div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export default function DashboardFinanzas({ movimientos = [] }) {
  // Datos por mes
  const porMes = useMemo(() => {
    const map = {};
    for (const m of movimientos) {
      const key = m.fecha?.slice(0, 7);
      if (!key) continue;
      if (!map[key]) map[key] = { key, ingresos: 0, gastos: 0, beneficio: 0, ivaRepercutido: 0 };
      const imp = Number(m.importe) || 0;
      const { base, iva } = calcIVA(imp, getModoIva(m), Number(m.pct_iva_mov) || 21);
      if (m.tipo === "ingreso") {
        map[key].ingresos += imp;
        map[key].ivaRepercutido += iva;
        map[key].beneficio += base;
      } else {
        map[key].gastos += imp;
        map[key].beneficio -= base;
      }
    }
    return Object.values(map).sort((a, b) => a.key.localeCompare(b.key)).map(d => ({
      ...d,
      label: MESES_CORTOS[parseInt(d.key.slice(5, 7)) - 1] + " " + d.key.slice(2, 4),
    }));
  }, [movimientos]);

  // Datos por categoría (gastos)
  const gastosCat = useMemo(() => {
    const map = {};
    for (const m of movimientos) {
      if (m.tipo !== "gasto" || m.tipo_gasto === "impuesto_real") continue;
      const cat = m.categoria || "(sin categoría)";
      map[cat] = (map[cat] || 0) + (Number(m.importe) || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([cat, val], i) => ({ label: cat, value: val, color: COLORES_CAT[i % COLORES_CAT.length] }));
  }, [movimientos]);

  // Datos por categoría (ingresos)
  const ingresosCat = useMemo(() => {
    const map = {};
    for (const m of movimientos) {
      if (m.tipo !== "ingreso") continue;
      const cat = m.categoria || "(sin categoría)";
      map[cat] = (map[cat] || 0) + (Number(m.importe) || 0);
    }
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 8)
      .map(([cat, val], i) => ({ label: cat, value: val, color: COLORES_CAT[i % COLORES_CAT.length] }));
  }, [movimientos]);

  // KPIs totales
  const kpis = useMemo(() => {
    let ingresos = 0, gastos = 0, ivaRep = 0, ivaEop = 0, irpfRet = 0, beneficio = 0;
    for (const m of movimientos) {
      const imp = Number(m.importe) || 0;
      const { base, iva } = calcIVA(imp, getModoIva(m), Number(m.pct_iva_mov) || 21);
      if (m.tipo === "ingreso") {
        ingresos += imp; ivaRep += iva; irpfRet += Number(m.irpf_retenido) || 0; beneficio += base;
      } else {
        if (m.tipo_gasto !== "impuesto_real") { gastos += imp; ivaEop += iva; beneficio -= base; }
      }
    }
    return { ingresos, gastos, ivaRep, ivaEop, ivaNeto: ivaRep - ivaEop, irpfRet, beneficio };
  }, [movimientos]);

  if (!movimientos.length) return (
    <div style={{ color: "#555", fontSize: 12, textAlign: "center", padding: "40px 0" }}>No hay movimientos para mostrar.</div>
  );

  return (
    <div style={{ padding: "0 0 20px" }}>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[
          { label: "Total cobrado", valor: kpis.ingresos, color: "#4ade80", sub: "bruto" },
          { label: "Total gastado", valor: kpis.gastos, color: "#f87171", sub: "salidas" },
          { label: "Beneficio neto", valor: kpis.beneficio, color: kpis.beneficio >= 0 ? "#4ade80" : "#f87171", sub: "base imp." },
          { label: "IVA neto a pagar", valor: kpis.ivaNeto, color: kpis.ivaNeto > 0 ? "#f59e0b" : "#4ade80", sub: "repercutido − soportado" },
        ].map(k => (
          <div key={k.label} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 10, padding: 12 }}>
            <div style={{ fontSize: 9, color: "#777", marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 700, color: k.color }}>
              {k.valor.toLocaleString("es-ES", { maximumFractionDigits: 0 })}€
            </div>
            <div style={{ fontSize: 9, color: "#555", marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Ingresos vs Gastos por mes */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#beb0a2", fontWeight: 700, marginBottom: 10 }}>Ingresos vs Gastos por mes</div>
        <BarChart data={porMes} keys={["ingresos","gastos"]} colors={["#4ade80","#f87171"]} />
        <div style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
          <Leyenda color="#4ade80" label="Ingresos" />
          <Leyenda color="#f87171" label="Gastos" />
        </div>
      </div>

      {/* Beneficio neto por mes */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#beb0a2", fontWeight: 700, marginBottom: 10 }}>Evolución beneficio neto</div>
        <LineChart data={porMes} keys={["beneficio"]} colors={["#beb0a2"]} />
      </div>

      {/* IVA por mes */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "#f59e0b", fontWeight: 700, marginBottom: 10 }}>IVA repercutido por mes</div>
        <BarChart data={porMes} keys={["ivaRepercutido"]} colors={["#f59e0b"]} height={120} />
      </div>

      {/* Distribución gastos + ingresos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 9, color: "#f87171", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Gastos</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <DonutChart data={gastosCat} size={100} />
          </div>
          {gastosCat.slice(0, 5).map(d => (
            <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{d.label}</span>
              </div>
              <span style={{ fontFamily: "monospace", color: "#f87171", fontSize: 10 }}>{fmt(d.value)}€</span>
            </div>
          ))}
        </div>
        <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 12 }}>
          <div style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>Ingresos</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
            <DonutChart data={ingresosCat} size={100} />
          </div>
          {ingresosCat.slice(0, 5).map(d => (
            <div key={d.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", fontSize: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                <span style={{ color: "#888", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 80 }}>{d.label}</span>
              </div>
              <span style={{ fontFamily: "monospace", color: "#4ade80", fontSize: 10 }}>{fmt(d.value)}€</span>
            </div>
          ))}
        </div>
      </div>

      {/* Panel trimestral */}
      <PanelTrimestral movimientos={movimientos} />

    </div>
  );
}

function Leyenda({ color, label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: "#666" }}>
      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </div>
  );
}
