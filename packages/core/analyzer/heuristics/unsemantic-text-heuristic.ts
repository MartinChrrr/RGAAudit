import type { Page } from 'playwright';
import type { HeuristicAnalyzer, HeuristicResult, HeuristicFinding } from './heuristic.interface';

const HEURISTIC_ID = 'unsemantic-text';
const RGAA_CRITERIA = ['8.9'];

const SEMANTIC_CHILDREN_TAGS = [
  'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'UL', 'OL', 'DL', 'BLOCKQUOTE', 'ARTICLE', 'SECTION', 'NAV', 'ASIDE', 'FIGURE',
];

const EXCLUDED_ANCESTORS = ['NAV', 'HEADER', 'FOOTER', 'SCRIPT', 'STYLE', 'NOSCRIPT'];

const LIST_BULLET_PATTERN = /^[\u2022\u25AA\u25B8\u2192\-\*]\s/; // •, ▪, ▸, →, -, *
const LIST_NUMBERED_PATTERN = /^\d+[.)]\s/;

/**
 * Heuristique unsemantic-text :
 * Détecte les éléments de contenu texte qui utilisent des balises non sémantiques
 * (div/span stylés comme titres, doubles <br> au lieu de <p>, listes simulées).
 */
const unsemanticTextHeuristic: HeuristicAnalyzer = {
  async analyze(page: Page): Promise<HeuristicResult> {
    try {
      const findings: HeuristicFinding[] = [];

      const detected = await page.evaluate(
        ({ semanticChildrenTags, excludedAncestors, bulletPattern, numberedPattern }) => {
          const results: Array<{
            type: string;
            selector: string;
            html: string;
            context: string;
          }> = [];

          const semanticSet = new Set(semanticChildrenTags);
          const excludedSet = new Set(excludedAncestors);

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

          // Check if element is in an excluded ancestor
          function isExcluded(el: Element): boolean {
            let current: Element | null = el;
            while (current) {
              if (excludedSet.has(current.tagName)) return true;
              if (current.getAttribute('role') === 'presentation' || current.getAttribute('role') === 'none') return true;
              if (current.getAttribute('aria-hidden') === 'true') return true;
              current = current.parentElement;
            }
            return false;
          }

          // Check if element is hidden
          function isHidden(el: Element): boolean {
            const style = window.getComputedStyle(el);
            return style.display === 'none' || style.visibility === 'hidden';
          }

          // Check if a div/span has a direct semantic child
          function hasSemanticChild(el: Element): boolean {
            for (const child of el.children) {
              if (semanticSet.has(child.tagName)) return true;
            }
            return false;
          }

          // Check if element is inside a heading
          function isInsideHeading(el: Element): boolean {
            let current: Element | null = el.parentElement;
            while (current) {
              if (/^H[1-6]$/.test(current.tagName)) return true;
              current = current.parentElement;
            }
            return false;
          }

          // Get direct text content (only text nodes, not children elements)
          function getDirectTextContent(el: Element): string {
            let text = '';
            for (const node of el.childNodes) {
              if (node.nodeType === Node.TEXT_NODE) {
                text += node.textContent ?? '';
              }
            }
            return text.trim();
          }

          // CAS 1 — Titre simulé en CSS
          const potentialHeadings = document.querySelectorAll('div, span');
          for (const el of potentialHeadings) {
            if (isExcluded(el) || isHidden(el)) continue;
            if (hasSemanticChild(el)) continue;
            if (isInsideHeading(el)) continue;

            const directText = getDirectTextContent(el);
            if (directText.length < 5 || directText.length > 120) continue;

            const style = window.getComputedStyle(el);
            const fontSize = parseFloat(style.fontSize);
            const fontWeight = parseInt(style.fontWeight, 10) || (style.fontWeight === 'bold' ? 700 : 400);

            const isFakeHeading =
              (fontSize > 18 && fontWeight >= 700) ||
              (fontSize > 24);

            if (isFakeHeading) {
              results.push({
                type: 'FAKE_HEADING',
                selector: getSelector(el),
                html: getHtml(el),
                context: getContext(el),
              });
            }
          }

          // CAS 2 — Paragraphe simulé avec <br><br>
          const brContainers = document.querySelectorAll('div, span, td');
          for (const el of brContainers) {
            if (el.tagName === 'P') continue;
            if (isExcluded(el) || isHidden(el)) continue;

            const brs = el.querySelectorAll('br');
            let hasConsecutiveBr = false;
            for (const br of brs) {
              const next = br.nextSibling;
              // Check: br immediately followed by another br (possibly with whitespace text between)
              if (next && next.nodeType === Node.ELEMENT_NODE && (next as Element).tagName === 'BR') {
                hasConsecutiveBr = true;
                break;
              }
              // Check: br followed by whitespace-only text then another br
              if (next && next.nodeType === Node.TEXT_NODE && next.textContent?.trim() === '') {
                const afterText = next.nextSibling;
                if (afterText && afterText.nodeType === Node.ELEMENT_NODE && (afterText as Element).tagName === 'BR') {
                  hasConsecutiveBr = true;
                  break;
                }
              }
            }

            if (hasConsecutiveBr) {
              results.push({
                type: 'FAKE_PARAGRAPH',
                selector: getSelector(el),
                html: getHtml(el),
                context: getContext(el),
              });
            }
          }

          // CAS 3 — Liste simulée avec caractères unicode
          const bulletRe = new RegExp(bulletPattern);
          const numberedRe = new RegExp(numberedPattern);

          // Check all parent elements for consecutive matching children
          const parents = new Set<Element>();
          document.querySelectorAll('div, p').forEach((el) => {
            if (el.parentElement) parents.add(el.parentElement);
          });

          for (const parent of parents) {
            if (isExcluded(parent) || isHidden(parent)) continue;

            const children = Array.from(parent.children).filter(
              (c) => c.tagName === 'DIV' || c.tagName === 'P',
            );

            let streak = 0;
            let streakStart = 0;
            let lastBullet = '';

            for (let i = 0; i < children.length; i++) {
              const text = (children[i].textContent ?? '').trim();
              const matchBullet = bulletRe.test(text);
              const matchNumbered = numberedRe.test(text);

              if (matchBullet || matchNumbered) {
                if (streak === 0) streakStart = i;
                streak++;
                if (matchBullet) {
                  lastBullet = text.charAt(0);
                } else {
                  lastBullet = 'num';
                }
              } else {
                if (streak >= 3) {
                  results.push({
                    type: 'FAKE_LIST',
                    selector: getSelector(children[streakStart]),
                    html: getHtml(children[streakStart]),
                    context: `${streak} éléments consécutifs commençant par '${lastBullet === 'num' ? '1.' : lastBullet}'`,
                  });
                }
                streak = 0;
              }
            }
            // Check streak at end
            if (streak >= 3) {
              results.push({
                type: 'FAKE_LIST',
                selector: getSelector(children[streakStart]),
                html: getHtml(children[streakStart]),
                context: `${streak} éléments consécutifs commençant par '${lastBullet === 'num' ? '1.' : lastBullet}'`,
              });
            }
          }

          // CAS 4 — Texte long dans un <div>
          const divs = document.querySelectorAll('div');
          for (const el of divs) {
            if (isExcluded(el) || isHidden(el)) continue;
            if (hasSemanticChild(el)) continue;
            if (el.getAttribute('role')) continue;

            // Exclude components with data-* attributes (React/Vue)
            const hasDataAttr = Array.from(el.attributes).some(
              (a) => a.name.startsWith('data-'),
            );
            if (hasDataAttr) continue;

            const directText = getDirectTextContent(el);
            if (directText.length > 80) {
              results.push({
                type: 'TEXT_IN_DIV',
                selector: getSelector(el),
                html: getHtml(el),
                context: getContext(el),
              });
            }
          }

          return results;
        },
        {
          semanticChildrenTags: SEMANTIC_CHILDREN_TAGS,
          excludedAncestors: EXCLUDED_ANCESTORS,
          bulletPattern: LIST_BULLET_PATTERN.source,
          numberedPattern: LIST_NUMBERED_PATTERN.source,
        },
      );

      for (const item of detected) {
        let confidence: HeuristicFinding['confidence'];
        let evidence: string;

        switch (item.type) {
          case 'FAKE_HEADING':
            confidence = 'likely';
            evidence = `<div style='font-size:…;font-weight:bold'> — probablement un titre, utiliser <h2> (ou le niveau approprié)`;
            break;
          case 'FAKE_PARAGRAPH':
            confidence = 'certain';
            evidence = `Doubles <br> utilisés comme séparateurs de paragraphes — utiliser des balises <p> distinctes`;
            break;
          case 'FAKE_LIST':
            confidence = 'likely';
            evidence = `${item.context} — utiliser <ul><li>`;
            break;
          case 'TEXT_IN_DIV':
            confidence = 'possible';
            evidence = `Texte de contenu long dans un <div> sans balise sémantique`;
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

export default unsemanticTextHeuristic;
