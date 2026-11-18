'use client';
import { uiText } from "@/lib/ui-text";
import PlatformLogo from './PlatformLogo';
import { PackagesView } from './PackagesView';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp, RTL_LANGS, LANGUAGES } from '@/lib/store';
import { useT } from '@/lib/i18n';
import { api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { GraduationCap, Bell, MessageCircle, Menu, LogOut, User as UserIcon, LayoutDashboard, LifeBuoy, Wallet, ChevronLeft } from 'lucide-react';
import Landing from './Landing';
import AuthView from './AuthView';
import SearchView from './SearchView';
import TutorProfileView from './TutorProfileView';
import StudentDashboard from './StudentDashboard';
import TutorDashboard from './TutorDashboard';
import TutorOnboarding from './TutorOnboarding';
import AdminDashboard from './AdminDashboard';
import MessagesView from './MessagesView';
import ClassroomView from './ClassroomView';
import SupportView from './SupportView';
import CmsView from './CmsView';
import GameCenter from '../games/GameCenter';
import GameInvitationWatcher from '../games/GameInvitationWatcher';
import ThemeToggle from './ThemeToggle';
import MobileNavigation from './MobileNavigation';
import CallInvitationWatcher from './CallInvitationWatcher';
import PostCallFeedback from './PostCallFeedback';
import { useAppearancePreferences } from '@/hooks/use-appearance-preferences';
import './mobile-app.css';
import './platform-upgrades.css';
import { usePlatformPreferences } from '@/hooks/use-platform-preferences';
import { usePresence } from '@/hooks/use-presence';
import ClassesView from './GroupClasses';
const CURRENCIES = ['USD', 'EUR', 'GBP', 'GHS', 'IQD', 'TRY'];
const isStaff = (role?: string | null) => role === 'ADMIN' || role === 'SUPPORT';
function NavLink({ label, onClick }: {
    label: string;
    onClick: () => void;
}) {
    return (<button onClick={onClick} className="text-sm font-medium text-muted-foreground hover:text-teal-700 transition-colors px-1 py-2">
      {uiText(label)}
    </button>);
}
export default function AppShell() {
    useAppearancePreferences();
    usePlatformPreferences();
    usePresence();
    const { view, user, publicData, unreadNotifications, unreadMessages, currency, language, booted, go, back, setCurrency, setLanguage, logout } = useApp();
    const t = useT(language);
    const platformName = publicData?.settings.platformName ?? 'TutorSphere';
    const [menuOpen, setMenuOpen] = useState(false);
    useEffect(() => { setMenuOpen(false); }, [view]);
    // Boot: load public data + session
    useEffect(() => {
        const legacyClassroom = new URLSearchParams(window.location.search);
        const stopNavigation = useApp.getState().restoreNavigation();
        const boot = async () => {
            try {
                const data = await api<import('@/lib/store').PublicData>('/api/public');
                useApp.getState().setPublicData(data);
            }
            catch { /* landing can still render with defaults */ }
            await useApp.getState().refreshMe();
            const requestedClassroom = legacyClassroom.get('classroom');
            if (requestedClassroom) {
                const callId = legacyClassroom.get('callId');
                if (useApp.getState().user)
                    useApp.getState().go('classroom', { bookingId: requestedClassroom, ...(callId ? { callId } : {}) });
                else
                    useApp.getState().go('auth', { mode: 'login', classroom: requestedClassroom, ...(callId ? { callId } : {}) });
            }
            useApp.getState().setBooted(true);
        };
        void boot();
        return stopNavigation;
    }, []);
    useEffect(() => {
        document.title = platformName;
        const icon = publicData?.settings.iconUrl || '/favicon.ico';
        if (icon) {
            let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.head.append(link);
            }
            link.href = icon;
            link.type = icon.endsWith('.ico') ? 'image/x-icon' : 'image/webp';
        }
    }, [platformName, publicData?.settings.iconUrl]);
    // Language + direction
    useEffect(() => {
        document.documentElement.lang = language;
        document.documentElement.dir = RTL_LANGS.has(language) ? 'rtl' : 'ltr';
    }, [language]);
    const isStaffRole = isStaff(user?.role);
    const header = (<header className="platform-header sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4">
        <button onClick={() => go('landing')} className="flex items-center gap-2 shrink-0" aria-label={uiText("{{value1}} home", { value1: platformName })}>
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white shadow-sm">
            <PlatformLogo size={28}/>
          </span>
          <span className="text-lg font-bold tracking-tight text-foreground">{platformName}</span>
        </button>

        {view.name !== 'landing' && uiText((<Button variant="ghost" size="sm" onClick={back} className="hidden sm:inline-flex gap-1 text-muted-foreground">
            <ChevronLeft className="h-4 w-4 flip-x"/> {t('back') !== 'back' ? t('back') : uiText("Back")}
          </Button>))}

        <nav className="hidden lg:flex items-center gap-5 ml-4" aria-label={uiText("Main")}>
          <NavLink label={t('findTutors')} onClick={() => go('search')}/>
          <NavLink label={t('howItWorks')} onClick={() => go('cms', { slug: 'how-it-works' })}/>
          <NavLink label={t('becomeTutor')} onClick={() => go(user ? 'onboarding-tutor' : 'auth', user ? {} : { mode: 'register', role: 'TUTOR' })}/>
          <NavLink label={t('help')} onClick={() => go('help')}/>
          <NavLink label={uiText("Classes")} onClick={() => go('classes')}/>
          <NavLink label={uiText("Games")} onClick={() => go('games')}/>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <div className="hidden md:block">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger size="sm" className="w-[110px] border-border" aria-label={uiText("Language")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {uiText(LANGUAGES.filter(item => !publicData?.settings.enabledLanguages || publicData.settings.enabledLanguages.includes(item.code)).map(item => <SelectItem key={item.code} value={item.code}>{uiText(item.label)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="hidden md:block">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger size="sm" className="w-[86px] border-border" aria-label={uiText("Currency")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {uiText(CURRENCIES.filter(c => !publicData?.settings.enabledCurrencies || publicData.settings.enabledCurrencies.includes(c)).map((c) => <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          {user ? (<>
              <Button variant="ghost" size="icon" className="relative" aria-label={uiText("Messages")} onClick={() => go('messages')}>
                <MessageCircle className="h-5 w-5 text-muted-foreground"/>
                {unreadMessages > 0 && uiText((<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {unreadMessages > 9 ? '9+' : uiText(unreadMessages)}
                  </span>))}
              </Button>
              <Button variant="ghost" size="icon" className="relative" aria-label={uiText("Notifications")} onClick={() => go(user.role === 'STUDENT' ? 'student' : user.role === 'TUTOR' ? 'tutor-dash' : 'admin', { tab: 'notifications' })}>
                <Bell className="h-5 w-5 text-muted-foreground"/>
                {unreadNotifications > 0 && uiText((<span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white">
                    {unreadNotifications > 9 ? '9+' : uiText(unreadNotifications)}
                  </span>))}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="rounded-full outline-none ring-teal-600 focus-visible:ring-2" aria-label={uiText("Account menu")}>
                    <Avatar className="h-9 w-9 border border-border">
                      <AvatarImage src={user.avatarUrl ?? undefined} alt={user.name}/>
                      <AvatarFallback className="bg-teal-100 text-teal-800 text-sm font-semibold">
                        {user.name.split(' ').map((p) => p[0]).slice(0, 2).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="text-sm font-semibold">{user.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    <Badge variant="secondary" className="mt-1.5 bg-teal-100 text-teal-800 border-0">{user.role}</Badge>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.role === 'STUDENT' && uiText((<DropdownMenuItem onClick={() => go('student')}><LayoutDashboard className="h-4 w-4 mr-2"/>{t('dashboard')}</DropdownMenuItem>))}
                  {user.role === 'TUTOR' && uiText((<DropdownMenuItem onClick={() => go('tutor-dash')}><LayoutDashboard className="h-4 w-4 mr-2"/>{t('dashboard')}</DropdownMenuItem>))}
                  {isStaffRole && uiText((<DropdownMenuItem onClick={() => go('admin')}><LayoutDashboard className="h-4 w-4 mr-2"/>{uiText("Admin console")}</DropdownMenuItem>))}
                  <DropdownMenuItem onClick={() => go('messages')}><MessageCircle className="h-4 w-4 mr-2"/>{t('messages')}</DropdownMenuItem>
                  {user.role === 'STUDENT' && uiText((<DropdownMenuItem onClick={() => go('packages')}><Wallet className="h-4 w-4 mr-2"/>{uiText("Packages")}</DropdownMenuItem>))}
                  <DropdownMenuItem onClick={() => go('support')}><LifeBuoy className="h-4 w-4 mr-2"/>{t('help')}</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => void logout()}><LogOut className="h-4 w-4 mr-2"/>{t('logout')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>) : uiText((<div className="hidden sm:flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => go('auth', { mode: 'login' })}>{t('login')}</Button>
              <Button size="sm" onClick={() => go('auth', { mode: 'register' })} className="bg-teal-600 hover:bg-teal-700">{t('signup')}</Button>
            </div>))}

          <div className="lg:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={uiText("Menu")}><Menu className="h-5 w-5"/></Button>
              </SheetTrigger>
              <SheetContent side="right" className="mobile-more-sheet w-80 max-w-[90vw] overflow-y-auto">
                <SheetTitle className="sr-only">{uiText("Navigation menu")}</SheetTitle>
                <div className="mt-6 flex flex-col gap-1">
                  {user && <>
                    <div className="mb-4 rounded-2xl bg-muted p-4"><p className="font-semibold">{user.name}</p><p className="mt-1 text-xs text-muted-foreground break-all">{user.email}</p></div>
                    <Button variant="ghost" className="justify-start" onClick={() => go(isStaffRole ? 'admin' : user.role === 'TUTOR' ? 'tutor-dash' : 'student')}><LayoutDashboard className="size-4 mr-2"/>{uiText("My dashboard")}</Button>
                    <Button variant="ghost" className="justify-start" onClick={() => go(isStaffRole ? 'admin' : user.role === 'TUTOR' ? 'tutor-dash' : 'student', { tab: isStaffRole ? 'settings' : user.role === 'TUTOR' ? 'profile' : 'settings' })}><UserIcon className="size-4 mr-2"/>{uiText("Account & settings")}</Button>
                  </>}
                  <Button variant="ghost" className="justify-start" onClick={() => go('search')}><UserIcon className="h-4 w-4 mr-2"/>{t('findTutors')}</Button>
                  <Button variant="ghost" className="justify-start" onClick={() => go('cms', { slug: 'how-it-works' })}>{t('howItWorks')}</Button>
                  <Button variant="ghost" className="justify-start" onClick={() => go(user ? 'onboarding-tutor' : 'auth', user ? {} : { mode: 'register', role: 'TUTOR' })}>{t('becomeTutor')}</Button>
                  <Button variant="ghost" className="justify-start" onClick={() => go('help')}>{t('help')}</Button>
                  <Button variant="ghost" className="justify-start" onClick={() => go('classes')}>{uiText("Classes")}</Button>
                  <Button variant="ghost" className="justify-start" onClick={() => go('games')}>{uiText("Brain games")}</Button>
                  {uiText((publicData?.cmsPages ?? []).map((page) => <Button key={page.slug} variant="ghost" className="justify-start" onClick={() => go('cms', { slug: page.slug })}>{page.title}</Button>))}
                  {user && <Button variant="ghost" className="justify-start text-muted-foreground" onClick={() => void logout()}><LogOut className="size-4 mr-2"/>{uiText("Sign out")}</Button>}
                  {!user && uiText((<>
                      <Button variant="ghost" className="justify-start" onClick={() => go('auth', { mode: 'login' })}>{t('login')}</Button>
                      <Button className="justify-start bg-teal-600 hover:bg-teal-700" onClick={() => go('auth', { mode: 'register' })}>{t('signup')}</Button>
                    </>))}
                  <div className="mt-4 flex gap-2">
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger size="sm" aria-label={uiText("Language")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {uiText(LANGUAGES.filter(item => !publicData?.settings.enabledLanguages || publicData.settings.enabledLanguages.includes(item.code)).map(item => <SelectItem key={item.code} value={item.code}>{uiText(item.code.toUpperCase())}</SelectItem>))}
                      </SelectContent>
                    </Select>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger size="sm" aria-label={uiText("Currency")}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {uiText(CURRENCIES.filter(c => !publicData?.settings.enabledCurrencies || publicData.settings.enabledCurrencies.includes(c)).map((c) => <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>);
    const cmsLinks = publicData?.cmsPages ?? [];
    const footer = (<footer className="mt-auto border-t border-border bg-muted/40 pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="grid gap-8 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600 text-white">
                <GraduationCap className="h-4 w-4"/>
              </span>
              <span className="font-bold text-foreground">{platformName}</span>
            </div>
            <p className="mt-3 text-sm text-muted-foreground max-w-xs">{publicData?.settings.tagline ?? uiText("Learn anything, from anywhere.")}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{uiText("Platform")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><button className="hover:text-teal-700" onClick={() => go('search')}>{t('findTutors')}</button></li>
              <li><button className="hover:text-teal-700" onClick={() => go('cms', { slug: 'how-it-works' })}>{t('howItWorks')}</button></li>
              <li><button className="hover:text-teal-700" onClick={() => go(user ? 'onboarding-tutor' : 'auth', user ? {} : { mode: 'register', role: 'TUTOR' })}>{t('becomeTutor')}</button></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{uiText("Company & Legal")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {uiText(cmsLinks.map((p) => (<li key={p.slug}>
                  <button className="hover:text-teal-700 text-start" onClick={() => go('cms', { slug: p.slug })}>{uiText(p.title)}</button>
                </li>)))}
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{uiText("Support")}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li><button className="hover:text-teal-700" onClick={() => go('help')}>{uiText("Help Center")}</button></li>
              <li><button className="hover:text-teal-700" onClick={() => go('support')}>{uiText("Contact support")}</button></li>
              <li>{publicData?.settings.contactEmail ?? uiText("support@tutorsphere.app")}</li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-xs text-muted-foreground/70">
          © {uiText(new Date().getFullYear())} {platformName}{uiText(". All rights reserved. Secure payments \u00B7 Verified tutors \u00B7 lessons in your timezone.")}</div>
      </div>
    </footer>);
    const main = (() => {
        switch (view.name) {
            case 'landing': return <Landing />;
            case 'auth': return <AuthView />;
            case 'search': return <SearchView />;
            case 'tutor': return <TutorProfileView tutorId={view.params?.id ?? ''}/>;
            case 'student': return <StudentDashboard initialTab={view.params?.tab}/>;
            case 'tutor-dash': return <TutorDashboard initialTab={view.params?.tab}/>;
            case 'onboarding-tutor': return <TutorOnboarding />;
            case 'admin': return <AdminDashboard initialTab={view.params?.tab} onExit={() => go('landing')}/>;
            case 'messages': return <MessagesView />;
            case 'classroom': return <ClassroomView key={`${view.params?.bookingId}-${view.params?.callId || ''}`} bookingId={view.params?.bookingId ?? ''} callId={view.params?.callId} onExit={() => go(user?.role === 'TUTOR' ? 'tutor-dash' : 'student', { tab: user?.role === 'TUTOR' ? 'calendar' : 'lessons' })}/>;
            case 'support': return <SupportView />;
            case 'help': return <CmsView mode="help"/>;
            case 'cms': return <CmsView slug={view.params?.slug ?? 'about-us'}/>;
            case 'packages': return <PackagesView />;
            case 'classes': return <ClassesView />;
            case 'games': return <GameCenter key={`${view.params?.room ?? ''}-${view.params?.game ?? ''}`} initialRoomCode={view.params?.room} initialGameSlug={view.params?.game} onExit={() => go('landing')}/>;
            default: return <Landing />;
        }
    })();
    if (!booted) {
        return (<div className="min-h-screen flex items-center justify-center bg-muted/40">
        <div className="flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white animate-pulse">
            <GraduationCap className="h-6 w-6"/>
          </span>
          <p className="text-sm text-muted-foreground">{uiText("Loading ")}{platformName}…</p>
        </div>
      </div>);
    }
    if (view.name === 'admin' || view.name === 'tutor-dash' || view.name === 'classroom') {
        return (<main data-dashboard={view.name === 'classroom' ? undefined : view.name} className="min-h-dvh" dir={RTL_LANGS.has(language) ? 'rtl' : 'ltr'}>
        {uiText(main)}
        {view.name === 'classroom' && <GameInvitationWatcher />}
        <CallInvitationWatcher />
        <PostCallFeedback />
      </main>);
    }
    return (<div className="platform-shell min-h-screen flex flex-col bg-card" data-view={view.name} dir={RTL_LANGS.has(language) ? 'rtl' : 'ltr'}>
      {uiText(header)}
      <main className="flex-1">
        {view.name === 'landing' ? uiText(main) : (<motion.div key={view.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            {uiText(main)}
          </motion.div>)}
      </main>
      {uiText(footer)}
      <MobileNavigation />
      <GameInvitationWatcher />
      <CallInvitationWatcher />
      <PostCallFeedback />
    </div>);
}
