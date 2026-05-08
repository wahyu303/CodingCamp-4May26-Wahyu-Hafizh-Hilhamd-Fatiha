'use strict';

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function saveTo(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (_) {}
}

function loadFrom(key, fallback) {
  try {
    const d = localStorage.getItem(key);
    return d ? JSON.parse(d) : fallback;
  } catch (_) {
    return fallback;
  }
}

function sanitize(str) {
  const el = document.createElement('span');
  el.textContent = str;
  return el.innerHTML;
}

function getFavicon(url) {
  try {
    const host = new URL(url).hostname;
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  } catch (_) {
    return null;
  }
}

function injectTimerGradient() {
  const svg = $('#timerProgress')?.closest('svg');
  if (!svg) return;
  const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
  defs.innerHTML = `
    <linearGradient id="timerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c6bff"/>
      <stop offset="100%" stop-color="#4f8bff"/>
    </linearGradient>`;
  svg.prepend(defs);
  defs.style.display = '';
}

const Clock = (() => {
  const timeEl = $('#clockTime');
  const dateEl = $('#clockDate');

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function update() {
    const now = new Date();
    let h = now.getHours();
    const m = pad(now.getMinutes());
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;

    if (timeEl) timeEl.textContent = `${pad(h)}:${m} ${ampm}`;
    if (dateEl) {
      const day = DAYS[now.getDay()];
      const date = now.getDate();
      const mon = MONTHS[now.getMonth()];
      const yr = now.getFullYear();
      dateEl.textContent = `${day}, ${mon} ${date}, ${yr}`;
    }

    const greet = now.getHours() < 12 ? 'Good Morning' : now.getHours() < 17 ? 'Good Afternoon' : 'Good Evening';
    const gEl = $('.dashboard-header__greeting');
    if (gEl) gEl.innerHTML = `${greet}, <mark class="accent">Hacing</mark> 👋`;
  }

  return {
    init() {
      update();
      setInterval(update, 1000);
    },
  };
})();

const Theme = (() => {
  const toggle = $('#themeSwitch');
  const html = document.documentElement;
  const STORAGE = 'focusspace-theme';

  function apply(dark) {
    html.setAttribute('data-theme', dark ? 'dark' : 'light');
    if (toggle) toggle.checked = dark;
    saveTo(STORAGE, dark);
  }

  return {
    init() {
      const saved = loadFrom(STORAGE, true);
      apply(saved);
      toggle?.addEventListener('change', () => apply(toggle.checked));
    },
  };
})();

const Timer = (() => {
  const TOTAL = 25 * 60; // seconds
  const CIRCUMFERENCE = 2 * Math.PI * 85; // r=85

  const displayEl = $('#timerDisplay');
  const labelEl = $('#timerLabel');
  const progressEl = $('#timerProgress');
  const startBtn = $('#timerStart');
  const pauseBtn = $('#timerPause');
  const resetBtn = $('#timerReset');

  let remaining = TOTAL;
  let intervalId = null;
  let running = false;

  const LABELS = {
    idle: "🎯 Let's focus!",
    running: '🔥 Keep going!',
    paused: '⏸ Paused',
    done: '🎉 Session done!',
  };

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function render() {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    if (displayEl) displayEl.textContent = `${pad(m)}:${pad(s)}`;

    const ratio = remaining / TOTAL;
    const offset = CIRCUMFERENCE * (1 - ratio);
    if (progressEl) progressEl.style.strokeDashoffset = offset;
    if (progressEl) progressEl.style.strokeDasharray = CIRCUMFERENCE;
  }

  function setLabel(state) {
    if (labelEl) labelEl.textContent = LABELS[state] ?? LABELS.idle;
  }

  function setButtons(state) {
    if (state === 'running') {
      startBtn.disabled = true;
      pauseBtn.disabled = false;
    } else {
      startBtn.disabled = false;
      pauseBtn.disabled = true;
    }
  }

  function tick() {
    if (remaining <= 0) {
      stop();
      setLabel('done');
      return;
    }
    remaining--;
    render();
  }

  function start() {
    if (running) return;
    running = true;
    intervalId = setInterval(tick, 1000);
    setLabel('running');
    setButtons('running');
  }

  function pause() {
    clearInterval(intervalId);
    running = false;
    setLabel('paused');
    setButtons('paused');
  }

  function stop() {
    clearInterval(intervalId);
    running = false;
    setButtons('idle');
  }

  function reset() {
    stop();
    remaining = TOTAL;
    render();
    setLabel('idle');
  }

  return {
    init() {
      injectTimerGradient();
      render();
      setLabel('idle');
      setButtons('idle');

      startBtn?.addEventListener('click', start);
      pauseBtn?.addEventListener('click', pause);
      resetBtn?.addEventListener('click', reset);
    },
  };
})();

