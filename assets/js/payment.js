const pay = document.getElementById("pay");
const summary = document.getElementById("payment-summary");
const back = document.getElementById("back");
const confirmation = document.getElementById("confirmation");
const paymentMessage = document.getElementById("payment-message");
let checkout = null;
let paying = false;
let paymentView = 0;
dismissOnBackdrop(confirmation, () => !paying);

function showSaved(booking) {
  clearBookingForm();
  summary.textContent = bookingReceipt(booking, booking.rooms?.name || checkout?.roomName || "Room");
  pay.textContent = "Booking saved";
  pay.disabled = true;
}
async function showPayment() {
  const view = ++paymentView;
  pay.disabled = true;
  checkout = null;
  summary.textContent = "Loading your reservation…";
  paymentMessage.textContent = "";
  try {
    const user = await currentUser();
    const draft = readCheckout();
    if (!draft || draft.userId !== user.id || draft.method !== "online") {
      summary.textContent = "No current reservation for this account. Return to booking to choose your stay.";
      return;
    }
    const booking = await savedBooking(draft.id);
    if (view !== paymentView) return;
    checkout = draft;
    const formState = readBookingForm();
    back.href = "booking.html?" + (formState?.userId === user.id ? formState.context : "room=" + encodeURIComponent(draft.room));
    if (booking) { showSaved(booking); return; }
    await loadInventory();
    if (view !== paymentView) return;
    const price = quote(draft);
    if (!price) throw new Error("INVALID_BOOKING");
    if (price.rate !== draft.rate) throw new Error("PRICE_CHANGED");
    checkout.roomName = roomFor(draft.room).name;
    summary.textContent = [checkout.roomName + " · " + draft.guest,
      labelDate(draft.arrival) + " → " + labelDate(draft.departure),
      "Total · " + money.format(price.total)].join("\n");
    pay.textContent = "Pay " + money.format(price.total) + " (demo)";
    pay.disabled = false;
  } catch (error) { if (view === paymentView) summary.textContent = bookingError(error); }
}
pay.addEventListener("click", async () => {
  if (paying || !checkout) return;
  paying = true; pay.disabled = true;
  paymentMessage.textContent = "Saving your reservation…";
  try {
    const booking = await createBooking(checkout);
    showSaved(booking);
    paymentMessage.textContent = "";
    confirmation.querySelector(".receipt").textContent = globalThis.HotelI18n ? HotelI18n.originalText(summary) : summary.textContent;
    confirmation.showModal();
  } catch (error) {
    paymentMessage.textContent = bookingError(error);
    pay.disabled = false;
  } finally { paying = false; }
});
document.getElementById("retry-payment").addEventListener("click", () => { if (!paying) showPayment(); });
document.addEventListener("hotel-auth-change", event => {
  if (event.detail.event === "SIGNED_OUT") {
    ++paymentView; checkout = null; pay.disabled = true; confirmation.close();
    summary.textContent = "You have signed out. Sign in and return to booking.";
  }
});
window.addEventListener("pageshow", () => { if (!paying) showPayment(); });
