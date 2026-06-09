/* ════════════════════════════════════════════════
   JAVABOT — script.js
   ════════════════════════════════════════════════ */

// ── State ──────────────────────────────────────
let chats = JSON.parse(localStorage.getItem('jb_chats') || '[]');
let currentChatId = null;
let attachedImages = [];
let attachedFiles = [];
let recognition = null;
let isRecording = false;
let currentUser = JSON.parse(localStorage.getItem('jb_user') || 'null');

// ── DOM refs ───────────────────────────────────
const authScreen    = document.getElementById('auth-screen');
const authSignin    = document.getElementById('auth-signin');
const authSignup    = document.getElementById('auth-signup');
const appEl         = document.getElementById('app');
const messagesEl    = document.getElementById('messages');
const emptyState    = document.getElementById('empty-state');
const chatInput     = document.getElementById('chat-input');
const chatList      = document.getElementById('chat-list');
const chatTitle     = document.getElementById('chat-title');
const attachPreview = document.getElementById('attachment-preview');
const imageInput    = document.getElementById('image-input');
const fileInput     = document.getElementById('file-input');

const userAccountBtn  = document.getElementById('user-account-btn');
const accountMenu     = document.getElementById('account-menu');
const userAvatarDisp  = document.getElementById('user-avatar-display');
const userNameDisp    = document.getElementById('user-name-display');
const userEmailDisp   = document.getElementById('user-email-display');

const settingsModal   = document.getElementById('settings-modal');
const profileAvatarLg = document.getElementById('profile-avatar-large');
const settingsName    = document.getElementById('settings-name');
const settingsEmail   = document.getElementById('settings-email');
const settingsPassword= document.getElementById('settings-password');
const avatarFileInput = document.getElementById('avatar-file-input');
const saveMsgEl       = document.getElementById('settings-save-msg');

// ════════════════════════════════════════════════
// AUTH
// ════════════════════════════════════════════════

async function showApp() {
  authScreen.classList.add('hidden');
  appEl.classList.remove('hidden');
  updateUserDisplay();

  try {
    chats = await fbLoadChats(currentUser.uid);
  } catch { chats = []; }
  if (chats.length > 0) {
    const lastId = localStorage.getItem('jb_last_chat');
    const restore = lastId && chats.find(c => c.id === lastId);
    loadChat(restore ? lastId : chats[0].id);
  }
  else createNewChat();
  renderChatList();
}

function showAuth() {
  appEl.classList.add('hidden');
  authScreen.classList.remove('hidden');
}

function updateUserDisplay() {
  if (!currentUser) return;
  const initials = (currentUser.name || currentUser.email || '?')[0].toUpperCase();
  userNameDisp.textContent = currentUser.name || 'User';
  userEmailDisp.textContent = currentUser.email || '';

  if (currentUser.avatar) {
    userAvatarDisp.innerHTML = `<img src="${currentUser.avatar}" alt="avatar">`;
    profileAvatarLg.innerHTML = `<img src="${currentUser.avatar}" alt="avatar">`;
  } else {
    userAvatarDisp.textContent = initials;
    profileAvatarLg.textContent = initials;
  }

  settingsName.value  = currentUser.name  || '';
  settingsEmail.value = currentUser.email || '';
}

function saveUser(updates) {
  currentUser = { ...currentUser, ...updates };
  localStorage.setItem('jb_user', JSON.stringify(currentUser));
  updateUserDisplay();
}

function firebaseError(code) {
  const errors = {
    'auth/email-already-in-use': 'This email is already registered. Please sign in.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/weak-password': 'Password must be at least 8 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/network-request-failed': 'Network error. Check your connection.',
  };
  return errors[code] || 'Something went wrong. Please try again.';
}

