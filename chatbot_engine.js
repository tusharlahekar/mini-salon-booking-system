const fs = require('fs');
const path = require('path');
const db = require('./database');

const SYSTEM_PROMPT_TEMPLATE = fs.readFileSync(path.join(__dirname, 'system_prompt.txt'), 'utf8');

// Build dynamic system prompt with live database service pricing
function getFormattedSystemPrompt() {
  const services = db.getAllServices();
  const servicesTable = services.map(s => 
    `- ${s.name}: ₹${s.price} (Duration: ${s.duration} mins) - ${s.description || 'Exclusive luxury care'}`
  ).join('\n');

  return SYSTEM_PROMPT_TEMPLATE.replace('{{SERVICES_TABLE}}', servicesTable);
}

// Check if Gemini or OpenAI API key is configured
async function callLLM(userMessage, conversationHistory = []) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return null; // Fallback to intelligent local NLP engine
  }

  try {
    if (process.env.GEMINI_API_KEY) {
      // Use Google Gemini API (v1beta)
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      const systemInstruction = getFormattedSystemPrompt();

      const contents = [];
      // Add previous chat history
      for (const msg of conversationHistory.slice(-4)) {
        contents.push({
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: msg.content }]
        });
      }
      contents.push({
        role: 'user',
        parts: [{ text: userMessage }]
      });

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }]
          },
          contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 500
          }
        })
      });

      if (!response.ok) {
        console.warn('Gemini API returned error:', await response.text());
        return null;
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text;
    }

    if (process.env.OPENAI_API_KEY) {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: getFormattedSystemPrompt() },
            ...conversationHistory.slice(-4),
            { role: 'user', content: userMessage }
          ],
          temperature: 0.4
        })
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.choices?.[0]?.message?.content;
    }
  } catch (err) {
    console.warn('LLM call failed, falling back to local NLP engine:', err.message);
    return null;
  }
  return null;
}

