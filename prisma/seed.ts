/**
 * TutorSphere seed script — demo accounts + rich sample data.
 * Run: bun prisma/seed.ts
 * ⚠️ Demo credentials are for LOCAL DEVELOPMENT ONLY.
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'

const db = new PrismaClient()

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`
}

const PW = hashPassword('Password123!')

async function main() {
  console.log('🌱 Seeding TutorSphere…')
  for (const t of [
    'LessonAttendance', 'Submission', 'Assignment', 'Review', 'Booking', 'LessonCredit', 'Package',
    'LedgerEntry', 'Payment', 'PayoutRequest', 'Coupon', 'Message', 'Conversation',
    'Notification', 'NotificationPrefs', 'TicketMessage', 'SupportTicket',
    'LearningGoal', 'TutorVerification', 'TutorSubject', 'AvailabilityException', 'AvailabilityRule',
    'Subject', 'TutorProfile', 'StudentProfile', 'GuardianLink', 'Session', 'PasswordReset',
    'CmsPage', 'BlogPost', 'Faq', 'Testimonial', 'Setting', 'AuditLog', 'NewsletterSubscriber', 'User',
  ]) {
     
    await (db as any)[t].deleteMany()
  }

  // ---------- Settings ----------
  await db.setting.create({
    data: { key: 'platform', value: JSON.stringify({
      platformName: 'TutorSphere',
      tagline: 'Learn Anything. From Anywhere.',
      heroTitle: 'Learn Anything. From Anywhere. With the Right Tutor.',
      heroSubtitle: 'Connect with expert tutors worldwide for personalized, interactive online lessons.',
      contactEmail: 'support@tutorsphere.app',
      defaultCurrency: 'USD',
      defaultLanguage: 'en',
      commissionPercent: 20,
      trialLessonEnabled: true,
      trialCommissionPercent: 25,
      minCancelNoticeHours: 12,
      bookingNoticeHours: 2,
      bookingHorizonDays: 30,
      slotDurationMin: 60,
      payoutMinCents: 2000,
      maintenanceMode: false,
      allowRegistrations: true,
      fxRates: { USD: 1, EUR: 0.92, GBP: 0.79, GHS: 15.4, IQD: 1310, TRY: 34.5 },
      paymentProviders: { stripe: false, paypal: false, paystack: false, flutterwave: false },
      videoProvider: 'builtin-webrtc',
    }) },
  })

  // ---------- Subjects ----------
  const subjectData = [
    ['Mathematics', 'math', 'Academics', 'sigma', 'Algebra, calculus, geometry and statistics for all levels.'],
    ['English', 'english', 'Languages', 'languages', 'Conversation, grammar, business English and exam prep.'],
    ['Arabic', 'arabic', 'Languages', 'languages', 'Modern Standard Arabic and dialects with native tutors.'],
    ['Kurdish (Sorani)', 'kurdish', 'Languages', 'languages', 'Kurdish Sorani reading, writing and conversation.'],
    ['Turkish', 'turkish', 'Languages', 'languages', 'Turkish for beginners to advanced learners.'],
    ['French', 'french', 'Languages', 'languages', 'DELF prep, conversation and business French.'],
    ['Programming', 'programming', 'Tech', 'code', 'Python, JavaScript, web development and computer science.'],
    ['Physics', 'physics', 'Academics', 'atom', 'Mechanics, electromagnetism and modern physics.'],
    ['Chemistry', 'chemistry', 'Academics', 'flask-conical', 'Organic, inorganic and analytical chemistry.'],
    ['Music Theory', 'music-theory', 'Arts', 'music', 'Music theory, harmony and composition.'],
    ['Piano', 'piano', 'Arts', 'piano', 'Classical and contemporary piano lessons.'],
    ['Test Prep', 'test-prep', 'Academics', 'graduation-cap', 'SAT, IELTS, TOEFL and university entrance exams.'],
    ['Business & Finance', 'business', 'Professional', 'briefcase', 'Accounting, economics and business studies.'],
    ['Graphic Design', 'graphic-design', 'Arts', 'palette', 'Design principles, Figma, Photoshop and branding.'],
  ] as const
  const subjects: Record<string, string> = {}
  for (const [name, slug, category, icon, description] of subjectData) {
    const s = await db.subject.create({ data: { name, slug, category, icon, description } })
    subjects[slug] = s.id
  }

  // ---------- Users ----------
  const mkUser = (email: string, name: string, role: 'STUDENT' | 'TUTOR' | 'ADMIN' | 'SUPPORT', extra: object = {}) =>
    db.user.create({ data: { email, name, role, passwordHash: PW, emailVerified: true, ...extra } })

  const admin = await mkUser('admin@tutorsphere.app', 'Amina Osman', 'ADMIN', { country: 'United Kingdom', timezone: 'Europe/London' })
  const support = await mkUser('support@tutorsphere.app', 'Karim Hassan', 'SUPPORT', { country: 'Egypt', timezone: 'Africa/Cairo' })

  // Students
  const alex = await mkUser('student@tutorsphere.app', 'Alex Morgan', 'STUDENT', {
    country: 'United States', timezone: 'America/New_York', walletCents: 25000,
  })
  const leyla = await mkUser('student2@tutorsphere.app', 'Leyla Ahmed', 'STUDENT', {
    country: 'Iraq', timezone: 'Asia/Baghdad', walletCents: 8000, currency: 'USD',
  })
  const marco = await mkUser('student3@tutorsphere.app', 'Marco Rossi', 'STUDENT', {
    country: 'Italy', timezone: 'Europe/Rome', walletCents: 5000, currency: 'EUR',
  })
  const fatima = await mkUser('parent@tutorsphere.app', 'Fatima Yilmaz', 'STUDENT', {
    country: 'Turkey', timezone: 'Europe/Istanbul', walletCents: 12000,
  })

  for (const [u, sp] of [
    [alex, { level: 'Beginner', goal: 'Speak Spanish confidently for travel', preferredLanguage: 'English', budgetCents: 2000, availability: 'Weekday evenings' }],
    [leyla, { level: 'Intermediate', goal: 'Prepare for IELTS 7.5', preferredLanguage: 'Arabic, Kurdish', budgetCents: 1500, availability: 'Mornings' }],
    [marco, { level: 'Advanced', goal: 'Master Python for data science', preferredLanguage: 'Italian, English', budgetCents: 3000, availability: 'Weekends' }],
  ] as const) {
    await db.studentProfile.create({ data: { userId: u.id, ...sp, interests: sp.goal } })
    await db.notificationPrefs.create({ data: { userId: u.id } })
  }
  await db.notificationPrefs.createMany({
    data: [admin.id, support.id, fatima.id].map((userId) => ({ userId })),
  })
  await db.guardianLink.create({ data: { guardianId: fatima.id, studentId: leyla.id, relation: 'mother' } })

  // ---------- Tutors ----------
  interface TutorSeed {
    email: string; name: string; country: string; tz: string;
    headline: string; about: string; exp: string; edu: string; cert: string; method: string;
    languages: string; native: string; years: number; hourly: number; trial: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED'; verified: boolean;
    subjectSlugs: string[]; weekdays: number[]; startMin: number; endMin: number;
    ratingSum: number; reviewCount: number; lessonsCompleted: number; students: number;
  }
  const tutors: TutorSeed[] = [
    {
      email: 'sarah@tutorsphere.app', name: 'Sarah Collins', country: 'United Kingdom', tz: 'Europe/London',
      headline: 'Certified English teacher — IELTS & conversation specialist',
      about: 'Hi! I am Sarah, a CELTA-certified English teacher from London with 8 years of experience helping students around the world reach fluency. I specialize in IELTS preparation and confident everyday conversation. My lessons are relaxed, practical and 100% focused on your goals.',
      exp: '8 years teaching English online and in language schools in London and Dubai.',
      edu: 'BA English Literature, University of Manchester · CELTA, Cambridge',
      cert: 'CELTA (Cambridge) · IELTS Examiner Training',
      method: 'Communicative approach with real-life scenarios, structured feedback and spaced repetition of vocabulary.',
      languages: 'English, French', native: 'English', years: 8, hourly: 2200, trial: 500,
      status: 'APPROVED', verified: true,
      subjectSlugs: ['english', 'test-prep'], weekdays: [1, 2, 3, 4, 5], startMin: 480, endMin: 1140,
      ratingSum: 48, reviewCount: 10, lessonsCompleted: 412, students: 63,
    },
    {
      email: 'omar@tutorsphere.app', name: 'Omar Farouk', country: 'Egypt', tz: 'Africa/Cairo',
      headline: 'Mathematics & Physics tutor — making hard things simple',
      about: 'I am a mechanical engineer turned full-time tutor. For 10 years I have helped hundreds of students turn fear of math into genuine curiosity. I break complex problems into small, intuitive steps and always connect theory to real-world examples.',
      exp: '10 years tutoring math and physics, from middle school to university level.',
      edu: 'BSc Mechanical Engineering, Cairo University · MSc Applied Mathematics',
      cert: 'Certified STEM Educator',
      method: 'Step-by-step problem solving, visual explanations, and lots of guided practice.',
      languages: 'Arabic, English', native: 'Arabic', years: 10, hourly: 1800, trial: 400,
      status: 'APPROVED', verified: true,
      subjectSlugs: ['math', 'physics'], weekdays: [0, 1, 2, 3, 4, 6], startMin: 540, endMin: 1200,
      ratingSum: 49, reviewCount: 12, lessonsCompleted: 358, students: 51,
    },
    {
      email: 'elena@tutorsphere.app', name: 'Elena Petrova', country: 'Spain', tz: 'Europe/Madrid',
      headline: 'Spanish & French conversation coach — speak from day one',
      about: 'Hola! Bonjour! I believe language learning should start with speaking, not memorizing. In my immersive lessons you will speak 80% of the time. I have guided over 200 students to conversational fluency, many of them complete beginners.',
      exp: '7 years of language coaching in Barcelona and online.',
      edu: 'MA Applied Linguistics, University of Barcelona · DELE C2 · DALF C2',
      cert: 'DELE Examiner · DALF C2',
      method: 'Full immersion with scaffolding, task-based learning, gentle error correction.',
      languages: 'Spanish, French, English, Italian', native: 'Spanish', years: 7, hourly: 1900, trial: 500,
      status: 'APPROVED', verified: true,
      subjectSlugs: ['french', 'english'], weekdays: [1, 2, 3, 4, 5, 6], startMin: 540, endMin: 1290,
      ratingSum: 47, reviewCount: 10, lessonsCompleted: 290, students: 47,
    },
    {
      email: 'david@tutorsphere.app', name: 'David Chen', country: 'United States', tz: 'America/New_York',
      headline: 'Senior software engineer — Python, JavaScript & interview prep',
      about: 'I have spent 12 years building software at startups and big tech, and 5 years mentoring developers. Whether you are writing your first line of code or preparing for a FAANG interview, I will meet you where you are and build a clear path forward.',
      exp: '12 years software engineering; 5 years mentoring junior developers and career switchers.',
      edu: 'BS Computer Science, MIT',
      cert: 'AWS Solutions Architect',
      method: 'Project-based learning with live coding, code review, and spaced practice.',
      languages: 'English, Mandarin', native: 'English', years: 12, hourly: 3500, trial: 900,
      status: 'APPROVED', verified: true,
      subjectSlugs: ['programming', 'business'], weekdays: [1, 2, 3, 4], startMin: 780, endMin: 1380,
      ratingSum: 49, reviewCount: 11, lessonsCompleted: 187, students: 34,
    },
    {
      email: 'ayse@tutorsphere.app', name: 'Ayşe Kaya', country: 'Turkey', tz: 'Europe/Istanbul',
      headline: 'Turkish language teacher — patient, friendly, effective',
      about: 'Merhaba! I am Ayşe from Istanbul. I teach Turkish to learners of all levels using stories, music and everyday dialogues. My students say my lessons feel like chatting with a friend — while their grammar quietly gets better every week.',
      exp: '6 years teaching Turkish to international students and expats.',
      edu: 'BA Turkish Language and Literature, Istanbul University · TÖMER Teaching Certificate',
      cert: 'TÖMER Teaching Certificate',
      method: 'Story-based learning, daily dialogues, cultural immersion.',
      languages: 'Turkish, English, Kurdish', native: 'Turkish', years: 6, hourly: 1500, trial: 300,
      status: 'APPROVED', verified: true,
      subjectSlugs: ['turkish', 'kurdish'], weekdays: [0, 1, 2, 3, 4, 5], startMin: 600, endMin: 1200,
      ratingSum: 48, reviewCount: 9, lessonsCompleted: 233, students: 41,
    },
    {
      email: 'grace@tutorsphere.app', name: 'Grace Mensah', country: 'Ghana', tz: 'Africa/Accra',
      headline: 'Business, economics & exam prep tutor',
      about: 'I help students and professionals master business subjects and ace their exams. With a background in finance and 9 years of teaching, I focus on clear frameworks, exam technique, and confidence building.',
      exp: '9 years teaching business studies, economics and accounting.',
      edu: 'BSc Business Administration, University of Ghana · ACCA Part-Qualified',
      cert: 'ACCA (Part-qualified)',
      method: 'Case-study driven with clear frameworks and past-paper drills.',
      languages: 'English, Twi', native: 'English', years: 9, hourly: 1600, trial: 400,
      status: 'PENDING', verified: false,
      subjectSlugs: ['business', 'test-prep'], weekdays: [1, 2, 3, 4, 5], startMin: 480, endMin: 1050,
      ratingSum: 0, reviewCount: 0, lessonsCompleted: 0, students: 0,
    },
    {
      email: 'tutor.pending@tutorsphere.app', name: 'Nour Khalil', country: 'Iraq', tz: 'Asia/Baghdad',
      headline: 'Arabic language tutor for all levels',
      about: 'I teach Modern Standard Arabic and Mesopotamian dialect with a focus on reading and conversation. Currently awaiting platform verification.',
      exp: '4 years teaching Arabic online.',
      edu: 'BA Arabic Literature, University of Baghdad',
      cert: '',
      method: 'Reading circles and conversation practice.',
      languages: 'Arabic, Kurdish Sorani, English', native: 'Arabic', years: 4, hourly: 1400, trial: 300,
      status: 'PENDING', verified: false,
      subjectSlugs: ['arabic', 'kurdish'], weekdays: [0, 2, 4], startMin: 600, endMin: 1080,
      ratingSum: 0, reviewCount: 0, lessonsCompleted: 0, students: 0,
    },
  ]

  const tutorProfiles: Record<string, { profileId: string; userId: string; name: string; rate: number; trial: number }> = {}
  for (const t of tutors) {
    const user = await mkUser(t.email, t.name, 'TUTOR', {
      country: t.country, timezone: t.tz,
      onboarded: true,
      walletCents: t.status === 'APPROVED' ? 15000 : 0,
    })
    const profile = await db.tutorProfile.create({
      data: {
        userId: user.id, headline: t.headline, about: t.about, experience: t.exp,
        education: t.edu, certifications: t.cert, methodology: t.method,
        languages: t.languages, nativeLanguage: t.native, yearsExperience: t.years,
        hourlyRateCents: t.hourly, trialRateCents: t.trial, status: t.status,
        identityVerified: t.verified, ratingSum: t.ratingSum, reviewCount: t.reviewCount,
        lessonsCompleted: t.lessonsCompleted, studentsCount: t.students,
        rejectionReason: t.status === 'REJECTED' ? 'Introduction video was missing.' : null,
        payoutMethod: t.status === 'APPROVED' ? 'bank_transfer' : null,
        payoutDetails: t.status === 'APPROVED' ? '•••• 4821' : null,
      },
    })
    for (const slug of t.subjectSlugs) {
      await db.tutorSubject.create({ data: { tutorId: profile.id, subjectId: subjects[slug] } })
    }
    for (const wd of t.weekdays) {
      await db.availabilityRule.create({ data: { tutorId: profile.id, weekday: wd, startMin: t.startMin, endMin: t.endMin } })
    }
    await db.tutorVerification.create({
      data: { tutorId: profile.id, type: 'IDENTITY', label: 'Government ID', fileUrl: '/uploads/demo/id-document.pdf', status: t.verified ? 'APPROVED' : 'PENDING' },
    })
    if (t.cert) {
      await db.tutorVerification.create({
        data: { tutorId: profile.id, type: 'CERTIFICATE', label: t.cert.split('·')[0].trim(), fileUrl: '/uploads/demo/certificate.pdf', status: t.verified ? 'APPROVED' : 'PENDING' },
      })
    }
    tutorProfiles[t.email] = { profileId: profile.id, userId: user.id, name: t.name, rate: t.hourly, trial: t.trial }
  }

  // ---------- Packages & coupons ----------
  await db.package.createMany({
    data: [
      { name: 'Starter — 4 lessons / month', lessons: 4, priceCents: 8000, description: 'One lesson per week to build momentum.' },
      { name: 'Regular — 8 lessons / month', lessons: 8, priceCents: 15200, description: 'Two lessons per week, 5% savings.' },
      { name: 'Intensive — 12 lessons / month', lessons: 12, priceCents: 21600, description: 'Three lessons per week, 10% savings.' },
    ],
  })
  await db.coupon.createMany({
    data: [
      { code: 'WELCOME10', percentOff: 10, maxUses: 500 },
      { code: 'SUMMER25', percentOff: 25, maxUses: 100 },
    ],
  })

  // ---------- Bookings (past completed + upcoming) ----------
  const mkDate = (dayOffset: number, hourUtc: number) => {
    const d = new Date()
    d.setUTCDate(d.getUTCDate() + dayOffset)
    d.setUTCHours(hourUtc, 0, 0, 0)
    return d
  }

  interface PastBooking { student: string; tutorEmail: string; subject: string; day: number; hour: number; rating?: number; comment?: string; price: number }
  const past: PastBooking[] = [
    { student: alex.id, tutorEmail: 'sarah@tutorsphere.app', subject: 'english', day: -14, hour: 14, rating: 5, comment: 'Sarah is fantastic! My confidence in speaking English has grown so much in just a few weeks.', price: 2200 },
    { student: alex.id, tutorEmail: 'sarah@tutorsphere.app', subject: 'english', day: -7, hour: 14, rating: 5, comment: 'Another great lesson with clear feedback and a plan for next time.', price: 2200 },
    { student: leyla.id, tutorEmail: 'omar@tutorsphere.app', subject: 'math', day: -10, hour: 16, rating: 5, comment: 'Omar explained calculus in a way I finally understand. Highly recommended!', price: 1800 },
    { student: leyla.id, tutorEmail: 'sarah@tutorsphere.app', subject: 'test-prep', day: -5, hour: 13, rating: 4, comment: 'Very helpful IELTS strategies, slightly fast pace for me.', price: 2200 },
    { student: marco.id, tutorEmail: 'david@tutorsphere.app', subject: 'programming', day: -3, hour: 17, rating: 5, comment: 'David reviewed my code and pointed out exactly what to improve. Brilliant.', price: 3500 },
  ]
  for (const pb of past) {
    const tp = tutorProfiles[pb.tutorEmail]
    const start = mkDate(pb.day, pb.hour)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const commission = Math.round(pb.price * 0.2)
    const booking = await db.booking.create({
      data: {
        studentId: pb.student, tutorId: tp.userId, tutorProfileId: tp.profileId,
        subjectId: subjects[pb.subject], startUtc: start, endUtc: end, durationMin: 60,
        status: 'COMPLETED', isTrial: false, priceCents: pb.price,
        roomId: `room-${randomBytes(8).toString('hex')}`,
        commissionCents: commission, tutorNetCents: pb.price - commission,
        completedAt: end,
      },
    })
    await db.lessonAttendance.createMany({
      data: [
        { bookingId: booking.id, userId: pb.student, joinedAt: start, leftAt: end, seconds: 3600 },
        { bookingId: booking.id, userId: tp.userId, joinedAt: start, leftAt: end, seconds: 3600 },
      ],
    })
    if (pb.rating) {
      await db.review.create({
        data: { bookingId: booking.id, studentId: pb.student, tutorId: tp.profileId, rating: pb.rating, comment: pb.comment ?? '' },
      })
    }
    // Ledger: student spend at booking time + tutor earning at completion
    await db.ledgerEntry.create({
      data: { userId: pb.student, type: 'SPEND', amountCents: -pb.price, balanceAfterCents: 0, refType: 'BOOKING', refId: booking.id, description: 'Lesson payment' },
    })
    await db.ledgerEntry.create({
      data: { userId: tp.userId, type: 'EARNING', amountCents: pb.price - commission, balanceAfterCents: 15000, refType: 'BOOKING', refId: booking.id, description: 'Lesson earnings (net of 20% commission)' },
    })
  }

  // Upcoming bookings (next 2-4 days) — for classroom/demo
  const upcoming = [
    { student: alex.id, tutorEmail: 'sarah@tutorsphere.app', subject: 'english', day: 1, hour: 15 },
    { student: leyla.id, tutorEmail: 'ayse@tutorsphere.app', subject: 'turkish', day: 2, hour: 9 },
    { student: marco.id, tutorEmail: 'david@tutorsphere.app', subject: 'programming', day: 3, hour: 18 },
  ]
  for (const ub of upcoming) {
    const tp = tutorProfiles[ub.tutorEmail]
    const start = mkDate(ub.day, ub.hour)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    await db.booking.create({
      data: {
        studentId: ub.student, tutorId: tp.userId, tutorProfileId: tp.profileId,
        subjectId: subjects[ub.subject], startUtc: start, endUtc: end, durationMin: 60,
        status: 'CONFIRMED', isTrial: false, priceCents: tp.rate, paymentMethod: 'WALLET',
        roomId: `room-${randomBytes(8).toString('hex')}`,
      },
    })
  }

  // ---------- Learning goals & assignments ----------
  await db.learningGoal.createMany({
    data: [
      { studentId: alex.id, tutorId: tutorProfiles['sarah@tutorsphere.app'].profileId, title: 'Hold a 15-minute conversation in Spanish', status: 'ACTIVE' },
      { studentId: leyla.id, tutorId: tutorProfiles['omar@tutorsphere.app'].profileId, title: 'Score 7.5 in IELTS Academic', status: 'ACTIVE' },
      { studentId: marco.id, tutorId: tutorProfiles['david@tutorsphere.app'].profileId, title: 'Build a full-stack project with Python', status: 'ACHIEVED' },
    ],
  })
  const hwBooking = await db.booking.findFirst({ where: { studentId: marco.id, status: 'CONFIRMED' } })
  const assignment = await db.assignment.create({
    data: {
      tutorId: tutorProfiles['david@tutorsphere.app'].userId, studentId: marco.id,
      bookingId: hwBooking?.id, title: 'Build a REST API with FastAPI',
      description: 'Create a small REST API with 3 endpoints (GET, POST, DELETE) and submit the GitHub link. Focus on clean structure and error handling.',
      dueDate: mkDate(5, 23),
    },
  })
  await db.submission.create({
    data: { assignmentId: assignment.id, studentId: marco.id, content: 'https://github.com/marcorossi/demo-fastapi — endpoints done, added pytest tests.', status: 'SUBMITTED' },
  })
  const hw2 = await db.assignment.create({
    data: {
      tutorId: tutorProfiles['sarah@tutorsphere.app'].userId, studentId: alex.id,
      title: 'Essay: My Hometown (250 words)',
      description: 'Write a 250-word essay describing your hometown. Use at least three linking words and the past tense.',
      dueDate: mkDate(4, 23),
    },
  })
  await db.submission.create({
    data: { assignmentId: hw2.id, studentId: alex.id, content: 'I grew up in a small town near the mountains where everyone knows each other…', feedback: 'Great structure! Watch the past tense of "go" — you wrote "goed".', status: 'GRADED' },
  })

  // ---------- Wallet topups history for students ----------
  await db.ledgerEntry.createMany({
    data: [
      { userId: alex.id, type: 'TOPUP', amountCents: 25000, balanceAfterCents: 25000, description: 'Welcome credits (demo)', refType: 'ADMIN' },
      { userId: leyla.id, type: 'TOPUP', amountCents: 8000, balanceAfterCents: 8000, description: 'Welcome credits (demo)', refType: 'ADMIN' },
      { userId: marco.id, type: 'TOPUP', amountCents: 5000, balanceAfterCents: 5000, description: 'Welcome credits (demo)', refType: 'ADMIN' },
      { userId: fatima.id, type: 'TOPUP', amountCents: 12000, balanceAfterCents: 12000, description: 'Welcome credits (demo)', refType: 'ADMIN' },
    ],
  })

  // ---------- CMS ----------
  await db.cmsPage.createMany({
    data: [
      { slug: 'about-us', title: 'About TutorSphere', content: '# Welcome to TutorSphere\n\nTutorSphere connects learners with exceptional tutors worldwide. We believe great teaching changes lives, and technology should make that teaching accessible to everyone, everywhere.\n\n## Our mission\n\nTo make personalized, one-to-one learning available to every student on the planet — regardless of location, background or budget.\n\n## Why we exist\n\nMillions of talented tutors and eager learners never find each other. We remove the barriers: discovery, scheduling, payments and a classroom that works in the browser.' },
      { slug: 'how-it-works', title: 'How It Works', content: '## 1. Find your tutor\n\nSearch by subject, price, language and availability. Read verified reviews from real students.\n\n## 2. Book a lesson\n\nPick a time that suits you — our calendar automatically converts to your timezone. Pay securely with wallet credits or your preferred payment provider.\n\n## 3. Learn in the interactive classroom\n\nMeet in our built-in video classroom with a shared whiteboard, chat and file sharing. No downloads needed.\n\n## 4. Track your progress\n\nSet goals, receive homework, and watch your skills grow lesson by lesson.' },
      { slug: 'contact-us', title: 'Contact Us', content: 'We are here to help.\n\n**Support:** support@tutorsphere.app\n**Tutor onboarding:** tutors@tutorsphere.app\n**Partnerships:** partners@tutorsphere.app\n\nOr open a support ticket from your dashboard — we usually reply within 24 hours.' },
      { slug: 'terms', title: 'Terms & Conditions', content: '## 1. Acceptance\n\nBy accessing TutorSphere you agree to these terms. TutorSphere is a marketplace connecting independent tutors with students.\n\n## 2. Accounts\n\nYou must provide accurate information and keep credentials secure. Tutors must complete verification before offering lessons.\n\n## 3. Payments\n\nLesson payments are held by the platform and released to tutors upon lesson completion, minus the platform commission.\n\n## 4. Conduct\n\nHarassment, fraud, and attempts to move payments off-platform are prohibited and result in account termination.' },
      { slug: 'privacy', title: 'Privacy Policy', content: 'We respect your privacy.\n\n**Data we collect:** account details, lesson history, messages, payment records.\n**How we use it:** to operate the marketplace, process payments, and improve the service. We never sell personal data.\n**Your rights:** export or delete your data at any time from account settings, or by contacting support.\n**Minors:** accounts for students under 13 require guardian management, and tutor-student messaging is monitored for safeguarding.' },
      { slug: 'refund-policy', title: 'Refund Policy', content: 'Lessons can be cancelled free of charge up to 12 hours before the start time — credits return to your wallet automatically.\n\nCancellations inside 12 hours may forfeit the lesson fee at the tutor\'s discretion.\n\nIf a technical problem prevented the lesson from taking place, open a dispute within 48 hours and our support team will review and refund where appropriate.' },
      { slug: 'tutor-guidelines', title: 'Tutor Guidelines', content: 'Welcome to the TutorSphere teaching community!\n\n**Professionalism:** keep your profile accurate, be punctual, and prepare for lessons.\n**Safeguarding:** lessons with minors must be booked by a guardian. Keep communication on-platform.\n**Payouts:** complete lessons correctly and your earnings become available for withdrawal after review.\n**Quality:** respond to booking requests within 24 hours and keep your calendar up to date.' },
    ],
  })
  await db.faq.createMany({
    data: [
      { question: 'How do I find the right tutor?', answer: 'Use the search filters to narrow by subject, price, availability and language. Read reviews from verified students, and book a discounted trial lesson to see if the tutor is a good fit.', order: 1 },
      { question: 'How does the free trial lesson work?', answer: 'Most tutors offer a discounted trial lesson so you can meet them, discuss your goals and check the classroom before committing to regular lessons.', order: 2 },
      { question: 'What payment methods are supported?', answer: 'You can pay with your TutorSphere wallet credits. Card payments via Stripe, PayPal, Paystack and Flutterwave can be enabled by the administrator once provider credentials are configured.', order: 3 },
      { question: 'Can I cancel or reschedule a lesson?', answer: 'Yes — free of charge up to 12 hours before the lesson. After that, the tutor may keep the fee. You can manage everything from "My Lessons".', order: 4 },
      { question: 'How do tutors get paid?', answer: 'Tutors earn the lesson price minus the platform commission (20% by default). Earnings become available after the lesson is completed and can be withdrawn from the Earnings page.', order: 5 },
      { question: 'Is the video classroom secure?', answer: 'Yes. Classroom rooms are private to the booked tutor and student, access uses signed expiring tokens, and all traffic is encrypted end-to-end between participants.', order: 6 },
      { question: 'What languages does the platform support?', answer: 'The interface currently supports English and Arabic (with right-to-left layout), and tutors teach in dozens of languages — filter tutors by the language you want to learn.', order: 7 },
    ],
  })
  await db.testimonial.createMany({
    data: [
      { name: 'Amira K.', role: 'Student', country: 'Morocco', content: 'I passed my IELTS with 8.0 after three months with my TutorSphere tutor. The whiteboard and shared documents made every lesson count.', rating: 5 },
      { name: 'James O.', role: 'Student', country: 'Ghana', content: 'Booking is effortless and the timezone conversion means I never miss a lesson. My math grades went from C to A.', rating: 5 },
      { name: 'Sofia R.', role: 'Tutor', country: 'Spain', content: 'As a tutor, the dashboard gives me everything — schedule, earnings, student notes. It feels built by people who understand teaching.', rating: 5 },
      { name: 'Kenji T.', role: 'Student', country: 'Japan', content: 'The trial lessons let me try three Spanish tutors before choosing. Brilliant way to find the right fit.', rating: 4 },
    ],
  })
  await db.blogPost.createMany({
    data: [
      { slug: '5-tips-online-learning', title: '5 Tips to Get the Most Out of Online Tutoring', excerpt: 'Simple habits that separate students who improve from students who plateau.', content: '## 1. Set a concrete goal\n\n"Get better at English" is a wish. "Hold a 15-minute conversation by June" is a goal...\n\n## 2. Review within 24 hours\n\nMemory research is clear: a 10-minute review the same evening doubles retention.\n\n## 3. Speak, even badly\n\nErrors are data for your tutor — silence teaches nothing.\n\n## 4. Use the whiteboard\n\nAsk your tutor to diagram grammar and problems live. Visual memory sticks.\n\n## 5. Keep a streak\n\nTwo lessons a week beats one marathon session every fortnight.', published: true },
      { slug: 'tutor-spotlight-omar', title: 'Tutor Spotlight: How Omar Makes Math Click', excerpt: 'Our most-booked math tutor shares his teaching philosophy.', content: 'Omar Farouk has completed 350+ lessons with a near-perfect rating. His secret? "Nobody hates math. They hate feeling lost."...', published: true },
    ],
  })

  // ---------- Support tickets ----------
  const ticket = await db.supportTicket.create({
    data: { userId: leyla.id, subject: 'How do credits work?', category: 'billing', status: 'PENDING' },
  })
  await db.ticketMessage.createMany({
    data: [
      { ticketId: ticket.id, senderId: leyla.id, body: 'Hi! I bought a package — do unused lessons expire?' },
      { ticketId: ticket.id, senderId: support.id, body: 'Hello Leyla! Package credits are valid for 6 months. You can see remaining credits under Payments → Lesson credits.', isStaff: true },
    ],
  })

  // ---------- Notifications & audit ----------
  await db.notification.createMany({
    data: [
      { userId: alex.id, type: 'booking', title: 'Lesson confirmed with Sarah Collins', body: 'Your English lesson is confirmed. Check the calendar for the exact time in your timezone.', link: 'lessons' },
      { userId: tutorProfiles['sarah@tutorsphere.app'].userId, type: 'booking', title: 'New booking from Alex Morgan', body: 'You have a new confirmed lesson.', link: 'calendar' },
      { userId: admin.id, type: 'admin', title: '2 tutor applications awaiting review', body: 'Grace Mensah and Nour Khalil have submitted applications.', link: 'admin-applications' },
    ],
  })
  await db.auditLog.create({
    data: { actorId: admin.id, action: 'SEED', entity: 'system', meta: JSON.stringify({ note: 'Initial demo data seed' }) },
  })

  console.log('✅ Seed complete.')
  console.log('   Demo accounts (local dev only):')
  console.log('   Admin  : admin@tutorsphere.app / Password123!')
  console.log('   Support: support@tutorsphere.app / Password123!')
  console.log('   Student: student@tutorsphere.app / Password123!  (Alex, wallet funded)')
  console.log('   Student: student2@tutorsphere.app / Password123! (Leyla)')
  console.log('   Student: student3@tutorsphere.app / Password123! (Marco)')
  console.log('   Parent : parent@tutorsphere.app / Password123!  (Fatima)')
  console.log('   Tutors : sarah@ / omar@ / elena@ / david@ / ayse@tutorsphere.app / Password123!')
  console.log('   Pending tutors: grace@ / tutor.pending@tutorsphere.app / Password123!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