function initPasswordStrength(inputId, prefix, bars) {
  const input = document.getElementById(inputId);
  const wrap  = document.getElementById(prefix === 'rule' ? 'signup-strength' : 'settings-strength');
  if (!input || !wrap) return;

  input.addEventListener('focus', () => wrap.style.display = 'block');
  input.addEventListener('blur',  () => { if (!input.value) wrap.style.display = 'none'; });

  input.addEventListener('input', () => {
    const v = input.value;
    const rules = {
      [`${prefix}-length`]:  v.length >= 8,
      [`${prefix}-upper`]:   /[A-Z]/.test(v),
      [`${prefix}-lower`]:   /[a-z]/.test(v),
      [`${prefix}-number`]:  /\d/.test(v),
      [`${prefix}-special`]: /[!@#$%^&*(),.?":{}|<>]/.test(v),
    };

    let met = 0;
    Object.entries(rules).forEach(([id, pass]) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('met', pass);
      if (pass) met++;
    });

    const barEls = bars.map(id => document.getElementById(id));
    const level = met <= 2 ? 'weak' : met <= 4 ? 'medium' : 'strong';
    barEls.forEach((bar, i) => {
      bar.className = 'strength-bar';
      if (i < met) bar.classList.add(level);
    });
  });
}

// Sign-in with email 
document.getElementById('btn-email-signin').addEventListener('click', async () => {
  const email    = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value.trim();
  if (!email || !password) return alert('Please fill in all fields.');
  try {
    await fbSignIn(email, password);
  } catch (e) {
    alert(firebaseError(e.code));
  }
});

// Sign-up with email
document.getElementById('btn-email-signup').addEventListener('click', async () => {
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value.trim();
  if (!name || !email || !password) return alert('Please fill in all fields.');
  if (password.length < 8) return alert('Password must be at least 8 characters.');
  if (!/[A-Z]/.test(password)) return alert('Password must contain an uppercase letter.');
  if (!/[a-z]/.test(password)) return alert('Password must contain a lowercase letter.'); 
  if (!/\d/.test(password)) return alert('Password must contain a number.');
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return alert('Password must contain a special character.');
  try {
    await fbSignUp(name, email, password);
  } catch (e) {
    alert(firebaseError(e.code));
  }
});

  ['google-signin-btn', 'google-signup-btn'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = `<button class="btn-oauth btn-google" id="firebase-google-${id}">
      <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
      Continue with Google
    </button>`;
    document.getElementById(`firebase-google-${id}`).addEventListener('click', async () => {
      try {
        await fbGoogleSignIn();
      } catch (e) {
        alert(firebaseError(e.code));
      }
    });
  });


// Switch panels
document.getElementById('go-signup').addEventListener('click', e => {
  e.preventDefault();
  authSignin.classList.remove('active');
  authSignup.classList.add('active');
});
document.getElementById('go-signin').addEventListener('click', e => {
  e.preventDefault();
  authSignup.classList.remove('active');
  authSignin.classList.add('active');
});

// ── User account menu ──────────────────────────
userAccountBtn.addEventListener('click', e => {
  e.stopPropagation();
  accountMenu.classList.toggle('hidden');
  userAccountBtn.classList.toggle('open');
});
document.addEventListener('click', () => {
  accountMenu.classList.add('hidden');
  userAccountBtn.classList.remove('open');
});

document.getElementById('menu-settings').addEventListener('click', () => {
  accountMenu.classList.add('hidden');
  openSettings();
});
document.getElementById('menu-logout').addEventListener('click', async () => {
  await fbSignOut();
  currentUser = null;
  chats = [];
  showAuth();
});

// ════════════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════════════

function openSettings() {
  settingsModal.classList.remove('hidden');
  updateUserDisplay();
}
function closeSettings() {
  settingsModal.classList.add('hidden');
}

document.getElementById('close-settings').addEventListener('click', closeSettings);
settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) closeSettings();
});