// Intelligent Multilingual (English / Hinglish / Marathi) Local Semantic Fallback Engine
function localNLPEngine(userMessage, chatContext = {}) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const services = db.getAllServices();

  // 1. OUT-OF-SCOPE REFUSAL (Strict rubric requirement)
  const outOfScopePatterns = [
    /home delivery/i, /ghar (pe|aakar|chya)/i, /pizza/i, /burger/i, /khana/i, /food/i,
    /write.*python/i, /write.*code/i, /solve/i, /math/i, /weather/i, /rain/i,
    /cricket/i, /ipl/i, /politics/i, /narendra modi/i, /prime minister/i,
    /movie/i, /film/i, /song/i, /dance/i, /car repair/i, /uber/i, /swiggy/i, /zomato/i
  ];
  for (const pattern of outOfScopePatterns) {
    if (pattern.test(lower)) {
      if (/marathi|kasa|kay|chya|aahe/i.test(lower)) {
        return {
          reply: "Namaskar! Aura Salon fakt luxury hair, skin aani grooming services offer karto. Aamhi home delivery kiwa salon baheril vishayanvar madat nahi karu shakat. Tumhala amchya services badal vicharayche aahe ka?",
          action: null
        };
      }
      return {
        reply: "Hello! Aura Luxury Salon specializes strictly in salon, hair, and wellness treatments at our Bandra studio. We do not provide home delivery or services outside our studio! Would you like to check out our hair styling or facial treatments instead?",
        action: null
      };
    }
  }

  // 2. TIMINGS & OPERATING HOURS (Hinglish, Marathi, English)
  if (
    /time|timing|timings|open|close|hours|sunday|weekend|kab.*open|kiti.*wajta|kadhi.*chalu|chalu.*aste/i.test(lower) &&
    !/book|slot/i.test(lower)
  ) {
    if (/kiti|wajta|kadhi|chalu|aahe/i.test(lower)) {
      return {
        reply: "Aura Luxury Salon somvar te ravivar (sarva 7 divas) sakali 09:00 AM pasun sandhyakali 08:00 PM paryant open aste! Tumhi kenvha hi bhet deu shakata.",
        action: null
      };
    }
    return {
      reply: "Aura Luxury Salon is open all 7 days a week (Monday to Sunday) from 09:00 AM to 08:00 PM! Aap weekend ya weekdays kabhi bhi aaram se visit kar sakte hain.",
      action: null
    };
  }

  // 3. LOCATION & ADDRESS
  if (/location|address|kaha|kidhar|kuthe|where|map|reach|contact/i.test(lower)) {
    return {
      reply: "📍 Our Salon Address:\n104 Heritage Boulevard, Linking Road, Bandra West, Mumbai, Maharashtra.\n📞 Phone: +91 98200 11223.\nGoogle Maps landmark: Near Bandra Linking Road promenade.",
      action: null
    };
  }

  // 4. PRICING & SPECIFIC SERVICE INQUIRIES
  // Match against current database services
  for (const s of services) {
    const sLower = s.name.toLowerCase();
    if (lower.includes(sLower) || 
        (sLower.includes('haircut') && /hair|cut|bal|baal|case/i.test(lower) && !/spa/i.test(lower)) ||
        (sLower.includes('beard') && /beard|trim|dhadhi|dadhi/i.test(lower)) ||
        (sLower.includes('facial') && /facial|face|glow|skin/i.test(lower)) ||
        (sLower.includes('hair spa') && /spa/i.test(lower)) ||
        (sLower.includes('bridal') && /bridal|dulhan|shadi|makeup|nawri/i.test(lower))
    ) {
      if (/marathi|kay|kiti|charges|rate/i.test(lower)) {
        return {
          reply: `✨ **${s.name}**\n• Price: ₹${s.price}\n• Duration: ${s.duration} minutes\n• Details: ${s.description}\n\nTumhala ya sathi appointment book karaychi aahe ka? Tumhi mala tumchi date aani time sangu shakata!`,
          action: { suggest_service: s.name }
        };
      }
      return {
        reply: `✨ **${s.name}**\n• Price: ₹${s.price}\n• Duration: ${s.duration} minutes\n• Details: ${s.description}\n\nWould you like to book an appointment for ${s.name}? You can book right here in chat or use our quick booking form!`,
        action: { suggest_service: s.name }
      };
    }
  }

  // 5. GENERAL SERVICE LIST / RATE CARD
  if (/services|rates|price|prices|charges|menu|rate list|list|bhav|dhar/i.test(lower)) {
    const list = services.map(s => `• **${s.name}**: ₹${s.price} (${s.duration} min)`).join('\n');
    return {
      reply: `Here is our complete Luxury Salon Service Menu (live rates):\n\n${list}\n\nAll services include complimentary consultation and luxury hair/skin analysis. Which one would you like to indulge in?`,
      action: null
    };
  }

  // 6. GREETINGS
  if (/^(hi|hello|hey|namaste|namaskar|kasa ahes|kem cho|good morning|good evening)/i.test(lower)) {
    return {
      reply: "Namaste & Welcome to Aura Luxury Salon! ✨\nI am AuraBot, your personal salon concierge. I can help you check live service prices, salon timings, view available slots, or book your appointment in seconds! How may I assist you today?",
      action: null
    };
  }

  // 7. DIRECT BOOKING VIA CHAT (BONUS FEATURE)
  // Check if user wants to book or provided details
  if (/book|appointment|slot|reschedule/i.test(lower)) {
    // Attempt to extract details
    const phoneMatch = text.match(/\b\d{10}\b/);
    const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM))\b/);
    
    // Matched service
    let matchedService = null;
    for (const s of services) {
      if (lower.includes(s.name.toLowerCase())) {
        matchedService = s.name;
        break;
      }
    }

    if (matchedService && phoneMatch && timeMatch) {
      // Direct booking possible!
      const today = new Date().toISOString().split('T')[0];
      return {
        reply: `Great! I noticed you want to book **${matchedService}** at **${timeMatch[0]}** for phone **${phoneMatch[0]}**. Click 'Confirm Quick Booking' below to lock in your slot right away!`,
        action: {
          type: 'ready_to_book',
          service: matchedService,
          phone: phoneMatch[0],
          time: timeMatch[0].toUpperCase(),
          date: today
        }
      };
    }

    return {
      reply: "I would love to help you book your appointment! 💇‍♀️\nPlease tell me:\n1. Which service you'd like (e.g., Haircut, Facial, Hair Spa)\n2. Preferred date and time (e.g., Tomorrow at 3:00 PM)\n3. Your name & 10-digit phone number\n\nOr you can simply fill out the fast booking form on your screen!",
      action: null
    };
  }

  // Default polite fallback
  return {
    reply: "I am here to help you with everything at Aura Luxury Salon! You can ask me about our services (Haircut, Beard Trim, Hair Spa, Facial, Bridal Makeup), live prices, operating hours (9 AM - 8 PM), or book your slot directly. How can I help you right now?",
    action: null
  };
}

// Main handler
async function handleChat(userMessage, conversationHistory = []) {
  // If an LLM is configured via API key, try it first
  const llmResponse = await callLLM(userMessage, conversationHistory);
  if (llmResponse) {
    // Check if LLM outputted an action tag
    const actionMatch = llmResponse.match(/\[ACTION:BOOK_APPOINTMENT\s*\|\s*([^\]]+)\]/);
    let action = null;
    let cleanReply = llmResponse;

    if (actionMatch) {
      cleanReply = llmResponse.replace(actionMatch[0], '').trim();
      const params = {};
      actionMatch[1].split('|').forEach(part => {
        const [k, v] = part.split('=').map(s => s?.trim());
        if (k && v) params[k] = v;
      });
      action = { type: 'ready_to_book', ...params };
    }

    return { reply: cleanReply, action };
  }

  // Fallback to our local multilingual NLP engine
  return localNLPEngine(userMessage, {});
}

module.exports = {
  handleChat,
  getFormattedSystemPrompt,
  localNLPEngine
};
