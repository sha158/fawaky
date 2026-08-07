import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);

const frameCount = 240;
const images = [];
let loadedCount = 0;

let currentFrame = 1;
let targetFrame = 1;
const lerpFactor = 0.15;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let lastFrame = -1;
let looping = false;

const canvas = document.getElementById('animation-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const scrollContainer = document.getElementById('scroll-container');

function framePath(i) {
  return `/ice-apple-hero/frame-${String(i).padStart(3, '0')}.jpg`;
}

function preload(onProgress, onDone) {
  for (let i = 1; i <= frameCount; i++) {
    const img = new Image();
    img.src = framePath(i);
    img.onload = img.onerror = () => {
      loadedCount++;
      onProgress(loadedCount / frameCount);
      if (loadedCount === frameCount) onDone();
    };
    images.push(img);
  }
}

// Canvas section removed — skip 240-frame preload, dismiss immediately
{
  const el = document.getElementById('preloader');
  if (el) {
    el.classList.add('fade-out');
    setTimeout(() => { el.classList.add('hidden'); initApp(); }, 700);
  } else {
    initApp();
  }
}

function resizeCanvas() {
  canvas.width  = window.innerWidth  * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  drawFrame(Math.round(currentFrame));
}

function drawFrame(idx) {
  if (!canvas || !ctx) return;
  if (idx === lastFrame) return;
  lastFrame = idx;
  const img = images[idx - 1];
  if (img && img.complete && img.naturalWidth) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const r  = Math.max(canvas.width / img.width, canvas.height / img.height);
    const nw = img.width  * r;
    const nh = img.height * r;
    ctx.drawImage(img, (canvas.width - nw) / 2, (canvas.height - nh) / 2, nw, nh);
  }
}

function getScrollFraction() {
  const rect = scrollContainer.getBoundingClientRect();
  const frac = -rect.top / (rect.height - window.innerHeight);
  return Math.max(0, Math.min(1, frac));
}

function tick() {
  if (reducedMotion) {
    currentFrame = targetFrame;
    looping = false;
    drawFrame(Math.round(currentFrame));
    return;
  }
  const diff = targetFrame - currentFrame;
  if (Math.abs(diff) < 0.05) {
    currentFrame = targetFrame;
    looping = false;
  } else {
    currentFrame += diff * lerpFactor;
    requestAnimationFrame(tick);
  }
  drawFrame(Math.round(currentFrame));
}

/* ─── Word splitter ──────────────────────────────────────── */
function splitWords(el) {
  const text = el.textContent.trim();
  el.innerHTML = text.split(' ').map(w =>
    `<span class="sw" style="display:inline-block;overflow:hidden;vertical-align:bottom">` +
    `<span class="sw-i" style="display:inline-block">${w}</span></span>`
  ).join(' ');
  return el.querySelectorAll('.sw-i');
}