// Modal tabs
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// Save profile
document.getElementById('btn-save-profile').addEventListener('click', () => {
  const name     = settingsName.value.trim();
  const email    = settingsEmail.value.trim();
  const password = settingsPassword.value.trim();

  if (!name && !email) return;
  const updates = {};
  if (name)  updates.name  = name;
  if (email) updates.email = email;

  if (password && password.length >= 6) {
    const storedEmail = currentUser.email || email;
    const existing = JSON.parse(localStorage.getItem(`jb_account_${storedEmail}`) || '{}');
    localStorage.setItem(`jb_account_${storedEmail}`, JSON.stringify({ ...existing, password }));
  }

  saveUser(updates);
  saveMsgEl.classList.remove('hidden');
  setTimeout(() => saveMsgEl.classList.add('hidden'), 2500);
  settingsPassword.value = '';
});

// Avatar upload
document.getElementById('btn-change-avatar').addEventListener('click', () => avatarFileInput.click());
avatarFileInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    saveUser({ avatar: reader.result });
  };
  reader.readAsDataURL(file);
});

// ── Appearance: Theme ──────────────────────────
function applyTheme(theme) {
  document.body.classList.toggle('light', theme === 'light');
  document.querySelectorAll('.theme-option').forEach(b => b.classList.toggle('active', b.dataset.theme === theme));
  localStorage.setItem('jb_theme', theme);
}
document.querySelectorAll('.theme-option').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

// ── Appearance: Accent Color ───────────────────
function applyAccent(color) {
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-dim', hexToRgba(color, 0.15));
  document.documentElement.style.setProperty('--accent-hover', lighten(color));
  document.querySelectorAll('.accent-option').forEach(b => b.classList.toggle('active', b.dataset.color === color));
  localStorage.setItem('jb_accent', color);
}
document.querySelectorAll('.accent-option').forEach(btn => {
  btn.addEventListener('click', () => applyAccent(btn.dataset.color));
});

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16);
  const g = parseInt(hex.slice(3,5),16);
  const b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}
function lighten(hex) {
  const r = Math.min(255, parseInt(hex.slice(1,3),16)+20);
  const g = Math.min(255, parseInt(hex.slice(3,5),16)+20);
  const b = Math.min(255, parseInt(hex.slice(5,7),16)+20);
  return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
}

// Restore saved preferences
function restorePrefs() {
  const savedTheme  = localStorage.getItem('jb_theme')  || 'dark';
  const savedAccent = localStorage.getItem('jb_accent') || '#f59e0b';
  applyTheme(savedTheme);
  applyAccent(savedAccent);
}

// ════════════════════════════════════════════════
// CHAT MANAGEMENT
// ════════════════════════════════════════════════

function saveChats() {
  const chat = getCurrentChat();
  if (chat && currentUser?.uid) fbSaveChat(currentUser.uid, chat);
}

function createNewChat() {
  const id = Date.now().toString();
  const chat = {
    id,
    title: 'New Conversation',
    messages: [],
    createdAt: new Date().toISOString()
  };
  chats.unshift(chat);
  saveChats();
  loadChat(id);
  renderChatList();
}

function loadChat(id) {
  currentChatId = id;
  localStorage.setItem('jb_last_chat', id);
  const chat = chats.find(c => c.id === id);
  if (!chat) return;
  chatTitle.textContent = chat.title;
  messagesEl.innerHTML = '';

  if (chat.messages.length === 0) {
    messagesEl.appendChild(createEmptyState());
  } else {
    chat.messages.forEach(msg => appendMessage(msg.role, msg.content, false));
  }

  renderChatList();
  clearAttachments();
}

function getCurrentChat() {
  return chats.find(c => c.id === currentChatId);
}

function updateChatTitle(text) {
  const chat = getCurrentChat();
  if (!chat || chat.title !== 'New Conversation') return;
  chat.title = text.substring(0, 40) + (text.length > 40 ? '…' : '');
  chatTitle.textContent = chat.title;
  saveChats();
  renderChatList();
}

