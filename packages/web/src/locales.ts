import fr from '../../core/locales/fr.json';

type NestedRecord = { [key: string]: string | NestedRecord };

function getNestedValue(obj: NestedRecord, path: string): string | undefined {
  const parts = path.split('.');
  let current: string | NestedRecord = obj;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as NestedRecord)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const value = getNestedValue(fr as NestedRecord, key);
  if (value === undefined) return key;
  if (!params) return value;
  return Object.entries(params).reduce(
    (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
    value,
  );
}

export default fr;
