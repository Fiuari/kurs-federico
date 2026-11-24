// Shared URLs work both at / and at /kurs-federico/ on GitHub Pages.
const publicRoomsRoot = new URL("../../", document.currentScript.src);
const publicRoomFields = "id, slug, name, description, price_per_night, image_file, image_alt";
const publicRoomMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: "UAH", maximumFractionDigits: 2 });
function roomPageUrl(slug) {
  const url = new URL("room.html", publicRoomsRoot);
  url.searchParams.set("room", slug); return url.href;
}
function roomBookingUrl(slug) {
  const url = new URL("booking.html", publicRoomsRoot);
  url.searchParams.set("room", slug); return url.href;
}
function roomImageUrl(filename) {
  const safe = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(png|jpe?g|webp|avif)$/i.test(filename || "");
  return new URL("assets/img/" + (safe ? filename : "hero.png"), publicRoomsRoot).href;
}
function setRoomImage(image, room) {
  image.alt = room.image_alt || room.name;
  image.onerror = () => { image.onerror = null; image.src = roomImageUrl("hero.png"); image.alt = "BankHotel interior"; };
  image.src = roomImageUrl(room.image_file);
}
function selectPublicRooms(rooms, search, sort) {
  const term = search.trim().toLocaleLowerCase();
  return rooms.filter(room => (room.name + " " + room.description).toLocaleLowerCase().includes(term))
    .sort((a, b) => {
      const price = Number(a.price_per_night) - Number(b.price_per_night);
      return (sort === "price-desc" ? -price : price) || a.name.localeCompare(b.name);
    });
}
async function loadPublicRoom(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug || "")) return null;
  return apiRequest("/rooms/" + encodeURIComponent(slug));
}
