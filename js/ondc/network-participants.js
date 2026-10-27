/* Participant directory — list switching, filtering, search, paging, export.
   =====================================================================
   Every row is already in the page: Eleventy renders all of them at build
   time from src/_data/network_participants.json. This script only ever
   toggles `hidden` on nodes that exist and writes text into elements that
   exist. It never creates, moves or removes one.

   That is deliberate, and it is the rule the Buyer App directory and the RFP
   ledger follow. Inside the CloudCannon editor Bookshop replaces the
   section's DOM on every keystroke; a script that rebuilt the tree, the chips
   or the page numbers would fight the re-render in a loop. Hiding is
   idempotent — running it twice does what running it once does — so a
   re-render costs nothing but a re-run.

   It is also why the filter chips and the page numbers are drawn in full by
   the template and hidden: a chip this script had to create is a chip that
   disappears on the next keystroke in the editor.

   Markup contract (all data attributes, so ids stay free for anchors):
     [data-np-directory]   the section, carries the settings
     [data-np-tree]        the category panel
       [data-np-branch]      one category, with [data-cat]
       [data-np-cat]         its checkbox
       [data-np-leaf]        one sub-category row
       [data-np-sub]         its checkbox, with [data-parent]
       [data-np-count]       the number beside any option
     [data-np-rolebar]     the role toggles, each [data-np-role]
     [data-np-search]      the search box
     [data-np-listdrop]    the list switcher, buttons [data-np-tab]
     [data-np-tablabel]    the switcher's own label
     [data-np-tabnote]     the line under it
     [data-np-body]        one <tbody> per list, with [data-np-index]
     [data-np-row]         one row, with [data-np-roles|cats|name|text]
     [data-np-empty]       the "nothing matches" row inside each <tbody>
     [data-np-chips]       the active-filter row, chips [data-np-chip]
     [data-np-clear]       "Clear all"
     [data-np-caption]     "150 participants · showing 1–20"
     [data-np-pagination]  [data-np-rpp] [data-np-prev] [data-np-next]
                           [data-np-num] × 5  [data-np-gap] × 2
     [data-np-export]      the Export CSV button

   Safe to load on any page: does nothing when no directory is present.
   ===================================================================== */
