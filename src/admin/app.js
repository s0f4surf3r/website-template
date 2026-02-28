/**
 * perfectCMS — Frontend (Vanilla JS SPA)
 * Hash-basierter Router: #login, #list, #edit/:path
 */

(function () {
  'use strict';

  // --- Config ---
  const API_URL = localStorage.getItem('cms_api_url') || 'https://perfectcmstm6mdmqs-cms-api.functions.fnc.fr-par.scw.cloud';

  // --- State ---
  let token = localStorage.getItem('cms_token') || null;
  let contentCache = null;
  let currentFile = null; // { path, sha, type, isNew }
  let tuiEditor = null;

  // --- DOM Refs ---
  const $ = (sel) => document.querySelector(sel);
  const viewLogin = $('#view-login');
  const viewList = $('#view-list');
  const viewEditor = $('#view-editor');

  // --- API Helper ---
  async function api(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const data = await res.json().catch(() => null);

    if (res.status === 401 && path !== '/api/login') {
      logout();
      return null;
    }

    return { status: res.status, data };
  }

  // --- Router ---
  function showView(name) {
    viewLogin.hidden = name !== 'login';
    viewList.hidden = name !== 'list';
    viewEditor.hidden = name !== 'editor';
    if (name !== 'editor' && tuiEditor) {
      tuiEditor.destroy();
      tuiEditor = null;
    }
  }

  function navigate(hash) {
    window.location.hash = hash;
  }

  function handleRoute() {
    const hash = window.location.hash || '#';

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

  // --- Login ---
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#login-email').value.trim();
    const password = $('#login-password').value;
    const errorEl = $('#login-error');
    errorEl.hidden = true;

    const res = await api('POST', '/api/login', { email, password });

    if (res && res.status === 200 && res.data.token) {
      token = res.data.token;
      localStorage.setItem('cms_token', token);
      navigate('#list');
    } else {
      errorEl.textContent = (res && res.data && res.data.error) || 'Anmeldung fehlgeschlagen';
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
      texteList.innerHTML = '<li class="loading">Fehler beim Laden</li>';
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

    // Felder leeren
    $('#f-title').value = '';
    $('#f-type').value = 'Gedicht';
    $('#f-date').value = today;
    $('#f-excerpt').value = '';
    $('#f-heroimage').value = '';
    initEditor('');
    $('#save-status').textContent = '';
  }

  // --- Editor laden ---
  async function loadEditor(path) {
    const isText = path.startsWith('src/texte/');
    currentFile = { path, sha: null, type: isText ? 'text' : 'page', isNew: false };

    // Felder ein/ausblenden
    $('#fields-text').hidden = !isText;
    $('#fields-page').hidden = isText;
    $('#delete-btn').hidden = !isText; // Seiten nicht löschbar
    $('#save-status').textContent = 'Laden...';

    const res = await api('GET', `/api/content/${encodeURIComponent(path)}`);
    if (!res || res.status !== 200) {
      $('#save-status').textContent = 'Fehler beim Laden';
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
    } else {
      $('#fp-title').value = frontmatter.title || '';
      $('#fp-subtitle').value = frontmatter.subtitle || '';
      $('#fp-description').value = frontmatter.description || '';
    }

    initEditor(body);
    $('#save-status').textContent = '';
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
    revealCodesBtn.className = 'reveal-codes-btn toastui-editor-toolbar-icons';
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
        ['hr', 'quote'],
        ['ul', 'ol'],
        ['image', 'link'],
        ['code', 'codeblock'],
        [{ el: revealCodesBtn, tooltip: 'Reveal Codes (Alt+F3)', name: 'revealCodes' }],
      ],
      hooks: {
        addImageBlobHook: handleImageBlobUpload,
      },
    });

    // Alt+F3 Keyboard Shortcut
    container.addEventListener('keydown', (e) => {
      if (e.altKey && e.key === 'F3') {
        e.preventDefault();
        toggleRevealCodes();
      }
    });
  }

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

  function handleImageBlobUpload(blob, callback) {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];
      const filename = blob.name ? blob.name.toLowerCase().replace(/[^a-z0-9._-]/g, '-') : 'bild.png';
      const res = await api('POST', '/api/upload', { filename, data: base64 });
      if (res && res.status === 200) {
        callback(res.data.path, blob.name || 'Bild');
      } else {
        callback('', 'Upload fehlgeschlagen');
      }
    };
    reader.readAsDataURL(blob);
  }

  // --- Speichern ---
  $('#save-btn').addEventListener('click', saveContent);

  async function saveContent() {
    const saveBtn = $('#save-btn');
    const status = $('#save-status');
    saveBtn.disabled = true;
    status.textContent = 'Speichern...';

    let frontmatter, path;

    if (currentFile.type === 'text') {
      const title = $('#f-title').value.trim();
      const type = $('#f-type').value;
      const date = $('#f-date').value;
      const excerpt = $('#f-excerpt').value.trim();
      const heroImage = $('#f-heroimage').value.trim();

      if (!title || !date) {
        status.textContent = 'Titel und Datum erforderlich';
        saveBtn.disabled = false;
        return;
      }

      frontmatter = {
        layout: 'text',
        tags: 'text',
        title,
        date: `${date}T00:00:00.000+01:00`,
        type,
      };
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
      status.textContent = 'Gespeichert';
      status.style.color = 'var(--success)';
      setTimeout(() => {
        status.textContent = '';
        status.style.color = '';
      }, 2000);
    } else {
      status.textContent = 'Fehler beim Speichern';
      status.style.color = 'var(--danger)';
    }

    saveBtn.disabled = false;
  }

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
      status.textContent = 'Fehler beim Löschen';
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
      statusEl.textContent = 'Upload fehlgeschlagen';
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

  // --- Init ---
  handleRoute();
})();
