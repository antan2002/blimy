export const REQUEST_WINDOW_CLOSE_EVENT = "blimy:request-window-close";

export function requestWindowClose() {
  window.dispatchEvent(new CustomEvent(REQUEST_WINDOW_CLOSE_EVENT));
}