function renderChatList() {
  chatList.innerHTML = '';
  chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (chat.id === currentChatId ? ' active' : '');
    item.innerHTML = `
          <div class="chat-item-info">
            <div class="chat-item-title">${escapeHtml(chat.title)}</div>
          </div>
          <button class="chat-item-menu-btn" title="Options">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>
            </svg>
          </button>
          <div class="chat-item-menu hidden">
            <button class="chat-menu-opt" data-action="rename">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Rename
            </button>
            <button class="chat-menu-opt danger" data-action="delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
              Delete
            </button>
          </div>`;
    item.addEventListener('click', e => {
      const menuBtn = e.target.closest('.chat-item-menu-btn');
      const opt = e.target.closest('.chat-menu-opt');

      if (menuBtn) {
        e.stopPropagation();
        document.querySelectorAll('.chat-item-menu').forEach(m => m.classList.add('hidden'));
        item.querySelector('.chat-item-menu').classList.toggle('hidden');
        return;
      }
      if (opt) {
        e.stopPropagation();
        item.querySelector('.chat-item-menu').classList.add('hidden');
        if (opt.dataset.action === 'delete') {
          deleteChat(chat.id);
        } else if (opt.dataset.action === 'rename') {
          const newTitle = prompt('Rename chat:', chat.title);
          if (newTitle && newTitle.trim()) {
            chat.title = newTitle.trim();
            chatTitle.textContent = chat.title;
            saveChats();
            renderChatList();
          }
        }
        return;
      }
      loadChat(chat.id);
    });
    chatList.appendChild(item);
    });
};


function deleteChat(id) {
  if (currentUser?.uid) fbDeleteChat(currentUser.uid, id);
  chats = chats.filter(c => c.id !== id);
  if (currentChatId === id) {
    if (chats.length > 0) loadChat(chats[0].id);
    else createNewChat();
  } else renderChatList();
}

// ════════════════════════════════════════════════
// MESSAGES
// ════════════════════════════════════════════════

function createEmptyState() {
  const div = document.createElement('div');
  div.className = 'empty-state';
  div.id = 'empty-state';
  div.innerHTML = `
    <div class="empty-icon">☕</div>
    <h2>Ask me anything about Java</h2>
    <p>I can help with syntax, OOP, Spring, data structures, algorithms, and more.</p>
    <div class="suggestions">
      <button class="suggestion-chip" data-text="What is an inner class in Java?">Inner classes</button>
      <button class="suggestion-chip" data-text="Explain Java OOP concepts with examples">OOP concepts</button>
      <button class="suggestion-chip" data-text="How does Java garbage collection work?">Garbage collection</button>
      <button class="suggestion-chip" data-text="Write a Java LinkedList implementation">LinkedList example</button>
    </div>`;
  div.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.text;
      sendMessage();
    });
  });
  return div;
}

