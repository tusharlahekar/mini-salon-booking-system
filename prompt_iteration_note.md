# AI Chatbot Prompt Design & Iteration Note

**Role:** Prompt Engineer Hiring Task — Mini Salon Booking & Billing System  
**Company:** GURU AI Technologies  
**Project:** Aura Luxury Salon & Wellness Concierge (`AuraBot`)

---

## 1. Why the Prompt Was Designed This Way

### A. Dynamic Grounding Over Hardcoded Knowledge
Hardcoding service prices inside a static prompt is an anti-pattern: prices change, durations shift, and new services get introduced in the database. In our architecture, the system prompt contains a dynamic placeholder `{{SERVICES_TABLE}}` that is populated at request runtime from SQLite (`db.getAllServices()`). This guarantees zero price divergence between the booking form, the billing engine, and the chatbot.

### B. Natural Multilingual Code-Switching (English, Hinglish, Marathi)
Real salon clientele in India rarely communicate in textbook English or formal Hindi. They use colloquial Romanized phrases:
- *Hinglish:* `"Bhai haircut kitne ka hai aur kal ka slot milega kya?"`
- *Marathi:* `"Facial che charges kay aahet? Sunday la salon chalu ahe ka?"`

The prompt explicitly instructs the LLM to mirror the user's dialect and formality level while maintaining a luxurious, warm salon concierge persona.

### C. Graceful Scope Boundary
Salon staff bots should not answer general trivia, write code, or entertain off-topic queries. The prompt establishes crisp guardrails: deflect gracefully with humor or warmth, and seamlessly redirect the visitor back to Aura Salon's treatments.

---

## 2. Edge Cases Caught During Testing & How They Were Fixed

During testing with simulated customer queries, four distinct failure modes were observed:

### Failure Case 1: Hallucinating Discounts on Hinglish Bargaining
- **What Broke:** When tested with `"Bhai student hu, thoda discount milega kya?"` or `"First time visit pe kuch off hai kya?"`, standard LLM completions tended to be overly agreeable, inventing statements like: *"Sure! We offer 10% off on your first visit"*. Because no discount policy was configured in the database, this would cause real-world conflict at the billing counter.
- **Root Cause:** Default conversational RLHF incentivizes being helpful and accommodating, which leads to hallucinating promotional offers.
- **The Fix:** Added an absolute grounding directive:
  ```text
  Always quote the EXACT prices from the live services list. NEVER invent or hallucinate 
  services, prices, packages, or discounts not present in the live context. If asked for 
  discounts, politely state our rates are fixed and transparent for luxury quality.
  ```

---

### Failure Case 2: Assuming At-Home Salon Visits (Out-of-Scope Drift)
- **What Broke:** When asked `"Can you send someone to my house for Bridal Makeup?"` or `"Ghar pe aakar haircut kar doge kya?"`, the baseline prompt replied affirmatively, assuming typical freelance beautician workflows.
- **Root Cause:** The model lacked spatial context that Aura Salon operates exclusively inside an experiential brick-and-mortar studio with specialized hygiene and equipment.
- **The Fix:** Explicitly injected salon operational context into the prompt:
  ```text
  All luxury treatments are provided exclusively at our studio (104 Heritage Boulevard, 
  Linking Road, Bandra West). Aura Salon does NOT offer home-visit services. Refuse 
  politely and invite the guest to our studio.
  ```

---

### Failure Case 3: Ambiguous Date Resolution in In-Chat Booking
- **What Broke:** When testing conversational direct booking, a user typed `"Kal dopahar 3 baje Rahul ke liye haircut book karo"`. The bot attempted to create an appointment without obtaining a mandatory 10-digit phone number or validating whether tomorrow was already fully booked at 3:00 PM.
- **Root Cause:** Premature confirmation without verifying mandatory database validation fields.
- **The Fix:** Structured the direct booking state machine into 5 discrete parameters (`service`, `date`, `time`, `customer_name`, `phone`). If any parameter is missing or invalid (e.g. phone has fewer than 10 digits), the bot proactively prompts for that specific field before outputting the structured booking intent.

---

### Failure Case 4: Romanized Marathi Nuance Handling
- **What Broke:** Queries like `"Kiti wajta open hota salon?"` sometimes caused the English LLM to confuse Marathi `"waje / wajta"` (o'clock/time) with Hindi words or answer in standard Hindi instead of Marathi.
- **Root Cause:** Insufficient few-shot demonstration for Marathi colloquial vocabulary.
- **The Fix:** Added explicit few-shot conversation pairs in Romanized Marathi and Hinglish directly inside the prompt to anchor the cross-lingual tokenizer to appropriate phonetic colloquialisms.

---

## 3. Resilience: Hybrid Fallback Architecture
To guarantee 100% testability even without third-party API keys or when network latency occurs, the backend is paired with an intelligent deterministic NLP engine (`chatbot_engine.js`). It extracts multilingual semantic intents, matches services against the live SQLite database, validates phone numbers, and processes bookings with zero external dependencies.
