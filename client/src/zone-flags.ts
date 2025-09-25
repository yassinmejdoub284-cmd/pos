// Enable passive listeners for scroll-blocking events to reduce main-thread jank
// Must be loaded BEFORE zone.js
// Ref: https://angular.io/guide/zone#zone-flags
(window as unknown as { __Zone_disable_customElements?: boolean }).__Zone_disable_customElements = false;

(window as unknown as { __zone_symbol__PASSIVE_EVENTS?: string[] }).__zone_symbol__PASSIVE_EVENTS = [
  // Touch
  'touchstart',
  'touchmove',
  'touchend',
  // Pointer
  'pointerdown',
  'pointermove',
  'pointerup',
  // Mouse/Scroll
  'wheel',
  'mousewheel',
  'scroll'
];


