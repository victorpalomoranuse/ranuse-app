import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS = [
  {
    name: "listar_prospectos",
    description: "Lista los prospectos de Víctor con filtros opcionales. Útil para contestar '¿cuántos interesados tengo?', 'dame los prospectos de abril', 'a quién tengo que hacer seguimiento'.",
    input_schema: {
      type: "object",
      properties: {
        estado: { type: "string", enum: ["no_leido", "leido", "interesado", "inviable", "rechazado", "venta"], description: "Filtrar por estado" },
        mes: { type: "string", description: "Filtrar por mes_primer_contacto (ej: 'abril')" },
        nombre_parcial: { type: "string", description: "Buscar por nombre que contenga este texto" },
      },
    },
  },
  {
    name: "cambiar_estado_prospecto",
    description: "Actualiza el estado de un prospecto por su nombre. Úsalo cuando Víctor diga 'Rubén me contestó', 'Pedro no le interesa', 'Borja ha comprado', etc.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del prospecto (o parte de él)" },
        nuevo_estado: { type: "string", enum: ["no_leido", "leido", "interesado", "inviable", "rechazado", "venta"] },
        importe_venta: { type: "number", description: "Si el nuevo estado es 'venta', el importe en euros" },
      },
      required: ["nombre", "nuevo_estado"],
    },
  },
  {
    name: "listar_plantillas",
    description: "Lista todas las plantillas de mensaje guardadas de Víctor.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "guardar_plantilla",
    description: "Guarda una nueva plantilla de mensaje con un nombre. Usar cuando Víctor diga 'guarda esto como jugadores corto', 'guarda esta estructura como portero humor'.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre corto de la plantilla, ej: 'jugadores corto'" },
        estructura: { type: "string", description: "El texto de la plantilla, puede usar {nombre} como placeholder" },
        descripcion: { type: "string", description: "Descripción opcional de cuándo usar la plantilla" },
      },
      required: ["nombre", "estructura"],
    },
  },
  {
    name: "guardar_mensaje_enviado",
    description: "Guarda un mensaje como enviado a un prospecto concreto. Se usa cuando Víctor confirma que ya ha mandado un DM.",
    input_schema: {
      type: "object",
      properties: {
        nombre_prospecto: { type: "string" },
        texto: { type: "string" },
        plantilla_nombre: { type: "string", description: "Opcional: nombre de la plantilla usada" },
        es_seguimiento: { type: "boolean", description: "true si es FU, false si es primer contacto" },
      },
      required: ["nombre_prospecto", "texto"],
    },
  },
  {
    name: "seguimientos_pendientes",
    description: "Devuelve la lista de prospectos a los que hay que hacer seguimiento: los que están en 'leido' desde hace 4+ días sin mensaje posterior, y los 'interesado' sin video/llamada aún.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "analizar_plantillas",
    description: "Analiza qué plantillas tienen mejor tasa de respuesta, interés y venta. Úsalo cuando Víctor pregunte 'qué plantilla funciona mejor'.",
    input_schema: { type: "object", properties: {} },
  },
];

