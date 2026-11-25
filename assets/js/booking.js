const byId = id => document.getElementById(id);
const modal = byId("booking-dialog");
const form = byId("reservation");
const room = byId("room");
const arrival = byId("arrival");
const departure = byId("departure");
const arrivalTime = byId("arrival-time");
const departureTime = byId("departure-time");
const query = new URLSearchParams(location.search);
let days = calendarDays();
let busy = false;
let requestDraft = null;
let formUserId = null;
let opening = false;
let accessVersion = 0;

function rememberForm() {
  if (!formUserId) return;
  try {
    sessionStorage.setItem(bookingFormKey, JSON.stringify({version: 1, userId: formUserId,
      context: query.toString(), open: modal.open, stay: {...stayDetails(), guest: byId("guest").value}}));
  } catch { /* Booking still works when the browser blocks storage. */ }
}
function forgetForm() {
  formUserId = null;
  clearBookingForm();
}
function restoreFields(stay) {
  const changed = !roomFor(stay.room);
  if (!changed) room.value = stay.room;
  updateRoom();
  if (arrivalTimes.includes(stay.arrivalTime)) arrivalTime.value = stay.arrivalTime;
  if (checkoutTimes.includes(stay.departureTime)) departureTime.value = stay.departureTime;
  byId("guest").value = stay.guest.slice(0, 100);
  form.elements.payment.value = stay.method === "online" ? "online" : "desk";
  updateDates(stay.arrival, stay.departure);
  if (changed || arrival.value !== stay.arrival || departure.value !== stay.departure) {
    byId("form-message").textContent = "Availability has changed. Review your dates.";
  }
}

