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
const ctx = canvas.getContext('2d');
const scrollContainer = document.getElementById('scroll-container');

function framePath(i) {
  return `/ezgif-3c102d3f51ab7516-jpg/ezgif-frame-${String(i).padStart(3, '0')}.jpg`;
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

preload(
  (p) => {
    const pct = Math.round(p * 100);
    document.getElementById('preloader-progress').style.width = pct + '%';
    document.getElementById('preloader-percentage').textContent = pct + '%';
  },
  () => {
    const el = document.getElementById('preloader');
    el.classList.add('fade-out');
    setTimeout(() => { el.classList.add('hidden'); initApp(); }, 700);
  }
);

function resizeCanvas() {
  canvas.width  = window.innerWidth  * window.devicePixelRatio;
  canvas.height = window.innerHeight * window.devicePixelRatio;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  drawFrame(Math.round(currentFrame));
}

function drawFrame(idx) {
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

/* ─── Main animations ────────────────────────────────────── */
function initAnimations() {
  if (reducedMotion) return;

  const ease = 'power3.out';

  /* §1 PRODUCT HERO */
  const heroHeading  = document.querySelector('.ls-hero-heading');
  const heroSub      = document.querySelector('.ls-hero-sub');
  const canImg       = document.querySelector('.ls-can-img');
  const heroCta      = document.querySelector('.ls-hero-cta-row');
  const taglineStrip = document.querySelector('.ls-tagline-strip');

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

  /* §2 FLAVORS */
  const flavorsHead = document.querySelector('.ls-flavors .ls-heading');
  const flavorsSub  = document.querySelector('.ls-flavors .ls-subtext');
  const cards       = document.querySelectorAll('.ls-card');

  if (flavorsHead) {
    gsap.from(flavorsHead, {
      scrollTrigger: { trigger: flavorsHead, start: 'top 85%' },
      clipPath: 'inset(0 100% 0 0)', opacity: 0, duration: 0.9, ease: 'power3.inOut'
    });
  }

  if (flavorsSub) {
    gsap.from(flavorsSub, {
      scrollTrigger: { trigger: flavorsSub, start: 'top 88%' },
      y: 20, opacity: 0, duration: 0.6, delay: 0.2, ease
    });
  }

  if (cards.length) {
    const origins = [
      { x: -60, rotation: -4 }, { y: 70 }, { x: 60, rotation: 4 }, { y: 70 }
    ];
    cards.forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 92%' },
        ...origins[i % 4],
        opacity: 0, duration: 0.85, delay: i * 0.10, ease: 'back.out(1.4)'
      });
    });
  }

  /* §3 BESTSELLER */
  const bsImg     = document.querySelector('.ls-bestseller-img');
  const bsContent = document.querySelector('.ls-bestseller-content');

  if (bsImg) {
    gsap.from(bsImg, {
      scrollTrigger: { trigger: bsImg, start: 'top 88%' },
      x: -80, opacity: 0, duration: 1.0, ease
    });
  }

  if (bsContent) {
    gsap.from(Array.from(bsContent.children), {
      scrollTrigger: { trigger: bsContent, start: 'top 88%' },
      x: 60, opacity: 0, duration: 0.85, stagger: 0.10, ease
    });
  }

  /* §4 INGREDIENTS */
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

  /* §5 SEASONAL */
  const seasonalInner = document.querySelector('.ls-seasonal-inner');
  if (seasonalInner) {
    gsap.from(Array.from(seasonalInner.children), {
      scrollTrigger: { trigger: seasonalInner, start: 'top 88%' },
      y: 40, opacity: 0, duration: 0.75, stagger: 0.12, ease
    });
  }

  /* §6 SOCIAL GRID */
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
  initAnimations();
  import('./motion-fx.js').then((m) => m.default());
}
