import { supabaseAdmin } from "@/lib/supabase";

// Gate por contraseña vía header. Si no hay contraseña configurada, dejamos pasar
// para no bloquear desarrollo, pero IMPRIMIMOS un warning para que se note.
function checkAuth(req) {
  const expected = process.env.FINANZAS_PASSWORD;
  if (!expected) {
    console.warn("[finanzas] FINANZAS_PASSWORD no está configurada — endpoint desprotegido.");
    return true;
  }
  const got = req.headers.get("x-finanzas-password");
  return got === expected;
}

function unauth() {
  return Response.json({ error: "No autorizado" }, { status: 401 });
}

export async function GET(req) {
  if (!checkAuth(req)) return unauth();

  const { data: movimientos, error } = await supabaseAdmin
    .from("movimientos").select("*").order("fecha", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  // Métricas: por mes (con desglose categoría y cuenta)
  const porMes = {};
  const porCategoria = { ingreso: {}, gasto: {} };
  const porCuenta = {};
  let totalIngresos = 0, totalGastos = 0;

  for (const m of (movimientos || [])) {
    const fecha = new Date(m.fecha);
    if (isNaN(fecha)) continue;
    const mesKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    if (!porMes[mesKey]) porMes[mesKey] = { mes: mesKey, ingresos: 0, gastos: 0, neto: 0 };
    const importe = Number(m.importe) || 0;
    if (m.tipo === "ingreso") {
      porMes[mesKey].ingresos += importe;
      totalIngresos += importe;
    } else {
      porMes[mesKey].gastos += importe;
      totalGastos += importe;
    }
    porMes[mesKey].neto = porMes[mesKey].ingresos - porMes[mesKey].gastos;

    const catKey = m.categoria || "Sin categoría";
    if (!porCategoria[m.tipo][catKey]) porCategoria[m.tipo][catKey] = 0;
    porCategoria[m.tipo][catKey] += importe;

    const cuentaKey = m.cuenta || "sin_cuenta";
    if (!porCuenta[cuentaKey]) porCuenta[cuentaKey] = { cuenta: cuentaKey, ingresos: 0, gastos: 0, saldo: 0 };
    if (m.tipo === "ingreso") porCuenta[cuentaKey].ingresos += importe;
    else porCuenta[cuentaKey].gastos += importe;
    porCuenta[cuentaKey].saldo = porCuenta[cuentaKey].ingresos - porCuenta[cuentaKey].gastos;
  }

  const meses = Object.values(porMes).sort((a, b) => b.mes.localeCompare(a.mes));
  const ingresosCat = Object.entries(porCategoria.ingreso)
    .map(([cat, total]) => ({ categoria: cat, total })).sort((a, b) => b.total - a.total);
  const gastosCat = Object.entries(porCategoria.gasto)
    .map(([cat, total]) => ({ categoria: cat, total })).sort((a, b) => b.total - a.total);
  const cuentas = Object.values(porCuenta);

  return Response.json({
    movimientos,
    resumen: {
      total_ingresos: Number(totalIngresos.toFixed(2)),
      total_gastos:   Number(totalGastos.toFixed(2)),
      caja_neta:      Number((totalIngresos - totalGastos).toFixed(2)),
    },
    por_mes: meses,
    por_categoria: { ingresos: ingresosCat, gastos: gastosCat },
    por_cuenta: cuentas,
  });
}

export async function POST(req) {
  if (!checkAuth(req)) return unauth();
  const body = await req.json();
  if (!body.tipo || !body.fecha || !body.importe) {
    return Response.json({ error: "Faltan tipo, fecha o importe" }, { status: 400 });
  }
  if (!["ingreso", "gasto"].includes(body.tipo)) {
    return Response.json({ error: "Tipo inválido" }, { status: 400 });
  }
  const result = await supabaseAdmin.from("movimientos").insert({
    tipo: body.tipo,
    fecha: body.fecha,
    importe: Number(body.importe),
    categoria: body.categoria || null,
    descripcion: body.descripcion || null,
    cuenta: body.cuenta || "banco",
    origen: body.origen || "manual",
    prospecto_id: body.prospecto_id || null,
  }).select().single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, movimiento: result.data });
}

export async function PATCH(req) {
  if (!checkAuth(req)) return unauth();
  const body = await req.json();
  if (!body.id) return Response.json({ error: "Falta id" }, { status: 400 });
  const update = { updated_at: new Date().toISOString() };
  for (const c of ["tipo", "fecha", "importe", "categoria", "descripcion", "cuenta"]) {
    if (body[c] !== undefined) update[c] = body[c] === "" ? null : body[c];
  }
  if (update.importe !== undefined) update.importe = Number(update.importe);
  const result = await supabaseAdmin.from("movimientos").update(update).eq("id", body.id).select().single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, movimiento: result.data });
}

export async function DELETE(req) {
  if (!checkAuth(req)) return unauth();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  const result = await supabaseAdmin.from("movimientos").delete().eq("id", id);
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
