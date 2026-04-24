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

  return Response.json({ prospectos, metricas });
}

const MESES_ORDEN = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function calcularMetricas(prospectos) {
  // Agrupamos por mes de primer contacto.
  // Reglas según Víctor:
  //   - contactados  = TODOS los que se contactaron (todos los de la tabla, porque si están es que les escribiste)
  //   - leidos       = en estado "leido"
  //   - responden    = interesado + inviable + rechazado + venta (los que te respondieron de alguna forma)
  //   - interesados  = en estado "interesado"
  //   - rechazados   = en estado "rechazado" (rechazo directo)
  //   - inviables    = en estado "inviable"
  //   - ventas       = en estado "venta" (cerradas)
  const porMes = {};
  for (const p of prospectos) {
    const mes = p.mes_primer_contacto || "sin_mes";
    if (!porMes[mes]) {
      porMes[mes] = {
        mes,
        contactados: 0,
        leidos: 0,
        responden: 0,
        interesados: 0,
        rechazados: 0,
        inviables: 0,
        ventas: 0,
      };
    }
    const m = porMes[mes];
    m.contactados += 1;

    if (p.estado === "leido") m.leidos += 1;
    if (p.estado === "interesado") { m.interesados += 1; m.responden += 1; }
    if (p.estado === "inviable")   { m.inviables += 1;   m.responden += 1; }
    if (p.estado === "rechazado")  { m.rechazados += 1;  m.responden += 1; }
    if (p.estado === "venta")      { m.ventas += 1;      m.responden += 1; }
  }

  return Object.values(porMes).sort((a, b) => {
    if (a.mes === "sin_mes") return 1;
    if (b.mes === "sin_mes") return -1;
    return MESES_ORDEN.indexOf(b.mes) - MESES_ORDEN.indexOf(a.mes);
  });
}

export async function PATCH(req) {
  const body = await req.json();
  if (!body.id) {
    return Response.json({ error: "Falta id" }, { status: 400 });
  }
  const update = { updated_at: new Date().toISOString() };
  const campos = ["nombre", "perfil", "liga", "idioma", "estado", "comentarios", "notas", "mes_primer_contacto"];
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
