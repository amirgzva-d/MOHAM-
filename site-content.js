(() => {
  const apply = (content) => {
    if (!content || typeof content !== 'object') return;
    Object.values(content).forEach(draft => {
      if (!draft || !draft.key) return;
      const el = document.querySelector(`[data-key="${CSS.escape(draft.key)}"]`);
      if (!el) return;
      if (draft.type === 'image') el.src = draft.content || el.src;
      else if (draft.type === 'text') {
        const lines = String(draft.content || '').split(/<br\s*\/?\s*>/i);
        el.replaceChildren();
        lines.forEach((line, i) => { if (i) el.append(document.createElement('br')); el.append(document.createTextNode(line)); });
      }
      Object.entries(draft.styles || {}).forEach(([p,v]) => { if (v !== '') el.style.setProperty(p, v, p.startsWith('background') ? 'important' : ''); });
    });
  };
  window.addEventListener('DOMContentLoaded', async () => {
    try {
      const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(window.MOHAJER_FIREBASE_CONFIG);
      const db = app.firestore();
      const snap = await db.collection('siteContent').doc('published').get();
      const data = snap.exists ? snap.data() : null;
      if (data && data.moham && data.moham.content) apply(data.moham.content);
    } catch (error) { console.warn('MOHAM published content unavailable:', error); }
  });
})();
