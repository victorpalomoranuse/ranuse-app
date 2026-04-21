import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const FINDER_SYSTEM = `Eres experto en fútbol español y europeo. Sugiere jugadores reales para que Víctor Palomo los prospecte para su negocio de home gyms exclusivos para futbolistas.

CRITERIOS:
- Instagram menos de 200k seguidores
- Más de 26 años O más de 3 temporadas en el mismo club
- Prioritarios: Hypermotion, Liga F, porteros, retirados, entrenadores
- Evitar: Real Madrid, Barça, Atlético

YA CONTACTADOS (no sugerir): Borja Mayoral, Mauro Arambarri, Gerard Moreno, Antonio Raillo, Sergio Herrera, Edgar Badia, Iago Aspas, Kirian Rodríguez, Carlos Soler, Dani Cárdenas, Hugo Fraile, Sheila Guijarro, Juan Iglesias, Santi Cañizares, Gabri Veiga, Raúl Tamudo, Pablo Hernández, Aythami Artiles, Carlos Clerc, Alejandro Grimaldo, Joel Robles, Junior Firpo, Alexia Putellas, Aitana Bonmatí, Olga Carmona, Joaquín Sanchez, Guti, Aritz Aduriz, Fernando Llorente

Responde SOLO con JSON válido sin markdown:
{
  "jugadores": [
    {
      "nombre": "Nombre Completo",
      "club": "Club actual",
      "posicion": "Posición",
      "liga": "Liga",
      "edad": 28,
      "perfil": "Por qué es buen prospecto en 1 frase",
      "tipo_mensaje": "Jugadores Corto",
      "idioma": "español"
    }
  ],
  "razonamiento": "Por qué estos perfiles en 1-2 frases"
}`;

export async function POST(req) {
  try {
    const { liga, perfil, cantidad } = await req.json();
    const prompt = `Sugiere
