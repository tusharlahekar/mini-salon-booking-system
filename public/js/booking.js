// Customer Booking Client Logic
let servicesData = [];
let servicesMap = {};
let selectedSlot = '';

document.addEventListener('DOMContentLoaded', () => {
  initDateConstraints();
  loadServices();
  setupEventListeners();
});

// 1. Initialize Date input: disable past dates
function initDateConstraints() {
  const dateInput = document.getElementById('booking-date');
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today; // default to today
}

// 2. Load Services from backend API
async function loadServices() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success && data.services) {
      servicesData = data.services;
      servicesMap = {};
      servicesData.forEach(s => { servicesMap[s.name] = s; });

      renderServiceCards(servicesData);
      populateServiceDropdown(servicesData);

      // Now load available slots for today's default date
      const dateInput = document.getElementById('booking-date');
      if (dateInput.value) {
        loadAvailableSlots(dateInput.value);
      }
    }
  } catch (err) {
    console.error('Failed to load services:', err);
  }
}

// 3. Render service cards in the showcase section
function renderServiceCards(services) {
  const container = document.getElementById('services-cards-container');
  if (!container) return;

  container.innerHTML = services.map(s => `
    <div class="service-card">
      <div>
        <div class="service-meta-top">
          <span class="service-duration-badge">⏱ ${s.duration} mins</span>
          <span style="color: var(--gold-primary); font-size: 0.95rem;">★ Luxury</span>
        </div>
        <h3 class="service-name">${s.name}</h3>
        <p class="service-desc">${s.description || 'Exclusive luxury treatment with consultation.'}</p>
      </div>
      <div class="service-card-footer">
        <span class="service-price">₹${s.price}</span>
        <button type="button" class="btn-select-service" onclick="quickSelectService('${s.name}')">
          Book This &rarr;
        </button>
      </div>
    </div>
  `).join('');
}

// 4. Populate Service Dropdown
function populateServiceDropdown(services) {
  const select = document.getElementById('booking-service');
  if (!select) return;

  select.innerHTML = '<option value="">-- Choose your service --</option>' +
    services.map(s => `
      <option value="${s.name}" data-price="${s.price}" data-duration="${s.duration}">
        ${s.name} — ₹${s.price} (${s.duration} min)
      </option>
    `).join('');
}

// Quick select helper from service cards
window.quickSelectService = function(serviceName) {
  const select = document.getElementById('booking-service');
  if (select) {
    select.value = serviceName;
    select.dispatchEvent(new Event('change'));
    document.getElementById('booking-section').scrollIntoView({ behavior: 'smooth' });
  }
};

// 5. Setup Event Listeners
function setupEventListeners() {
  const serviceSelect = document.getElementById('booking-service');
  const livePriceLabel = document.getElementById('label-live-price');
  const priceBadge = document.getElementById('service-price-badge');
  const dateInput = document.getElementById('booking-date');
  const form = document.getElementById('appointment-form');

  // Service change -> live price update
  serviceSelect.addEventListener('change', () => {
    const sName = serviceSelect.value;
    if (sName && servicesMap[sName]) {
      const s = servicesMap[sName];
      livePriceLabel.textContent = `₹${s.price} (${s.duration} mins)`;
      livePriceLabel.style.display = 'inline-block';
      priceBadge.textContent = `₹${s.price}`;
      priceBadge.style.display = 'inline-block';
    } else {
      livePriceLabel.style.display = 'none';
      priceBadge.style.display = 'none';
    }
  });

  // Date change -> dynamic slot lookup
  dateInput.addEventListener('change', () => {
    const chosenDate = dateInput.value;
    if (chosenDate) {
      loadAvailableSlots(chosenDate);
    }
  });

  // Form submission
  form.addEventListener('submit', handleBookingSubmit);

  // Modal close buttons
  document.getElementById('btn-close-confirmation')?.addEventListener('click', closeConfirmationModal);
  document.getElementById('btn-done-booking')?.addEventListener('click', closeConfirmationModal);
  
  // Lookup modal
  document.getElementById('btn-open-lookup')?.addEventListener('click', openLookupModal);
  document.getElementById('btn-quick-manage')?.addEventListener('click', openLookupModal);
  document.getElementById('btn-close-lookup')?.addEventListener('click', closeLookupModal);
  document.getElementById('btn-search-lookup')?.addEventListener('click', handleLookupSearch);
  
  // Hero chat trigger
  document.getElementById('hero-chat-trigger')?.addEventListener('click', () => {
    const chatWin = document.getElementById('chatbot-window');
    chatWin.classList.add('open');
    document.getElementById('chat-user-input')?.focus();
  });
}

