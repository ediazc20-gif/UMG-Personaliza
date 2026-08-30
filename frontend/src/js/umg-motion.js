/**

 * Motion — Hostinger craft, Impeccable product rules

 * - Shop/login only for decorative motion

 * - No elastic/bounce; 150–250ms state feedback

 * - Content visible by default (no opacity gating)

 */

(function () {

  if (typeof gsap === 'undefined') return;



  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var isShop = document.body.classList.contains('umg-app--shop');



  try {

    if (typeof ScrollTrigger !== 'undefined') {

      gsap.registerPlugin(ScrollTrigger);

    }

  } catch (_) { /* noop */ }



  function safe(fn, name) {

    try { fn(); } catch (e) { console.warn('[umg-motion]', name, e); }

  }



  if (reduced) return;



  safe(function initShopReveals() {

    if (!isShop) return;

    var hero = document.querySelector('.shop-hero .reveal');

    if (hero) {

      gsap.from(hero, { opacity: 0.92, y: 16, duration: 0.45, ease: 'power2.out' });

    }

    var cards = document.querySelectorAll('.product-glass');

    if (!cards.length) return;

    gsap.from(cards, {

      opacity: 0.94,

      y: 12,

      duration: 0.35,

      stagger: 0.05,

      ease: 'power2.out',

      delay: 0.08,

    });

  }, 'shopReveals');



  safe(function initMagnetic() {

    if (!isShop) return;

    document.querySelectorAll('.btn-magnetic').forEach(function (btn) {

      btn.addEventListener('mousemove', function (e) {

        var r = btn.getBoundingClientRect();

        var x = (e.clientX - r.left - r.width / 2) * 0.12;

        var y = (e.clientY - r.top - r.height / 2) * 0.12;

        gsap.to(btn, { x: x, y: y, duration: 0.2, ease: 'power2.out' });

      });

      btn.addEventListener('mouseleave', function () {

        gsap.to(btn, { x: 0, y: 0, duration: 0.25, ease: 'power2.out' });

      });

    });

  }, 'magnetic');



  safe(function initHeroFloat() {

    if (!isShop || !document.querySelector('.shop-float-card')) return;

    gsap.to('.shop-float-card', {

      y: -8,

      duration: 3.2,

      repeat: -1,

      yoyo: true,

      ease: 'sine.inOut',

      stagger: { each: 0.35, from: 'random' },

    });

  }, 'heroFloat');

})();

