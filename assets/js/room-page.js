const detailStatus = document.getElementById("room-status");
const detailState = document.getElementById("room-state");
const detailContent = document.getElementById("room-content");
const retryRoom = document.getElementById("retry-room");
const requestedRoom = new URLSearchParams(location.search).get("room") || document.body.dataset.roomSlug;
let detailLoading = false;

async function refreshRoomDetail() {
  if (detailLoading) return;
  detailLoading = true;
  detailState.hidden = false; retryRoom.hidden = true; detailContent.hidden = true;
  document.getElementById("room-state-title").textContent = "Your room";
  detailStatus.textContent = "Loading room details…";
  try {
    const room = await loadPublicRoom(requestedRoom);
    if (!room) {
      document.title = "Room unavailable · BankHotel";
      document.querySelector('meta[name="description"]').content = "This room is not available. Explore other BankHotel rooms.";
      document.getElementById("room-state-title").textContent = "Room unavailable";
      detailStatus.textContent = "This room was removed or is not currently available for booking. Explore our other rooms.";
      return;
    }
    document.title = room.name + " · BankHotel";
    document.querySelector('meta[name="description"]').content = room.description;
    document.getElementById("room-name").textContent = room.name;
    document.getElementById("intro-title").textContent = room.name;
    document.getElementById("room-description").textContent = room.description;
    document.getElementById("room-caption").textContent = room.name;
    document.getElementById("room-nightly-rate").textContent = publicRoomMoney.format(room.price_per_night);
    detailContent.querySelectorAll("[data-room-image]").forEach(image => setRoomImage(image, room));
    detailContent.querySelectorAll("[data-book-room]").forEach(link => { link.href = roomBookingUrl(room.slug); });
    detailState.hidden = true; detailContent.hidden = false;
  } catch {
    detailStatus.textContent = "We could not load this room. Check your connection and try again.";
    retryRoom.hidden = false;
  } finally { detailLoading = false; }
}
retryRoom.addEventListener("click", refreshRoomDetail);
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshRoomDetail(); });
window.addEventListener("pageshow", event => { if (event.persisted) refreshRoomDetail(); });
refreshRoomDetail();