function options(field, values, label = value => value, preferred = field.value) {
  field.replaceChildren(...values.map(value => new Option(label(value), value)));
  if (values.includes(preferred)) field.value = preferred;
}
function stayDetails() {
  return { room: room.value, arrival: arrival.value, departure: departure.value,
    arrivalTime: arrivalTime.value, departureTime: departureTime.value,
    guest: byId("guest").value.trim(), method: form.elements.payment.value };
}
function updateTotal() {
  const price = quote(stayDetails(), days);
  byId("breakdown").textContent = price ? price.nights + (price.nights === 1 ? " night" : " nights") + " × " + money.format(price.rate) : "No dates available";
  byId("total").textContent = price ? money.format(price.total) : "—";
  byId("submit-booking").disabled = busy || !price;
  byId("submit-booking").textContent = busy ? "Please wait…" : form.elements.payment.value === "online" ? "Continue to demo payment" : "Confirm booking";
}
function updateDates(preferredArrival = arrival.value, preferredDeparture = departure.value) {
  const available = days.slice(0, -1).filter(day => !nightTaken(room.value, day));
  options(arrival, available, labelDate, preferredArrival);
  options(departure, departureDates(room.value, arrival.value, days), labelDate, preferredDeparture);
  updateTotal();
}
function updateRoom() {
  const selected = roomFor(room.value);
  if (!selected) return;
  byId("room-title").textContent = selected.name;
  byId("room-description").textContent = selected.description;
  byId("room-photo").src = "assets/img/" + selected.image_file;
  byId("room-photo").alt = selected.image_alt;
  byId("room-rate").textContent = money.format(selected.price_per_night);
  options(arrivalTime, arrivalTimes);
  options(departureTime, checkoutTimes);
  updateDates();
}
async function refreshInventory() {
  byId("start").disabled = true;
  byId("booking-status").textContent = "Loading rooms and availability…";
  byId("retry-booking").hidden = true;
  try {
    await loadInventory();
    days = calendarDays();
    options(room, availableRooms.map(r => r.slug), slug => roomFor(slug).name, room.value || query.get("room"));
    updateRoom();
    byId("booking-status").textContent = "Choose your stay. Sign in before confirming your reservation.";
    byId("start").disabled = false;
    return true;
  } catch (error) {
    byId("booking-status").textContent = bookingError(error);
    byId("retry-booking").hidden = false;
    return false;
  }
}
function signInLink() {
  const url = accountUrl();
  url.searchParams.set("room", room.value);
  location.assign(url.href);
}
byId("retry-booking").addEventListener("click", initializeBooking);
byId("start").addEventListener("click", async () => {
  if (opening || busy) return;
  opening = true;
  const version = accessVersion;
  byId("start").disabled = true;
  try {
    const user = await currentUser();
    const previousStay = formUserId === user.id ? stayDetails() : null;
    if (!await refreshInventory()) return;
    if (version !== accessVersion) return;
    if (formUserId && formUserId !== user.id) { forgetForm(); byId("guest").value = ""; }
    formUserId = user.id;
    if (previousStay) restoreFields(previousStay);
    if (!byId("guest").value) byId("guest").value = user.user_metadata?.full_name || "";
    if (!modal.open) modal.showModal();
    rememberForm();
  } catch (error) {
    if (error.message === "SIGN_IN_REQUIRED") signInLink();
    else byId("booking-status").textContent = bookingError(error);
  } finally { opening = false; byId("start").disabled = !availableRooms.length; }
});
modal.querySelector(".close").addEventListener("click", () => { if (!busy) modal.close(); });
modal.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
dismissOnBackdrop(modal, () => !busy);
dismissOnBackdrop(byId("confirmation"));
modal.addEventListener("close", () => { if (!modal.open) rememberForm(); });
room.addEventListener("change", updateRoom);
arrival.addEventListener("change", () => updateDates());
form.addEventListener("change", updateTotal);
form.addEventListener("change", rememberForm);
form.addEventListener("input", rememberForm);
window.addEventListener("pagehide", rememberForm);
window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  // Back/Forward can restore the old document from browser memory after payment.
  formUserId = null;
  modal.close(); byId("confirmation").close();
  form.reset();
  requestDraft = null;
  initializeBooking();
});
byId("guest").addEventListener("input", () => byId("guest").setCustomValidity(""));
form.addEventListener("submit", async event => {
  event.preventDefault();
  if (busy) return;
  const stay = stayDetails();
  if (!stay.guest) {
    byId("guest").setCustomValidity((globalThis.HotelI18n?.t("Enter the guest’s full name.") || "Enter the guest’s full name."));
    byId("guest").reportValidity(); return;
  }
  const price = quote(stay);
  if (!price) { updateDates(); byId("form-message").textContent = "Availability has changed. Review your dates."; return; }
  busy = true; updateTotal();
  rememberForm();
  const version = accessVersion;
  byId("form-message").textContent = "";
  const controls = [...form.querySelectorAll("input, select, .close")];
  controls.forEach(control => { control.disabled = true; });
  try {
    const user = await currentUser();
    if (version !== accessVersion) return;
    if (formUserId !== user.id) throw new Error("ACCOUNT_CHANGED");
    const details = { ...stay, userId: user.id, roomId: roomFor(stay.room).id, rate: price.rate };
    const signature = JSON.stringify(details);
    const previous = requestDraft || readCheckout();
    requestDraft = { ...details, id: previous?.signature === signature ? previous.id : crypto.randomUUID(), signature };
    // Keep the same ID after a network failure, so retrying cannot duplicate the write.
    try { rememberCheckout(requestDraft); }
    catch { if (stay.method === "online") throw new Error("STORAGE_REQUIRED"); }
    if (stay.method === "online") { location.assign("payment.html"); return; }
    const booking = await createBooking(requestDraft);
    if (version !== accessVersion) return;
    forgetForm();
    clearCheckout(); requestDraft = null;
    modal.close();
    byId("confirmation").querySelector(".receipt").textContent = bookingReceipt(booking, roomFor(stay.room).name);
    byId("confirmation").showModal();
    await refreshInventory();
  } catch (error) {
    if (version !== accessVersion) return;
    byId("form-message").textContent = bookingError(error);
    if (error.message === "SIGN_IN_REQUIRED") signInLink();
    if (["23P01"].includes(error.code) || ["PRICE_CHANGED", "ROOM_UNAVAILABLE", "INVALID_BOOKING"].includes(error.message)) {
      requestDraft = null; clearCheckout(); await refreshInventory();
    }
  } finally {
    busy = false;
    controls.forEach(control => { control.disabled = false; });
    updateTotal();
  }
});
document.addEventListener("hotel-auth-change", event => {
  if (event.detail.event === "SIGNED_OUT" || (formUserId && event.detail.session?.user?.id !== formUserId)) {
    ++accessVersion; forgetForm(); clearCheckout(); requestDraft = null;
    modal.close(); byId("confirmation").close(); byId("guest").value = "";
  }
});
async function initializeBooking() {
  const version = accessVersion;
  if (!await refreshInventory()) return;
  if (query.has("check-in") || query.has("check-out")) {
    updateDates(query.get("check-in"), query.get("check-out"));
    if ((query.get("check-in") && arrival.value !== query.get("check-in")) || (query.get("check-out") && departure.value !== query.get("check-out"))) {
      byId("form-message").textContent = "Your requested dates are unavailable. Review the available dates before confirming.";
    }
  }
  const state = readBookingForm();
  if (!state) return;
  if (state.context !== query.toString()) { forgetForm(); return; }
  byId("start").disabled = true;
  try {
    const user = await currentUser();
    if (version !== accessVersion) return;
    if (state.userId !== user.id) { forgetForm(); return; }
    // A reload during a request must not restore a form for an already saved stay.
    const checkout = readCheckout();
    if (checkout?.userId === user.id && await savedBooking(checkout.id)) {
      if (version !== accessVersion) return;
      forgetForm(); clearCheckout();
      byId("booking-status").textContent = "Booking saved";
      return;
    }
    if (version !== accessVersion) return;
    formUserId = user.id;
    restoreFields(state.stay);
    if (state.open && !modal.open) modal.showModal();
    rememberForm();
  } catch (error) {
    if (error.message === "SIGN_IN_REQUIRED") forgetForm();
    else { byId("booking-status").textContent = bookingError(error); byId("retry-booking").hidden = false; }
  } finally { byId("start").disabled = !availableRooms.length; }
}
initializeBooking();
