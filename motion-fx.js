import { animate, scroll, inView } from 'motion';

/* ───────────────────────────────────────────────────────────
   Motion FX — additive interaction layer (motion.dev, vanilla).
   Complements the GSAP scroll reveals; never touches the hero
   canvas animation. Fully gated behind prefers-reduced-motion.
   ─────────────────────────────────────────────────────────── */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer   = window.matchMedia('(pointer: fine)').matches;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/* §1 Scroll progress bar ──────────────────────────────────── */
function initProgressBar() {
  const bar = document.getElementById('scroll-prog');
  if (!bar) return;
  scroll((progress) => {
    bar.style.transform = `scaleX(${progress})`;
  });
}

/* §2 Frosted header on scroll ──────────────────────────────── */
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  if (!header) return;
  const threshold = () => window.innerHeight * 0.6;
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > threshold());
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

/* §3 Magnetic CTAs (pointer-fine only) ─────────────────────── */
function magnetic(el, strength = 0.32, max = 11) {
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const x = clamp((e.clientX - (r.left + r.width / 2)) * strength, -max, max);
    const y = clamp((e.clientY - (r.top + r.height / 2)) * strength, -max, max);
    animate(el, { x, y }, { duration: 0.3, ease: 'easeOut' });
  });
  el.addEventListener('mouseleave', () => {
    animate(el, { x: 0, y: 0 }, { type: 'spring', stiffness: 150, damping: 12 });
  });
}

function initMagnetic() {
  if (!finePointer) return;
  document
    .querySelectorAll('.ls-btn-whatsapp, .btn-buy, .ls-btn-outline, .ls-btn-instagram')
    .forEach((el) => magnetic(el));
}

/* §4 Card tilt + cursor spotlight (pointer-fine only) ──────── */
function tilt(el, maxDeg = 6) {
  el.addEventListener('mousemove', (e) => {
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;   // 0..1
    const py = (e.clientY - r.top) / r.height;   // 0..1
    el.style.setProperty('--mx', (px * 100).toFixed(1) + '%');
    el.style.setProperty('--my', (py * 100).toFixed(1) + '%');
    animate(
      el,
      { rotateX: (0.5 - py) * 2 * maxDeg, rotateY: (px - 0.5) * 2 * maxDeg },
      { duration: 0.2, ease: 'easeOut' }
    );
  });
  el.addEventListener('mouseleave', () => {
    animate(el, { rotateX: 0, rotateY: 0 }, { type: 'spring', stiffness: 200, damping: 18 });
  });
}

function initTilt() {
  if (!finePointer) return;
  document.querySelectorAll('.ls-card, .ls-review-card').forEach((el) => {
    el.classList.add('tilt-3d');
    tilt(el);
  });
  // Story card: tilt the INNER wrapper so it composes with (never overwrites)
  // the GSAP-scrubbed transform on the outer .sty-card.
  document.querySelectorAll('.sty-card-inner').forEach((el) => {
    el.classList.add('tilt-3d');
    tilt(el, 5);
  });
}

/* §5 Clean-label marquee ───────────────────────────────────── */
function initMarquee() {
  const track = document.querySelector('.ls-marquee-track');
  if (!track) return;
  animate(track, { x: ['0%', '-50%'] }, { duration: 24, repeat: Infinity, ease: 'linear' });
}

/* §6 Stat count-up (real numbers only) ─────────────────────── */
function initCounters() {
  // Exclude #story stats — those are driven by the scrub timeline in initStory(),
  // not inView (the pinned panel is always "in view").
  document.querySelectorAll('[data-count]:not(.sty-stat-num):not(.sty-mix-val)').forEach((el) => {
    const target = parseFloat(el.dataset.count);
    if (Number.isNaN(target)) return;
    let done = false;
    inView(
      el,
      () => {
        if (done) return;
        done = true;
        el.textContent = '0'; // count visibly up from 0 (motion on); HTML keeps final value for no-JS/reduced
        animate(0, target, {
          duration: 1.6,
          ease: 'easeOut',
          onUpdate: (v) => { el.textContent = Math.round(v); },
        });
      },
      { amount: 0.6 }
    );
  });
}

