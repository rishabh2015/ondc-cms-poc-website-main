/* Scroll-scrubbed intros (homepage hero, About "Our journey") play themselves
 * if the visitor does nothing, and can always be skipped.
 *
 * Both intros are driven purely by scroll position, so "play" here is just
 * scrolling the page for the visitor at a steady rate until the intro is past.
 * Any real input (wheel, key, touch, pointer) hands control straight back. */
(function () {
  var PLAY_AFTER = 2000;   // idle ms on landing before the intro plays itself
  var PLAY_SECONDS = 18;   // roughly how long a full auto-play takes

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function start(sec) {
    // Where the intro ends: the homepage marks it with #site-top, elsewhere it
    // is simply the section after the intro.
    var end = document.getElementById('site-top') || sec.nextElementSibling;
    if (!end) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'intro-skip';
    btn.textContent = 'Skip Intro';
    document.body.appendChild(btn);

    var remaining = function () { return end.getBoundingClientRect().top; };
    var playing = false;
    var idle = null;

    function stop() {
      playing = false;
      if (idle) { clearTimeout(idle); idle = null; }
    }

    function play() {
      if (playing || reduced) return;
      var speed = Math.max(150, Math.min(600, remaining() / PLAY_SECONDS));
      var last = performance.now();
      playing = true;
      (function step(now) {
        if (!playing) return;
        var left = remaining();
        if (left <= 0) { playing = false; return; }
        // 'instant': these pages set scroll-behavior:smooth, which would queue
        // a tween per frame instead of just moving.
        scrollBy({ top: Math.min(left, speed * (now - last) / 1000), behavior: 'instant' });
        last = now;
        requestAnimationFrame(step);
      })(last);
    }

    btn.addEventListener('click', function () {
      stop();
      scrollBy({ top: remaining(), behavior: 'smooth' });
    });

    ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (ev) {
      addEventListener(ev, stop, { passive: true });
    });

    addEventListener('scroll', function () {
      btn.dataset.visible = remaining() > 0 ? 'true' : 'false';
    }, { passive: true });

    btn.dataset.visible = remaining() > 0 ? 'true' : 'false';
    // Not on a phone: pulling the page out from under someone two seconds
    // after they land reads as a malfunction on a touch screen, where there is
    // no pointer resting on the page to signal that they are still reading.
    // The Skip button and every manual path stay exactly as they are.
    if (!reduced && !matchMedia('(max-width: 900px)').matches && scrollY < innerHeight) {
      idle = setTimeout(play, PLAY_AFTER);
    }
  }

  // The homepage hero is rendered by React after this script runs, so wait for
  // the section to exist rather than assuming it does.
  var tries = 0;
  (function find() {
    var sec = document.querySelector('#story, #our-journey');
    if (sec) return start(sec);
    if (++tries < 60) setTimeout(find, 100);
  })();
})();