async function ejecutarHerramienta(nombre, input) {
  try {
    if (nombre === "listar_prospectos") {
      let q = supabaseAdmin.from("prospectos").select("id, nombre, estado, mes_primer_contacto, perfil, liga, importe_venta, fecha_video, fecha_llamada1, fecha_venta");
      if (input.estado) q = q.eq("estado", input.estado);
      if (input.mes) q = q.eq("mes_primer_contacto", input.mes);
      if (input.nombre_parcial) q = q.ilike("nombre", `%${input.nombre_parcial}%`);
      const r = await q.limit(50);
      if (r.error) return { error: r.error.message };
      return { prospectos: r.data, total: r.data.length };
    }

    if (nombre === "cambiar_estado_prospecto") {
      const b = await supabaseAdmin.from("prospectos").select("id, nombre").ilike("nombre", `%${input.nombre}%`).limit(5);
      if (!b.data || b.data.length === 0) return { error: `No encuentro a "${input.nombre}"` };
      if (b.data.length > 1) return { error: "Varios coinciden", candidatos: b.data.map(x => x.nombre) };
      const target = b.data[0];
      const update = { estado: input.nuevo_estado, updated_at: new Date().toISOString() };
      if (input.nuevo_estado === "venta") {
        update.fecha_venta = new Date().toISOString().slice(0, 10);
        if (input.importe_venta) update.importe_venta = input.importe_venta;
      }
      const r = await supabaseAdmin.from("prospectos").update(update).eq("id", target.id).select().single();
      if (r.error) return { error: r.error.message };
      return { ok: true, prospecto: r.data };
    }

    if (nombre === "listar_plantillas") {
      const r = await supabaseAdmin.from("plantillas").select("*").order("nombre");
      if (r.error) return { error: r.error.message };
      return { plantillas: r.data };
    }

    if (nombre === "guardar_plantilla") {
      const r = await supabaseAdmin.from("plantillas").upsert({
        nombre: input.nombre.toLowerCase().trim(),
        estructura: input.estructura,
        descripcion: input.descripcion || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "nombre" }).select().single();
      if (r.error) return { error: r.error.message };
      return { ok: true, plantilla: r.data };
    }

    if (nombre === "guardar_mensaje_enviado") {
      const b = await supabaseAdmin.from("prospectos").select("id").ilike("nombre", `%${input.nombre_prospecto}%`).limit(5);
      if (!b.data || b.data.length === 0) return { error: `No encuentro a "${input.nombre_prospecto}"` };
      if (b.data.length > 1) return { error: "Varios coinciden, afina el nombre" };
      const prospecto_id = b.data[0].id;

      let plantilla_id = null;
      let tipo_mensaje = null;
      if (input.plantilla_nombre) {
        const p = await supabaseAdmin.from("plantillas").select("id, nombre").ilike("nombre", input.plantilla_nombre).limit(1);
        if (p.data && p.data.length > 0) { plantilla_id = p.data[0].id; tipo_mensaje = p.data[0].nombre; }
      }

      const prev = await supabaseAdmin.from("mensajes").select("secuencia").eq("prospecto_id", prospecto_id).order("secuencia", { ascending: false }).limit(1);
      const siguiente = prev.data && prev.data.length > 0 ? (prev.data[0].secuencia || 0) + 1 : 1;

      const r = await supabaseAdmin.from("mensajes").insert({
        prospecto_id,
        secuencia: siguiente,
        tipo_mensaje,
        plantilla_id,
        texto: input.texto,
        enviado_en: new Date().toISOString().slice(0, 10),
        es_seguimiento: input.es_seguimiento || siguiente > 1,
      }).select().single();

      if (r.error) return { error: r.error.message };
      return { ok: true, mensaje: r.data };
    }

    if (nombre === "seguimientos_pendientes") {
      // Prospectos leídos sin seguimiento reciente
      const leidos = await supabaseAdmin.from("prospectos").select("id, nombre, perfil, mes_primer_contacto, updated_at").eq("estado", "leido").order("updated_at", { ascending: true }).limit(20);
      // Interesados sin vídeo aún
      const interesados = await supabaseAdmin.from("prospectos").select("id, nombre, perfil, mes_primer_contacto, fecha_video").eq("estado", "interesado").is("fecha_video", null).limit(20);
      return {
        leidos_sin_seguimiento: leidos.data || [],
        interesados_sin_video: interesados.data || [],
      };
    }

    if (nombre === "analizar_plantillas") {
      const res = await fetch(`${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : "http://localhost:3000"}/api/mensajes`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        return { analisis: data.analisis };
      }
      // Fallback: calcular aquí mismo si la llamada interna falla
      const { data: mensajes } = await supabaseAdmin.from("mensajes").select("*");
      const { data: plantillas } = await supabaseAdmin.from("plantillas").select("id, nombre");
      const { data: prospectos } = await supabaseAdmin.from("prospectos").select("id, estado");
      const pe = {};
      for (const p of (prospectos || [])) pe[p.id] = p.estado;
      const pp = {};
      for (const pl of (plantillas || [])) pp[pl.id] = { nombre: pl.nombre, enviados: 0, respondidos: 0, ventas: 0 };
      for (const m of (mensajes || [])) {
        if (m.es_seguimiento) continue;
        const k = m.plantilla_id || "sin";
        if (!pp[k]) pp[k] = { nombre: m.tipo_mensaje || "sin plantilla", enviados: 0, respondidos: 0, ventas: 0 };
        pp[k].enviados += 1;
        if (["interesado", "inviable", "rechazado", "venta"].includes(pe[m.prospecto_id])) pp[k].respondidos += 1;
        if (pe[m.prospecto_id] === "venta") pp[k].ventas += 1;
      }
      const analisis = Object.values(pp).filter(x => x.enviados > 0).map(x => ({
        ...x,
        tasa_respuesta: x.enviados > 0 ? Number(((x.respondidos / x.enviados) * 100).toFixed(1)) : 0,
      }));
      return { analisis };
    }

    return { error: `Herramienta desconocida: ${nombre}` };
  } catch (e) {
    return { error: e.message };
  }
}

