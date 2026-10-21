// Admin Dashboard Script
let allSalonSlots = [
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

let currentBookings = [];
let currentView = 'list'; // 'list' or 'calendar'

document.addEventListener('DOMContentLoaded', () => {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('admin-filter-date').value = today;

  setupAdminEventListeners();
  loadAdminBookings();
});

function setupAdminEventListeners() {
  const dateInput = document.getElementById('admin-filter-date');
  const statusSelect = document.getElementById('admin-filter-status');
  const searchInput = document.getElementById('admin-search-input');
  const btnToday = document.getElementById('btn-quick-today');
  const btnClearDate = document.getElementById('btn-clear-date');

  const tabList = document.getElementById('tab-btn-list');
  const tabCalendar = document.getElementById('tab-btn-calendar');

  dateInput.addEventListener('change', loadAdminBookings);
  statusSelect.addEventListener('change', loadAdminBookings);
  searchInput.addEventListener('input', debounce(loadAdminBookings, 300));

  btnToday.addEventListener('click', () => {
    dateInput.value = new Date().toISOString().split('T')[0];
    loadAdminBookings();
  });

  btnClearDate.addEventListener('click', () => {
    dateInput.value = '';
    loadAdminBookings();
  });

  tabList.addEventListener('click', () => switchView('list'));
  tabCalendar.addEventListener('click', () => switchView('calendar'));
}

function switchView(view) {
  currentView = view;
  const viewList = document.getElementById('view-list');
  const viewCalendar = document.getElementById('view-calendar');
  const tabList = document.getElementById('tab-btn-list');
  const tabCalendar = document.getElementById('tab-btn-calendar');

  if (view === 'list') {
    viewList.style.display = 'block';
    viewCalendar.style.display = 'none';
    tabList.className = 'btn btn-gold btn-sm';
    tabCalendar.className = 'btn btn-outline btn-sm';
  } else {
    viewList.style.display = 'none';
    viewCalendar.style.display = 'block';
    tabList.className = 'btn btn-outline btn-sm';
    tabCalendar.className = 'btn btn-gold btn-sm';
    renderCalendarTimeline(currentBookings);
  }
}

// Fetch bookings with filters
async function loadAdminBookings() {
  const dateVal = document.getElementById('admin-filter-date').value;
  const statusVal = document.getElementById('admin-filter-status').value;
  const searchVal = document.getElementById('admin-search-input').value.trim();

  let url = `/api/bookings?`;
  const params = [];
  if (dateVal) params.push(`date=${encodeURIComponent(dateVal)}`);
  if (statusVal && statusVal !== 'All') params.push(`status=${encodeURIComponent(statusVal)}`);
  if (searchVal) params.push(`search=${encodeURIComponent(searchVal)}`);

  url += params.join('&');

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      currentBookings = data.bookings;
      renderBookingsTable(currentBookings);
      updateMetrics(currentBookings);
      if (currentView === 'calendar') {
        renderCalendarTimeline(currentBookings);
      }
    }
  } catch (err) {
    console.error('Error loading bookings:', err);
  }
}

// Calculate and render live metric counts
function updateMetrics(bookings) {
  const today = new Date().toISOString().split('T')[0];
  const todayBookings = bookings.filter(b => b.date === today);

  document.getElementById('metric-today-count').textContent = todayBookings.length;
  document.getElementById('metric-confirmed-count').textContent = bookings.filter(b => b.status === 'Confirmed').length;
  document.getElementById('metric-pending-count').textContent = bookings.filter(b => b.status === 'Pending').length;
  document.getElementById('metric-done-count').textContent = bookings.filter(b => b.status === 'Done').length;
}

