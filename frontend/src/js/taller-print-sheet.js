/**
 * Hoja gang de taller: rejilla continua + cursor en localStorage para reutilizar hoja física.
 */
(function (global) {
  const STORAGE_KEY = 'umg_taller_gang_cursor_v1';
  const GRID_COLS = 5;
  const CELL_W_MM = 30;
  const CELL_H_MM = 29;
  const GAP_MM = 8;
  const COL_STRIDE_MM = CELL_W_MM + GAP_MM;
  const ROW_STRIDE_MM = CELL_H_MM + GAP_MM;

  function readCursor() {
    try {
      const n = parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10);
      return Number.isFinite(n) && n >= 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  function writeCursor(n) {
    try {
      localStorage.setItem(STORAGE_KEY, String(Math.max(0, n)));
    } catch { /* noop */ }
  }

  function resetCursor() {
    writeCursor(0);
  }

  /** Desplazamiento en mm (misma lógica individual y lote; sin celdas fantasma). */
  function gridOffsetStyle(start) {
    const col0 = start % GRID_COLS;
    const row0 = Math.floor(start / GRID_COLS);
    return {
      paddingTop: `${row0 * ROW_STRIDE_MM}mm`,
      paddingLeft: `${col0 * COL_STRIDE_MM}mm`,
    };
  }

  function applyGridOffset(sheet, start) {
    if (!sheet) return;
    const off = gridOffsetStyle(start);
    sheet.style.paddingTop = off.paddingTop;
    sheet.style.paddingLeft = off.paddingLeft;
    sheet.style.paddingRight = '0';
    sheet.style.paddingBottom = '0';
    sheet.style.margin = '0';
  }

  function appendCell(sheet, entry) {
    const kind = entry.kind === 'tarjeta' ? 'tarjeta' : 'llavero';
    const cell = document.createElement('div');
    cell.className = 'taller-gang__cell taller-gang__cell--' + kind;

    const img = document.createElement('img');
    img.src = entry.dataUrl;
    img.className = 'taller-gang__img taller-gang__img--' + kind;
    img.alt = '';
    cell.appendChild(img);

    if (entry.codigo) {
      const lab = document.createElement('span');
      lab.className = 'taller-gang__label';
      lab.textContent = entry.codigo + (entry.side ? ` · ${entry.side}` : '');
      cell.appendChild(lab);
    }

    sheet.appendChild(cell);
  }

  /**
   * @param {HTMLElement} sheet
   * @param {Array<{ kind: string, photoSrc: string, codigo?: string, side?: string }>} jobs
   * @returns {Promise<number>}
   */
  async function fillGangSheet(sheet, jobs) {
    if (!sheet || !global.PersoMock?.renderPrintCrop) return 0;

    const cursor = readCursor();
    sheet.innerHTML = '';
    applyGridOffset(sheet, cursor);

    let placed = 0;
    for (const job of jobs) {
      if (!job.photoSrc) continue;
      const kind = job.kind === 'tarjeta' ? 'tarjeta' : 'llavero';
      try {
        const dataUrl = await global.PersoMock.renderPrintCrop(job.photoSrc, kind);
        appendCell(sheet, {
          kind,
          dataUrl,
          codigo: job.codigo,
          side: job.side,
        });
        placed += 1;
      } catch (err) {
        console.warn('[taller gang sheet]', err);
      }
    }
    return placed;
  }

  function commitPrint(placedCount) {
    if (placedCount > 0) {
      writeCursor(readCursor() + placedCount);
    }
  }

  function estimateGridHint() {
    const cursor = readCursor();
    return {
      cursor,
      cols: GRID_COLS,
      row: Math.floor(cursor / GRID_COLS) + 1,
      col: (cursor % GRID_COLS) + 1,
    };
  }

  function printPageStyles() {
    return `
@page { size: A4 portrait; margin: 10mm; }
*, *::before, *::after { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  width: auto;
  height: auto;
  min-height: 0;
}
.taller-gang-sheet {
  display: grid;
  grid-template-columns: repeat(${GRID_COLS}, ${CELL_W_MM}mm);
  column-gap: ${GAP_MM}mm;
  row-gap: ${GAP_MM}mm;
  justify-content: start;
  align-content: start;
  justify-items: start;
  width: max-content;
  margin: 0;
  box-sizing: border-box;
}
.taller-gang__cell {
  width: ${CELL_W_MM}mm;
  height: ${CELL_H_MM}mm;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  overflow: hidden;
  page-break-inside: avoid;
  text-align: center;
}
.taller-gang__img {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  display: block;
  flex: 0 0 auto;
  object-fit: contain;
}
.taller-gang__img--llavero { width: 24mm; height: 24mm; }
.taller-gang__img--tarjeta { max-width: 28mm; max-height: 22mm; width: auto; height: auto; }
.taller-gang__label {
  display: block;
  width: ${CELL_W_MM}mm;
  font-size: 5.5pt;
  line-height: 1.15;
  margin-top: 0.5mm;
  color: #333;
  font-family: ui-monospace, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}`;
  }

  function printGangSheet(sheetEl) {
    return new Promise((resolve, reject) => {
      if (!sheetEl?.innerHTML?.trim()) {
        reject(new Error('No hay contenido para imprimir.'));
        return;
      }

      const iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'Impresión taller UMG');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:0;top:0';
      document.body.appendChild(iframe);

      const win = iframe.contentWindow;
      const doc = win?.document;
      if (!win || !doc) {
        iframe.remove();
        reject(new Error('No se pudo preparar la impresión en este navegador.'));
        return;
      }

      const padTop = sheetEl.style.paddingTop || '0';
      const padLeft = sheetEl.style.paddingLeft || '0';
      const markup = `<div class="taller-gang-sheet" style="padding-top:${padTop};padding-left:${padLeft}">${sheetEl.innerHTML}</div>`;

      doc.open();
      doc.write(
        '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>UMG Taller</title>'
        + `<style>${printPageStyles()}</style></head><body>${markup}</body></html>`
      );
      doc.close();

      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        iframe.remove();
        resolve();
      };

      win.addEventListener('afterprint', finish, { once: true });

      const runPrint = () => {
        try {
          win.focus();
          win.print();
        } catch (err) {
          finish();
          reject(err);
        }
      };

      const imgs = Array.from(doc.querySelectorAll('img'));
      if (!imgs.length) {
        setTimeout(runPrint, 150);
      } else {
        let pending = imgs.length;
        const tick = () => {
          pending -= 1;
          if (pending <= 0) setTimeout(runPrint, 150);
        };
        imgs.forEach((img) => {
          if (img.complete) tick();
          else {
            img.addEventListener('load', tick, { once: true });
            img.addEventListener('error', tick, { once: true });
          }
        });
      }

      setTimeout(finish, 120000);
    });
  }

  global.TallerPrintSheet = {
    readCursor,
    writeCursor,
    resetCursor,
    fillGangSheet,
    commitPrint,
    estimateGridHint,
    printGangSheet,
    gridOffsetStyle,
    GRID_COLS,
    STORAGE_KEY,
  };
})(window);
