const pay = document.getElementById("pay");
const summary = document.getElementById("payment-summary");
const back = document.getElementById("back");
const confirmation = document.getElementById("confirmation");
function showPayment() {
  const stay = readCheckout();
  const price = stay && quote(stay);
  pay.disabled = true;
  back.href = "booking.html";
  if (!price || !stay.guest || stay.method !== "online" || !["pending", "paid"].includes(stay.status)) {
    summary.textContent = "No current reservation to pay for. Return to booking to choose your stay.";
    return;
  }
  const paid = stay.status === "paid";
  summary.textContent = receipt(stay, price.total, paid ? "Demo payment completed" : "Amount due");
  pay.textContent = paid ? "Payment complete" : "Pay " + money.format(price.total);
  pay.disabled = paid;
  back.href = "booking.html?room=" + encodeURIComponent(stay.room) + (paid ? "" : "&edit=1");
}
pay.addEventListener("click", () => {
  const stay = readCheckout();
  const price = stay && quote(stay);
  if (!price || stay.status !== "pending" || stay.method !== "online" || !stay.guest) { showPayment(); return; }
  try { sessionStorage.setItem(paymentKey, JSON.stringify({ ...stay, status: "paid" })); }
  catch { summary.textContent = "Payment could not be saved. Return to booking and try again."; return; }
  showPayment();
  confirmation.querySelector(".receipt").textContent = receipt(stay, price.total, "Paid online (demo)");
  confirmation.showModal();
});
window.addEventListener("pageshow", showPayment);
