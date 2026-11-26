// Run with: node generate-pages.js
// Room content is loaded from Supabase in the browser; generate only shared shells.
const fs = require("node:fs");
const path = require("node:path");
const legacyRooms = require("./data/rooms");
const facilities = require("./data/facilities");
const imageManifest = require("./assets/img/image-manifest.json");
const root = __dirname;
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
function render(template, values) {
  const sections = template.replace(/{{#(\w+)}}\r?\n([\s\S]*?){{\/\1}}\r?\n/g, (_, key, content) => values[key] ? content : "");
  return sections.replace(/{{([\w.]+)}}/g, (_, key) => {
    const value = key.split(".").reduce((object, field) => object?.[field], values);
    if (typeof value !== "string") throw new Error(`Missing ${key} for ${values.slug}`);
    return value.replace(/[&<>"']/g, character => entities[character]);
  });
}
function replaceCards(home, section, items) {
  const startMarker = `<!-- ${section}:start -->`;
  const endMarker = `<!-- ${section}:end -->`;
  const start = home.indexOf(startMarker), end = home.indexOf(endMarker);
  if (start < 0 || end <= start) throw new Error(`Missing ${section} markers`);
  return home.slice(0, start + startMarker.length) + "\n" + items.join("\n") + "\n  " + home.slice(end);
}
const files = new Map();
const roomTemplate = read("templates/room.html");
files.set("room.html", render(roomTemplate, { base: "", slug: "", pageTitle: "Room details · BankHotel", pageDescription: "Explore BankHotel rooms in Lviv, view photos and current prices, and choose dates for your stay. Room availability is updated when you book." }));
// Keep previously shared URLs working. These contain no stale room content.
for (const { slug, name, description } of legacyRooms) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new Error("Invalid legacy room slug");
  files.set(`rooms/${slug}.html`, render(roomTemplate, { base: "../", slug, pageTitle: name + " · BankHotel", pageDescription: description }));
}
const facilityCards = [];
for (const [i, facility] of facilities.entries()) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(facility.slug)) throw new Error("Invalid facility slug");
  files.set(`facilities/${facility.slug}.html`, render(read("templates/facility.html"), facility));
  facilityCards.push(render(read("templates/facility-card.html"), { ...facility, number: String(i + 1).padStart(2, "0") }).trimEnd());
}
let home = replaceCards(read("index.html"), "room-template", [read("templates/room-card.html").trimEnd()]);
home = replaceCards(home, "facility-cards", facilityCards);
files.set("index.html", home);
for (const [file, source] of files) {
  const html = source.replace(/<img\b[^>]*>/g, tag => {
    const match = tag.match(/src="([^" ]*assets\/img\/)([^"/]+)"/);
    const image = match && imageManifest[match[2]];
    if (!image) return tag;
    let result = tag.replace(match[1] + match[2], match[1] + image.file).replace(/\s(?:width|height)="[^"]*"/g, '');
    result = result.slice(0, -1) + ` width="${image.width}" height="${image.height}">`;
    if (!/loading=|fetchpriority=|data-room-image/.test(result)) result = result.slice(0, -1) + ' loading="lazy" decoding="async">';
    return result;
  });
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target) || read(file) !== html) fs.writeFileSync(target, html);
}
console.log("Generated dynamic room shells, legacy room URLs and facility pages. Room records come from Supabase.");
