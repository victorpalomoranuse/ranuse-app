import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Eres experto en futbol espanol y europeo. Sugiere jugadores reales para prospectar para home gyms exclusivos para futbolistas.

CRITERIOS: Instagram menos 200k, mas de 26 anos o 3 temporadas mismo club. Prioritarios: Hypermotion, Liga F, porteros, retirados, entrenadores. Evitar Real Madrid, Barca, Atletico.

YA CONTACTADOS: Borja Mayoral, Gerard Moreno, Antonio Raillo, Sergio Herrera, Edgar Badia, Iago Aspas, Carlos Soler, Dani Cardenas, Hugo Fraile, Sheila Guijarro, Juan Iglesias, Santi Canizares, Gabri Veiga, Raul Tamudo, Pablo Hernandez, Carlos Clerc, Alejandro Grimaldo, Joel Robles, Alexia Putellas, Aitana Bonmati, Joaquin Sanchez, Guti, Fernando Llorente.

Responde SOLO JSON sin markdown:
{"jugadores":[{"nombre":"Nombre","club":"Club","posicion":"Pos","liga":"Liga","edad":28,"perfil":"Por que encaja","tipo_mensaje":"Jugadores Corto","idioma":"espanol"}],"razonamiento":"Por que estos perfiles"}`;

export async function POST(req) {
  try {
    const { liga, perfil, cantidad } = await req.json();
    const prompt = "Sugiere " + cantidad + " jugadores de " + liga + " con perfil " + perfil + " para prospectar. Solo JSON.";
    const response = await client.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      messages: [{ role: "user", content: prompt }],
    });
    const text = response.content[0].text.replace(/```json|```/g, "").trim();
    const data = JSON.parse(text);
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
