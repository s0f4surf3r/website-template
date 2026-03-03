/**
 * perfectCMS — Frontend (Vanilla JS SPA)
 * Hash-basierter Router: #login, #list, #edit/:path, #new-text, #magic/:token
 */

(function () {
  'use strict';

  // --- Config ---
  const API_URL = localStorage.getItem('cms_api_url')
    || document.querySelector('meta[name="cms-api-url"]')?.content
    || '';

  // --- State ---
  let token = localStorage.getItem('cms_token') || null;
  let contentCache = null;
  let currentFile = null; // { path, sha, type, isNew }
  let tuiEditor = null;

  // --- Autosave State ---
  let lastSavedContent = '';
  let hasUnsavedChanges = false;
  let isSaving = false;

  function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
  }

  // --- DOM Refs ---
  const $ = (sel) => document.querySelector(sel);
  const viewLogin = $('#view-login');
  const viewList = $('#view-list');
  const viewEditor = $('#view-editor');

  // --- API Helper ---
  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${API_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      return { status: 0, data: null, networkError: true };
    }

    const data = await res.json().catch(() => null);

    if (res.status === 401 && !path.startsWith('/api/login') && path !== '/api/magic-link') {
      logout();
      return null;
    }

    return { status: res.status, data };
  }

  function errorMsg(res, fallback) {
    if (!res) return fallback;
    if (res.networkError) return 'Keine Verbindung zum Server';
    if (res.status === 409) return 'Konflikt — Seite wurde anderweitig geändert. Bitte neu laden.';
    if (res.status === 413) return 'Datei zu groß';
    if (res.status >= 500) return 'Server-Fehler — bitte später erneut versuchen';
    if (res.data && res.data.error) return res.data.error;
    return fallback;
  }

  // --- Router ---
  function showView(name) {
    viewLogin.hidden = name !== 'login';
    viewList.hidden = name !== 'list';
    viewEditor.hidden = name !== 'editor';
    if (name !== 'editor') {
      if (tuiEditor) { tuiEditor.destroy(); tuiEditor = null; }
      const vp = $('#versions-panel');
      if (vp) vp.hidden = true;
    }
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function handleRoute() {
    const hash = window.location.hash || '#';

    // Magic Link Token — immer verarbeiten, auch ohne bestehende Session
    const magicMatch = hash.match(/^#magic\/(.+)$/);
    if (magicMatch) {
      handleMagicToken(magicMatch[1]);
      return;
    }

    if (!token) {
      showView('login');
      return;
    }

    if (hash === '#list' || hash === '#' || hash === '') {
      showView('list');
      loadContentList();
      return;
    }

    const editMatch = hash.match(/^#edit\/(.+)$/);
    if (editMatch) {
      const path = decodeURIComponent(editMatch[1]);
      showView('editor');
      loadEditor(path);
      return;
    }

    if (hash === '#new-text') {
      showView('editor');
      loadNewText();
      return;
    }

    // Fallback
    navigate('#list');
  }

  window.addEventListener('hashchange', handleRoute);

  // --- Magic Link ---
  $('#magic-link-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const statusEl = $('#magic-link-status');
    const errorEl = $('#login-error');
    errorEl.hidden = true;

    if (!email) {
      errorEl.textContent = 'E-Mail-Adresse eingeben';
      errorEl.hidden = false;
      return;
    }

    statusEl.textContent = 'Sende Magic Link...';
    statusEl.className = 'magic-link-status';
    statusEl.hidden = false;

    const res = await api('POST', '/api/magic-link', { email });

    if (res && res.status === 200) {
      statusEl.textContent = 'Login-Link gesendet! Schau in dein E-Mail-Postfach.';
      statusEl.className = 'magic-link-status success';
    } else {
      statusEl.textContent = errorMsg(res, 'Fehler beim Senden');
      statusEl.className = 'magic-link-status error';
    }
  });

  // --- Passwort-Fallback Toggle ---
  $('#toggle-password-login').addEventListener('click', () => {
    const form = $('#login-form');
    form.hidden = !form.hidden;
    if (!form.hidden) $('#login-password').focus();
  });

  // --- Login (Passwort) ---
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const errorEl = $('#login-error');
    const submitBtn = $('#login-form').querySelector('button[type=submit]');
    errorEl.hidden = true;
    const origText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Anmelden …';

    const res = await api('POST', '/api/login', { email, password });

    submitBtn.disabled = false;
    submitBtn.textContent = origText;

    if (res && res.status === 200 && res.data.token) {
      token = res.data.token;
      localStorage.setItem('cms_token', token);
      navigate('#list');
    } else {
      errorEl.textContent = errorMsg(res, 'Anmeldung fehlgeschlagen');
      errorEl.hidden = false;
    }
  });

  // --- Logout ---
  function logout() {
    token = null;
    localStorage.removeItem('cms_token');
    contentCache = null;
    navigate('#login');
    showView('login');
  }

  $('#logout-btn').addEventListener('click', logout);

  // --- Tabs (ARIA compliant) ---
  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      const name = tab.dataset.tab;
      $('#tab-texte').hidden = name !== 'texte';
      $('#tab-seiten').hidden = name !== 'seiten';
    });
  });

  // --- Content Liste ---
  async function loadContentList() {
    const texteList = $('#texte-list');
    const seitenList = $('#seiten-list');
    texteList.innerHTML = '<li class="loading">Laden...</li>';
    seitenList.innerHTML = '<li class="loading">Laden...</li>';

    const res = await api('GET', '/api/content');
    if (!res || res.status !== 200) {
      texteList.innerHTML = `<li class="loading">${errorMsg(res, 'Fehler beim Laden')}</li>`;
      seitenList.innerHTML = '';
      return;
    }

    contentCache = res.data;

    // Texte rendern (sortiert nach Datum, neueste zuerst)
    const sortedTexte = [...res.data.texte].sort((a, b) => b.name.localeCompare(a.name));
    texteList.innerHTML = sortedTexte
      .map((file) => {
        const dateMatch = file.name.match(/^(\d{4}-\d{2}-\d{2})/);
        const date = dateMatch ? formatDate(dateMatch[1]) : '';
        const title = file.name
          .replace(/^\d{4}-\d{2}-\d{2}-/, '')
          .replace(/\.md$/, '')
          .replace(/-/g, ' ');
        return `<li class="content-item" tabindex="0" role="button" data-path="${file.path}" aria-label="${capitalize(title)}, ${date}">
          <div class="content-item-title">${capitalize(title)}</div>
          <div class="content-item-meta">${date}</div>
        </li>`;
      })
      .join('');

    // Seiten rendern
    seitenList.innerHTML = res.data.seiten
      .map((file) => {
        const title = file.name.replace(/\.md$/, '');
        return `<li class="content-item" tabindex="0" role="button" data-path="${file.path}" aria-label="${capitalize(title)}, Seite">
          <div class="content-item-title">${capitalize(title)}</div>
          <div class="content-item-meta">Seite</div>
        </li>`;
      })
      .join('');

    // Click + Keyboard Handler
    document.querySelectorAll('.content-item').forEach((item) => {
      const openItem = () => navigate(`#edit/${encodeURIComponent(item.dataset.path)}`);
      item.addEventListener('click', openItem);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openItem(); }
      });
    });

    // Draft-Badges laden
    loadDraftBadges(res.data.texte);
  }

  async function loadDraftBadges(texte) {
    const results = await Promise.all(
      texte.map(async (file) => {
        const res = await api('GET', `/api/content/${encodeURIComponent(file.path)}`);
        if (!res || res.status !== 200) return null;
        const { frontmatter } = parseFrontmatter(res.data.content);
        return { path: file.path, draft: frontmatter.draft === 'true' || frontmatter.draft === true };
      })
    );
    for (const result of results) {
      if (!result || !result.draft) continue;
      const item = document.querySelector(`.content-item[data-path="${result.path}"]`);
      if (!item) continue;
      const meta = item.querySelector('.content-item-meta');
      if (meta && !meta.querySelector('.draft-badge')) {
        meta.insertAdjacentHTML('beforeend', ' <span class="draft-badge">Entwurf</span>');
      }
    }
  }

  // --- Neuer Text ---
  $('#new-text-btn').addEventListener('click', () => navigate('#new-text'));

  function loadNewText() {
    const today = new Date().toISOString().slice(0, 10);
    currentFile = { path: null, sha: null, type: 'text', isNew: true };

    // Text-Felder anzeigen
    $('#fields-text').hidden = false;
    $('#fields-page').hidden = true;
    $('#delete-btn').hidden = true;
    $('#versions-btn').hidden = true;
    closeVersions();

    // Felder leeren
    $('#f-title').value = '';
    $('#f-type').value = 'Gedicht';
    $('#f-date').value = today;
    $('#f-excerpt').value = '';
    $('#f-heroimage').value = '';
    $('#f-draft').checked = true;
    initEditor('');
    lastSavedContent = '';
    hasUnsavedChanges = false;
    $('#save-status').textContent = '';
    updatePublishButton();
  }

  // --- Editor laden ---
  async function loadEditor(path) {
    const isText = path.startsWith('src/texte/');
    currentFile = { path, sha: null, type: isText ? 'text' : 'page', isNew: false };

    // Felder ein/ausblenden
    $('#fields-text').hidden = !isText;
    $('#fields-page').hidden = isText;
    $('#delete-btn').hidden = !isText; // Seiten nicht löschbar
    $('#versions-btn').hidden = false; // Versionen bei bestehenden Dateien
    closeVersions();
    $('#save-status').textContent = 'Laden...';

    const res = await api('GET', `/api/content/${encodeURIComponent(path)}`);
    if (!res || res.status !== 200) {
      $('#save-status').textContent = errorMsg(res, 'Fehler beim Laden');
      $('#save-status').style.color = 'var(--danger)';
      return;
    }

    currentFile.sha = res.data.sha;
    const raw = res.data.content;

    // Frontmatter parsen
    const { frontmatter, body } = parseFrontmatter(raw);

    if (isText) {
      $('#f-title').value = frontmatter.title || '';
      $('#f-type').value = frontmatter.type || 'Gedicht';
      $('#f-date').value = frontmatter.date ? frontmatter.date.slice(0, 10) : '';
      $('#f-excerpt').value = frontmatter.excerpt || '';
      $('#f-heroimage').value = frontmatter.heroImage || '';
      $('#f-draft').checked = frontmatter.draft === 'true' || frontmatter.draft === true;
    } else {
      $('#fp-title').value = frontmatter.title || '';
      $('#fp-subtitle').value = frontmatter.subtitle || '';
      $('#fp-description').value = frontmatter.description || '';
    }

    initEditor(body);
    lastSavedContent = getFullContent();
    hasUnsavedChanges = false;
    $('#save-status').textContent = '';
    updatePublishButton();
  }

  // --- Toast UI Editor ---
  function initEditor(initialValue) {
    if (tuiEditor) {
      tuiEditor.destroy();
      tuiEditor = null;
    }

    const container = $('#editor-container');
    container.innerHTML = '';

    // Reveal Codes Button als Custom Toolbar Item
    const revealCodesBtn = document.createElement('button');
    revealCodesBtn.type = 'button';
    revealCodesBtn.className = 'reveal-codes-btn';
    revealCodesBtn.textContent = '{ }';
    revealCodesBtn.title = 'Reveal Codes (Alt+F3)';
    revealCodesBtn.setAttribute('aria-label', 'Reveal Codes — Quellcode anzeigen');
    revealCodesBtn.addEventListener('click', toggleRevealCodes);

    tuiEditor = new toastui.Editor({
      el: container,
      initialEditType: 'wysiwyg',
      initialValue: initialValue || '',
      previewStyle: 'vertical',
      theme: 'dark',
      hideModeSwitch: true,
      usageStatistics: false,
      toolbarItems: [
        ['heading', 'bold', 'italic', 'strike'],
        ['hr', 'quote', 'ul', 'ol'],
        ['image', 'link', 'code', 'codeblock'],
        [{ el: revealCodesBtn, tooltip: 'Reveal Codes (Alt+F3)', name: 'revealCodes' }],
      ],
      hooks: {
        addImageBlobHook: handleImageBlobUpload,
      },
    });

    // Change-Listener für Autosave
    tuiEditor.on('change', onContentChange);

    // Alt+F3 Keyboard Shortcut
    container.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'F3') {
        e.preventDefault();
        toggleRevealCodes();
      }
    });
  }

  // Frontmatter-Felder Change-Listener
  ['#f-title', '#f-type', '#f-date', '#f-excerpt', '#f-heroimage', '#f-draft', '#fp-title', '#fp-subtitle', '#fp-description'].forEach((sel) => {
    const el = $(sel);
    if (el) {
      el.addEventListener('input', onContentChange);
      el.addEventListener('change', onContentChange);
    }
  });

  function toggleRevealCodes() {
    if (!tuiEditor) return;
    const current = tuiEditor.isWysiwygMode() ? 'wysiwyg' : 'markdown';
    const next = current === 'wysiwyg' ? 'markdown' : 'wysiwyg';
    tuiEditor.changeMode(next);

    // Button-Status aktualisieren
    const btn = document.querySelector('.reveal-codes-btn');
    if (btn) {
      btn.classList.toggle('active', next === 'markdown');
    }
  }

  const MAX_UPLOAD_MB = 5;
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];

  function handleImageBlobUpload(blob, callback) {
    if (blob.size > MAX_UPLOAD_MB * 1024 * 1024) {
      callback('', `Datei zu groß (max. ${MAX_UPLOAD_MB} MB)`);
      return;
    }
    if (blob.type && !ALLOWED_TYPES.includes(blob.type)) {
      callback('', 'Nur Bilder erlaubt (JPG, PNG, GIF, WebP, SVG)');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const filename = blob.name ? blob.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-') : 'bild.png';
      const res = await api('POST', '/api/upload', { filename, data: base64 });
      if (res && res.status === 200) {
        callback(res.data.path, blob.name || 'Bild');
      } else {
        callback('', errorMsg(res, 'Upload fehlgeschlagen'));
      }
    };
    reader.readAsDataURL(blob);
  }

  // --- Autosave ---
  function getFullContent() {
    let frontmatter;
    if (currentFile && currentFile.type === 'text') {
      frontmatter = {
        layout: 'text',
        tags: 'text',
        title: $('#f-title').value.trim(),
        date: `${$('#f-date').value}T00:00:00.000+01:00`,
        type: $('#f-type').value,
      };
      if ($('#f-draft').checked) frontmatter.draft = true;
      const heroImage = $('#f-heroimage').value.trim();
      const excerpt = $('#f-excerpt').value.trim();
      if (heroImage) frontmatter.heroImage = heroImage;
      if (excerpt) frontmatter.excerpt = excerpt;
    } else if (currentFile) {
      frontmatter = { layout: 'page.njk', title: $('#fp-title').value.trim() };
      const subtitle = $('#fp-subtitle').value.trim();
      const description = $('#fp-description').value.trim();
      if (subtitle) frontmatter.subtitle = subtitle;
      if (description) frontmatter.description = description;
    } else {
      return '';
    }
    const body = tuiEditor ? tuiEditor.getMarkdown() : '';
    return buildFile(frontmatter, body);
  }

  function onContentChange() {
    hasUnsavedChanges = true;
    const status = $('#save-status');
    status.textContent = 'Ungespeicherte Änderungen';
    status.style.color = 'var(--accent)';
    scheduleAutosave();
  }

  const scheduleAutosave = debounce(() => {
    if (!currentFile || !currentFile.path) return;
    if (isSaving) return;
    if (currentFile.type === 'text') {
      if (!$('#f-title').value.trim() || !$('#f-date').value) return;
    }
    const content = getFullContent();
    if (content === lastSavedContent) return;
    saveContent(true);
  }, 3000);

  // --- Speichern ---
  $('#save-btn').addEventListener('click', () => saveContent(false));

  async function saveContent(isAuto = false) {
    if (isSaving) return;
    isSaving = true;

    const saveBtn = $('#save-btn');
    const status = $('#save-status');
    saveBtn.disabled = true;
    status.textContent = 'Speichert...';
    status.style.color = 'var(--text-secondary)';

    try {
      let frontmatter, path;

      if (currentFile.type === 'text') {
        const title = $('#f-title').value.trim();
        const type = $('#f-type').value;
        const date = $('#f-date').value;
        const excerpt = $('#f-excerpt').value.trim();
        const heroImage = $('#f-heroimage').value.trim();

        if (!title || !date) {
          status.textContent = 'Titel und Datum erforderlich';
          status.style.color = 'var(--danger)';
          return;
        }

        frontmatter = {
          layout: 'text',
          tags: 'text',
          title,
          date: `${date}T00:00:00.000+01:00`,
          type,
        };
        if ($('#f-draft').checked) frontmatter.draft = true;
        if (heroImage) frontmatter.heroImage = heroImage;
        if (excerpt) frontmatter.excerpt = excerpt;

        if (currentFile.isNew) {
          const slug = slugify(title);
          path = `src/texte/${date}-${slug}.md`;
          currentFile.path = path;
        } else {
          path = currentFile.path;
        }
      } else {
        const title = $('#fp-title').value.trim();
        const subtitle = $('#fp-subtitle').value.trim();
        const description = $('#fp-description').value.trim();

        frontmatter = { layout: 'page.njk', title };
        if (subtitle) frontmatter.subtitle = subtitle;
        if (description) frontmatter.description = description;

        path = currentFile.path;
      }

      const body = tuiEditor ? tuiEditor.getMarkdown() : '';
      const content = buildFile(frontmatter, body);

      const res = await api('PUT', `/api/content/${encodeURIComponent(path)}`, { content });

      if (res && res.status === 200) {
        currentFile.sha = res.data.sha;
        currentFile.isNew = false;
        lastSavedContent = content;
        hasUnsavedChanges = false;
        let statusText = isAuto ? 'Auto-gespeichert' : 'Gespeichert';
        if (!isAuto && currentFile.type === 'text' && !$('#f-draft').checked) {
          statusText = 'Veröffentlicht';
        }
        status.textContent = statusText;
        status.style.color = 'var(--success)';
        updatePublishButton();
      } else {
        status.textContent = errorMsg(res, 'Fehler beim Speichern');
        status.style.color = 'var(--danger)';
      }
    } finally {
      isSaving = false;
      saveBtn.disabled = false;
    }
  }

  // --- Veröffentlichen ---
  function updatePublishButton() {
    const btn = $('#publish-btn');
    btn.hidden = !(currentFile && currentFile.type === 'text' && $('#f-draft').checked);
  }

  $('#publish-btn').addEventListener('click', () => {
    $('#f-draft').checked = false;
    saveContent(false);
  });

  // Draft-Checkbox ändert Publish-Button Sichtbarkeit
  $('#f-draft').addEventListener('change', updatePublishButton);

  // --- Löschen ---
  $('#delete-btn').addEventListener('click', async () => {
    if (!currentFile || !currentFile.path) return;
    if (!confirm('Diesen Inhalt wirklich löschen?')) return;

    const status = $('#save-status');
    status.textContent = 'Löschen...';

    const res = await api('DELETE', `/api/content/${encodeURIComponent(currentFile.path)}`);
    if (res && res.status === 200) {
      navigate('#list');
    } else {
      status.textContent = errorMsg(res, 'Fehler beim Löschen');
      status.style.color = 'var(--danger)';
    }
  });

  // --- Zurück ---
  $('#back-btn').addEventListener('click', () => navigate('#list'));

  // --- Bild-Upload ---
  const uploadInput = $('#upload-input');

  $('#upload-btn').addEventListener('click', () => uploadInput.click());
  $('#upload-hero-btn').addEventListener('click', () => {
    uploadInput.dataset.target = 'hero';
    uploadInput.click();
  });

  uploadInput.addEventListener('change', async () => {
    const file = uploadInput.files[0];
    if (!file) return;

    const target = uploadInput.dataset.target;
    uploadInput.dataset.target = '';

    const statusEl = $('#upload-status');

    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      statusEl.textContent = `Datei zu groß (max. ${MAX_UPLOAD_MB} MB)`;
      uploadInput.value = '';
      return;
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      statusEl.textContent = 'Nur Bilder erlaubt (JPG, PNG, GIF, WebP, SVG)';
      uploadInput.value = '';
      return;
    }

    statusEl.textContent = `Lade ${file.name} hoch...`;

    // Dateiname bereinigen
    const filename = file.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-');

    // Base64 lesen
    const base64 = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(file);
    });

    const res = await api('POST', '/api/upload', { filename, data: base64 });

    if (res && res.status === 200) {
      statusEl.textContent = `${filename} hochgeladen`;
      const imagePath = res.data.path;

      if (target === 'hero') {
        $('#f-heroimage').value = imagePath;
      } else if (tuiEditor) {
        tuiEditor.insertText(`![${file.name}](${imagePath})`);
      }

      setTimeout(() => (statusEl.textContent = ''), 3000);
    } else {
      statusEl.textContent = errorMsg(res, 'Upload fehlgeschlagen');
    }

    uploadInput.value = '';
  });

  // --- Frontmatter Parser ---
  function parseFrontmatter(raw) {
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) return { frontmatter: {}, body: raw };

    const fm = {};
    let currentKey = null;
    let currentValue = '';
    let isMultiline = false;
    let inQuotedString = false;

    for (const line of match[1].split('\n')) {
      // Fortführung eines mehrzeiligen Werts (eingerückt oder in Anführungszeichen)
      if (isMultiline && (line.startsWith('  ') || line.startsWith('\t'))) {
        let trimmed = line.trim();
        currentValue += (currentValue ? ' ' : '') + trimmed;
        continue;
      }

      // Fortführung eines quoted Strings über mehrere Zeilen
      if (inQuotedString) {
        let trimmed = line.trim();
        if (trimmed.endsWith('"') || trimmed.endsWith("'")) {
          currentValue += ' ' + trimmed.slice(0, -1);
          inQuotedString = false;
        } else {
          currentValue += ' ' + trimmed;
        }
        continue;
      }

      // Vorherigen Key speichern
      if (currentKey) {
        fm[currentKey] = currentValue.trim();
        currentKey = null;
        currentValue = '';
        isMultiline = false;
      }

      const kvMatch = line.match(/^(\w[\w-]*):\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1];
        let val = kvMatch[2].trim();

        // Multiline-Indikator (> oder |)
        if (val === '>' || val === '|') {
          isMultiline = true;
          currentValue = '';
          continue;
        }

        // Quoted string (komplett auf einer Zeile)
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        // Quoted string über mehrere Zeilen (öffnendes Quote ohne schließendes)
        else if (val.startsWith('"') || val.startsWith("'")) {
          currentValue = val.slice(1);
          inQuotedString = true;
          continue;
        }

        currentValue = val;
        isMultiline = true;
      }
    }

    // Letzten Key speichern
    if (currentKey) {
      fm[currentKey] = currentValue.trim();
    }

    return { frontmatter: fm, body: match[2].trim() };
  }

  // --- Frontmatter Builder ---
  function buildFile(fm, body) {
    let yaml = '---\n';
    for (const [key, value] of Object.entries(fm)) {
      if (typeof value === 'string' && (value.includes(':') || value.includes('"') || value.includes('\n'))) {
        if (value.includes('\n')) {
          yaml += `${key}: >\n`;
          for (const line of value.split('\n')) {
            yaml += `  ${line}\n`;
          }
        } else {
          yaml += `${key}: "${value.replace(/"/g, '\\"')}"\n`;
        }
      } else {
        yaml += `${key}: ${value}\n`;
      }
    }
    yaml += '---\n';
    return yaml + body + '\n';
  }

  // --- Helpers ---
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
  }

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function formatDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
    return `${parseInt(d)}. ${months[parseInt(m) - 1]} ${y}`;
  }

  // --- Magic Token Handler ---
  async function handleMagicToken(magicToken) {
    showView('login');
    const errorEl = $('#login-error');
    const statusEl = $('#magic-link-status');
    statusEl.textContent = 'Magic Link wird geprüft...';
    statusEl.className = 'magic-link-status';
    statusEl.hidden = false;
    errorEl.hidden = true;

    const res = await api('POST', '/api/login/magic', { token: magicToken });

    if (res && res.status === 200 && res.data.token) {
      token = res.data.token;
      localStorage.setItem('cms_token', token);
      statusEl.hidden = true;
      navigate('#list');
    } else {
      statusEl.textContent = errorMsg(res, 'Magic Link ungültig oder abgelaufen');
      statusEl.className = 'magic-link-status error';
    }
  }

  // --- Einstellungen Modal ---
  $('#settings-btn').addEventListener('click', () => {
    $('#settings-modal').hidden = false;
    $('#pw-current').value = '';
    $('#pw-new').value = '';
    $('#pw-confirm').value = '';
    $('#pw-status').hidden = true;
    $('#pw-current').focus();
  });

  $('#settings-close').addEventListener('click', () => {
    $('#settings-modal').hidden = true;
  });

  $('#settings-modal').addEventListener('click', (e) => {
    if (e.target === $('#settings-modal')) $('#settings-modal').hidden = true;
  });

  $('#password-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = $('#pw-current').value;
    const newPassword = $('#pw-new').value;
    const confirmPassword = $('#pw-confirm').value;
    const statusEl = $('#pw-status');

    if (newPassword.length < 8) {
      statusEl.textContent = 'Neues Passwort muss mindestens 8 Zeichen lang sein';
      statusEl.className = 'pw-status error';
      statusEl.hidden = false;
      return;
    }

    if (newPassword !== confirmPassword) {
      statusEl.textContent = 'Passwörter stimmen nicht überein';
      statusEl.className = 'pw-status error';
      statusEl.hidden = false;
      return;
    }

    statusEl.textContent = 'Passwort wird geändert...';
    statusEl.className = 'pw-status';
    statusEl.hidden = false;

    const res = await api('PUT', '/api/password', { oldPassword, newPassword });

    if (res && res.status === 200) {
      statusEl.textContent = 'Passwort erfolgreich geändert';
      statusEl.className = 'pw-status success';
      $('#pw-current').value = '';
      $('#pw-new').value = '';
      $('#pw-confirm').value = '';
    } else {
      statusEl.textContent = errorMsg(res, 'Fehler beim Ändern des Passworts');
      statusEl.className = 'pw-status error';
    }
  });

  // --- Versionsverlauf ---
  let versionsData = [];
  let versionPreviewContent = null;

  $('#versions-btn').addEventListener('click', () => {
    if ($('#versions-panel').hidden) {
      loadVersions();
    } else {
      closeVersions();
    }
  });

  $('#versions-close').addEventListener('click', closeVersions);

  function closeVersions() {
    $('#versions-panel').hidden = true;
    $('#version-preview').hidden = true;
    versionsData = [];
    versionPreviewContent = null;
  }

  async function loadVersions() {
    if (!currentFile || !currentFile.path) return;

    const panel = $('#versions-panel');
    const list = $('#versions-list');
    panel.hidden = false;
    list.innerHTML = '<div class="loading">Laden...</div>';
    $('#version-preview').hidden = true;

    const res = await api('GET', `/api/versions/${encodeURIComponent(currentFile.path)}`);

    if (!res || res.status !== 200 || !res.data.versions) {
      list.innerHTML = '<div class="loading">Keine Versionen gefunden</div>';
      return;
    }

    versionsData = res.data.versions;

    list.innerHTML = versionsData.map((v, i) => {
      const date = new Date(v.date);
      const dateStr = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
      const badge = i === 0 ? ' <span class="version-badge">Aktuell</span>' : '';
      const msg = v.message.split('\n')[0].replace(/ via perfectCMS.*$/, '');
      return `<div class="version-item${i === 0 ? ' active' : ''}" tabindex="0" data-idx="${i}" data-sha="${v.sha}">
        <div class="version-date">${dateStr}, ${timeStr}${badge}</div>
        <div class="version-message">${escapeHtml(msg)}</div>
      </div>`;
    }).join('');

    list.querySelectorAll('.version-item').forEach(item => {
      const openVersion = () => {
        const idx = parseInt(item.dataset.idx);
        if (idx === 0) return; // Aktuell, nichts laden
        list.querySelectorAll('.version-item').forEach(v => v.classList.remove('active'));
        item.classList.add('active');
        loadVersionPreview(item.dataset.sha, versionsData[idx]);
      };
      item.addEventListener('click', openVersion);
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openVersion(); }
      });
    });
  }

  async function loadVersionPreview(sha, version) {
    const preview = $('#version-preview');
    const contentEl = $('#version-preview-content');
    const dateEl = $('#version-preview-date');

    preview.hidden = false;
    contentEl.textContent = 'Laden...';

    const date = new Date(version.date);
    dateEl.textContent = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    const res = await api('GET', `/api/content/${encodeURIComponent(currentFile.path)}?ref=${sha}`);

    if (res && res.status === 200) {
      versionPreviewContent = res.data.content;
      contentEl.textContent = res.data.content;
    } else {
      contentEl.textContent = 'Fehler beim Laden der Version';
      versionPreviewContent = null;
    }
  }

  $('#version-restore').addEventListener('click', () => {
    if (!versionPreviewContent) return;

    const { frontmatter, body } = parseFrontmatter(versionPreviewContent);

    if (currentFile.type === 'text') {
      $('#f-title').value = frontmatter.title || '';
      $('#f-type').value = frontmatter.type || 'Gedicht';
      $('#f-date').value = frontmatter.date ? frontmatter.date.slice(0, 10) : '';
      $('#f-excerpt').value = frontmatter.excerpt || '';
      $('#f-heroimage').value = frontmatter.heroImage || '';
      $('#f-draft').checked = frontmatter.draft === 'true' || frontmatter.draft === true;
    } else {
      $('#fp-title').value = frontmatter.title || '';
      $('#fp-subtitle').value = frontmatter.subtitle || '';
      $('#fp-description').value = frontmatter.description || '';
    }

    if (tuiEditor) {
      tuiEditor.setMarkdown(body);
    }

    closeVersions();
    onContentChange();
    updatePublishButton();
  });

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // --- Cmd+S / Ctrl+S ---
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      if (!viewEditor.hidden) saveContent(false);
    }
  });

  // --- Warnung bei ungespeicherten Änderungen ---
  window.addEventListener('beforeunload', (e) => {
    if (hasUnsavedChanges) { e.preventDefault(); }
  });

  // --- Init ---
  handleRoute();
})();
