const burger = document.querySelector(".burger");
const header = document.querySelector(".header");

burger.addEventListener("click", () => {
  header.classList.toggle("open");
  burger.classList.toggle("active");
  burger.setAttribute("aria-expanded", String(header.classList.contains("open")));
});

header.querySelector(".main-menu").addEventListener("click", event => {
  if (event.target.closest("a")) {
    header.classList.remove("open");
    burger.classList.remove("active");
    burger.setAttribute("aria-expanded", "false");
  }
});

// The asynchronous room slider lives in home-rooms.js.

// Accordion toggle (adds .open to the clicked .accordion-item)
const accordionItems = document.querySelectorAll('.accordion-item');

accordionItems.forEach(item => {
  const toggle = item.querySelector('.accordion-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    // close others
    accordionItems.forEach(otherItem => {
      if (otherItem !== item) {
        otherItem.classList.remove('open');
        const otherToggle = otherItem.querySelector('.accordion-toggle');
        if (otherToggle) otherToggle.setAttribute('aria-expanded', 'false');

        const otherContent = otherItem.querySelector('.accordion-content');
        if (otherContent) otherContent.style.maxHeight = null;
      }
    });

    const isOpen = item.classList.contains('open');
    const content = item.querySelector('.accordion-content');

    if (isOpen) {
      item.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
      if (content) content.style.maxHeight = null;
    } else {
      item.classList.add('open');
      toggle.setAttribute('aria-expanded', 'true');
      if (content) content.style.maxHeight = content.scrollHeight + 'px';
    }
  });
});


const elements = document.querySelectorAll('.animate-on-scroll');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
});

elements.forEach(el => observer.observe(el));

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && header.classList.contains("open")) {
    header.classList.remove("open"); burger.classList.remove("active");
    burger.setAttribute("aria-expanded", "false"); burger.focus();
  }
});
