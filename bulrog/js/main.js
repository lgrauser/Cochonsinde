/*!
 * BULROG — main.js (owner: architect)
 * Header shrink on scroll, mobile menu, active nav link, reveal-on-scroll.
 * Exposes window.Bulrog = { observeReveal(root), reducedMotion }.
 */
(function () {
  'use strict';

  var doc = document;
  var header = doc.getElementById('site-header');
  var toggle = doc.querySelector('.nav-toggle');
  var nav = doc.getElementById('site-nav');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (window.BulrogGears) window.BulrogGears.ensureDefs();

  /* ---- Header shrink ---------------------------------------------------- */
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      if (header) header.classList.toggle('is-scrolled', window.scrollY > 40);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---- Mobile menu ------------------------------------------------------ */
  function setMenu(open) {
    if (!toggle || !nav) return;
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    nav.classList.toggle('is-open', open);
    doc.body.classList.toggle('nav-open', open);
    if (open) {
      var first = nav.querySelector('a');
      if (first) first.focus();
    }
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
      // simple focus trap while the menu is open
      if (e.key === 'Tab' && nav.classList.contains('is-open')) {
        var items = [toggle].concat(Array.prototype.slice.call(nav.querySelectorAll('a')));
        var i = items.indexOf(doc.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); items[items.length - 1].focus(); }
        else if (!e.shiftKey && i === items.length - 1) { e.preventDefault(); items[0].focus(); }
      }
    });
    window.addEventListener('resize', function () {
      if (window.innerWidth > 1080 && nav.classList.contains('is-open')) setMenu(false);
    });
  }

  /* ---- Active link (scroll spy) ---------------------------------------- */
  var links = Array.prototype.slice.call(doc.querySelectorAll('.site-nav__link[href^="#"], .site-nav__cta a[href^="#"]'));
  var ids = ['hero'].concat(links.map(function (a) { return a.getAttribute('href').slice(1); }));
  var targets = ids.map(function (id) { return doc.getElementById(id); }).filter(Boolean);
  targets.sort(function (a, b) { return a.compareDocumentPosition(b) & 4 ? -1 : 1; });
  if (targets.length) {
    var current = null, spyQueued = false;
    var spyUpdate = function () {
      spyQueued = false;
      var line = window.innerHeight * 0.45, id = null;
      for (var i = 0; i < targets.length; i++) {
        if (targets[i].getBoundingClientRect().top <= line) id = targets[i].id; else break;
      }
      if (id === current) return;
      current = id;
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + current;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
      });
    };
    var spyQueue = function () { if (!spyQueued) { spyQueued = true; requestAnimationFrame(spyUpdate); } };
    window.addEventListener('scroll', spyQueue, { passive: true });
    window.addEventListener('resize', spyQueue);
    spyUpdate();
  }

  /* ---- Reveal on scroll ------------------------------------------------- */
  var revealIO = null;
  if (!reduced && 'IntersectionObserver' in window) {
    revealIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          revealIO.unobserve(en.target);
        }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  }
  function observeReveal(root) {
    var els = (root || doc).querySelectorAll('.reveal:not(.is-visible)');
    Array.prototype.forEach.call(els, function (el) {
      if (revealIO) revealIO.observe(el); else el.classList.add('is-visible');
    });
  }
  observeReveal(doc);

  /* ---- Year in footer (optional hook: <span data-year></span>) ---------- */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-year]'), function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  window.Bulrog = { observeReveal: observeReveal, reducedMotion: reduced };
})();
