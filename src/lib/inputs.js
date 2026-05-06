// onFocus handler that moves the caret to the end of a numeric input. Use
// only on numeric inputs — text inputs may legitimately want mid-string
// editing. Wrapped in a setTimeout because iOS positions the caret AFTER
// the focus event fires, so a synchronous setSelectionRange gets overridden.
export function focusToEnd(e) {
  const el = e.target;
  setTimeout(() => {
    const v = el.value;
    el.setSelectionRange(v.length, v.length);
  }, 0);
}