// 6. Dynamic Slot Availability calculation
async function loadAvailableSlots(date) {
  const slotsGrid = document.getElementById('slots-grid');
  const slotLegend = document.getElementById('slot-legend');
  const statusText = document.getElementById('slot-status-text');

  slotsGrid.innerHTML = '<div style="grid-column: 1/-1; color: var(--gold-light); font-size: 0.85rem;">Checking live schedule...</div>';
  selectedSlot = '';
  document.getElementById('selected-time-slot').value = '';

  try {
    const res = await fetch(`/api/available-slots?date=${encodeURIComponent(date)}`);
    const data = await res.json();

    if (!data.success) {
      slotsGrid.innerHTML = `<div style="grid-column: 1/-1; color: #ef4444; font-size: 0.85rem;">${data.error || 'Unable to check slots.'}</div>`;
      return;
    }

    const { allSlots, bookedSlots, availableSlots } = data;
    slotLegend.style.display = 'flex';
    statusText.textContent = `${availableSlots.length} slots available on this date`;

    slotsGrid.innerHTML = allSlots.map(slot => {
      const isBooked = bookedSlots.includes(slot);
      if (isBooked) {
        return `<button type="button" class="slot-btn booked" disabled title="Slot already booked">${slot}</button>`;
      } else {
        return `<button type="button" class="slot-btn" onclick="selectSlot('${slot}', this)">${slot}</button>`;
      }
    }).join('');
  } catch (err) {
    slotsGrid.innerHTML = '<div style="grid-column: 1/-1; color: #ef4444;">Failed to connect to slot server.</div>';
  }
}

// Select a time slot
window.selectSlot = function(slot, btnElement) {
  selectedSlot = slot;
  document.getElementById('selected-time-slot').value = slot;

  // Visual highlight
  const allBtns = document.querySelectorAll('.slot-btn');
  allBtns.forEach(b => b.classList.remove('selected'));
  if (btnElement) {
    btnElement.classList.add('selected');
  }
};

// 7. Handle Appointment Booking Form Submit
async function handleBookingSubmit(e) {
  e.preventDefault();
  const alertContainer = document.getElementById('form-alert');
  alertContainer.style.display = 'none';

  const name = document.getElementById('booking-name').value.trim();
  const phone = document.getElementById('booking-phone').value.trim();
  const service = document.getElementById('booking-service').value;
  const date = document.getElementById('booking-date').value;
  const time = document.getElementById('selected-time-slot').value;
  const notes = document.getElementById('booking-notes').value.trim();

  // Client-side validations
  if (!name) {
    showAlert('Please enter your full name.', 'error');
    return;
  }
  if (!phone || phone.replace(/\D/g, '').length !== 10) {
    showAlert('Please enter a valid 10-digit mobile number.', 'error');
    return;
  }
  if (!service) {
    showAlert('Please select a service from the list.', 'error');
    return;
  }
  if (!date) {
    showAlert('Please choose an appointment date.', 'error');
    return;
  }
  const today = new Date().toISOString().split('T')[0];
  if (date < today) {
    showAlert('You cannot book an appointment in the past.', 'error');
    return;
  }
  if (!time) {
    showAlert('Please select one of the available time slots.', 'error');
    return;
  }

  const submitBtn = document.getElementById('btn-submit-booking');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Securing Your Slot...';

  try {
    const res = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        phone,
        service,
        date,
        time,
        notes
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      showAlert(data.error || 'Booking failed. Slot may already be taken.', 'error');
      // Re-fetch slots to update state immediately
      loadAvailableSlots(date);
      return;
    }

    // Success! Show confirmation modal
    showConfirmationModal(data.booking, data.serviceDetails);

    // Reset form
    document.getElementById('appointment-form').reset();
    document.getElementById('selected-time-slot').value = '';
    initDateConstraints();
    // Refresh slots
    loadAvailableSlots(date);
  } catch (err) {
    showAlert('Network error: ' + err.message, 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Confirm Booking &amp; Lock Slot';
  }
}

