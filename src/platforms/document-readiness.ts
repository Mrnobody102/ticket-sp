/** Media must not delay sale detection; unfinished executable scripts still get
 * a bounded chance to bootstrap before the core permits another refresh. */
export function documentBootPending(document: Document): boolean {
  if (document.readyState === 'loading') return true;
  if (document.readyState === 'complete') return false;
  const performance = document.defaultView?.performance;
  if (!performance?.getEntriesByType) return true;
  const finished = new Set(performance.getEntriesByType('resource').map(entry => entry.name));
  return [...document.scripts].some(script => script.src &&
    /^(?:|module|text\/javascript|application\/javascript)$/i.test(script.type) && !finished.has(script.src));
}
