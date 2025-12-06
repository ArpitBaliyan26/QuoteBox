document.addEventListener('DOMContentLoaded', () => {
  const STORAGE_KEY = 'quotesDB';
  const THEME_KEY = 'quotebox_theme';

  const quoteInput = document.getElementById('quote-input');
  const addBtn = document.getElementById('add-btn');
  const clearBtn = document.getElementById('clear-btn');
  const list = document.getElementById('quotes-list');
  const sortSelect = document.getElementById('sort-select');
  const lockCheckbox = document.getElementById('lock-order');
  const searchInput = document.getElementById('search-input');
  const themeToggle = document.getElementById('theme-toggle');
  const sortWrapper = document.getElementById('sort-wrapper');
  const sortTooltip = document.getElementById('sort-tooltip');
  const listStyleWrap = document.getElementById('list-style-wrap');
  const listStyleSelect = document.getElementById('list-style-select');
  const addFloating = document.getElementById('add-floating');
  const header = document.getElementById('site-header');

  let draggingState = null;
  let tooltipTimer = null;

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    try { return raw ? JSON.parse(raw) : []; }
    catch { localStorage.removeItem(STORAGE_KEY); return []; }
  }

  function save(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  function move(arr, from, to) {
    if (from === to) return;
    const item = arr.splice(from, 1)[0];
    arr.splice(to, 0, item);
  }

  function sortedView(arr, mode) {
    const a = arr.slice();
    if (mode === 'newest') return a.slice().reverse();
    if (mode === 'oldest') return a.slice();
    if (mode === 'az') return a.slice().sort((x,y)=>x.toLowerCase().localeCompare(y.toLowerCase()));
    if (mode === 'za') return a.slice().sort((x,y)=>y.toLowerCase().localeCompare(x.toLowerCase()));
    return a;
  }

  function filteredView(arr, mode, query) {
    const v = sortedView(arr, mode);
    if (!query) return v;
    const q = query.trim().toLowerCase();
    return v.filter(s => s.toLowerCase().includes(q));
  }

  function startDrag(li, startIndex, text) {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.textContent = text;
    document.body.appendChild(ghost);

    const placeholder = document.createElement('div');
    placeholder.className = 'li-placeholder';
    li.parentNode.insertBefore(placeholder, li.nextSibling);
    li.style.display = 'none';

    draggingState = { startIndex, ghost, placeholder };

    const onMove = (ev) => {
      ghost.style.left = ev.clientX + 'px';
      ghost.style.top = ev.clientY + 'px';

      const items = Array.from(list.querySelectorAll('li')).filter(i => !i.classList.contains('li-placeholder'));
      let insertBefore = null;
      for (const it of items) {
        const r = it.getBoundingClientRect();
        if (ev.clientY < r.top + r.height / 2) { insertBefore = it; break; }
      }
      if (insertBefore) list.insertBefore(placeholder, insertBefore);
      else list.appendChild(placeholder);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      const children = Array.from(list.children);
      const toIndex = children.indexOf(draggingState.placeholder);
      const original = Array.from(list.querySelectorAll('li')).find(el => el.style.display === 'none');
      if (original) original.remove();
      draggingState.placeholder.remove();
      draggingState.ghost.remove();

      const arr = load();
      move(arr, startIndex, toIndex);
      save(arr);
      draggingState = null;
      render();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp, { once: true });
  }

  function createItem(text, viewIndex, options) {
    const { isCustom, searchActive, draggableAllowed, markerText, showMarker } = options;

    const li = document.createElement('li');
    li.dataset.index = viewIndex;

    const left = document.createElement('div'); left.className = 'marker';
    if (showMarker) left.textContent = markerText || '';
    else left.innerHTML = '<span class="handle">≡</span>';

    const center = document.createElement('div'); center.className = 'quote'; center.textContent = text;

    const right = document.createElement('div'); right.className = 'item-right';

    const edit = document.createElement('button'); edit.className = 'edit-btn'; edit.textContent = 'Edit';
    const up = document.createElement('button'); up.className = 'move-up-btn'; up.textContent = '▲';
    const down = document.createElement('button'); down.className = 'move-down-btn'; down.textContent = '▼';
    const del = document.createElement('button'); del.className = 'delete-btn'; del.textContent = 'Delete';

    right.append(edit, up, down, del);

    edit.addEventListener('click', () => startEdit(viewIndex));
    del.addEventListener('click', () => deleteByViewIndex(viewIndex));

    up.addEventListener('click', () => {
      if (lockCheckbox.checked) return;
      if (searchInput.value.trim()) return;
      const arr = load();
      const view = sortedView(arr, sortSelect.value);
      const storedIndex = arr.indexOf(view[viewIndex]);
      if (storedIndex > 0) { move(arr, storedIndex, storedIndex - 1); save(arr); render(); }
    });

    down.addEventListener('click', () => {
      if (lockCheckbox.checked) return;
      if (searchInput.value.trim()) return;
      const arr = load();
      const view = sortedView(arr, sortSelect.value);
      const storedIndex = arr.indexOf(view[viewIndex]);
      if (storedIndex !== -1 && storedIndex < arr.length - 1) { move(arr, storedIndex, storedIndex + 1); save(arr); render(); }
    });

    const handleEl = left.querySelector('.handle');

    const enableDrag = isCustom && !searchActive && draggableAllowed && !lockCheckbox.checked;
    if (enableDrag && handleEl) {
      handleEl.style.cursor = 'grab';
      handleEl.addEventListener('pointerdown', (ev) => {
        ev.preventDefault();
        startDrag(li, viewIndex, text);
      });
      up.disabled = false; down.disabled = false;
    } else {
      if (handleEl) handleEl.style.cursor = 'not-allowed';
      up.disabled = true; down.disabled = true;
    }

    li.append(left, center, right);
    return li;
  }

  function render() {
    const arr = load();
    const mode = sortSelect.value;
    const q = (searchInput.value || '').trim();
    const view = filteredView(arr, mode, q);
    const searchActive = q.length > 0;
    const draggableAllowed = !lockCheckbox.checked;

    if (mode === 'custom') document.body.classList.add('custom-mode'); else document.body.classList.remove('custom-mode');

    sortSelect.disabled = lockCheckbox.checked;
    if (lockCheckbox.checked) {
      sortWrapper.classList.add('select-disabled');
      sortTooltip.style.opacity = '1';
      if (tooltipTimer) clearTimeout(tooltipTimer);
      tooltipTimer = setTimeout(()=>{ sortTooltip.style.opacity='0'; tooltipTimer=null; }, 900);
    } else {
      sortWrapper.classList.remove('select-disabled');
      if (tooltipTimer) { clearTimeout(tooltipTimer); tooltipTimer = null; }
      sortTooltip.style.opacity = '0';
    }

    const showMarkers = (mode !== 'custom') || (mode === 'custom' && lockCheckbox.checked);
    if (showMarkers) listStyleWrap.classList.remove('hidden'); else listStyleWrap.classList.add('hidden');

    list.innerHTML = '';
    if (!view.length) {
      const li = document.createElement('li'); li.textContent = 'No quotes saved yet — add one!'; list.appendChild(li); return;
    }

    const listStyle = listStyleSelect.value;

    view.forEach((txt, i) => {
      let marker = '';
      if (showMarkers) {
        if (listStyle === 'number') marker = (i+1) + '.';
        else if (listStyle === 'bullet') marker = '•';
        else marker = '';
      }
      const isCustom = (mode === 'custom');
      const showMarker = showMarkers;

      const li = createItem(txt, i, { isCustom, searchActive, draggableAllowed, markerText: marker, showMarker });
      list.appendChild(li);
    });
  }

  function addQuote(text) {
    const v = (text || quoteInput.value || '').trim();
    if (!v) return;
    const arr = load();
    if (arr.some(s => s.toLowerCase() === v.toLowerCase())) { alert('Duplicate — not added'); quoteInput.value=''; return; }
    arr.push(v); save(arr); quoteInput.value=''; render();
  }

  function deleteByViewIndex(viewIndex) {
    const arr = load();
    const mode = sortSelect.value;
    const q = (searchInput.value || '').trim();
    const view = filteredView(arr, mode, q);
    const text = view[viewIndex];
    if (text === undefined) return;
    const idx = arr.indexOf(text);
    if (idx === -1) return;
    arr.splice(idx,1); save(arr); render();
  }

  function startEdit(viewIndex) {
    const arr = load();
    const mode = sortSelect.value;
    const q = (searchInput.value || '').trim();
    const view = filteredView(arr, mode, q);
    const text = view[viewIndex];
    if (text === undefined) return;
    const idx = arr.indexOf(text);
    if (idx === -1) return;

    const li = list.querySelectorAll('li')[viewIndex];
    if (!li) return;
    li.innerHTML = '';

    const editInput = document.createElement('input'); editInput.className='edit-input'; editInput.value=text;
    const saveBtn = document.createElement('button'); saveBtn.textContent='Save'; saveBtn.className='btn btn-primary';
    const cancelBtn = document.createElement('button'); cancelBtn.textContent='Cancel'; cancelBtn.className='btn btn-ghost';

    saveBtn.addEventListener('click', ()=>{
      const nv = editInput.value.trim();
      if (!nv) return;
      const cur = load();
      if (cur.some((s,i)=>s.toLowerCase()===nv.toLowerCase() && i!==idx)) { alert('Duplicate — not saved'); return; }
      cur[idx]=nv; save(cur); render();
    });
    cancelBtn.addEventListener('click', render);

    li.append(editInput, saveBtn, cancelBtn);
    editInput.focus();
  }

  addBtn.addEventListener('click', ()=>addQuote());
  quoteInput.addEventListener('keydown', e => { if (e.key==='Enter') addQuote(); });
  if (addFloating) addFloating.addEventListener('click', ()=>addQuote());
  clearBtn.addEventListener('click', ()=>{ if(confirm('Clear all quotes?')) { localStorage.removeItem(STORAGE_KEY); render(); } });

  searchInput.addEventListener('input', render);
  sortSelect.addEventListener('change', render);
  lockCheckbox.addEventListener('change', render);
  listStyleSelect.addEventListener('change', render);

  list.addEventListener('click', e=> {
    const t = e.target;
    if (!t) return;
    if (t.classList.contains('delete-btn')) {
      const li = t.closest('li'); const index = Array.from(list.children).indexOf(li); deleteByViewIndex(index);
    }
    if (t.classList.contains('edit-btn')) {
      const li = t.closest('li'); const index = Array.from(list.children).indexOf(li); startEdit(index);
    }
  });

  function applyTheme(t) {
    if (t==='dark') document.documentElement.classList.add('dark'); else document.documentElement.classList.remove('dark');
    if (themeToggle) themeToggle.setAttribute('aria-pressed', t==='dark'?'true':'false');
    localStorage.setItem(THEME_KEY, t);
  }
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved || (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark':'light'));
  if (themeToggle) themeToggle.addEventListener('click', ()=>{
    const cur = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    applyTheme(cur==='dark' ? 'light' : 'dark');
  });

  window.addEventListener('scroll', ()=> {
    if (window.scrollY > 30) header.classList.add('scrolled'); else header.classList.remove('scrolled');
  }, { passive:true });

  if (sortTooltip) sortTooltip.style.opacity = '0';
  render();
});
