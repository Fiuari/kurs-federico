const roomSlider = document.getElementById("room-slider");
const roomCardTemplate = document.getElementById("public-room-card");
const roomSearch = document.getElementById("room-search");
const roomSort = document.getElementById("room-sort");
const catalogueStatus = document.getElementById("rooms-status");
const retryRooms = document.getElementById("retry-rooms");
const previousRoom = document.getElementById("previous-room");
const nextRoom = document.getElementById("next-room");
let catalogueRooms = [];
let visibleRooms = [];
let roomIndex = 0;
let catalogueLoading = false;
let catalogueReady = false;

function renderRoomSlide() {
  roomSlider.replaceChildren();
  previousRoom.disabled = nextRoom.disabled = visibleRooms.length < 2;
  const room = visibleRooms[roomIndex];
  document.getElementById("room-counter").textContent = room ? String(roomIndex + 1).padStart(2, "0") + " / " + String(visibleRooms.length).padStart(2, "0") : "0 / 0";
  if (!room) return;
  const fragment = roomCardTemplate.content.cloneNode(true);
  fragment.querySelector(".room-title-link").textContent = room.name;
  fragment.querySelector(".room-summary").textContent = room.description;
  fragment.querySelector(".room-price").textContent = publicRoomMoney.format(room.price_per_night) + " / night";
  fragment.querySelectorAll("[data-room-detail]").forEach(link => { link.href = roomPageUrl(room.slug); });
  fragment.querySelector(".room-photo-link").setAttribute("aria-label", "View " + room.name);
  fragment.querySelector("[data-book-room]").href = roomBookingUrl(room.slug);
  fragment.querySelectorAll("[data-room-image]").forEach(image => setRoomImage(image, room));
  roomSlider.append(fragment);
}
function filterRoomSlides(preferredSlug) {
  visibleRooms = selectPublicRooms(catalogueRooms, roomSearch.value, roomSort.value);
  roomIndex = Math.max(0, visibleRooms.findIndex(room => room.slug === preferredSlug));
  catalogueStatus.textContent = !catalogueRooms.length ? "No rooms are currently available for booking." :
    !visibleRooms.length ? "No rooms match your search. Try another name or clear the search." :
    visibleRooms.length + (visibleRooms.length === 1 ? " room found" : " rooms found");
  renderRoomSlide();
}
async function refreshRoomCatalogue() {
  if (catalogueLoading) return;
  catalogueLoading = true; catalogueReady = false;
  const selectedSlug = visibleRooms[roomIndex]?.slug;
  roomSearch.disabled = roomSort.disabled = true;
  previousRoom.disabled = nextRoom.disabled = true;
  retryRooms.hidden = true;
  catalogueStatus.textContent = "Loading rooms…";
  roomSlider.setAttribute("aria-busy", "true");
  try {
    catalogueRooms = await loadRooms();
    catalogueReady = true;
    filterRoomSlides(selectedSlug);
  } catch {
    catalogueRooms = []; visibleRooms = []; renderRoomSlide();
    catalogueStatus.textContent = "We could not load the rooms. Check your connection and try again.";
    retryRooms.hidden = false;
  } finally {
    catalogueLoading = false;
    roomSearch.disabled = roomSort.disabled = !catalogueReady;
    roomSlider.setAttribute("aria-busy", "false");
  }
}
roomSearch.addEventListener("input", () => filterRoomSlides());
roomSort.addEventListener("change", () => filterRoomSlides());
retryRooms.addEventListener("click", refreshRoomCatalogue);
previousRoom.addEventListener("click", () => { if (visibleRooms.length) { roomIndex = (roomIndex - 1 + visibleRooms.length) % visibleRooms.length; renderRoomSlide(); } });
nextRoom.addEventListener("click", () => { if (visibleRooms.length) { roomIndex = (roomIndex + 1) % visibleRooms.length; renderRoomSlide(); } });
// Returning from the admin page refreshes changes without a manual rebuild.
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshRoomCatalogue(); });
window.addEventListener("pageshow", event => { if (event.persisted) refreshRoomCatalogue(); });
refreshRoomCatalogue();
