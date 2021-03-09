/**
 * copied from this: https://gilfink.medium.com/quick-tip-creating-an-xmlhttprequest-interceptor-1da23cf90b76
 * a stupid hack to check the loading progress of mediapipe's model
 */
const oldXHROpen = window.XMLHttpRequest.prototype.open;

const files = [];
const handlers = [];

window.XMLHttpRequest.prototype.open = function (method, url, async, user, password) {
  const index = files.indexOf(url);
  if (index !== -1) {
    handlers[index](this);
  }

	return oldXHROpen.apply(this, arguments);
}

export function interceptFileRequest(url, cb) {
  console.assert(typeof url === "string");
  console.assert(typeof cb === "function");
  files.push(url);
  handlers.push(cb);
}
