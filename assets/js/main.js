/* Shogun Sushi — site interactions. Vanilla JS, no dependencies.
   Everything here is progressive enhancement: the pages work without it. */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window) root.classList.add('js');

  var dataEl = document.getElementById('site-data');
  var site = null;
  try { site = dataEl ? JSON.parse(dataEl.textContent) : null; } catch (e) { site = null; }

  /* Header: solid background once the page scrolls ----------------------- */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () { header.classList.toggle('is-solid', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* Mobile navigation ------------------------------------------------------ */
  var toggle = document.querySelector('.nav-toggle');
  var panel = document.getElementById('mobile-nav');
  if (toggle && panel) {
    var label = toggle.querySelector('.sr-only');
    var setNav = function (open, restoreFocus) {
      toggle.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? toggle.dataset.labelClose : toggle.dataset.labelOpen;
      panel.hidden = !open;
      document.body.classList.toggle('nav-open', open);
      document.querySelectorAll('main, .site-footer, .action-bar').forEach(function (el) { el.inert = open; });
      if (open) {
        var first = panel.querySelector('a, button');
        if (first) first.focus();
      } else if (restoreFocus) {
        toggle.focus();
      }
    };
    toggle.addEventListener('click', function () { setNav(toggle.getAttribute('aria-expanded') !== 'true', true); });
    panel.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false, false); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !panel.hidden) setNav(false, true);
    });
    var wide = window.matchMedia('(min-width: 1181px)');
    var onWide = function (e) { if (e.matches && !panel.hidden) setNav(false, false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
  }

  /* Opening hours: today's row + "open now" status -------------------------- */
  var ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  var SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  function zonedNow(tz) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(new Date());
    var get = function (type) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === type) return parts[i].value;
      return '';
    };
    return { day: SHORT.indexOf(get('weekday')), mins: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
  }
  function toMins(s) { var p = s.split(':'); return Number(p[0]) * 60 + Number(p[1]); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function fmtTime(s) {
    var p = s.split(':'), h = Number(p[0]), m = Number(p[1]);
    if (site.lang === 'fr') return h + ' h' + (m ? ' ' + pad(m) : '');
    var h12 = h % 12 || 12;
    return h12 + (m ? ':' + pad(m) : '') + ' ' + (h >= 12 ? 'p.m.' : 'a.m.');
  }
  function computeStatus(now) {
    var t = site.t, today = site.hours[ORDER[now.day]];
    if (today && now.mins >= toMins(today[0]) && now.mins < toMins(today[1])) {
      return { open: true, text: t.openNow, detail: t.closesAt.replace('{t}', fmtTime(today[1])) };
    }
    if (today && now.mins < toMins(today[0])) {
      return { open: false, text: t.closedNow, detail: t.opensToday.replace('{t}', fmtTime(today[0])) };
    }
    for (var i = 1; i <= 7; i++) {
      var d = (now.day + i) % 7, h = site.hours[ORDER[d]];
      if (!h) continue;
      var dayName = site.lang === 'fr' ? site.days[d].toLowerCase() : site.days[d];
      var detail = i === 1 ? t.opensTomorrow.replace('{t}', fmtTime(h[0]))
        : t.opensOn.replace('{d}', dayName).replace('{t}', fmtTime(h[0]));
      return { open: false, text: t.closedNow, detail: detail };
    }
    return null;
  }

  if (site && site.hours && window.Intl) {
    try {
      var now = zonedNow(site.tz);
      if (now.day >= 0) {
        var key = ORDER[now.day];
        document.querySelectorAll('[data-day="' + key + '"]').forEach(function (row) {
          row.classList.add('is-today');
          row.setAttribute('aria-current', 'date');
        });
        var st = computeStatus(now);
        if (st) {
          document.querySelectorAll('[data-status]').forEach(function (el) {
            el.classList.add(st.open ? 'is-open' : 'is-closed');
            var txt = el.querySelector('.status-text');
            if (!txt) return;
            txt.textContent = '';
            var strong = document.createElement('strong');
            strong.textContent = st.text;
            txt.appendChild(strong);
            txt.appendChild(document.createTextNode(' · ' + st.detail));
          });
        }
      }
    } catch (e) { /* keep static fallback text */ }
  }

  /* Menu page: highlight the category in view ------------------------------- */
  var chipList = document.querySelector('.chips');
  if (chipList && 'IntersectionObserver' in window) {
    var chips = Array.prototype.slice.call(chipList.querySelectorAll('.chip'));
    var byId = {};
    chips.forEach(function (c) { byId[c.getAttribute('href').slice(1)] = c; });
    var current = null;
    var activate = function (id) {
      if (id === current || !byId[id]) return;
      current = id;
      chips.forEach(function (c) {
        var on = c === byId[id];
        c.classList.toggle('is-active', on);
        if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      });
      var chip = byId[id];
      var left = chip.parentElement.offsetLeft - chipList.clientWidth / 2 + chip.clientWidth / 2;
      chipList.scrollTo({ left: Math.max(0, left), behavior: reduceMotion ? 'auto' : 'smooth' });
    };
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) activate(en.target.id); });
    }, { rootMargin: '-30% 0px -65% 0px' });
    document.querySelectorAll('.menu-cat[id]').forEach(function (s) { spy.observe(s); });
  }

  /* Gallery lightbox --------------------------------------------------------- */
  var lb = document.querySelector('.lightbox');
  var lbItems = Array.prototype.slice.call(document.querySelectorAll('[data-lightbox]'));
  if (lb && lbItems.length && typeof lb.showModal === 'function') {
    var lbImg = lb.querySelector('img');
    var lbCap = lb.querySelector('figcaption');
    var index = 0;
    var show = function (n) {
      index = (n + lbItems.length) % lbItems.length;
      var a = lbItems[index];
      lbImg.src = a.getAttribute('href');
      lbImg.alt = a.dataset.alt || '';
      lbCap.textContent = a.dataset.caption || '';
    };
    lbItems.forEach(function (a, n) {
      a.addEventListener('click', function (e) { e.preventDefault(); show(n); lb.showModal(); });
    });
    lb.querySelector('[data-lb-prev]').addEventListener('click', function () { show(index - 1); });
    lb.querySelector('[data-lb-next]').addEventListener('click', function () { show(index + 1); });
    lb.querySelector('[data-lb-close]').addEventListener('click', function () { lb.close(); });
    lb.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') show(index - 1);
      if (e.key === 'ArrowRight') show(index + 1);
    });
    lb.addEventListener('click', function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener('close', function () { if (lbItems[index]) lbItems[index].focus(); });
  }

  /* Map: load Google Maps only when asked (faster, more private) ------------ */
  document.querySelectorAll('[data-map-src]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.map');
      if (!wrap || wrap.classList.contains('is-loaded')) return;
      var frame = document.createElement('iframe');
      frame.src = btn.dataset.mapSrc;
      frame.title = btn.dataset.mapTitle || '';
      frame.loading = 'lazy';
      frame.referrerPolicy = 'no-referrer-when-downgrade';
      frame.allowFullscreen = true;
      wrap.appendChild(frame);
      wrap.classList.add('is-loaded');
    });
  });

  /* Reveal on scroll --------------------------------------------------------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-in'); });
  }
})();
