'use client'

import { useApp } from './store'
import catalogue from './translation-catalog.json'

// Lightweight i18n for core UI strings. Full localized content lives in the CMS.
export const DICT: Record<string, Partial<Record<string, string>>> = {
  en: {
    ...catalogue,
    "nav.home":"Home","nav.explore":"Explore","nav.lessons":"Lessons",
"admin.overview":"Overview","admin.applications":"Applications","admin.users":"Users","admin.notifications":"Inbox","admin.bookings":"Bookings","admin.finance":"Finance","admin.payouts":"Payouts","admin.reviews":"Reviews","admin.subjects":"Subjects","admin.coupons":"Coupons & Packages","admin.games":"Brain Games","admin.cms":"CMS","admin.homepage":"Homepage & welcome credit","admin.announcements":"Notifications & events","admin.settings":"Settings","admin.audit":"Audit Log","teacher.overview":"Overview","teacher.calendar":"My calendar","teacher.schedule-settings":"Availability & time off","teacher.students":"My students","teacher.messages":"Messages","teacher.notifications":"Notifications & events","teacher.earnings":"Earnings","teacher.classes":"Group classes","teacher.assignments":"Homework","teacher.profile":"My account",
"back":"Back","continue":"Continue","saving":"Saving...","step":"Step","studentRegistration":"Student registration","teacherRegistration":"Teacher registration","shareYourExpertise":"Teach what you love.","yourNextChapter":"Make room for your next chapter.","teacherSignupIntro":"Build your professional profile, set your teaching hours and meet your next students.","studentSignupIntro":"Tell us what you want to learn. Find teachers who fit your goals, budget and week.","yourAccount":"Your account","teachingProfile":"Teaching profile","reviewAndApproval":"Review & approval","wantToLearn":"I want to learn","wantToTeach":"I want to teach","createAccount":"Create account","yourLearningPlan":"Your learning plan","studentSetupIntro":"A few simple choices to help you find the right teacher.","learningGoals":"Learning goals","lessonBudget":"Lesson budget","studyHours":"Study hours","whatToLearn":"What would you like to learn?","chooseSubject":"Choose a subject","currentLevel":"Current level","learningGoal":"Your learning goal","learningGoalPlaceholder":"What would you like to achieve?","budgetExplanation":"Choose your maximum hourly rate. We will suggest approved teachers within your budget.","hourlyBudgetUSD":"Hourly budget (USD)","minimumAvailableRate":"Lowest available teacher rate","perHour":"per hour","studyHoursExplanation":"Choose the days you can study and how many hours you have on each day.","hours":"hours","total":"Total","hoursPerWeek":"hours per week","findMatchingTutors":"Find matching teachers","sunday":"Sunday","monday":"Monday","tuesday":"Tuesday","wednesday":"Wednesday","thursday":"Thursday","friday":"Friday","saturday":"Saturday","myAccount":"My account","calendar":"My calendar","homework":"Homework","notifications":"Notifications","earnings":"Earnings","profilePhoto":"Profile photo","recommendedTutors":"Teachers within your budget","findTutor":"Find a tutor","myLessons":"My lessons","myTutors":"My tutors","progress":"Progress","accountSettings":"Account settings","learningSpace":"Your learning space","wallet":"Wallet","nextLesson":"Your next lesson","upcoming":"Coming up",
    findTutors: 'Find Tutors', subjects: 'Subjects', howItWorks: 'How It Works',
    becomeTutor: 'Become a Tutor', help: 'Help', login: 'Log in', signup: 'Sign up',
    dashboard: 'Dashboard', messages: 'Messages', lessons: 'My Lessons', logout: 'Log out',
    searchPlaceholder: 'What do you want to learn?', heroCta: 'Search tutors',
  },
  ar: {
    findTutors: 'ابحث عن معلمين', subjects: 'المواد', howItWorks: 'كيف تعمل المنصة',
    becomeTutor: 'كن معلمًا', help: 'المساعدة', login: 'تسجيل الدخول', signup: 'إنشاء حساب',
    dashboard: 'لوحة التحكم', messages: 'الرسائل', lessons: 'دروسي', logout: 'تسجيل الخروج',
    searchPlaceholder: 'ماذا تريد أن تتعلم؟', heroCta: 'ابحث عن معلمين',
  },
  ku: {
    findTutors: 'ماموستا بگەڕێ', subjects: 'بابەتەکان', howItWorks: 'چۆن کاردەکات',
    becomeTutor: 'ببە ماموستا', help: 'یارمەتی', login: 'چوونەژوورەوە', signup: 'خۆتۆمارکردن',
    dashboard: 'داشبۆرد', messages: 'نامەکان', lessons: 'وانەکانم', logout: 'دەرچوون',
    searchPlaceholder: 'دەتەوێت چی فێربیت؟', heroCta: 'گەڕان بۆ ماموستا',
  },
  tr: {
    findTutors: 'Öğretmen Bul', subjects: 'Dersler', howItWorks: 'Nasıl Çalışır',
    becomeTutor: 'Öğretmen Ol', help: 'Yardım', login: 'Giriş yap', signup: 'Kayıt ol',
    dashboard: 'Panelim', messages: 'Mesajlar', lessons: 'Derslerim', logout: 'Çıkış',
    searchPlaceholder: 'Ne öğrenmek istiyorsun?', heroCta: 'Öğretmen ara',
  },
  fr: {
    findTutors: 'Trouver des tuteurs', subjects: 'Matières', howItWorks: 'Comment ça marche',
    becomeTutor: 'Devenir tuteur', help: 'Aide', login: 'Connexion', signup: "S'inscrire",
    dashboard: 'Tableau de bord', messages: 'Messages', lessons: 'Mes leçons', logout: 'Déconnexion',
    searchPlaceholder: 'Que voulez-vous apprendre ?', heroCta: 'Rechercher des tuteurs',
  },
}

export function useT(lang: string) {
  const overrides=useApp(state=>state.publicData?.settings.translations)
  return (key: string): string => overrides?.[lang]?.[key] || DICT[lang]?.[key] || overrides?.en?.[key] || DICT.en[key] || key
}
