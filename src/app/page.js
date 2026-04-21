"use client";
import { useState, useEffect, useRef } from "react";

const PROSPECTS = {
  negociacion: [
    { nombre: "Aitor Van Den Brule", tipo: "Home Gym", mes: "Marzo" },
    { nombre: "Miquel Piqué", tipo: "Centro entrenamiento", mes: "Marzo" },
    { nombre: "Manuel Murcia", tipo: "Proyecto", mes: "Abril" },
    { nombre: "Jaime Salom", tipo: "Home Gym", mes: "Febrero" },
    { nombre: "Pedro Mba Obiang", tipo: "Home Gym", mes: "Marzo" },
    { nombre: "Aitor Ruibal", tipo: "Home Gym", mes: "Marzo" },
  ],
  activos: [
    { nombre: "Juan Iglesias", tipo: "Retirado", estado: "Vídeo contestado ✓", msgs: 3 },
    { nombre: "Dani Cárdenas", tipo: "Portero", estado: "Contestó DM", msgs: 1 },
    { nombre: "Sheila Guijarro", tipo: "Jugadora", estado: "Vídeo leído", msgs: 3 },
    { nombre: "Nerea Eizaguirre", tipo: "Jugadora", estado: "Contestó FU", msgs: 2 },
    { nombre: "Nerea Pérez Machado", tipo: "Jugadora", estado: "Vídeo leído", msgs: 3 },
    { nombre: "Jon Perez Bolo", tipo: "Entrenador", estado: "Vídeo leído", msgs: 3 },
    { nombre: "Carlos Clerc", tipo: "Jugador", estado: "Contestó", msgs: 1 },
  ],
  leidos: [
    { nombre: "Raúl Tamudo", msgs: 2 }, { nombre: "Pablo Hernández", msgs: 2 },
    { nombre: "Aythami Artiles", msgs: 2 }, { nombre: "Iturraspe", msgs: 2 },
    { nombre: "Edu Aguirre", msgs: 2 }, { nombre: "Manu Fuster", msgs: 1 },
    { nombre: "Iñigo Vicente", msgs: 1 }, { nombre: "Pedro León", msgs: 1 },
    { nombre: "Oscar Trejo", msgs: 1 },
  ],
  urgentes: [
    { nombre: "Guillermo Vallejo", estado: "4 mensajes sin respuesta", msgs: 4 },
    { nombre: "Hugo Fraile", estado: "Vídeo enviado, sin respuesta", msgs: 3 },
    { nombre: "Piti Medina", estado: "Follow up pendiente", msgs: 2 },
  ],
};

const LIGAS = ["Hypermotion", "LaLiga", "Liga F", "Kings League", "Serie A", "Ligue 1", "Liga Portugal", "Bundesliga"];
const PERFILES = ["Jugadores", "Porteros", "Retirados", "Entrenadores", "Jugadoras", "Árbitros", "Kings League"];

export default function App() {
  const [tab, setTab] = useState("chat");
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "¡Buenas, Víctor! 👋 Tengo todos tus datos cargados.\n\nAhora mismo tienes **6 en negociación**, **7 conversaciones activas** y **9 que leyeron sin contestar**.\n\n¿Qué necesitas hoy?" }
  ]);
  const [input, setInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [finderFilters, setFinderFilters] = useState({ liga: "Hypermotion", perfil: "Jugadores", cantidad: 5 });
  const [finderResults, setFinderResults] = useState(null);
  const [finderLoading, setFinderLoading] = useState(false);
  const [generated, setGenerated] = useState([]);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const sendMsg = async () => {
    if (!input.trim() || chatLoading) return;
    const userMsg = { role: "user", content: input };
    const newMsgs = [...msgs, userMsg];
    setMsgs(newMsgs);
    setInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/ch
