import { supabaseAdmin } from "@/lib/supabase";

function checkAuth(req) {
  const expected = process.env.FINANZAS_PASSWORD;
  if (!expected) return true;
  return req.headers.get("x-finanzas-password") === expected;
}
function unauth() { return Response.json({ error: "No autorizado" }, { status: 401 }); }

export async function GET(req) {
  if (!checkAuth(req)) return unauth();
  const { data, error } = await supabaseAdmin
    .from("cuadres_caja").select("*").order("fecha", { ascending: false }).limit(50);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cuadres: data });
}

export async function POST(req) {
  if (!checkAuth(req)) return unauth();
  const body = await req.json();
  if (!body.fecha || body.saldo_real === undefined) {
    return Response.json({ error: "Faltan fecha o saldo_real" }, { status: 400 });
  }
  const result = await supabaseAdmin.from("cuadres_caja").insert({
    fecha: body.fecha,
    cuenta: body.cuenta || "banco",
    saldo_real: Number(body.saldo_real),
    nota: body.nota || null,
  }).select().single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, cuadre: result.data });
}

export async function DELETE(req) {
  if (!checkAuth(req)) return unauth();
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  const result = await supabaseAdmin.from("cuadres_caja").delete().eq("id", id);
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
