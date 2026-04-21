import { supabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const { data: prospectos, error: e1 } = await supabaseAdmin
    .from("prospectos")
    .select("id, nombre, perfil, liga, club, idioma, estado, comentarios, mes_primer_contacto, updated_at")
    .order("updated_at", { ascending: false });

  if (e1) return Response.json({ error: e1.message }, { status: 500 });

  const { data: metricas } = await supabaseAdmin
    .from("metricas_mensuales")
    .select("*")
    .order("mes", { ascending: true });

  const { data: analisis } = await supabaseAdmin
    .from("analisis_mensajes")
    .select("*");

  return Response.json({ prospectos, metricas, analisis });
}

export async function PATCH(req) {
  const { id, nombre, estado, comentarios, notas } = await req.json();

  let targetId = id;
  if (!targetId && nombre) {
    const { data } = await supabaseAdmin
      .from("prospectos")
      .select("id, nombre")
      .ilike("nombre", `%${nombre}%`)
      .limit(5);
    if (!data || data.length === 0) {
      return Response.json({ error: `No encuentro a "${nombre}"` }, { status: 404 });
    }
    if (data.length > 1) {
      return Response.json(
        { error: "Varios coinciden", candidatos: data.map(d => d.nombre) },
        { status: 409 }
      );
    }
    targetId = data[0].id;
  }

  const update = { updated_at: new Date().toISOString() };
  if (estado) update.estado = estado;
  if (comentarios !== undefined) update.comentarios = comentarios;
  if (notas !== undefined) update.notas = notas;

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
      mes_primer_contacto: body.mes_primer_contacto || null,
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, prospecto: data });
}
