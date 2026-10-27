/*
  REMAGSTYLE - Terms & Conditions consent gate

  Any <form data-requires-terms> shows the terms pop-up when the client submits it
  (after the browser's normal field checks pass). The order is only submitted once
  the client ticks the box and presses "Agree & Continue".

  Links and buttons can be gated too:  <a href="..." data-requires-terms>
  Or from code:  RemagTerms.require(function () { ...continue the order... });
*/
(function () {
  var CONFIG = {
    version: "2026-10-20",       // update when the terms change
    termsUrl: "terms.html",      // full terms page
    askEveryOrder: true,         // false = remember acceptance in this browser
    storageKey: "remag_terms_acceptance"
  };

  var CSS = [
    "#rt-overlay{position:fixed;inset:0;background:rgba(17,17,17,.6);display:flex;align-items:center;justify-content:center;z-index:99999;padding:16px}",
    "#rt-box{background:#fff;color:#111;max-width:520px;width:100%;border:1px solid #E2DFD8;padding:24px;max-height:92vh;overflow:auto;font-family:Inter,system-ui,sans-serif;box-shadow:0 20px 50px rgba(0,0,0,.25)}",
    "#rt-box h2{margin:0 0 4px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:300;font-size:1.9rem;line-height:1.15}",
    "#rt-box .rt-kicker{margin:0 0 12px;font-size:10px;letter-spacing:.25em;text-transform:uppercase;color:#666}",
    "#rt-sum{font-size:12px;line-height:1.6;color:#444;max-height:230px;overflow:auto;border:1px solid #E2DFD8;background:#F9F8F6;padding:12px 14px 4px;margin-bottom:14px}",
    "#rt-sum ul{margin:0;padding-left:16px}",
    "#rt-sum li{margin-bottom:8px}",
    "#rt-sum b{color:#111}",
    "#rt-box a{color:#111;text-decoration:underline}",
    "#rt-row{display:flex;gap:10px;align-items:flex-start;margin-bottom:18px;font-size:12px;line-height:1.5;cursor:pointer}",
    "#rt-row input{margin-top:2px;width:16px;height:16px;flex:none;accent-color:#111}",
    "#rt-btns{display:flex;gap:12px}",
    "#rt-btns button{padding:14px 18px;border:1px solid #111;font-size:10px;font-weight:500;letter-spacing:.2em;text-transform:uppercase;cursor:pointer;font-family:inherit}",
    "#rt-cancel{background:#fff;color:#111;width:33%}",
    "#rt-cancel:hover{background:#111;color:#fff}",
    "#rt-ok{background:#111;color:#fff;flex:1}",
    "#rt-ok:hover:not(:disabled){background:rgba(0,0,0,.8)}",
    "#rt-ok:disabled{opacity:.35;cursor:not-allowed}"
  ].join("");

  function getAcceptance() {
    try { return JSON.parse(localStorage.getItem(CONFIG.storageKey)); } catch (e) { return null; }
  }

  function save() {
    var rec = { version: CONFIG.version, acceptedAt: new Date().toISOString() };
    try { localStorage.setItem(CONFIG.storageKey, JSON.stringify(rec)); } catch (e) {}
    return rec;
  }

  function alreadyAccepted() {
    if (CONFIG.askEveryOrder) return false;
    var a = getAcceptance();
    return !!(a && a.version === CONFIG.version);
  }

  function showModal(onAccept) {
    if (document.getElementById("rt-overlay")) return;
    var style = document.createElement("style");
    style.id = "rt-style";
    style.textContent = CSS;
    document.head.appendChild(style);

    var previouslyFocused = document.activeElement;
    var o = document.createElement("div");
    o.id = "rt-overlay";
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.setAttribute("aria-labelledby", "rt-title");
    o.innerHTML =
      '<div id="rt-box">' +
      '<p class="rt-kicker">Terms &amp; Store Policies</p>' +
      '<h2 id="rt-title">Before you order</h2>' +
      '<div id="rt-sum" tabindex="0"><ul>' +
      "<li><b>Deposit:</b> a non-refundable 60% deposit starts production. The 40% balance is due at the final fitting or before dispatch/pickup.</li>" +
      "<li><b>Timeline:</b> bespoke orders take 3 to 6 weeks. Rush orders carry a 20%-30% fee.</li>" +
      "<li><b>Measurements:</b> if you provide your own measurements, fit issues caused by inaccurate measurements are your responsibility.</li>" +
      "<li><b>Fittings &amp; alterations:</b> up to 2 fittings. Free minor adjustments within 7 days of collection or delivery.</li>" +
      "<li><b>Cancellations:</b> deposits are non-refundable and work already done is payable. Ready-to-wear: exchange or store credit within 7 days, no cash refunds.</li>" +
      "<li><b>Shipping:</b> delivery fees, customs and import duties are your responsibility.</li>" +
      "<li><b>Photography:</b> we may photograph finished garments for our portfolio unless you ask for confidentiality before production starts.</li>" +
      "</ul></div>" +
      '<label id="rt-row"><input type="checkbox" id="rt-check">' +
      '<span>I have read and agree to the <a href="' + CONFIG.termsUrl +
      '" target="_blank" rel="noopener">full Terms &amp; Conditions and Store Policies</a>.</span></label>' +
      '<div id="rt-btns"><button type="button" id="rt-cancel">Cancel</button>' +
      '<button type="button" id="rt-ok" disabled>Agree &amp; Continue</button></div>' +
      "</div>";
    document.body.appendChild(o);

    var check = o.querySelector("#rt-check");
    var ok = o.querySelector("#rt-ok");
    function close() {
      o.remove();
      var s = document.getElementById("rt-style");
      if (s) s.remove();
      document.removeEventListener("keydown", onKey, true);
      if (previouslyFocused && previouslyFocused.focus) { try { previouslyFocused.focus(); } catch (e) {} }
    }
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); close(); } }
    document.addEventListener("keydown", onKey, true);
    check.addEventListener("change", function () { ok.disabled = !check.checked; });
    o.querySelector("#rt-cancel").addEventListener("click", close);
    o.addEventListener("click", function (e) { if (e.target === o) close(); });
    ok.addEventListener("click", function () {
      if (!check.checked) return;
      var rec = save();
      close();
      onAccept(rec);
    });
    check.focus();
  }

  function requireTerms(callback) {
    if (alreadyAccepted()) return callback(getAcceptance());
    showModal(callback);
  }

  // Forms: intercept the submit event (runs after the browser's required-field checks)
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || !form.matches || !form.matches("form[data-requires-terms]")) return;
    if (form.dataset.termsOk === "1") return; // already agreed, let it through
    if (alreadyAccepted()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showModal(function () {
      form.dataset.termsOk = "1";
      try { form.requestSubmit(); } finally { delete form.dataset.termsOk; }
    });
  }, true);

  // Links and buttons (not inside a gated form)
  document.addEventListener("click", function (e) {
    var el = e.target.closest && e.target.closest("[data-requires-terms]");
    if (!el || el.tagName === "FORM") return;
    if (el.dataset.termsOk === "1") { delete el.dataset.termsOk; return; }
    if (alreadyAccepted()) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    showModal(function () {
      el.dataset.termsOk = "1";
      el.click();
    });
  }, true);

  window.RemagTerms = { require: requireTerms, getAcceptance: getAcceptance, version: CONFIG.version };
})();
