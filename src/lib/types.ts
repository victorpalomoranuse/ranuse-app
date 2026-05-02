// Tipos para Tareas/Calendario/Presupuestos

export type ProjectEstado = 'activo' | 'pausado' | 'finalizado' | 'cancelado';

export interface Project {
  id: string;
  nombre: string;
  cliente: string | null;
  estado: ProjectEstado;
  fecha_inicio: string | null;
  fecha_fin_estimada: string | null;
  prospecto_id: number | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export type TaskPrioridad = 'baja' | 'media' | 'alta';

export interface Task {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha: string | null;
  hora: string | null;
  completada: boolean;
  prioridad: TaskPrioridad;
  prospecto_id: number | null;
  project_id: string | null;
  recordatorio_minutos: number | null;
  fecha_completada: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  titulo: string;
  descripcion: string | null;
  fecha_inicio: string;
  fecha_fin: string | null;
  todo_el_dia: boolean;
  ubicacion: string | null;
  prospecto_id: number | null;
  project_id: string | null;
  color: string;
  recordatorio_minutos: number | null;
  created_at: string;
  updated_at: string;
}

export interface CompanySettings {
  id: number;
  razon_social: string | null;
  nombre_comercial: string | null;
  cif: string | null;
  direccion: string | null;
  codigo_postal: string | null;
  ciudad: string | null;
  provincia: string | null;
  pais: string | null;
  telefono: string | null;
  email: string | null;
  web: string | null;
  iban: string | null;
  banco: string | null;
  logo_url: string | null;
  prefijo_presupuesto: string | null;
  reset_anual: boolean;
  ultimo_numero: number;
  ultimo_anio: number | null;
  validez_default_dias: number;
  formas_pago_default: string | null;
  notas_default: string | null;
  updated_at: string;
}

export interface PartidaCatalogo {
  id: string;
  codigo: string | null;
  descripcion: string;
  capitulo: string | null;
  unidad: string;
  precio_compra: number;
  pvp: number;
  margen_default: number;
  notas: string | null;
  veces_usada: number;
  created_at: string;
  updated_at: string;
}

export type PresupuestoEstado = 'borrador' | 'enviado' | 'aceptado' | 'rechazado' | 'caducado';

export interface Presupuesto {
  id: string;
  numero: string;
  prospecto_id: number | null;
  project_id: string | null;
  cliente_nombre: string;
  cliente_cif: string | null;
  cliente_direccion: string | null;
  cliente_codigo_postal: string | null;
  cliente_ciudad: string | null;
  cliente_email: string | null;
  cliente_telefono: string | null;
  fecha: string;
  validez_dias: number;
  formas_pago: string | null;
  notas: string | null;
  condiciones: string | null;
  descuento_global_pct: number;
  estado: PresupuestoEstado;
  fecha_envio: string | null;
  fecha_aceptacion: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresupuestoPartida {
  id: string;
  presupuesto_id: string;
  partida_catalogo_id: string | null;
  codigo: string | null;
  descripcion: string;
  capitulo: string | null;
  unidad: string;
  cantidad: number;
  precio_compra: number;
  pvp: number;
  margen_pct: number;
  descuento_pct: number;
  orden: number;
  created_at: string;
}

export interface PresupuestoConPartidas extends Presupuesto {
  partidas: PresupuestoPartida[];
}

// =====================================================================
// CÁLCULOS
// =====================================================================

export interface PartidaCalculada {
  total_bruto: number;
  descuento_partida: number;
  total_neto: number;
  coste_real: number;
  beneficio: number;
}

export function calcularPartida(p: Pick<PresupuestoPartida, 'cantidad' | 'pvp' | 'precio_compra' | 'descuento_pct'>): PartidaCalculada {
  const total_bruto = (p.cantidad || 0) * (p.pvp || 0);
  const descuento_partida = total_bruto * ((p.descuento_pct || 0) / 100);
  const total_neto = total_bruto - descuento_partida;
  const coste_real = (p.cantidad || 0) * (p.precio_compra || 0);
  const beneficio = total_neto - coste_real;
  return { total_bruto, descuento_partida, total_neto, coste_real, beneficio };
}

export interface PresupuestoTotales {
  subtotal_bruto: number;
  total_descuentos_partidas: number;
  subtotal_neto: number;
  descuento_global: number;
  base_imponible: number;
  coste_total: number;
  beneficio_total: number;
  margen_real_pct: number;
}

export function calcularPresupuesto(
  partidas: Array<Pick<PresupuestoPartida, 'cantidad' | 'pvp' | 'precio_compra' | 'descuento_pct'>>,
  descuento_global_pct: number
): PresupuestoTotales {
  let subtotal_bruto = 0;
  let total_descuentos_partidas = 0;
  let coste_total = 0;
  for (const p of partidas) {
    const c = calcularPartida(p);
    subtotal_bruto += c.total_bruto;
    total_descuentos_partidas += c.descuento_partida;
    coste_total += c.coste_real;
  }
  const subtotal_neto = subtotal_bruto - total_descuentos_partidas;
  const descuento_global = subtotal_neto * ((descuento_global_pct || 0) / 100);
  const base_imponible = subtotal_neto - descuento_global;
  const beneficio_total = base_imponible - coste_total;
  const margen_real_pct = base_imponible > 0 ? (beneficio_total / base_imponible) * 100 : 0;
  return {
    subtotal_bruto,
    total_descuentos_partidas,
    subtotal_neto,
    descuento_global,
    base_imponible,
    coste_total,
    beneficio_total,
    margen_real_pct,
  };
}

export function formatEUR(n: number): string {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n || 0);
}

export function formatNumber(n: number, decimals = 2): string {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n || 0);
}
