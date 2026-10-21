const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'salon.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
function initDatabase() {
  // Services table
  db.exec(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      price REAL NOT NULL,
      duration INTEGER NOT NULL, -- in minutes
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Bookings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      service TEXT NOT NULL,
      date TEXT NOT NULL,         -- YYYY-MM-DD
      time TEXT NOT NULL,         -- e.g. "10:00 AM" or "14:00"
      status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Confirmed', 'Done', 'Cancelled'
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Invoices table (for Billing section)
  db.exec(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      services_json TEXT NOT NULL, -- JSON string of selected services [{name, price}]
      subtotal REAL NOT NULL,
      tax REAL NOT NULL DEFAULT 0,
      discount REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL,
      payment_method TEXT DEFAULT 'Cash',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  seedData();
}

// Seed the required 5 services and sample bookings
function seedData() {
  const serviceCount = db.prepare('SELECT COUNT(*) as count FROM services').get().count;
  if (serviceCount === 0) {
    const insertService = db.prepare(`
      INSERT INTO services (name, price, duration, description)
      VALUES (?, ?, ?, ?)
    `);

    const requiredServices = [
      ['Haircut', 200, 30, 'Precision cut tailored to your face shape with wash and styling.'],
      ['Beard Trim', 100, 15, 'Crisp edge shaping, trimming, and conditioning beard oil.'],
      ['Hair Spa', 800, 45, 'Deep nourishing hair mask, steam therapy, and relaxing head massage.'],
      ['Facial', 500, 40, 'Exfoliating glow treatment, pore cleansing, and skin rejuvenation.'],
      ['Bridal Makeup', 5000, 120, 'Luxury bridal HD makeup, hairstyle design, and drape styling.']
    ];

    const insertMany = db.transaction((services) => {
      for (const s of services) insertService.run(...s);
    });
    insertMany(requiredServices);
    console.log('✅ Seeded 5 required salon services.');
  }

  const bookingCount = db.prepare('SELECT COUNT(*) as count FROM bookings').get().count;
  if (bookingCount === 0) {
    const today = new Date().toISOString().split('T')[0];
    
    // Seed 3 sample bookings (Pending, Confirmed, Done)
    const insertBooking = db.prepare(`
      INSERT INTO bookings (customer_name, phone, service, date, time, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const sampleBookings = [
      ['Aarav Sharma', '9876543210', 'Haircut', today, '10:00 AM', 'Confirmed', new Date(Date.now() - 3600000 * 4).toISOString()],
      ['Pooja Kulkarni', '9822012345', 'Hair Spa', today, '11:30 AM', 'Done', new Date(Date.now() - 3600000 * 2).toISOString()],
      ['Vikram Deshmukh', '9765432190', 'Beard Trim', today, '03:00 PM', 'Pending', new Date().toISOString()],
      ['Sneha Patil', '9123456780', 'Facial', today, '04:30 PM', 'Pending', new Date().toISOString()]
    ];

    const insertManyBookings = db.transaction((bookings) => {
      for (const b of bookings) insertBooking.run(...b);
    });
    insertManyBookings(sampleBookings);
    console.log('✅ Seeded sample bookings with Pending, Confirmed, and Done statuses.');
  }
}

// Service queries
function getAllServices() {
  return db.prepare('SELECT * FROM services ORDER BY price ASC').all();
}

function getServiceByName(name) {
  return db.prepare('SELECT * FROM services WHERE LOWER(name) = LOWER(?)').get(name);
}

// Booking queries
function getBookings(filters = {}) {
  let query = 'SELECT * FROM bookings WHERE 1=1';
  const params = [];

  if (filters.date) {
    query += ' AND date = ?';
    params.push(filters.date);
  }

  if (filters.status && filters.status !== 'All') {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters.search) {
    query += ' AND (customer_name LIKE ? OR phone LIKE ? OR service LIKE ?)';
    const s = `%${filters.search}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY date DESC, time ASC';
  return db.prepare(query).all(...params);
}

function getBookingById(id) {
  return db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);
}

function getBookingsByPhone(phone) {
  return db.prepare('SELECT * FROM bookings WHERE phone = ? ORDER BY date DESC, time ASC').all(phone);
}

// Check if a time slot on a given date is already taken by a non-cancelled booking
function isSlotBooked(date, time, excludeId = null) {
  let query = `
    SELECT COUNT(*) as count FROM bookings
    WHERE date = ? AND time = ? AND status != 'Cancelled'
  `;
  const params = [date, time];
  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }
  const result = db.prepare(query).get(...params);
  return result.count > 0;
}

function getBookedSlotsForDate(date) {
  const rows = db.prepare(`
    SELECT time FROM bookings
    WHERE date = ? AND status != 'Cancelled'
  `).all(date);
  return rows.map(r => r.time);
}

function createBooking({ customer_name, phone, service, date, time, notes = '' }) {
  const stmt = db.prepare(`
    INSERT INTO bookings (customer_name, phone, service, date, time, status, notes)
    VALUES (?, ?, ?, ?, ?, 'Pending', ?)
  `);
  const info = stmt.run(customer_name, phone, service, date, time, notes);
  return getBookingById(info.lastInsertRowid);
}

function updateBookingStatus(id, status) {
  const stmt = db.prepare('UPDATE bookings SET status = ? WHERE id = ?');
  stmt.run(status, id);
  return getBookingById(id);
}

function rescheduleBooking(id, date, time) {
  const stmt = db.prepare('UPDATE bookings SET date = ?, time = ?, status = ? WHERE id = ?');
  stmt.run(date, time, 'Confirmed', id);
  return getBookingById(id);
}

function cancelBooking(id) {
  const stmt = db.prepare("UPDATE bookings SET status = 'Cancelled' WHERE id = ?");
  stmt.run(id);
  return getBookingById(id);
}

// Invoices
function createInvoice(invoiceData) {
  const stmt = db.prepare(`
    INSERT INTO invoices (invoice_number, customer_name, customer_phone, services_json, subtotal, tax, discount, total, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(
    invoiceData.invoice_number,
    invoiceData.customer_name,
    invoiceData.customer_phone,
    JSON.stringify(invoiceData.services),
    invoiceData.subtotal,
    invoiceData.tax || 0,
    invoiceData.discount || 0,
    invoiceData.total,
    invoiceData.payment_method || 'Cash'
  );
  return db.prepare('SELECT * FROM invoices WHERE id = ?').get(info.lastInsertRowid);
}

function getInvoices() {
  return db.prepare('SELECT * FROM invoices ORDER BY created_at DESC').all();
}

module.exports = {
  db,
  initDatabase,
  getAllServices,
  getServiceByName,
  getBookings,
  getBookingById,
  getBookingsByPhone,
  isSlotBooked,
  getBookedSlotsForDate,
  createBooking,
  updateBookingStatus,
  rescheduleBooking,
  cancelBooking,
  createInvoice,
  getInvoices
};
