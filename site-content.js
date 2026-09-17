(() => {
  const findElement = (doc, draft) => {
    if (!draft) return null;
    try {
      if (draft.key) {
        const byKey = doc.querySelector(`[data-key="${CSS.escape(draft.key)}"]`);
        if (byKey) return byKey;
      }
      return draft.selector ? doc.querySelector(draft.selector) : null;
    } catch { return null; }
  };
  const setText = (el, value) => {
    const lines = String(value || '').split(/<br\s*\/?\s*>/i);
    el.replaceChildren();
    lines.forEach((line, index) => {
      if (index) el.append(document.createElement('br'));
      el.append(document.createTextNode(line));
    });
  };
  const apply = content => {
    if (!content || typeof content !== 'object') return;
    Object.values(content).forEach(draft => {
      const el = findElement(document, draft);
      if (!el) return;
      if (draft.type === 'image') el.src = draft.content || el.src;
      else if (draft.type === 'text') setText(el, draft.content);
      Object.entries(draft.styles || {}).forEach(([property, value]) => {
        if (value !== '' && value != null) el.style.setProperty(property, value, property.startsWith('background') ? 'important' : '');
      });
      if (draft.x != null || draft.y != null) el.style.transform = `translate(${draft.x || 0}px, ${draft.y || 0}px)`;
    });
  };
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.MOHAJER_FIREBASE_CONFIG);
      const db = app.firestore();
      const snap = await db.collection('siteContent').doc('published').get();
      const data = snap.exists ? snap.data() : null;
      if (data?.moham?.content) apply(data.moham.content);
    } catch (error) { console.warn('MOHAM published content unavailable:', error); }
  });
})();