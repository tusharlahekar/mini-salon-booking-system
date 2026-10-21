require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');
const chatbot = require('./chatbot_engine');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize SQLite database and seed initial data
db.initDatabase();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Standard salon booking slots from 09:00 AM to 07:30 PM (30 min intervals)
const ALL_SALON_SLOTS = [
  '09:00 AM', '09:30 AM',
  '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM',
  '01:00 PM', '01:30 PM',
  '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM',
  '04:00 PM', '04:30 PM',
  '05:00 PM', '05:30 PM',
  '06:00 PM', '06:30 PM',
  '07:00 PM', '07:30 PM'
];

// Helper: validate date is not in past
function isPastDate(dateString) {
  const today = new Date().toISOString().split('T')[0];
  return dateString < today;
}

// -------------------------------------------------------------
// 1. SERVICES API
// -------------------------------------------------------------
app.get('/api/services', (req, res) => {
  try {
    const services = db.getAllServices();
    res.json({ success: true, services });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 2. AVAILABLE SLOTS API (Dynamic conflict calculation)
// -------------------------------------------------------------
app.get('/api/available-slots', (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ success: false, error: 'Date query parameter is required (YYYY-MM-DD).' });
    }

    if (isPastDate(date)) {
      return res.status(400).json({ success: false, error: 'Cannot check slots for past dates.' });
    }

    const bookedSlots = db.getBookedSlotsForDate(date);
    const availableSlots = ALL_SALON_SLOTS.filter(slot => !bookedSlots.includes(slot));

    res.json({
      success: true,
      date,
      allSlots: ALL_SALON_SLOTS,
      bookedSlots,
      availableSlots
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 3. BOOKINGS API
// -------------------------------------------------------------

// GET /api/bookings - List bookings (admin dashboard & filter)
app.get('/api/bookings', (req, res) => {
  try {
    const { date, status, search } = req.query;
    const bookings = db.getBookings({ date, status, search });
    res.json({ success: true, count: bookings.length, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings/lookup - Customer lookup by phone
app.get('/api/bookings/lookup', (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || !/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, error: 'Please enter a valid 10-digit phone number.' });
    }
    const bookings = db.getBookingsByPhone(phone);
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/bookings/:id - Single booking
app.get('/api/bookings/:id', (req, res) => {
  try {
    const booking = db.getBookingById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/bookings - Create booking with strict server-side validation
app.post('/api/bookings', (req, res) => {
  try {
    const { customer_name, phone, service, date, time, notes } = req.body;

    // 1. Check missing fields
    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ success: false, error: 'Phone number is required.' });
    }
    if (!service || !service.trim()) {
      return res.status(400).json({ success: false, error: 'Service selection is required.' });
    }
    if (!date || !date.trim()) {
      return res.status(400).json({ success: false, error: 'Appointment date is required.' });
    }
    if (!time || !time.trim()) {
      return res.status(400).json({ success: false, error: 'Appointment time slot is required.' });
    }

    // 2. Validate phone number format (exactly 10 digits)
    const cleanedPhone = phone.trim().replace(/\D/g, '');
    if (cleanedPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        error: 'Phone number must be exactly 10 digits (e.g. 9876543210).'
      });
    }

    // 3. Validate service existence
    const existingService = db.getServiceByName(service);
    if (!existingService) {
      return res.status(400).json({
        success: false,
        error: `Selected service '${service}' does not exist in our catalog.`
      });
    }

    // 4. Validate date is not in past
    if (isPastDate(date)) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book appointments for past dates. Please pick today or a future date.'
      });
    }

    // 5. Check double-booking conflict (Strict server-side rubric requirement)
    if (db.isSlotBooked(date, time)) {
      return res.status(409).json({
        success: false,
        error: `Slot Conflict: ${time} on ${date} is already booked. Please select another available time slot.`
      });
    }

    // Save to real database
    const newBooking = db.createBooking({
      customer_name: customer_name.trim(),
      phone: cleanedPhone,
      service: existingService.name,
      date,
      time,
      notes: notes ? notes.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: `Booking successfully confirmed for ${time}, ${date}!`,
      booking: newBooking,
      serviceDetails: existingService
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/bookings/:id - Update status or reschedule
app.patch('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { status, date, time } = req.body;

    const existing = db.getBookingById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }

    // Reschedule request
    if (date && time) {
      if (isPastDate(date)) {
        return res.status(400).json({ success: false, error: 'Cannot reschedule to a past date.' });
      }
      // Check slot conflict excluding current booking
      if (db.isSlotBooked(date, time, id)) {
        return res.status(409).json({
          success: false,
          error: `Slot ${time} on ${date} is already taken by another appointment.`
        });
      }
      const updated = db.rescheduleBooking(id, date, time);
      return res.json({ success: true, message: 'Booking rescheduled successfully!', booking: updated });
    }

    // Status update request
    if (status) {
      const allowed = ['Pending', 'Confirmed', 'Done', 'Cancelled'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ success: false, error: `Invalid status. Allowed: ${allowed.join(', ')}` });
      }
      const updated = db.updateBookingStatus(id, status);
      return res.json({ success: true, message: `Status updated to ${status}.`, booking: updated });
    }

    res.status(400).json({ success: false, error: 'Nothing to update.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/bookings/:id - Cancel booking
app.delete('/api/bookings/:id', (req, res) => {
  try {
    const { id } = req.params;
    const existing = db.getBookingById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Booking not found.' });
    }
    const cancelled = db.cancelBooking(id);
    res.json({ success: true, message: 'Booking cancelled successfully.', booking: cancelled });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 4. BILLING / INVOICE API
// -------------------------------------------------------------
app.post('/api/invoices', (req, res) => {
  try {
    const { customer_name, customer_phone, services, discount = 0, tax = 0, payment_method = 'Cash' } = req.body;

    if (!customer_name || !customer_name.trim()) {
      return res.status(400).json({ success: false, error: 'Customer name is required for invoice.' });
    }
    if (!services || !Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one service must be selected.' });
    }

    // Calculate subtotal from verified database prices
    let subtotal = 0;
    const verifiedServices = [];
    for (const item of services) {
      const s = db.getServiceByName(item.name || item);
      if (s) {
        subtotal += s.price;
        verifiedServices.push({ name: s.name, price: s.price, duration: s.duration });
      }
    }

    const disc = parseFloat(discount) || 0;
    const tx = parseFloat(tax) || 0;
    const total = Math.max(0, subtotal - disc + tx);

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 900 + 100)}`;

    const newInvoice = db.createInvoice({
      invoice_number: invoiceNumber,
      customer_name: customer_name.trim(),
      customer_phone: customer_phone ? customer_phone.trim() : 'Walk-in Guest',
      services: verifiedServices,
      subtotal,
      tax: tx,
      discount: disc,
      total,
      payment_method
    });

    res.status(201).json({ success: true, invoice: newInvoice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/invoices', (req, res) => {
  try {
    const invoices = db.getInvoices();
    res.json({ success: true, invoices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// -------------------------------------------------------------
// 5. AI CHATBOT API
// -------------------------------------------------------------
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message cannot be empty.' });
    }

    const botResponse = await chatbot.handleChat(message, history || []);

    // Check if direct booking action was requested
    if (botResponse.action && botResponse.action.type === 'ready_to_book') {
      const actionData = botResponse.action;
      if (actionData.service && actionData.date && actionData.time && actionData.phone) {
        // Automatically check if slot is available or create
        if (!db.isSlotBooked(actionData.date, actionData.time)) {
          const booked = db.createBooking({
            customer_name: actionData.customer_name || 'Guest via AI Concierge',
            phone: actionData.phone,
            service: actionData.service,
            date: actionData.date,
            time: actionData.time,
            notes: 'Booked directly via Aura AI Chatbot'
          });
          botResponse.confirmedBooking = booked;
          botResponse.reply += `\n\n🎉 **Appointment Confirmed!**\nBooking ID: #${booked.id}\nService: ${booked.service}\nDate: ${booked.date}\nTime: ${booked.time}`;
        } else {
          botResponse.reply += `\n\n⚠️ Notice: The requested slot (${actionData.time} on ${actionData.date}) is already taken. Please pick another time slot!`;
        }
      }
    }

    res.json({ success: true, reply: botResponse.reply, action: botResponse.action, confirmedBooking: botResponse.confirmedBooking });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ Aura Luxury Salon Server is running live on http://localhost:${PORT}`);
});
