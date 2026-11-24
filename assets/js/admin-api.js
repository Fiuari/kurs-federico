// Express checks the token and role; Supabase RLS also protects every query.
async function isHotelAdmin() { return await apiRequest("/me/admin", {authenticated:true}) === true; }
async function requireHotelAdmin() {
  const { data, error } = await getHotelClient().auth.getUser();
  if (error || !data.user) throw error || new Error("SIGN_IN_REQUIRED");
  if (!await isHotelAdmin()) throw new Error("ADMIN_REQUIRED");
  return data.user;
}
function readAdminRooms() { return apiRequest("/admin/rooms", {authenticated:true}); }
function saveAdminRoom(id, values, existing) {
  const {slug, ...editable} = values;
  return apiRequest("/admin/rooms" + (existing ? "/" + encodeURIComponent(id) : ""), {
    method:existing ? "PATCH" : "POST", authenticated:true,
    body:existing ? editable : {id,...values}
  });
}
function deleteAdminRoom(id) { return apiRequest("/admin/rooms/" + encodeURIComponent(id), {method:"DELETE",authenticated:true}); }
function adminError(error) {
  if (error?.code === "INVALID_INPUT") return "Check the room fields and try again.";
  if (["23503", "23001"].includes(error?.code)) return "This room has bookings and cannot be deleted. Edit it and turn off Available for booking instead.";
  if (error?.code === "23505") return "This booking address already exists, or your previous request was saved. Refresh the list before trying again.";
  if (error?.code === "42501" || error?.message === "ADMIN_REQUIRED") return "Administrator access is required. Your permissions may have changed.";
  if (error?.name === "AuthSessionMissingError" || error?.message === "SIGN_IN_REQUIRED" || error?.status === 401) return "Please sign in to an administrator account.";
  if (error?.code === "PGRST202") return "Administration is not configured yet. Complete the administrator setup in Supabase.";
  if (error?.code === "PGRST116" || error?.message === "ROOM_NOT_FOUND") return "This room is no longer available to edit. Refresh the list and check your access.";
  if (["23514", "22003", "22P02"].includes(error?.code)) return "Check the room name, booking address and positive price, then try again.";
  return "The request could not be confirmed. Check your connection and refresh the list before retrying; the change may already have been saved.";
}
