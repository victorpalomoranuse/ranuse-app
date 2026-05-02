// PDF generator profesional para presupuestos Ranuse
// Usa jsPDF + jspdf-autotable. A4, márgenes profesionales, logo del usuario.
// Importar dinámicamente desde el editor.

import { calcularPartida, calcularCapitulo, calcularPresupuesto, formatEUR } from '@/lib/presupuestos';

const COLOR_NEGRO = [10, 10, 10];
const COLOR_CHAMPAGNE = [190, 176, 162];
const COLOR_GRIS = [120, 120, 120];
const COLOR_GRIS_CLARO = [200, 200, 200];

// Cargar imagen como base64 para jsPDF
async function loadImageAsBase64(url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: reader.result, type: blob.type });
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('No se pudo cargar el logo:', e);
    return null;
  }
}

export async function generarPDF({ jsPDF, autoTable, presupuesto, capitulos, partidas, settings, totales }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

  // A4: 210 x 297 mm
  const PAGE_W = 210;
  const PAGE_H = 297;
  const MARGIN_X = 18;
  const MARGIN_TOP = 18;
  const MARGIN_BOTTOM = 18;
  const CONTENT_W = PAGE_W - MARGIN_X * 2;

  // Cargar logo si existe
  let logoData = null;
  if (settings?.logo_url) {
    logoData = await loadImageAsBase64(settings.logo_url);
  }

  let cursorY = MARGIN_TOP;

  // ================ HEADER ================
  // Logo a la izquierda
  if (logoData) {
    try {
      const isPng = logoData.type.includes('png');
      const isJpg = logoData.type.includes('jpeg') || logoData.type.includes('jpg');
      const fmt = isPng ? 'PNG' : (isJpg ? 'JPEG' : 'PNG');
      doc.addImage(logoData.data, fmt, MARGIN_X, cursorY, 28, 18, undefined, 'FAST');
    } catch (e) {
      console.warn('Error añadiendo logo:', e);
    }
  } else {
    // Placeholder texto
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(18);
    doc.setTextColor(...COLOR_NEGRO);
    doc.text(settings?.nombre_comercial || 'RANUSE DESIGN', MARGIN_X, cursorY + 8);
  }

  // Datos empresa a la derecha
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_NEGRO);

  const empresaLines = [];
  if (settings?.razon_social) empresaLines.push(settings.razon_social);
  if (settings?.cif) empresaLines.push('CIF ' + settings.cif);
  if (settings?.direccion) empresaLines.push(settings.direccion);
  const cpCiudad = [settings?.codigo_postal, settings?.ciudad, settings?.provincia].filter(Boolean).join(' · ');
  if (cpCiudad) empresaLines.push(cpCiudad);
  if (settings?.telefono) empresaLines.push(settings.telefono);
  if (settings?.email) empresaLines.push(settings.email);
  if (settings?.web) empresaLines.push(settings.web);

  let lineY = cursorY + 4;
  empresaLines.forEach(line => {
    doc.text(line, PAGE_W - MARGIN_X, lineY, { align: 'right' });
    lineY += 3.5;
  });

  cursorY = Math.max(cursorY + 22, lineY + 2);

  // Línea separadora
  doc.setDrawColor(...COLOR_NEGRO);
  doc.setLineWidth(0.3);
  doc.line(MARGIN_X, cursorY, PAGE_W - MARGIN_X, cursorY);
  cursorY += 8;

  // ================ DATOS DEL PRESUPUESTO ================
  // Cliente a la izquierda
  doc.setFontSize(7);
  doc.setTextColor(...COLOR_CHAMPAGNE);
  doc.text('CLIENTE', MARGIN_X, cursorY);

  doc.setFontSize(13);
  doc.setTextColor(...COLOR_NEGRO);
  doc.setFont('helvetica', 'bold');
  doc.text(presupuesto.cliente_nombre || '', MARGIN_X, cursorY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  let clientLineY = cursorY + 10;
  if (presupuesto.cliente_cif) { doc.text(presupuesto.cliente_cif, MARGIN_X, clientLineY); clientLineY += 4; }
  if (presupuesto.cliente_direccion) { doc.text(presupuesto.cliente_direccion, MARGIN_X, clientLineY); clientLineY += 4; }
  const cpCiudadCli = [presupuesto.cliente_codigo_postal, presupuesto.cliente_ciudad].filter(Boolean).join(' · ');
  if (cpCiudadCli) { doc.text(cpCiudadCli, MARGIN_X, clientLineY); clientLineY += 4; }
  if (presupuesto.cliente_email) { doc.text(presupuesto.cliente_email, MARGIN_X, clientLineY); clientLineY += 4; }
  if (presupuesto.cliente_telefono) { doc.text(presupuesto.cliente_telefono, MARGIN_X, clientLineY); clientLineY += 4; }

  // Bloque número de presupuesto a la derecha (caja negra)
  const boxW = 70;
  const boxH = 28;
  const boxX = PAGE_W - MARGIN_X - boxW;
  const boxY = cursorY - 1;
  doc.setFillColor(...COLOR_NEGRO);
  doc.rect(boxX, boxY, boxW, boxH, 'F');

  doc.setTextColor(...COLOR_CHAMPAGNE);
  doc.setFontSize(7);
  doc.text('PRESUPUESTO', boxX + 5, boxY + 6);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(presupuesto.numero, boxX + 5, boxY + 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  const fechaFmt = new Date(presupuesto.fecha).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(fechaFmt, boxX + 5, boxY + 19);

  const validoHasta = new Date(presupuesto.fecha);
  validoHasta.setDate(validoHasta.getDate() + (presupuesto.validez_dias || 30));
  const validoHastaFmt = validoHasta.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.setFontSize(7);
  doc.setTextColor(180, 180, 180);
  doc.text('Válido hasta ' + validoHastaFmt, boxX + 5, boxY + 24);

  cursorY = Math.max(clientLineY + 4, boxY + boxH + 8);

  // ================ TABLA DE CAPÍTULOS Y PARTIDAS ================
  const head = [['Cód.', 'Descripción', 'Cant.', 'Precio', 'Dto.', 'Importe']];

  for (const cap of capitulos) {
    const partidasCap = partidas.filter(p => p.capitulo_id === cap.id).sort((a, b) => a.orden - b.orden);
    if (partidasCap.length === 0) continue;
    const totCap = calcularCapitulo(partidasCap);

    const body = [];
    // Fila de cabecera del capítulo
    body.push([
      { content: cap.nombre.toUpperCase(), colSpan: 5, styles: { fillColor: [245, 241, 236], textColor: COLOR_NEGRO, fontStyle: 'bold', fontSize: 9, cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } } },
      { content: formatEUR(totCap.subtotal_neto), styles: { fillColor: [245, 241, 236], textColor: COLOR_NEGRO, fontStyle: 'bold', fontSize: 9, halign: 'right', cellPadding: { top: 2, bottom: 2, left: 3, right: 3 } } },
    ]);

    for (const item of partidasCap) {
      const c = calcularPartida(item);
      body.push([
        item.codigo || '',
        item.descripcion,
        `${Number(item.cantidad).toFixed(2)} ${item.unidad || ''}`,
        formatEUR(item.pvp),
        item.descuento_pct > 0 ? `${Number(item.descuento_pct).toFixed(0)}%` : '—',
        formatEUR(c.total_neto),
      ]);
    }

    autoTable(doc, {
      startY: cursorY,
      head: head,
      body: body,
      theme: 'plain',
      margin: { left: MARGIN_X, right: MARGIN_X, bottom: MARGIN_BOTTOM + 10 },
      headStyles: {
        fillColor: false, textColor: COLOR_CHAMPAGNE, fontStyle: 'bold', fontSize: 7,
        cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
        lineWidth: { bottom: 0.4 }, lineColor: COLOR_NEGRO,
      },
      bodyStyles: {
        fontSize: 8.5, textColor: COLOR_NEGRO,
        cellPadding: { top: 2.5, bottom: 2.5, left: 3, right: 3 },
        lineWidth: { bottom: 0.1 }, lineColor: [220, 220, 220],
      },
      columnStyles: {
        0: { cellWidth: 16, fontStyle: 'normal', textColor: [120, 120, 120], fontSize: 7.5 },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 22, halign: 'right' },
        3: { cellWidth: 22, halign: 'right' },
        4: { cellWidth: 14, halign: 'right' },
        5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.row.index === 0 && data.section === 'body') {
          // Fila cabecera capítulo
          if (data.cell.colSpan === 5) {
            data.cell.styles.fillColor = [245, 241, 236];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      showHead: 'firstPage',
    });

    cursorY = doc.lastAutoTable.finalY + 4;
  }

  cursorY += 4;

  // Si no queda mucho espacio, salto de página antes de los totales
  if (cursorY > PAGE_H - MARGIN_BOTTOM - 60) {
    doc.addPage();
    cursorY = MARGIN_TOP;
  }

  // ================ BLOQUE DE TOTALES ================
  const totBoxW = 80;
  const totBoxX = PAGE_W - MARGIN_X - totBoxW;
  let totLineY = cursorY;

  doc.setFontSize(9);
  doc.setTextColor(...COLOR_NEGRO);
  doc.setFont('helvetica', 'normal');

  doc.text('Subtotal', totBoxX, totLineY);
  doc.text(formatEUR(totales.subtotal_neto), totBoxX + totBoxW, totLineY, { align: 'right' });
  totLineY += 5;

  if (totales.descuento_global > 0) {
    doc.setFontSize(8);
    doc.setTextColor(...COLOR_GRIS);
    doc.text(`Descuento ${presupuesto.descuento_global_pct}%`, totBoxX, totLineY);
    doc.text(`− ${formatEUR(totales.descuento_global)}`, totBoxX + totBoxW, totLineY, { align: 'right' });
    totLineY += 5;
  }

  // Línea separadora
  doc.setDrawColor(...COLOR_NEGRO);
  doc.setLineWidth(0.5);
  doc.line(totBoxX, totLineY, totBoxX + totBoxW, totLineY);
  totLineY += 5;

  // TOTAL
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(...COLOR_NEGRO);
  doc.text('TOTAL', totBoxX, totLineY);
  doc.text(formatEUR(totales.base_imponible), totBoxX + totBoxW, totLineY, { align: 'right' });
  totLineY += 4;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text('Importes sin IVA. IVA aplicable en factura.', totBoxX + totBoxW, totLineY, { align: 'right' });

  cursorY = totLineY + 10;

  // ================ SECCIONES INFORMATIVAS ================
  const secciones = [];
  if (presupuesto.formas_pago) secciones.push({ titulo: 'Formas de pago', contenido: presupuesto.formas_pago });
  if (presupuesto.notas) secciones.push({ titulo: 'Notas', contenido: presupuesto.notas });
  if (presupuesto.condiciones) secciones.push({ titulo: 'Condiciones', contenido: presupuesto.condiciones });
  if (settings?.iban) {
    const banco = settings.banco ? `${settings.banco} · ` : '';
    secciones.push({ titulo: 'Datos bancarios', contenido: banco + settings.iban });
  }

  for (const sec of secciones) {
    // Salto de página si es necesario
    if (cursorY > PAGE_H - MARGIN_BOTTOM - 30) {
      doc.addPage();
      cursorY = MARGIN_TOP;
    }

    // Caja con borde izquierdo champagne
    const linesText = doc.splitTextToSize(sec.contenido, CONTENT_W - 8);
    const boxHeight = 6 + linesText.length * 4 + 4;

    doc.setFillColor(250, 249, 247);
    doc.rect(MARGIN_X, cursorY, CONTENT_W, boxHeight, 'F');
    doc.setFillColor(...COLOR_CHAMPAGNE);
    doc.rect(MARGIN_X, cursorY, 1, boxHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_CHAMPAGNE);
    doc.text(sec.titulo.toUpperCase(), MARGIN_X + 4, cursorY + 4.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_NEGRO);
    doc.text(linesText, MARGIN_X + 4, cursorY + 9);

    cursorY += boxHeight + 4;
  }

  // ================ FOOTER en cada página ================
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Línea
    doc.setDrawColor(...COLOR_CHAMPAGNE);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_X, PAGE_H - 12, PAGE_W - MARGIN_X, PAGE_H - 12);

    // Texto footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...COLOR_GRIS);
    const footerLeft = (settings?.nombre_comercial || 'RANUSE DESIGN').toUpperCase();
    doc.text(footerLeft, MARGIN_X, PAGE_H - 8);

    if (totalPages > 1) {
      doc.text(`${i} / ${totalPages}`, PAGE_W / 2, PAGE_H - 8, { align: 'center' });
    }

    const footerRight = [settings?.web, settings?.email].filter(Boolean).join(' · ');
    if (footerRight) doc.text(footerRight, PAGE_W - MARGIN_X, PAGE_H - 8, { align: 'right' });
  }

  // Guardar
  doc.save(`${presupuesto.numero}.pdf`);
}
