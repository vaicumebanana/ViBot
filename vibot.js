const ViBot = {
  config: {
    apiUrl: "https://api.groq.com/openai/v1/chat/completions",
    apiKey: "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",
    model: "llama3-70b-8192",
    temperature: 0.7,
    maxTokens: 1024
  },

  language: 'pt',

  init() {
    this.DOM = {
      chatbox: document.getElementById('chatbox'),
      input: document.getElementById('userInput'),
      sendBtn: document.getElementById('sendBtn'),
      langSelector: document.getElementById('languageSelector'),
      typingIndicator: this.createTypingIndicator()
    };

    this.setupEvents();
    this.loadHistory();
  },

  setupEvents() {
    this.DOM.sendBtn.addEventListener('click', () => this.sendMessage());
    this.DOM.input.addEventListener('keypress', e => {
      if (e.key === 'Enter') this.sendMessage();
    });

    this.DOM.langSelector.addEventListener('change', (e) => {
      this.language = e.target.value;
      this.DOM.input.placeholder = {
        pt: "Digite sua mensagem...",
        en: "Type your message...",
        es: "Escribe tu mensaje..."
      }[this.language];
    });
  },

  async sendMessage() {
    const message = this.DOM.input.value.trim();
    if (!message) return;

    this.addMessage(message, 'user');
    this.DOM.input.value = '';
    this.DOM.sendBtn.disabled = true;
    this.DOM.chatbox.appendChild(this.DOM.typingIndicator);
    this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;

    try {
      const response = await this.callAPI(message);
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);

      const translated = await this.translateIfNeeded(response);
      this.addMessage(translated, 'bot');

      await this.sendFeedbackToGroq(translated);
    } catch (error) {
      this.DOM.chatbox.removeChild(this.DOM.typingIndicator);
      this.addMessage(`Erro: ${error.message}`, 'error');
      console.error("ViBot Error:", error);
    } finally {
      this.DOM.sendBtn.disabled = false;
      this.DOM.input.focus();
      this.saveHistory();
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

  addMessage(text, type) {
    const msg = document.createElement('div');
    msg.className = `message ${type}`;
    msg.textContent = text;
    this.DOM.chatbox.appendChild(msg);
    this.DOM.chatbox.scrollTop = this.DOM.chatbox.scrollHeight;
  },

  createTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'message bot typing';
    indicator.textContent = 'Digitando...';
    return indicator;
  },

  saveHistory() {
    const messages = Array.from(this.DOM.chatbox.querySelectorAll('.message'))
      .filter(el => !el.classList.contains('typing'))
      .map(el => ({
        text: el.textContent,
        type: el.classList.contains('user') ? 'user' :
              el.classList.contains('error') ? 'error' : 'bot'
      }));
    localStorage.setItem('ViBotHistory', JSON.stringify(messages));
  },

  loadHistory() {
    const history = localStorage.getItem('ViBotHistory');
    if (history) {
      JSON.parse(history).forEach(msg => this.addMessage(msg.text, msg.type));
    }
  }
};

document.addEventListener('DOMContentLoaded', () => ViBot.init());
