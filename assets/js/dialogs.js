// A backdrop gesture must start AND end outside the dialog, so selecting text
// inside a form and releasing the pointer outside cannot accidentally close it.
function dismissOnBackdrop(dialog, canClose = () => true) {
  let startedOutside = false;
  function outside(event) {
    const box = dialog.getBoundingClientRect();
    return event.target === dialog && (event.clientX < box.left || event.clientX > box.right ||
      event.clientY < box.top || event.clientY > box.bottom);
  }
  dialog.addEventListener("pointerdown", event => {
    startedOutside = event.button === 0 && outside(event);
  });
  dialog.addEventListener("pointercancel", () => { startedOutside = false; });
  dialog.addEventListener("click", event => {
    const dismiss = startedOutside && outside(event);
    startedOutside = false;
    if (dialog.open && dismiss && canClose()) dialog.close();
  });
  dialog.addEventListener("close", () => { startedOutside = false; });
}
