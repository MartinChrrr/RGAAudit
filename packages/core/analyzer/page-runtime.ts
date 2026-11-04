import type { Page } from 'playwright';

/**
 * The development server runs through tsx, whose keepNames transform wraps
 * nested functions sent to Playwright with an internal `__name` helper. The
 * helper belongs to the Node bundle and is not available in the page context.
 * Install a tiny page-local fallback before any evaluate/addInitScript callback
 * is executed so DOM collection remains independent from the Node bundler.
 */
const PAGE_RUNTIME = `
(() => {
  const scope = globalThis;
  if (typeof scope.__name !== 'function') {
    Object.defineProperty(scope, '__name', {
      value: (target) => target,
      configurable: true,
      writable: false,
    });
  }
})();
`;

export async function installPageEvaluateRuntime(page: Page): Promise<void> {
  await page.addInitScript({ content: PAGE_RUNTIME });
  await page.evaluate(PAGE_RUNTIME);
}
