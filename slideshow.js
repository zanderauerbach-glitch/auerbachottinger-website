// ============================================================
//  HERO SLIDESHOW
//  Auto-cycles through 5 slides with a 5-second interval.
//  Use the arrows or dots to navigate manually.
//  Pauses on hover, resumes on mouse leave.
// ============================================================

(function () {
  const slides = document.querySelectorAll('.hero-slide');
  const dots   = document.querySelectorAll('.hero-dot');
  const prev   = document.querySelector('.hero-arrow.prev');
  const next   = document.querySelector('.hero-arrow.next');

  if (!slides.length) return;

  let current  = 0;
  let interval = null;
  const DELAY  = 5000; // milliseconds between auto-advances

  function goTo(index) {
    slides[current].classList.remove('active');
    dots[current].classList.remove('active');
    current = (index + slides.length) % slides.length;
    slides[current].classList.add('active');
    dots[current].classList.add('active');
  }

  function startAuto() {
    interval = setInterval(() => goTo(current + 1), DELAY);
  }

  function stopAuto() {
    clearInterval(interval);
  }

  // Arrow controls
  prev.addEventListener('click', () => { stopAuto(); goTo(current - 1); startAuto(); });
  next.addEventListener('click', () => { stopAuto(); goTo(current + 1); startAuto(); });

  // Dot controls
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => { stopAuto(); goTo(i); startAuto(); });
  });

  // Pause on hover
  const hero = document.querySelector('.hero');
  hero.addEventListener('mouseenter', stopAuto);
  hero.addEventListener('mouseleave', startAuto);

  // Touch / swipe support for mobile
  let touchStartX = 0;
  hero.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  hero.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) {
      stopAuto();
      goTo(diff > 0 ? current + 1 : current - 1);
      startAuto();
    }
  });

  // Keyboard arrows
  document.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  { stopAuto(); goTo(current - 1); startAuto(); }
    if (e.key === 'ArrowRight') { stopAuto(); goTo(current + 1); startAuto(); }
  });

  startAuto();
})();
