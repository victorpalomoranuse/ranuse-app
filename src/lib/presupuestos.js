// Cálculos compartidos para presupuestos
// Importar desde: import { calcularPartida, calcularCapitulo, calcularPresupuesto, formatEUR } from '@/lib/presupuestos';

export function calcularPartida(p) {
  const total_bruto = (Number(p.cantidad) || 0) * (Number(p.pvp) || 0);
  const descuento_partida = total_bruto * ((Number(p.descuento_pct) || 0) / 100);
  const total_neto = total_bruto - descuento_partida;
  const coste_real = (Number(p.cantidad) || 0) * (Number(p.precio_compra) || 0);
  const beneficio = total_neto - coste_real;
  return { total_bruto, descuento_partida, total_neto, coste_real, beneficio };
}

export function calcularCapitulo(partidas) {
  let subtotal_bruto = 0;
  let descuentos = 0;
  let coste = 0;
  for (const p of partidas) {
    const c = calcularPartida(p);
    subtotal_bruto += c.total_bruto;
    descuentos += c.descuento_partida;
    coste += c.coste_real;
  }
  const subtotal_neto = subtotal_bruto - descuentos;
  return { subtotal_bruto, descuentos, subtotal_neto, coste, beneficio: subtotal_neto - coste };
}

export function calcularPresupuesto(partidas, descuento_global_pct) {
  const cap = calcularCapitulo(partidas);
  const descuento_global = cap.subtotal_neto * ((Number(descuento_global_pct) || 0) / 100);
  const base_imponible = cap.subtotal_neto - descuento_global;
  const beneficio_total = base_imponible - cap.coste;
  const margen_real_pct = base_imponible > 0 ? (beneficio_total / base_imponible) * 100 : 0;
  return {
    subtotal_bruto: cap.subtotal_bruto,
    total_descuentos_partidas: cap.descuentos,
    subtotal_neto: cap.subtotal_neto,
    descuento_global,
    base_imponible,
    coste_total: cap.coste,
    beneficio_total,
    margen_real_pct,
  };
}

export function formatEUR(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(Number(n) || 0);
}

export function formatNumber(n, decimals = 2) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(Number(n) || 0);
}
