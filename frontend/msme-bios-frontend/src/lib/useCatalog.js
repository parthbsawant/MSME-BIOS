// useCatalog.js - translated names for features and tiers.
//
// featuresData.js stays the single source of truth for ids, prices and
// which features belong to which tier, and stays in English (those ids
// and prices are what get saved to the backend). This hook only supplies
// the *display text* for the current language, falling back to the
// English text in featuresData.js if a translation key is ever missing.

import { useTranslation } from 'react-i18next'
import { featureById, TIERS } from './featuresData'

export function useCatalog() {
  const { t } = useTranslation('catalog')

  const tierById = (id) => TIERS.find((x) => x.id === id)

  return {
    featureName: (id) => t(`features.${id}.name`, { defaultValue: featureById(id)?.name ?? id }),
    featureTagline: (id) => t(`features.${id}.tagline`, { defaultValue: featureById(id)?.tagline ?? '' }),
    featureDescription: (id) => t(`features.${id}.description`, { defaultValue: featureById(id)?.description ?? '' }),
    tierName: (id) => t(`tiers.${id}.name`, { defaultValue: tierById(id)?.name ?? id }),
    tierBand: (id) => t(`tiers.${id}.band`, { defaultValue: tierById(id)?.band ?? '' }),
    customPlanName: () => t('customPlan'),
  }
}
