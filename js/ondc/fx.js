/* FX decoration removed by request — the node/line/circle overlays are gone site-wide.
   Keep the public scan API while using this shared file for small progressive
   enhancements that make repeated controls accessible on every page. */
(function () {
  function enhanceCarouselDots(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('.dots, .carousel-nav').forEach(function (group) {
      const dots = Array.from(group.querySelectorAll('.dot-btn'));
      dots.forEach(function (dot, index) {
        if (!dot.hasAttribute('aria-label')) {
          dot.setAttribute('aria-label', 'Go to slide ' + (index + 1));
        }
        if (dot.classList.contains('on')) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
    });
  }


  // Below this width the nav links become a drawer instead of a scroll rail.
  // Everything gated on it is mobile-only by construction, so the desktop
  // navbar keeps exactly the DOM and behaviour it had before.
  const MOBILE_NAV = matchMedia("(max-width: 900px)");

  // Navbar dropdowns are native <details>. The panel is position:fixed so the
  // overflow-x:auto on .nav-links cannot clip it, which means we place it here.
  function wireNavDropdowns(root) {
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".nav-drop").forEach(function (drop) {
      if (drop.dataset.navDropWired) return;
      const summary = drop.querySelector("summary");
      const menu = drop.querySelector(".nav-drop-menu");
      if (!summary || !menu) return;
      drop.dataset.navDropWired = "1";

      // Two things make naive placement wrong: .navbar sets backdrop-filter, so
      // it (not the viewport) is the containing block for our position:fixed
      // panel; and scale.css sets body{zoom}, so getBoundingClientRect values
      // are not in the units we assign. Probe both at once - park the panel at
      // 0 and at 100, see where it actually lands, then solve for the offset.
      function place() {
        menu.style.left = "0px";
        menu.style.top = "0px";
        const p0 = menu.getBoundingClientRect();
        menu.style.left = "100px";
        menu.style.top = "100px";
        const p1 = menu.getBoundingClientRect();
        const sx = (p1.left - p0.left) / 100 || 1;
        const sy = (p1.top - p0.top) / 100 || 1;

        const r = summary.getBoundingClientRect();
        const wantL = Math.max(12, Math.min(r.left, window.innerWidth - p0.width - 12));
        menu.style.left = Math.round((wantL - p0.left) / sx) + "px";
        menu.style.top = Math.round((r.bottom + 6 - p0.top) / sy) + "px";
      }

      // The click event runs before <details> performs its native toggle. Clear
      // the readiness marker here so the menu cannot paint for a frame at stale
      // or uninitialised fixed coordinates. Keyboard activation also dispatches
      // this click path.
      summary.addEventListener("click", function () {
        if (!drop.open) drop.removeAttribute("data-nav-drop-positioned");
      });

      drop.addEventListener("toggle", function () {
        if (!drop.open) {
          drop.removeAttribute("data-nav-drop-positioned");
          return;
        }
        // Inside the mobile drawer the panel is a static, inline block, so
        // there is nothing to place — and placing it would fight the CSS.
        if (MOBILE_NAV.matches && drop.closest(".navbar")) {
          drop.removeAttribute("data-nav-drop-positioned");
          return;
        }
        place();
        // Commit the hidden menu's final coordinates before changing the
        // readiness selector, so the browser has a real start state for the
        // entrance transition instead of batching both changes together.
        menu.getBoundingClientRect();
        drop.setAttribute("data-nav-drop-positioned", "");
        // Again next frame: activating the summary focuses it, and .nav-links is
        // an overflow-x:auto strip, so the browser may scroll it into view after
        // this event. Skipped entirely in a background tab, where rAF never runs
        // - which is why the synchronous call above is the one that must stand.
        requestAnimationFrame(function () { if (drop.open) place(); });
      });

      // Defensive support for markup that arrives already open. The current
      // navbar does not use it, but MutationObserver-driven scans may encounter
      // an open details element added by another component.
      if (drop.open && !(MOBILE_NAV.matches && drop.closest(".navbar"))) {
        place();
        drop.setAttribute("data-nav-drop-positioned", "");
      }
    });
  }

  function closeNavDropdowns(target) {
    document.querySelectorAll(".nav-drop[open]").forEach(function (drop) {
      if (!target || !drop.contains(target)) drop.open = false;
    });
  }

  // ── Mobile navigation drawer ───────────────────────────────────────────
  // The ten nav entries do not fit the pill on a phone: fx.css turns them into
  // a horizontal scroll rail on a second row, which then overflows the pill's
  // own fixed height. Below 900px they become a drawer hanging under the pill
  // instead. The drawer is the existing .nav-links element restyled, so the
  // React navbar and the static copies need no extra toggle markup; only
  // this toggle button is injected, and only below 900px.
  function closeNavDrawer(nav) {
    const navs = nav ? [nav] : Array.from(document.querySelectorAll(".navbar.nav-open"));
    navs.forEach(function (n) {
      n.classList.remove("nav-open");
      const btn = n.querySelector(".nav-burger");
      if (btn) btn.setAttribute("aria-expanded", "false");
      n.querySelectorAll(".nav-drop[open]").forEach(function (d) { d.open = false; });
    });
  }

  function wireNavBurger(root) {
    if (!MOBILE_NAV.matches) return;
    const scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll(".navbar").forEach(function (nav) {
      if (nav.querySelector(".nav-burger")) return;
      const container = nav.querySelector(".container");
      const links = nav.querySelector(".nav-links");
      if (!container || !links) return;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "nav-burger";
      btn.setAttribute("aria-label", "Menu");
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = "<span></span>";

      // Current navbars wrap the CTA in .nav-right; the .nav-cta fallback keeps
      // this progressive enhancement compatible with older standalone markup.
      container.insertBefore(btn, container.querySelector(".nav-right, .nav-cta"));

      btn.addEventListener("click", function (e) {
        // Otherwise the document listener below sees this click as "outside".
        e.stopPropagation();
        const open = nav.classList.toggle("nav-open");
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (!open) nav.querySelectorAll(".nav-drop[open]").forEach(function (d) { d.open = false; });
      });

      // A tap on a destination should take the drawer with it.
      links.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeNavDrawer(nav);
      });
    });
  }

  // Crossing the breakpoint (rotation, a resized window) has to leave a navbar
  // that matches the width it is now at — including removing the button, so
  // the desktop DOM is byte-for-byte what it would have been on a fresh load.
  MOBILE_NAV.addEventListener("change", function () {
    closeNavDropdowns(null);
    document.querySelectorAll(".nav-drop").forEach(function (drop) {
      drop.removeAttribute("data-nav-drop-positioned");
    });
    if (MOBILE_NAV.matches) { wireNavBurger(document); return; }
    closeNavDrawer(null);
    document.querySelectorAll(".nav-burger").forEach(function (b) { b.remove(); });
  });

  document.addEventListener("click", function (e) {
    closeNavDropdowns(e.target);
    const open = document.querySelector(".navbar.nav-open");
    if (open && !open.contains(e.target)) closeNavDrawer(open);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    closeNavDropdowns(null);
    closeNavDrawer(null);
  });
  window.addEventListener("scroll", function () {
    // On a touch device the momentum scroll that follows tapping the summary
    // would dismiss the panel before it could be used.
    if (matchMedia("(pointer: fine)").matches) closeNavDropdowns(null);
  }, { passive: true });

  function scan(root) {
    enhanceCarouselDots(root || document);
    wireNavDropdowns(root || document);
    wireNavBurger(root || document);
  }

  window.ONDCFX = { scan: scan };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { scan(document); });
  } else {
    scan(document);
  }

  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.type === 'attributes') {
        scan(mutation.target.parentElement || document);
      } else {
        mutation.addedNodes.forEach(function (node) {
          if (node.nodeType === 1) scan(node.parentElement || node);
        });
      }
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class']
  });
})();
