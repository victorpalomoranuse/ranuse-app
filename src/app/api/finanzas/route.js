import { supabaseAdmin } from "@/lib/supabase";

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

  return Response.json({ movimientos });
}

export async function POST(req) {
  if (!checkAuth(req)) return unauth();
  const body = await req.json();
  if (!body.tipo || !body.fecha || !body.importe) {
    return Response.json({ error: "Faltan tipo, fecha o importe" }, { status: 400 });
  }
  if (!["ingreso", "gasto", "ajuste"].includes(body.tipo)) {
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
    iva_incluido: body.iva_incluido === true,
    pct_iva_mov: Number(body.pct_iva_mov) || 21,
    deducible: body.deducible !== false,
    irpf_retenido: Number(body.irpf_retenido) || 0,
    tipo_ingreso: body.tipo_ingreso || null,
    tipo_gasto: body.tipo_gasto || null,
    proyecto: body.proyecto || null,
    modo_iva: body.modo_iva || "sin_iva",
    pct_retencion: Number(body.pct_retencion) || 0,
  }).select().single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, movimiento: result.data });
}

export async function PATCH(req) {
  if (!checkAuth(req)) return unauth();
  const body = await req.json();
  if (!body.id) return Response.json({ error: "Falta id" }, { status: 400 });
  const update = { updated_at: new Date().toISOString() };
  for (const c of ["tipo", "fecha", "importe", "categoria", "descripcion", "cuenta", "iva_incluido", "pct_iva_mov", "deducible", "irpf_retenido", "tipo_ingreso", "tipo_gasto", "proyecto", "modo_iva", "pct_retencion"]) {
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
