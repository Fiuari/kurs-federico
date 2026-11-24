const adminById = id => document.getElementById(id);
const editor = adminById("room-editor");
const roomForm = adminById("room-form");
const deleteDialog = adminById("delete-dialog");
let adminRooms = [];
let editingId = null;
let creatingId = null;
let deletingRoom = null;
let adminUserId = null;
let adminBusy = false;
let accessVersion = 0;
const adminMoney = new Intl.NumberFormat("en-GB", { style: "currency", currency: "UAH" });

function setAdminBusy(value) {
  adminBusy = value;
  document.querySelectorAll(".admin-page button, #room-form input, #room-form textarea, #room-form select").forEach(el => { el.disabled = value; });
  adminById("edit-slug").disabled = value || !!editingId;
}
function hideManagement() {
  adminUserId = null;
  adminRooms = [];
  adminById("room-rows").replaceChildren();
  adminById("admin-content").hidden = true;
  adminById("access-actions").hidden = false;
  editor.close(); deleteDialog.close();
}
function renderRooms() {
  const rows = adminRooms.map(room => {
    const row = document.createElement("tr");
    const title = document.createElement("td");
    const name = document.createElement("strong"); name.textContent = room.name;
    const slug = document.createElement("small"); slug.textContent = room.slug;
    title.append(name, slug);
    const price = document.createElement("td"); price.textContent = adminMoney.format(room.price_per_night);
    const status = document.createElement("td"); status.textContent = room.is_active ? "Available" : "Unavailable";
    const actions = document.createElement("td"); actions.className = "room-actions";
    for (const [label, callback] of [["Edit", () => openEditor(room)], ["Delete", () => openDelete(room)]]) {
      const button = document.createElement("button"); button.type = "button"; button.textContent = label;
      button.setAttribute("aria-label", label + " " + room.name);
      button.addEventListener("click", () => { if (!adminBusy) callback(); }); actions.append(button);
    }
    row.append(title, price, status, actions); return row;
  });
  adminById("room-rows").replaceChildren(...rows);
  adminById("room-count").textContent = adminRooms.length + (adminRooms.length === 1 ? " room" : " rooms");
  adminById("empty-rooms").hidden = !!adminRooms.length;
}
async function checkAdminAccess() {
  if (adminBusy) return;
  const version = ++accessVersion;
  hideManagement(); setAdminBusy(true);
  adminById("admin-status").textContent = "Checking your access…";
  try {
    const user = await requireHotelAdmin();
    const rooms = await readAdminRooms();
    if (version !== accessVersion) return;
    adminUserId = user.id; adminRooms = rooms;
    renderRooms();
    adminById("admin-content").hidden = false;
    adminById("access-actions").hidden = true;
    adminById("admin-status").textContent = "Signed in as " + user.email;
  } catch (error) {
    if (version === accessVersion) adminById("admin-status").textContent = adminError(error);
  } finally { setAdminBusy(false); }
}
function previewImage() {
  // A local filename only; never render markup from database content.
  const filename = adminById("edit-image").value;
  adminById("image-preview").src = "assets/img/" + encodeURIComponent(filename);
}
function openEditor(room = null) {
  if (!adminUserId || adminBusy) return;
  roomForm.reset();
  editingId = room?.id || null; creatingId = editingId ? null : crypto.randomUUID();
  adminById("editor-title").textContent = room ? "Edit room" : "Add room";
  for (const [field, property] of [["name", "name"], ["slug", "slug"], ["description", "description"], ["price", "price_per_night"], ["alt", "image_alt"]]) {
    adminById("edit-" + field).value = room?.[property] ?? "";
    adminById("edit-" + field).setCustomValidity("");
  }
  const images = adminById("edit-image");
  if (room?.image_file && ![...images.options].some(option => option.value === room.image_file)) images.add(new Option("Current photo", room.image_file));
  images.value = room?.image_file || "roomonemain.png";
  adminById("edit-active").checked = room ? room.is_active : true;
  adminById("edit-slug").disabled = !!room;
  adminById("editor-status").textContent = "";
  previewImage(); editor.showModal();
}
function openDelete(room) {
  deletingRoom = room;
  adminById("delete-description").textContent = "Delete “" + room.name + "”?";
  adminById("delete-status").textContent = ""; deleteDialog.showModal();
}
async function verifySameAdmin() {
  const user = await requireHotelAdmin();
  if (user.id !== adminUserId) throw new Error("ADMIN_REQUIRED");
}
async function reloadAfterWrite(message, version) {
  try {
    const rooms = await readAdminRooms();
    if (version !== accessVersion) return;
    adminRooms = rooms; renderRooms();
    adminById("admin-status").textContent = message;
  } catch {
    if (version === accessVersion) adminById("admin-status").textContent = message + " The list could not refresh. Press Refresh to load the latest rooms.";
  }
}
roomForm.addEventListener("submit", async event => {
  event.preventDefault(); if (adminBusy || !adminUserId) return;
  const name = adminById("edit-name"); name.setCustomValidity(name.value.trim() ? "" : "Enter a room name.");
  if (!roomForm.reportValidity()) return;
  const values = {
    name: name.value.trim(), slug: adminById("edit-slug").value.trim(),
    description: adminById("edit-description").value.trim(), price_per_night: Number(adminById("edit-price").value),
    image_file: adminById("edit-image").value, image_alt: adminById("edit-alt").value.trim(), is_active: adminById("edit-active").checked
  };
  const version = accessVersion;
  setAdminBusy(true); adminById("editor-status").textContent = "Saving…";
  try {
    await verifySameAdmin();
    if (version !== accessVersion) return;
    await saveAdminRoom(editingId || creatingId, values, !!editingId);
    if (version !== accessVersion) return;
    editor.close(); await reloadAfterWrite("Room saved. Booking now uses the updated details.", version);
  } catch (error) {
    if (version === accessVersion) adminById("editor-status").textContent = adminError(error);
  } finally { setAdminBusy(false); }
});
adminById("confirm-delete").addEventListener("click", async () => {
  if (adminBusy || !deletingRoom || !adminUserId) return;
  const version = accessVersion;
  setAdminBusy(true); adminById("delete-status").textContent = "Deleting…";
  try {
    await verifySameAdmin();
    if (version !== accessVersion) return;
    await deleteAdminRoom(deletingRoom.id);
    if (version !== accessVersion) return;
    deleteDialog.close(); await reloadAfterWrite("Room deleted.", version);
  } catch (error) {
    if (version === accessVersion) adminById("delete-status").textContent = adminError(error);
  } finally { setAdminBusy(false); }
});
adminById("edit-name").addEventListener("input", () => adminById("edit-name").setCustomValidity(""));
adminById("edit-image").addEventListener("change", previewImage);
adminById("add-room").addEventListener("click", () => openEditor());
for (const id of ["refresh-rooms", "retry-access"]) adminById(id).addEventListener("click", checkAdminAccess);
for (const id of ["close-editor", "cancel-editor"]) adminById(id).addEventListener("click", () => { if (!adminBusy) editor.close(); });
adminById("cancel-delete").addEventListener("click", () => { if (!adminBusy) deleteDialog.close(); });
for (const dialog of [editor, deleteDialog]) dialog.addEventListener("cancel", event => { if (adminBusy) event.preventDefault(); });
document.addEventListener("hotel-auth-change", ({ detail }) => {
  if (detail.event === "SIGNED_OUT" || (adminUserId && detail.session?.user.id !== adminUserId)) {
    ++accessVersion; hideManagement();
    adminById("admin-status").textContent = "Your session changed. Sign in and check access again.";
  }
});
checkAdminAccess();
