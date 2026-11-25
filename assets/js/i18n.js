// One small DOM translator shared by static pages and asynchronously rendered UI.
// It changes text/accessible labels only, never form values, URLs or API payloads.
(() => {
  'use strict';
  const storageKey = 'bankhotel.language';
  const dictionary = window.HOTEL_UK || {};
  const normalize = value => value.replace(/\s+/g, ' ').trim();
  const originals = new WeakMap();
  const attributes = new WeakMap();
  const ignored = 'script, style, noscript, code, textarea, [contenteditable], [translate="no"], [data-language-switch]';
  const labelAttributes = ['aria-label', 'placeholder', 'title', 'alt'];
  let language = 'en';
  try { if (sessionStorage.getItem(storageKey) === 'uk') language = 'uk'; } catch { /* Still usable if storage is disabled. */ }
  document.documentElement.lang = language;

  function plural(count, one, few, many) {
    const category = new Intl.PluralRules('uk').select(Number(count));
    return category === 'one' ? one : category === 'few' ? few : many;
  }
  function translateLine(source) {
    const text = normalize(source);
    if (Object.hasOwn(dictionary, text)) return dictionary[text];
    let match;
    if ((match = text.match(/^(\d+) rooms? found$/))) return `Знайдено ${match[1]} ${plural(match[1], 'номер', 'номери', 'номерів')}`;
    if ((match = text.match(/^(\d+) rooms?$/))) return `${match[1]} ${plural(match[1], 'номер', 'номери', 'номерів')}`;
    if ((match = text.match(/^(\d+) nights?(.*)$/))) return `${match[1]} ${plural(match[1], 'ніч', 'ночі', 'ночей')}${translateLine(match[2]) ? ' ' + translateLine(match[2]) : ''}`;
    if ((match = text.match(/^Delete “(.+)”\?$/))) return `Видалити «${translateLine(match[1])}»?`;
    if ((match = text.match(/^(View|Edit|Delete) (.+)$/))) return ({View:'Переглянути',Edit:'Редагувати',Delete:'Видалити'})[match[1]] + ' ' + translateLine(match[2]);
    if ((match = text.match(/^Signed in as (.+)$/))) return 'Ви увійшли як ' + match[1];
    if ((match = text.match(/^Pay (.+) \(demo\)$/))) return 'Оплатити ' + translateLine(match[1]) + ' (демо)';
    if ((match = text.match(/^Booking reference: (.+)$/))) return 'Номер бронювання: ' + match[1];
    if ((match = text.match(/^(.+) overview$/))) return 'Огляд: ' + translateLine(match[1]);
    if ((match = text.match(/^(.+) · BankHotel$/))) return translateLine(match[1]) + ' · BankHotel';
    if ((match = text.match(/^(.+) (interior|bedroom)$/))) return (match[2] === 'interior' ? 'Інтер’єр: ' : 'Спальня: ') + translateLine(match[1]);
    // Receipt: translate its room/payment label; preserve the guest's name and IDs.
    if ((match = text.match(/^(.+?) · (.+)$/))) {
      const label = match[1] === 'Total' ? 'Разом' : translateLine(match[1]);
      return label + ' · ' + (/(?:UAH|₴)/.test(match[2]) ? translateLine(match[2]) : match[2]);
    }
    const refreshSuffix = ' The list could not refresh. Press Refresh to load the latest rooms.';
    if (text.endsWith(refreshSuffix)) return translateLine(text.slice(0, -refreshSuffix.length)) + ' ' + dictionary[refreshSuffix.trim()];
    // These formats are produced by our existing English Intl formatters.
    return text.replace(/(?:UAH|₴)\s*([\d,]+\.\d{2})/g, (_, amount) =>
      new Intl.NumberFormat('uk-UA', {style:'currency', currency:'UAH'}).format(Number(amount.replaceAll(',', ''))))
      .replace(/\b(\d{1,2}) ([A-Z][a-z]{2,3}) (\d{4})\b/g, (original, day, month, year) => {
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const index = months.indexOf(month === 'Sept' ? 'Sep' : month);
        return index < 0 ? original : new Intl.DateTimeFormat('uk-UA', {day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(Number(year),index,Number(day))));
      }).replace(/\s*\/ night$/, ' / ніч');
  }
  function t(source) {
    if (language === 'en' || !source.trim()) return source;
    // Preserve line breaks in receipts and whitespace around nested spans/emphasis.
    return source.split('\n').map(line => {
      if (!line.trim()) return line;
      return line.match(/^\s*/)[0] + translateLine(line) + line.match(/\s*$/)[0];
    }).join('\n');
  }
  function textNode(node) {
    if (!node.parentElement || node.parentElement.closest(ignored)) return;
    const current = node.data;
    let record = originals.get(node);
    if (!record || current !== record.rendered) record = {source:current};
    record.rendered = t(record.source);
    originals.set(node, record);
    if (current !== record.rendered) node.data = record.rendered;
  }
  function elementLabels(element) {
    if (element.closest(ignored)) return;
    const names = element.matches('meta[name="description"]') ? ['content'] : labelAttributes;
    const records = attributes.get(element) || {};
    for (const name of names) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name);
      let record = records[name];
      if (!record || current !== record.rendered) record = {source:current};
      record.rendered = t(record.source);
      records[name] = record;
      if (current !== record.rendered) element.setAttribute(name, record.rendered);
    }
    attributes.set(element, records);
  }
  function translateTree(root) {
    if (root.nodeType === Node.TEXT_NODE) { textNode(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE || root.closest(ignored)) return;
    elementLabels(root);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) { return node.nodeType === Node.ELEMENT_NODE && node.matches(ignored) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE) textNode(node);
      else elementLabels(node);
    }
  }
  function setLanguage(next) {
    if (!['en','uk'].includes(next)) return;
    language = next;
    try { sessionStorage.setItem(storageKey, language); } catch { /* No localStorage/cookies fallback: session scope only. */ }
    document.documentElement.lang = language;
    translateTree(document.documentElement);
    document.querySelectorAll('[data-language-switch] select').forEach(select => { select.value = language; });
    // Our custom validity messages also follow the current language. Browser-built
    // required/email messages follow the browser/OS language, as usual.
    document.querySelectorAll('input, textarea, select').forEach(field => {
      if (!field.validity.customError) return;
      const source = Object.keys(dictionary).find(key => dictionary[key] === field.validationMessage) || field.validationMessage;
      field.setCustomValidity(t(source));
    });
    document.dispatchEvent(new CustomEvent('hotel-language-change', {detail:{language}}));
  }
  function originalText(element) {
    if (element.nodeType === Node.TEXT_NODE) return originals.get(element)?.source ?? element.data;
    return [...element.childNodes].map(originalText).join('');
  }
  function searchText(source) { const text = String(source ?? ''); return text + ' ' + translateLine(text); }
  window.HotelI18n = {t, setLanguage, originalText, searchText, get language() { return language; }, storageKey};

  function initialize() {
    const switcher = document.createElement('label');
    switcher.className = 'language-switch';
    switcher.setAttribute('data-language-switch', '');
    switcher.setAttribute('translate', 'no');
    const label = document.createElement('span');
    label.className = 'language-label'; label.textContent = 'Language / Мова';
    const select = document.createElement('select');
    select.setAttribute('aria-label', 'Language / Мова');
    select.append(new Option('EN', 'en'), new Option('УКР', 'uk'));
    select.options[0].lang = 'en'; select.options[1].lang = 'uk';
    select.value = language;
    select.addEventListener('change', () => setLanguage(select.value));
    switcher.append(label, select);
    const header = document.querySelector('header.header, header.masthead');
    if (header) header.insertBefore(switcher, header.querySelector('.burger'));
    else { switcher.classList.add('language-switch-standalone'); document.body.prepend(switcher); }
    translateTree(document.documentElement);
    const observer = new MutationObserver(records => {
      // Translate only changed subtrees. Original English is retained per node,
      // so toggling back never requires a reload or a second database request.
      for (const record of records) {
        if (record.type === 'characterData') textNode(record.target);
        else if (record.type === 'attributes') elementLabels(record.target);
        else record.addedNodes.forEach(translateTree);
      }
    });
    observer.observe(document.documentElement, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:[...labelAttributes,'content']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, {once:true});
  else initialize();
})();
