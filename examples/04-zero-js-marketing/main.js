/**
 * Light vanilla JS for Archipelago careers landing (04-zero-js-marketing).
 * Scroll progress, nav state, mobile menu, section observers, carousels, filters.
 */

const NAV_SECTIONS = [
  'resorts',
  'mission',
  'growth',
  'scu',
  'roles',
  'publications',
  'testimonials',
  'agent',
];

const PATH_DATA = {
  hospitality: {
    image: 'assets/team-elena.jpg',
    timeline: '2004 to 2014',
    timelineColor: '#0e7490',
    name: 'Elena Ruiz',
    role: 'Assistant Concierge Manager',
    detail:
      'Azure Atoll to Mistral Key, promotion every two to three years across Archipelago island properties.',
  },
  corporate: {
    image: 'assets/role-developer.jpg',
    timeline: 'Meridian Tech Hub',
    timelineColor: '#c9a227',
    name: 'IT Team Meridian',
    role: '116+ personnel',
    detail:
      'AI-forward culture building the systems that power every Archipelago resort experience.',
  },
  culinary: {
    image: 'assets/role-chef.jpg',
    timeline: '2010 to Present',
    timelineColor: '#f4a261',
    name: 'Chef Amara',
    role: 'Executive Chef',
    detail:
      'Started as prep cook, now leads a forty-person culinary team at a flagship island property.',
  },
};

/** @param {string} id */
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  closeMobileMenu();
}

function closeMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const toggle = document.getElementById('menu-toggle');
  if (menu) {
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
  }
  if (toggle) {
    toggle.setAttribute('aria-expanded', 'false');
  }
}

function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const update = () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? scrollTop / docHeight : 0;
    bar.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initNavScroll() {
  const nav = document.getElementById('site-nav');
  if (!nav) {
    return;
  }

  const update = () => {
    nav.classList.toggle('is-scrolled', window.scrollY > window.innerHeight * 0.85);
  };

  window.addEventListener('scroll', update, { passive: true });
  update();
}

function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const menu = document.getElementById('mobile-menu');
  if (!toggle || !menu) {
    return;
  }

  toggle.addEventListener('click', () => {
    const open = menu.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
  });

  document.querySelectorAll('[data-nav-target]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-nav-target');
      if (target) {
        scrollToSection(target);
      }
    });
  });

  document.getElementById('brand-link')?.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    closeMobileMenu();
  });

  document.querySelectorAll('[data-scroll-agent]').forEach((btn) => {
    btn.addEventListener('click', () => scrollToSection('agent'));
  });
}

function initSectionObserver() {
  const navButtons = document.querySelectorAll('[data-nav-target]');
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }
        const id = entry.target.id;
        navButtons.forEach((btn) => {
          btn.classList.toggle('is-active', btn.getAttribute('data-nav-target') === id);
        });
      });
    },
    { threshold: 0.3, rootMargin: '-10% 0px -10% 0px' },
  );

  NAV_SECTIONS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      observer.observe(el);
    }
  });
}

function initGrowthPaths() {
  const tabs = document.querySelectorAll('[data-path-id]');
  const feature = document.getElementById('path-feature');
  if (!tabs.length || !feature) {
    return;
  }

  /** @param {string} pathId */
  const render = (pathId) => {
    const data = PATH_DATA[pathId];
    if (!data) {
      return;
    }

    tabs.forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-path-id') === pathId);
    });

    feature.innerHTML = `
      <div class="path-feature-grid">
        <div class="path-feature-media">
          <img src="${data.image}" alt="${data.name}" width="640" height="480" loading="lazy" />
        </div>
        <div class="path-feature-body">
          <span class="resort-pill" style="background:${data.timelineColor}22;color:${data.timelineColor}">${data.timeline}</span>
          <h3>${data.name}</h3>
          <p class="role" style="color:${data.timelineColor}">${data.role}</p>
          <p class="detail">${data.detail}</p>
        </div>
      </div>
    `;
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const pathId = tab.getAttribute('data-path-id');
      if (pathId) {
        render(pathId);
      }
    });
  });

  render('hospitality');
}

function initPublicationsFilter() {
  const filters = document.querySelectorAll('[data-pub-filter]');
  const cards = document.querySelectorAll('[data-pub-category]');
  if (!filters.length || !cards.length) {
    return;
  }

  /** @param {string | null} category */
  const apply = (category) => {
    filters.forEach((btn) => {
      btn.classList.toggle(
        'is-active',
        btn.getAttribute('data-pub-filter') === (category ?? 'all'),
      );
    });

    cards.forEach((card) => {
      const cardCat = card.getAttribute('data-pub-category');
      const show = !category || category === 'all' || cardCat === category;
      if (show) {
        card.removeAttribute('hidden');
      } else {
        card.setAttribute('hidden', '');
      }
    });
  };

  filters.forEach((btn) => {
    btn.addEventListener('click', () => {
      const value = btn.getAttribute('data-pub-filter');
      apply(value === 'all' ? null : value);
    });
  });
}

function initTestimonials() {
  const slides = document.querySelectorAll('[data-testimonial-index]');
  const images = document.querySelectorAll('[data-testimonial-image]');
  const dots = document.querySelectorAll('[data-testimonial-dot]');
  const thumbs = document.querySelectorAll('[data-testimonial-thumb]');
  const prev = document.getElementById('testimonial-prev');
  const next = document.getElementById('testimonial-next');
  let current = 0;

  /** @param {number} index */
  const show = (index) => {
    const count = slides.length;
    if (count === 0) {
      return;
    }
    current = ((index % count) + count) % count;

    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === current);
    });
    images.forEach((img, i) => {
      img.classList.toggle('is-active', i === current);
    });
    dots.forEach((dot, i) => {
      dot.classList.toggle('is-active', i === current);
    });
    thumbs.forEach((thumb, i) => {
      thumb.classList.toggle('is-active', i === current);
    });
  };

  prev?.addEventListener('click', () => show(current - 1));
  next?.addEventListener('click', () => show(current + 1));
  dots.forEach((dot) => {
    dot.addEventListener('click', () => {
      const index = Number(dot.getAttribute('data-testimonial-dot'));
      if (!Number.isNaN(index)) {
        show(index);
      }
    });
  });
  thumbs.forEach((thumb) => {
    thumb.addEventListener('click', () => {
      const index = Number(thumb.getAttribute('data-testimonial-thumb'));
      if (!Number.isNaN(index)) {
        show(index);
      }
    });
  });
}

function initFooterBackTop() {
  document.getElementById('back-to-top')?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

function init() {
  initScrollProgress();
  initNavScroll();
  initMobileMenu();
  initSectionObserver();
  initGrowthPaths();
  initPublicationsFilter();
  initTestimonials();
  initFooterBackTop();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
