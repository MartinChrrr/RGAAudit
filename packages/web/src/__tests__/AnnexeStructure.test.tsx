import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import AnnexeStructure, { type StructurePageItem } from '../components/annexes/AnnexeStructure';

const page: StructurePageItem = {
  pageUrl: 'https://example.com/',
  pageFlags: ['HTML_VALIDITY_REVIEW'],
  styles: { stylesheetCount: 1, inlineStyleCount: 0, presentationMarkupCount: 0, flags: ['STYLESHEET_PRESENT'] },
  languages: [{
    selector: 'p[lang="en"]', tagName: 'p', text: 'Hello', declaredLanguage: 'en', effectiveLanguage: 'en', languageSource: 'attribute', flags: ['LANGUAGE_DECLARATION_PRESENT'],
  }],
  directions: [{
    selector: '#rtl', tagName: 'p', text: 'مرحبا', dirAttribute: 'rtl', effectiveDirection: 'rtl', cssDirection: 'rtl', unicodeBidi: 'normal', flags: ['DIRECTION_DECLARATION_PRESENT'],
  }],
  regions: [{
    selector: 'main', tagName: 'main', role: 'main', accessibleName: 'Contenu', parentSelector: null, depth: 0, childRegionCount: 0, flags: ['REGION_PRESENT'],
  }],
  citations: [{
    selector: 'blockquote', tagName: 'blockquote', kind: 'blockquote', text: 'Citation', citeAttribute: 'https://example.com/source', flags: ['CITATION_SEMANTIC_MARKUP'],
  }],
};

describe('AnnexeStructure', () => {
  it('affiche les preuves de langue, direction, régions et citations', () => {
    render(<AnnexeStructure pages={[page]} />);

    expect(screen.getByTestId('annexe-structure')).toBeInTheDocument();
    expect(screen.getByText('p[lang="en"]')).toBeInTheDocument();
    expect(screen.getByText(/DIRECTION_DECLARATION_PRESENT/)).toBeInTheDocument();
    expect(screen.getByText('Contenu')).toBeInTheDocument();
    expect(screen.getAllByText(/Citation/).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('region').length).toBe(4);
  });
});
