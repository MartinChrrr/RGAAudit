import type { ReactNode } from 'react';

export interface StructureLanguageItem {
  selector: string;
  tagName: string;
  text: string;
  declaredLanguage: string | null;
  effectiveLanguage: string | null;
  languageSource: 'attribute' | 'inherited' | 'missing';
  flags: string[];
}

export interface StructureDirectionItem {
  selector: string;
  tagName: string;
  text: string;
  dirAttribute: string | null;
  effectiveDirection: 'ltr' | 'rtl' | 'auto' | null;
  cssDirection: 'ltr' | 'rtl' | null;
  unicodeBidi: string | null;
  flags: string[];
}

export interface StructureRegionItem {
  selector: string;
  tagName: string;
  role: string | null;
  accessibleName: string | null;
  parentSelector: string | null;
  depth: number;
  childRegionCount: number;
  flags: string[];
}

export interface CitationItem {
  selector: string;
  tagName: string;
  kind: 'q' | 'blockquote' | 'cite' | 'text-quote';
  text: string;
  citeAttribute: string | null;
  flags: string[];
}

export interface StructurePageItem {
  pageUrl: string;
  pageId?: string;
  pageFlags: string[];
  styles: {
    stylesheetCount: number;
    inlineStyleCount: number;
    presentationMarkupCount: number;
    flags: string[];
  };
  languages?: StructureLanguageItem[];
  directions?: StructureDirectionItem[];
  regions?: StructureRegionItem[];
  citations?: CitationItem[];
}

interface Props {
  pages: StructurePageItem[];
}

function pageLabel(page: StructurePageItem): string {
  return page.pageId ? `${page.pageUrl} (identifiant de page ${page.pageId.slice(-8)})` : page.pageUrl;
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2 text-xs text-gray-700 align-top">{children}</td>;
}

function EvidenceTable({
  caption,
  headers,
  children,
}: {
  caption: string;
  headers: string[];
  children: ReactNode;
}) {
  return (
    <div className="mt-4 overflow-x-auto" role="region" tabIndex={0} aria-label={`${caption} — faites défiler horizontalement pour consulter toutes les colonnes`}>
      <table className="w-full min-w-[900px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700">
          <tr>{headers.map((header) => <th key={header} scope="col" className="px-3 py-2">{header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export default function AnnexeStructure({ pages }: Props) {
  return (
    <div data-testid="annexe-structure">
      <p className="mb-4 text-sm text-gray-600">
        Preuves candidates pour les critères RGAA 8.7, 8.10, 9.2 et 9.4. Les observations doivent être vérifiées humainement et ne produisent aucun verdict automatique.
      </p>
      {pages.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">Aucune observation structurelle disponible.</p>
      ) : (
        <div className="space-y-6">
          {pages.map((page) => (
            <article key={`${page.pageId ?? page.pageUrl}`} className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="text-sm font-semibold text-gray-900">{pageLabel(page)}</h2>
              <p className="mt-1 text-xs text-gray-600">
                Flags de page : {page.pageFlags.length > 0 ? page.pageFlags.join(', ') : 'aucun'}<br />
                Styles : {page.styles.stylesheetCount} feuille(s), {page.styles.inlineStyleCount} style(s) inline, {page.styles.presentationMarkupCount} élément(s) de présentation<br />
                Signaux de style : {page.styles.flags.length > 0 ? page.styles.flags.join(', ') : 'aucun'}
              </p>

              {(page.languages ?? []).length > 0 && (
                <EvidenceTable caption="Langues — RGAA 8.7" headers={['Élément', 'Texte direct', 'Langue', 'Signaux']}>
                  {(page.languages ?? []).map((item) => (
                    <tr key={`language-${item.selector}`}>
                      <Cell><code>{item.selector}</code><br />{item.tagName}</Cell>
                      <Cell>{item.text || 'Texte direct absent'}</Cell>
                      <Cell>déclarée : {item.declaredLanguage ?? 'absente'}<br />effective : {item.effectiveLanguage ?? 'absente'}<br />source : {item.languageSource}</Cell>
                      <Cell><span className="text-amber-900">{item.flags.join(', ') || 'aucun'}<br />Revue humaine requise</span></Cell>
                    </tr>
                  ))}
                </EvidenceTable>
              )}

              {(page.directions ?? []).length > 0 && (
                <EvidenceTable caption="Directions — RGAA 8.10" headers={['Élément', 'Texte direct', 'Déclarations', 'Signaux']}>
                  {(page.directions ?? []).map((item) => (
                    <tr key={`direction-${item.selector}`}>
                      <Cell><code>{item.selector}</code><br />{item.tagName}</Cell>
                      <Cell>{item.text || 'Texte direct absent'}</Cell>
                      <Cell>dir : {item.dirAttribute ?? 'absent'}<br />effective : {item.effectiveDirection ?? 'absente'}<br />CSS : {item.cssDirection ?? 'absente'}<br />unicode-bidi : {item.unicodeBidi ?? 'absent'}</Cell>
                      <Cell><span className="text-amber-900">{item.flags.join(', ') || 'aucun'}<br />Revue humaine requise</span></Cell>
                    </tr>
                  ))}
                </EvidenceTable>
              )}

              {(page.regions ?? []).length > 0 && (
                <EvidenceTable caption="Régions — RGAA 9.2" headers={['Élément', 'Rôle et nom', 'Hiérarchie', 'Signaux']}>
                  {(page.regions ?? []).map((item) => (
                    <tr key={`region-${item.selector}`}>
                      <Cell><code>{item.selector}</code><br />{item.tagName}</Cell>
                      <Cell>{item.role ?? 'rôle implicite'}<br />Nom : {item.accessibleName ?? 'absent'}</Cell>
                      <Cell>Parent : {item.parentSelector ?? 'aucun'}<br />Profondeur : {item.depth}<br />Régions enfants : {item.childRegionCount}</Cell>
                      <Cell><span className="text-amber-900">{item.flags.join(', ') || 'aucun'}<br />Revue humaine requise</span></Cell>
                    </tr>
                  ))}
                </EvidenceTable>
              )}

              {(page.citations ?? []).length > 0 && (
                <EvidenceTable caption="Citations — RGAA 9.4" headers={['Élément', 'Type', 'Contenu', 'Signaux']}>
                  {(page.citations ?? []).map((item) => (
                    <tr key={`citation-${item.selector}`}>
                      <Cell><code>{item.selector}</code><br />{item.tagName}</Cell>
                      <Cell>{item.kind}</Cell>
                      <Cell>{item.text || 'Texte absent'}<br />cite : {item.citeAttribute ?? 'absent'}</Cell>
                      <Cell><span className="text-amber-900">{item.flags.join(', ') || 'aucun'}<br />Revue humaine requise</span></Cell>
                    </tr>
                  ))}
                </EvidenceTable>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
