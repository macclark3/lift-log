// onFocus handler that moves the caret to the end of a numeric input. Use
// only on numeric inputs — text inputs may legitimately want mid-string
// editing. Wrapped in a setTimeout because iOS positions the caret AFTER
// the focus event fires, so a synchronous setSelectionRange gets overridden.
//
// Wrapped in try/catch because type="number" inputs throw InvalidStateError
// in Chromium-family browsers — they explicitly don't support selection on
// numeric inputs. The caret position falls back to wherever the browser
// puts it; better than logging a console error every focus.
export function focusToEnd(e) {
  const el = e.target;
  setTimeout(() => {
    try {
      const v = el.value;
      el.setSelectionRange(v.length, v.length);
    } catch {
      // No-op: type="number" doesn't support selection in all browsers.
    }
  }, 0);
}
