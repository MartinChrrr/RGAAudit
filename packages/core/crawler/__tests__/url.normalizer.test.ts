import { describe, it, expect } from 'vitest';
import { normalizeUrl, isSameDomain, deduplicateUrls } from '../url.normalizer';

describe('normalizeUrl', () => {
  it('supprime les ancres (#section)', () => {
    expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page/');
    expect(normalizeUrl('https://example.com/page#top')).toBe('https://example.com/page/');
    expect(normalizeUrl('https://example.com/page.html#footer')).toBe('https://example.com/page.html');
  });

  it('supprime utm_source, utm_medium, fbclid, gclid', () => {
    expect(normalizeUrl('https://example.com/page?utm_source=google&utm_medium=cpc'))
      .toBe('https://example.com/page/');

    expect(normalizeUrl('https://example.com/page?fbclid=abc123'))
      .toBe('https://example.com/page/');

    expect(normalizeUrl('https://example.com/page?gclid=xyz789'))
      .toBe('https://example.com/page/');
  });

  it('supprime utm_campaign, utm_content, utm_term', () => {
    expect(normalizeUrl('https://example.com/page?utm_campaign=spring&utm_content=banner&utm_term=sale'))
      .toBe('https://example.com/page/');
  });

  it('supprime msclkid, ref, source', () => {
    expect(normalizeUrl('https://example.com/page?msclkid=abc&ref=twitter&source=newsletter'))
      .toBe('https://example.com/page/');
  });

  it('conserve les paramètres non-tracking', () => {
    expect(normalizeUrl('https://example.com/search?q=accessibilite&page=2'))
      .toBe('https://example.com/search/?q=accessibilite&page=2');
  });

  it('supprime les tracking params et conserve les autres', () => {
    expect(normalizeUrl('https://example.com/page?q=test&utm_source=google&page=1'))
      .toBe('https://example.com/page/?q=test&page=1');
  });

  it('uniformise le trailing slash — ajoute sur les chemins sans extension', () => {
    expect(normalizeUrl('https://example.com/about')).toBe('https://example.com/about/');
    expect(normalizeUrl('https://example.com/about/')).toBe('https://example.com/about/');
    expect(normalizeUrl('https://example.com')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/fr/contact')).toBe('https://example.com/fr/contact/');
  });

  it('ne met pas de trailing slash sur les fichiers avec extension', () => {
    expect(normalizeUrl('https://example.com/page.html')).toBe('https://example.com/page.html');
    expect(normalizeUrl('https://example.com/style.css')).toBe('https://example.com/style.css');
    expect(normalizeUrl('https://example.com/sitemap.xml')).toBe('https://example.com/sitemap.xml');
  });
});

describe('isSameDomain', () => {
  it('retourne true pour le même hostname exact', () => {
    expect(isSameDomain('https://example.com/page', 'https://example.com')).toBe(true);
    expect(isSameDomain('https://example.com/a/b/c', 'https://example.com/d')).toBe(true);
  });

  it('retourne true pour un sous-domaine du même domaine de base', () => {
    expect(isSameDomain('https://blog.example.com/post', 'https://example.com')).toBe(true);
    expect(isSameDomain('https://www.example.com/page', 'https://example.com')).toBe(true);
    expect(isSameDomain('https://example.com/page', 'https://www.example.com')).toBe(true);
  });

  it('retourne false pour un domaine différent', () => {
    expect(isSameDomain('https://other.com/page', 'https://example.com')).toBe(false);
    expect(isSameDomain('https://evil-example.com', 'https://example.com')).toBe(false);
    expect(isSameDomain('https://example.org', 'https://example.com')).toBe(false);
  });

  it('retourne false pour une URL invalide', () => {
    expect(isSameDomain('not-a-url', 'https://example.com')).toBe(false);
    expect(isSameDomain('https://example.com', 'not-a-url')).toBe(false);
  });
});

describe('deduplicateUrls', () => {
  it('déduplique les URLs identiques après normalisation', () => {
    const urls = [
      'https://example.com/page',
      'https://example.com/page/',
      'https://example.com/page#section',
      'https://example.com/page?utm_source=google',
    ];
    const result = deduplicateUrls(urls);
    expect(result).toEqual(['https://example.com/page/']);
    expect(result).toHaveLength(1);
  });

  it('conserve les URLs distinctes', () => {
    const urls = [
      'https://example.com/page-a',
      'https://example.com/page-b',
      'https://example.com/page-c',
    ];
    const result = deduplicateUrls(urls);
    expect(result).toHaveLength(3);
  });

  it('retourne un tableau vide pour une entrée vide', () => {
    expect(deduplicateUrls([])).toEqual([]);
  });

  it('déduplique quand seuls les tracking params diffèrent', () => {
    const urls = [
      'https://example.com/page?fbclid=abc',
      'https://example.com/page?gclid=xyz',
      'https://example.com/page?msclkid=def',
    ];
    const result = deduplicateUrls(urls);
    expect(result).toEqual(['https://example.com/page/']);
    expect(result).toHaveLength(1);
  });
});
