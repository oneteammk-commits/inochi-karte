import { useTranslation } from 'react-i18next'

/**
 * 登録の最初の画面。
 * 「何のために登録するのか」を先に伝えてから、
 * 「わたしの情報」か「わたしとペットの情報」かを選んでもらう。
 * 操作が分からない人向けの「よくある質問」もここに置く。
 */
export function ModeSelect({ onChoose }: { onChoose: (mode: 'person' | 'pet') => void }) {
  const { t } = useTranslation()
  const purposes = [t('register.purpose1'), t('register.purpose2'), t('register.purpose3')]
  const faqs = [1, 2, 3].map((n) => ({ q: t(`register.faqQ${n}`), a: t(`register.faqA${n}`) }))

  return (
    <section aria-labelledby="mode-title" className="space-y-6">
      <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
        <h2 className="mb-3 text-base font-bold text-stone-900">{t('register.purposeTitle')}</h2>
        <ul className="space-y-2">
          {purposes.map((p) => (
            <li key={p} className="flex gap-2 text-sm font-medium leading-relaxed text-stone-900">
              <span aria-hidden="true" className="mt-0.5 shrink-0 font-bold text-amber-800">
                ●
              </span>
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h2 id="mode-title" className="mb-3 text-lg font-bold text-stone-900">
          {t('register.modeTitle')}
        </h2>
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => onChoose('person')}
            data-mode="person"
            className="block w-full rounded-2xl border-2 border-red-700 bg-white p-4 text-left shadow-sm transition hover:bg-red-50"
          >
            <span className="block text-lg font-bold text-red-800">
              <span aria-hidden="true">👤 </span>
              {t('register.modePerson')}
            </span>
            <span className="mt-1 block text-sm font-medium leading-relaxed text-stone-800">
              {t('register.modePersonNote')}
            </span>
          </button>
          <button
            type="button"
            onClick={() => onChoose('pet')}
            data-mode="pet"
            className="block w-full rounded-2xl border-2 border-amber-600 bg-white p-4 text-left shadow-sm transition hover:bg-amber-50"
          >
            <span className="block text-lg font-bold text-amber-900">
              <span aria-hidden="true">🐾 </span>
              {t('register.modePet')}
            </span>
            <span className="mt-1 block text-sm font-medium leading-relaxed text-stone-800">
              {t('register.modePetNote')}
            </span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-stone-300 bg-white p-4">
        <h2 className="mb-2 text-base font-bold text-stone-900">{t('register.faqTitle')}</h2>
        <div className="divide-y divide-stone-200">
          {faqs.map((f) => (
            <details key={f.q} className="py-2">
              <summary className="cursor-pointer py-1 text-sm font-bold text-stone-900">{f.q}</summary>
              <p className="mt-1 text-sm font-medium leading-relaxed text-stone-800">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
