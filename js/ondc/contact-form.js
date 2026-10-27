/* Contact form — compose-and-hand-off, no backend.
   =====================================================================
   There is no server behind this site, so the form does not POST anywhere.
   On submit it builds a subject and body from whatever the visitor typed and
   opens their own mail service with the message ready to send, addressed to
   the inbox set in the CMS. Gmail opens by default (a bare mailto: would
   launch whatever desktop client the OS has registered, typically Outlook);
   the other routes stay available in the panel underneath.

   Everything is read off the rendered markup rather than hard-coded ids, so
   an editor can add, rename, reorder or remove fields in CloudCannon and the
   email follows along with no change to this file:

     form[data-contact-to]              the recipient, and marks the form
     [data-contact-field="Label"]       include this answer, under this heading
     [data-contact-long]                put this one last, on its own lines
     [data-contact-send="gmail|…"]      the three links to fill in
     data-contact-subject-prefix/-field/-fallback   how the subject is built

   Safe to load on any page: does nothing when the form is absent.
   ===================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('form[data-contact-to]');
  if (!form) return;

  var to = form.getAttribute('data-contact-to') || '';
  var panel = form.querySelector('.send-options');

  function sendLink(kind) {
    return form.querySelector('[data-contact-send="' + kind + '"]');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.reportValidity()) return;

    var subjectField = form.getAttribute('data-contact-subject-field') || '';
    var subjectValue = '';
    var lines = [];
    var tail = [];

    Array.prototype.forEach.call(
      form.querySelectorAll('[data-contact-field]'),
      function (el) {
        var heading = el.getAttribute('data-contact-field') || el.name || '';
        var value = (el.value || '').trim();
        if (el.name && el.name === subjectField) subjectValue = value;
        if (!value) return;
        // A long message reads badly squeezed onto one line, so it goes last
        // with a blank line before it.
        if (el.hasAttribute('data-contact-long')) tail.push('', heading + ':', value);
        else lines.push(heading + ': ' + value);
      }
    );

    var subject = (form.getAttribute('data-contact-subject-prefix') || '') +
      (subjectValue || form.getAttribute('data-contact-subject-fallback') || '');
    var su = encodeURIComponent(subject);
    var bd = encodeURIComponent(lines.concat(tail).join('\n'));

    var gmail = 'https://mail.google.com/mail/?view=cm&fs=1&to=' + to + '&su=' + su + '&body=' + bd;
    var g = sendLink('gmail');
    var o = sendLink('outlook');
    var d = sendLink('default');
    if (g) g.href = gmail;
    if (o) o.href = 'https://outlook.live.com/mail/0/deeplink/compose?to=' + to + '&subject=' + su + '&body=' + bd;
    if (d) d.href = 'mailto:' + to + '?subject=' + su + '&body=' + bd;

    // Opened from inside the click handler, so it counts as user-initiated and
    // is not treated as a popup. Skipped inside the CloudCannon editor, where
    // an editor clicking Submit to see what the button looks like should not
    // find a Gmail tab opening on top of their work.
    if (!document.documentElement.classList.contains('is-editing')) {
      window.open(gmail, '_blank', 'noopener');
    }

    if (panel) {
      panel.hidden = false;
      panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
})();