const SYSTEM = `Eres el asistente personal de Víctor Palomo, director de Ranuse Design, que diseña home gyms exclusivos para futbolistas profesionales. Víctor prospecta jugadores por Instagram y tú le ayudas a gestionar todo su embudo.

TONO:
- Directo, práctico, con complicidad. Víctor es de confianza, tutéale.
- Respuestas cortas por defecto. Solo te alargas cuando el contenido (un DM, un análisis) lo pide.
- Usa **negritas** para lo importante y *cursiva* para matices.
- Para textos de DMs listos para copiar, enmarca con ***triple asterisco***.

CONOCIMIENTO DE CONTEXTO:
- Víctor tiene ~447 prospectos en 4 meses (enero-abril 2026), ticket medio 4.500€.
- Estados posibles de un prospecto: no_leido (enviado sin leer), leido (visto sin respuesta), interesado (respondió con interés), inviable (respondió pero no encaja), rechazado (dijo que no), venta (cerrado).
- Embudo Ranuse: DM → responde → muestra interés → le mando VÍDEO → LLAMADA 1 → (opcional LLAMADA 2) → VENTA.
- Víctor evita Real Madrid, Barça y Atlético. Prioriza LaLiga Hypermotion (segunda), Liga F, porteros, retirados, entrenadores, Kings League.
- Tipo de mensaje: "jugadores corto", "jugadores largo", "portero", "entrenador", "retirado", "liga f", "kings league".

HERRAMIENTAS DISPONIBLES:
- listar_prospectos: para ver qué prospectos hay con filtros.
- cambiar_estado_prospecto: para actualizar estado cuando Víctor te dice algo como "X me contestó" o "Y ha comprado".
- listar_plantillas: para ver las plantillas guardadas.
- guardar_plantilla: cuando Víctor diga "guarda esto como X" o "guarda esta estructura como X".
- guardar_mensaje_enviado: cuando Víctor confirme que ya mandó un DM concreto a un prospecto.
- seguimientos_pendientes: cuando pregunte "a quién toca seguir hoy" o similar.
- analizar_plantillas: cuando pregunte "qué plantilla funciona mejor".

REGLAS IMPORTANTES:
1. Cuando Víctor pida un DM, mira primero si hay plantilla con ese nombre (usa listar_plantillas). Si la hay, sigue su estructura pero personaliza con nombre/club.
2. Después de generar un DM, SIEMPRE pregunta: "¿Lo has enviado ya? Dime sí y lo guardo como enviado con la plantilla X."
3. No ejecutes acciones destructivas (borrar, cambios de estado) sin confirmar primero con Víctor cuando haya duda.
4. Si varios prospectos coinciden con un nombre parcial, pregunta cuál es.
5. Cuando guardes una plantilla, confirma con el nombre corto que le has puesto.`;

export async function POST(req) {
  try {
    const { messages } = await req.json();

    let turno = 0;
    let historial = messages.map(m => ({ role: m.role, content: m.content }));

    while (turno < 6) {
      turno++;

      const response = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: SYSTEM,
        tools: TOOLS,
        messages: historial,
      });

      // Si no hay tool_use, devolver el texto y terminar
      if (response.stop_reason !== "tool_use") {
        const texto = response.content.filter(b => b.type === "text").map(b => b.text).join("\n").trim();
        return Response.json({ content: texto || "(sin respuesta)" });
      }

      // Añadir la respuesta del modelo al historial
      historial.push({ role: "assistant", content: response.content });

      // Ejecutar todas las tools que pidió
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === "tool_use") {
          const resultado = await ejecutarHerramienta(block.name, block.input || {});
          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: JSON.stringify(resultado),
          });
        }
      }

      historial.push({ role: "user", content: toolResults });
    }

    return Response.json({ content: "(se agotaron los turnos de herramientas)" });
  } catch (e) {
    console.error("[chat] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
