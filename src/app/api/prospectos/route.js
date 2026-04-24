import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const result = await supabaseAdmin
    .from("prospectos")
    .select("*")
    .order("updated_at", { ascending: false });

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }

  const prospectos = result.data || [];
  const metricas = calcularMetricas(prospectos);
  const analisis = calcularAnalisis(prospectos);

  return Response.json({ prospectos, metricas, analisis });
}

function calcularMetricas(prospectos) {
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
  return Object.values(porMes);
}

function calcularAnalisis(prospectos) {
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
  return Object.values(porTipo).map(function (x) {
    const pct = x.total_enviados > 0 ? (x.respondidos / x.total_enviados) * 100 : 0;
    return {
      tipo_mensaje: x.tipo_mensaje,
      total_enviados: x.total_enviados,
      respondidos: x.respondidos,
      tasa_respuesta_pct: Number(pct.toFixed(1)),
    };
  });
}

export async function PATCH(req) {
  const body = await req.json();
  if (!body.id) {
    return Response.json({ error: "Falta id" }, { status: 400 });
  }
  const update = { updated_at: new Date().toISOString() };
  const campos = ["nombre", "perfil", "liga", "club", "idioma", "estado", "comentarios", "notas", "mes_primer_contacto", "tipo_mensaje"];
  for (const c of campos) {
    if (body[c] !== undefined) update[c] = body[c];
  }
  const result = await supabaseAdmin
    .from("prospectos")
    .update(update)
    .eq("id", body.id)
    .select()
    .single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, prospecto: result.data });
}

export async function POST(req) {
  const body = await req.json();
  const result = await supabaseAdmin
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
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, prospecto: result.data });
}

export async function DELETE(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  const result = await supabaseAdmin.from("prospectos").delete().eq("id", id);
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