/* ─── Story scrollytelling (CSS-sticky + scrubbed GSAP timeline) ─── */
function initStory() {
  const section = document.getElementById('story');
  if (!section) return;

  const card  = section.querySelector('.sty-card');
  const glow  = section.querySelector('.sty-glow');
  const track = section.querySelector('.sty-track');
  const orbit = section.querySelector('.sty-orbit');
  const chips = section.querySelectorAll('.sty-chip');
  const bridge   = section.querySelector('.sty-bridge');
  const cardWrap = section.querySelector('.sty-card-wrap');
  const p = (n) => section.querySelector(`.sty-panel--${n}`);

  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const maxRot = isMobile ? 3 : 8;
  const r = (deg) => gsap.utils.clamp(-maxRot, maxRot, deg);

  // a11y: hide later panels from AT only in animated/overlap mode
  [2, 3, 4, 5, 6].forEach((n) => p(n).setAttribute('aria-hidden', 'true'));
  section.classList.add('sty-on');
  gsap.set(p(1), { opacity: 1 });
  p(1).classList.add('is-active');

  // Calories scene (now panel 2): count-up proxies driven by the scrub timeline (not
  // inView — the pinned panel is always "in view"). HTML holds final values for no-JS/reduced.
  const statEls = Array.from(p(2).querySelectorAll('.sty-stat-num'));
  const stats = statEls.map((el) => ({
    el,
    target: parseFloat(el.dataset.count) || 0,
    suffix: el.dataset.countSuffix || '',
    proxy: { v: 0 }
  }));
  statEls.forEach((el) => { el.textContent = '0' + (el.dataset.countSuffix || ''); });

  const tl = gsap.timeline({
    defaults: { ease: 'power2.out' },
    scrollTrigger: { trigger: track, start: 'top top', end: 'bottom bottom', scrub: 1.5 }
  });

  // Card overall arc — continuous scale/rotate across all 6 steps (5 segments)
  tl.fromTo(card, { scale: 0.96, rotationZ: r(-2), rotationY: 0 },
                  { scale: 1.02, rotationZ: 0, rotationY: r(4), duration: 1.15 }, 0)
    .to(card, { scale: 1.06, rotationZ: r(1.5), rotationY: r(-3), duration: 1.15 }, 1.15)
    .to(card, { scale: 1.10, rotationZ: r(-1), rotationY: r(4), duration: 1.15 }, 2.30)
    .to(card, { scale: 1.13, rotationZ: r(1), rotationY: r(-2), duration: 1.15 }, 3.45)
    .to(card, { scale: 1.15, rotationZ: 0, rotationY: 0, duration: 1.15 }, 4.60);

  // Bridge label: fade in during intro, out before the card story begins
  if (bridge) {
    tl.fromTo(bridge, { opacity: 0, y: 10 }, { opacity: 0.55, y: 0, duration: 0.5 }, 0.05)
      .to(bridge, { opacity: 0, y: -10, duration: 0.5 }, 0.85);
  }

  // 1 → 2 (intro out → "What Goes In" card in, with staggered benefit callouts)
  tl.to(p(1), { opacity: 0, y: -40, scale: 0.96, duration: 0.6 }, 0.9)
    .fromTo(p(2), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6 }, 0.95)
    // benefit callouts rise in staggered (translateY 50→0, 0.1s stagger, power2.out)
    .fromTo(p(2).querySelectorAll('.sty-bene'),
            { opacity: 0, y: 50 },
            { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: 'power2.out' }, 1.0);
  stats.forEach((s) => {
    tl.fromTo(s.proxy, { v: 0 }, {
      v: s.target, duration: 0.8, ease: 'power1.out', snap: { v: 1 },
      onUpdate: () => { s.el.textContent = Math.round(s.proxy.v) + s.suffix; }
    }, 0.95);
  });
  // exact landing for the counters at the tail of scene 2
  tl.add(() => { stats.forEach((s) => { s.el.textContent = Math.round(s.target) + s.suffix; }); }, 1.75);

  // 2 → 3 (FRUIT)
  tl.to(p(2), { opacity: 0, y: -40, duration: 0.6 }, 1.9)
    .fromTo(p(3), { opacity: 0, y: 40 }, { opacity: 1, y: 0, duration: 0.6 }, 1.95)
    .fromTo(p(3).querySelector('img'), { scale: 0.8, rotation: -4 }, { scale: 1, rotation: 0, duration: 0.7 }, 2.0);

  // 3 → 4 (ORBIT — chips fan out + rotate)
  tl.to(p(3), { opacity: 0, y: -40, duration: 0.6 }, 2.9)
    .fromTo(p(4), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 2.95)
    .fromTo(chips, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, stagger: 0.08 }, 3.0)
    .to(orbit, { rotation: 18, ease: 'none', duration: 0.9 }, 3.05);

  // 4 → 5 (dramatic free-floating can reveal)
  tl.to([p(4), ...chips], { opacity: 0, scale: 0.9, duration: 0.6 }, 3.9)
    .fromTo(p(5), { opacity: 0 }, { opacity: 1, duration: 0.6 }, 3.95)
    .fromTo(p(5).querySelector('img'),
            { scale: 0.7, y: 30, opacity: 0 },
            { scale: 1.05, y: 0, opacity: 1, duration: 0.8, ease: 'back.out(1.3)' }, 4.0);

  // 5 → 6 (expand + glow + CTA finale)
  tl.to(p(5), { opacity: 0, y: -30, duration: 0.6 }, 4.9)
    .add(() => card.classList.toggle('sty-expanded', tl.progress() > 0.86), 4.95)
    .fromTo(p(6), { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 0.6 }, 4.95)
    .to(glow, { scale: 1.25, opacity: 1, duration: 0.9 }, 4.95)
    .fromTo(p(6).querySelector('.sty-cta'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.5 }, 5.2);

  // Card entry — one-time, on the WRAP (opacity/translateY/scale) so it never fights
  // the scrub transform on .sty-card. Premium, no bounce.
  if (cardWrap) {
    gsap.fromTo(cardWrap,
      { opacity: 0, y: 80, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: 1.0, ease: 'power2.out', overwrite: 'auto',
        scrollTrigger: { trigger: section, start: 'top 75%', once: true } });
  }

  // Interactive 3D / AR can — activates only at the story's final beat (lazy-loaded).
  // model-viewer's default touch-action: pan-y lets vertical page-scroll pass through,
  // so the pinned section never traps touch; horizontal drag rotates the can.
  const viewer = document.getElementById('sty-3d-viewer');
  const stage3d = document.getElementById('sty-3d');
  if (viewer && stage3d) {
    const MODEL_SRC = 'https://modelviewer.dev/shared-assets/models/Astronaut.glb'; // TODO: swap to /assets/can.glb
    let libLoaded = false, live = false;
    const set3D = (on) => {
      if (on === live) return;
      live = on;
      stage3d.classList.toggle('is-live', on);
      stage3d.setAttribute('aria-hidden', String(!on));
      if (on) {
        if (!libLoaded) {
          libLoaded = true;
          import('@google/model-viewer').then(() => { viewer.src = MODEL_SRC; });
        }
        if (!reducedMotion) viewer.setAttribute('auto-rotate', '');
      } else {
        viewer.removeAttribute('auto-rotate');
      }
    };
    ScrollTrigger.create({
      trigger: track, start: 'top top', end: 'bottom bottom',
      onUpdate: (self) => set3D(self.progress > 0.9)
    });
  }

  refreshStoryWhenReady(section);
  ScrollTrigger.refresh();
}

