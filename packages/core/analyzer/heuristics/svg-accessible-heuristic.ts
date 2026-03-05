import type { Page } from 'playwright';
import type { HeuristicAnalyzer, HeuristicResult, HeuristicFinding } from './heuristic.interface';

const HEURISTIC_ID = 'svg-accessible';
const RGAA_CRITERIA = ['1.1'];

const DECORATIVE_CLASS_PATTERNS = ['icon', 'decoration', 'ornament'];

/**
 * Heuristique svg-accessible :
 * Détecte les SVG informatifs sans alternative textuelle,
 * les icônes SVG dans des contrôles sans label,
 * et les SVG décoratifs non masqués aux technologies d'assistance.
 */
const svgAccessibleHeuristic: HeuristicAnalyzer = {
  async analyze(page: Page): Promise<HeuristicResult> {
    try {
      const findings: HeuristicFinding[] = [];

      const detected = await page.evaluate(
        ({ decorativeClassPatterns }) => {
          const results: Array<{
            type: string;
            selector: string;
            html: string;
            context: string;
          }> = [];

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

          function hasTitle(svg: Element): boolean {
            for (const child of svg.children) {
              if (child.tagName.toLowerCase() === 'title') return true;
            }
            return false;
          }

          function hasTextChild(svg: Element): boolean {
            return svg.querySelector('text') !== null;
          }

          const svgs = document.querySelectorAll('svg');

          for (const svg of svgs) {
            // EXCLUSIONS
            if (svg.getAttribute('aria-hidden') === 'true') continue;
            if (svg.getAttribute('role') === 'presentation') continue;
            if (hasTextChild(svg)) continue;

            // Check if ancestor has aria-hidden
            let ancestorHidden = false;
            let current: Element | null = svg.parentElement;
            while (current) {
              if (current.getAttribute('aria-hidden') === 'true') {
                ancestorHidden = true;
                break;
              }
              current = current.parentElement;
            }
            if (ancestorHidden) continue;

            const role = svg.getAttribute('role');
            const ariaLabel = svg.getAttribute('aria-label');
            const ariaLabelledby = svg.getAttribute('aria-labelledby');
            const svgHasTitle = hasTitle(svg);

            // CAS 1 — SVG informatif sans <title>
            if (role === 'img') {
              if (!svgHasTitle) {
                // Also check if aria-labelledby points to a missing id
                let ariaRefMissing = false;
                if (ariaLabelledby) {
                  const refEl = document.getElementById(ariaLabelledby);
                  if (!refEl) ariaRefMissing = true;
                }

                if (!ariaLabel && (!ariaLabelledby || ariaRefMissing)) {
                  results.push({
                    type: 'SVG_NO_TITLE',
                    selector: getSelector(svg),
                    html: getHtml(svg),
                    context: getContext(svg),
                  });
                }
              }
              continue; // role="img" with title is fine
            }

            // CAS 2 — SVG icône dans un bouton/lien sans label
            const parent = svg.parentElement;
            if (parent && (parent.tagName === 'BUTTON' || parent.tagName === 'A')) {
              // Check if SVG is the only meaningful content
              const otherText = Array.from(parent.childNodes)
                .filter((n) => n !== svg)
                .map((n) => (n.textContent ?? '').trim())
                .join('')
                .trim();

              if (otherText.length === 0) {
                // SVG is the sole content — check labels
                const svgHasLabel = svgHasTitle || !!ariaLabel || !!ariaLabelledby;
                const parentAriaLabel = parent.getAttribute('aria-label');
                const parentAriaLabelledby = parent.getAttribute('aria-labelledby');
                const parentTitle = parent.getAttribute('title');
                const parentHasLabel = !!parentAriaLabel || !!parentAriaLabelledby || !!parentTitle;

                if (!svgHasLabel && !parentHasLabel) {
                  results.push({
                    type: 'SVG_ICON_NO_LABEL',
                    selector: getSelector(parent),
                    html: getHtml(parent),
                    context: getContext(parent),
                  });
                }
              }
              continue;
            }

            // CAS 3 — SVG décoratif non masqué
            if (!svgHasTitle && !ariaLabel && !ariaLabelledby) {
              const rect = svg.getBoundingClientRect();
              const isSmall = rect.width < 32 && rect.height < 32 && rect.width > 0 && rect.height > 0;

              const classList = svg.className?.toString?.() ?? '';
              const isDecoClass = decorativeClassPatterns.some(
                (p: string) => classList.toLowerCase().includes(p),
              );
              const hasDataDecorative = svg.getAttribute('data-decorative') === 'true';

              if (isSmall || isDecoClass || hasDataDecorative) {
                results.push({
                  type: 'SVG_DECORATIVE_NOT_HIDDEN',
                  selector: getSelector(svg),
                  html: getHtml(svg),
                  context: getContext(svg),
                });
              }
            }
          }

          return results;
        },
        {
          decorativeClassPatterns: DECORATIVE_CLASS_PATTERNS,
        },
      );

      for (const item of detected) {
        let confidence: HeuristicFinding['confidence'];
        let evidence: string;

        switch (item.type) {
          case 'SVG_NO_TITLE':
            confidence = 'certain';
            evidence = `<svg role='img'> sans <title> enfant — les lecteurs d'écran n'ont rien à lire`;
            break;
          case 'SVG_ICON_NO_LABEL':
            confidence = 'certain';
            evidence = `<button><svg>...</svg></button> sans label — le bouton est muet pour les AT`;
            break;
          case 'SVG_DECORATIVE_NOT_HIDDEN':
            confidence = 'likely';
            evidence = `<svg> probablement décoratif non masqué — ajouter aria-hidden='true' ou confirmer s'il porte de l'information`;
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

export default svgAccessibleHeuristic;