function showAlert(message, type = 'error') {
  const alertContainer = document.getElementById('form-alert');
  alertContainer.className = `alert alert-${type}`;
  alertContainer.innerHTML = `<span>${type === 'error' ? '⚠️' : '✓'}</span> <span>${message}</span>`;
  alertContainer.style.display = 'flex';
  alertContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// 8. Confirmation Modal
function showConfirmationModal(booking, serviceDetails) {
  const modal = document.getElementById('confirmation-modal');
  
  // Format readable date e.g. "Oct 21, 2026"
  const dateObj = new Date(booking.date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Exact requirement: "Your booking is confirmed for 4:00 PM, Oct 21"
  document.getElementById('confirmation-headline').textContent = 
    `Your booking is confirmed for ${booking.time}, ${formattedDate}`;

  document.getElementById('conf-id').textContent = `#${booking.id}`;
  document.getElementById('conf-name').textContent = booking.customer_name;
  document.getElementById('conf-phone').textContent = booking.phone;
  document.getElementById('conf-service').textContent = booking.service;
  document.getElementById('conf-datetime').textContent = `${booking.time} &bull; ${formattedDate}`;
  
  const price = serviceDetails ? serviceDetails.price : (servicesMap[booking.service]?.price || 0);
  document.getElementById('conf-price').textContent = `₹${price}`;

  modal.classList.add('active');
}

function closeConfirmationModal() {
  document.getElementById('confirmation-modal').classList.remove('active');
}

// 9. Customer Lookup & Reschedule / Cancel
function openLookupModal() {
  document.getElementById('lookup-modal').classList.add('active');
}

function closeLookupModal() {
  document.getElementById('lookup-modal').classList.remove('active');
}

async function handleLookupSearch() {
  const phone = document.getElementById('lookup-phone-input').value.trim();
  const resultsContainer = document.getElementById('lookup-results-container');

  if (!phone || phone.length !== 10) {
    resultsContainer.innerHTML = '<div style="color: #ef4444; padding: 1rem;">Please enter a valid 10-digit phone number.</div>';
    return;
  }

  resultsContainer.innerHTML = '<div style="color: var(--text-muted); padding: 1rem;">Searching bookings...</div>';

  try {
    const res = await fetch(`/api/bookings/lookup?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();

    if (!data.success || data.bookings.length === 0) {
      resultsContainer.innerHTML = '<div style="color: var(--text-muted); padding: 1.5rem; text-align: center;">No appointments found under this phone number.</div>';
      return;
    }

    resultsContainer.innerHTML = data.bookings.map(b => `
      <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <strong style="color: #fff;">#${b.id} &bull; ${b.service}</strong>
          <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
        </div>
        <div style="font-size: 0.85rem; color: var(--gold-light); margin-bottom: 0.75rem;">
          📅 ${b.date} &bull; ⏰ ${b.time}
        </div>
        ${b.status !== 'Cancelled' && b.status !== 'Done' ? `
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-outline btn-sm" onclick="promptReschedule(${b.id}, '${b.date}', '${b.time}')">
              Reschedule
            </button>
            <button type="button" class="btn btn-outline btn-sm" style="color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="cancelCustomerBooking(${b.id})">
              Cancel
            </button>
          </div>
        ` : ''}
      </div>
    `).join('');
  } catch (err) {
    resultsContainer.innerHTML = `<div style="color: #ef4444; padding: 1rem;">Error: ${err.message}</div>`;
  }
}

// Cancel booking customer-side
window.cancelCustomerBooking = async function(bookingId) {
  if (!confirm(`Are you sure you want to cancel booking #${bookingId}?`)) return;

  try {
    const res = await fetch(`/api/bookings/${bookingId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert('Booking has been cancelled.');
      handleLookupSearch();
      // refresh slots if current date matches
      const dateInput = document.getElementById('booking-date');
      if (dateInput.value) loadAvailableSlots(dateInput.value);
    } else {
      alert(data.error || 'Could not cancel booking.');
    }
  } catch (err) {
    alert('Error cancelling booking: ' + err.message);
  }
};

// Reschedule booking customer-side
window.promptReschedule = async function(bookingId, currentDate, currentTime) {
  const newDate = prompt('Enter new date (YYYY-MM-DD):', currentDate);
  if (!newDate) return;

  const today = new Date().toISOString().split('T')[0];
  if (newDate < today) {
    alert('Cannot reschedule to a past date.');
    return;
  }

  const newTime = prompt('Enter new slot (e.g. 11:00 AM, 02:30 PM, 04:00 PM):', currentTime);
  if (!newTime) return;

  try {
    const res = await fetch(`/api/bookings/${bookingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, time: newTime })
    });
    const data = await res.json();
    if (data.success) {
      alert(`Booking #${bookingId} successfully rescheduled to ${newDate} at ${newTime}!`);
      handleLookupSearch();
      // refresh slots
      const dateInput = document.getElementById('booking-date');
      if (dateInput.value) loadAvailableSlots(dateInput.value);
    } else {
      alert(data.error || 'Failed to reschedule.');
    }
  } catch (err) {
    alert('Network error while rescheduling: ' + err.message);
  }
};