// Render Bookings Table (List View)
function renderBookingsTable(bookings) {
  const tbody = document.getElementById('bookings-table-body');
  if (bookings.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">
          No bookings matching your criteria found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td style="font-weight: 600; color: var(--gold-light);">#${b.id}</td>
      <td style="font-weight: 500; color: #fff;">${b.customer_name}</td>
      <td>
        <a href="tel:${b.phone}" style="color: var(--text-secondary);">${b.phone}</a>
      </td>
      <td>
        <span style="font-weight: 500;">${b.service}</span>
      </td>
      <td>
        <div>${b.date}</div>
        <div style="font-size: 0.8rem; color: var(--gold-primary); font-weight: 600;">${b.time}</div>
      </td>
      <td>
        <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
      </td>
      <td>
        <select class="form-control" style="width: auto; padding: 0.35rem 1.8rem 0.35rem 0.6rem; font-size: 0.82rem;" onchange="changeBookingStatus(${b.id}, this.value)">
          <option value="Pending" ${b.status === 'Pending' ? 'selected' : ''}>Pending</option>
          <option value="Confirmed" ${b.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
          <option value="Done" ${b.status === 'Done' ? 'selected' : ''}>Done</option>
          <option value="Cancelled" ${b.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
        </select>
      </td>
      <td>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline btn-sm" onclick="rescheduleAdminPrompt(${b.id}, '${b.date}', '${b.time}')" title="Reschedule">
            Reschedule
          </button>
          <a href="/billing.html?name=${encodeURIComponent(b.customer_name)}&phone=${encodeURIComponent(b.phone)}&service=${encodeURIComponent(b.service)}" class="btn btn-gold btn-sm" title="Generate Bill for this customer">
            Bill 🧾
          </a>
        </div>
      </td>
    </tr>
  `).join('');
}

// Render Calendar / Day Timeline View (Grouped by date/time)
function renderCalendarTimeline(bookings) {
  const container = document.getElementById('timeline-container');
  const dateInput = document.getElementById('admin-filter-date');
  const targetDate = dateInput.value || new Date().toISOString().split('T')[0];

  document.getElementById('calendar-day-label').textContent = targetDate;

  // Filter bookings for this day
  const dayBookings = bookings.filter(b => b.date === targetDate && b.status !== 'Cancelled');

  container.innerHTML = allSalonSlots.map(slot => {
    // Check if any booking is in this slot
    const slotBookings = dayBookings.filter(b => b.time === slot);

    let eventCardsHtml = '';
    if (slotBookings.length > 0) {
      eventCardsHtml = slotBookings.map(b => `
        <div class="timeline-event-card">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <strong style="color: #fff; font-size: 0.95rem;">${b.customer_name}</strong>
            <span class="status-badge ${b.status.toLowerCase()}">${b.status}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--gold-light);">
            ✂️ ${b.service} &bull; 📞 ${b.phone}
          </div>
          <div style="margin-top: 0.5rem; display: flex; gap: 0.4rem;">
            <button type="button" class="btn btn-outline btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="changeBookingStatus(${b.id}, 'Done')">
              Mark Done
            </button>
            <a href="/billing.html?name=${encodeURIComponent(b.customer_name)}&phone=${encodeURIComponent(b.phone)}&service=${encodeURIComponent(b.service)}" class="btn btn-gold btn-sm" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;">
              Invoice
            </a>
          </div>
        </div>
      `).join('');
    } else {
      eventCardsHtml = `<div class="timeline-event-card empty">Available chair / slot free</div>`;
    }

    return `
      <div class="timeline-slot-row">
        <div class="timeline-time-label">${slot}</div>
        <div class="timeline-events-container">
          ${eventCardsHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Update status via PATCH /api/bookings/:id
window.changeBookingStatus = async function(id, newStatus) {
  try {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      loadAdminBookings();
    } else {
      alert(data.error || 'Failed to update status.');
    }
  } catch (err) {
    alert('Error updating status: ' + err.message);
  }
};

// Reschedule dialog
window.rescheduleAdminPrompt = async function(id, currentDate, currentTime) {
  const newDate = prompt('Reschedule to date (YYYY-MM-DD):', currentDate);
  if (!newDate) return;
  const newTime = prompt('Reschedule to time slot (e.g. 10:00 AM, 03:30 PM):', currentTime);
  if (!newTime) return;

  try {
    const res = await fetch(`/api/bookings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate, time: newTime })
    });
    const data = await res.json();
    if (data.success) {
      alert('Booking successfully rescheduled!');
      loadAdminBookings();
    } else {
      alert(data.error || 'Conflict or reschedule error.');
    }
  } catch (err) {
    alert('Network error: ' + err.message);
  }
};

// Utility debounce
function debounce(fn, delay) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}
