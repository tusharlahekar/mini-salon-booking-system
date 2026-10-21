// Billing POS Script
let allServices = [];
let selectedServices = [];

document.addEventListener('DOMContentLoaded', () => {
  setupBillingEventListeners();
  loadServicesAndParams();
  loadPastInvoices();
});

function setupBillingEventListeners() {
  document.getElementById('pos-discount').addEventListener('input', calculateTotals);
  document.getElementById('pos-tax').addEventListener('input', calculateTotals);
  document.getElementById('btn-generate-invoice').addEventListener('click', handleGenerateInvoice);
  
  document.getElementById('btn-back-to-billing')?.addEventListener('click', () => {
    document.getElementById('invoice-preview-container').style.display = 'none';
    document.getElementById('billing-form-layout').style.display = 'grid';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// 1. Load services from backend and inspect URL query params
async function loadServicesAndParams() {
  try {
    const res = await fetch('/api/services');
    const data = await res.json();
    if (data.success && data.services) {
      allServices = data.services;
      renderServicesChecklist(allServices);

      // Check URL parameters (e.g. from Admin "Bill this customer")
      const params = new URLSearchParams(window.location.search);
      const paramName = params.get('name');
      const paramPhone = params.get('phone');
      const paramService = params.get('service');

      if (paramName) document.getElementById('pos-customer-name').value = paramName;
      if (paramPhone) document.getElementById('pos-customer-phone').value = paramPhone;

      if (paramService) {
        // Find and check matching service checkbox
        const checkbox = document.querySelector(`input[data-service-name="${CSS.escape(paramService)}"]`);
        if (checkbox) {
          checkbox.checked = true;
          handleServiceToggle(paramService, true);
        }
      }
    }
  } catch (err) {
    console.error('Failed to load services for POS:', err);
  }
}

// 2. Render Services Checklist
function renderServicesChecklist(services) {
  const container = document.getElementById('services-checklist');
  container.innerHTML = services.map(s => `
    <label style="display: flex; justify-content: space-between; align-items: center; padding: 0.6rem 0.8rem; background: rgba(255,255,255,0.03); border-radius: 6px; cursor: pointer; border: 1px solid var(--border-subtle); transition: background 0.15s ease;">
      <div style="display: flex; align-items: center; gap: 0.65rem;">
        <input type="checkbox" data-service-name="${s.name}" data-price="${s.price}" data-duration="${s.duration}" onchange="handleCheckboxChange(this)">
        <span style="color: #fff; font-weight: 500; font-size: 0.9rem;">${s.name}</span>
        <span style="font-size: 0.75rem; color: var(--text-muted);">(${s.duration} min)</span>
      </div>
      <span style="color: var(--gold-light); font-weight: 600; font-size: 0.95rem;">₹${s.price}</span>
    </label>
  `).join('');
}

// Checkbox event
window.handleCheckboxChange = function(cb) {
  const sName = cb.getAttribute('data-service-name');
  const price = parseFloat(cb.getAttribute('data-price'));
  const duration = parseInt(cb.getAttribute('data-duration'), 10);

  handleServiceToggle(sName, cb.checked, price, duration);
};

function handleServiceToggle(sName, isChecked, price, duration) {
  if (isChecked) {
    if (!selectedServices.some(s => s.name === sName)) {
      const match = allServices.find(s => s.name === sName) || { name: sName, price: price || 0, duration: duration || 30 };
      selectedServices.push(match);
    }
  } else {
    selectedServices = selectedServices.filter(s => s.name !== sName);
  }

  renderSelectedSummary();
  calculateTotals();
}

// 3. Render Selected items summary list
function renderSelectedSummary() {
  const container = document.getElementById('selected-items-summary');
  if (selectedServices.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted); font-size: 0.88rem; font-style: italic;">No services selected yet.</p>';
    return;
  }

  container.innerHTML = selectedServices.map(s => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.35rem 0; font-size: 0.88rem; border-bottom: 1px solid rgba(255,255,255,0.04);">
      <span style="color: #fff;">• ${s.name}</span>
      <span style="color: var(--gold-light); font-weight: 500;">₹${s.price}</span>
    </div>
  `).join('');
}

// 4. Calculate Subtotal, Discounts, Tax, and Grand Total
function calculateTotals() {
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('pos-discount').value) || 0);
  const tax = Math.max(0, parseFloat(document.getElementById('pos-tax').value) || 0);

  const grandTotal = Math.max(0, subtotal - discount + tax);

  document.getElementById('pos-subtotal').textContent = `₹${subtotal}`;
  document.getElementById('pos-total').textContent = `₹${grandTotal}`;
}

// 5. Generate & Save Invoice
async function handleGenerateInvoice() {
  const name = document.getElementById('pos-customer-name').value.trim();
  const phone = document.getElementById('pos-customer-phone').value.trim();
  const paymentMethod = document.getElementById('pos-payment-method').value;

  if (!name) {
    alert('Please enter customer name.');
    document.getElementById('pos-customer-name').focus();
    return;
  }

  if (selectedServices.length === 0) {
    alert('Please select at least one service from the checklist.');
    return;
  }

  const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
  const tax = parseFloat(document.getElementById('pos-tax').value) || 0;

  const generateBtn = document.getElementById('btn-generate-invoice');
  generateBtn.disabled = true;
  generateBtn.innerHTML = 'Generating Invoice...';

  try {
    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        services: selectedServices,
        discount,
        tax,
        payment_method: paymentMethod
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || 'Failed to generate invoice.');
      return;
    }

    // Display Invoice Paper
    displayInvoicePaper(data.invoice);
    loadPastInvoices();
  } catch (err) {
    alert('Network error: ' + err.message);
  } finally {
    generateBtn.disabled = false;
    generateBtn.innerHTML = 'Generate &amp; Print Invoice';
  }
}

// 6. Display Clean Printable Invoice
function displayInvoicePaper(invoice) {
  const services = JSON.parse(invoice.services_json || '[]');
  const dateFormatted = new Date(invoice.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  document.getElementById('inv-number-display').textContent = invoice.invoice_number;
  document.getElementById('inv-date-display').textContent = `Date: ${dateFormatted}`;
  document.getElementById('inv-client-name').textContent = invoice.customer_name;
  document.getElementById('inv-client-phone').textContent = invoice.customer_phone || 'Walk-in Guest';
  document.getElementById('inv-payment-mode').textContent = invoice.payment_method;

  // Table rows
  const tbody = document.getElementById('inv-table-body');
  tbody.innerHTML = services.map(s => `
    <tr>
      <td style="font-weight: 500;">${s.name}</td>
      <td style="text-align: center; color: #64748b;">${s.duration || 30} mins</td>
      <td style="text-align: right; font-weight: 600;">₹${s.price}</td>
    </tr>
  `).join('');

  document.getElementById('inv-subtotal-disp').textContent = `₹${invoice.subtotal}`;
  document.getElementById('inv-discount-disp').textContent = `- ₹${invoice.discount}`;
  document.getElementById('inv-tax-disp').textContent = `+ ₹${invoice.tax}`;
  document.getElementById('inv-total-disp').textContent = `₹${invoice.total}`;

  // Switch views
  document.getElementById('billing-form-layout').style.display = 'none';
  document.getElementById('invoice-preview-container').style.display = 'block';
  document.getElementById('invoice-preview-container').scrollIntoView({ behavior: 'smooth' });
}

// 7. Load Past Invoices
async function loadPastInvoices() {
  const tbody = document.getElementById('past-invoices-tbody');
  try {
    const res = await fetch('/api/invoices');
    const data = await res.json();

    if (!data.success || data.invoices.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No invoices saved yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.invoices.map(inv => {
      const dateFormatted = new Date(inv.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      return `
        <tr>
          <td style="font-weight: 600; color: var(--gold-light);">${inv.invoice_number}</td>
          <td style="color: #fff; font-weight: 500;">${inv.customer_name}</td>
          <td>${inv.customer_phone}</td>
          <td style="font-weight: 700; color: #fff;">₹${inv.total}</td>
          <td><span class="status-badge confirmed" style="font-size: 0.75rem;">${inv.payment_method}</span></td>
          <td style="font-size: 0.85rem; color: var(--text-muted);">${dateFormatted}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="color: #ef4444; padding: 1rem;">Failed to load invoices.</td></tr>`;
  }
}
