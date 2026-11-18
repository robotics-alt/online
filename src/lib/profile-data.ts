export const LANGUAGE_NAMES = ['Afrikaans','Albanian','Amharic','Arabic','Armenian','Azerbaijani','Bengali','Bosnian','Bulgarian','Burmese','Cantonese','Catalan','Chinese','Croatian','Czech','Danish','Dutch','English','Estonian','Farsi','Filipino','Finnish','French','Georgian','German','Greek','Gujarati','Hausa','Hebrew','Hindi','Hungarian','Icelandic','Igbo','Indonesian','Irish','Italian','Japanese','Kannada','Kazakh','Khmer','Korean','Kurdish','Lao','Latvian','Lithuanian','Macedonian','Malay','Malayalam','Mandarin','Marathi','Mongolian','Nepali','Norwegian','Pashto','Polish','Portuguese','Punjabi','Romanian','Russian','Serbian','Sinhala','Slovak','Slovenian','Somali','Spanish','Swahili','Swedish','Tamil','Telugu','Thai','Tigrinya','Turkish','Ukrainian','Urdu','Uzbek','Vietnamese','Welsh','Yoruba','Zulu']
export const LANGUAGE_LEVELS = ['A1 · Beginner','A2 · Elementary','B1 · Intermediate','B2 · Upper intermediate','C1 · Advanced','C2 · Proficient','Native / bilingual']
export interface LanguageItem { name: string; level: string }
export interface ExperienceItem { title: string; years: number; organization: string; program: string; certificateId?: string }
export interface SkillItem { name: string; certificateId?: string }
export function readList<T>(value: unknown): T[] { try { const list = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(list) ? list : [] } catch { return [] } }
export function normalizeLanguages(value: unknown): LanguageItem[] {
  if (!Array.isArray(value) || value.length > 15) throw new Error('Add up to 15 languages')
  const items = value.map((entry) => ({ name: String(entry?.name || '').trim(), level: String(entry?.level || '') }))
  if (items.some((item) => !LANGUAGE_NAMES.includes(item.name) || !LANGUAGE_LEVELS.includes(item.level))) throw new Error('Choose a suggested language and proficiency level for each entry')
  if (new Set(items.map((item) => item.name)).size !== items.length) throw new Error('Each language can appear only once')
  return items
}
export function normalizeExperiences(value: unknown): ExperienceItem[] {
  if (!Array.isArray(value) || value.length > 20) throw new Error('Add up to 20 experience entries')
  return value.map((entry) => {
    const item = { title: String(entry?.title || '').trim().slice(0,120), organization: String(entry?.organization || '').trim().slice(0,160), program: String(entry?.program || '').trim().slice(0,120), years: Number(entry?.years), certificateId: entry?.certificateId ? String(entry.certificateId) : undefined }
    if (!item.title || !Number.isFinite(item.years) || item.years < 0 || item.years > 60) throw new Error('Each experience needs a title and years between 0 and 60')
    return item
  })
}
export function normalizeSkills(value: unknown): SkillItem[] {
  if (!Array.isArray(value) || value.length > 30) throw new Error('Add up to 30 skills')
  return value.map((entry) => { const name = String(entry?.name || '').trim().slice(0,100); if (!name) throw new Error('Give each skill a name'); return { name, certificateId: entry?.certificateId ? String(entry.certificateId) : undefined } })
}
