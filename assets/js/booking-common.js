// Shared by booking and demo payment. Room prices and occupancy come from Supabase.
let availableRooms = [];
let occupiedDates = [];
const arrivalTimes = ["14:00", "16:00", "18:00"];
const checkoutTimes = ["08:00", "10:00", "12:00"];
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "UAH", maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const paymentKey = "bankhotel.booking.checkout";
const roomFor = slug => availableRooms.find(room => room.slug === slug);

function calendarDays() {
  // Use the hotel's timezone, matching validation in the database.
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const part = type => Number(parts.find(p => p.type === type).value);
  return Array.from({ length: 31 }, (_, i) => new Date(Date.UTC(part("year"), part("month") - 1, part("day") + i + 1)).toISOString().slice(0, 10));
}
function labelDate(iso) { return dateFormat.format(new Date(iso + "T00:00:00Z")); }
function nightTaken(slug, date) {
  return occupiedDates.some(stay => stay.room_id === roomFor(slug)?.id && stay.check_in <= date && date < stay.check_out);
}
function departureDates(slug, arrival, days) {
  const start = days.indexOf(arrival);
  if (start < 0) return [];
  const result = [];
  for (let i = start; i < days.length - 1; i++) {
    if (nightTaken(slug, days[i])) break;
    result.push(days[i + 1]);
  }
  return result;
}
function quote(stay, days = calendarDays()) {
  const room = roomFor(stay.room);
  if (!room || !departureDates(stay.room, stay.arrival, days).includes(stay.departure) ||
      !arrivalTimes.includes(stay.arrivalTime) || !checkoutTimes.includes(stay.departureTime)) return null;
  const nights = days.indexOf(stay.departure) - days.indexOf(stay.arrival);
  return { nights, rate: Number(room.price_per_night), total: Number(room.price_per_night) * nights };
}
async function loadInventory() {
  const [rooms, occupancy] = await Promise.all([
    loadRooms(), apiRequest("/availability")
  ]);
  availableRooms = rooms;
  occupiedDates = occupancy;
  if (!rooms.length) throw new Error("ROOM_UNAVAILABLE");
}
async function currentUser() {
  const { data, error } = await getHotelClient().auth.getUser();
  if (error && error.name !== "AuthSessionMissingError" && ![401, 403].includes(error.status)) throw error;
  if (error || !data.user) throw new Error("SIGN_IN_REQUIRED");
  return data.user;
}
function readCheckout() {
  try { return JSON.parse(sessionStorage.getItem(paymentKey)); } catch { return null; }
}
function rememberCheckout(stay) { sessionStorage.setItem(paymentKey, JSON.stringify(stay)); }
function clearCheckout() { try { sessionStorage.removeItem(paymentKey); } catch {} }
async function savedBooking(id) {
  return apiRequest("/bookings/" + encodeURIComponent(id), {authenticated:true});
}
async function createBooking(stay) {
  const user = await currentUser();
  if (user.id !== stay.userId) throw new Error("ACCOUNT_CHANGED");
  return apiRequest("/bookings", {method:"POST", authenticated:true, body:{
    p_id: stay.id, p_room_id: stay.roomId, p_guest_name: stay.guest,
    p_check_in: stay.arrival, p_check_out: stay.departure,
    p_arrival_time: stay.arrivalTime, p_departure_time: stay.departureTime,
    p_payment_method: stay.method, p_expected_rate: stay.rate
  }});
}
function bookingReceipt(booking, roomName) {
  return [roomName + " · " + booking.guest_name,
    labelDate(booking.check_in) + ", " + booking.arrival_time.slice(0, 5) + " → " + labelDate(booking.check_out) + ", " + booking.departure_time.slice(0, 5),
    (booking.demo_paid ? "Demo payment completed (no charge)" : "Due at reception") + " · " + money.format(booking.total_amount),
    "Booking reference: " + booking.id].join("\n");
}
function bookingError(error) {
  if (error?.code === "23P01") return "These dates were just booked. Choose other dates and try again.";
  if (["PGRST202", "42703"].includes(error?.code)) return "Online booking is not available yet. Please try again later.";
  const messages = {
    SIGN_IN_REQUIRED: "Please sign in to save your booking.",
    ACCOUNT_CHANGED: "The signed-in account has changed. Return to booking and start again.",
    STORAGE_REQUIRED: "Enable session storage to continue to demo payment, or choose payment at reception.",
    ROOM_UNAVAILABLE: "This room is currently unavailable. Please choose another room.",
    PRICE_CHANGED: "The room price has changed. Return to booking to review the new price.",
    INVALID_BOOKING: "These booking details are no longer valid. Return to booking to choose your dates.",
    REQUEST_ALREADY_USED: "This request has already been used. Return to booking and start again."
  };
  return messages[error?.message] || "Could not confirm the request. Check your connection and retry; the same request will not create a duplicate booking.";
}