function appendMessage(role, content, save = true, images = []) {
  const empty = document.getElementById('empty-state');
  if (empty) empty.remove();

  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;

  const label = document.createElement('div');
  label.className = 'msg-label';
  label.style.display = 'none';

  const bubble = document.createElement('div');
  bubble.className = 'msg-bubble' + (content && content.startsWith('⚠️') ? ' warning' : '');
  if (content) bubble.innerHTML = formatMessage(content);

  // Show attached images inside the bubble
images.forEach(img => {
    if (img.type === 'file') return;
    const imgEl = document.createElement('img');
    imgEl.src = img.dataUrl;
    imgEl.style.cssText = 'max-width:100%;max-height:220px;border-radius:8px;margin-top:8px;display:block;';
    bubble.appendChild(imgEl);
  });

  wrapper.appendChild(label);
  if (images && images.length > 0) {
  images.forEach(img => {
    if (img.type === 'file') {
      const fileTag = document.createElement('div');
      fileTag.className = 'msg-file-tag';
      fileTag.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>${img.name}</span>`;
      bubble.appendChild(fileTag);
    }
  });
}
  wrapper.appendChild(bubble);
  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  if (role === 'user') {
    const editBtn = document.createElement('button');
    editBtn.className = 'msg-action-btn';
    editBtn.title = 'Edit';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', () => {
      const bubble = wrapper.querySelector('.msg-bubble');
      const originalText = content || '';

      // Replace bubble with editable area
      bubble.innerHTML = `
        <textarea class="edit-textarea">${originalText}</textarea>
        <div class="edit-actions">
          <button class="edit-cancel">Cancel</button>
          <button class="edit-save">Save & Send</button>
        </div>`;

      const textarea = bubble.querySelector('.edit-textarea');
      textarea.focus();
      textarea.style.height = textarea.scrollHeight + 'px';

      bubble.querySelector('.edit-cancel').addEventListener('click', () => {
        bubble.innerHTML = formatMessage(originalText);
      });

      bubble.querySelector('.edit-save').addEventListener('click', async () => {
      const newText = textarea.value.trim();
      if (!newText) return;

      bubble.innerHTML = formatMessage(newText);

      const chat = getCurrentChat();
      if (!chat) return;
      const msgIndex = chat.messages.findIndex(m => m.role === 'user' && m.content === originalText);
      if (msgIndex !== -1) {
        chat.messages.splice(msgIndex); 
        chat.messages.push({ role: 'user', content: newText }); 
        saveChats();
      }

      let el = wrapper.nextSibling;
      while (el) {
        const next = el.nextSibling;
        el.remove();
        el = next;
      }

      showTyping();
      try {
        const reply = await callGroq(newText, [], []);
        removeTyping();
        appendMessage('bot', reply);
      } catch (err) {
        removeTyping();
        appendMessage('bot', `❌ Error: ${err.message}`);
      }
    });
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content || '');
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`, 1500);
    });

    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'msg-action-btn';
    reloadBtn.title = 'Reload';
    reloadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
    reloadBtn.addEventListener('click', async () => {
      const chat = getCurrentChat();
      if (!chat) return;
      const lastUser = [...chat.messages].reverse().find(m => m.role === 'user');
      if (!lastUser) return;

      const lastBotIndex = chat.messages.map(m => m.role).lastIndexOf('bot');
      if (lastBotIndex !== -1) chat.messages.splice(lastBotIndex, 1);
      saveChats();

      const bubbles = messagesEl.querySelectorAll('.message.bot');
      if (bubbles.length) bubbles[bubbles.length - 1].remove();

      showTyping();
      try {
        const reply = await callGroq(lastUser.content, [], []);
        removeTyping();
        appendMessage('bot', reply);
      } catch (err) {
        removeTyping();
        appendMessage('bot', `❌ Error: ${err.message}`);
      }
    });

    actions.appendChild(editBtn);
    actions.appendChild(copyBtn);
    actions.appendChild(reloadBtn);
  } else {
    const reloadBtn = document.createElement('button');
    reloadBtn.className = 'msg-action-btn';
    reloadBtn.title = 'Reload';
    reloadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>`;
    reloadBtn.addEventListener('click', async () => {
      const chat = getCurrentChat();
      if (!chat) return;
      const lastUser = [...chat.messages].reverse().find(m => m.role === 'user');
      if (!lastUser) return;


      const lastBotIndex = chat.messages.map(m => m.role).lastIndexOf('bot');
      if (lastBotIndex !== -1) chat.messages.splice(lastBotIndex, 1);
      saveChats();

      const bubbles = messagesEl.querySelectorAll('.message.bot');
      if (bubbles.length) bubbles[bubbles.length - 1].remove();

      showTyping();
      try {
        const reply = await callGroq(lastUser.content, [], []);
        removeTyping();
        appendMessage('bot', reply);
      } catch (err) {
        removeTyping();
        appendMessage('bot', `❌ Error: ${err.message}`);
      }
    });

    const copyBtn = document.createElement('button');
    copyBtn.className = 'msg-action-btn';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content || '');
      copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`;
      setTimeout(() => copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`, 1500);
    });

    actions.appendChild(reloadBtn);
    actions.appendChild(copyBtn);
  }

 const timestamp = document.createElement('div');
  timestamp.className = 'msg-timestamp';
  timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  wrapper.appendChild(actions);
  wrapper.appendChild(timestamp);
  messagesEl.appendChild(wrapper);
  messagesEl.scrollTo({ top: messagesEl.scrollHeight, behavior: 'smooth' });

  if (save) {
    const chat = getCurrentChat();
    if (chat) {
      chat.messages.push({ role, content: content || '' });
      saveChats();
    }
  }
}

function copyMessage(btn, text) {
  navigator.clipboard.writeText(text);
  btn.textContent = '✅';
  setTimeout(() => btn.textContent = '📋', 1500);
}
function editMessage(btn) {
  const bubble = btn.closest('.message').querySelector('.msg-bubble');
  const text = bubble.innerText;
  chatInput.value = text;
  chatInput.focus();
  autoResize();
}
function reloadMessage(btn) {
  const messages = getCurrentChat()?.messages || [];
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  if (lastUser) {
    chatInput.value = lastUser.content;
    sendMessage();
  }
}

function formatMessage(text) {
  let html = escapeHtml(text);
  html = html.replace(/```(?:\w+)?\n?([\s\S]*?)```/g, (_, code) =>
    `<div class="code-block-wrap"><button class="code-copy-btn" onclick="copyCode(this)">Copy</button><pre><code>${code.trim()}</code></pre></div>`);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}
function copyCode(btn) {
  const code = btn.nextElementSibling.querySelector('code').innerText;
  navigator.clipboard.writeText(code);
  btn.textContent = 'Copied!';
  setTimeout(() => btn.textContent = 'Copy', 1500);
}
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'message bot';
  div.id = 'typing-indicator';
  div.innerHTML = `<div class="msg-label">JavaBot</div>
    <div class="typing-dots"><span></span><span></span><span></span></div>`;
  messagesEl.appendChild(div);
  
}
function removeTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

// ════════════════════════════════════════════════
// ATTACHMENTS
// ════════════════════════════════════════════════

imageInput.addEventListener('change', e => handleImages(e.target.files));
fileInput.addEventListener('change',  e => handleFiles(e.target.files));

function handleImages(files) {
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = () => {
      attachedImages.push({ name: file.name, dataUrl: reader.result, type: file.type });
      renderAttachmentPreview();
    };
    reader.readAsDataURL(file);
  });
  imageInput.value = '';
}

async function handleFiles(files) {
  for (const file of Array.from(files)) {
    const ext = file.name.split('.').pop().toLowerCase();
    let content = '';

    if (['jpg','jpeg','png','gif','webp','bmp'].includes(ext)) {
      await new Promise(res => {
        const r = new FileReader();
        r.onload = () => { attachedImages.push({ name: file.name, dataUrl: r.result, type: file.type }); res(); };
        r.readAsDataURL(file);
      });
      continue;
    }

    if (ext === 'docx' || ext === 'doc') {
      try {
        const ab = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: ab });
        content = result.value;
      } catch { content = `[Could not read ${file.name}]`; }
    } else if (ext === 'pdf') {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const ab = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
        const parts = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          parts.push(textContent.items.map(it => it.str).join(' '));
        }
        content = parts.join('\n');
      } catch { content = `[Could not read PDF: ${file.name}]`; }
    } else {
      try { content = await file.text(); }
      catch { content = `[Binary file: ${file.name}]`; }
    }

    attachedFiles.push({ name: file.name, content, type: 'file' });
    renderAttachmentPreview();
  }
  fileInput.value = '';
}

function renderAttachmentPreview() {
  attachPreview.innerHTML = '';
  attachedImages.forEach((img, i) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    chip.innerHTML = `<img class="att-chip-img" src="${img.dataUrl}" alt="${img.name}">
      <span>${img.name}</span>
      <button class="att-chip-remove" data-type="img" data-i="${i}">✕</button>`;
    attachPreview.appendChild(chip);
  });
  attachedFiles.forEach((f, i) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    chip.innerHTML = `<span>📎 ${escapeHtml(f.name)}</span>
      <button class="att-chip-remove" data-type="file" data-i="${i}">✕</button>`;
    attachPreview.appendChild(chip);
  });
  attachPreview.querySelectorAll('.att-chip-remove').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.type === 'img') attachedImages.splice(+btn.dataset.i, 1);
      else attachedFiles.splice(+btn.dataset.i, 1);
      renderAttachmentPreview();
    });
  });
}

function clearAttachments() {
  attachedImages = [];
  attachedFiles = [];
  renderAttachmentPreview();
}

// ════════════════════════════════════════════════
// SEND MESSAGE
// ════════════════════════════════════════════════

async function sendMessage() {
  const text = chatInput.value.trim();
  const hasImages = attachedImages.length > 0;
  const hasFiles  = attachedFiles.length > 0;
  if (!text && !hasImages && !hasFiles) return;

  const imgs = [...attachedImages, ...attachedFiles.map(f => ({ name: f.name, type: 'file', dataUrl: null }))];
  const files = [...attachedFiles];

  const userContent = buildUserContent(text);
  chatInput.value = '';
  chatInput.style.height = 'auto';


  const idx = chats.findIndex(c => c.id === currentChatId);
  if (idx > 0) {
    const [chat] = chats.splice(idx, 1);
    chats.unshift(chat);
  }
  appendMessage('user', text || '', true, imgs);
  localStorage.setItem('jb_last_chat', currentChatId);
  renderChatList();
  const activeItem = chatList.querySelector('.chat-item.active');
  if (activeItem) activeItem.scrollIntoView({ block: 'nearest' });
  if (text) updateChatTitle(text);

  clearAttachments();
  showTyping();

  try {
    const reply = await callGroq(userContent, imgs, files);
    removeTyping();
    appendMessage('bot', reply);
  } catch (err) {
    removeTyping();
    appendMessage('bot', `❌ Error: ${err.message}`);
  }
}

function buildUserContent(text) {
  let content = text;
  if (attachedFiles.length > 0) {
    content += '\n\n' + attachedFiles.map(f =>
      `--- File: ${f.name} ---\n${f.content.substring(0, 8000)}`
    ).join('\n\n');
  }
  return content;
}

async function callGroq(userText, images, files) {
  const chat = getCurrentChat();
  const history = (chat?.messages || []).slice(-10);

  const hasImages = images.length > 0;
  const model = hasImages
    ? 'meta-llama/llama-4-scout-17b-16e-instruct'
    : 'llama-3.3-70b-versatile';

  const SYSTEM = `You are JavaBot — an expert Java programming assistant. You ONLY answer questions related to the Java programming language and its ecosystem (JVM, Spring, Hibernate, Maven, Gradle, Android, data structures, OOP, design patterns, concurrency, etc.).

If the user's question is NOT related to Java, respond ONLY with:
"⚠️ I only answer Java-related questions. Please ask something about Java!"

Do NOT answer non-Java questions under any circumstances.
When images or files are attached, they are assumed to be Java-related content.
Format code examples using \`\`\`java code blocks.`;

  const messages = [];

  // History
  for (const m of history) {
    if (m.role === 'user') {
      messages.push({ role: 'user', content: m.content });
    } else {
      messages.push({ role: 'assistant', content: m.content });
    }
  }

  if (hasImages) {
    const contentParts = [];
    if (userText) contentParts.push({ type: 'text', text: userText });
    images.forEach(img => {
      if (img.type === 'file') return;
      const base64 = img.dataUrl.split(',')[1];
      contentParts.push({
        type: 'image_url',
        image_url: { url: `data:${img.type};base64,${base64}` }
      });
    });
    if (files.length > 0) {
      const fileText = files.map(f => `--- ${f.name} ---\n${f.content.substring(0,8000)}`).join('\n\n');
      contentParts.push({ type: 'text', text: fileText });
    }
    messages.push({ role: 'user', content: contentParts });
  } else {
    let text = userText || '';
    if (files.length > 0) {
      text += '\n\n' + files.map(f => `--- ${f.name} ---\n${f.content.substring(0,8000)}`).join('\n\n');
    }
    messages.push({ role: 'user', content: text });
  }

  const resp = await fetch('https://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, system: SYSTEM, model })
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: { message: `HTTP ${resp.status}` } }));
    throw new Error(err.error?.message || `Server error: HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data.reply || '(no response)';
}

// ════════════════════════════════════════════════
// SPEECH TO TEXT
// ════════════════════════════════════════════════

function setupSpeech() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById('btn-mic').title = 'Speech not supported in this browser';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  let finalTranscript = '';

  recognition.onstart = () => {
    isRecording = true;
    document.getElementById('btn-mic').classList.add('recording');
    finalTranscript = chatInput.value;
  };

  recognition.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) finalTranscript += e.results[i][0].transcript + ' ';
      else interim += e.results[i][0].transcript;
    }
    chatInput.value = finalTranscript + interim;
    autoResize();
  };

  recognition.onend = () => {
    isRecording = false;
    document.getElementById('btn-mic').classList.remove('recording');
  };

  recognition.onerror = e => {
    isRecording = false;
    document.getElementById('btn-mic').classList.remove('recording');
    const msgs = {
      'not-allowed': '🎤 Microphone blocked! Click the 🔒 icon in address bar → Allow microphone.',
      'no-speech': '🎤 No speech detected. Try again.',
      'network': '🎤 Network error. Make sure you\'re on https://localhost:3000.',
      'audio-capture': '🎤 No microphone found. Check your device.',
    };
    alert(msgs[e.error] || `🎤 Speech error: ${e.error}`);
  };
}

async function toggleSpeech() {
  if (!recognition) { alert('Speech recognition not supported in this browser. Use Chrome or Edge.'); return; }
  if (isRecording) {
    recognition.stop();
  } else {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      recognition.start();
    } catch {
      alert('🎤 Microphone permission denied. Check browser settings.');
    }
  }
}

// ════════════════════════════════════════════════
// INPUT AUTO-RESIZE
// ════════════════════════════════════════════════

function autoResize() {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 160) + 'px';
}

// ════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  restorePrefs();
  setupSpeech();
  initPasswordStrength('signup-password',   'rule',  ['sb1','sb2','sb3','sb4']);
  initPasswordStrength('settings-password', 'srule', ['ssb1','ssb2','ssb3','ssb4']);

  fbOnAuthChanged(async (user) => {
    if (user) {
      currentUser = {
        uid: user.uid,
        name: user.displayName || '',
        email: user.email || '',
        avatar: user.photoURL || null
      };
      await showApp();
    } else {
      showAuth();
    }
  });

  document.getElementById('btn-send').addEventListener('click', sendMessage);

  chatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  chatInput.addEventListener('input', autoResize);

  // Attach buttons
  document.getElementById('btn-attach-image').addEventListener('click', () => imageInput.click());
  document.getElementById('btn-attach-file').addEventListener('click',  () => fileInput.click());

  // Mic
  document.getElementById('btn-mic').addEventListener('click', toggleSpeech);

  // New chat
  document.getElementById('btn-new-chat').addEventListener('click', createNewChat);

  document.querySelectorAll('.suggestion-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      chatInput.value = btn.dataset.text;
      sendMessage();
    });
  });
  document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('collapsed');
});
  document.addEventListener('click', () => {
    document.querySelectorAll('.chat-item-menu').forEach(m => m.classList.add('hidden'));
  });
});