import { useEffect, useMemo, useState } from 'react';
import { t } from '../../locales';

export interface FormControlItem {
  selector: string;
  tagName: string;
  type: string;
  id: string | null;
  name: string | null;
  label: string | null;
  labelSource: 'aria-labelledby' | 'aria-label' | 'label' | null;
  required: boolean;
  invalid: boolean;
  autocomplete: string | null;
  describedByIds: string[];
  helpText: string | null;
  errorMessage: string | null;
  flags: string[];
}

export interface FormItem {
  selector: string;
  action: string | null;
  method: string;
  controls: FormControlItem[];
  flags: string[];
  pageUrl?: string;
}

interface Props {
  forms: FormItem[];
  initialPageUrl?: string;
}

export default function AnnexeFormulaires({ forms, initialPageUrl }: Props) {
  const [pageFilter, setPageFilter] = useState(initialPageUrl ?? '');

  useEffect(() => setPageFilter(initialPageUrl ?? ''), [initialPageUrl]);

  const pages = useMemo(
    () => [...new Set(forms.map((form) => form.pageUrl).filter(Boolean))] as string[],
    [forms],
  );
  const visibleForms = forms.filter((form) => !pageFilter || form.pageUrl === pageFilter);
  const issueCount = visibleForms.reduce(
    (count, form) => count + form.controls.filter((control) => control.flags.length > 0).length,
    0,
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900">{t('annexes.forms.title')}</h2>
          <p className="mt-1 text-sm text-gray-600">{t('annexes.forms.description')}</p>
        </div>
        {pages.length > 1 && (
          <label className="text-xs text-gray-700">
            {t('annexes.forms.filterByPage')}
            <select
              value={pageFilter}
              onChange={(event) => setPageFilter(event.target.value)}
              className="ml-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700"
            >
              <option value="">{t('annexes.forms.allPages')}</option>
              {pages.map((page) => <option key={page} value={page}>{page}</option>)}
            </select>
          </label>
        )}
      </div>

      {visibleForms.length === 0 ? (
        <p className="py-4 text-sm text-gray-600">{t('annexes.forms.noResults')}</p>
      ) : (
        <>
          <p className={`mb-3 text-sm font-medium ${issueCount > 0 ? 'text-amber-800' : 'text-green-700'}`}>
            {issueCount > 0
              ? t('annexes.forms.issueCount', { count: issueCount })
              : t('annexes.forms.noIssues')}
          </p>
          <div className="space-y-5">
            {visibleForms.map((form) => (
              <section key={`${form.pageUrl ?? ''}-${form.selector}`} className="rounded-lg border border-gray-200 p-4">
                <div className="mb-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <h3 className="font-mono text-sm text-gray-900">{form.selector}</h3>
                    <p className="text-xs text-gray-600">{form.pageUrl}</p>
                  </div>
                  <p className="text-xs text-gray-700">
                    {form.method.toUpperCase()}{form.action ? ` → ${form.action}` : ''}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">{t('annexes.forms.tableCaption', { form: form.selector })}</caption>
                    <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-700">
                      <tr>
                        <th scope="col" className="px-3 py-2">{t('annexes.forms.colField')}</th>
                        <th scope="col" className="px-3 py-2">{t('annexes.forms.colLabel')}</th>
                        <th scope="col" className="px-3 py-2">{t('annexes.forms.colDetails')}</th>
                        <th scope="col" className="px-3 py-2">{t('annexes.forms.colHelp')}</th>
                        <th scope="col" className="px-3 py-2">{t('annexes.forms.colError')}</th>
                        <th scope="col" className="px-3 py-2">{t('annexes.forms.colStatus')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {form.controls.map((control) => {
                        const hasIssue = control.flags.length > 0;
                        return (
                          <tr key={control.selector} className="align-top">
                            <td className="px-3 py-2 font-mono text-xs text-gray-700">{control.selector}</td>
                            <td className="px-3 py-2 text-gray-800">{control.label || t('annexes.forms.labelAbsent')}</td>
                            <td className="px-3 py-2 text-xs text-gray-700">
                              <div>{control.labelSource || t('annexes.forms.labelSourceAbsent')}</div>
                              <div>{control.required ? t('annexes.forms.required') : t('annexes.forms.optional')}</div>
                              <div>{control.invalid ? t('annexes.forms.invalid') : t('annexes.forms.validityNotObserved')}</div>
                              {control.autocomplete && <div>autocomplete: {control.autocomplete}</div>}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-700">{control.helpText || t('annexes.forms.helpAbsent')}</td>
                            <td className="px-3 py-2 text-xs text-gray-700">{control.errorMessage || t('annexes.forms.errorAbsent')}</td>
                            <td className="px-3 py-2">
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${hasIssue ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'}`}>
                                {hasIssue ? t('annexes.forms.toReview') : t('annexes.forms.observed')}
                              </span>
                              {control.flags.length > 0 && (
                                <ul className="mt-1 text-[11px] text-amber-800">
                                  {control.flags.map((flag) => <li key={flag}>{t(`flags.${flag}`)}</li>)}
                                </ul>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
