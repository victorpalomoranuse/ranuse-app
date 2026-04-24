import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data: prospectos, error: e1 } = await supabaseAdmin
    .from("prospectos")
    .select("id, nombre, perfil, liga, club, idioma, estado, comentarios, notas, mes_primer_contacto, tipo_mensaje, created_at, updated_at")
    .order("updated_at", { ascending: false });

  if (e1) {
    return Response.json({ error: e1.message }, { status: 500 });
  }

  let metricas = [];
  let analisis = [];

  try {
    const { data: m } = await supabaseAdmin
      .from("metricas_mensuales")
      .select("*")
      .order("mes", { ascending: true });
    metricas = m || [];
  } catch (err) {}

  try {
    const { data: a } = await supabaseAdmin.from("analisis_mensajes").select("*");
    analisis = a || [];
  } catch (err) {}

  if (!metricas.length && prospectos && prospectos.length) {
    metricas = calcularMetricasDesdeProspectos(prospectos);
  }
  if (!analisis.length && prospectos && prospectos.length) {
    analisis = calcularAnalisisDesdeProspectos(prospectos);
  }

  return Response.json({ prospectos: prospectos || [], metricas, analisis });
}

function calcularMetricasDesdeProspectos(prospectos) {
  const porMes = {};
  for (const p of prospectos) {
    const mes = p.mes_primer_contacto || "sin_mes";
    if (!porMes[mes]) {
      porMes[mes] = { mes, contactados: 0, responden: 0, negociaciones: 0, ganados: 0 };
    }
    if (p.estado && p.estado !== "sin_contactar") porMes[mes].contactados += 1;
    if (["leido", "activo", "negociacion", "ganado", "rechazado"].includes(p.estado)) {
      porMes[mes].responden += 1;
    }
    if (p.estado === "negociacion") porMes[mes].negociaciones += 1;
    if (p.estado === "ganado") porMes[mes].ganados += 1;
  }
  const orden = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return Object.values(porMes).sort((a, b) => orden.indexOf(a.mes) - orden.indexOf(b.mes));
}

function calcularAnalisisDesdeProspectos(prospectos) {
  const porTipo = {};
  for (const p of prospectos) {
    const tipo = p.tipo_mensaje || "Sin clasificar";
    if (!porTipo[tipo]) {
      porTipo[tipo] = { tipo_mensaje: tipo, total_enviados: 0, respondidos: 0 };
    }
    if (p.estado && p.estado !== "sin_contactar") porTipo[tipo].total_enviados += 1;
    if (["leido", "activo", "negociacion", "ganado", "rechazado"].includes(p.estado)) {
      porTipo[tipo].respondidos += 1;
    }
  }
  return Object.values(porTipo).map((x) => ({
    tipo_mensaje: x.tipo_mensaje,
    total_enviados: x.total_enviados,
    respondidos: x.respondidos,
    tasa_respuesta_pct: x.total_enviados > 0 ? Number(((x.respondidos / x.total_enviados) * 100).toFixed(1)) : 0,
  }));
}

export async function PATCH(req) {
  const body = await req.json();
  const id = body.id;
  const nombre = body.nombre;

  let targetId = id;
  if (!targetId && nombre) {
    const { data } = await supabaseAdmin
      .from("prospectos")
      .select("id, nombre")
      .ilike("nombre", "%" + nombre + "%")
      .limit(5);
    if (!data || data.length === 0) {
      return Response.json({ error: "No encuentro a " + nombre }, { status: 404 });
    }
    if (data.length > 1) {
      return Response.json({ error: "Varios coinciden", candidatos: data.map((d) => d.nombre) }, { status: 409 });
    }
    targetId = data[0].id;
  }

  if (!targetId) {
    return Response.json({ error: "Falta id o nombre" }, { status: 400 });
  }

  const CAMPOS = ["nombre", "perfil", "liga", "club", "idioma", "estado", "comentarios", "notas", "mes_primer_contacto", "tipo_mensaje"];

  const update = { updated_at: new Date().toISOString() };
  for (const c of CAMPOS) {
    if (body[c] !== undefined) update[c] = body[c];
  }

  const { data, error } = await supabaseAdmin
    .from("prospectos")
    .update(update)
    .eq("id", targetId)
    .select()
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, prospecto: data });
}

export async function POST(req) {
  const body = await req.json();
  const { data, error } = await supabaseAdmin
    .from("prospectos")
    .insert({
      nombre: body.nombre,
      perfil: body.perfil || null,
      liga: body.liga || null,
      club: body.club || null,
      idioma: body.idioma || "es",
      estado: body.estado || "sin_contactar",
      comentarios: body.comentarios || null,
      notas: body.notas || null,
      mes_primer_contacto: body.mes_primer_contacto || null,
      tipo_mensaje: body.tipo_mensaje || null,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, prospecto: data });
}

export async function DELETE(req) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });

  const { error } = await supabaseAdmin.from("prospectos").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
