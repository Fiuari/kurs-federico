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

async function loadRooms() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const { data, error } = await getHotelClient()
      .from("rooms")
      .select("id, slug, name, description, price_per_night, image_file, image_alt")
      .eq("is_active", true)
      .order("price_per_night")
      .abortSignal(controller.signal);
    if (error) throw error;
    return data;
  } finally {
    clearTimeout(timer);
  }
}
