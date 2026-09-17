(() => {
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const iframe = $('#previewFrame');
  const frame = $('#frame');
  const storageKey = 'moham-admin-drafts-v3';
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.MOHAJER_FIREBASE_CONFIG);
  const db = app.firestore();

  let drafts = loadLocal();
  let selected = null;
  let original = null;
  let history = [];
  let future = [];
  let drag = null;
  let suppressClickUntil = 0;

  function loadLocal() {
    try { return JSON.parse(localStorage.getItem(storageKey) || '{}'); }
    catch { localStorage.removeItem(storageKey); return {}; }
  }
  const clone = value => JSON.parse(JSON.stringify(value));
  const notify = message => {
    $('#state').textContent = '● ' + message;
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => $('#state').textContent = '● همه تغییرات ذخیره شده', 2800);
  };
  const saveLocal = () => {
    localStorage.setItem(storageKey, JSON.stringify(drafts));
    $('#state').textContent = '● پیش‌نویس ذخیره شد';
  };

  async function saveRemoteDraft() {
    try {
      await db.collection('siteContent').doc('mohamDraft').set({
        content: drafts,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.warn('MOHAM draft could not be synced to Firestore:', error);
    }
  }

  function rgbHex(value) {
    const match = value?.match(/\d+/g);
    return match ? '#' + match.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('') : '#ffffff';
  }

  function transformXY(el) {
    const value = getComputedStyle(el).transform;
    if (!value || value === 'none') return { x: 0, y: 0 };
    try {
      const matrix = new DOMMatrix(value);
      return { x: Math.round(matrix.m41), y: Math.round(matrix.m42) };
    } catch { return { x: 0, y: 0 }; }
  }

  function setText(el, value) {
    const lines = String(value || '').split(/<br\s*\/?\s*>/i);
    el.replaceChildren();
    lines.forEach((line, index) => {
      if (index) el.append(el.ownerDocument.createElement('br'));
      el.append(el.ownerDocument.createTextNode(line));
    });
  }

  function uniqueSelector(el) {
    if (el.dataset.key) return `[data-key="${CSS.escape(el.dataset.key)}"]`;
    if (el.id) return `#${CSS.escape(el.id)}`;
    const parts = [];
    let node = el;
    while (node && node !== node.ownerDocument.body && parts.length < 6) {
      let part = node.tagName.toLowerCase();
      const classes = [...node.classList].filter(c => !c.startsWith('moham-'));
      if (classes[0]) part += '.' + CSS.escape(classes[0]);
      const siblings = [...node.parentElement.children].filter(x => x.tagName === node.tagName);
      if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ');
  }

  function findElement(doc, draft) {
    if (!doc || !draft) return null;
    try {
      if (draft.key) {
        const byKey = doc.querySelector(`[data-key="${CSS.escape(draft.key)}"]`);
        if (byKey) return byKey;
      }
      return draft.selector ? doc.querySelector(draft.selector) : null;
    } catch { return null; }
  }

  function applyDraft(el, draft) {
    if (!el || !draft) return;
    if (draft.type === 'image') el.src = draft.content || el.src;
    else if (draft.type === 'text') setText(el, draft.content);
    Object.entries(draft.styles || {}).forEach(([property, value]) => {
      if (value !== '' && value != null) el.style.setProperty(property, value, property.startsWith('background') ? 'important' : '');
    });
    if (draft.x != null || draft.y != null) el.style.transform = `translate(${draft.x || 0}px, ${draft.y || 0}px)`;
    if (draft.resizable) el.classList.add('moham-resizable');
  }

  function applyAll(doc) {
    if (!doc) return;
    Object.values(drafts).forEach(draft => applyDraft(findElement(doc, draft), draft));
  }

  function makePreviewInteractive() {
    const doc = iframe.contentDocument;
    if (!doc) return;
    applyAll(doc);

    const style = doc.createElement('style');
    style.id = 'moham-editor-style';
    style.textContent = `
      [data-key],img,section,.product-card,.ss-product-card,.feature-item-new,.feature-card,.catalog-banner,.hero-section,.dept-card,.ss-feature-box,.contact-form-container {
        cursor:move!important;transition:outline .12s,box-shadow .12s!important;
      }
      [data-key]:hover,img:hover,section:hover,.product-card:hover,.ss-product-card:hover,.feature-item-new:hover,.feature-card:hover,.catalog-banner:hover,.hero-section:hover,.dept-card:hover,.ss-feature-box:hover,.contact-form-container:hover {
        outline:2px solid #f97316!important;outline-offset:3px!important;
      }
      .moham-selected { outline:3px solid #f97316!important;outline-offset:3px!important;position:relative!important; }
      .moham-resizable { resize:both!important;overflow:auto!important;min-width:30px!important;min-height:25px!important; }
    `;
    doc.getElementById('moham-editor-style')?.remove();
    doc.head.append(style);

    if (doc.documentElement.dataset.mohamBound === '1') return;
    doc.documentElement.dataset.mohamBound = '1';

    doc.addEventListener('pointerdown', onPointerDown, true);
    doc.addEventListener('pointermove', onPointerMove, true);
    doc.addEventListener('pointerup', onPointerUp, true);
    doc.addEventListener('pointercancel', onPointerUp, true);
    doc.addEventListener('click', event => {
      if (Date.now() < suppressClickUntil) { event.preventDefault(); event.stopPropagation(); return; }
      const element = selectableElement(event.target);
      if (!element) return;
      event.preventDefault(); event.stopPropagation(); select(element);
    }, true);
    doc.addEventListener('dblclick', event => {
      const element = selectableElement(event.target);
      if (!element) return;
      event.preventDefault(); event.stopPropagation(); select(element);
    }, true);
  }

  function selectableElement(target) {
    return target?.closest?.('[data-key],img,.product-card,.ss-product-card,.feature-item-new,.feature-card,.catalog-banner,.hero-section,.dept-card,.ss-feature-box,.contact-form-container,section');
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    const element = selectableElement(event.target);
    if (!element) return;
    select(element);
    const start = transformXY(element);
    drag = { element, pointerId: event.pointerId, sx: event.clientX, sy: event.clientY, x: start.x, y: start.y, moved: false };
    try { element.setPointerCapture(event.pointerId); } catch {}
  }

  function onPointerMove(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.sx;
    const dy = event.clientY - drag.sy;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3 && !drag.moved) return;
    drag.moved = true;
    const x = Math.round(drag.x + dx);
    const y = Math.round(drag.y + dy);
    drag.element.style.transform = `translate(${x}px, ${y}px)`;
    if (selected === drag.element) { $('#x').value = x; $('#y').value = y; }
    event.preventDefault();
  }

  function onPointerUp(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const finished = drag;
    drag = null;
    if (!finished.moved) return;
    suppressClickUntil = Date.now() + 250;
    if (selected === finished.element) {
      history.push(clone(drafts)); future = [];
      const draft = readForm();
      drafts[draft.id] = draft;
      saveLocal(); saveRemoteDraft();
      notify('جابه‌جایی ذخیره شد');
    }
  }

  function select(element) {
    selected?.classList.remove('moham-selected');
    selected = element;
    selected.classList.add('moham-selected');
    const computed = iframe.contentWindow.getComputedStyle(element);
    const image = element.tagName === 'IMG';
    const text = Boolean(element.dataset.key) && !image;
    const existing = drafts[element.dataset.key || uniqueSelector(element)];
    const xy = existing ? { x: Number(existing.x) || 0, y: Number(existing.y) || 0 } : transformXY(element);

    original = {
      html: element.innerHTML,
      src: element.src || '',
      style: element.getAttribute('style') || '',
      className: element.className
    };

    $('#empty').classList.add('hidden');
    $('#form').classList.remove('hidden');
    $('#key').value = element.dataset.key || '';
    $('#selector').value = uniqueSelector(element);
    $('#title').textContent = image ? 'ویرایش تصویر' : text ? (element.dataset.key || 'ویرایش متن') : 'ویرایش کادر / بخش';
    $('#contentLabel').classList.toggle('hidden', !text);
    $('#imageLabel').classList.toggle('hidden', !image);
    $('#uploadLabel').classList.toggle('hidden', !image);

    if (text) $('#content').value = (element.innerText || element.textContent || '').trim();
    if (image) $('#image').value = element.src;
    $('#color').value = rgbHex(computed.color);
    $('#bg').value = computed.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : rgbHex(computed.backgroundColor);
    $('#bgImage').value = computed.backgroundImage === 'none' ? '' : computed.backgroundImage.replace(/^url\(["']?|["']?\)$/g, '');
    $('#width').value = Math.round(element.getBoundingClientRect().width);
    $('#height').value = Math.round(element.getBoundingClientRect().height);
    $('#x').value = Math.round(xy.x);
    $('#y').value = Math.round(xy.y);
    $('#fontSize').value = parseFloat(computed.fontSize) || 16;
    $('#fontWeight').value = parseInt(computed.fontWeight, 10) || 400;
    $('#opacity').value = computed.opacity || 1;
    $('#radius').value = parseInt(computed.borderRadius, 10) || 0;
    $('#shadow').value = computed.boxShadow === 'none' ? '' : computed.boxShadow;
    $$('[data-align]').forEach(button => button.classList.toggle('active', button.dataset.align === computed.textAlign));
  }

  function readForm() {
    if (!selected) return null;
    const image = selected.tagName === 'IMG';
    const key = $('#key').value || $('#selector').value;
    const styles = {
      color: $('#color').value,
      backgroundColor: $('#bg').value,
      backgroundImage: $('#bgImage').value ? `url("${$('#bgImage').value}")` : 'none',
      backgroundSize: $('#bgImage').value ? 'cover' : '',
      backgroundPosition: $('#bgImage').value ? 'center' : '',
      width: $('#width').value ? `${$('#width').value}px` : '',
      height: $('#height').value ? `${$('#height').value}px` : '',
      fontSize: $('#fontSize').value ? `${$('#fontSize').value}px` : '',
      fontWeight: $('#fontWeight').value || '',
      opacity: $('#opacity').value !== '' ? $('#opacity').value : '',
      borderRadius: `${$('#radius').value || 0}px`,
      boxShadow: $('#shadow').value || 'none',
      textAlign: document.querySelector('[data-align].active')?.dataset.align || ''
    };
    return {
      id: key,
      key: $('#key').value || '',
      selector: $('#selector').value,
      type: image ? 'image' : selected.dataset.key ? 'text' : 'container',
      content: image ? $('#image').value : $('#content').value.replace(/\n/g, '<br>'),
      styles,
      x: Number($('#x').value) || 0,
      y: Number($('#y').value) || 0,
      resizable: true,
      version: 4
    };
  }

  function liveApply() {
    if (!selected) return;
    const draft = readForm();
    if (draft) applyDraft(selected, draft);
  }

  $('#content').addEventListener('input', liveApply);
  $('#image').addEventListener('input', liveApply);
  $('#bgImage').addEventListener('input', liveApply);
  ['color','bg','width','height','x','y','fontSize','fontWeight','opacity','radius','shadow'].forEach(id => $('#' + id).addEventListener('input', liveApply));
  $$('[data-align]').forEach(button => button.addEventListener('click', () => {
    $$('[data-align]').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    liveApply();
  }));

  $('#upload').addEventListener('change', event => {
    const file = event.target.files?.[0];
    if (!file || !selected || selected.tagName !== 'IMG') return;
    if (file.size > 900 * 1024) { notify('حجم تصویر باید کمتر از ۹۰۰ کیلوبایت باشد'); return; }
    const reader = new FileReader();
    reader.onload = () => { $('#image').value = reader.result; selected.src = reader.result; };
    reader.readAsDataURL(file);
  });

  $('#apply').addEventListener('click', async () => {
    if (!selected) { notify('ابتدا یک عنصر را انتخاب کنید'); return; }
    const draft = readForm();
    if (!draft) return;
    history.push(clone(drafts)); future = [];
    drafts[draft.id] = draft;
    saveLocal();
    await saveRemoteDraft();
    notify('تغییرات ذخیره شد');
  });

  $('#cancel').addEventListener('click', () => {
    if (!selected || !original) return;
    selected.innerHTML = original.html;
    if (original.src) selected.src = original.src;
    selected.setAttribute('style', original.style);
    selected.className = original.className;
    select(selected);
    notify('تغییر لغو شد');
  });

  $('#undo').addEventListener('click', async () => {
    if (!history.length) return;
    future.push(clone(drafts));
    drafts = history.pop();
    saveLocal(); await saveRemoteDraft(); applyAll(iframe.contentDocument); notify('آخرین تغییر بازگردانده شد');
  });
  $('#redo').addEventListener('click', async () => {
    if (!future.length) return;
    history.push(clone(drafts));
    drafts = future.pop();
    saveLocal(); await saveRemoteDraft(); applyAll(iframe.contentDocument); notify('تغییر دوباره اعمال شد');
  });

  $$('[data-device]').forEach(button => button.addEventListener('click', () => {
    $$('[data-device]').forEach(x => x.classList.remove('active'));
    button.classList.add('active');
    frame.className = 'frame ' + button.dataset.device;
  }));
  $('#preview').addEventListener('click', () => window.open('../', '_blank', 'noopener'));

  const dialog = $('#dialog');
  $('#publish').addEventListener('click', () => dialog.showModal());
  $('#closeDialog').addEventListener('click', () => dialog.close());
  $('#confirm').addEventListener('click', async () => {
    const button = $('#confirm');
    button.disabled = true; button.textContent = 'در حال انتشار…';
    try {
      await db.collection('siteContent').doc('published').set({
        moham: {
          content: drafts,
          publishedAt: firebase.firestore.FieldValue.serverTimestamp()
        }
      }, { merge: true });
      dialog.close();
      notify('تغییرات MOHAM با موفقیت منتشر شد');
    } catch (error) {
      console.error('MOHAM publish failed:', error);
      notify('انتشار ناموفق بود؛ دسترسی Firestore را بررسی کنید');
    } finally { button.disabled = false; button.textContent = 'تأیید و انتشار'; }
  });

  iframe.addEventListener('load', () => makePreviewInteractive());
  window.addEventListener('beforeunload', () => { try { saveLocal(); } catch {} });

  (async () => {
    try {
      const snap = await db.collection('siteContent').doc('mohamDraft').get();
      if (snap.exists && snap.data().content) {
        drafts = { ...snap.data().content, ...drafts };
        saveLocal();
      }
    } catch (error) { console.warn('MOHAM remote draft unavailable:', error); }
    if (iframe.contentDocument?.readyState === 'complete') makePreviewInteractive();
    $('#undo').disabled = true; $('#redo').disabled = true;
  })();
})();