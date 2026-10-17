export interface PageReader {
  isVisible(element: Element): boolean;
  text(element: Element): string;
  name(element: Element): string;
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
  function name(element: Element): string {
    const aria = element.getAttribute('aria-label')?.trim();
    if (aria) return aria;
    const labelled = (element.getAttribute('aria-labelledby') ?? '').split(/\s+/)
      .map(id => document.getElementById(id)).filter((e): e is HTMLElement => !!e && isVisible(e)).map(text).join(' ').trim();
    if (labelled) return labelled;
    const title = element.namespaceURI === 'http://www.w3.org/2000/svg' ?
      [...element.children].find(child => child.localName === 'title' && !child.matches('[aria-hidden="true"]'))?.textContent?.trim() : undefined;
    if (title) return title;
    const images = [...element.querySelectorAll('img[alt]')].filter(isVisible).map(e => e.getAttribute('alt')?.trim()).filter(Boolean);
    return [...images, text(element)].filter(Boolean).join(' ');
  }
  return { isVisible, text, name };
}
