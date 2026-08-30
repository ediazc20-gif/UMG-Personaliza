/**
 * Demo animada: flujo tienda UMG Personaliza (panel login).
 */
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const pipeline = document.getElementById('demoPipeline');
  const cmdLines = document.querySelectorAll('.cmd-line');
  const cmdLabel = document.getElementById('demoCmdLabel');
  const compileStatus = document.getElementById('demoCompileStatus');
  const productIcon = document.getElementById('demoProductIcon');
  const productName = document.getElementById('demoProductName');
  const productDesc = document.getElementById('demoProductDesc');
  const productPrice = document.getElementById('demoProductPrice');
  const tracking = document.getElementById('demoTracking');
  if (!pipeline || !cmdLines.length) return;

  const STEPS = [
    {
      phase: 0,
      line: 0,
      status: 'Explorando catalogo…',
      order: 'UMG-A1B2C3',
      product: { icon: '<i class="fas fa-shirt"></i>', name: 'Playera UMG Fan', desc: 'Algodon 100% · personalizable', price: 'Q99.00' },
      track: 0,
    },
    {
      phase: 1,
      line: 1,
      status: 'Aplicando foto y filtros…',
      order: 'UMG-A1B2C3',
      product: { icon: '<i class="fas fa-palette"></i>', name: 'Playera UMG Fan', desc: 'Lado A: foto · Lado B: tu mensaje', price: 'Q99.00' },
      track: 0,
    },
    {
      phase: 2,
      line: 2,
      status: 'Checkout — efectivo al recibir',
      order: 'UMG-X7K9M2',
      product: { icon: '<i class="fas fa-bag-shopping"></i>', name: 'Carrito (1 item)', desc: 'Entrega: Cancha principal', price: 'Q99.00' },
      track: 1,
    },
    {
      phase: 3,
      line: 2,
      status: 'Pedido confirmado',
      order: 'UMG-X7K9M2',
      product: { icon: '<i class="fas fa-box"></i>', name: 'Orden en camino', desc: 'QR listo para entrega en campus', price: 'Q99.00' },
      track: 2,
    },
  ];

  const PHASE_BUSY = ['Cargando productos…', 'Personalizando diseño…', 'Procesando pago…', 'Actualizando tracking…'];
  const STEP_MS = 3800;
  const COMPILE_MS = 2000;

  let stepIdx = 0;
  let phaseIdx = 0;
  let compileTimer = null;
  let stepTimer = null;

  function setPipelinePhase(n) {
    pipeline.querySelectorAll('.pipe-step').forEach(function (el) {
      el.classList.toggle('is-active', Number(el.dataset.phase) === n);
    });
  }

  function setStatus(busy, msg) {
    if (!compileStatus) return;
    compileStatus.classList.toggle('is-busy', busy);
    compileStatus.innerHTML = busy
      ? '<i class="fas fa-spinner"></i> ' + msg
      : '<i class="fas fa-circle-check"></i> ' + msg;
  }

  function highlightLine(index) {
    cmdLines.forEach(function (line, i) {
      line.classList.toggle('is-running', i === index);
    });
  }

  function updateTracking(activeIndex) {
    if (!tracking) return;
    tracking.querySelectorAll('.shop-track-step').forEach(function (el, i) {
      el.classList.toggle('is-done', i < activeIndex);
      el.classList.toggle('is-active', i === activeIndex);
    });
  }

  function applyStep(i) {
    const s = STEPS[i];
    setPipelinePhase(s.phase);
    highlightLine(s.line);
    if (productIcon) productIcon.innerHTML = s.product.icon;
    if (productName) productName.textContent = s.product.name;
    if (productDesc) productDesc.textContent = s.product.desc;
    if (productPrice) productPrice.textContent = s.product.price;
    updateTracking(s.track);
    if (cmdLabel) {
      cmdLabel.classList.add('is-changing');
      setTimeout(function () {
        cmdLabel.textContent = s.order;
        cmdLabel.classList.remove('is-changing');
      }, 120);
    }
  }

  function runPhaseThenStep(targetPhase, then) {
    phaseIdx = 0;
    setStatus(true, PHASE_BUSY[targetPhase] || 'Cargando…');
    clearInterval(compileTimer);
    compileTimer = setInterval(function () {
      setPipelinePhase(Math.min(phaseIdx, targetPhase));
      phaseIdx++;
      if (phaseIdx > targetPhase) {
        clearInterval(compileTimer);
        setStatus(false, STEPS[stepIdx].status);
        if (then) then();
      }
    }, COMPILE_MS / (targetPhase + 1));
  }

  function cycle() {
    applyStep(stepIdx);
    runPhaseThenStep(STEPS[stepIdx].phase, function () {
      stepIdx = (stepIdx + 1) % STEPS.length;
    });
  }

  setPipelinePhase(0);
  setTimeout(function () {
    cycle();
    stepTimer = setInterval(cycle, STEP_MS);
  }, 600);
})();
