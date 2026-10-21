// AI Chatbot Client Script for Aura Salon
document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('chatbot-trigger');
  const windowEl = document.getElementById('chatbot-window');
  const closeBtn = document.getElementById('chat-close-btn');
  const form = document.getElementById('chat-form');
  const input = document.getElementById('chat-user-input');
  const messagesContainer = document.getElementById('chat-messages');
  const chips = document.querySelectorAll('.chat-chip');

  const chatHistory = [];

  // Toggle Chatbot
  trigger.addEventListener('click', () => {
    windowEl.classList.toggle('open');
    if (windowEl.classList.contains('open')) {
      input.focus();
    }
  });

  closeBtn.addEventListener('click', () => {
    windowEl.classList.remove('open');
  });

  // Handle Quick Chips
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const promptText = chip.getAttribute('data-prompt');
      input.value = promptText;
      sendMessage(promptText);
    });
  });

  // Handle Form Submission
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const userText = input.value.trim();
    if (!userText) return;
    sendMessage(userText);
  });

  async function sendMessage(text) {
    input.value = '';
    appendMessage(text, 'user');
    chatHistory.push({ role: 'user', content: text });

    // Show typing placeholder
    const typingIndicator = appendTypingIndicator();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: chatHistory
        })
      });

      const data = await res.json();
      typingIndicator.remove();

      if (data.success && data.reply) {
        appendMessage(data.reply, 'bot', data.action, data.confirmedBooking);
        chatHistory.push({ role: 'assistant', content: data.reply });
      } else {
        appendMessage(data.error || 'Sorry, I encountered a temporary hiccup. Please ask again!', 'bot');
      }
    } catch (err) {
      typingIndicator.remove();
      appendMessage('Unable to connect to AI server. Please check your network.', 'bot');
    }
  }

  function appendMessage(content, sender, action = null, confirmedBooking = null) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message ${sender}`;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    
    // Format simple markdown bold and newlines
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br>');

    bubble.innerHTML = formatted;
    msgDiv.appendChild(bubble);

    // If an action button or confirmed booking is returned
    if (confirmedBooking) {
      const card = document.createElement('div');
      card.style.cssText = 'margin-top: 8px; padding: 10px; background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.3); border-radius: 8px; font-size: 0.8rem; color: #6ee7b7;';
      card.innerHTML = `
        <strong>Appointment Locked!</strong><br>
        Ref: #${confirmedBooking.id} &bull; ${confirmedBooking.service}<br>
        Date: ${confirmedBooking.date} @ ${confirmedBooking.time}
      `;
      msgDiv.appendChild(card);

      // Refresh slots on booking page if open
      const dateInput = document.getElementById('booking-date');
      if (dateInput && typeof loadAvailableSlots === 'function') {
        loadAvailableSlots(dateInput.value);
      }
    } else if (action && action.suggest_service) {
      // Suggesting a service button
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-gold btn-sm';
      btn.style.cssText = 'margin-top: 8px; align-self: flex-start;';
      btn.textContent = `Select ${action.suggest_service} in Form`;
      btn.onclick = () => {
        if (typeof quickSelectService === 'function') {
          quickSelectService(action.suggest_service);
          windowEl.classList.remove('open');
        }
      };
      msgDiv.appendChild(btn);
    }

    messagesContainer.appendChild(msgDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function appendTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'chat-message bot';
    typingDiv.innerHTML = `
      <div class="message-bubble" style="color: var(--text-muted); font-style: italic;">
        AuraBot is thinking...
      </div>
    `;
    messagesContainer.appendChild(typingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return typingDiv;
  }
});
