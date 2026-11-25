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
byId("retry-booking").addEventListener("click", refreshInventory);
byId("start").addEventListener("click", async () => {
  byId("start").disabled = true;
  try {
    const user = await currentUser();
    if (!await refreshInventory()) return;
    if (!byId("guest").value) byId("guest").value = user.user_metadata?.full_name || "";
    modal.showModal();
  } catch (error) {
    if (error.message === "SIGN_IN_REQUIRED") signInLink();
    else byId("booking-status").textContent = bookingError(error);
  } finally { byId("start").disabled = !availableRooms.length; }
});
modal.querySelector(".close").addEventListener("click", () => { if (!busy) modal.close(); });
modal.addEventListener("cancel", event => { if (busy) event.preventDefault(); });
room.addEventListener("change", updateRoom);
arrival.addEventListener("change", () => updateDates());
form.addEventListener("change", updateTotal);
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
  byId("form-message").textContent = "";
  const controls = [...form.querySelectorAll("input, select, .close")];
  controls.forEach(control => { control.disabled = true; });
  try {
    const user = await currentUser();
    const details = { ...stay, userId: user.id, roomId: roomFor(stay.room).id, rate: price.rate };
    const signature = JSON.stringify(details);
    const previous = requestDraft || readCheckout();
    requestDraft = { ...details, id: previous?.signature === signature ? previous.id : crypto.randomUUID(), signature };
    // Keep the same ID after a network failure, so retrying cannot duplicate the write.
    try { rememberCheckout(requestDraft); }
    catch { if (stay.method === "online") throw new Error("STORAGE_REQUIRED"); }
    if (stay.method === "online") { location.assign("payment.html"); return; }
    const booking = await createBooking(requestDraft);
    clearCheckout(); requestDraft = null;
    modal.close();
    byId("confirmation").querySelector(".receipt").textContent = bookingReceipt(booking, roomFor(stay.room).name);
    byId("confirmation").showModal();
    await refreshInventory();
  } catch (error) {
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
  if (event.detail.event === "SIGNED_OUT") { requestDraft = null; modal.close(); }
});
async function initializeBooking() {
  if (!await refreshInventory()) return;
  if (query.has("check-in") || query.has("check-out")) {
    updateDates(query.get("check-in"), query.get("check-out"));
    if ((query.get("check-in") && arrival.value !== query.get("check-in")) || (query.get("check-out") && departure.value !== query.get("check-out"))) {
      byId("form-message").textContent = "Your requested dates are unavailable. Review the available dates before confirming.";
    }
  }
}
initializeBooking();
