/**
 * Mock visual llavero / tarjeta NFC (misma geometría que "Visualizar" en tienda).
 */
(function (global) {
  const MOCKS = {
    llavero: {
      a: '/assets/productos/llavero-nfc-a.jpg',
      b: '/assets/productos/llavero-nfc-b.jpg',
    },
    tarjeta: {
      a: '/assets/productos/tarjeta-nfc-a.jpg',
      b: '/assets/productos/tarjeta-nfc-b.jpg',
    },
  };

  function productKind(slug, nombre) {
    const blob = `${slug || ''} ${nombre || ''}`.toLowerCase();
    return blob.includes('tarjet') ? 'tarjeta' : 'llavero';
  }

  function isNfcProduct(slug, nombre) {
    const blob = `${slug || ''} ${nombre || ''}`.toLowerCase();
    return blob.includes('nfc') || blob.includes('llavero') || blob.includes('tarjet');
  }

  function mockBaseSrc(kind, side) {
    const k = kind === 'tarjeta' ? 'tarjeta' : 'llavero';
    const s = side === 'b' ? 'b' : 'a';
    return MOCKS[k][s];
  }

  /** Misma ventana que `.perso-mock__photo` en CSS (Visualizar / taller) */
  const PRINT_GEO = {
    llavero: { mockW: 1024, mockH: 1024, left: 0.333, top: 0.457, width: 0.33, height: 0.33, shape: 'circle' },
    tarjeta: { mockW: 1280, mockH: 720, left: 0.085, top: 0.27, width: 0.46, height: 0.46, shape: 'round', radiusPx: 10 },
  };

  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('No se pudo cargar la imagen'));
      img.src = src;
    });
  }

  function drawCover(ctx, img, dx, dy, dw, dh) {
    const scale = Math.max(dw / img.width, dh / img.height);
    const sw = dw / scale;
    const sh = dh / scale;
    const sx = (img.width - sw) / 2;
    const sy = (img.height - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
  }

  function clipRoundRect(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    ctx.lineTo(x + rad, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
    ctx.lineTo(x, y + rad);
    ctx.quadraticCurveTo(x, y, x + rad, y);
    ctx.closePath();
    ctx.clip();
  }

  /**
   * Recorte idéntico a Visualizar (object-fit: cover en la ventana del mock).
   * @param {string} photoUrl
   * @param {'llavero'|'tarjeta'|string} kind
   * @param {number} [outPx=600]
   * @returns {Promise<string>} data URL PNG
   */
  async function renderPrintCrop(photoUrl, kind, outPx = 600) {
    const k = kind === 'tarjeta' ? 'tarjeta' : 'llavero';
    const g = PRINT_GEO[k];
    const img = await loadImage(photoUrl);
    const rw = g.width * g.mockW;
    const rh = g.height * g.mockH;
    const canvas = document.createElement('canvas');
    canvas.width = outPx;
    canvas.height = Math.max(1, Math.round(outPx * (rh / rw)));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas no disponible');

    if (g.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outPx / 2, canvas.height / 2, Math.min(outPx, canvas.height) / 2, 0, Math.PI * 2);
      ctx.clip();
    } else {
      const r = (g.radiusPx / rw) * outPx;
      clipRoundRect(ctx, 0, 0, outPx, canvas.height, r);
    }
    drawCover(ctx, img, 0, 0, outPx, canvas.height);
    return canvas.toDataURL('image/png');
  }

  /**
   * @param {{ kind: string, side: 'a'|'b', photoUrl?: string, caption?: string }} opts
   */
  function renderMockFigure(opts) {
    const kind = opts.kind === 'tarjeta' ? 'tarjeta' : 'llavero';
    const side = opts.side === 'b' ? 'b' : 'a';
    const cap = opts.caption || (side === 'a' ? 'Lado A' : 'Lado B');
    const photo = opts.photoUrl || '';
    const photoHidden = photo ? '' : ' hidden';
    const photoSrc = photo ? ` src="${photo.replace(/"/g, '&quot;')}"` : '';
    return `
      <figure class="perso-mock perso-mock--${kind}" data-vista="${side}">
        <div class="perso-mock__frame">
          <img class="perso-mock__base" alt="" src="${mockBaseSrc(kind, side)}" />
          <img class="perso-mock__photo"${photoSrc} alt="${cap}"${photoHidden} />
        </div>
        <figcaption>${cap}</figcaption>
      </figure>`;
  }

  global.PersoMock = {
    MOCKS,
    PRINT_GEO,
    productKind,
    isNfcProduct,
    mockBaseSrc,
    renderMockFigure,
    renderPrintCrop,
  };
})(window);
