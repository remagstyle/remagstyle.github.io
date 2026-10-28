/*
  REMAGSTYLE - floating glass bottom navigation (phones and tablets only).

  Add to a page with:  <script src="bottom-nav.js" defer></script>
  On screens narrower than 1024px it replaces the top bar and hamburger menu.
  On wider screens it stays hidden and the normal top menu is used.
  To change the tabs, edit the ITEMS list below.
*/
(function () {
  if (window.__remagBottomNav) return;
  window.__remagBottomNav = true;

  var ICONS = {
    home: '<path d="m3.5 10.5 8.5-7 8.5 7"/><path d="M5.5 9.5v10.5h13V9.5M9.5 20v-6h5v6"/>',
    gallery: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-4.5-4.5L7 19.5"/>',
    order: '<path d="M6 8.5h12l-1 11.5H7L6 8.5Z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>',
    track: '<path d="M12 21s-6-5.2-6-10a6 6 0 1 1 12 0c0 4.8-6 10-6 10Z"/><circle cx="12" cy="11" r="2.2"/>',
    book: '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M8 3.5v4M16 3.5v4M4 10.5h16"/>',
    account: '<circle cx="12" cy="8.2" r="3.7"/><path d="M4.8 20.2a7.2 7.2 0 0 1 14.4 0"/>'
  };

  // Whether a client is signed in is remembered by the homepage and dashboard (they set this flag).
  // '1' = signed in, '0' = signed out, missing = unknown.
  var FLAG = 'remag_signed_in';
  function signedInFlag() { try { return localStorage.getItem(FLAG); } catch (e) { return null; } }

  // href: the default link. dest(): where a tap really goes (it can depend on whether the client is signed in).
  // match: page file names that make this tab the active one.
  var ITEMS = [
    { label: 'Home', href: 'index.html', icon: 'home', match: ['', 'index.html'] },
    { label: 'Gallery', href: 'gallery.html', icon: 'gallery', match: ['gallery.html'] },
    { label: 'Order', href: 'index.html#order', icon: 'order', id: 'order',
      match: ['guest-order.html', 'measurements.html'],
      dest: function () {
        var f = signedInFlag();
        return f === '1' ? 'client-dashboard.html#order-form' : f === '0' ? 'guest-order.html' : 'index.html#order';
      } },
    { label: 'Track order', href: 'track-order.html', icon: 'track', match: ['track-order.html'] },
    { label: 'Book appointment', href: 'appointment.html', icon: 'book', match: ['appointment.html'] },
    { label: 'Account', href: 'index.html#account', icon: 'account', id: 'account',
      match: ['client-dashboard.html'],
      dest: function () { return signedInFlag() === '1' ? 'client-dashboard.html#top' : 'index.html#account'; } }
  ];

  var CSS = [
    "@media (max-width:1023.98px){",
    "body>header,#mobile-menu,#mobile-menu-btn,.floating-menu-button,.mobile-menu-floating{display:none !important}",
    "body{padding-top:var(--safe-area-inset-top,env(safe-area-inset-top,0px))}",
    "body{padding-bottom:calc(96px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))) !important}",
    "body.rg-has-footer{padding-bottom:0 !important}",
    "body.rg-has-footer>footer{padding-bottom:calc(96px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)))}",
    "}",
    "#rg-nav{position:fixed;left:50%;bottom:max(14px,calc(var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)) + 8px));transform:translateX(-50%);z-index:40;width:min(calc(100vw - 28px),420px);box-sizing:border-box;",
    "display:none;align-items:center;justify-content:space-between;padding:9px 8px;border-radius:999px;",
    "background:linear-gradient(135deg,rgba(40,40,40,.62),rgba(17,17,17,.48));",
    "-webkit-backdrop-filter:blur(18px) saturate(170%);backdrop-filter:blur(18px) saturate(170%);",
    "border:1px solid rgba(255,255,255,.22);",
    "box-shadow:0 12px 32px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.28),inset 0 -1px 0 rgba(255,255,255,.06);",
    "transition:transform .25s ease,opacity .2s ease}",
    "@media (max-width:1023.98px){#rg-nav{display:flex}}",
    "@media print{#rg-nav{display:none !important}}",
    "#rg-nav.rg-hidden{opacity:0;pointer-events:none;transform:translateX(-50%) translateY(24px)}",
    "#rg-nav a{position:relative;flex:1 1 0;display:flex;align-items:center;justify-content:center;height:46px;min-width:0;border-radius:999px;color:rgba(255,255,255,.78);",
    "-webkit-tap-highlight-color:transparent;text-decoration:none;transition:color .2s ease,transform .15s ease}",
    "#rg-nav a:active{transform:scale(.9)}",
    "#rg-nav a:focus-visible{outline:2px solid #E3C77B;outline-offset:2px}",
    "#rg-nav svg{position:relative;width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}",
    "#rg-nav a[aria-current=page]{color:#111}",
    "#rg-nav a[aria-current=page]::before{content:'';position:absolute;left:50%;top:50%;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;",
    "background:radial-gradient(circle at 30% 25%,#F3DE9F,#D4B25E 55%,#B89237);",
    "box-shadow:0 4px 14px rgba(184,146,55,.55),inset 0 1px 0 rgba(255,255,255,.6)}",
    "#rg-nav .rg-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}",
    "@supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){#rg-nav{background:rgba(17,17,17,.94)}}",
    "@media (prefers-reduced-motion:reduce){#rg-nav,#rg-nav a{transition:none}}",
    "@media (prefers-contrast:more){#rg-nav{background:#111;border-color:#fff}}"
  ].join("");

  function currentPage() {
    var file = (location.pathname.split('/').pop() || '').toLowerCase();
    return file;
  }

  function build() {
    if (document.getElementById('rg-nav')) return;
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var nav = document.createElement('nav');
    nav.id = 'rg-nav';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = ITEMS.map(function (item, i) {
      return '<a href="' + item.href + '" title="' + item.label + '" data-i="' + i + '">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[item.icon] + '</svg>' +
        '<span class="rg-sr">' + item.label + '</span></a>';
    }).join('');
    document.body.appendChild(nav);

    // Mark the tab for the page we are on. On the dashboard, #order-form means the Order tab.
    function markActive() {
      var page = currentPage();
      var onOrderForm = page === 'client-dashboard.html' && location.hash === '#order-form';
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function (a) {
        var item = ITEMS[+a.getAttribute('data-i')];
        var active = item.match.indexOf(page) !== -1;
        if (page === 'client-dashboard.html') active = onOrderForm ? item.id === 'order' : item.id === 'account';
        if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
      });
    }
    markActive();
    window.addEventListener('hashchange', markActive);

    // Tabs with a dest() decide where to go at the moment of the tap.
    nav.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[data-i]');
      if (!a) return;
      var item = ITEMS[+a.getAttribute('data-i')];
      if (!item.dest) return;
      var dest = item.dest();
      var here = currentPage();
      var target = dest.split('#')[0], hash = dest.indexOf('#') > -1 ? '#' + dest.split('#')[1] : '';
      // Already on the homepage: open the sign-in panel directly instead of reloading.
      if ((here === '' || here === 'index.html') && target === 'index.html') {
        var openBtn = document.getElementById('open-account-btn');
        if (openBtn) { e.preventDefault(); openBtn.click(); return; }
      }
      // Already on the dashboard: just scroll.
      if (here === target && target === 'client-dashboard.html') {
        e.preventDefault();
        if (hash === '#top') { window.scrollTo({ top: 0, behavior: 'smooth' }); history.replaceState(null, '', location.pathname); }
        else { location.hash = hash; }
        markActive();
        return;
      }
      e.preventDefault();
      window.location.href = dest;
    });
    // If the page ends with a footer, give the footer the extra room so no pale strip shows under it.
    // (Anything after the footer, such as pop-ups and the photo viewer, floats above the page.)
    if (document.querySelector('body > footer')) document.body.classList.add('rg-has-footer');

    // Slide the bar away while the keyboard is open so it never covers a form field.
    function editing(el) {
      return !!el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) && !/^(checkbox|radio|button|submit|file)$/i.test(el.type || '') || (el && el.isContentEditable);
    }
    document.addEventListener('focusin', function (e) { if (editing(e.target)) nav.classList.add('rg-hidden'); });
    document.addEventListener('focusout', function () {
      setTimeout(function () { if (!editing(document.activeElement)) nav.classList.remove('rg-hidden'); }, 120);
    });
  }

  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