/* §7 Scroll-reveal — CSS-class-based staggered entrance
   Only targets new sections GSAP doesn't already handle.           */
function initScrollReveal() {
  const groups = [
    { parent: '.ls-why-cards-grid', child: '.ls-why-card' },
    { parent: '.ls-lifestyle-grid', child: '.ls-lifestyle-card' },
    { parent: '.ls-stats-grid',     child: '.ls-stat-item' },
    { parent: '.ls-faq-list',       child: '.ls-faq-item' },
  ];

  const allEls = [];
  groups.forEach(({ parent, child }) => {
    document.querySelectorAll(parent).forEach((grid) => {
      const children = Array.from(grid.querySelectorAll(child));
      children.forEach((el, i) => {
        el.classList.add('sr-hidden');
        el.style.transitionDelay = `${i * 70}ms`;
        allEls.push(el);
      });
    });
  });
  if (!allEls.length) return;

  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('sr-visible');
      obs.unobserve(entry.target);
    });
  }, { threshold: 0.12 });

  allEls.forEach((el) => obs.observe(el));
}

/* §8 FAQ accordion (custom button/div replace <details>) ────── */
function initFaqAccordion() {
  document.querySelectorAll('.ls-faq-q').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = btn.closest('.ls-faq-item');
      const isOpen = item.classList.contains('is-open');
      // Collapse all
      document.querySelectorAll('.ls-faq-item.is-open').forEach((i) => {
        i.classList.remove('is-open');
        i.querySelector('.ls-faq-q').setAttribute('aria-expanded', 'false');
      });
      // Toggle clicked
      if (!isOpen) {
        item.classList.add('is-open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
}

/* ─── Entry ─────────────────────────────────────────────────── */
function initVideoHero() {
  const videoDesktop = document.getElementById('vh-video');
  const videoMobile  = document.getElementById('vh-video-mobile');
  const content = document.querySelector('.vh-content');

  function forcePlay(v) {
    if (!v) return;
    v.play().catch(() => {
      setTimeout(() => v.play().catch(() => {}), 300);
    });
  }

  // The two videos are orientation-matched, and both ship with preload="none"
  // and no autoplay. Only the one this viewport shows gets opted into loading,
  // so the other file is never fetched.
  function activate() {
    const isMobile = window.innerWidth <= 768;
    const active = isMobile ? videoMobile : videoDesktop;
    const idle   = isMobile ? videoDesktop : videoMobile;

    if (!active) return;
    if (idle) idle.pause();

    if (active.preload !== 'auto') active.preload = 'auto';
    forcePlay(active);
  }

  activate();

  // Crossing the 768px breakpoint reveals a video that has never loaded.
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(activate, 200);
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') activate();
  });

  if (typeof gsap !== 'undefined' && content) {
    gsap.from('.vh-heading',  { opacity: 0, y: 28, duration: 1,   ease: 'power3.out', delay: 0.2  });
    gsap.from('.vh-tagline',  { opacity: 0, y: 20, duration: 1,   ease: 'power3.out', delay: 0.35 });
    gsap.from('.vh-cta-row',  { opacity: 0, y: 16, duration: 0.8, ease: 'power3.out', delay: 0.7  });
  }
}

export default function initMotionFx() {
  // Header frost + progress bar are subtle and useful even with
  // reduced motion off; the rest is gated below.
  initHeaderScroll();
  initFaqAccordion();   // accordion works regardless of reduced motion
  initVideoHero();
  if (reducedMotion) return;
  initProgressBar();
  initMagnetic();
  initTilt();
  initMarquee();
  initCounters();
  initScrollReveal();
}
