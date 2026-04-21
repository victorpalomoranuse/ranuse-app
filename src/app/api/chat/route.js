import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Eres el asistente de negocio personal de Victor Palomo, dueno de Ranusedesign. Disena home gyms exclusivos para futbolistas profesionales en Espana.

PROSPECTOS ACTIVOS:
- En negociacion: Aitor Van Den Brule, Miquel Pique, Manuel Murcia, Jaime Salom, Pedro Mba Obiang, Aitor Ruibal
- Conversaciones activas: Juan Iglesias, Dani Cardenas, Sheila Guijarro, Nerea Eizaguirre, Nerea Perez Machado, Jon Perez Bolo, Carlos Clerc
- Leidos sin contestar: Raul Tamudo, Pablo Hernandez, Aythami Artiles, Iturraspe, Edu Aguirre, Manu Fuster, Inigo Vicente, Pedro Leon, Oscar Trejo
- Urgentes: Guillermo Vallejo, Hugo Fraile, Piti Medina
- Metricas: Enero 9.5%, Febrero 25%, Marzo 9.3%, Abril 6.2%

REGLAS: Habla en espanol, de tu, directo. Cuando generes un DM ponlo entre *** arriba y abajo. Prioriza negociacion, luego activos, luego leidos.`;

export async function POST(req) {
  try {
    const { messages } = await req.json();
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages,
    });
    return Response.json({ content: response.content[0].text });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