function refreshStoryWhenReady(section) {
  const imgs = Array.from(section.querySelectorAll('img'));
  let pending = imgs.length;
  if (!pending) { ScrollTrigger.refresh(); return; }
  const done = () => { if (--pending <= 0) ScrollTrigger.refresh(); };
  imgs.forEach((img) => {
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
}

/* ─── Main animations ────────────────────────────────────── */
function initAnimations() {
  if (reducedMotion) return;

  const ease = 'power3.out';

  /* §0 STORY */
  initStory();

  /* §1 PRODUCT HERO */
  const heroHeading  = document.querySelector('.ls-hero-heading');
  const heroSub      = document.querySelector('.ls-hero-sub');
  const canImg       = document.querySelector('.ls-can-img');
  const heroCta      = document.querySelector('.ls-hero-cta-row');
  const taglineStrip = document.querySelector('.ls-tagline-strip');
  const heroBg       = document.querySelector('.ls-product-hero .ls-parallax-bg');

  if (heroBg) {
    gsap.fromTo(heroBg, { yPercent: -10 }, {
      yPercent: 10, ease: 'none',
      scrollTrigger: { trigger: '.ls-product-hero', start: 'top bottom', end: 'bottom top', scrub: 1.5 }
    });
  }

  if (heroHeading) {
    const words = splitWords(heroHeading);
    gsap.from(words, {
      scrollTrigger: { trigger: heroHeading, start: 'top 85%' },
      y: 56, opacity: 0, duration: 0.9, stagger: 0.09, ease
    });
  }

  if (heroSub) {
    gsap.from(heroSub, {
      scrollTrigger: { trigger: heroSub, start: 'top 88%' },
      y: 28, opacity: 0, duration: 0.7, delay: 0.3, ease
    });
  }

  if (heroCta) {
    gsap.from(Array.from(heroCta.children), {
      scrollTrigger: { trigger: heroCta, start: 'top 90%' },
      y: 20, opacity: 0, duration: 0.6, stagger: 0.12, delay: 0.5, ease
    });
  }

  if (canImg) {
    gsap.from(canImg, {
      scrollTrigger: { trigger: canImg, start: 'top 90%' },
      y: 80, rotation: -8, opacity: 0, duration: 1.1, ease: 'power4.out',
      onComplete: () => canImg.classList.add('floating')
    });

    gsap.to(canImg, {
      scrollTrigger: {
        trigger: '.ls-product-hero',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5
      },
      y: -60, ease: 'none'
    });
  }

  if (taglineStrip) {
    gsap.from(taglineStrip, {
      scrollTrigger: { trigger: taglineStrip, start: 'top 95%' },
      y: 20, opacity: 0, duration: 0.6, ease
    });
  }

  /* §3 BESTSELLER */
  const bsImg     = document.querySelector('.ls-bestseller-img');
  const bsContent = document.querySelector('.ls-bestseller-content');

  if (bsImg) {
    gsap.from(bsImg, {
      scrollTrigger: { trigger: bsImg, start: 'top 88%' },
      x: 80, opacity: 0, duration: 1.0, ease   // image now on the right → slide in from right
    });
  }

  if (bsContent) {
    gsap.from(Array.from(bsContent.children), {
      scrollTrigger: { trigger: bsContent, start: 'top 88%' },
      x: -60, opacity: 0, duration: 0.85, stagger: 0.10, ease   // content now on the left
    });
  }

  /* §6 FEATURED SHOWCASE */
  const showcaseCan  = document.querySelector('.ls-showcase-can');
  const showcaseCopy = document.querySelector('.ls-showcase-copy');
  const showFloats   = document.querySelectorAll('.ls-showcase .ls-float');

  if (showcaseCan) {
    gsap.from(showcaseCan, {
      scrollTrigger: { trigger: '.ls-showcase', start: 'top 80%' },
      y: 80, scale: 0.9, opacity: 0, duration: 1.1, ease: 'power4.out'
    });
  }
  if (showcaseCopy) {
    gsap.from(Array.from(showcaseCopy.children), {
      scrollTrigger: { trigger: '.ls-showcase', start: 'top 78%' },
      y: 36, opacity: 0, duration: 0.8, stagger: 0.12, delay: 0.2, ease
    });
  }
  showFloats.forEach((el, i) => {
    gsap.to(el, {
      scrollTrigger: {
        trigger: '.ls-showcase', start: 'top bottom', end: 'bottom top', scrub: 1.5
      },
      y: i === 0 ? -110 : -60, ease: 'none'
    });
  });

  /* §1.5 ICE APPLE BENEFITS — hero band reveal + glow parallax.
     (The bento tiles, support cards and heading are .ls-ingr-tile / .ls-ingredients .ls-heading,
      so they're already revealed by the §7 INGREDIENTS block below — only the hero band is added here.) */
  const ia = document.querySelector('.ls-ia');
  if (ia) {
    const iaMobile = window.matchMedia('(max-width: 768px)').matches;
    const iaDY     = iaMobile ? 0.55 : 1;
    const iaImg    = ia.querySelector('.ls-ia-hero-img');
    const iaCopy   = ia.querySelectorAll('.ls-ia-hero-copy .ls-tag, .ls-ia-subtext, .ls-ia-statement');
    const iaGlow   = ia.querySelector('.ls-ia-glow');

    const iaTl = gsap.timeline({
      defaults: { ease },
      scrollTrigger: { trigger: ia, start: 'top 78%', once: true }
    });
    if (iaImg) iaTl.from(iaImg, { y: 80 * iaDY, scale: 0.92, opacity: 0, duration: 1.0, ease: 'power4.out' });
    if (iaCopy.length) iaTl.from(iaCopy, { y: 40 * iaDY, opacity: 0, duration: 0.6, stagger: 0.12 }, '-=0.45');

    if (!iaMobile && iaGlow) {
      gsap.fromTo(iaGlow, { yPercent: -8 }, {
        yPercent: 8, ease: 'none',
        scrollTrigger: { trigger: ia, start: 'top bottom', end: 'bottom top', scrub: 1.5 }
      });
    }
  }

  /* §7 INGREDIENTS */
  const ingrHead  = document.querySelector('.ls-ingredients .ls-heading');
  const ingrTiles = document.querySelectorAll('.ls-ingr-tile');

  if (ingrHead) {
    gsap.from(ingrHead, {
      scrollTrigger: { trigger: ingrHead, start: 'top 85%' },
      clipPath: 'inset(0 100% 0 0)', opacity: 0, duration: 0.9, ease: 'power3.inOut'
    });
  }

  if (ingrTiles.length) {
    const tileAnims = [{ x: -60 }, { scale: 0.85 }, { x: 60 }, { y: 60 }, { scale: 0.85 }];
    ingrTiles.forEach((tile, i) => {
      gsap.from(tile, {
        scrollTrigger: { trigger: tile, start: 'top 90%' },
        ...tileAnims[i % 5],
        opacity: 0, duration: 0.9, delay: i * 0.08, ease: 'power3.out'
      });
    });
  }

  /* BENEFITS STRIP */
  const benefitBadges = gsap.utils.toArray('.ls-benefit-badge');
  if (benefitBadges.length) {
    gsap.from(benefitBadges, {
      scrollTrigger: { trigger: '.ls-benefits-strip', start: 'top 88%' },
      y: 30, opacity: 0, duration: 0.6, stagger: 0.1, ease
    });
  }

  /* WHY ICE APPLE */
  const whyIaImg = document.querySelector('.ls-why-ia-img');
  if (whyIaImg) {
    gsap.fromTo(whyIaImg, { yPercent: -6 }, {
      yPercent: 6, ease: 'none',
      scrollTrigger: { trigger: '.ls-why-ia', start: 'top bottom', end: 'bottom top', scrub: 1.5 }
    });
    gsap.from('.ls-why-ia-copy > *', {
      scrollTrigger: { trigger: '.ls-why-ia-copy', start: 'top 85%' },
      y: 40, opacity: 0, duration: 0.85, stagger: 0.1, ease
    });
  }
  const whyCards = gsap.utils.toArray('.ls-why-ia-grid .ls-why-card');
  if (whyCards.length) {
    gsap.from(whyCards, {
      scrollTrigger: { trigger: '.ls-why-ia-grid', start: 'top 88%' },
      y: 50, opacity: 0, duration: 0.8, stagger: 0.1, ease
    });
  }

  /* INGREDIENT HIGHLIGHTS */
  const ingrHlCards = gsap.utils.toArray('.ls-ingr-hl .ls-ingr-tile');
  if (ingrHlCards.length) {
    gsap.from('.ls-ingr-hl-header > *', {
      scrollTrigger: { trigger: '.ls-ingr-hl-header', start: 'top 88%' },
      y: 30, opacity: 0, duration: 0.7, stagger: 0.1, ease
    });
    gsap.from(ingrHlCards, {
      scrollTrigger: { trigger: '.ls-ingr-hl-grid', start: 'top 88%' },
      y: 50, opacity: 0, duration: 0.85, stagger: 0.12, ease
    });
  }

  /* TRUST SECTION */
  const trustItems = gsap.utils.toArray('.ls-trust-item');
  if (trustItems.length) {
    gsap.from('.ls-trust-copy > *', {
      scrollTrigger: { trigger: '.ls-trust', start: 'top 85%' },
      y: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease
    });
    gsap.from(trustItems, {
      scrollTrigger: { trigger: '.ls-trust-list', start: 'top 88%' },
      x: -30, opacity: 0, duration: 0.6, stagger: 0.08, ease
    });
  }

  /* §8 SEASONAL */
  const seasonalInner = document.querySelector('.ls-seasonal-inner');
  if (seasonalInner) {
    gsap.from(Array.from(seasonalInner.children), {
      scrollTrigger: { trigger: seasonalInner, start: 'top 88%' },
      y: 40, opacity: 0, duration: 0.75, stagger: 0.12, ease
    });
  }

  /* §9 REELS */
  const reels = document.querySelectorAll('.ls-reel');
  if (reels.length) {
    gsap.from(reels, {
      scrollTrigger: { trigger: '.ls-reels-track', start: 'top 85%' },
      x: 60, opacity: 0, duration: 0.7, stagger: 0.08, ease
    });
  }

  /* §10 SOCIAL GRID */
  const socialTiles = document.querySelectorAll('.ls-social-tile');
  if (socialTiles.length) {
    gsap.from(socialTiles, {
      scrollTrigger: { trigger: socialTiles[0], start: 'top 88%' },
      y: 50, opacity: 0, scale: 0.88, duration: 0.65, stagger: 0.07, ease: 'back.out(1.2)'
    });
  }

  /* §7 REVIEWS */
  const reviewCards = document.querySelectorAll('.ls-review-card');
  if (reviewCards.length) {
    reviewCards.forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 90%' },
        x: i % 2 === 0 ? -40 : 40,
        opacity: 0, duration: 0.8, delay: i * 0.12, ease
      });
    });
  }

  /* §8 WHOLESALE */
  const wholesaleInner = document.querySelector('.ls-wholesale-inner');
  if (wholesaleInner) {
    gsap.from(Array.from(wholesaleInner.children), {
      scrollTrigger: { trigger: wholesaleInner, start: 'top 88%' },
      y: 36, opacity: 0, duration: 0.75, stagger: 0.10, ease
    });
  }

  /* ABOUT (light) */
  const aboutImg  = document.querySelector('.ls-about-img');
  const aboutCopy = document.querySelector('.ls-about-copy');
  if (aboutImg) {
    gsap.from(aboutImg, {
      scrollTrigger: { trigger: '.ls-about', start: 'top 82%' },
      x: -60, opacity: 0, duration: 1.0, ease
    });
  }
  if (aboutCopy) {
    gsap.from(Array.from(aboutCopy.children), {
      scrollTrigger: { trigger: '.ls-about', start: 'top 80%' },
      y: 32, opacity: 0, duration: 0.8, stagger: 0.1, ease
    });
  }

  /* FAQ */
  const faqItems = document.querySelectorAll('.ls-faq-item');
  if (faqItems.length) {
    gsap.from(faqItems, {
      scrollTrigger: { trigger: '.ls-faq-list', start: 'top 88%' },
      y: 30, opacity: 0, duration: 0.6, stagger: 0.08, ease
    });
  }

  /* §9 FOOTER */
  const footerBrand = document.querySelector('.ls-footer-brand');
  const footerNavs  = document.querySelectorAll('.ls-footer-nav a');
  const footerCopy  = document.querySelector('.ls-footer-copy');

  if (footerBrand) {
    gsap.from(footerBrand, {
      scrollTrigger: { trigger: footerBrand, start: 'top 92%' },
      y: 24, scale: 0.92, opacity: 0, duration: 0.7, ease
    });
  }

  if (footerNavs.length) {
    gsap.from(footerNavs, {
      scrollTrigger: { trigger: footerNavs[0], start: 'top 92%' },
      y: 16, opacity: 0, duration: 0.5, stagger: 0.06, delay: 0.15, ease
    });
  }

  if (footerCopy) {
    gsap.from(footerCopy, {
      scrollTrigger: { trigger: footerCopy, start: 'top 95%' },
      opacity: 0, duration: 0.5, delay: 0.3, ease
    });
  }
}

