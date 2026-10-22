(function () {
  'use strict';

  /* ===== Configuration de l'envoi =====
     ENDPOINT     : adresse d'un service de réception de formulaires (par exemple Formspree).
                    Renseignée, les formulaires sont réellement transmis à cette adresse.
     DESTINATAIRE : adresse e-mail de l'établissement. Renseignée, un bouton « Envoyer par e-mail »
                    apparaît dans le récapitulatif.
     Exemple : var DESTINATAIRE = 'contact@exemple.bj';                                          */
  var ENDPOINT = '';
  var DESTINATAIRE = '';

  /* ---------- En-tête et menu ---------- */
  var header = document.getElementById('header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 40); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  var toggle = document.getElementById('menu-toggle');
  var nav = document.getElementById('nav');
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') { toggle.checked = false; }
  });
  document.addEventListener('click', function (e) {
    if (toggle.checked && !header.contains(e.target)) { toggle.checked = false; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { toggle.checked = false; }
  });
  window.addEventListener('hashchange', function () { toggle.checked = false; });

  /* Le bouton flottant s'efface quand le pied de page est visible */
  var fab = document.querySelector('.fab');
  var foot = document.querySelector('.site-footer');
  if (fab && foot && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      fab.classList.toggle('fab-hide', entries[0].isIntersecting);
    }, { threshold: 0.15 }).observe(foot);
  }

  /* ---------- Formulaires ---------- */
  function fieldOf(el) { return el.closest('.field'); }

  function setError(field, msg) {
    field.classList.toggle('invalid', !!msg);
    var err = field.querySelector('.err');
    if (err) { err.textContent = msg || ''; }
    field.querySelectorAll('input,select,textarea').forEach(function (c) {
      c.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
  }

  function digitsCount(s) { return (s.match(/[0-9]/g) || []).length; }

  function checkField(field) {
    var controls = field.querySelectorAll('input,select,textarea');
    if (!controls.length) { return ''; }
    var first = controls[0];
    var required = first.hasAttribute('required');

    if (first.type === 'radio') {
      return (required && !field.querySelector('input:checked')) ? 'Veuillez faire un choix.' : '';
    }
    if (first.type === 'checkbox') {
      return (required && !first.checked) ? 'Cette confirmation est obligatoire.' : '';
    }

    var v = first.value.trim();
    if (!v) { return required ? 'Ce champ est obligatoire.' : ''; }

    var min = parseInt(first.getAttribute('minlength'), 10);
    if (min && v.length < min) { return 'Saisissez au moins ' + min + ' caractères.'; }

    if (first.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      return 'Adresse e-mail invalide (exemple : nom@domaine.com).';
    }
    if (first.type === 'tel') {
      var d = digitsCount(v);
      if (!/^\+?[0-9\s().-]+$/.test(v) || d < 8 || d > 15) {
        return 'Numéro invalide (8 à 15 chiffres, indicatif possible : +229…).';
      }
    }
    if (first.type === 'date') {
      var dt = new Date(v + 'T00:00:00');
      if (isNaN(dt.getTime()) || dt > new Date() || dt.getFullYear() < 1950) {
        return 'Date de naissance invalide.';
      }
    }
    if (first.type === 'number') {
      var n = Number(v), lo = Number(first.min), hi = Number(first.max);
      if (!Number.isInteger(n) || (first.min && n < lo) || (first.max && n > hi)) {
        return 'Valeur invalide (entre ' + first.min + ' et ' + first.max + ').';
      }
    }
    return '';
  }

  function collectRows(form) {
    var rows = [], seen = {};
    form.querySelectorAll('[data-label]').forEach(function (el) {
      var label = el.getAttribute('data-label');
      if (seen[label]) { return; }
      seen[label] = true;
      var value = '';
      if (el.type === 'radio') {
        var c = form.querySelector('input[name="' + el.name + '"]:checked');
        value = c ? c.value : '';
      } else if (el.type === 'checkbox') {
        value = el.checked ? 'Oui' : 'Non';
      } else if (el.tagName === 'SELECT') {
        value = el.value;
        var opt = el.options[el.selectedIndex];
        if (value && opt && opt.parentNode.tagName === 'OPTGROUP') {
          rows.push(['Domaine', opt.parentNode.label]);
        }
      } else if (el.type === 'date') {
        var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(el.value);
        value = m ? m[3] + '/' + m[2] + '/' + m[1] : el.value;
      } else {
        value = el.value.trim();
      }
      if (value) { rows.push([label, value]); }
    });
    return rows;
  }

  function recapText(title, rows, when) {
    var lines = [title, 'Généré le ' + when, ''];
    rows.forEach(function (r) { lines.push(r[0] + ' : ' + r[1]); });
    return lines.join('\n');
  }

  function copyText(text, done) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    }
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fallback);
    } else { fallback(); }
  }

  function initForm(form) {
    var result = document.getElementById(form.getAttribute('data-result'));
    var title = form.getAttribute('data-title');
    var errBox = form.querySelector('.form-error');
    var submitBtn = form.querySelector('button[type=submit]');
    var submitLabel = submitBtn ? submitBtn.textContent : '';

    var dateInput = form.querySelector('input[type=date]');
    if (dateInput) { dateInput.max = new Date().toISOString().slice(0, 10); }
    var yearInput = form.querySelector('input[data-year]');
    if (yearInput) { yearInput.max = new Date().getFullYear(); }

    function live(e) {
      var f = fieldOf(e.target);
      if (f && f.classList.contains('invalid')) { setError(f, checkField(f)); }
    }
    form.addEventListener('input', live);
    form.addEventListener('change', live);
    form.addEventListener('focusout', function (e) {
      var f = fieldOf(e.target);
      if (f && e.target.type !== 'radio' && e.target.type !== 'checkbox') {
        setError(f, checkField(f));
      }
    });

    function showError(msg) {
      if (!errBox) { return; }
      errBox.textContent = msg; errBox.hidden = false;
    }

    function showResult(rows, text, when, sent) {
      var dl = result.querySelector('dl');
      dl.innerHTML = '';
      rows.forEach(function (r) {
        var dt = document.createElement('dt'); dt.textContent = r[0];
        var dd = document.createElement('dd'); dd.textContent = r[1];
        dl.appendChild(dt); dl.appendChild(dd);
      });
      result.querySelector('h2').textContent = form.getAttribute(sent ? 'data-sent-title' : 'data-ready-title');
      result.querySelector('.after').textContent = form.getAttribute(sent ? 'data-sent-text' : 'data-ready-text');
      result.querySelector('.meta').textContent = 'Généré le ' + when;

      var copied = result.querySelector('.copied');
      copied.textContent = '';
      result.querySelector('[data-copy]').onclick = function () {
        copyText(text, function () { copied.textContent = 'Copié dans le presse-papiers.'; });
      };
      result.querySelector('[data-print]').onclick = function () { window.print(); };
      result.querySelector('[data-edit]').onclick = function () {
        result.hidden = true; form.hidden = false;
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      };
      var mail = result.querySelector('[data-mail]');
      if (mail) {
        if (DESTINATAIRE && !sent) {
          mail.href = 'mailto:' + DESTINATAIRE + '?subject=' + encodeURIComponent(title) +
                      '&body=' + encodeURIComponent(text);
          mail.hidden = false;
        } else { mail.hidden = true; }
      }
      form.hidden = true;
      result.hidden = false;
      result.setAttribute('tabindex', '-1');
      result.focus();
      result.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      form.querySelectorAll('.field').forEach(function (f) {
        var msg = checkField(f);
        setError(f, msg);
        if (msg && !firstBad) { firstBad = f; }
      });
      if (firstBad) {
        showError('Certains champs sont à corriger. Ils sont signalés en rouge.');
        var target = firstBad.querySelector('input,select,textarea');
        if (target) { target.focus(); }
        firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      if (errBox) { errBox.hidden = true; }

      var rows = collectRows(form);
      var when = new Date().toLocaleString('fr-FR');
      var text = recapText(title, rows, when);

      if (!ENDPOINT) { showResult(rows, text, when, false); return; }

      var payload = { formulaire: title };
      rows.forEach(function (r) { payload[r[0]] = r[1]; });
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Envoi en cours…'; }
      fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) { throw new Error('http ' + res.status); }
        showResult(rows, text, when, true);
      }).catch(function () {
        showError('L’envoi n’a pas abouti. Vérifiez votre connexion et réessayez.');
      }).then(function () {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitLabel; }
      });
    });
  }

  document.querySelectorAll('form[data-form]').forEach(initForm);
})();
