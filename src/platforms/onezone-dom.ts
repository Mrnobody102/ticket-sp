export interface PageReader {
  isVisible(element: Element): boolean;
  text(element: Element): string;
}

/** Cache only within one inspection: the next DOM update always gets fresh values. */
export function createPageReader(document: Document): PageReader {
  const visibility = new WeakMap<Element, boolean>();
  const texts = new WeakMap<Element, string>();
  const view = document.defaultView;
  function isVisible(element: Element): boolean {
    const cached = visibility.get(element);
    if (cached !== undefined) return cached;
    let result = false;
    if (!element.matches('[data-ticket-assistant], [hidden], [aria-hidden="true"], [inert], script, style, template, noscript') &&
        (!element.parentElement || isVisible(element.parentElement))) {
      const style = view?.getComputedStyle(element);
      result = style?.display !== 'none' && style?.visibility !== 'hidden' && style?.visibility !== 'collapse' &&
        style?.opacity !== '0' && element.getClientRects().length > 0;
    }
    visibility.set(element, result);
    return result;
  }
  function text(element: Element): string {
    const cached = texts.get(element);
    if (cached !== undefined) return cached;
    const walker = document.createTreeWalker(element, 4 /* SHOW_TEXT */);
    const parts: string[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.parentElement && isVisible(node.parentElement)) parts.push(node.textContent ?? '');
    }
    const result = parts.join(' ').replace(/\s+/g, ' ').trim();
    texts.set(element, result);
    return result;
  }
  return { isVisible, text };
}
