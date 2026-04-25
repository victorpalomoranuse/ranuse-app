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

  // Cargar el conteo de mensajes por prospecto
  const { data: mensajes } = await supabaseAdmin.from("mensajes").select("prospecto_id");
  const conteo = {};
  for (const m of (mensajes || [])) {
    conteo[m.prospecto_id] = (conteo[m.prospecto_id] || 0) + 1;
  }
  for (const p of prospectos) {
    p.num_mensajes = conteo[p.id] || 0;
  }

  return Response.json({
    prospectos,
    metricasCohorte: calcularMetricasCohorte(prospectos),
    metricasCaja:    calcularMetricasCaja(prospectos),
  });
}

function calcularMetricasCohorte(prospectos) {
  const porMes = {};
  for (const p of prospectos) {
    const mes = p.mes_primer_contacto || "sin_mes";
    if (!porMes[mes]) porMes[mes] = plantilla(mes);
    const m = porMes[mes];
    m.contactados += 1;
    if (p.estado === "leido") m.leidos += 1;
    const respondio = ["interesado", "inviable", "rechazado", "venta"].includes(p.estado);
    if (respondio) m.responden += 1;
    if (p.estado === "interesado" || p.estado === "venta") m.objetivo_bloqueo += 1;
    if (p.fecha_video) m.videos += 1;
    if (p.fecha_llamada1) m.agendas += 1;
    if (p.asistio_llamada1 === true) m.asistencias += 1;
    if (p.fecha_llamada2) m.llamadas2 += 1;
    if (p.estado === "venta") {
      m.ventas += 1;
      m.facturacion += Number(p.importe_venta) || 0;
    }
    m.seguimientos += Math.max(0, (p.num_mensajes || 0) - 1);
  }
  return Object.values(porMes).map(calcularPorcentajes).sort(ordenarMes);
}

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
  return { mes, contactados: 0, leidos: 0, responden: 0, objetivo_bloqueo: 0, videos: 0, agendas: 0, asistencias: 0, llamadas2: 0, ventas: 0, facturacion: 0, seguimientos: 0 };
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
  if (!body.id) return Response.json({ error: "Falta id" }, { status: 400 });
  const update = { updated_at: new Date().toISOString() };
  const campos = [
    "nombre", "perfil", "liga", "idioma", "estado", "comentarios", "notas", "mes_primer_contacto",
    "fecha_respuesta", "fecha_video", "fecha_llamada1", "fecha_llamada2",
    "asistio_llamada1", "fecha_venta", "importe_venta",
  ];
  for (const c of campos) {
    if (body[c] !== undefined) update[c] = body[c] === "" ? null : body[c];
  }
  if (body.estado === "venta" && body.fecha_venta === undefined) {
    update.fecha_venta = new Date().toISOString().slice(0, 10);
  }
  const result = await supabaseAdmin.from("prospectos").update(update).eq("id", body.id).select().single();
  if (result.error) return Response.json({ error: result.error.message }, { status: 500 });
  return Response.json({ ok: true, prospecto: result.data });
}

export async function POST(req) {
  const body = await req.json();
  if (!body.nombre || !body.nombre.trim()) {
    return Response.json({ error: "El nombre es obligatorio" }, { status: 400 });
  }
  const result = await supabaseAdmin
    .from("prospectos")
    .insert({
      nombre: body.nombre.trim(),
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
