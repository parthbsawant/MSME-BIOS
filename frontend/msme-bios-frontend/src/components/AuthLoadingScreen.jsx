import { useTranslation } from 'react-i18next'

export default function AuthLoadingScreen() {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen items-center justify-center bg-white text-black dark:bg-black dark:text-white">
      <div className="flex flex-col items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/20 border-t-black dark:border-white/20 dark:border-t-white" />

        <p className="mt-4 text-sm text-black/60 dark:text-white/60">
          {t('loading.session')}
        </p>
      </div>
    </div>
  )
}