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

function options(field, values, label = value => value, preferred = field.value) {
  field.replaceChildren(...values.map(value => new Option(label(value), value)));
  if (values.includes(preferred)) field.value = preferred;
}
function stayDetails() {
  return {
    room: room.value, arrival: arrival.value, departure: departure.value,
    arrivalTime: arrivalTime.value, departureTime: departureTime.value,
    guest: byId("guest").value.trim(), method: form.elements.payment.value
  };
}
function updateTotal() {
  const price = quote(stayDetails(), days);
  byId("breakdown").textContent = price ? price.nights + (price.nights === 1 ? " night" : " nights") + " × " + money.format(price.rate) : "No dates available";
  byId("total").textContent = price ? money.format(price.total) : "—";
  byId("submit-booking").disabled = !price;
  byId("submit-booking").textContent = form.elements.payment.value === "online" ? "Continue to payment" : "Confirm booking";
}
function updateDates(preferredArrival = arrival.value, preferredDeparture = departure.value) {
  const available = days.slice(0, -1).filter((_, i) => !demoSchedule[room.value].unavailable.includes(i + 1));
  options(arrival, available, labelDate, preferredArrival);
  options(departure, departureDates(room.value, arrival.value, days), labelDate, preferredDeparture);
  updateTotal();
}
function updateRoom() {
  const selected = roomFor(room.value);
  byId("room-title").textContent = selected.name;
  byId("room-description").textContent = selected.description;
  byId("room-photo").src = "assets/img/" + selected.hero.file;
  byId("room-photo").alt = selected.hero.alt;
  byId("room-rate").textContent = money.format(demoSchedule[selected.slug].rate);
  options(arrivalTime, demoSchedule[selected.slug].arrivals);
  options(departureTime, checkoutTimes);
  updateDates();
}
options(room, bookingRooms.filter(r => demoSchedule[r.slug]).map(r => r.slug), slug => roomFor(slug).name, query.get("room"));
updateRoom();
const draft = query.get("edit") === "1" ? readCheckout() : null;
if (draft?.status === "pending" && quote(draft) && draft.room === room.value) {
  updateDates(draft.arrival, draft.departure);
  arrivalTime.value = draft.arrivalTime;
  departureTime.value = draft.departureTime;
  byId("guest").value = draft.guest;
  form.elements.payment.value = "online";
  updateTotal();
  modal.showModal();
} else if (query.has("check-in") || query.has("check-out")) {
  updateDates(query.get("check-in"), query.get("check-out"));
  if ((query.get("check-in") && arrival.value !== query.get("check-in")) ||
      (query.get("check-out") && departure.value !== query.get("check-out"))) {
    byId("form-message").textContent = "Your requested dates are unavailable. Review the available dates below before confirming.";
  }
}

byId("start").addEventListener("click", () => {
  days = calendarDays();
  updateDates();
  modal.showModal();
});
modal.querySelector(".close").addEventListener("click", () => modal.close());
room.addEventListener("change", updateRoom);
arrival.addEventListener("change", () => updateDates());
form.addEventListener("change", updateTotal);
byId("guest").addEventListener("input", () => byId("guest").setCustomValidity(""));
form.addEventListener("submit", event => {
  event.preventDefault();
  const stay = stayDetails();
  if (!stay.guest) {
    byId("guest").setCustomValidity("Enter the guest’s full name.");
    byId("guest").reportValidity();
    return;
  }
  const price = quote(stay);
  if (!price) {
    days = calendarDays();
    updateDates();
    byId("form-message").textContent = "Availability has changed. Please review the dates and confirm again.";
    return;
  }
  if (stay.method === "online") {
    try { sessionStorage.setItem(paymentKey, JSON.stringify({ ...stay, status: "pending" })); }
    catch { byId("form-message").textContent = "Enable session storage for demo payment, or choose payment at reception."; return; }
    location.assign("payment.html");
    return;
  }
  try { sessionStorage.removeItem(paymentKey); } catch { /* Reception works without storage. */ }
  modal.close();
  const confirmation = byId("confirmation");
  confirmation.querySelector(".receipt").textContent = receipt(stay, price.total, "Due at reception");
  confirmation.showModal();
});
