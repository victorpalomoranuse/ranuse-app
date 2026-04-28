import { supabaseAdmin } from "@/lib/supabase";

// Umbrales de seguimientos sin respuesta:
// - DESCARTE: leido/no_leido + N seguimientos sin contestar -> descartado
// - ENFRIADO: interesado + N seguimientos tras su fecha_respuesta -> enfriado
const SEGUIMIENTOS_PARA_DESCARTE = 4;
const SEGUIMIENTOS_PARA_ENFRIADO = 4;

// GET ?prospecto_id=X  -> mensajes de un prospecto
// GET                  -> todos + análisis por plantilla
export async function GET(req) {
  const url = new URL(req.url);
  const prospectoId = url.searchParams.get("prospecto_id");

  let query = supabaseAdmin.from("mensajes").select("*").order("enviado_en", { ascending: true });
  if (prospectoId) query = query.eq("prospecto_id", prospectoId);

  const res = await query;
  if (res.error) return Response.json({ error: res.error.message }, { status: 500 });
  const mensajes = res.data || [];

  if (prospectoId) {
    return Response.json({ mensajes });
  }

  // Análisis global: tasa de respuesta por plantilla
  // Solo se cuentan prospectos OUTBOUND. Los inbound vienen ya con interés mostrado y
  // distorsionarían las tasas de respuesta de la prospección.
  const { data: plantillas } = await supabaseAdmin.from("plantillas").select("id, nombre");
  const { data: prospectos } = await supabaseAdmin.from("prospectos").select("id, estado, origen");

  const prospectoEstado = {};
  const prospectoOutbound = new Set();
  for (const p of (prospectos || [])) {
    prospectoEstado[p.id] = p.estado;
    if ((p.origen || "outbound") === "outbound") prospectoOutbound.add(p.id);
  }

  const porPlantilla = {};
  for (const pl of (plantillas || [])) {
    porPlantilla[pl.id] = { nombre: pl.nombre, enviados: 0, respondidos: 0, interesados: 0, ventas: 0 };
  }
  porPlantilla["sin_plantilla"] = { nombre: "Sin plantilla", enviados: 0, respondidos: 0, interesados: 0, ventas: 0 };

  for (const m of mensajes) {
    if (m.es_seguimiento) continue;
    if (!prospectoOutbound.has(m.prospecto_id)) continue;  // ignora mensajes a inbound
    const key = m.plantilla_id || "sin_plantilla";
    if (!porPlantilla[key]) porPlantilla[key] = { nombre: m.tipo_mensaje || "Sin plantilla", enviados: 0, respondidos: 0, interesados: 0, ventas: 0 };
    porPlantilla[key].enviados += 1;
    const estado = prospectoEstado[m.prospecto_id];
    if (["interesado", "inviable", "rechazado", "venta"].includes(estado)) porPlantilla[key].respondidos += 1;
    if (["interesado", "venta"].includes(estado)) porPlantilla[key].interesados += 1;
    if (estado === "venta") porPlantilla[key].ventas += 1;
  }

  const analisis = Object.values(porPlantilla)
    .filter(x => x.enviados > 0)
    .map(x => ({
      ...x,
      tasa_respuesta: x.enviados > 0 ? Number(((x.respondidos / x.enviados) * 100).toFixed(1)) : 0,
      tasa_interes: x.enviados > 0 ? Number(((x.interesados / x.enviados) * 100).toFixed(1)) : 0,
      tasa_venta: x.enviados > 0 ? Number(((x.ventas / x.enviados) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.tasa_respuesta - a.tasa_respuesta);

  // Seguimientos pendientes: prospectos leídos hace 4+ días sin mensaje de seguimiento
  const pendientes = [];
  const hoy = new Date();
  for (const p of (prospectos || [])) {
    if (p.estado !== "leido" && p.estado !== "no_leido") continue;
  }

  return Response.json({ mensajes, analisis });
}

export async function POST(req) {
  const body = await req.json();
  if (!body.prospecto_id || !body.texto) {
    return Response.json({ error: "Faltan prospecto_id o texto" }, { status: 400 });
  }

  // Calcular siguiente secuencia para este prospecto
  const prev = await supabaseAdmin
    .from("mensajes")
    .select("secuencia")
    .eq("prospecto_id", body.prospecto_id)
    .order("secuencia", { ascending: false })
    .limit(1);

  const siguienteSecuencia = prev.data && prev.data.length > 0 ? (prev.data[0].secuencia || 0) + 1 : 1;

  const result = await supabaseAdmin
    .from("mensajes")
    .insert({
      prospecto_id: body.prospecto_id,
      secuencia: body.secuencia || siguienteSecuencia,
      tipo_mensaje: body.tipo_mensaje || null,
      plantilla_id: body.plantilla_id || null,
      texto: body.texto,
      resultado: body.resultado || null,
      enviado_en: body.enviado_en || new Date().toISOString().slice(0, 10),
      es_seguimiento: body.es_seguimiento || siguienteSecuencia > 1,
    })
    .select()
    .single();

  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });

  // Auto-transición de estado:
  //   leido / no_leido + N seguimientos -> descartado
  //   interesado       + N tras fecha_respuesta -> enfriado
  let prospectoActualizado = null;
  const { data: prospecto } = await supabaseAdmin
    .from("prospectos").select("estado, fecha_respuesta").eq("id", body.prospecto_id).single();

  if (prospecto) {
    let nuevoEstado = null;
    if (prospecto.estado === "leido" || prospecto.estado === "no_leido") {
      const secuenciaFinal = result.data.secuencia || siguienteSecuencia;
      if (secuenciaFinal >= SEGUIMIENTOS_PARA_DESCARTE + 1) nuevoEstado = "descartado";
    } else if (prospecto.estado === "interesado" && prospecto.fecha_respuesta) {
      const { count } = await supabaseAdmin
        .from("mensajes")
        .select("id", { count: "exact", head: true })
        .eq("prospecto_id", body.prospecto_id)
        .gt("enviado_en", prospecto.fecha_respuesta);
      if ((count || 0) >= SEGUIMIENTOS_PARA_ENFRIADO) nuevoEstado = "enfriado";
    }
    if (nuevoEstado) {
      const upd = await supabaseAdmin
        .from("prospectos")
        .update({ estado: nuevoEstado, updated_at: new Date().toISOString() })
        .eq("id", body.prospecto_id).select().single();
      if (!upd.error) prospectoActualizado = upd.data;
    }
  }

  return Response.json({ ok: true, mensaje: result.data, prospecto: prospectoActualizado });
}

export async function DELETE(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return Response.json({ error: "Falta id" }, { status: 400 });
  const result = await supabaseAdmin.from("mensajes").delete().eq("id", id);
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true });
}
