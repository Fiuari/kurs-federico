const checkButton = document.getElementById("check-connection");
const statusText = document.getElementById("connection-status");
const roomList = document.getElementById("database-rooms");
const prices = new Intl.NumberFormat("uk-UA", { style: "currency", currency: "UAH" });

async function checkConnection() {
  checkButton.disabled = true;
  roomList.replaceChildren();
  roomList.setAttribute("aria-busy", "true");
  statusText.textContent = "Завантаження номерів із Supabase…";
  try {
    const rooms = await loadRooms();
    statusText.textContent = rooms.length
      ? "З’єднання працює. Отримано номерів: " + rooms.length + "."
      : "Запит виконано, але доступних номерів немає. Перевір початкові записи та політику читання rooms.";
    for (const room of rooms) {
      const item = document.createElement("li");
      const title = document.createElement("h2");
      const description = document.createElement("p");
      const rate = document.createElement("p");
      title.textContent = room.name;
      description.textContent = room.description;
      rate.textContent = prices.format(room.price_per_night) + " / ніч";
      item.append(title, description, rate);
      roomList.append(item);
    }
  } catch (error) {
    if (error.code === "PGRST205" || error.code === "42P01") {
      statusText.textContent = "Supabase доступний. Спочатку виконай supabase/001_initial.sql у SQL Editor, потім натисни «Перевірити знову».";
    } else if (error.code === "42501") {
      statusText.textContent = "База відхилила доступ. Перевір права SELECT і RLS для таблиці rooms.";
    } else {
      statusText.textContent = "Не вдалося отримати номери. Перевір інтернет і параметри підключення та спробуй знову.";
      console.error("Supabase rooms request failed:", error);
    }
  } finally {
    roomList.setAttribute("aria-busy", "false");
    checkButton.disabled = false;
    checkButton.textContent = "Перевірити знову";
  }
}
checkButton.addEventListener("click", checkConnection);
checkConnection();
