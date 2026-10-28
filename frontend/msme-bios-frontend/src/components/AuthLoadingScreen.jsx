import { useTranslation } from 'react-i18next'
import Logo from './Logo'

export default function AuthLoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-canvas)] text-[var(--color-ink)] transition-colors">
      <div className="flex flex-col items-center">
        <Logo size={44} />
        <div className="mt-5 h-6 w-6 animate-spin rounded-full border-2 border-[var(--color-line)] border-t-[var(--color-accent)]" />

        <p className="mt-4 text-xs font-medium text-[var(--color-muted)]">
          {t('loading.session')}
        </p>
      </div>
    </div>
  )
}
