const manageRoomsLink = document.getElementById("manage-rooms");
let adminLinkVersion = 0;
async function updateAdminLink() {
  const version = ++adminLinkVersion;
  manageRoomsLink.hidden = true;
  try {
    const { data, error } = await getHotelClient().auth.getSession();
    if (error || !data.session) return;
    const allowed = await isHotelAdmin();
    if (version === adminLinkVersion) manageRoomsLink.hidden = !allowed;
  } catch { /* The admin page has the setup and retry messages. */ }
}
document.addEventListener("hotel-auth-change", () => {
  ++adminLinkVersion;
  manageRoomsLink.hidden = true;
  // Supabase calls must run outside onAuthStateChange's synchronous callback.
  setTimeout(updateAdminLink, 0);
});
updateAdminLink();
