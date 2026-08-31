// PI-CHAT GATEWAY frontend logic
(function () {
  'use strict';

  // ---------- Icons (Monochrome SVG) ----------
  const icons = {
    copy: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    check: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    speaker: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path></svg>`,
    speakerStop: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
    download: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    regenerate: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>`,
    trash: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`,
    edit: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    spinner: `<svg class="icon" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite"/></path></svg>`,
    voiceOn: `<svg class="icon btn-svg voice-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`,
    voiceOff: `<svg class="icon btn-svg voice-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`,
  };

  // ---------- State ----------
  const state = {
    providers: [],
    conversations: [],
    currentConv: null, // full conversation object
    currentConvId: null,
    models: [],
    modelsError: '',
    sending: false,
    systemPrompts: [],
    defaultPromptId: '',
    editingPromptId: null,
    editingProviderId: null,
    appSettings: {},
  };

  // ---------- Audio State & Cache ----------
  let currentPlayingIndex = null;
  let audioPlayer = null;
  const audioCache = new Map(); // key -> base64Data

  function getAudioKey(msgIndex, content) {
    return `${state.currentConvId}_${msgIndex}_${(content || '').substring(0, 30)}`;
  }

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const el = {
    convList: $('conversation-list'),
    sidebar: $('sidebar'),
    sidebarOverlay: $('sidebar-overlay'),
    btnMenu: $('btn-menu'),
    settingsBar: $('settings-bar'),
    btnSettingsToggle: $('btn-settings-toggle'),
    btnNewChat: $('btn-new-chat'),
    btnManageProviders: $('btn-manage-providers'),
    btnClearAll: $('btn-clear-all'),
    selProvider: $('sel-provider'),
    selModel: $('sel-model'),
    selSystemPrompt: $('sel-system-prompt'),
    selContext: $('sel-context'),
    selMode: $('sel-mode'),
    chkReturnToSend: $('chk-return-to-send'),
    btnVoice: $('btn-voice'),
    selVoiceSpeed: $('sel-voice-speed'),
    selVoiceName: $('sel-voice-name'),
    btnSaveSettings: $('btn-save-settings'),
    chatMessages: $('chat-messages'),
    emptyState: $('empty-state'),
    inputMessage: $('input-message'),
    btnSend: $('btn-send'),
    setupPage: $('setup-page'),
    mainView: $('main'),
    btnCloseSetup: $('btn-close-setup'),
    promptName: $('prompt-name'),
    promptContent: $('prompt-content'),
    promptGlobal: $('prompt-global'),
    btnSavePrompt: $('btn-save-prompt'),
    btnCancelPromptEdit: $('btn-cancel-prompt-edit'),
    promptList: $('prompt-list'),
    selDefaultPrompt: $('sel-default-prompt'),
    btnSaveDefaultPrompt: $('btn-save-default-prompt'),
    setupSaveStatus: $('setup-save-status'),
    provName: $('prov-name'),
    provUrl: $('prov-url'),
    provApiKey: $('prov-api-key'),
    provType: $('prov-type'),
    btnAddProvider: $('btn-add-provider'),
    providerList: $('provider-list'),
  };

  // ---------- Client ID management ----------
  function getClientId() {
    let id = localStorage.getItem('pi_chat_client_id');
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = 'client_' + crypto.randomUUID();
      } else {
        id = 'client_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 10);
      }
      try {
        localStorage.setItem('pi_chat_client_id', id);
      } catch (e) {
        // localStorage might be unavailable in some private browsing modes
      }
    }
    return id;
  }

  // ---------- API helpers ----------
  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'X-Client-ID': getClientId(),
      ...(options.headers || {}),
    };
    const opts = {
      method: options.method || 'GET',
      ...options,
      headers,
    };
    if (opts.body && typeof opts.body !== 'string') {
      opts.body = JSON.stringify(opts.body);
    }
    const resp = await fetch(path, opts);
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(data.error || `Request failed (${resp.status})`);
    }
    return data;
  }

  // ---------- Inline Delete Popover ----------
  let activePopover = null;

  function closeDeletePopover() {
    if (activePopover) {
      activePopover.remove();
      activePopover = null;
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onDocKey, true);
    }
  }

  function onDocClick(e) {
    if (activePopover && !activePopover.contains(e.target)) {
      closeDeletePopover();
    }
  }

  function onDocKey(e) {
    if (e.key === 'Escape') {
      closeDeletePopover();
    }
  }

  function showDeletePopover(triggerBtn, promptText, onConfirm) {
    closeDeletePopover();

    const popover = document.createElement('div');
    popover.className = 'delete-popover';

    const text = document.createElement('div');
    text.className = 'delete-popover-text';
    text.textContent = promptText || 'Delete chat?';

    const actions = document.createElement('div');
    actions.className = 'delete-popover-actions';

    const btnCancel = document.createElement('button');
    btnCancel.className = 'delete-popover-btn cancel';
    btnCancel.textContent = 'Cancel';
    btnCancel.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDeletePopover();
    });

    const btnDelete = document.createElement('button');
    btnDelete.className = 'delete-popover-btn confirm';
    btnDelete.textContent = 'Delete';
    btnDelete.addEventListener('click', async (e) => {
      e.stopPropagation();
      closeDeletePopover();
      await onConfirm();
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnDelete);
    popover.appendChild(text);
    popover.appendChild(actions);

    document.body.appendChild(popover);
    activePopover = popover;

    // Position popover beside the trigger button
    const rect = triggerBtn.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();

    let left = rect.right + 8;
    let top = rect.top + (rect.height - popoverRect.height) / 2;

    if (left + popoverRect.width > window.innerWidth - 12) {
      left = rect.left - popoverRect.width - 8;
    }
    if (left < 12) {
      left = 12;
    }
    if (top < 12) {
      top = 12;
    } else if (top + popoverRect.height > window.innerHeight - 12) {
      top = window.innerHeight - popoverRect.height - 12;
    }

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;

    setTimeout(() => {
      document.addEventListener('click', onDocClick, true);
      document.addEventListener('keydown', onDocKey, true);
    }, 10);
  }

  // ---------- Mobile settings bar collapse ----------
  const SETTINGS_COLLAPSED_KEY = 'pi_chat_settings_collapsed';

  function applySettingsCollapsed(collapsed) {
    el.settingsBar.classList.toggle('collapsed', collapsed);
    el.btnSettingsToggle.classList.toggle('active', !collapsed);
    el.btnSettingsToggle.setAttribute('aria-expanded', String(!collapsed));
  }

  // Restore the saved show/hide preference. Defaults to collapsed so the
  // chat gets maximum space on small screens; the CSS media query scopes
  // the .collapsed rule to mobile widths, so desktop is unaffected.
  function initSettingsCollapse() {
    let collapsed = true;
    try {
      const saved = localStorage.getItem(SETTINGS_COLLAPSED_KEY);
      if (saved !== null) {
        collapsed = saved === '1';
      }
    } catch (e) {
      // localStorage might be unavailable in some private browsing modes
    }
    applySettingsCollapsed(collapsed);
  }

  // Keep the composer above mobile keyboards that overlay the page instead
  // of resizing the layout viewport.
  function initKeyboardAdjustment() {
    if (!window.visualViewport) return;

    let fullViewportHeight = Math.max(window.innerHeight, window.visualViewport.height);

    const updateKeyboardOffset = () => {
      const isMobile = window.matchMedia('(max-width: 768px)').matches;
      const viewport = window.visualViewport;
      const keyboardHeight = fullViewportHeight - viewport.height - viewport.offsetTop;
      if (keyboardHeight <= 100) {
        fullViewportHeight = Math.max(fullViewportHeight, window.innerHeight, viewport.height);
      }
      const offset = isMobile && keyboardHeight > 100 ? keyboardHeight : 0;
      document.documentElement.style.setProperty('--keyboard-offset', `${Math.max(0, offset)}px`);
    };

    window.visualViewport.addEventListener('resize', updateKeyboardOffset);
    window.visualViewport.addEventListener('scroll', updateKeyboardOffset);
    window.addEventListener('resize', updateKeyboardOffset);
    updateKeyboardOffset();
  }

  // ---------- Mobile sidebar ----------
  function openSidebar() {
    el.sidebar.classList.add('open');
    el.sidebarOverlay.classList.remove('hidden');
    document.body.classList.add('sidebar-open');
  }

  function closeSidebar() {
    el.sidebar.classList.remove('open');
    el.sidebarOverlay.classList.add('hidden');
    document.body.classList.remove('sidebar-open');
  }

  // ---------- View switching ----------
  function showSetup() {
    closeSidebar();
    el.mainView.classList.add('hidden');
    el.setupPage.classList.remove('hidden');
    renderProviderList();
    renderPromptList();
  }

  function showChat() {
    el.setupPage.classList.add('hidden');
    el.mainView.classList.remove('hidden');
    closeSidebar();
  }

  // ---------- Providers ----------
  async function loadProviders() {
    state.providers = await api('/api/providers');
    renderProviderSelect();
    renderProviderList();
  }

  function renderProviderSelect() {
    const sel = el.selProvider;
    const current = sel.value;
    sel.innerHTML = '';
    if (state.providers.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No providers configured';
      sel.appendChild(opt);
    } else {
      for (const p of state.providers) {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        sel.appendChild(opt);
      }
      if (current && state.providers.some((p) => p.id === current)) {
        sel.value = current;
      }
    }
  }

  function renderProviderList() {
    el.providerList.innerHTML = '';
    for (const p of state.providers) {
      const li = document.createElement('li');
      const info = document.createElement('div');
      info.className = 'provider-info';
      info.innerHTML = `
        <div class="provider-name"></div>
        <div class="provider-url"></div>
        <div class="provider-type"></div>
        <div class="provider-apikey"></div>
      `;
      info.querySelector('.provider-name').textContent = p.name;
      info.querySelector('.provider-url').textContent = p.base_url;
      info.querySelector('.provider-type').textContent = p.type;
      info.querySelector('.provider-apikey').textContent = p.api_key ? `🔑 ${p.api_key}` : '';

      const actions = document.createElement('div');
      actions.className = 'provider-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'provider-action-btn';
      btnEdit.innerHTML = icons.edit;
      btnEdit.title = 'Edit provider';
      btnEdit.addEventListener('click', () => {
        el.provName.value = p.name;
        el.provUrl.value = p.base_url;
        el.provApiKey.value = p.api_key || '';
        el.provType.value = p.type === 'ollama'
          ? (p.base_url === 'https://api.ollama.com' ? 'ollama-online' : 'ollama-local')
          : p.type;
        updateProviderTypeFields();
        state.editingProviderId = p.id;
        el.btnAddProvider.textContent = 'Update Provider';
      });

      const del = document.createElement('button');
      del.className = 'provider-delete';
      del.innerHTML = icons.trash;
      del.title = 'Delete provider';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeletePopover(del, `Delete provider "${p.name}"?`, async () => {
          try {
            await api(`/api/providers/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
            await loadProviders();
            if (state.currentConv && state.currentConv.settings.provider_id === p.id) {
              state.currentConv.settings.provider_id = '';
              state.currentConv.settings.model = '';
              await saveSettings();
            }
          } catch (err) {
            alert(err.message);
          }
        });
      });

      actions.appendChild(btnEdit);
      actions.appendChild(del);

      li.appendChild(info);
      li.appendChild(actions);
      el.providerList.appendChild(li);
    }
  }

  // ---------- System prompts ----------
  async function loadSystemPrompts() {
    try {
      state.systemPrompts = await api('/api/system-prompts');
    } catch (err) {
      state.systemPrompts = [];
      console.error('Failed to load system prompts:', err.message);
    }
  }

  async function loadAppSettings() {
    try {
      const settings = await api('/api/settings');
      state.appSettings = settings;
      state.defaultPromptId = settings.default_system_prompt_id || '';
      el.chkReturnToSend.checked = settings.return_to_send !== false;
    } catch (err) {
      state.defaultPromptId = '';
      console.error('Failed to load app settings:', err.message);
    }
  }

  function renderPromptList() {
    el.promptList.innerHTML = '';
    for (const p of state.systemPrompts) {
      const li = document.createElement('li');
      const info = document.createElement('div');
      info.className = 'prompt-info';
      info.innerHTML = `
        <div class="prompt-name"></div>
        <div class="prompt-content-preview"></div>
      `;
      const isGlobal = (p.scope || 'local') === 'global';
      const scopeText = isGlobal ? ' [Global]' : ' [Local]';
      info.querySelector('.prompt-name').textContent = p.name + scopeText + (p.id === state.defaultPromptId ? ' ★' : '');
      info.querySelector('.prompt-content-preview').textContent = p.content;

      const actions = document.createElement('div');
      actions.className = 'prompt-actions';

      const btnEdit = document.createElement('button');
      btnEdit.className = 'prompt-action-btn';
      btnEdit.innerHTML = icons.edit;
      btnEdit.title = 'Edit prompt';
      btnEdit.addEventListener('click', () => startEditingPrompt(p));

      const btnDelete = document.createElement('button');
      btnDelete.className = 'prompt-action-btn delete';
      btnDelete.innerHTML = icons.trash;
      btnDelete.title = 'Delete prompt';
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeletePopover(btnDelete, `Delete prompt "${p.name}"?`, async () => {
          try {
            await api(`/api/system-prompts/${encodeURIComponent(p.id)}`, { method: 'DELETE' });
            if (state.defaultPromptId === p.id) {
              state.defaultPromptId = '';
            }
            await loadSystemPrompts();
            renderPromptList();
            renderDefaultPromptSelect();
            renderSystemPromptSelect();
          } catch (err) {
            alert(err.message);
          }
        });
      });

      actions.appendChild(btnEdit);
      actions.appendChild(btnDelete);

      li.appendChild(info);
      li.appendChild(actions);
      el.promptList.appendChild(li);
    }
  }

  function renderDefaultPromptSelect() {
    const current = state.defaultPromptId;
    el.selDefaultPrompt.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    el.selDefaultPrompt.appendChild(noneOpt);
    for (const p of state.systemPrompts) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      el.selDefaultPrompt.appendChild(opt);
    }
    if (current && state.systemPrompts.some((p) => p.id === current)) {
      el.selDefaultPrompt.value = current;
    }
  }

  // ---------- System prompt quick-select (settings bar) ----------
  const CUSTOM_PROMPT_VALUE = '__custom__';

  // renderSystemPromptSelect rebuilds the settings-bar dropdown from the
  // saved prompt titles, then re-syncs it to the active conversation.
  function renderSystemPromptSelect() {
    const sel = el.selSystemPrompt;
    sel.innerHTML = '';
    const noneOpt = document.createElement('option');
    noneOpt.value = '';
    noneOpt.textContent = 'None';
    sel.appendChild(noneOpt);
    for (const p of state.systemPrompts) {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    }
    syncSystemPromptSelect();
  }

  // syncSystemPromptSelect matches the active conversation's stored prompt
  // content back to a saved prompt title. Content saved outside of the
  // named prompts shows up as "(custom)" so it isn't silently lost.
  function syncSystemPromptSelect() {
    const content = state.currentConv ? (state.currentConv.settings.system_prompt || '') : '';
    const matchesSaved = state.systemPrompts.some((p) => p.content === content);
    let customOpt = el.selSystemPrompt.querySelector('option[data-custom]');
    if (content && !matchesSaved) {
      if (!customOpt) {
        customOpt = document.createElement('option');
        customOpt.value = CUSTOM_PROMPT_VALUE;
        customOpt.setAttribute('data-custom', '');
        customOpt.textContent = '(custom)';
        el.selSystemPrompt.appendChild(customOpt);
      }
      el.selSystemPrompt.value = CUSTOM_PROMPT_VALUE;
    } else {
      if (customOpt) customOpt.remove();
      const match = state.systemPrompts.find((p) => p.content === content);
      el.selSystemPrompt.value = match ? match.id : '';
    }
  }

  function resetPromptForm() {
    el.promptName.value = '';
    el.promptContent.value = '';
    el.promptGlobal.checked = false;
    state.editingPromptId = null;
    el.btnCancelPromptEdit.classList.add('hidden');
    el.btnSavePrompt.textContent = 'Save Role';
  }

  function startEditingPrompt(prompt) {
    state.editingPromptId = prompt.id;
    el.promptName.value = prompt.name;
    el.promptContent.value = prompt.content;
    el.promptGlobal.checked = (prompt.scope || 'local') === 'global';
    el.btnCancelPromptEdit.classList.remove('hidden');
    el.btnSavePrompt.textContent = 'Update Role';
    el.promptName.focus();
  }

  async function savePrompt() {
    const name = el.promptName.value.trim();
    const content = el.promptContent.value.trim();
    if (!name) {
      alert('Prompt name is required.');
      return;
    }
    try {
      const body = {
        name,
        content,
        scope: el.promptGlobal.checked ? 'global' : 'local',
      };
      if (state.editingPromptId) {
        body.id = state.editingPromptId;
      }
      await api('/api/system-prompts', {
        method: 'POST',
        body,
      });
      resetPromptForm();
      await loadSystemPrompts();
      renderPromptList();
      renderDefaultPromptSelect();
      renderSystemPromptSelect();
    } catch (err) {
      alert(err.message);
    }
  }

  async function saveDefaultPrompt() {
    state.defaultPromptId = el.selDefaultPrompt.value;
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: { default_system_prompt_id: state.defaultPromptId },
      });
      el.setupSaveStatus.textContent = 'Saved ✓';
      renderPromptList();
      setTimeout(() => {
        if (el.setupSaveStatus.textContent === 'Saved ✓') {
          el.setupSaveStatus.textContent = '';
        }
      }, 2000);
    } catch (err) {
      alert(err.message);
    }
  }

  function getDefaultPromptContent() {
    if (!state.defaultPromptId) return '';
    const prompt = state.systemPrompts.find((p) => p.id === state.defaultPromptId);
    return prompt ? prompt.content : '';
  }

  // ---------- Models ----------
  async function loadModels(providerId) {
    if (!providerId) {
      state.models = [];
      renderModelSelect();
      return;
    }
    try {
      state.models = await api(`/api/models?provider_id=${encodeURIComponent(providerId)}`);
      state.modelsError = '';
    } catch (err) {
      state.models = [];
      state.modelsError = err.message;
      console.error('Failed to load models:', err.message);
    }
    renderModelSelect();
  }

  function renderModelSelect() {
    const sel = el.selModel;
    const current = sel.value;
    sel.innerHTML = '';
    if (state.models.length === 0) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = state.modelsError ? `⚠️ ${state.modelsError}` : 'No models found';
      sel.appendChild(opt);
    } else {
      for (const m of state.models) {
        const opt = document.createElement('option');
        opt.value = m.name;
        opt.textContent = m.name;
        sel.appendChild(opt);
      }
      if (current && state.models.some((m) => m.name === current)) {
        sel.value = current;
      }
    }
  }

  // ---------- Conversations ----------
  async function loadConversations() {
    state.conversations = await api('/api/conversations');
    renderConversationList();
  }

  function renderConversationList() {
    el.convList.innerHTML = '';
    for (const c of state.conversations) {
      const item = document.createElement('div');
      item.className = 'conv-item' + (c.id === state.currentConvId ? ' active' : '');
      item.dataset.id = c.id;

      const title = document.createElement('span');
      title.className = 'conv-title';
      title.textContent = c.title;
      title.title = c.title;

      const actions = document.createElement('div');
      actions.className = 'conv-actions';

      const btnRename = document.createElement('button');
      btnRename.className = 'conv-action-btn';
      btnRename.innerHTML = icons.edit;
      btnRename.title = 'Rename';
      btnRename.addEventListener('click', async (e) => {
        e.stopPropagation();
        await renameConversation(c);
      });

      const btnDelete = document.createElement('button');
      btnDelete.className = 'conv-action-btn';
      btnDelete.innerHTML = icons.trash;
      btnDelete.title = 'Delete';
      btnDelete.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeletePopover(btnDelete, `Delete "${c.title}"?`, () => deleteConversation(c));
      });

      actions.appendChild(btnRename);
      actions.appendChild(btnDelete);

      item.appendChild(title);
      item.appendChild(actions);

      item.addEventListener('click', () => openConversation(c.id));

      el.convList.appendChild(item);
    }
  }

  async function createConversation() {
    try {
      const c = await api('/api/conversations', {
        method: 'POST',
        body: {
          title: 'New Chat',
          settings: {
            ...defaultSettings(),
            system_prompt: getDefaultPromptContent(),
          },
        },
      });
      state.currentConv = c;
      state.currentConvId = c.id;
      await loadConversations();
      await openConversation(c.id);
    } catch (err) {
      alert(err.message);
    }
  }

  async function openConversation(id) {
    try {
      const c = await api(`/api/conversations/${encodeURIComponent(id)}`);
      state.currentConv = c;
      state.currentConvId = c.id;
      applySettingsToUI(c.settings);
      renderMessages(c.messages);
      renderConversationList();
      el.inputMessage.focus();
    } catch (err) {
      alert(err.message);
    }
  }

  async function renameConversation(c) {
    const newTitle = prompt('Rename chat:', c.title);
    if (newTitle === null || newTitle.trim() === '') return;
    try {
      const full = await api(`/api/conversations/${encodeURIComponent(c.id)}`);
      full.title = newTitle.trim();
      await api(`/api/conversations/${encodeURIComponent(c.id)}`, {
        method: 'PUT',
        body: full,
      });
      await loadConversations();
      if (state.currentConvId === c.id) {
        state.currentConv.title = newTitle.trim();
      }
    } catch (err) {
      alert(err.message);
    }
  }

  async function deleteConversation(c) {
    try {
      await api(`/api/conversations/${encodeURIComponent(c.id)}`, { method: 'DELETE' });
      if (state.currentConvId === c.id) {
        state.currentConv = null;
        state.currentConvId = null;
        renderMessages([]);
      }
      await loadConversations();
    } catch (err) {
      alert(err.message);
    }
  }

  async function clearAllConversations() {
    try {
      await api('/api/conversations', { method: 'DELETE' });
      state.currentConv = null;
      state.currentConvId = null;
      await loadConversations();
      renderMessages([]);
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Voice ----------
  let voiceEnabled = false;
  let voiceSpeed = 3;
  let voiceName = 'en-GB-SoniaNeural';

  const voiceGroups = {
    Female: [
      ['Libby', 'British, Soft/Storytelling', 'en-GB-LibbyNeural'], ['Maisie', 'British, Bright/Upbeat', 'en-GB-MaisieNeural'],
      ['Aria', 'American, Natural/Conversational', 'en-US-AriaNeural'], ['Jenny', 'American, Professional/Balanced', 'en-US-JennyNeural'],
      ['Ana (Child)', 'American, Young/Soft', 'en-US-AnaNeural'], ['Clara', 'Canadian, Neutral/Smooth', 'en-CA-ClaraNeural'],
      ['Natasha', 'Australian, Regional Accent', 'en-AU-NatashaNeural'], ['Nanami', 'Japanese, English Accent/Multilingual', 'ja-JP-NanamiNeural'],
      ['Neerja', 'Indian, Expressive', 'en-IN-NeerjaNeural'], ['Aashi', 'Indian, Natural', 'en-IN-AashiNeural'],
      ['Luna', 'Singaporean, Regional Accent', 'en-SG-LunaNeural'], ['Yan', 'Hong Kong, Regional Accent', 'en-HK-YanNeural'],
      ['Rosa', 'Philippine, Regional Accent', 'en-PH-RosaNeural'], ['Ezinne', 'Nigerian, Expressive', 'en-NG-EzinneNeural'],
      ['Leah', 'South African, Natural', 'en-ZA-LeahNeural'], ['Asilia', 'Kenyan, Expressive', 'en-KE-AsiliaNeural'],
      ['Emily', 'Irish, Natural', 'en-IE-EmilyNeural'], ['Mia', 'Scottish, Regional Accent', 'en-GB-MiaNeural'],
    ],
    Male: [
      ['Christopher', 'American, Deep/Authoritative', 'en-US-ChristopherNeural'], ['Guy', 'American, Casual/Friendly', 'en-US-GuyNeural'],
      ['Eric', 'American, Measured/Calm', 'en-US-EricNeural'], ['Ryan', 'British, Rich/Expressive', 'en-GB-RyanNeural'],
      ['Thomas', 'British, Formal/Classic', 'en-GB-ThomasNeural'], ['Liam', 'Canadian, Clear/Natural', 'en-CA-LiamNeural'],
      ['William', 'Australian, Regional Accent', 'en-AU-WilliamNeural'], ['Keita', 'Japanese, English Accent/Multilingual', 'ja-JP-KeitaNeural'],
      ['Prabhat', 'Indian, Expressive', 'en-IN-PrabhatNeural'], ['Kunal', 'Indian, Natural', 'en-IN-KunalNeural'],
      ['Wayne', 'Singaporean, Regional Accent', 'en-SG-WayneNeural'], ['Sam', 'Hong Kong, Regional Accent', 'en-HK-SamNeural'],
      ['James', 'Philippine, Regional Accent', 'en-PH-JamesNeural'], ['Abeo', 'Nigerian, Expressive', 'en-NG-AbeoNeural'],
      ['Luke', 'South African, Natural', 'en-ZA-LukeNeural'], ['Chilemba', 'Kenyan, Expressive', 'en-KE-ChilembaNeural'],
      ['Connor', 'Irish, Natural', 'en-IE-ConnorNeural'], ['Mitchell', 'New Zealand, Regional Accent', 'en-NZ-MitchellNeural'],
    ],
  };

  function populateVoiceNames() {
    const addVoice = ([name, accent, id]) => {
      const option = document.createElement('option');
      option.value = id;
      option.textContent = `${name} - ${accent}`;
      el.selVoiceName.appendChild(option);
    };
    const addHeading = (text) => {
      const option = document.createElement('option');
      option.disabled = true;
      option.textContent = text;
      el.selVoiceName.appendChild(option);
    };
    const sortVoices = (voices) => voices.sort((a, b) => a[0].localeCompare(b[0]));

    addVoice(['Sonia', 'British, Clear/Expressive', 'en-GB-SoniaNeural']);
    addHeading('Female');
    for (const item of sortVoices(voiceGroups.Female)) {
      addVoice(item);
    }
    addHeading('Male');
    for (const item of sortVoices(voiceGroups.Male)) {
      addVoice(item);
    }
    el.selVoiceName.value = voiceName;
  }

  async function loadVoiceState() {
    try {
      const data = await api('/api/voice');
      voiceEnabled = !!data.voice;
      voiceSpeed = data.voice_speed || 3;
      voiceName = data.voice_name || voiceName;
      el.selVoiceSpeed.value = String(voiceSpeed);
      el.selVoiceName.value = voiceName;
      renderVoiceButton();
    } catch (err) {
      console.error('Failed to load voice state:', err.message);
    }
  }

  function renderVoiceButton() {
    if (voiceEnabled) {
      el.btnVoice.innerHTML = `${icons.voiceOn}<span>Voice On</span>`;
      el.btnVoice.classList.add('voice-on');
      el.btnVoice.classList.remove('voice-off');
    } else {
      el.btnVoice.innerHTML = `${icons.voiceOff}<span>Voice Off</span>`;
      el.btnVoice.classList.remove('voice-on');
      el.btnVoice.classList.add('voice-off');
    }
  }

  async function toggleVoice() {
    try {
      const data = await api('/api/voice', {
        method: 'PUT',
        body: { voice: !voiceEnabled },
      });
      voiceEnabled = !!data.voice;
      voiceSpeed = data.voice_speed || voiceSpeed;
      voiceName = data.voice_name || voiceName;
      el.selVoiceName.value = voiceName;
      renderVoiceButton();
    } catch (err) {
      alert(err.message);
    }
  }

  async function changeVoiceSpeed() {
    try {
      const speed = parseInt(el.selVoiceSpeed.value, 10);
      const data = await api('/api/voice', {
        method: 'PUT',
        body: { voice: voiceEnabled, voice_speed: speed, voice_name: voiceName },
      });
      voiceEnabled = !!data.voice;
      voiceSpeed = data.voice_speed || speed;
      renderVoiceButton();
    } catch (err) {
      alert(err.message);
    }
  }

  async function changeVoiceName() {
    try {
      voiceName = el.selVoiceName.value;
      const data = await api('/api/voice', {
        method: 'PUT',
        body: { voice: voiceEnabled, voice_speed: voiceSpeed, voice_name: voiceName },
      });
      voiceEnabled = !!data.voice;
      voiceSpeed = data.voice_speed || voiceSpeed;
      voiceName = data.voice_name || voiceName;
      el.selVoiceSpeed.value = String(voiceSpeed);
      el.selVoiceName.value = voiceName;
      renderVoiceButton();
    } catch (err) {
      alert(err.message);
    }
  }

  function playAudio(base64Data, mimeType, onEnded) {
    if (!base64Data) return;
    try {
      const binary = atob(base64Data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      if (audioPlayer) {
        audioPlayer.pause();
        URL.revokeObjectURL(audioPlayer.src);
      }
      audioPlayer = new Audio(url);
      if (onEnded) {
        audioPlayer.onended = onEnded;
        audioPlayer.onerror = onEnded;
      }
      audioPlayer.play().catch((err) => {
        console.error('Audio playback failed:', err);
        if (onEnded) onEnded();
      });
    } catch (err) {
      console.error('Failed to decode audio:', err);
      if (onEnded) onEnded();
    }
  }

  // ---------- Settings ----------
  function defaultSettings() {
    return {
      provider_id: el.selProvider.value || '',
      model: el.selModel.value || '',
      system_prompt: '',
      max_turns: parseInt(el.selContext.value, 10) || 12,
      mode: el.selMode.value || 'chat',
    };
  }

  function applySettingsToUI(settings) {
    if (settings.provider_id) {
      el.selProvider.value = settings.provider_id;
    }
    if (settings.model) {
      el.selModel.value = settings.model;
    }
    el.selContext.value = String(settings.max_turns || 12);
    el.selMode.value = settings.mode === 'story' ? 'story' : 'chat';
    syncSystemPromptSelect();
  }

  async function saveSettings() {
    if (!state.currentConv) return;
    state.currentConv.settings = {
      provider_id: el.selProvider.value || '',
      model: el.selModel.value || '',
      system_prompt: state.currentConv.settings.system_prompt || '',
      max_turns: parseInt(el.selContext.value, 10) || 12,
      mode: el.selMode.value === 'story' ? 'story' : 'chat',
    };
    try {
      await api(`/api/conversations/${encodeURIComponent(state.currentConvId)}`, {
        method: 'PUT',
        body: state.currentConv,
      });
    } catch (err) {
      alert(err.message);
    }
  }

  // ---------- Markdown rendering ----------
  // Lightweight, dependency-free markdown-to-HTML converter for assistant
  // messages. All input is HTML-escaped first, so LLM output can never
  // inject raw markup. Supports: headings, bold, italic, bold-italic,
  // strikethrough, inline code, fenced code blocks, links, images,
  // autolinks, blockquotes, ordered/unordered lists, horizontal rules,
  // paragraphs and line breaks.

  // Entity strings are built from concatenated parts so editors/formatters
  // cannot decode them back into literal characters.
  const ENT = {
    amp: '&' + 'amp;',
    lt: '&' + 'lt;',
    gt: '&' + 'gt;',
    quot: '&' + 'quot;',
    apos: '&' + '#39;',
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, ENT.amp)
      .replace(/</g, ENT.lt)
      .replace(/>/g, ENT.gt)
      .replace(/"/g, ENT.quot)
      .replace(/'/g, ENT.apos);
  }

  // ensureSentenceEnd appends a period when the text ends with a letter or
  // digit (i.e. it has no trailing punctuation). Used when stripping
  // emphasis markers so narration like "*she nods*" renders as
  // "she nods." — a complete sentence with a natural pause before any
  // following dialogue.
  function ensureSentenceEnd(s) {
    const trimmed = s.replace(/\s+$/, '');
    if (!trimmed) return s;
    return /[A-Za-z0-9]$/.test(trimmed) ? trimmed + '.' : trimmed;
  }

  // renderInline converts inline markdown (already HTML-escaped) to HTML.
  function renderInline(text) {
    // Stash inline code spans so their contents aren't further formatted.
    const codeSpans = [];
    text = text.replace(/`([^`]+)`/g, (m, code) => {
      codeSpans.push('<code class="md-code-inline">' + code + '</code>');
      return '\u0000C' + (codeSpans.length - 1) + '\u0000';
    });

    // Images: ![alt](src)
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g,
      '<img src="$2" alt="$1" class="md-img" loading="lazy">');

    // Links: [label](url)
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Bare URLs (not already inside an attribute).
    text = text.replace(/(^|[\s(])((?:https?:\/\/)[^\s<]+[^\s<.,;:!?)\]'"])/g,
      '$1<a href="$2" target="_blank" rel="noopener noreferrer">$2</a>');

    // Bold + italic: ***text***
    // A period is added when the enclosed text has no ending punctuation
    // so narration blocks read as complete sentences.
    text = text.replace(/\*\*\*([^*]+?)\*\*\*/g,
      (m, inner) => '<strong><em>' + ensureSentenceEnd(inner) + '</em></strong>');
    // Bold: **text**
    text = text.replace(/\*\*([^*]+?)\*\*/g,
      (m, inner) => '<strong>' + ensureSentenceEnd(inner) + '</strong>');
    // Italic: *text*
    text = text.replace(/\*([^*]+?)\*/g,
      (m, inner) => '<em>' + ensureSentenceEnd(inner) + '</em>');
    // Bold: __text__
    text = text.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
    // Italic: _text_ (boundary-aware to protect snake_case identifiers)
    text = text.replace(/(^|[^\w])_([^_]+?)_(?=[^\w]|$)/g, '$1<em>$2</em>');
    // Strikethrough: ~~text~~
    text = text.replace(/~~([^~]+?)~~/g, '<del>$1</del>');

    // Restore code spans.
    text = text.replace(/\u0000C(\d+)\u0000/g, (m, i) => codeSpans[+i]);
    return text;
  }

  // renderMarkdown converts a markdown string to an HTML string.
  function renderMarkdown(src) {
    if (src === null || src === undefined) return '';
    const lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    const out = [];
    let i = 0;
    let inCode = false;
    let codeLang = '';
    const codeLines = [];

    const isBlank = (l) => /^\s*$/.test(l);
    const isHr = (l) => /^\s{0,3}((-\s*){3,}|(\*\s*){3,}|(_\s*){3,})$/.test(l);
    const isUl = (l) => /^\s{0,3}[-*+]\s+/.test(l);
    const isOl = (l) => /^\s{0,3}\d+\.\s+/.test(l);
    const isQuote = (l) => /^\s{0,3}>/.test(l);
    const isHeading = (l) => /^#{1,6}\s+/.test(l);
    const isFence = (l) => /^\s{0,3}(```|~~~)/.test(l);
    const isBlockStart = (l) =>
      isBlank(l) || isHr(l) || isUl(l) || isOl(l) || isQuote(l) || isHeading(l) || isFence(l);

    while (i < lines.length) {
      const line = lines[i];

      // Fenced code blocks (``` or ~~~).
      if (isFence(line)) {
        if (!inCode) {
          inCode = true;
          codeLang = line.replace(/^\s{0,3}(```|~~~)\s*/, '').trim();
          codeLines.length = 0;
          i++;
          continue;
        }
        // Closing fence.
        out.push('<pre class="md-pre"' + (codeLang ? ' data-lang="' + escapeHtml(codeLang) + '"' : '') +
          '><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
        inCode = false;
        i++;
        continue;
      }
      if (inCode) {
        codeLines.push(line);
        i++;
        continue;
      }

      // Blank lines.
      if (isBlank(line)) {
        i++;
        continue;
      }

      // Headings: # .. ######
      const h = line.match(/^(#{1,6})\s+(.*)$/);
      if (h) {
        const lvl = h[1].length;
        out.push('<h' + lvl + ' class="md-h">' + renderInline(escapeHtml(h[2].trim())) + '</h' + lvl + '>');
        i++;
        continue;
      }

      // Horizontal rules: ---, ***, ___
      if (isHr(line)) {
        out.push('<hr class="md-hr">');
        i++;
        continue;
      }

      // Blockquotes: > text (multi-line, rendered recursively).
      if (isQuote(line)) {
        const quote = [];
        while (i < lines.length && isQuote(lines[i])) {
          quote.push(lines[i].replace(/^\s{0,3}>\s?/, ''));
          i++;
        }
        out.push('<blockquote class="md-quote">' + renderMarkdown(quote.join('\n')) + '</blockquote>');
        continue;
      }

      // Unordered lists: - item / * item / + item
      if (isUl(line)) {
        const items = [];
        while (i < lines.length && isUl(lines[i])) {
          items.push(lines[i].replace(/^\s{0,3}[-*+]\s+/, ''));
          i++;
          // Fold indented continuation lines into the current item.
          while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i]) && /^\s/.test(lines[i])) {
            items[items.length - 1] += ' ' + lines[i].trim();
            i++;
          }
        }
        out.push('<ul class="md-list">' +
          items.map((it) => '<li>' + renderInline(escapeHtml(it)) + '</li>').join('') + '</ul>');
        continue;
      }

      // Ordered lists: 1. item
      if (isOl(line)) {
        const items = [];
        while (i < lines.length && isOl(lines[i])) {
          items.push(lines[i].replace(/^\s{0,3}\d+\.\s+/, ''));
          i++;
          while (i < lines.length && !isBlank(lines[i]) && !isBlockStart(lines[i]) && /^\s/.test(lines[i])) {
            items[items.length - 1] += ' ' + lines[i].trim();
            i++;
          }
        }
        out.push('<ol class="md-list">' +
          items.map((it) => '<li>' + renderInline(escapeHtml(it)) + '</li>').join('') + '</ol>');
        continue;
      }

      // Paragraph: gather lines until a blank line or a new block starts.
      const para = [line];
      i++;
      while (i < lines.length && !isBlockStart(lines[i])) {
        para.push(lines[i]);
        i++;
      }
      out.push('<p class="md-p">' +
        renderInline(escapeHtml(para.join('\n'))).replace(/\n/g, '<br>') + '</p>');
    }

    // Unterminated code fence: flush what we have.
    if (inCode && codeLines.length > 0) {
      out.push('<pre class="md-pre"><code>' + escapeHtml(codeLines.join('\n')) + '</code></pre>');
    }

    return out.join('\n');
  }

  // ---------- Messages ----------
  function renderMessages(messages) {
    el.chatMessages.innerHTML = '';
    if (!messages || messages.length === 0) {
      el.emptyState.style.display = 'block';
      return;
    }
    el.emptyState.style.display = 'none';

    // Find the index of the last assistant message so we can show the
    // regenerate button only on that one.
    let lastAssistantIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') {
        lastAssistantIdx = i;
        break;
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      el.chatMessages.appendChild(createMessageEl(m.role, m.content, i === lastAssistantIdx, i));
    }
    scrollToBottom();
  }

  function createMessageEl(role, content, isLastAssistant, msgIndex) {
    const div = document.createElement('div');
    div.className = `message ${role}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'U' : 'AI';

    div.appendChild(avatar);

    if (role === 'user') {
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      contentDiv.textContent = content;
      div.appendChild(contentDiv);
    } else {
      const body = document.createElement('div');
      body.className = 'message-body';

      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content md';
      contentDiv.innerHTML = renderMarkdown(content);
      body.appendChild(contentDiv);

      const actions = document.createElement('div');
      actions.className = 'message-actions';

      // Copy response button
      const copyBtn = document.createElement('button');
      copyBtn.className = 'message-action-btn';
      copyBtn.innerHTML = icons.copy;
      copyBtn.title = 'Copy response';
      copyBtn.addEventListener('click', () => copyResponse(content, copyBtn));
      actions.appendChild(copyBtn);

      // Speaker / Read aloud button
      const speakBtn = document.createElement('button');
      speakBtn.className = 'message-action-btn';
      speakBtn.innerHTML = (currentPlayingIndex === msgIndex && audioPlayer && !audioPlayer.paused)
        ? icons.speakerStop
        : icons.speaker;
      speakBtn.title = 'Read aloud';
      speakBtn.addEventListener('click', () => toggleSpeakResponse(msgIndex, content, speakBtn));
      actions.appendChild(speakBtn);

      // Download MP3 button
      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'message-action-btn';
      downloadBtn.innerHTML = icons.download;
      downloadBtn.title = 'Download MP3';
      downloadBtn.addEventListener('click', () => downloadResponseAudio(msgIndex, content, downloadBtn));
      actions.appendChild(downloadBtn);

      // Regenerate button (last assistant only)
      if (isLastAssistant) {
        const regenBtn = document.createElement('button');
        regenBtn.className = 'message-action-btn';
        regenBtn.innerHTML = icons.regenerate;
        regenBtn.title = 'Regenerate';
        regenBtn.addEventListener('click', () => regenerateResponse(regenBtn));
        actions.appendChild(regenBtn);
      }

      // Delete response button
      if (msgIndex >= 0) {
        const delBtn = document.createElement('button');
        delBtn.className = 'message-action-btn delete';
        delBtn.innerHTML = icons.trash;
        delBtn.title = 'Delete response';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          showDeletePopover(delBtn, 'Delete this response?', () => deleteResponse(msgIndex, delBtn));
        });
        actions.appendChild(delBtn);
      }

      body.appendChild(actions);
      div.appendChild(body);
    }

    return div;
  }

  function appendMessage(role, content) {
    el.emptyState.style.display = 'none';
    el.chatMessages.appendChild(createMessageEl(role, content, false, -1));
    scrollToBottom();
  }

  function scrollToBottom() {
    el.chatMessages.scrollTop = el.chatMessages.scrollHeight;
  }

  // ---------- Message actions ----------
  async function copyResponse(content, btn) {
    try {
      await navigator.clipboard.writeText(content);
    } catch (err) {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    const original = btn.innerHTML;
    btn.innerHTML = icons.check;
    setTimeout(() => {
      btn.innerHTML = original;
    }, 2000);
  }

  async function getOrFetchAudio(msgIndex, content) {
    const key = getAudioKey(msgIndex, content);
    if (audioCache.has(key)) {
      return audioCache.get(key);
    }
    const data = await api('/api/voice/speak', {
      method: 'POST',
      body: { text: content, speed: voiceSpeed, voice_name: voiceName },
    });
    if (data.audio) {
      audioCache.set(key, data.audio);
      return data.audio;
    }
    throw new Error('No audio returned');
  }

  async function toggleSpeakResponse(msgIndex, content, btn) {
    if (currentPlayingIndex === msgIndex && audioPlayer && !audioPlayer.paused) {
      audioPlayer.pause();
      btn.innerHTML = icons.speaker;
      btn.classList.remove('active-audio');
      btn.title = 'Read aloud';
      currentPlayingIndex = null;
      return;
    }

    const prevActive = document.querySelector('.message-action-btn.active-audio');
    if (prevActive) {
      prevActive.classList.remove('active-audio');
      prevActive.innerHTML = icons.speaker;
      prevActive.title = 'Read aloud';
    }

    btn.disabled = true;
    btn.innerHTML = icons.spinner;

    try {
      const base64 = await getOrFetchAudio(msgIndex, content);
      btn.disabled = false;
      btn.innerHTML = icons.speakerStop;
      btn.classList.add('active-audio');
      btn.title = 'Stop playback';
      currentPlayingIndex = msgIndex;

      playAudio(base64, 'audio/mpeg', () => {
        btn.innerHTML = icons.speaker;
        btn.classList.remove('active-audio');
        btn.title = 'Read aloud';
        if (currentPlayingIndex === msgIndex) {
          currentPlayingIndex = null;
        }
      });
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = icons.speaker;
      btn.classList.remove('active-audio');
      btn.title = 'Read aloud';
      alert(`TTS error: ${err.message}`);
    }
  }

  async function downloadResponseAudio(msgIndex, content, btn) {
    btn.disabled = true;
    const orig = btn.innerHTML;
    btn.innerHTML = icons.spinner;

    try {
      const base64 = await getOrFetchAudio(msgIndex, content);
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `response_${msgIndex + 1}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      btn.innerHTML = icons.check;
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.disabled = false;
      }, 2000);
    } catch (err) {
      btn.innerHTML = orig;
      btn.disabled = false;
      alert(`Download error: ${err.message}`);
    }
  }

  async function regenerateResponse(btn) {
    if (!state.currentConvId || state.sending) return;
    state.sending = true;
    btn.disabled = true;
    btn.innerHTML = icons.spinner;

    try {
      const data = await api('/api/chat/regenerate', {
        method: 'POST',
        body: {
          conversation_id: state.currentConvId,
        },
      });
      const updated = data.conversation || data;
      state.currentConv = updated;
      renderMessages(updated.messages);
      await loadConversations();
      if (data.audio) {
        const lastIdx = updated.messages.length - 1;
        audioCache.set(getAudioKey(lastIdx, updated.messages[lastIdx].content), data.audio);
        playAudio(data.audio, data.audio_mime);
      }
    } catch (err) {
      appendMessage('assistant', `⚠️ Error: ${err.message}`);
    } finally {
      state.sending = false;
      btn.disabled = false;
      btn.innerHTML = icons.regenerate;
    }
  }

  async function deleteResponse(msgIndex, btn) {
    if (!state.currentConvId || msgIndex < 0) return;

    btn.disabled = true;
    const originalMessages = [...state.currentConv.messages];

    try {
      state.currentConv.messages.splice(msgIndex, 1);
      state.currentConv.updated_at = Date.now();
      await api(`/api/conversations/${encodeURIComponent(state.currentConvId)}`, {
        method: 'PUT',
        body: state.currentConv,
      });
      renderMessages(state.currentConv.messages);
      await loadConversations();
    } catch (err) {
      state.currentConv.messages = originalMessages;
      alert(err.message);
      renderMessages(state.currentConv.messages);
    } finally {
      btn.disabled = false;
    }
  }

  // ---------- Chat ----------
  async function sendMessage() {
    const text = el.inputMessage.value.trim();
    if (!text || state.sending) return;
    if (!state.currentConvId) {
      alert('Please create or select a conversation first.');
      return;
    }

    state.sending = true;
    el.btnSend.disabled = true;
    el.inputMessage.value = '';

    // Optimistically show user message
    appendMessage('user', text);

    try {
      const data = await api('/api/chat', {
        method: 'POST',
        body: {
          conversation_id: state.currentConvId,
          user_message: text,
        },
      });
      const updated = data.conversation || data;
      state.currentConv = updated;
      renderMessages(updated.messages);
      await loadConversations();
      if (data.audio) {
        const lastIdx = updated.messages.length - 1;
        audioCache.set(getAudioKey(lastIdx, updated.messages[lastIdx].content), data.audio);
        playAudio(data.audio, data.audio_mime);
      }
    } catch (err) {
      appendMessage('assistant', `⚠️ Error: ${err.message}`);
    } finally {
      state.sending = false;
      el.btnSend.disabled = false;
      el.inputMessage.focus();
    }
  }

  // ---------- Provider add ----------
  async function addProvider() {
    const name = el.provName.value.trim();
    const url = el.provUrl.value.trim();
    const apiKey = el.provType.value === 'ollama-local' ? '' : el.provApiKey.value.trim();
    const type = el.provType.value;
    if (!name || !url) {
      alert('Name and Base URL are required.');
      return;
    }
    try {
      const body = { name, base_url: url, type, api_key: apiKey };
      if (state.editingProviderId) {
        body.id = state.editingProviderId;
      }
      await api('/api/providers', {
        method: 'POST',
        body,
      });
      el.provName.value = '';
      el.provUrl.value = '';
      el.provApiKey.value = '';
      state.editingProviderId = null;
      el.btnAddProvider.textContent = 'Add / Update';
      await loadProviders();
    } catch (err) {
      alert(err.message);
    }
  }

  function updateProviderTypeFields() {
    const isOnline = el.provType.value === 'ollama-online';
    const isLocal = el.provType.value === 'ollama-local';
    if (isOnline && (!el.provUrl.value || el.provUrl.value === 'http://localhost:11434')) {
      el.provUrl.value = 'https://api.ollama.com';
    }
    if (isLocal && el.provUrl.value === 'https://api.ollama.com') {
      el.provUrl.value = 'http://localhost:11434';
    }
    el.provApiKey.disabled = isLocal;
    if (isLocal) el.provApiKey.value = '';
    el.provApiKey.placeholder = isLocal ? 'API key disabled for local Ollama' : 'API Key (optional, for online/cloud)';
  }

  // ---------- Event wiring ----------
  el.btnMenu.addEventListener('click', () => {
    if (el.sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
  el.sidebarOverlay.addEventListener('click', closeSidebar);
  el.btnSettingsToggle.addEventListener('click', () => {
    const collapsed = !el.settingsBar.classList.contains('collapsed');
    applySettingsCollapsed(collapsed);
    try {
      localStorage.setItem(SETTINGS_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch (e) {
      // localStorage might be unavailable in some private browsing modes
    }
  });
  el.btnNewChat.addEventListener('click', () => {
    createConversation();
    closeSidebar();
  });
  el.btnManageProviders.addEventListener('click', () => {
    showSetup();
    closeSidebar();
  });
  el.btnCloseSetup.addEventListener('click', showChat);
  el.convList.addEventListener('click', (e) => {
    if (e.target.closest('.conv-item') && !e.target.closest('.conv-actions')) {
      closeSidebar();
    }
  });
  el.btnClearAll.addEventListener('click', (e) => {
    e.stopPropagation();
    showDeletePopover(el.btnClearAll, 'Delete ALL chats? This cannot be undone.', clearAllConversations);
  });
  el.btnAddProvider.addEventListener('click', addProvider);
  el.provType.addEventListener('change', updateProviderTypeFields);
  updateProviderTypeFields();
  el.btnSend.addEventListener('click', sendMessage);
  el.btnSaveSettings.addEventListener('click', saveSettings);
  el.btnVoice.addEventListener('click', toggleVoice);
  el.selVoiceSpeed.addEventListener('change', changeVoiceSpeed);
  populateVoiceNames();
  el.selVoiceName.addEventListener('change', changeVoiceName);
  el.btnSavePrompt.addEventListener('click', savePrompt);
  el.btnCancelPromptEdit.addEventListener('click', resetPromptForm);
  el.btnSaveDefaultPrompt.addEventListener('click', saveDefaultPrompt);

  el.inputMessage.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && (el.chkReturnToSend.checked || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      sendMessage();
    }
  });

  el.inputMessage.addEventListener('input', () => {
    el.inputMessage.style.height = 'auto';
    el.inputMessage.style.height = Math.min(el.inputMessage.scrollHeight, 150) + 'px';
  });

  el.selProvider.addEventListener('change', async () => {
    await loadModels(el.selProvider.value);
    if (state.currentConv) {
      state.currentConv.settings.provider_id = el.selProvider.value;
      state.currentConv.settings.model = el.selModel.value || '';
      await saveSettings();
    }
  });

  el.selModel.addEventListener('change', async () => {
    if (state.currentConv) {
      state.currentConv.settings.model = el.selModel.value || '';
      await saveSettings();
    }
  });

  el.selSystemPrompt.addEventListener('change', async () => {
    if (!state.currentConv) return;
    const val = el.selSystemPrompt.value;
    if (val === CUSTOM_PROMPT_VALUE) {
      // "(custom)" isn't selectable — restore the real selection.
      syncSystemPromptSelect();
      return;
    }
    const prompt = state.systemPrompts.find((p) => p.id === val);
    state.currentConv.settings.system_prompt = prompt ? prompt.content : '';
    await saveSettings();
  });

  el.selContext.addEventListener('change', async () => {
    if (state.currentConv) {
      state.currentConv.settings.max_turns = parseInt(el.selContext.value, 10) || 12;
      await saveSettings();
    }
  });

  el.selMode.addEventListener('change', saveSettings);
  el.chkReturnToSend.addEventListener('change', async () => {
    try {
      await api('/api/settings', {
        method: 'PUT',
        body: {
          ...state.appSettings,
          default_system_prompt_id: state.defaultPromptId,
          return_to_send: el.chkReturnToSend.checked,
        },
      });
      state.appSettings.return_to_send = el.chkReturnToSend.checked;
    } catch (err) {
      alert(err.message);
    }
  });

  // ---------- Init ----------
  initSettingsCollapse();
  initKeyboardAdjustment();

  async function init() {
    try {
      await loadSystemPrompts();
      await loadAppSettings();
      renderDefaultPromptSelect();
      renderSystemPromptSelect();
      await loadVoiceState();
      await loadProviders();
      await loadConversations();
      if (state.providers.length > 0) {
        await loadModels(state.providers[0].id);
      }
      if (state.conversations.length > 0) {
        await openConversation(state.conversations[0].id);
      }
    } catch (err) {
      console.error('Init failed:', err);
    }
  }

  init();
})();
