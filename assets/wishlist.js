/**
 * Reve Ski wishlist
 *
 * Saves product handles in the browser (localStorage), no app required.
 * - Any `.reve-wishlist[data-handle]` button toggles a product (heart fills, label switches)
 * - The header heart shows a count and opens #wishlist-drawer
 * - The drawer lists saved products (fetched from /products/{handle}.js) with remove links
 */
(function () {
  var KEY = 'rv-wishlist';

  function read() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(Boolean); } catch (e) { return []; }
  }

  function write(list) {
    try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
    document.dispatchEvent(new CustomEvent('reve:wishlist:change', { detail: { handles: list } }));
  }

  function has(handle) { return read().indexOf(handle) !== -1; }

  function toggle(handle) {
    var list = read(), i = list.indexOf(handle);
    i === -1 ? list.push(handle) : list.splice(i, 1);
    write(list);
  }

  function remove(handle) {
    write(read().filter(function (h) { return h !== handle; }));
  }

  function formatMoney(cents) {
    var format = (window.themeVariables && window.themeVariables.settings.moneyFormat) || '${{amount}}';
    var amount = (cents / 100).toFixed(2);
    return format.replace(/\{\{\s*amount\s*\}\}/, amount)
      .replace(/\{\{\s*amount_no_decimals\s*\}\}/, Math.round(cents / 100))
      .replace(/\{\{\s*amount_with_comma_separator\s*\}\}/, amount.replace('.', ','))
      .replace(/<[^>]+>/g, '');
  }

  /* ---- buttons ---- */
  function syncButtons(root) {
    (root || document).querySelectorAll('.reve-wishlist[data-handle]').forEach(function (btn) {
      btn.classList.toggle('is-active', has(btn.dataset.handle));
      btn.setAttribute('aria-pressed', has(btn.dataset.handle) ? 'true' : 'false');
    });
  }

  document.addEventListener('click', function (event) {
    var btn = event.target.closest('.reve-wishlist[data-handle]');
    if (btn) { event.preventDefault(); if (btn.dataset.handle) toggle(btn.dataset.handle); return; }

    var rm = event.target.closest('[data-wishlist-remove]');
    if (rm) { event.preventDefault(); remove(rm.dataset.wishlistRemove); }
  });

  /* ---- header count ---- */
  function syncCount() {
    var n = read().length;
    document.querySelectorAll('[data-wishlist-count]').forEach(function (el) {
      var span = el.querySelector('span');
      span ? span.textContent = n : el.textContent = n;
      el.classList.toggle('is-visible', n > 0);
    });
  }

  /* ---- drawer ---- */
  var cache = {};

  function root() {
    return (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';
  }

  function fetchProduct(handle) {
    if (cache[handle]) return cache[handle];
    cache[handle] = fetch(root() + 'products/' + handle + '.js', { credentials: 'same-origin', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (p) {
        if (p) return p;
        // Fallback so the drawer never looks empty: link by handle
        return { handle: handle, title: handle.replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }), price: null, featured_image: null, _fallback: true };
      });
    return cache[handle];
  }

  function renderDrawer() {
    var list = document.getElementById('wishlist-drawer-items');
    if (!list) return;
    var handles = read();
    var empty = document.getElementById('wishlist-drawer-empty');
    if (empty) empty.hidden = handles.length > 0;
    if (!handles.length) { list.innerHTML = ''; return; }
    if (!list.children.length) list.innerHTML = '<li class="wishlist-drawer__loading text-subdued">Loading…</li>';

    Promise.all(handles.map(fetchProduct)).then(function (products) {
      list.innerHTML = products.map(function (p, i) {
        if (!p) return '';
        var img = p.featured_image ? p.featured_image.replace(/(\.[a-z]+)(\?.*)?$/i, '_400x$1$2') : '';
        return '' +
          '<li class="wishlist-drawer__item">' +
            '<a href="' + root() + 'products/' + p.handle + '" class="wishlist-drawer__media">' + (img ? '<img src="' + img + '" alt="" loading="lazy" width="200" height="200">' : '') + '</a>' +
            '<div class="wishlist-drawer__info">' +
              '<a href="' + root() + 'products/' + p.handle + '" class="wishlist-drawer__title">' + p.title + '</a>' +
              (p.price != null ? '<span class="wishlist-drawer__price">' + formatMoney(p.price) + '</span>' : '') +
              '<div class="wishlist-drawer__actions">' +
                '<a href="' + root() + 'products/' + p.handle + '" class="wishlist-drawer__link">View product</a>' +
                '<button type="button" class="wishlist-drawer__remove" data-wishlist-remove="' + handles[i] + '">Remove</button>' +
              '</div>' +
            '</div>' +
          '</li>';
      }).join('');
    });
  }

  function refresh() { syncButtons(); syncCount(); renderDrawer(); }

  document.addEventListener('DOMContentLoaded', refresh);
  document.addEventListener('reve:wishlist:change', refresh);
  document.addEventListener('shopify:section:load', function (e) { syncButtons(e.target); syncCount(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('[aria-controls="wishlist-drawer"]')) setTimeout(renderDrawer, 50);
  });
  if (document.readyState !== 'loading') refresh();

  // Editorial (rv-) hearts share the same storage key: refresh the badge/drawer after they toggle
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-rv-wish]')) setTimeout(refresh, 30);
  });

  // Editorial AJAX add-to-cart -> refresh and open the theme cart drawer
  document.addEventListener('rv:cart-added', function () {
    Promise.all([
      fetch(root() + 'cart.js').then(function (r) { return r.json(); }),
      fetch(root() + '?sections=cart-drawer').then(function (r) { return r.json(); }).catch(function () { return {}; })
    ]).then(function (res) {
      var cart = res[0]; cart.sections = res[1] || {};
      document.documentElement.dispatchEvent(new CustomEvent('cart:change', { bubbles: true, detail: { baseEvent: 'variant:add', cart: cart } }));
      document.documentElement.dispatchEvent(new CustomEvent('cart:refresh', { bubbles: true }));
    });
  });

  // Prestige variant picker inside the editorial product sections: mirror the theme behaviour
  // (price, image, add-to-cart state, sticky bar) when the selected variant changes
  document.addEventListener('variant:change', function (e) {
    var v = e.detail && e.detail.variant, form = e.target;
    var el = form && form.closest ? form.closest('[data-rv-product]') : null;
    if (!el) return;
    var price = el.querySelector('[data-rv-price]');
    var img = el.querySelector('[data-rv-variant-img]');
    var btn = form.querySelector('[data-rv-atc]');
    var id = form.querySelector('input[name="id"]');
    var sticky = document.querySelector('[data-rv-sticky="' + el.dataset.rvProduct + '"]');
    if (!v) {
      if (btn) { btn.disabled = true; btn.textContent = btn.dataset.unavailable || 'Unavailable'; }
      return;
    }
    if (id) id.value = v.id;
    if (price) price.innerHTML = formatMoney(v.price) + (v.compare_at_price > v.price ? ' <s>' + formatMoney(v.compare_at_price) + '</s>' : '');
    if (img && v.featured_media && v.featured_media.preview_image) {
      img.src = v.featured_media.preview_image.src.replace(/(\.[a-z]+)(\?.*)?$/i, '_1600x$1$2'); img.removeAttribute('srcset');
    }
    if (btn) { btn.disabled = !v.available; btn.textContent = v.available ? (btn.dataset.add || 'Add to cart') : (btn.dataset.soldout || 'Sold out'); }
    var gallery = el.querySelector('[data-rv-gallery]');
    if (gallery) {
      var names = (gallery.dataset.rvOptionNames || '').split('|');
      var values = {};
      names.forEach(function (n, i) { values[n.toLowerCase()] = String(v.options[i] || '').toLowerCase(); });
      gallery.querySelectorAll('[data-rv-group-option]').forEach(function (fig) {
        var match = values[fig.dataset.rvGroupOption.toLowerCase()] === fig.dataset.rvGroupValue.toLowerCase();
        var isVariantImage = v.featured_media && String(v.featured_media.id) === fig.dataset.rvMediaId;
        fig.hidden = !(match || isVariantImage);
      });
      if (v.featured_media) {
        var target = gallery.querySelector('[data-rv-media-id="' + v.featured_media.id + '"]');
        if (target && window.innerWidth < 990) target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
    if (sticky) {
      var sv = sticky.querySelector('[data-rv-sticky-variant]'); if (sv) sv.textContent = v.title;
      var sb = sticky.querySelector('[data-rv-atc]'); if (sb && btn) { sb.disabled = btn.disabled; sb.textContent = btn.textContent; }
    }
  });

  window.ReveWishlist = { read: read, has: has, toggle: toggle, remove: remove };
})();
