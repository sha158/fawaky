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

function drawImageCover(ctx, img, x, y, w, h) {
  const r  = Math.max(w / img.width, h / img.height);
  const nw = img.width  * r;
  const nh = img.height * r;
  ctx.drawImage(img, (img.width - nw / r) / 2, (img.height - nh / r) / 2,
    img.width - (img.width - nw / r), img.height - (img.height - nh / r),
    x + (w - nw) / 2, y + (h - nh) / 2, nw, nh);
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

function initScrollReveal() {
  const els = document.querySelectorAll('.section-inner, .feature, .stat-row');
  els.forEach(el => el.classList.add('reveal'));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        if (!reducedMotion) {
          setTimeout(() => entry.target.classList.add('visible'), i * 60);
        } else {
          entry.target.classList.add('visible');
        }
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => io.observe(el));
}

function countUp(el, target, suffix, duration) {
  if (reducedMotion) { el.textContent = target + suffix; return; }
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(eased * target) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function initStatCounters() {
  const stats = [
    { selector: '.stat-row:nth-child(1) .stat-num', target: 100, suffix: '%' },
    { selector: '.stat-row:nth-child(2) .stat-num', target: 0,   suffix: '%' },
    { selector: '.stat-row:nth-child(3) .stat-num', target: 200, suffix: 'ml' },
  ];

  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const stat = stats.find(s => entry.target.matches(s.selector));
        if (stat) countUp(entry.target, stat.target, stat.suffix, 1200);
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.5 });

  stats.forEach(s => {
    const el = document.querySelector(s.selector);
    if (el) io.observe(el);
  });
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

  /* 1. PRODUCT INTRO ---------------------------------------- */
  const introHeading = document.querySelector('.ls-product-intro .ls-heading');
  const introSub     = document.querySelector('.ls-product-intro .ls-subtext');
  const canImg       = document.querySelector('.ls-can-img');

  if (introHeading) {
    const words = splitWords(introHeading);
    gsap.from(words, {
      scrollTrigger: { trigger: introHeading, start: 'top 85%' },
      y: 48, opacity: 0, duration: 0.8, stagger: 0.08, ease
    });
  }

  if (introSub) {
    gsap.from(introSub, {
      scrollTrigger: { trigger: introSub, start: 'top 88%' },
      y: 28, opacity: 0, duration: 0.7, delay: 0.3, ease
    });
  }

  if (canImg) {
    gsap.from(canImg, {
      scrollTrigger: { trigger: canImg, start: 'top 90%' },
      y: 80, rotation: -8, opacity: 0, duration: 1.1, ease: 'power4.out',
      onComplete: () => canImg.classList.add('floating')
    });

    // Parallax drift on scroll
    gsap.to(canImg, {
      scrollTrigger: {
        trigger: '.ls-product-intro',
        start: 'top bottom',
        end: 'bottom top',
        scrub: 1.5
      },
      y: -60, ease: 'none'
    });
  }

  /* 2. FLAVORS SECTION -------------------------------------- */
  const flavorsHead = document.querySelector('.ls-flavors .ls-heading');
  const flavorsSub  = document.querySelector('.ls-flavors .ls-subtext');
  const cards       = document.querySelectorAll('.ls-card');

  if (flavorsHead) {
    gsap.from(flavorsHead, {
      scrollTrigger: { trigger: flavorsHead, start: 'top 85%' },
      clipPath: 'inset(0 100% 0 0)',
      opacity: 0, duration: 0.9, ease: 'power3.inOut'
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
      { x: -80, rotation: -5 },
      { y:  80, rotation:  0 },
      { x:  80, rotation:  5 }
    ];
    cards.forEach((card, i) => {
      gsap.from(card, {
        scrollTrigger: { trigger: card, start: 'top 90%' },
        ...origins[i % 3],
        opacity: 0, duration: 0.85,
        delay: i * 0.15,
        ease: 'back.out(1.4)'
      });
    });
  }

  /* 3. BENEFITS BENTO --------------------------------------- */
  const bentoHead = document.querySelector('.ls-benefits .ls-heading');
  const bentoSub  = document.querySelector('.ls-benefits .ls-subtext');
  const tiles     = document.querySelectorAll('.ls-tile');

  if (bentoHead) {
    gsap.from(bentoHead, {
      scrollTrigger: { trigger: bentoHead, start: 'top 85%' },
      clipPath: 'inset(0 100% 0 0)',
      opacity: 0, duration: 0.9, ease: 'power3.inOut'
    });
  }

  if (bentoSub) {
    gsap.from(bentoSub, {
      scrollTrigger: { trigger: bentoSub, start: 'top 88%' },
      y: 20, opacity: 0, duration: 0.6, delay: 0.2, ease
    });
  }

  if (tiles.length) {
    const tileAnims = [
      { x: -60 },           // wide — from left
      { scale: 0.82 },      // dark — scale up
      { x:  60 },           // — from right
      { y:  60 }            // wide — from below
    ];
    tiles.forEach((tile, i) => {
      gsap.from(tile, {
        scrollTrigger: { trigger: tile, start: 'top 88%' },
        ...tileAnims[i % 4],
        opacity: 0, duration: 0.9,
        delay: i * 0.1,
        ease: 'power3.out'
      });
    });
  }

  /* 4. FOOTER ---------------------------------------------- */
  const footerBrand = document.querySelector('.ls-footer-brand');
  const footerLinks = document.querySelectorAll('.ls-footer-links a');
  const footerCopy  = document.querySelector('.ls-footer-copy');

  if (footerBrand) {
    gsap.from(footerBrand, {
      scrollTrigger: { trigger: footerBrand, start: 'top 92%' },
      y: 24, scale: 0.9, opacity: 0, duration: 0.7, ease
    });
  }

  if (footerLinks.length) {
    gsap.from(footerLinks, {
      scrollTrigger: { trigger: footerLinks[0], start: 'top 92%' },
      y: 16, opacity: 0, duration: 0.5, stagger: 0.08, delay: 0.15, ease
    });
  }

  if (footerCopy) {
    gsap.from(footerCopy, {
      scrollTrigger: { trigger: footerCopy, start: 'top 95%' },
      opacity: 0, duration: 0.5, delay: 0.4, ease
    });
  }
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

  initScrollReveal();
  initStatCounters();
  initMobileNav();
  initAnimations();
}

function initMobileNav() {
  const btnMenu = document.getElementById('btn-menu');
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