(function () {
  'use strict';

  var OTHER = 'Other';

  function editing() {
    return document.documentElement.classList.contains('is-editing');
  }

  function text(el, value) {
    if (el && el.textContent !== value) el.textContent = value;
  }

  function split(value) {
    return String(value || '').split('|').map(function (s) { return s.trim(); }).filter(Boolean);
  }

  function setup(root) {
    if (root._npReady) return;          // survives a re-render without stacking listeners
    root._npReady = true;

    var bodies = [].slice.call(root.querySelectorAll('[data-np-body]'));
    if (!bodies.length) return;

    var tree = root.querySelector('[data-np-tree]');
    var roleBar = root.querySelector('[data-np-rolebar]');
    var search = root.querySelector('[data-np-search]');
    var listDrop = root.querySelector('[data-np-listdrop]');
    var tabLabel = root.querySelector('[data-np-tablabel]');
    var tabNote = root.querySelector('[data-np-tabnote]');
    var chipWrap = root.querySelector('[data-np-chips]');
    var clearAll = root.querySelector('[data-np-clear]');
    var caption = root.querySelector('[data-np-caption]');
    var rppSelect = root.querySelector('[data-np-rpp]');
    var prevBtn = root.querySelector('[data-np-prev]');
    var nextBtn = root.querySelector('[data-np-next]');
    var numBtns = [].slice.call(root.querySelectorAll('[data-np-num]'));
    var gaps = [].slice.call(root.querySelectorAll('[data-np-gap]'));
    var exportBtn = root.querySelector('[data-np-export]');

    var noun = root.getAttribute('data-np-noun') || 'participant';
    var nounPlural = root.getAttribute('data-np-noun-plural') || noun + 's';
    var exportName = root.getAttribute('data-np-export-name') || 'participants';

    /* Selections live here rather than being read back out of the DOM: a list
       switch hides whichever options the new list has no rows for, and a
       DOM-derived selection would silently lose whatever that hiding took off
       the page — or keep filtering from a tick nobody can see to untick. */
    var sel = { role: {}, cat: {}, sub: {} };
    var listIndex = 0;
    var page = 1;
    var perPage = parseInt(root.getAttribute('data-np-per-page'), 10) || 20;
    var query = '';

    /* ── the taxonomy, read back off the tree the template drew ──────────
       Keeping it here rather than in a second copy inside this file means a
       category added to src/_data/np_categories.json needs no code change. */
    var parentOf = {};
    var isParent = {};
    [].forEach.call(root.querySelectorAll('[data-np-branch]'), function (branch) {
      isParent[branch.getAttribute('data-cat')] = true;
    });
    [].forEach.call(root.querySelectorAll('[data-np-sub]'), function (input) {
      parentOf[input.value] = input.getAttribute('data-parent');
    });

    /* A bare category name is its own parent; anything the taxonomy has no row
       for lands under "Other", so a category introduced by next month's data
       drop stays visible and filterable. */
    function sectorOf(cat) {
      if (isParent[cat]) return cat;
      return Object.prototype.hasOwnProperty.call(parentOf, cat) ? parentOf[cat] : OTHER;
    }

    /* ── rows ─────────────────────────────────────────────────────────── */
    bodies.forEach(function (body) {
      body._npRows = [].slice.call(body.querySelectorAll('[data-np-row]')).map(function (tr) {
        return {
          el: tr,
          roles: split(tr.getAttribute('data-np-roles')),
          cats: split(tr.getAttribute('data-np-cats')),
          text: (tr.getAttribute('data-np-text') || '').toLowerCase()
        };
      });
      body._npEmpty = body.querySelector('[data-np-empty]');
    });

    function rows() { return bodies[listIndex]._npRows; }

    function size(set) { return Object.keys(set).length; }

    /* ── counts, and hiding the options this list cannot offer ──────────
       An option that cannot be ticked is a question the reader should never
       have been asked — and greyed out would read as "no participants" when
       the truth is "none in this list". */
    function recount() {
      var parents = {}, children = {}, roles = {};

      rows().forEach(function (row) {
        var seenParent = {}, seenChild = {};
        row.cats.forEach(function (cat) {
          var parent = sectorOf(cat);
          if (!seenParent[parent]) { seenParent[parent] = 1; parents[parent] = (parents[parent] || 0) + 1; }
          /* A row carrying the bare category name has no child to count,
             unless the taxonomy makes that category its own child. */
          if (isParent[cat] && parentOf[cat] !== cat) return;
          if (seenChild[cat]) return;
          seenChild[cat] = 1;
          children[cat] = (children[cat] || 0) + 1;
        });
        var seenRole = {};
        row.roles.forEach(function (r) {
          if (seenRole[r]) return;
          seenRole[r] = 1;
          roles[r] = (roles[r] || 0) + 1;
        });
      });

      [].forEach.call(root.querySelectorAll('[data-np-branch]'), function (branch) {
        var name = branch.getAttribute('data-cat');
        var n = parents[name] || 0;
        branch.hidden = n === 0;
        text(branch.querySelector('[data-np-count]'), String(n));
        if (!n && sel.cat[name]) { delete sel.cat[name]; branch.querySelector('[data-np-cat]').checked = false; }

        [].forEach.call(branch.querySelectorAll('[data-np-leaf]'), function (leaf) {
          var input = leaf.querySelector('[data-np-sub]');
          var kn = children[input.value] || 0;
          leaf.hidden = kn === 0;
          text(leaf.querySelector('[data-np-count]'), String(kn));
          if (!kn && sel.sub[input.value]) { delete sel.sub[input.value]; input.checked = false; }
        });
      });

      if (roleBar) {
        [].forEach.call(roleBar.querySelectorAll('[data-np-role]'), function (btn) {
          var value = btn.getAttribute('data-np-role');
          var n = roles[value] || 0;
          btn.hidden = n === 0;
          text(btn.querySelector('[data-np-count]'), String(n));
          if (!n && sel.role[value]) { delete sel.role[value]; btn.setAttribute('aria-pressed', 'false'); }
        });
      }
    }

    /* ── expanding a branch ───────────────────────────────────────────────
       View state, not a filter: it never changes which rows show. */
    function setOpen(branch, open) {
      var kids = branch.querySelector('.bk-np-cat-kids');
      var toggle = branch.querySelector('.bk-np-cat-toggle');
      /* A category this list has no sub-categories for has no kids box and no
         toggle button — its words are the checkbox's label. Nothing to open,
         and the ticking path calls through here, so bailing quietly is the
         whole job. */
      if (!kids || !toggle || toggle.tagName !== 'BUTTON') return;
      branch.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      kids.hidden = !open;
    }

    /* ── filtering ────────────────────────────────────────────────────── */
    function matchesRole(row) {
      if (!size(sel.role)) return true;
      for (var i = 0; i < row.roles.length; i++) if (sel.role[row.roles[i]]) return true;
      return false;
    }

    /* A category on its own means "everything under it". Tick sub-categories
       of that same category and only those count. Built once per pass rather
       than once per row. */
    function categoryMatcher() {
      if (!size(sel.cat) && !size(sel.sub)) return function () { return true; };
      var narrowed = {};
      Object.keys(sel.sub).forEach(function (s) { narrowed[sectorOf(s)] = true; });
      return function (row) {
        for (var i = 0; i < row.cats.length; i++) {
          var c = row.cats[i];
          if (sel.sub[c]) return true;
          var parent = sectorOf(c);
          if (sel.cat[parent] && !narrowed[parent]) return true;
        }
        return false;
      };
    }

    function renderChips() {
      if (!chipWrap) return;
      var any = false;
      [].forEach.call(chipWrap.querySelectorAll('[data-np-chip]'), function (chip) {
        var on = !!sel[chip.getAttribute('data-np-chip')][chip.getAttribute('data-value')];
        chip.hidden = !on;
        if (on) any = true;
      });
      if (clearAll) clearAll.hidden = !any;
      chipWrap.hidden = !any;
    }

    /* ── paging ────────────────────────────────────────────────────────
       Seven slots the template already drew: first, a gap, three around the
       current page, a gap, last. Filling them is text and `hidden`, never a
       new node. */
    function renderPagination(pageCount) {
      var wanted = [1];
      if (page > 3) wanted.push('gap');
      for (var i = Math.max(2, page - 1); i <= Math.min(pageCount - 1, page + 1); i++) wanted.push(i);
      if (page < pageCount - 2) wanted.push('gap');
      if (pageCount > 1) wanted.push(pageCount);

      var numbers = wanted.filter(function (n) { return n !== 'gap'; });
      numBtns.forEach(function (btn, i) {
        var n = numbers[i];
        btn.hidden = n === undefined;
        if (n === undefined) return;
        text(btn, String(n));
        btn._npPage = n;
        btn.classList.toggle('active', n === page);
        if (n === page) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      });
      /* Two gaps, in slot order: the leading one only when the first number on
         show is not 2, the trailing one only when the last is not pageCount-1. */
      if (gaps[0]) gaps[0].hidden = wanted.indexOf('gap') !== 1;
      if (gaps[1]) gaps[1].hidden = wanted.lastIndexOf('gap') <= 1;

      if (prevBtn) prevBtn.disabled = page <= 1;
      if (nextBtn) nextBtn.disabled = page >= pageCount;
    }

    function apply() {
      var matchesCategory = categoryMatcher();
      var all = rows();
      var shown = [];
      for (var i = 0; i < all.length; i++) {
        var row = all[i];
        if (matchesRole(row) && matchesCategory(row) && (!query || row.text.indexOf(query) !== -1)) shown.push(row);
      }

      var total = shown.length;
      var pageCount = Math.max(1, Math.ceil(total / perPage));
      if (page > pageCount) page = pageCount;
      if (page < 1) page = 1;
      var first = (page - 1) * perPage;
      var last = first + perPage;

      /* Hide every row in every list, then reveal this page's slice — one
         pass per row. The lists other than the visible one are swept too: the
         <tbody> around them is hidden, but a row left marked visible inside it
         still answers a find-in-page and still reads out to a screen reader
         walking the table. */
      bodies.forEach(function (body) {
        var rs = body._npRows;
        for (var j = 0; j < rs.length; j++) rs[j].el.hidden = true;
      });
      for (var k = first; k < last && k < total; k++) shown[k].el.hidden = false;

      bodies.forEach(function (body, index) {
        if (body._npEmpty) body._npEmpty.hidden = index !== listIndex || total !== 0;
      });

      text(caption, total === 0
        ? 'No ' + nounPlural + ' match these filters'
        : total.toLocaleString() + ' ' + (total === 1 ? noun : nounPlural) +
          ' · showing ' + (first + 1).toLocaleString() + '–' + Math.min(total, last).toLocaleString());

      if (exportBtn) exportBtn.disabled = total === 0;
      renderChips();
      renderPagination(pageCount);
      root._npShown = shown;
    }

    /* ── list switching ───────────────────────────────────────────────── */
    function switchList(index) {
      if (index === listIndex) return;
      listIndex = index;
      bodies.forEach(function (body, i) { body.hidden = i !== index; });
      if (listDrop) {
        [].forEach.call(listDrop.querySelectorAll('[data-np-tab]'), function (btn) {
          var on = parseInt(btn.getAttribute('data-np-tab'), 10) === index;
          btn.classList.toggle('active', on);
          if (on) {
            btn.setAttribute('aria-current', 'true');
            text(tabLabel, btn.textContent.trim());
            /* Not in the editor: the note is click-to-edit copy bound to this
               list's field, and overwriting it would detach that binding. */
            if (!editing()) text(tabNote, btn.getAttribute('data-np-note') || '');
          } else {
            btn.removeAttribute('aria-current');
          }
        });
        listDrop.open = false;          // picking a list closes the menu
      }
      page = 1;
      recount();
      apply();
    }

    /* ── listeners (delegated, so they survive a re-render) ───────────── */
    if (tree) {
      tree.addEventListener('change', function (e) {
        var input = e.target;
        if (!input.matches) return;
        if (input.matches('[data-np-cat]')) {
          if (input.checked) {
            sel.cat[input.value] = true;
            /* Ticking a category opens it, so what that one tick just selected
               is visible rather than implied. */
            setOpen(input.closest('[data-np-branch]'), true);
          } else {
            delete sel.cat[input.value];
            /* Its sub-categories go too: they are about to stop meaning
               anything, and a tick nobody can see must not filter the table. */
            Object.keys(sel.sub).forEach(function (s) {
              if (sectorOf(s) === input.value) {
                delete sel.sub[s];
                var box = tree.querySelector('[data-np-sub][value="' + (window.CSS && CSS.escape ? CSS.escape(s) : s) + '"]');
                if (box) box.checked = false;
              }
            });
          }
        } else if (input.matches('[data-np-sub]')) {
          if (input.checked) sel.sub[input.value] = true;
          else delete sel.sub[input.value];
        } else {
          return;
        }
        page = 1;
        apply();
      });

      tree.addEventListener('click', function (e) {
        var toggle = e.target.closest('.bk-np-cat-toggle');
        if (!toggle || toggle.tagName !== 'BUTTON') return;
        var branch = toggle.closest('[data-np-branch]');
        setOpen(branch, !branch.classList.contains('is-open'));
      });
    }

    if (roleBar) {
      roleBar.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-np-role]');
        if (!btn) return;
        var on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        if (on) sel.role[btn.getAttribute('data-np-role')] = true;
        else delete sel.role[btn.getAttribute('data-np-role')];
        page = 1;
        apply();
      });
    }

    if (chipWrap) {
      chipWrap.addEventListener('click', function (e) {
        var chip = e.target.closest('[data-np-chip]');
        if (chip) {
          var group = chip.getAttribute('data-np-chip');
          var value = chip.getAttribute('data-value');
          delete sel[group][value];
          if (group === 'cat') {
            Object.keys(sel.sub).forEach(function (s) { if (sectorOf(s) === value) delete sel.sub[s]; });
          }
        } else if (e.target.closest('[data-np-clear]')) {
          sel = { role: {}, cat: {}, sub: {} };
        } else {
          return;
        }
        /* The tree and the role row have to lose their ticks too. */
        [].forEach.call(root.querySelectorAll('[data-np-cat]'), function (i) { i.checked = !!sel.cat[i.value]; });
        [].forEach.call(root.querySelectorAll('[data-np-sub]'), function (i) { i.checked = !!sel.sub[i.value]; });
        [].forEach.call(root.querySelectorAll('[data-np-role]'), function (b) {
          b.setAttribute('aria-pressed', String(!!sel.role[b.getAttribute('data-np-role')]));
        });
        page = 1;
        apply();
      });
    }

    if (search) {
      var timer;
      search.addEventListener('input', function (e) {
        var value = e.target.value.trim().toLowerCase();
        clearTimeout(timer);
        timer = setTimeout(function () {
          query = value;
          page = 1;
          apply();
        }, 180);
      });
    }

    if (listDrop) {
      listDrop.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-np-tab]');
        if (!btn) return;
        switchList(parseInt(btn.getAttribute('data-np-tab'), 10));
      });
      /* <details> stays open on an outside click; the navbar dropdowns close
         the same way (see closeNavDropdowns in fx.js). */
      document.addEventListener('click', function (e) {
        if (listDrop.open && !listDrop.contains(e.target)) listDrop.open = false;
      });
    }

    /* A participant live on seven categories shows three and a +N. The rest
       are already in the row, hidden — no fetch, no second render. */
    root.addEventListener('click', function (e) {
      var more = e.target.closest('.bk-np-more');
      if (!more) return;
      var cell = more.closest('td');
      var open = more.getAttribute('aria-expanded') !== 'true';
      more.setAttribute('aria-expanded', String(open));
      cell.classList.toggle('is-expanded', open);
      cell.querySelector('.bk-np-cat-rest').hidden = !open;
    });

    if (rppSelect) {
      rppSelect.addEventListener('change', function (e) {
        perPage = parseInt(e.target.value, 10) || perPage;
        page = 1;
        apply();
      });
    }
    /* Paging moves the reader to a different set of rows, so the top of the
       table has to come back into view — otherwise page 2 starts wherever
       page 1 happened to be scrolled to. */
    function toTop() {
      if (root.scrollIntoView) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function step(delta) {
      page += delta;
      apply();
      toTop();
    }
    if (prevBtn) prevBtn.addEventListener('click', function () { if (page > 1) step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { step(1); });
    numBtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (btn._npPage && btn._npPage !== page) { page = btn._npPage; apply(); toTop(); }
      });
    });

    /* ── export ────────────────────────────────────────────────────────
       What the reader is looking at, not what the data file holds: the CSV is
       whatever the filters and the search have left on screen, in the order
       the table shows it. Read back off the rendered row so there is one
       definition of each value rather than two that can drift. */
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        var shown = root._npShown || [];
        if (!shown.length) return;
        var headers = ['Participant', 'Role', 'Categories', 'Technology Service Provider',
          'Contact person', 'Email', 'Phone', 'Website'];
        var lines = [headers.map(cell).join(',')];
        shown.forEach(function (row) {
          var el = row.el;
          var spoc = el.querySelector('.bk-np-spoc');
          var mail = el.querySelector('a[href^="mailto:"]');
          var tel = el.querySelector('a[href^="tel:"]');
          var site = el.querySelector('.bk-np-contact a[target="_blank"]');
          lines.push([
            el.getAttribute('data-np-name') || '',
            row.roles.join(', '),
            row.cats.join(', '),
            el.getAttribute('data-np-enabled') || '',
            spoc ? spoc.textContent.trim() : '',
            mail ? decodeURIComponent(mail.getAttribute('href').slice(7)) : '',
            tel ? decodeURIComponent(tel.getAttribute('href').slice(4)) : '',
            site ? site.getAttribute('href') : ''
          ].map(cell).join(','));
        });
        download(lines.join('\n'), exportName + '.csv');
      });
    }

    function cell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }

    function download(body, filename) {
      /* ﻿ so Excel opens it as UTF-8 rather than mangling every name
         with an accent in it. */
      var blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8;' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    recount();
    apply();
  }

  function scan() {
    document.querySelectorAll('[data-np-directory]').forEach(setup);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }

  // Bookshop swaps the section's DOM while editing, which drops the listeners
  // and the _npReady flag with it. Re-running setup on the new nodes is all
  // that is needed; the flag stops it stacking listeners on untouched ones.
  if (window.MutationObserver) {
    var pending = null;
    new MutationObserver(function () {
      clearTimeout(pending);
      pending = setTimeout(scan, 80);
    }).observe(document.body, { childList: true, subtree: true });
  }
})();
