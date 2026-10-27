/* Award lightbox. A .bk-award / .bk-award-feature button expands into the
   #awModal dialog. Ships with the `awards` section component. */
    /* ── Award lightbox: the clicked card flips and expands into the centre ── */
    (function () {
      const modal = document.getElementById('awModal');
      if (!modal) return;
      const panel = modal.querySelector('.bk-lightbox-panel');
      const img = document.getElementById('awModalImg');
      const elTtl = document.getElementById('awModalTitle');
      const elName = document.getElementById('awModalName');
      const elYear = document.getElementById('awModalYear');
      const elDesc = document.getElementById('awModalDesc');
      const closeBtn = modal.querySelector('.bk-lightbox-close');
      const cards = document.querySelectorAll('.bk-award, .bk-award-feature');
      const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let originCard = null, lastFocus = null, busy = false, settleT = 0;

      /* Where the panel sits when it is folded into its row: over the row's
       * centre and slightly smaller. Translate and scale only — the old
       * 168-degree flip was both the showiest and the most expensive part of
       * this, and a flip is exactly the overshoot the system rules out. If the
       * row has been scrolled away there is nothing to merge into, so the
       * panel settles in place instead of flying off screen. */
      function foldedOnto(card) {
        const r = card.getBoundingClientRect();
        if (r.bottom <= 0 || r.top >= innerHeight) return 'scale(.96)';
        const p = panel.getBoundingClientRect();
        const dx = (r.left + r.width / 2) - (p.left + p.width / 2);
        const dy = (r.top + r.height / 2) - (p.top + p.height / 2);
        return 'translate(' + dx + 'px,' + dy + 'px) scale(.94)';
      }

      /* Run once on the panel's transform transition, or on a fallback timer if
       * that transition never lands (backgrounded tab, interrupted animation).
       * The old code always used a bare timer, so any drift finished the close
       * mid-flight and the panel snapped. */
      function onceSettled(ms, fn) {
        let done = false;
        const go = function () {
          if (done) return;
          done = true;
          panel.removeEventListener('transitionend', h);
          clearTimeout(t);
          fn();
        };
        const h = function (e) {
          if (e.target === panel && e.propertyName === 'transform') go();
        };
        panel.addEventListener('transitionend', h);
        const t = setTimeout(go, ms);
      }

      function finish() {
        modal.classList.remove('open', 'in', 'bk-swish-in', 'bk-swish-out');
        modal.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        panel.style.transition = 'none';
        panel.style.transform = '';
        void panel.offsetWidth;
        panel.style.transition = '';
        busy = false;
        const back = originCard || lastFocus;
        if (back && back.focus) back.focus({ preventScroll: true });
      }

      function open(card) {
        if (busy) return;
        busy = true;
        clearTimeout(settleT);
        originCard = card;
        lastFocus = document.activeElement;

        img.src = card.dataset.img;
        img.alt = card.dataset.title + ' — ' + card.dataset.name;
        elTtl.textContent = card.dataset.title;
        elName.textContent = card.dataset.name;
        elYear.textContent = card.dataset.year;
        elDesc.textContent = card.dataset.desc;

        modal.classList.remove('bk-swish-out');
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';

        if (reduced()) {
          panel.style.transform = '';
          modal.classList.add('in');
          busy = false;
          closeBtn.focus();
          return;
        }

        panel.style.transition = 'none';
        panel.style.transform = foldedOnto(card);
        void panel.offsetWidth;                       // flush the start state
        panel.style.transition = '';                  // hand timing back to the stylesheet
        modal.classList.add('in', 'bk-swish-in');
        panel.style.transform = 'translate(0,0) scale(1)';
        settleT = setTimeout(function () { busy = false; closeBtn.focus(); }, 280);
      }

      function close() {
        if (busy || !modal.classList.contains('open')) return;
        busy = true;
        clearTimeout(settleT);                        // a pending open-settle must not fire mid-close
        modal.classList.remove('in', 'bk-swish-in');

        if (reduced() || !originCard) { finish(); return; }

        modal.classList.add('bk-swish-out');
        panel.style.transform = foldedOnto(originCard);
        onceSettled(620, finish);
      }

      cards.forEach(function (card) { card.addEventListener('click', function () { open(card); }); });
      modal.querySelectorAll('[data-close]').forEach(function (el) { el.addEventListener('click', close); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal.classList.contains('open')) close();
        // keep focus inside the dialog while it is open
        if (e.key === 'Tab' && modal.classList.contains('open')) { e.preventDefault(); closeBtn.focus(); }
      });
      // A resize mid-flight invalidates the measured offsets: drop the panel
      // straight to its resting position rather than animating to a stale one.
      window.addEventListener('resize', function () {
        if (!modal.classList.contains('open')) return;
        panel.style.transition = 'none';
        panel.style.transform = '';
        void panel.offsetWidth;
        panel.style.transition = '';
      });
    })();
