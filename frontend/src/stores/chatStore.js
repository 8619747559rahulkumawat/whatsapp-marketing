let unreadCount = 0;
let listeners = [];

export function getUnreadCount() {
  return unreadCount;
}

export function setUnreadCount(n) {
  unreadCount = n;
  listeners.forEach(fn => fn(unreadCount));
}

export function incrementUnread() {
  unreadCount++;
  listeners.forEach(fn => fn(unreadCount));
}

export function resetUnread() {
  unreadCount = 0;
  listeners.forEach(fn => fn(unreadCount));
}

export function onUnreadChange(fn) {
  listeners.push(fn);
  return () => { listeners = listeners.filter(f => f !== fn); };
}
