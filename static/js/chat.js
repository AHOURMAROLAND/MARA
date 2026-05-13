/**
 * MARA Chat Module
 * Handles WebSockets, polling, reactions, and UI updates for group chats.
 */

class MaraChat {
    constructor(config) {
        this.groupLinkId = config.groupLinkId;
        this.myToken = config.myToken;
        this.lastMessageDate = config.lastMessageDate;
        this.csrfToken = config.csrfToken;
        
        this.socket = null;
        this.typingTimeout = null;
        this.activeReactionMessageId = null;
        this.activeTypers = new Map();
        this.lastTypingSent = 0;

        this.elements = {
            chatMessages: document.getElementById('chat-messages'),
            chatForm: document.getElementById('chat-form'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            replyPreview: document.getElementById('reply-preview'),
            replyId: document.getElementById('reply-id'),
            replyName: document.getElementById('reply-to-name'),
            replyText: document.getElementById('reply-to-text'),
            typingIndicator: document.getElementById('typing-indicator'),
            typingText: document.getElementById('typing-text'),
            imageInput: document.getElementById('image-input'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
            imagePreview: document.getElementById('image-preview'),
            activeCount: document.getElementById('active-count'),
            currentNickname: document.getElementById('current-nickname'),
            reactionPicker: document.getElementById('reaction-picker'),
            contextMenu: document.getElementById('message-context-menu'),
            menuDeleteOption: document.getElementById('menu-delete-option'),
            confirmModal: document.getElementById('custom-confirm-modal'),
            confirmDeleteBtn: document.getElementById('confirm-delete-btn'),
            themeToggle: document.getElementById('theme-toggle')
        };

        this.activeMessageData = null;
        this.reconnectAttempts = 0;
        this.init();
    }

    init() {
        this.setupTheme();
        this.connectWebSocket();
        this.setupEventListeners();
        this.setVH();
        this.startIntervals();
        this.scrollToBottom();
    }

    connectWebSocket() {
        if (this.reconnectAttempts > 10) {
            console.error('[MARA] Too many WebSocket reconnect attempts. Stopping.');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat/${this.groupLinkId}/`;
        
        console.log('[MARA] Attempting WebSocket connection:', wsUrl);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('[MARA] WebSocket connected successfully!');
            this.reconnectAttempts = 0;
        };

        this.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            console.log('[MARA] WS Received:', data.type, data);
            
            if (data.type === 'chat_message') {
                const m = data.message;
                const now = new Date();
                m.created_at = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
                m.is_me = (m.sender_session_token === this.myToken);
                this.appendMessage(m);
                this.scrollToBottom();
            } 
            else if (data.type === 'user_typing') {
                if (data.session_token !== this.myToken) {
                    this.updateTypingIndicator(data.session_token, data.nickname);
                }
            }
            else if (data.type === 'message_reaction') {
                this.updateReactionUI(data.reaction);
            }
            else if (data.type === 'message_deleted') {
                console.log('[MARA] Message deleted event received:', data.message_id);
                const el = document.getElementById(`msg-${data.message_id}`);
                if (el) {
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0.8)';
                    setTimeout(() => el.remove(), 300);
                }
            }
        };

        this.socket.onclose = (e) => {
            console.log('[MARA] WebSocket closed. Reason:', e.code, e.reason);
            this.reconnectAttempts++;
            setTimeout(() => this.connectWebSocket(), 2000 * Math.min(this.reconnectAttempts, 5));
        };

        this.socket.onerror = (err) => {
            console.error('[MARA] WebSocket error:', err);
        };
    }

    setupEventListeners() {
        if (this.elements.themeToggle) {
            this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        if (this.elements.messageInput) {
            this.elements.messageInput.addEventListener('input', () => {
                this.elements.messageInput.style.height = 'auto';
                this.elements.messageInput.style.height = (this.elements.messageInput.scrollHeight) + 'px';
                this.notifyTyping();
            });

            this.elements.messageInput.addEventListener('focus', () => {
                setTimeout(() => this.scrollToBottom(), 300);
            });
        }

        if (this.elements.chatForm) {
            this.elements.chatForm.addEventListener('submit', (e) => this.handleSendMessage(e));
        }

        window.addEventListener('resize', () => this.setVH());
        window.addEventListener('orientationchange', () => this.setVH());

        document.addEventListener('click', (e) => {
            if (!e.target.closest('.message-options-btn') && !e.target.closest('.options-dropdown')) {
                document.querySelectorAll('.options-dropdown').forEach(d => d.classList.remove('active'));
            }
        });

        // Global context menu blocker for message bubbles
        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('.message-bubble')) {
                e.preventDefault();
                return false;
            }
        }, false);
    }

    startIntervals() {
        // Poll for new messages/status
        setInterval(() => {
            if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
                this.pollMessages();
            } else {
                if (Math.random() > 0.8) this.pollMessages(); 
            }
        }, 3000);

        // Check delete permissions
        setInterval(() => {
            const now = new Date();
            document.querySelectorAll('.delete-trigger').forEach(btn => {
                const created = new Date(btn.dataset.created);
                if (now - created > 5 * 60 * 1000) {
                    btn.remove();
                }
            });
        }, 10000);
    }

    // --- Theme ---

    setupTheme() {
        const savedTheme = localStorage.getItem('mara-theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('mara-theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        if (!this.elements.themeToggle) return;
        const icon = this.elements.themeToggle.querySelector('svg');
        if (theme === 'dark') {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />';
        } else {
            icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />';
        }
    }

    // --- Actions ---

    async handleSendMessage(e) {
        e.preventDefault();
        const text = this.elements.messageInput.value.trim();
        const imageFile = this.elements.imageInput.files[0];
        const parentId = this.elements.replyId.value;
        
        if (!text && !imageFile) return;

        this.elements.messageInput.value = '';
        this.elements.messageInput.style.height = 'auto';
        this.elements.sendBtn.disabled = true;
        this.cancelReply();
        this.cancelImage();

        const formData = new FormData();
        if (text) formData.append('text', text);
        if (imageFile) formData.append('image', imageFile);
        if (parentId) formData.append('parent_id', parentId);
        formData.append('csrfmiddlewaretoken', this.csrfToken);

        try {
            const response = await fetch(`/groups/api/g/${this.groupLinkId}/send/`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.success) {
                this.pollMessages();
            } else if (data.error) {
                showToast(data.error, "error");
                if (data.error.includes('banni')) window.location.reload();
            }
        } catch (err) {
            console.error(err);
            showToast("Erreur lors de l'envoi", "error");
        } finally {
            this.elements.sendBtn.disabled = false;
        }
    }

    async pollMessages() {
        try {
            const gmtOffset = -new Date().getTimezoneOffset();
            const response = await fetch(`/groups/api/g/${this.groupLinkId}/messages/?last_id=${encodeURIComponent(this.lastMessageDate)}&gmt=${gmtOffset}`);
            const data = await response.json();
            
            if (data.success) {
                if (this.elements.activeCount) this.elements.activeCount.innerText = data.active_count;
                if (data.nickname && this.elements.currentNickname) {
                    this.elements.currentNickname.innerText = data.nickname;
                }

                if (data.messages && data.messages.length > 0) {
                    data.messages.forEach(m => this.appendMessage(m));
                    this.lastMessageDate = data.last_id;
                    this.scrollToBottom();
                }
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    }

    // --- UI Methods ---

    scrollToBottom() {
        if (this.elements.chatMessages) {
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
        }
    }

    setVH() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
        this.scrollToBottom();
    }

    setReply(id, name, text) {
        this.elements.replyId.value = id;
        this.elements.replyName.innerText = name;
        this.elements.replyText.innerText = text;
        this.elements.replyPreview.classList.remove('hidden');
        this.elements.messageInput.focus();
    }

    cancelReply() {
        this.elements.replyId.value = '';
        this.elements.replyPreview.classList.add('hidden');
    }

    handleImageSelect(input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.elements.imagePreview.src = e.target.result;
                this.elements.imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(input.files[0]);
        }
    }

    cancelImage() {
        this.elements.imageInput.value = '';
        this.elements.imagePreviewContainer.classList.add('hidden');
        this.elements.imagePreview.src = '';
    }

    // --- Typing ---

    notifyTyping() {
        const now = Date.now();
        if (now - this.lastTypingSent > 2000) {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(JSON.stringify({
                    'type': 'typing',
                    'session_token': this.myToken
                }));
                this.lastTypingSent = now;
            }
        }
    }

    updateTypingIndicator(token, nickname) {
        this.activeTypers.set(token, {
            nickname: nickname,
            timestamp: Date.now()
        });
        this.renderTypingText();

        setTimeout(() => {
            const typer = this.activeTypers.get(token);
            if (typer && Date.now() - typer.timestamp >= 4000) {
                this.activeTypers.delete(token);
                this.renderTypingText();
            }
        }, 4000);
    }

    renderTypingText() {
        const count = this.activeTypers.size;
        if (count === 0) {
            this.elements.typingIndicator.classList.add('hidden');
        } else {
            this.elements.typingIndicator.classList.remove('hidden');
            if (count === 1) {
                const name = Array.from(this.activeTypers.values())[0].nickname;
                this.elements.typingText.innerText = `${name} est en train d'écrire...`;
            } else {
                this.elements.typingText.innerText = `${count} personnes sont en train d'écrire...`;
            }
        }
    }

    // --- Context Menu ---

    showContextMenu(messageId, nickname, text, isMe, event) {
        // Stop any event bubbling that might trigger native context menu
        if (event) {
            if (typeof event.preventDefault === 'function') event.preventDefault();
            if (typeof event.stopPropagation === 'function') event.stopPropagation();
            if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
        }
        
        console.log('[MARA] Opening context menu for:', messageId);
        this.activeMessageData = { id: messageId, nickname: nickname, text: text, isMe: isMe };
        
        if (isMe) {
            this.elements.menuDeleteOption.classList.remove('hidden');
        } else {
            this.elements.menuDeleteOption.classList.add('hidden');
        }
        
        this.elements.contextMenu.classList.remove('hidden');
        // Vibrate if possible
        if (window.navigator.vibrate) window.navigator.vibrate(40);
    }

    hideContextMenu() {
        this.elements.contextMenu.classList.add('hidden');
    }

    handleMenuAction(action) {
        if (!this.activeMessageData) return;
        
        const { id, nickname, text } = this.activeMessageData;
        this.hideContextMenu();

        switch(action) {
            case 'reply':
                this.setReply(id, nickname, text);
                break;
            case 'react':
                this.showReactionPicker(id);
                break;
            case 'copy':
                if (text && text !== "📸 Image") {
                    navigator.clipboard.writeText(text).then(() => {
                        // Optional: show toast
                    });
                }
                break;
            case 'delete':
                this.deleteMessage(id);
                break;
        }
    }

    // --- Reactions ---

    showReactionPicker(messageId) {
        this.activeReactionMessageId = messageId;
        this.elements.reactionPicker.classList.remove('hidden');
        const options = document.getElementById(`options-${messageId}`);
        if (options) options.classList.remove('active');
    }

    hideReactionPicker() {
        this.elements.reactionPicker.classList.add('hidden');
        this.activeReactionMessageId = null;
    }

    sendReactionFromPicker(emoji) {
        if (this.activeReactionMessageId) {
            this.sendReaction(this.activeReactionMessageId, emoji);
            this.hideReactionPicker();
        }
    }

    async sendReaction(messageId, emoji) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            console.log('[MARA] Sending reaction via WS:', emoji, 'for msg:', messageId);
            this.socket.send(JSON.stringify({
                'type': 'reaction',
                'message_id': messageId,
                'emoji': emoji,
                'session_token': this.myToken
            }));
        } else {
            console.log('[MARA] WS down, sending reaction via HTTP:', emoji, 'for msg:', messageId);
            try {
                const response = await fetch(`/groups/api/g/${this.groupLinkId}/react/${messageId}/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': this.csrfToken
                    },
                    body: JSON.stringify({ emoji: emoji })
                });
                const data = await response.json();
                if (data.success) {
                    this.updateReactionUI(data.reaction);
                } else {
                    showToast(data.error || "Erreur lors de la réaction", "error");
                }
            } catch (err) {
                console.error(err);
                showToast("Erreur réseau", "error");
            }
        }
    }

    updateReactionUI(reaction) {
        console.log('[MARA] Updating UI for reaction:', reaction);
        // Find container by id
        const containerId = `reactions-${reaction.message_id}`;
        let container = document.getElementById(containerId);
        
        if (!container) {
            console.warn(`[MARA] Container not found for ID: ${containerId}. Searching by data attribute...`);
            // Fallback: search for a container that might have been dynamically added
            container = document.querySelector(`[id="reactions-${reaction.message_id}"]`);
        }

        if (!container) {
            console.error('[MARA] Could not find reaction container for message:', reaction.message_id);
            return;
        }

        let reactionEl = null;
        Array.from(container.children).forEach(child => {
            const emojiSpan = child.querySelector('span:first-child');
            if (emojiSpan && emojiSpan.innerText === reaction.emoji) {
                reactionEl = child;
            }
        });

        if (reaction.count > 0) {
            if (!reactionEl) {
                reactionEl = document.createElement('div');
                reactionEl.className = "reaction-badge animate-bounce-in";
                reactionEl.onclick = (e) => {
                    e.stopPropagation();
                    this.sendReaction(reaction.message_id, reaction.emoji);
                };
                reactionEl.innerHTML = `<span>${reaction.emoji}</span><span class="font-bold ml-1">${reaction.count}</span>`;
                container.appendChild(reactionEl);
            } else {
                reactionEl.querySelector('span:last-child').innerText = reaction.count;
                reactionEl.classList.add('animate-bounce-in');
                setTimeout(() => reactionEl.classList.remove('animate-bounce-in'), 300);
            }
        } else if (reactionEl) {
            reactionEl.remove();
        }
    }

    // --- Message Management ---

    toggleOptionsMenu(messageId) {
        console.log('[MARA] Toggling options for:', messageId);
        document.querySelectorAll('.options-dropdown').forEach(d => {
            if (d.id !== `options-${messageId}`) d.classList.remove('active');
        });
        const menu = document.getElementById(`options-${messageId}`);
        if (menu) menu.classList.toggle('active');
    }

    async deleteMessage(messageId) {
        this.elements.confirmModal.classList.remove('hidden');
        
        const newBtn = this.elements.confirmDeleteBtn.cloneNode(true);
        this.elements.confirmDeleteBtn.parentNode.replaceChild(newBtn, this.elements.confirmDeleteBtn);
        this.elements.confirmDeleteBtn = newBtn;

        this.elements.confirmDeleteBtn.onclick = async () => {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                console.log('[MARA] Sending delete request via WS:', messageId);
                this.socket.send(JSON.stringify({
                    'type': 'delete_message',
                    'message_id': messageId,
                    'session_token': this.myToken
                }));
                this.hideConfirmModal();
            } else {
                console.log('[MARA] WS down, sending delete request via HTTP:', messageId);
                try {
                    const response = await fetch(`/groups/api/g/${this.groupLinkId}/delete/${messageId}/`, {
                        method: 'POST',
                        headers: {
                            'X-CSRFToken': this.csrfToken
                        }
                    });
                    const data = await response.json();
                    if (data.success) {
                        const el = document.getElementById(`msg-${messageId}`);
                        if (el) el.remove();
                        this.hideConfirmModal();
                    } else {
                        showToast(data.error || "Erreur lors de la suppression", "error");
                    }
                } catch (err) {
                    console.error(err);
                    showToast("Erreur réseau", "error");
                }
            }
        };
    }

    hideConfirmModal() {
        this.elements.confirmModal.classList.add('hidden');
    }

    scrollToMessage(messageId) {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('highlight-message');
            setTimeout(() => el.classList.remove('highlight-message'), 2000);
        } else {
            showToast("Message trop ancien ou introuvable", "info");
        }
    }

    appendMessage(m) {
        if (document.getElementById(`msg-${m.id}`)) return;

        const div = document.createElement('div');
        div.id = `msg-${m.id}`;
        div.className = `flex flex-col ${m.is_me ? 'items-end' : 'items-start'}`;
        
        const messageText = m.text || "";
        const safeText = messageText.replace(/'/g, "\\'");
        const displayNickname = m.sender_nickname || "Anonyme";

        let parentHtml = '';
        if (m.parent) {
            const parentText = m.parent.text || "📸 Image";
            parentHtml = `
                <div class="mb-2 p-2 bg-black/5 rounded-lg text-[10px] border-l-2 border-pink-500/50 overflow-hidden cursor-pointer active:opacity-70" 
                     onclick="event.stopPropagation(); maraChat.scrollToMessage('${m.parent.id}')">
                    <span class="font-black uppercase block text-[8px] opacity-70">${m.parent.sender_nickname}</span>
                    <span class="opacity-80 truncate block">${parentText}</span>
                </div>
            `;
        }

        const downloadBtn = m.image_url ? `
            <div class="relative group/img mb-2">
                <img src="${m.image_url}" class="rounded-lg max-w-full" />
                <a href="${m.image_url}" download class="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition shadow-lg">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                </a>
            </div>
        ` : '';

        div.innerHTML = `
            <div class="nickname-tag ${m.is_me ? 'text-pink-500' : 'text-gray-400'}">
                ${displayNickname}
            </div>
            <div class="relative group max-w-[90%] sm:max-w-[85%] flex items-center gap-2">
                <div class="message-bubble p-3 rounded-2xl shadow-sm ${m.is_me ? 'message-me' : 'message-other'}" 
                     onclick="maraChat.showContextMenu('${m.id}', '${displayNickname}', '${safeText || '📸 Image'}', ${m.is_me}, event)"
                     oncontextmenu="maraChat.showContextMenu('${m.id}', '${displayNickname}', '${safeText || '📸 Image'}', ${m.is_me}, event); return false;"
                     ontouchstart="maraChat.handleTouchStart('${m.id}', '${displayNickname}', '${safeText || '📸 Image'}', ${m.is_me}, event)"
                     ontouchend="maraChat.handleTouchEnd()">
                    ${parentHtml}
                    ${downloadBtn}
                    ${messageText ? `<p class="text-[0.95rem] leading-relaxed whitespace-pre-wrap">${messageText}</p>` : ''}
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <p class="text-[10px] opacity-60">${m.created_at}</p>
                    </div>
                    <div id="reactions-${m.id}" class="flex flex-wrap gap-1 mt-1.5"></div>
                </div>
            </div>
        `;
        this.elements.chatMessages.appendChild(div);
    }

    handleTouchStart(messageId, nickname, text, isMe, event) {
        this.longPressTimer = setTimeout(() => {
            this.showContextMenu(messageId, nickname, text, isMe, event);
        }, 500);
    }

    handleTouchEnd() {
        clearTimeout(this.longPressTimer);
    }
}

// Helper global functions (used in inline HTML events)
window.copyGroupLink = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
        showToast("Lien du groupe copié !", "success");
    });
};
