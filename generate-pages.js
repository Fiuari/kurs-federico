// Run with: node generate-pages.js
const fs = require("node:fs");
const path = require("node:path");
const rooms = require("./data/rooms");

const root = __dirname;
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const pageTemplate = read("templates/room.html");
const cardTemplate = read("templates/room-card.html");
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

// Only the marked region in index.html is generated. Other sections are hand-edited.
const home = read("index.html");
const startMarker = "<!-- room-cards:start -->";
const endMarker = "<!-- room-cards:end -->";
const start = home.indexOf(startMarker);
const end = home.indexOf(endMarker);
if (start < 0 || end <= start) throw new Error("Room card markers missing in index.html");
const newline = home.includes("\r\n") ? "\r\n" : "\n";
const cardHtml = cards.join("\n").replace(/\r?\n/g, newline);
files.set("index.html", home.slice(0, start + startMarker.length) + newline +
  cardHtml + newline + "    " + home.slice(end));

fs.mkdirSync(path.join(root, "rooms"), { recursive: true });
for (const [file, html] of files) {
  const target = path.join(root, file);
  if (!fs.existsSync(target) || read(file) !== html) fs.writeFileSync(target, html);
}
console.log(`Generated ${rooms.length} room pages and slider cards.`);
