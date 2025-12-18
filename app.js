const SUPABASE_URL = "https://sgmyhixzsaubtsjysqmp.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNnbXloaXh6c2F1YnRzanlzcW1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwNTg1MjYsImV4cCI6MjA4MTYzNDUyNn0.3tAMjS21nU-oebRA1Rt2K6Ap0jqTonqSQ7PkvHgmD3Y";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { jsPDF } = window.jspdf;

const itemsContainer = document.getElementById("itemsContainer");
const subtotalEl = document.getElementById("subtotal");
const gstEl = document.getElementById("gst");
const grandTotalEl = document.getElementById("grandTotal");

// Add first item row by default
addItemRow();

document.getElementById("addItemBtn").addEventListener("click", addItemRow);

function addItemRow() {
  const row = document.createElement("div");
  row.className = "item-row";

  const descInput = document.createElement("input");
  descInput.type = "text";
  descInput.placeholder = "Description";

  const amountInput = document.createElement("input");
  amountInput.type = "number";
  amountInput.placeholder = "Amount (PGK)";
  amountInput.step = "0.01";
  amountInput.min = "0";

  // Recalculate totals when amount changes
  amountInput.addEventListener("input", calculateTotals);

  row.appendChild(descInput);
  row.appendChild(amountInput);

  itemsContainer.appendChild(row);
}

function calculateTotals() {
  const rows = document.querySelectorAll("#itemsContainer .item-row");
  let subtotal = 0;

  rows.forEach(row => {
    const amount = parseFloat(row.children[1].value) || 0;
    subtotal += amount;
  });

  const gst = subtotal * 0.1;
  const grandTotal = subtotal + gst;

  subtotalEl.textContent = subtotal.toFixed(2);
  gstEl.textContent = gst.toFixed(2);
  grandTotalEl.textContent = grandTotal.toFixed(2);
}

// Update totals initially
calculateTotals();

document.getElementById("invoiceForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  // Gather basic info
  const client_name = document.getElementById("client_name").value;
  const attention = document.getElementById("attention").value;
  const client_email = document.getElementById("client_email").value;
  const invoice_subject = document.getElementById("invoice_subject").value;

  // Gather items
  const rows = document.querySelectorAll("#itemsContainer .item-row");
  const items = [];
  let subtotal = 0;
  rows.forEach(row => {
    const desc = row.children[0].value;
    const amount = parseFloat(row.children[1].value) || 0;
    if(desc) items.push({ desc, amount });
    subtotal += amount;
  });

  const gst = subtotal * 0.1;
  const grandTotal = subtotal + gst;

  // Call Supabase RPC to save invoice (amount = grandTotal)
  const { data, error } = await supabaseClient.rpc("create_invoice", {
    client_name,
    client_email,
    description: invoice_subject,
    amount: grandTotal
  });

  if(error) {
    console.error(error);
    alert("Failed to create invoice");
    return;
  }

  const invoiceNumber = data[0].invoice_number;

  // Populate PDF template
  const invoiceElement = document.getElementById("invoiceTemplate");
  document.getElementById("pdfInvoiceNumber").textContent = `INV-${invoiceNumber}`;
  document.getElementById("pdfDate").textContent = new Date().toLocaleDateString();
  document.getElementById("pdfClientName").textContent = client_name;
  document.getElementById("pdfAttention").textContent = attention;
  document.getElementById("pdfClientEmail").textContent = client_email;
  document.getElementById("pdfSubject").textContent = invoice_subject;

  // Populate items table
  const tbody = document.querySelector("#pdfItemsTable tbody");
  tbody.innerHTML = "";
  items.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${item.desc}</td><td>${item.amount.toFixed(2)}</td>`;
    tbody.appendChild(tr);
  });

  document.getElementById("pdfSubtotal").textContent = subtotal.toFixed(2);
  document.getElementById("pdfGst").textContent = gst.toFixed(2);
  document.getElementById("pdfGrandTotal").textContent = grandTotal.toFixed(2);

  // Show template and generate PDF
  invoiceElement.style.display = "block";
  html2canvas(invoiceElement, { scale: 2 }).then(canvas => {
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgProps = pdf.getImageProperties(imgData);
    const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, imgHeight);
    pdf.save(`Invoice-INV-${invoiceNumber}.pdf`);
    invoiceElement.style.display = "none";
    // ---- RESET FORM AND ITEMS ----
document.getElementById("invoiceForm").reset();
itemsContainer.innerHTML = "";
addItemRow(); // Add a single empty item row
subtotalEl.textContent = "0.00";
gstEl.textContent = "0.00";
grandTotalEl.textContent = "0.00";
  });
});
