// Publishable browser key. Access is controlled by Supabase grants and RLS.
const SUPABASE_URL = "https://ntydnzeagkjpvwayqacf.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_nnrHwBWj2iIN2yZ9kW-qTQ_wluMkWFr";
let hotelClient;

function getHotelClient() {
  if (!window.supabase?.createClient) {
    throw new Error("Не вдалося завантажити бібліотеку Supabase. Перевір інтернет і онови сторінку.");
  }
  hotelClient ??= window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  return hotelClient;
}

async function apiRequest(path, {method = "GET", body, authenticated = false} = {}) {
  if (!HOTEL_API_URL) throw new Error("API_NOT_CONFIGURED");
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (authenticated) {
    const {data, error} = await getHotelClient().auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("SIGN_IN_REQUIRED");
    headers.Authorization = "Bearer " + data.session.access_token;
  }
  const controller = new AbortController();
  // Allows a sleeping Render instance time to start. Never automatically retry writes.
  const timeout = setTimeout(() => controller.abort(), 70000);
  try {
    const response = await fetch(HOTEL_API_URL.replace(/\/$/, "") + "/api" + path, {
      method, headers, signal: controller.signal,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok) throw Object.assign(new Error(payload.error?.message || "API_UNAVAILABLE"), {code:payload.error?.code, status:response.status});
    return payload;
  } finally { clearTimeout(timeout); }
}
function loadRooms() { return apiRequest("/rooms"); }
