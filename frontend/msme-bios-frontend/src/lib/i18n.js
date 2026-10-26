// i18n.js — sets up the translation system.
//
// Namespaces are split by page/area (common, landing, ...) rather than
// one giant file, so each phase of translation work touches its own
// small file instead of one file everyone's changes collide in.
//
// Language choice persists the same way theme preference already does -
// localStorage, read on load, defaulting to English if nothing is set
// or the stored value isn't one of our supported languages.

import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from '../locales/en/common.json'
import enLanding from '../locales/en/landing.json'
import enAuth from '../locales/en/auth.json'
import enOnboarding from '../locales/en/onboarding.json'
import hiCommon from '../locales/hi/common.json'
import hiLanding from '../locales/hi/landing.json'
import hiAuth from '../locales/hi/auth.json'
import hiOnboarding from '../locales/hi/onboarding.json'
import mrCommon from '../locales/mr/common.json'
import mrLanding from '../locales/mr/landing.json'
import mrAuth from '../locales/mr/auth.json'
import mrOnboarding from '../locales/mr/onboarding.json'

import enCatalog from '../locales/en/catalog.json'
import enUpload from '../locales/en/upload.json'
import enResults from '../locales/en/results.json'
import enGuide from '../locales/en/guide.json'
import enDashboard from '../locales/en/dashboard.json'
import hiCatalog from '../locales/hi/catalog.json'
import hiUpload from '../locales/hi/upload.json'
import hiResults from '../locales/hi/results.json'
import hiGuide from '../locales/hi/guide.json'
import hiDashboard from '../locales/hi/dashboard.json'
import mrCatalog from '../locales/mr/catalog.json'
import mrUpload from '../locales/mr/upload.json'
import mrResults from '../locales/mr/results.json'
import mrGuide from '../locales/mr/guide.json'
import mrDashboard from '../locales/mr/dashboard.json'

import enBilling from '../locales/en/billing.json'
import hiBilling from '../locales/hi/billing.json'
import mrBilling from '../locales/mr/billing.json'

import enTeam from '../locales/en/team.json'
import hiTeam from '../locales/hi/team.json'
import mrTeam from '../locales/mr/team.json'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'mr', label: 'मराठी' },
]

const STORAGE_KEY = 'msme-language'

function getStoredLanguage() {
  const stored = localStorage.getItem(STORAGE_KEY)
  const isSupported = SUPPORTED_LANGUAGES.some((l) => l.code === stored)
  return isSupported ? stored : 'en'
}

i18n.use(initReactI18next).init({
  resources: {
    en: { common: enCommon, landing: enLanding, auth: enAuth, onboarding: enOnboarding, catalog: enCatalog, upload: enUpload, results: enResults, guide: enGuide, dashboard: enDashboard, billing: enBilling, team: enTeam },
    hi: { common: hiCommon, landing: hiLanding, auth: hiAuth, onboarding: hiOnboarding, catalog: hiCatalog, upload: hiUpload, results: hiResults, guide: hiGuide, dashboard: hiDashboard, billing: hiBilling, team: hiTeam },
    mr: { common: mrCommon, landing: mrLanding, auth: mrAuth, onboarding: mrOnboarding, catalog: mrCatalog, upload: mrUpload, results: mrResults, guide: mrGuide, dashboard: mrDashboard, billing: mrBilling, team: mrTeam },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
})

i18n.on('languageChanged', (lng) => {
  localStorage.setItem(STORAGE_KEY, lng)
  document.documentElement.lang = lng
})

// Set it once on initial load too, not just on later changes -
// otherwise the very first page view (before anyone touches the
// switcher) renders in the wrong font if a non-English language was
// already stored from a previous visit.
document.documentElement.lang = i18n.language

export default i18n
