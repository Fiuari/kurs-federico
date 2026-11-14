// Demo inventory. Offsets count nights from today; checkout on a blocked night is allowed.
const demoSchedule = {
  "superior-twin": { rate: 3200, unavailable: [7, 8], arrivals: ["14:00", "16:00", "18:00"] },
  "deluxe-double": { rate: 4100, unavailable: [5, 6], arrivals: ["14:00", "15:00", "18:00"] },
  "presidential-suite": { rate: 7800, unavailable: [3, 4], arrivals: ["15:00", "17:00", "19:00"] },
  "cozy-single": { rate: 2400, unavailable: [10, 11], arrivals: ["14:00", "16:00", "20:00"] }
};
const checkoutTimes = ["08:00", "10:00", "12:00"];
const money = new Intl.NumberFormat("en-GB", { style: "currency", currency: "UAH", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const paymentKey = "bankhotel.demo.checkout";
const roomFor = slug => bookingRooms.find(room => room.slug === slug);

function calendarDays() {
  // Dates start tomorrow, so every offered arrival time is still in the future.
  const now = new Date();
  return Array.from({length: 31}, (_, i) => {
    const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + i + 1));
    return date.toISOString().slice(0, 10);
  });
}
function labelDate(iso) { return dateFormat.format(new Date(iso + "T00:00:00Z")); }

function departureDates(slug, arrival, days) {
  const start = days.indexOf(arrival);
  if (start < 0) return [];
  const result = [];
  for (let i = start; i < days.length - 1; i++) {
    if (demoSchedule[slug].unavailable.includes(i + 1)) break;
    result.push(days[i + 1]);
  }
  return result;
}

function quote(stay, days = calendarDays()) {
  const room = roomFor(stay.room);
  const schedule = demoSchedule[stay.room];
  if (!room || !schedule || !departureDates(stay.room, stay.arrival, days).includes(stay.departure) ||
      !schedule.arrivals.includes(stay.arrivalTime) || !checkoutTimes.includes(stay.departureTime)) return null;
  const nights = days.indexOf(stay.departure) - days.indexOf(stay.arrival);
  return { nights, rate: schedule.rate, total: schedule.rate * nights };
}

function readCheckout() {
  try { return JSON.parse(sessionStorage.getItem(paymentKey)); } catch { return null; }
}
function receipt(stay, total, paymentText) {
  return [
    roomFor(stay.room).name + " · " + stay.guest,
    labelDate(stay.arrival) + ", " + stay.arrivalTime + " → " + labelDate(stay.departure) + ", " + stay.departureTime,
    paymentText + " · " + money.format(total)
  ].join("\n");
}
