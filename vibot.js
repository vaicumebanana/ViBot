const ViBot = {
  config: {
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: "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",
    model: "llama3-70b-8192",
    temperature: 0.7,
    maxTokens: 1024
  },

  language: 'pt',

  conversations: {}, // objeto que guarda todas as conversas: id => mensagens array
  currentConversationId: null,

  init() {
    this.DOM = {
      chatbox: document.getElementById('chatbox'),
      input: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      langSelector: document.getElementById('languageSelector'), // não existe no html atual, pode remover ou adicionar se quiser
      newChatBtn: document.getElementById('newChatBtnSidebar'),
      conversationsList: document.getElementById('conversationsList'),
      typingIndicator: this.createTypingIndicator()
    };

    this.setupEvents();
    this.loadConversations();
    this.startNewConversation();
  },

  setupEvents() {
    this.DOM.sendBtn.addEventListener('click', () => this.sendMessage());
    this.DOM.input.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.sendMessage();
    });

    this.DOM.newChatBtn.addEventListener('click', () => this.startNewConversation());
  },

  startNewConversation() {
    // cria um id para a conversa nova (timestamp simples)
    const newId = 'conv-' + Date.now();
    this.currentConversationId = newId;
    this.conversations[newId] = []; // array vazio de mensagens

    this.renderConversationsList();
    this.loadConversation(newId);
  },

  loadConversation(id) {
    this.currentConversationId = id;
    this.DOM.chatbox.innerHTML = '';

    const messages = this.conversations[id] || [];

    messages.forEach(msg => {
      this.addMessage(msg.text, msg.type, false);
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
      btn.textContent = msgs.length > 0 ? msgs[0].text.slice(0, 30) + (msgs[0].text.length > 30 ? "..." : "") : "Nova conversa";
      btn.title = btn.textContent;
      btn.className = id === this.currentConversationId ? 'active' : '';
      btn.addEventListener('click', () => this.loadConversation(id));
      list.appendChild(btn);
    });
  },

  highlightCurrentConversation() {
    const buttons = this.DOM.conversationsList.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.classList.toggle('active', btn.textContent === (this.conversations[this.currentConversationId]?.[0]?.text.slice(0,30) || "Nova conversa"));
    });
  },

  async sendMessage() {
    const message = this.DOM.input.value.trim();
    if (!message) return;

    this.addMessage(message, 'user');
    this.conversations[this.currentConversationId].push({ text: message, type: 'user' });
    this.DOM.input.value = '';
    this.DOM.sendBtn.disabled = true;

    this.DOM.chatbox.appendChild(this.DOM.typingIndicator);
    this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;

    try {
      const response = await this.callAPI(message);
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);

      const translated = await this.translateIfNeeded(response);
      this.addMessage(translated, 'bot');
      this.conversations[this.currentConversationId].push({ text: translated, type: 'bot' });

      this.saveConversations();

      // feedback opcional para a API (não afeta UI)
      await this.sendFeedbackToGroq(translated);
    } catch (error) {
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);
      this.addMessage(`Erro: ${error.message}`, 'error');
      this.conversations[this.currentConversationId].push({ text: `Erro: ${error.message}`, type: 'error' });
      this.saveConversations();
      console.error("ViBot Error:", error);
    } finally {
      this.DOM.sendBtn.disabled = false;
      this.DOM.input.focus();
      this.renderConversationsList();
    }
  },

  async callAPI(message) {
    const response = await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: message }],
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

  async translateIfNeeded(text) {
    if (this.language === 'pt') return text;

    const targetLang = {
      en: 'English',
      es: 'Spanish'
    }[this.language];

    const prompt = `Traduza o seguinte texto para ${targetLang}, mantendo o tom natural e informal:\n\n"${text}"`;

    try {
      const response = await fetch(this.config.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: prompt }],
          model: this.config.model,
          temperature: 0.3,
          max_tokens: this.config.maxTokens
        })
      });

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (err) {
      console.error("Erro na tradução:", err);
      return text;
    }
  },

  async sendFeedbackToGroq(responseText) {
    // opcional - mantem conforme seu código original
    await fetch(this.config.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        messages: [{ role: "system", content: `Última resposta: ${responseText}` }],
        model: this.config.model
      })
    });
  },

  addMessage(text, type, scroll = true) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    this.DOM.chatbox.appendChild(msg);
    if(scroll) {
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
      if(stored) {
        this.conversations = JSON.parse(stored);
        // Usa a última conversa carregada se existir
        const keys = Object.keys(this.conversations);
        if(keys.length > 0) {
          this.currentConversationId = keys[keys.length - 1];
        }
      }
    } catch (e) {
      console.warn("Erro ao carregar conversas:", e);
      this.conversations = {};
    }
  }
};

document.addEventListener('DOMContentLoaded', () => ViBot.init());
