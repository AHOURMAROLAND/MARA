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
            reactionPicker: document.getElementById('reaction-picker')
        };

        this.init();
    }

    init() {
        this.connectWebSocket();
        this.setupEventListeners();
        this.setVH();
        this.startIntervals();
        this.scrollToBottom();
    }

    connectWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/chat/${this.groupLinkId}/`;
        
        console.log('[MARA] Connecting to WebSocket:', wsUrl);
        this.socket = new WebSocket(wsUrl);

        this.socket.onmessage = (e) => {
            const data = JSON.parse(e.data);
            console.log('[MARA] WS Received:', data.type);
            
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
                const el = document.getElementById(`msg-${data.message_id}`);
                if (el) {
                    el.style.opacity = '0';
                    el.style.transform = 'scale(0.8)';
                    setTimeout(() => el.remove(), 300);
                }
            }
        };

        this.socket.onclose = () => {
            console.log('[MARA] WebSocket closed. Reconnecting...');
            setTimeout(() => this.connectWebSocket(), 2000);
        };

        this.socket.onerror = (err) => {
            console.error('[MARA] WebSocket error:', err);
        };
    }

    setupEventListeners() {
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
                alert(data.error);
                if (data.error.includes('banni')) window.location.reload();
            }
        } catch (err) {
            console.error(err);
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

    sendReaction(messageId, emoji) {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                'type': 'reaction',
                'message_id': messageId,
                'emoji': emoji,
                'session_token': this.myToken
            }));
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
        document.querySelectorAll('.options-dropdown').forEach(d => {
            if (d.id !== `options-${messageId}`) d.classList.remove('active');
        });
        const menu = document.getElementById(`options-${messageId}`);
        if (menu) menu.classList.toggle('active');
    }

    deleteMessage(messageId) {
        if (!confirm("Supprimer ce message pour tout le monde ?")) return;
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify({
                'type': 'delete_message',
                'message_id': messageId,
                'session_token': this.myToken
            }));
        }
    }

    appendMessage(m) {
        if (document.getElementById(`msg-${m.id}`)) return;

        const div = document.createElement('div');
        div.id = `msg-${m.id}`;
        div.className = `flex flex-col ${m.is_me ? 'items-end' : 'items-start'}`;
        
        let parentHtml = '';
        if (m.parent) {
            parentHtml = `
                <div class="mb-2 p-2 bg-black/5 rounded-lg text-[10px] border-l-2 border-pink-500/50 overflow-hidden">
                    <span class="font-black uppercase block text-[8px] opacity-70">${m.parent.sender_nickname}</span>
                    <span class="opacity-80 truncate block">${m.parent.text}</span>
                </div>
            `;
        }

        const deleteBtn = m.is_me ? `
            <button onclick="maraChat.deleteMessage('${m.id}')" class="option-item delete delete-trigger" data-created="${new Date().toISOString()}">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Supprimer
            </button>
        ` : '';

        const optionsMenu = `
            <div class="relative order-2">
                <button onclick="maraChat.toggleOptionsMenu('${m.id}')" class="message-options-btn p-1.5 text-gray-400 hover:text-gray-600 transition-all rounded-full hover:bg-gray-100">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                </button>
                <div id="options-${m.id}" class="options-dropdown">
                    <button onclick="maraChat.setReply('${m.id}', '${m.sender_nickname}', '${m.text ? m.text.substring(0, 30).replace(/'/g, "\\'") : 'Photo'}')" class="option-item">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                        </svg>
                        Répondre
                    </button>
                    <button onclick="maraChat.showReactionPicker('${m.id}')" class="option-item">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Réagir
                    </button>
                    ${deleteBtn}
                </div>
            </div>
        `;

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
                ${m.sender_nickname}
            </div>
            <div class="relative group max-w-[90%] sm:max-w-[85%] flex items-center gap-2">
                ${optionsMenu}
                <div class="message-bubble p-3 rounded-2xl shadow-sm ${m.is_me ? 'message-me order-1' : 'message-other order-1'}" 
                     onclick="maraChat.setReply('${m.id}', '${m.sender_nickname}', '${m.text ? m.text.substring(0, 30).replace(/'/g, "\\'") : 'Photo'}')"
                     oncontextmenu="event.preventDefault(); maraChat.showReactionPicker('${m.id}')"
                     ontouchstart="maraChat.handleTouchStart('${m.id}')"
                     ontouchend="maraChat.handleTouchEnd()">
                    ${parentHtml}
                    ${downloadBtn}
                    ${m.text ? `<p class="text-[0.95rem] leading-relaxed whitespace-pre-wrap">${m.text}</p>` : ''}
                    <div class="flex items-center justify-end gap-2 mt-1">
                        <p class="text-[10px] opacity-60">${m.created_at}</p>
                    </div>
                    <div id="reactions-${m.id}" class="flex flex-wrap gap-1 mt-1.5"></div>
                </div>
            </div>
        `;
        this.elements.chatMessages.appendChild(div);
    }

    handleTouchStart(messageId) {
        this.longPressTimer = setTimeout(() => {
            this.showReactionPicker(messageId);
            if (window.navigator.vibrate) window.navigator.vibrate(50);
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
        alert("Lien du groupe copié !");
    });
};
