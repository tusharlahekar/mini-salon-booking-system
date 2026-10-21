# 2–3 Minute Loom Walkthrough Video Script

**Role:** Prompt Engineer Hiring Task — Mini Salon Booking System  
**Company:** GURU AI Technologies  
**App:** Aura Luxury Salon & Wellness (`AuraBot`)

Use this script to guide your 2–3 minute screen recording video on Loom. It directly answers the rubric criteria for **Code Understanding (15 pts)** and **Overall Completeness (10 pts)**.

---

## 🎬 Video Recording Plan (Total Time: ~2 min 45 sec)

### 00:00 – 00:30 | Introduction & Tech Stack Overview
- **Visual:** Open browser at `http://localhost:3000` (Customer Booking Portal).
- **Spoken Script:**
  > *"Hi everyone, this is my submission for the Prompt Engineer role at GURU AI Technologies. I've built the Mini Salon Booking & Billing System called **Aura Luxury Salon**.  
  > For the stack, I used a modern responsive Vanilla CSS design system with glassmorphism and gold accents, a Node.js/Express backend, persistent SQLite database with WAL-mode for zero setup friction, and a multilingual AI concierge that handles English, Hinglish, and Marathi queries dynamically grounded in live database prices."*

---

### 00:30 – 01:10 | Part 1: Customer Booking Flow & Real-Time Slot Protection
- **Visual:**
  - Select "Hair Spa" from the dropdown &rarr; highlight live price update (`₹800, 45 min`).
  - Enter name (`Rahul Sharma`) and mobile number (`9876543210`).
  - Pick a date and click on an available time slot (e.g. `02:00 PM`).
  - Submit form &rarr; show confirmation modal: *"Your booking is confirmed for 2:00 PM, Oct 21"*.
  - Close modal &rarr; show that `02:00 PM` is now greyed out and marked "Booked" to prevent double-booking upfront.
- **Spoken Script:**
  > *"Here on the booking page, selecting any service dynamically reflects its live rate from our SQLite services table. When a customer picks a date, our `/api/available-slots` endpoint computes all free slots against booked appointments. When I book 2:00 PM and confirm, the system creates the record, and the UI immediately locks that slot so nobody else can double-book it."*

---

### 01:10 – 01:40 | Part 2: Admin Dashboard & Calendar Day View
- **Visual:** Click "Admin Portal" in navbar &rarr; show today's bookings list, change a booking status from `Pending` &rarr; `Confirmed` &rarr; `Done`. Click "Day Timeline View" tab to show appointments grouped by time slots.
- **Spoken Script:**
  > *"Moving to the Admin Dashboard: the salon owner sees real-time KPI metrics for today. They can filter by status or search by customer name. The owner can change statuses inline with a single click, which persists in SQLite. And instead of just a flat list, we have this Day Timeline View that groups bookings by hour so the owner can assess salon floor occupancy at a glance."*

---

### 01:40 – 02:10 | Part 3: Billing POS & Printable Invoice
- **Visual:** Click "Billing POS" &rarr; select a customer, check 2 services (e.g., Haircut ₹200 + Facial ₹500), show subtotal auto-calculating to ₹700, add ₹50 discount &rarr; total becomes ₹650. Click "Generate & Print Invoice" &rarr; show clean invoice sheet with print trigger.
- **Spoken Script:**
  > *"In the Billing POS section, staff can select multiple services for a client. Prices auto-fill, and the total auto-calculates live with customizable discounts or tax. Clicking 'Generate & Print Invoice' saves the bill into SQLite and renders a print-optimized invoice ready for PDF download or physical printing."*

---

### 02:10 – 02:45 | Part 4: AI Chatbot & Tricky Part Solved
- **Visual:** Open AuraBot floating chat widget.
  - Type Hinglish query: `"Bhai haircut kitne ka hai aur salon kab tak khula hai?"` &rarr; show natural Hinglish answer quoting ₹200 and 9 AM - 8 PM timings.
  - Test out-of-scope refusal: `"Can you do pizza home delivery?"` &rarr; show graceful refusal.
- **Spoken Script:**
  > *"Lastly, our AI Chatbot concierge, AuraBot. It doesn't rely on hardcoded text that can go stale; it dynamically injects the live SQLite catalog into its prompt. It handles Hinglish and Marathi naturally, and gracefully refuses out-of-scope questions like food delivery.*  
  > **The tricky technical challenge:** *Preventing double-booking race conditions between the customer booking form, the in-chat AI booking assistant, and manual admin reschedules. I solved this with a two-tier defense: client-side dynamic slot filtering, coupled with strict server-side transaction validation in `isSlotBooked()` that returns a `409 Conflict` before any write occurs.  
  > Thank you for reviewing, and I look forward to the live follow-up round!"*
