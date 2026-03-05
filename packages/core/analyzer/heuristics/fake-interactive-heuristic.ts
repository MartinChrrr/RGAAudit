import type { Page } from 'playwright';
import type { HeuristicAnalyzer, HeuristicResult, HeuristicFinding } from './heuristic.interface';

const HEURISTIC_ID = 'fake-interactive';
const RGAA_CRITERIA = ['7.1'];

const INTERACTIVE_ROLES = new Set([
  'button', 'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio',
  'option', 'tab', 'treeitem', 'switch', 'checkbox', 'radio',
  'combobox', 'listbox', 'slider', 'spinbutton', 'textbox',
  'searchbox', 'gridcell', 'scrollbar',
]);

const FAKE_HREF_PATTERNS = ['#', '', 'javascript:void(0)', 'javascript:;'];

const NAVIGATION_PATTERNS = [
  'window.location', 'window.open', 'history.push',
  'history.pushState', 'location.href',
];

/**
 * Heuristique fake-interactive :
 * Détecte les éléments interactifs non-natifs et les patterns suspects
 * qu'axe-core ne peut pas évaluer.
 */
const fakeInteractiveHeuristic: HeuristicAnalyzer = {
  async analyze(page: Page): Promise<HeuristicResult> {
    try {
      const findings: HeuristicFinding[] = [];

      const detected = await page.evaluate(
        ({ fakeHrefPatterns, interactiveRoles: interactiveRolesArr, navigationPatterns }) => {
          const interactiveRoles = new Set(interactiveRolesArr);
          const results: Array<{
            type: string;
            selector: string;
            html: string;
            context: string;
          }> = [];

          // Helper: build a unique selector for an element
          function getSelector(el: Element): string {
            if (el.id) return `#${el.id}`;
            const tag = el.tagName.toLowerCase();
            const parent = el.parentElement;
            if (!parent) return tag;
            const siblings = Array.from(parent.children).filter(
              (c) => c.tagName === el.tagName,
            );
            if (siblings.length === 1) return `${getSelector(parent)} > ${tag}`;
            const idx = siblings.indexOf(el) + 1;
            return `${getSelector(parent)} > ${tag}:nth-of-type(${idx})`;
          }

          function getContext(el: Element): string {
            return (el.textContent ?? '').trim().slice(0, 100);
          }

          function getHtml(el: Element): string {
            return el.outerHTML.slice(0, 200);
          }

          function hasInteractiveChild(el: Element): boolean {
            return el.querySelector('button, a[href], input, select, textarea') !== null;
          }

          // CAS 1 — <a> avec href factice ET onclick
          const links = document.querySelectorAll('a[href]');
          for (const a of links) {
            const href = (a.getAttribute('href') ?? '').trim();
            const hasOnclick = a.hasAttribute('onclick');
            if (fakeHrefPatterns.includes(href) && hasOnclick) {
              results.push({
                type: 'FAKE_LINK',
                selector: getSelector(a),
                html: getHtml(a),
                context: getContext(a),
              });
            }
          }

          // CAS 2 — <div>/<span> cliquable sans rôle
          const clickables = document.querySelectorAll('div[onclick], span[onclick]');
          for (const el of clickables) {
            const role = (el.getAttribute('role') ?? '').toLowerCase();
            if (interactiveRoles.has(role)) continue;
            if (hasInteractiveChild(el)) continue;
            const cursor = window.getComputedStyle(el).cursor;
            if (cursor === 'pointer' || el.hasAttribute('onclick')) {
              results.push({
                type: 'DIV_CLICKABLE',
                selector: getSelector(el),
                html: getHtml(el),
                context: getContext(el),
              });
            }
          }

          // CAS 3 — role="button" non focusable
          const roleButtons = document.querySelectorAll('[role="button"]');
          const nativeFocusable = new Set([
            'BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'SUMMARY',
          ]);
          for (const el of roleButtons) {
            if (nativeFocusable.has(el.tagName)) continue;
            // Check if it has href (for <a>)
            if (el.hasAttribute('href')) continue;
            const tabindex = el.getAttribute('tabindex');
            if (tabindex !== null && parseInt(tabindex, 10) >= 0) continue;
            results.push({
              type: 'MISSING_ROLE',
              selector: getSelector(el),
              html: getHtml(el),
              context: getContext(el),
            });
          }

          // CAS 4 — <button> qui navigue
          const buttons = document.querySelectorAll('button[onclick]');
          for (const btn of buttons) {
            const onclick = btn.getAttribute('onclick') ?? '';
            const navigates = navigationPatterns.some((p) => onclick.includes(p));
            if (navigates) {
              results.push({
                type: 'FAKE_BUTTON',
                selector: getSelector(btn),
                html: getHtml(btn),
                context: getContext(btn),
              });
            }
          }

          // CAS 5 — tabindex="0" sans rôle (div/span uniquement)
          const focusables = document.querySelectorAll(
            'div[tabindex="0"], span[tabindex="0"]',
          );
          for (const el of focusables) {
            const role = (el.getAttribute('role') ?? '').toLowerCase();
            if (interactiveRoles.has(role)) continue;
            if (el.hasAttribute('onclick')) continue;
            results.push({
              type: 'TABINDEX_NO_ROLE',
              selector: getSelector(el),
              html: getHtml(el),
              context: getContext(el),
            });
          }

          return results;
        },
        {
          fakeHrefPatterns: FAKE_HREF_PATTERNS,
          interactiveRoles: [...INTERACTIVE_ROLES],
          navigationPatterns: NAVIGATION_PATTERNS,
        },
      );

      for (const item of detected) {
        let confidence: HeuristicFinding['confidence'];
        let evidence: string;

        switch (item.type) {
          case 'FAKE_LINK':
            confidence = 'certain';
            evidence = `<a href='#'> avec handler onclick — utiliser <button> pour les actions`;
            break;
          case 'DIV_CLICKABLE':
            confidence = 'certain';
            evidence = `<div onclick> sans role ARIA — inaccessible au clavier et aux lecteurs d'écran`;
            break;
          case 'MISSING_ROLE':
            confidence = 'certain';
            evidence = `role='button' sans tabindex='0' — non atteignable au clavier`;
            break;
          case 'FAKE_BUTTON':
            confidence = 'likely';
            evidence = `<button> utilisé pour naviguer — préférer <a href> pour les liens`;
            break;
          case 'TABINDEX_NO_ROLE':
            confidence = 'possible';
            evidence = `élément focusable sans rôle déclaré — comportement incertain pour les AT`;
            break;
          default:
            continue;
        }

        findings.push({
          selector: item.selector,
          html: item.html.slice(0, 200),
          evidence,
          confidence,
          context: item.context.slice(0, 100),
        });
      }

      return {
        heuristicId: HEURISTIC_ID,
        rgaaCriteria: RGAA_CRITERIA,
        findings,
        error: null,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        heuristicId: HEURISTIC_ID,
        rgaaCriteria: RGAA_CRITERIA,
        findings: [],
        error: message,
      };
    }
  },
};

export default fakeInteractiveHeuristic;
