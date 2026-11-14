// Run with: node generate-pages.js
const fs = require("node:fs");
const path = require("node:path");
const rooms = require("./data/rooms");
const facilities = require("./data/facilities");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pageTemplate = read("templates/room.html");
const cardTemplate = read("templates/room-card.html");
const facilityTemplate = read("templates/facility.html");
const facilityCardTemplate = read("templates/facility-card.html");
const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function render(template, values) {
  // Optional photo sections are omitted for rooms without those images.
  const sections = template.replace(/{{#(\w+)}}\r?\n([\s\S]*?){{\/\1}}\r?\n/g,
    (_, key, content) => values[key] ? content : "");
  return sections.replace(/{{([\w.]+)}}/g, (_, key) => {
    const value = key.split(".").reduce((object, field) => object?.[field], values);
    if (typeof value !== "string") throw new Error(`Missing ${key} for ${values.slug}`);
    return value.replace(/[&<>"']/g, (character) => entities[character]);
  });
}

const files = new Map();
// Keep the browser's room choices in sync with the static room pages.
const bookingRooms = rooms.map(({ slug, name, description, hero }) => ({ slug, name, description, hero }));
files.set("assets/js/booking-catalog.js", "// Generated from data/rooms.js by generate-pages.js.\n" +
  "const bookingRooms = " + JSON.stringify(bookingRooms, null, 2) + ";\n");

const cards = [];
for (const [i, room] of rooms.entries()) {
  const file = `rooms/${room.slug}.html`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(room.slug) || files.has(file)) {
    throw new Error(`Invalid or duplicate room slug: ${room.slug}`);
  }
  const [headingFirst, ...rest] = room.name.split(" ");
  const values = {
    ...room,
    intro: room.intro ?? room.summary,
    interior: room.interior ?? room.preview,
    headingFirst,
    headingRest: rest.join(" ").toLowerCase(),
    number: String(i + 1).padStart(2, "0"),
    total: String(rooms.length).padStart(2, "0"),
  };
  files.set(file, render(pageTemplate, values));
  cards.push(render(cardTemplate, values).trimEnd());
}

const facilityCards = [];
for (const [i, facility] of facilities.entries()) {
  const file = `facilities/${facility.slug}.html`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(facility.slug) || files.has(file)) {
    throw new Error(`Invalid or duplicate facility slug: ${facility.slug}`);
  }
  files.set(file, render(facilityTemplate, facility));
  const values = { ...facility, number: String(i + 1).padStart(2, "0") };
  facilityCards.push(render(facilityCardTemplate, values).trimEnd());
}

function replaceCards(home, section, items) {
  const startMarker = `<!-- ${section}:start -->`;
  const endMarker = `<!-- ${section}:end -->`;
  const start = home.indexOf(startMarker);
  const end = home.indexOf(endMarker);
  if (start < 0 || end <= start) throw new Error(`Missing ${section} markers in index.html`);
  const indent = home.slice(home.lastIndexOf("\n", start) + 1, start);
  const newline = home.includes("\r\n") ? "\r\n" : "\n";
  const content = items.join("\n").replace(/\r?\n/g, newline);
  return home.slice(0, start + startMarker.length) + newline + content + newline + indent + home.slice(end);
}
let home = replaceCards(read("index.html"), "room-cards", cards);
home = replaceCards(home, "facility-cards", facilityCards);
files.set("index.html", home);

fs.mkdirSync(path.join(root, "rooms"), { recursive: true });
fs.mkdirSync(path.join(root, "facilities"), { recursive: true });
for (const [file, html] of files) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || read(file) !== html) fs.writeFileSync(target, html);
}
console.log(`Generated ${rooms.length} room pages, ${facilities.length} facility pages and their homepage cards.`);
