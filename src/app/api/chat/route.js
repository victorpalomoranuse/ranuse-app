import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const TOOLS = [
  {
    name: "actualizar_estado",
    description:
      "Actualiza el estado de un prospecto. Usar cuando el usuario diga algo como " +
      "'X me ha contestado', 'marca a Y como negociación', 'Z me ha rechazado', " +
      "'pasar a activo a W'. Estados válidos: sin_contactar, no_contesta, leido, " +
      "activo, negociacion, ganado, rechazado.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string", description: "Nombre del prospecto (parcial o completo)" },
        nuevo_estado: {
          type: "string",
          enum: ["sin_contactar","no_contesta","leido","activo","negociacion","ganado","rechazado"],
        },
        nota: { type: "string", description: "Nota opcional sobre el cambio" },
      },
      required: ["nombre", "nuevo_estado"],
    },
  },
  {
    name: "crear_prospecto",
    description: "Crea un nuevo prospecto en la base de datos.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        perfil: { type: "string" },
        liga: { type: "string" },
        club: { type: "string" },
        comentarios: { type: "string" },
      },
      required: ["nombre"],
    },
  },
  {
    name: "buscar_prospecto",
    description: "Busca prospectos por nombre o por estado.",
    input_schema: {
      type: "object",
      properties: {
        nombre: { type: "string" },
        estado: { type: "string" },
      },
    },
  },
];

async function ejecutarHerramienta(name, input) {
  if (name === "actualizar_estado") {
    const { data: encontrados } = await supabaseAdmin
      .from("prospectos")
      .select("id, nombre, estado")
      .ilike("nombre", `%${input.nombre}%`)
      .limit(5);

    if (!encontrados || encontrados.length === 0) {
      return { ok: false, error: `No encuentro a "${input.nombre}"` };
    }
    if (encontrados.length > 1) {
      return {
        ok: false,
        error: "Varios coinciden, necesito más detalle",
        candidatos: encontrados.map((e) => e.nombre),
      };
    }
    const p = encontrados[0];
    const { error } = await supabaseAdmin
      .from("prospectos")
      .update({
        estado: input.nuevo_estado,
        notas: input.nota ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", p.id);
    if (error) return { ok: false, error: error.message };
    return {
      ok: true,
      cambio: `${p.nombre}: ${p.estado} → ${input.nuevo_estado}`,
    };
  }

  if (name === "crear_prospecto") {
    const { data, error } = await supabaseAdmin
      .from("prospectos")
      .insert({ ...input, estado: "sin_contactar" })
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, creado: data.nombre };
  }

  if (name === "buscar_prospecto") {
    let q = supabaseAdmin.from("prospectos").select("nombre, estado, perfil");
    if (input.nombre) q = q.ilike("nombre", `%${input.nombre}%`);
    if (input.estado) q = q.eq("estado", input.estado);
    const { data, error } = await q.limit(10);
    if (error) return { ok: false, error: error.message };
    return { ok: true, resultados: data };
  }

  return { ok: false, error: "Herramienta desconocida" };
}

async function construirSystem() {
  const { data: rows } = await supabaseAdmin.from("prospectos").select("estado");
  const counts = {};
  (rows || []).forEach((p) => { counts[p.estado] = (counts[p.estado] || 0) + 1; });

  return `Eres el asistente de negocio personal de Víctor Palomo, dueño de Ranusedesign.
Diseña home gyms exclusivos para futbolistas profesionales.

RESUMEN ACTUAL DE LA BASE DE DATOS:
${Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`).join("\n")}

REGLAS:
- Habla en español, de tú, directo y con energía pero sin pasarte.
- Si el usuario te dice que alguien ha cambiado de estado, USA la herramienta actualizar_estado.
- Si te dice que ha contactado con alguien nuevo, USA crear_prospecto.
- Si te pregunta por alguien concreto, USA buscar_prospecto antes de responder.
- Cuando generes un DM, ponlo entre *** arriba y abajo.
- Estados: sin_contactar, no_contesta, leido, activo, negociacion, ganado, rechazado.`;
}

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const system = await construirSystem();

    let conversacion = [...messages];
    let final = null;

    for (let i = 0; i < 5; i++) {
      const resp = await client.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system,
        tools: TOOLS,
        messages: conversacion,
      });

      if (resp.stop_reason === "tool_use") {
        conversacion.push({ role: "assistant", content: resp.content });

        const toolResults = [];
        for (const block of resp.content) {
          if (block.type === "tool_use") {
            const result = await ejecutarHerramienta(block.name, block.input);
            toolResults.push({
              type: "tool_result",
              tool_use_id: block.id,
              content: JSON.stringify(result),
            });
          }
        }
        conversacion.push({ role: "user", content: toolResults });
        continue;
      }

      const texto = resp.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      final = texto;
      break;
    }

    return Response.json({ content: final || "No he podido procesar la petición." });
  } catch (e) {
    console.error(e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