const Tasks = (() => {
  const STORAGE = 'focusspace-tasks';
  const listEl = $('#taskList');
  const form = $('#taskInputForm');
  const inputEl = $('#taskInput');

  const modal = $('#editTaskModal');
  const editInput = $('#editTaskInput');
  const editId = $('#editTaskId');
  const saveBtn = $('#saveEdit');
  const deleteBtn = $('#deleteEditTask');
  const cancelBtn = $('#cancelEdit');
  const closeBtn = $('#closeEditModal');

  let tasks = loadFrom(STORAGE, [
    { id: 't1', text: 'Finish UI Design', done: false },
    { id: 't2', text: 'Study JavaScript', done: false },
    { id: 't3', text: 'Push project to GitHub', done: true },
    { id: 't4', text: 'Read documentation', done: false },
  ]);

  function save() {
    saveTo(STORAGE, tasks);
  }

  function makeId() {
    return 't' + Date.now();
  }

  function renderAll() {
    if (!listEl) return;
    listEl.innerHTML = '';
    tasks.forEach((t) => listEl.appendChild(createItem(t)));
  }

  function createItem(task) {
    const li = document.createElement('li');
    li.className = `task-item${task.done ? ' task-item--done' : ''}`;
    li.dataset.id = task.id;
    li.innerHTML = `
      <input type="checkbox" class="task-item__checkbox"
             id="chk-${task.id}" ${task.done ? 'checked' : ''}
             aria-label="Mark complete" />
      <label class="task-item__label" for="chk-${task.id}">${sanitize(task.text)}</label>
      <nav class="task-item__actions" aria-label="Task actions">
        <button class="task-item__btn task-item__btn--edit" data-action="edit" aria-label="Edit task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="task-item__btn task-item__btn--delete" data-action="delete" aria-label="Delete task">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
            <path d="M9 6V4h6v2"/>
          </svg>
        </button>
      </nav>`;

    const chk = li.querySelector('.task-item__checkbox');
    chk.addEventListener('change', () => {
      task.done = chk.checked;
      li.classList.toggle('task-item--done', task.done);
      save();
    });

    li.addEventListener('click', (e) => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'edit') openEdit(task);
      if (action === 'delete') deleteTask(task.id);
    });

    return li;
  }

  function addTask(text) {
    if (!text.trim()) return;
    const task = { id: makeId(), text: text.trim(), done: false };
    tasks.push(task);
    save();
    listEl.appendChild(createItem(task));
  }

  function deleteTask(id) {
    tasks = tasks.filter((t) => t.id !== id);
    save();
    renderAll();
  }

  function openEdit(task) {
    editInput.value = task.text;
    editId.value = task.id;
    modal?.showModal();
    editInput.focus();
  }

  function closeModal() {
    modal?.close();
  }

  function commitEdit() {
    const id = editId.value;
    const text = editInput.value.trim();
    if (!text) return;
    const task = tasks.find((t) => t.id === id);
    if (task) {
      task.text = text;
      save();
      renderAll();
    }
    closeModal();
  }

  function commitDelete() {
    deleteTask(editId.value);
    closeModal();
  }

  return {
    init() {
      renderAll();

      form?.addEventListener('submit', (e) => {
        e.preventDefault();
        addTask(inputEl.value);
        inputEl.value = '';
      });

      $('#openAddTask')?.addEventListener('click', () => {
        inputEl.focus();
        inputEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      saveBtn?.addEventListener('click', commitEdit);
      deleteBtn?.addEventListener('click', commitDelete);
      cancelBtn?.addEventListener('click', closeModal);
      closeBtn?.addEventListener('click', closeModal);

      modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });
    },
  };
})();

