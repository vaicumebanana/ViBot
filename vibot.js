const ViBot = {
  config: {
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: "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",
    model: "llama3-70b-8192",
    temperature: 0.7,
    maxTokens: 1024
  },

  language: 'pt',
  conversations: {},
  currentConversationId: null,

  init() {
    this.DOM = {
      chatbox: document.getElementById('chatbox'),
      input: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      langSelector: document.getElementById('languageSelector'),
      conversationList: document.getElementById('conversationList'),
      newConvBtn: document.getElementById('newConversationBtn'),
      typingIndicator: this.createTypingIndicator()
    };

    this.loadConversations();

    if (!this.currentConversationId) {
      this.createNewConversation();
    } else {
      this.renderConversation();
    }

    this.setupEvents();
    this.renderConversationsList();
  },

  setupEvents() {
    this.DOM.sendBtn.addEventListener('click', () => this.sendMessage());
    this.DOM.input.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.sendMessage();
    });
    this.DOM.langSelector.addEventListener('change', e => {
      this.language = e.target.value;
      this.DOM.input.placeholder = {
        pt: "Digite sua mensagem...",
        en: "Type your message...",
        es: "Escribe tu mensaje...",
        zh: "输入你的信息...",
        hi: "अपना संदेश टाइप करें...",
        ar: "اكتب رسالتك...",
        fr: "Tapez votre message...",
        ru: "Введите ваше сообщение..."
      }[this.language] || "Digite sua mensagem...";
    });

    this.DOM.newConvBtn.addEventListener('click', () => {
      this.createNewConversation();
      this.renderConversationsList();
    });
  },

  createNewConversation() {
    const id = `conv_${Date.now()}`;
    this.conversations[id] = [];
    this.currentConversationId = id;
    this.renderConversation();
    this.saveConversations();
    this.renderConversationsList();
  },

  renderConversation() {
    this.DOM.chatbox.innerHTML = '';
    const msgs = this.conversations[this.currentConversationId] || [];
    msgs.forEach(m => this.addMessage(m.content, m.role === 'user' ? 'user' : (m.role === 'assistant' ? 'bot' : 'error'), false));
    this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;
  },

  renderConversationsList() {
    if (!this.DOM.conversationList) return;

    this.DOM.conversationList.innerHTML = '';
    Object.entries(this.conversations).forEach(([id, messages]) => {
      const btn = document.createElement('button');
      btn.className = 'conversation-btn';
      btn.textContent = messages.length > 0 ? messages[0].content.slice(0, 20) : 'Nova conversa';
      if (id === this.currentConversationId) btn.classList.add('active');

      btn.onclick = () => {
        this.currentConversationId = id;
        this.renderConversation();
        this.renderConversationsList();
      };

      this.DOM.conversationList.appendChild(btn);
    });
  },

  async sendMessage() {
    const message = this.DOM.input.value.trim();
    if (!message) return;

    this.addMessage(message, 'user');
    this.conversations[this.currentConversationId].push({ role: 'user', content: message });
    this.DOM.input.value = '';
    this.DOM.sendBtn.disabled = true;

    this.DOM.chatbox.appendChild(this.DOM.typingIndicator);
    this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;

    try {
      const messagesForAPI = this.buildMessagesForAPI();

      const responseText = await this.callAPI(messagesForAPI);
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);

      this.addMessage(responseText, 'bot');
      this.conversations[this.currentConversationId].push({ role: 'assistant', content: responseText });

      this.saveConversations();
    } catch (error) {
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);
      this.addMessage(`Erro: ${error.message}`, 'error');
      this.conversations[this.currentConversationId].push({ role: 'error', content: `Erro: ${error.message}` });
      this.saveConversations();
      console.error("ViBot Error:", error);
    } finally {
      this.DOM.sendBtn.disabled = false;
      this.DOM.input.focus();
      this.renderConversationsList();
    }
  },

  buildMessagesForAPI() {
    const systemMsg = this.language !== 'pt'
      ? { role: 'system', content: `Responda em ${this.getLanguageName(this.language)}.` }
      : { role: 'system', content: `Você é um assistente virtual que responde em português.` };

    const history = this.conversations[this.currentConversationId] || [];
    const filtered = history.filter(m => m.role === 'user' || m.role === 'assistant');

    return [systemMsg, ...filtered];
  },

  async callAPI(messages) {
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Erro na API');
    }

    const data = await response.json();

    if (data.choices && data.choices.length > 0 && data.choices[0].message) {
      return data.choices[0].message.content.trim();
    } else {
      throw new Error('Resposta inesperada da API');
    }
  },

  addMessage(text, type, scroll = true) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    this.DOM.chatbox.appendChild(msg);
    if (scroll) this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;
  },

  createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message bot typing';
    indicator.textContent = 'Digitando...';
    return indicator;
  },

  saveConversations() {
    try {
      localStorage.setItem('ViBotConversations', JSON.stringify(this.conversations));
    } catch (e) {
      console.warn("Não foi possível salvar as conversas:", e);
    }
  },

  loadConversations() {
    try {
      const stored = localStorage.getItem('ViBotConversations');
      if (stored) {
        this.conversations = JSON.parse(stored);
        const keys = Object.keys(this.conversations);
        if (keys.length > 0) {
          this.currentConversationId = keys[keys.length - 1];
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar conversas:", e);
      this.conversations = {};
    }
  },

  getLanguageName(code) {
    return {
      pt: "Português",
      en: "Inglês",
      es: "Espanhol",
      zh: "Chinês",
      hi: "Hindi",
      ar: "Árabe",
      fr: "Francês",
      ru: "Russo"
    }[code] || "Português";
  }
};

document.addEventListener('DOMContentLoaded', () => ViBot.init());