function initMobileNav() {
  const btnMenu   = document.getElementById('btn-menu');
  const mobileNav = document.getElementById('mobile-nav');
  if (!btnMenu || !mobileNav) return;

  btnMenu.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    btnMenu.classList.toggle('open', open);
    btnMenu.setAttribute('aria-expanded', String(open));
  });

  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      btnMenu.classList.remove('open');
      btnMenu.setAttribute('aria-expanded', 'false');
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      mobileNav.classList.remove('open');
      btnMenu.classList.remove('open');
      btnMenu.setAttribute('aria-expanded', 'false');
    }
  });
}

/* Hero text overlay — additive: crossfades two lines over the canvas by scroll
   position. Does NOT touch the canvas animation (reads its own rect). */
function initHeroOverlay() {
  const line1 = document.querySelector('.hero-line-1');
  const line2 = document.querySelector('.hero-line-2');
  const cta   = document.querySelector('.hero-cta');
  if (!line1 || !line2 || !scrollContainer) return;

  // opacity ramp: 0 outside [inStart,outEnd], in over [inStart,inEnd], hold, out over [outStart,outEnd]
  const ramp = (f, inStart, inEnd, outStart, outEnd) => {
    if (f <= inStart || f >= outEnd) return 0;
    if (f < inEnd) return (f - inStart) / (inEnd - inStart);
    if (f <= outStart) return 1;
    return 1 - (f - outStart) / (outEnd - outStart);
  };

  const apply = (el, op, winStart, winEnd, f) => {
    el.style.opacity = op.toFixed(3);
    const p = Math.max(0, Math.min(1, (f - winStart) / (winEnd - winStart)));
    el.style.transform = `translateY(${((p - 0.5) * -36).toFixed(1)}px)`;
  };

  const update = () => {
    const rect = scrollContainer.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, -rect.top / (rect.height - window.innerHeight)));
    const o1 = ramp(f, -1, 0, 0.34, 0.45);   // line 1 full at the top, then fades
    apply(line1, o1, 0, 0.45, f);
    apply(line2, ramp(f, 0.52, 0.62, 0.88, 1.0), 0.52, 1.0, f);
    if (cta) {                                // CTA shares line 1's visibility (centering preserved)
      cta.style.opacity = o1.toFixed(3);
      cta.style.pointerEvents = o1 > 0.5 ? 'auto' : 'none';
    }
  };

  update();
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
}

