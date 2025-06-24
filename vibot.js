const ViBot = {
  config: {
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: "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",
    model: "llama3-70b-8192",
    temperature: 0.7,
    maxTokens: 1024
  },

  language: 'pt',

  conversations: {}, // id => array de mensagens { role: 'user'|'assistant', content: string }
  currentConversationId: null,

  init() {
    this.DOM = {
      chatbox: document.getElementById('chatbox'),
      input: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      langSelector: document.getElementById('languageSelector'),
      newChatBtn: document.getElementById('newChatBtnSidebar'),
      conversationsList: document.getElementById('conversationsList'),
      typingIndicator: this.createTypingIndicator()
    };

    this.setupEvents();
    this.loadConversations();

    // Se não tiver conversa carregada, cria nova
    if (!this.currentConversationId || !this.conversations[this.currentConversationId]) {
      this.startNewConversation();
    } else {
      this.loadConversation(this.currentConversationId);
    }
  },

  setupEvents() {
    this.DOM.sendBtn.addEventListener('click', () => this.sendMessage());
    this.DOM.input.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.sendMessage();
    });
    this.DOM.newChatBtn.addEventListener('click', () => this.startNewConversation());

    this.DOM.langSelector.addEventListener('change', e => {
      this.language = e.target.value;
    });
  },

  startNewConversation() {
    const newId = 'conv-' + Date.now();
    this.currentConversationId = newId;
    this.conversations[newId] = [];
    this.renderConversationsList();
    this.loadConversation(newId);
  },

  loadConversation(id) {
    this.currentConversationId = id;
    this.DOM.chatbox.innerHTML = '';
    const messages = this.conversations[id] || [];

    messages.forEach(msg => {
      this.addMessage(msg.content, msg.role === 'user' ? 'user' : 'bot', false);
    });

    this.DOM.input.value = '';
    this.DOM.input.focus();

    this.highlightCurrentConversation();
  },

  renderConversationsList() {
    const list = this.DOM.conversationsList;
    list.innerHTML = '';

    Object.entries(this.conversations).forEach(([id, msgs]) => {
      const btn = document.createElement('button');
      btn.textContent = msgs.length > 0 ? msgs[0].content.slice(0, 30) + (msgs[0].content.length > 30 ? "..." : "") : "Nova conversa";
      btn.title = btn.textContent;
      btn.className = id === this.currentConversationId ? 'active' : '';
      btn.addEventListener('click', () => this.loadConversation(id));
      list.appendChild(btn);
    });
  },

  highlightCurrentConversation() {
    const buttons = this.DOM.conversationsList.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn === buttons[this.getCurrentConversationIndex()]);
    });
  },

  getCurrentConversationIndex() {
    const keys = Object.keys(this.conversations);
    return keys.indexOf(this.currentConversationId);
  },

  async sendMessage() {
    const message = this.DOM.input.value.trim();
    if (!message) return;

    // Adiciona mensagem do usuário
    this.addMessage(message, 'user');
    this.conversations[this.currentConversationId].push({ role: 'user', content: message });
    this.DOM.input.value = '';
    this.DOM.sendBtn.disabled = true;

    // Mostra "digitando..."
    this.DOM.chatbox.appendChild(this.DOM.typingIndicator);
    this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;

    try {
      const fullMessages = this.buildMessagesForAPI();

      const responseText = await this.callAPI(fullMessages);
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);

      // Adiciona resposta bot
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
    // Adiciona sistema para idioma se não for português
    const systemMsg = this.language !== 'pt' ? 
      { role: 'system', content: `Responda em ${this.getLanguageName(this.language)}.` } :
      { role: 'system', content: `Você é um assistente virtual que responde em português.` };

    // pega as mensagens da conversa atual para contexto
    const userAndAssistantMessages = this.conversations[this.currentConversationId].filter(m => m.role === 'user' || m.role === 'assistant');

    // junta tudo
    return [systemMsg, ...userAndAssistantMessages];
  },

  async callAPI(messages) {
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        messages: messages,
        model: this.config.model,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Erro na API');
    }

    const data = await response.json();
    return data.choices[0].message.content;
  },

  addMessage(text, type, scroll = true) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    this.DOM.chatbox.appendChild(msg);
    if (scroll) {
      this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;
    }
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
