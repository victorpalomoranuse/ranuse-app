import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const ALLOWED_DOMAINS = [
  "besoccer.com",
  "es.besoccer.com",
  "www.besoccer.com",
  "transfermarkt.es",
  "transfermarkt.com",
  "www.transfermarkt.es",
  "www.transfermarkt.com",
];

function construirSystem(yaContactados) {
  const listaYa = yaContactados.length
    ? yaContactados.map((n) => `- ${n}`).join("\n")
    : "- (ninguno todavía)";

  return `Eres un experto en fútbol español y europeo que ayuda a Víctor (Ranuse Design) a prospectar jugadores para home gyms exclusivos.

TIENES UNA HERRAMIENTA web_search RESTRINGIDA A SOLO DOS FUENTES:
- besoccer.com
- transfermarkt.es / transfermarkt.com

REGLAS DE BÚSQUEDA OBLIGATORIAS:
1. SIEMPRE debes hacer al menos 2-3 búsquedas web antes de sugerir jugadores. Nunca te inventes datos.
2. Busca plantillas reales, edades reales, clubes actuales y antigüedad en el club en BeSoccer o Transfermarkt.
3. Si un dato no aparece en los resultados, NO lo inventes: omite el campo o pon null.
4. Después de buscar, filtra por los criterios que te da Víctor.

CRITERIOS DE VÍCTOR:
- Instagram menos de 200k seguidores (valora por nivel de club, no por número exacto).
- Mayores de 26 años O con 3+ temporadas en el mismo club (estabilidad residencial).
- Prioritarios: LaLiga Hypermotion (segunda división), Liga F, porteros, retirados, entrenadores, Kings League.
- Evitar: Real Madrid, Barcelona, Atlético de Madrid.
- Evitar también jugadores demasiado mediáticos.

YA CONTACTADOS (NO los sugieras de nuevo):
${listaYa}

FORMATO DE RESPUESTA FINAL:
Cuando termines de buscar, responde SOLO con un bloque JSON válido, sin markdown, sin comentarios, sin texto antes ni después. Estructura exacta:

{
  "jugadores": [
    {
      "nombre": "Nombre Apellido",
      "club": "Club actual",
      "posicion": "Portero / Defensa / Centrocampista / Delantero / Entrenador",
      "liga": "Liga actual",
      "edad": 28,
      "temporadas_en_club": 4,
      "perfil": "1-2 frases de por qué encaja para Víctor",
      "tipo_mensaje": "Jugadores Corto | Portero | Retirado | Entrenador | Liga F | Kings League",
      "idioma": "espanol",
      "fuente": "besoccer.com o transfermarkt.es"
    }
  ],
  "razonamiento": "Breve explicación de por qué estos perfiles encajan y qué has mirado."
}`;
}

async function obtenerYaContactados() {
  try {
    const { data } = await supabaseAdmin
      .from("prospectos")
      .select("nombre");
    return (data || []).map((p) => p.nombre);
  } catch {
    return [];
  }
}

function extraerJSON(texto) {
  let t = texto.replace(/```json|```/g, "").trim();
  const primero = t.indexOf("{");
  const ultimo = t.lastIndexOf("}");
  if (primero !== -1 && ultimo !== -1 && ultimo > primero) {
    t = t.slice(primero, ultimo + 1);
  }
  return JSON.parse(t);
}

export async function POST(req) {
  try {
    const { liga, perfil, cantidad } = await req.json();

    const yaContactados = await obtenerYaContactados();
    const system = construirSystem(yaContactados);

    const prompt = `Necesito ${cantidad} jugadores nuevos (que NO estén en la lista de ya contactados) con perfil "${perfil}" de la liga "${liga}".

Haz búsquedas en BeSoccer y Transfermarkt para verificar plantillas, edades y antigüedad en el club antes de responder. Responde SOLO con el JSON pedido.`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      system,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 8,
          allowed_domains: ALLOWED_DOMAINS,
        },
      ],
      messages: [{ role: "user", content: prompt }],
    });

    const textoFinal = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (!textoFinal) {
      return Response.json(
        {
          error:
            "No se obtuvo texto final del modelo. Es posible que se agotaran las búsquedas.",
        },
        { status: 500 }
      );
    }

    let data;
    try {
      data = extraerJSON(textoFinal);
    } catch (e) {
      return Response.json(
        {
          error: "La respuesta no era JSON válido",
          raw: textoFinal.slice(0, 800),
        },
        { status: 500 }
      );
    }

    return Response.json(data);
  } catch (e) {
    console.error("[finder] error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