/* Reels — interim behaviour: open Instagram until real video is wired in. */
function initReels() {
  const reels = document.querySelectorAll('.ls-reel');
  reels.forEach((reel) => {
    reel.addEventListener('click', () => {
      window.open('https://www.instagram.com/naturalsfawaky', '_blank', 'noopener');
    });
  });
}

/* Nav scroll-spy — highlight the header link for the section in view. */
function initScrollSpy() {
  const links = Array.from(document.querySelectorAll('.site-header nav a[href^="#"]'));
  const map = new Map();
  links.forEach((a) => {
    const sec = document.getElementById(a.getAttribute('href').slice(1));
    if (sec) map.set(sec, a);
  });
  if (!map.size) return;
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      links.forEach((l) => l.classList.remove('nav-active'));
      const a = map.get(e.target);
      if (a) a.classList.add('nav-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
  map.forEach((_, sec) => obs.observe(sec));
}

function initApp() {
  resizeCanvas();
  drawFrame(1);
  window.addEventListener('resize', resizeCanvas);

  window.addEventListener('scroll', () => {
    const frac = getScrollFraction();
    targetFrame = Math.round(frac * (frameCount - 1)) + 1;
    if (!looping) { looping = true; requestAnimationFrame(tick); }
  }, { passive: true });

  initMobileNav();
  initReels();
  initHeroOverlay();
  initScrollSpy();
  initStickyCta();
  initAnimations();
  import('./motion-fx.js').then((m) => m.default());
}

/* Mobile sticky WhatsApp CTA — reveal only once the user reaches the ending stretch
   (from #reviews onward), not from the hero. CSS gates it to ≤768px. */
function initStickyCta() {
  const cta = document.querySelector('.ls-sticky-cta');
  const trigger = document.getElementById('reviews');
  if (!cta || !trigger) return;
  const update = () => {
    const triggerTop = trigger.getBoundingClientRect().top + window.scrollY;
    const reached = (window.scrollY + window.innerHeight) > (triggerTop + 80);
    cta.classList.toggle('is-revealed', reached);
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}
