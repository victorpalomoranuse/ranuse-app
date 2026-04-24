import { supabaseAdmin } from "@/lib/supabase";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

export async function GET() {
  const result = await supabaseAdmin
    .from("prospectos")
    .select("*")
    .order("updated_at", { ascending: false });

  if (result.error) {
    return Response.json({ error: result.error.message }, { status: 500 });
  }
  const prospectos = result.data || [];

  return Response.json({
    prospectos,
    metricasCohorte: calcularMetricasCohorte(prospectos),
    metricasCaja:    calcularMetricasCaja(prospectos),
  });
}

/**
 * Vista COHORTE: agrupa por mes de primer contacto.
 * Cada mes te dice: de los X que contactaste en ese mes, cuántos respondieron, vieron vídeo,
 * llamaron, vendieron, cuánto facturaron... (aunque la venta se haya cerrado meses después).
 * Útil para saber qué mes de prospección fue más rentable.
 */
function calcularMetricasCohorte(prospectos) {
  const porMes = {};

  for (const p of prospectos) {
    const mes = p.mes_primer_contacto || "sin_mes";
    if (!porMes[mes]) porMes[mes] = plantilla(mes);
    const m = porMes[mes];

    m.contactados += 1;

    // Leído
    if (p.estado === "leido") m.leidos += 1;

    // Respondieron (interesado + inviable + rechazado + venta son los que te escribieron algo)
    const respondio = ["interesado", "inviable", "rechazado", "venta"].includes(p.estado);
    if (respondio) m.responden += 1;

    // Interesados (objetivo + bloqueo) = interesado + venta
    if (p.estado === "interesado" || p.estado === "venta") m.objetivo_bloqueo += 1;

    // Vídeo enviado
    if (p.fecha_video) m.videos += 1;

    // Agendas (llamada 1 agendada)
    if (p.fecha_llamada1) m.agendas += 1;

    // Asistencia a llamada 1
    if (p.asistio_llamada1 === true) m.asistencias += 1;

    // Llamada 2
    if (p.fecha_llamada2) m.llamadas2 += 1;

    // Ventas
    if (p.estado === "venta") {
      m.ventas += 1;
      m.facturacion += Number(p.importe_venta) || 0;
    }
  }

  return Object.values(porMes).map(calcularPorcentajes).sort(ordenarMes);
}

/**
 * Vista CAJA: agrupa las VENTAS por fecha_venta (mes real en el que se cobró).
 * Útil para ver el flujo de caja real mes a mes.
 */
function calcularMetricasCaja(prospectos) {
  const porMes = {};

  for (const p of prospectos) {
    if (p.estado !== "venta" || !p.fecha_venta) continue;
    const fecha = new Date(p.fecha_venta);
    if (isNaN(fecha)) continue;
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
    if (!porMes[key]) porMes[key] = { periodo: key, ventas: 0, facturacion: 0 };
    porMes[key].ventas += 1;
    porMes[key].facturacion += Number(p.importe_venta) || 0;
  }

  return Object.values(porMes).sort((a, b) => a.periodo.localeCompare(b.periodo));
}

function plantilla(mes) {
  return {
    mes,
    contactados: 0,
    leidos: 0,
    responden: 0,
    objetivo_bloqueo: 0,
    videos: 0,
    agendas: 0,
    asistencias: 0,
    llamadas2: 0,
    ventas: 0,
    facturacion: 0,
  };
}

function calcularPorcentajes(m) {
  m.pct_responden        = m.contactados > 0 ? Number(((m.responden        / m.contactados) * 100).toFixed(1)) : 0;
  m.pct_objetivo_bloqueo = m.responden   > 0 ? Number(((m.objetivo_bloqueo / m.responden)   * 100).toFixed(1)) : 0;
  m.pct_diseno_llamada   = m.objetivo_bloqueo > 0 ? Number(((m.agendas     / m.objetivo_bloqueo) * 100).toFixed(1)) : 0;
  m.pct_asistencia       = m.agendas     > 0 ? Number(((m.asistencias     / m.agendas)     * 100).toFixed(1)) : 0;
  m.pct_cierre           = m.asistencias > 0 ? Number(((m.ventas          / m.asistencias) * 100).toFixed(1)) : 0;
  return m;
}

function ordenarMes(a, b) {
  if (a.mes === "sin_mes") return 1;
  if (b.mes === "sin_mes") return -1;
  return MESES.indexOf(b.mes) - MESES.indexOf(a.mes);
}

export async function PATCH(req) {
  const body = await req.json();
  if (!body.id) {
    return Response.json({ error: "Falta id" }, { status: 400 });
  }
  const update = { updated_at: new Date().toISOString() };
  const campos = [
    "nombre", "perfil", "liga", "idioma", "estado", "comentarios", "notas", "mes_primer_contacto",
    "fecha_respuesta", "fecha_video", "fecha_llamada1", "fecha_llamada2",
    "asistio_llamada1", "fecha_venta", "importe_venta",
  ];
  for (const c of campos) {
    if (body[c] !== undefined) update[c] = body[c] === "" ? null : body[c];
  }

  // Automatismo: si el estado pasa a "venta" y no hay fecha_venta, ponla hoy.
  if (body.estado === "venta" && body.fecha_venta === undefined) {
    update.fecha_venta = new Date().toISOString().slice(0, 10);
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
      idioma: body.idioma || "es",
      estado: body.estado || "no_leido",
      comentarios: body.comentarios || null,
      notas: body.notas || null,
      mes_primer_contacto: body.mes_primer_contacto || null,
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
