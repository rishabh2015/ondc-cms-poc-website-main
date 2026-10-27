/* Shared brand-logo resolution for the participant / buyer-app listings.
 *
 * These logos used to be hotlinked from the previous CMS at
 * www.ondc.org/assets/theme/images/np_logos/. That tree vanished when this
 * static site took over the domain, so every one of them 404s. Logos now
 * resolve against a local directory, and anything still missing degrades to an
 * initials monogram instead of a broken-image icon. */
(function () {
  'use strict';

  var LOGO_BASE = '/images/np-logos/';

  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Most participant names are registered company names, so the tail is usually
   * a legal suffix. Dropping it keeps "Ecosyz Core Solutions Pvt Ltd" as ES
   * rather than EL. */
  var LEGAL_SUFFIX = /^(private|pvt|limited|ltd|llp|inc|incorporated|corp|corporation|company|co|plc|and|&)\.?$/i;

  function initials(name) {
    var words = String(name == null ? '' : name).trim().split(/[\s.,]+/).filter(Boolean);
    while (words.length > 1 && LEGAL_SUFFIX.test(words[words.length - 1])) words.pop();
    if (!words.length) return 'NP';
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  /* Accepts either a bare filename (the shape the participant JSON uses) or an
   * already-absolute URL, so a data source that still carries full URLs works. */
  function logoSrc(value) {
    var file = String(value == null ? '' : value).trim();
    if (!file) return '';
    // buyer-apps.json carries its own folder in the path, because the same
    // filename means different images in different legacy folders.
    if (/^https?:\/\//i.test(file) || file.charAt(0) === '/') return file;
    return LOGO_BASE + encodeURIComponent(file);
  }

  function monogram(name, className) {
    return '<span class="' + esc(className || 'bk-np-monogram') + '" aria-hidden="true">' +
      esc(initials(name)) + '</span>';
  }

  /* `name` doubles as the alt text and as the monogram source if the file 404s.
   * Pass alt:'' where the row already names the participant in a sibling cell. */
  function logoImg(value, name, options) {
    var opts = options || {};
    var src = logoSrc(value);
    if (!src) return monogram(name, opts.monogramClass);
    return '<img src="' + esc(src) + '"' +
      (opts.className ? ' class="' + esc(opts.className) + '"' : '') +
      ' alt="' + esc(opts.alt == null ? name : opts.alt) + '"' +
      ' loading="lazy" decoding="async" data-np-logo' +
      ' data-np-name="' + esc(name) + '"' +
      (opts.monogramClass ? ' data-np-monogram-class="' + esc(opts.monogramClass) + '"' : '') +
      '>';
  }

  /* Capture phase: `error` does not bubble, but it does capture, so one
   * listener covers every logo the tables render now or later. */
  document.addEventListener('error', function (event) {
    var img = event.target;
    if (!img || img.tagName !== 'IMG' || !img.hasAttribute('data-np-logo')) return;
    var span = document.createElement('span');
    span.className = img.getAttribute('data-np-monogram-class') || 'bk-np-monogram';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = initials(img.getAttribute('data-np-name'));
    img.replaceWith(span);
  }, true);

  window.npLogo = { base: LOGO_BASE, src: logoSrc, img: logoImg, initials: initials, monogram: monogram };
}());