const Links = (() => {
  const STORAGE = 'focusspace-links';
  const listEl = $('#linksList');

  const modal = $('#addLinkModal');
  const nameInput = $('#linkNameInput');
  const urlInput = $('#linkUrlInput');
  const saveBtn = $('#saveLink');
  const cancelBtn = $('#cancelAddLink');
  const closeBtn = $('#closeAddLinkModal');

  let links = loadFrom(STORAGE, [
    { id: 'l1', name: 'YouTube', url: 'https://youtube.com' },
    { id: 'l2', name: 'GitHub', url: 'https://github.com' },
    { id: 'l3', name: 'Gmail', url: 'https://mail.google.com' },
    { id: 'l4', name: 'ChatGPT', url: 'https://chat.openai.com' },
    { id: 'l5', name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
  ]);

  function save() {
    saveTo(STORAGE, links);
  }

  function makeId() {
    return 'l' + Date.now();
  }

  function renderAll() {
    if (!listEl) return;
    listEl.innerHTML = '';
    links.forEach((l) => listEl.appendChild(createItem(l)));
  }

  function createItem(link) {
    const li = document.createElement('li');
    const favicon = getFavicon(link.url);

    li.innerHTML = `
      <a class="link-item" href="${sanitize(link.url)}" target="_blank"
         rel="noopener noreferrer" aria-label="Open ${sanitize(link.name)}">
        <figure class="link-item__favicon" aria-hidden="true">
          ${favicon ? `<img src="${favicon}" alt="" width="22" height="22" loading="lazy" />` : link.name.charAt(0).toUpperCase()}
        </figure>
        <span class="link-item__name">${sanitize(link.name)}</span>
        <svg class="link-item__external" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" aria-hidden="true">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/>
          <polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        <button class="link-item__delete" data-id="${link.id}" aria-label="Remove ${sanitize(link.name)}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </a>`;

    li.querySelector('.link-item__delete')?.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      deleteLink(link.id);
    });

    return li;
  }

  function addLink(name, url) {
    if (!name.trim() || !url.trim()) return;
    try {
      new URL(url);
    } catch (_) {
      alert('Please enter a valid URL (include https://)');
      return;
    }
    const link = { id: makeId(), name: name.trim(), url: url.trim() };
    links.push(link);
    save();
    renderAll();
  }

  function deleteLink(id) {
    links = links.filter((l) => l.id !== id);
    save();
    renderAll();
  }

  function openModal() {
    nameInput.value = '';
    urlInput.value = '';
    modal?.showModal();
    nameInput.focus();
  }

  function closeModal() {
    modal?.close();
  }

  function commitAdd() {
    addLink(nameInput.value, urlInput.value);
    closeModal();
  }

  return {
    init() {
      renderAll();

      $('#openAddLink')?.addEventListener('click', openModal);
      $('#manageLinks')?.addEventListener('click', openModal);

      saveBtn?.addEventListener('click', commitAdd);
      cancelBtn?.addEventListener('click', closeModal);
      closeBtn?.addEventListener('click', closeModal);

      modal?.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
      });

      urlInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') commitAdd();
      });
    },
  };
})();

const Quotes = (() => {
  const QUOTES = [
    'Discipline is choosing between what you want now and what you want most.',
    'The secret of getting ahead is getting started.',
    'Focus on being productive instead of busy.',
    'One task at a time. Do it well. Move on.',
    'Small steps every day lead to big results.',
    'Your future self will thank you for starting today.',
    'Work hard in silence; let your success make the noise.',
    'Done is better than perfect.',
    'Progress, not perfection.',
    'Every expert was once a beginner.',
  ];

  return {
    init() {
      const el = $('#quoteText');
      if (!el) return;
      const today = new Date().getDay();
      el.textContent = QUOTES[today % QUOTES.length];
    },
  };
})();

const Nav = (() => {
  return {
    init() {
      $$('.nav__btn').forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('.nav__btn').forEach((b) => {
            b.classList.remove('nav__btn--active');
            b.removeAttribute('aria-current');
          });
          btn.classList.add('nav__btn--active');
          btn.setAttribute('aria-current', 'page');
        });
      });
    },
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  Theme.init();
  Clock.init();
  Timer.init();
  Tasks.init();
  Links.init();
  Quotes.init();
  Nav.init();

  console.log('%c FocusSpace v1.0.0 %c Productivity Dashboard ', 'background:#7c6bff;color:white;padding:4px 8px;border-radius:4px 0 0 4px;font-weight:700', 'background:#4f8bff;color:white;padding:4px 8px;border-radius:0 4px 4px 0');
});
