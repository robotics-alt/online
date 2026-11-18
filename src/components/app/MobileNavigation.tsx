'use client';
import { uiText } from "@/lib/ui-text";
import { BookOpen, CalendarDays, CircleUserRound, Home, LayoutDashboard, MessageCircle, Search, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useApp } from '@/lib/store';
import { cn } from '@/lib/utils';
interface NavigationItem {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    badge?: number;
    onClick: () => void;
}
export default function MobileNavigation({ adminTab, onAdminNavigate }: {
    adminTab?: string;
    onAdminNavigate?: (tab: string) => void;
}) {
    const { user, view, go, unreadMessages, language } = useApp();
    const t = useT(language);
    const dashboard = user?.role === 'TUTOR' ? 'tutor-dash' : user?.role === 'ADMIN' || user?.role === 'SUPPORT' ? 'admin' : 'student';
    const items: NavigationItem[] = adminTab ? [
        { label: 'Overview', icon: LayoutDashboard, active: adminTab === 'overview', onClick: () => onAdminNavigate?.('overview') },
        { label: 'Users', icon: Users, active: adminTab === 'users', onClick: () => onAdminNavigate?.('users') },
        { label: 'Bookings', icon: CalendarDays, active: adminTab === 'bookings', onClick: () => onAdminNavigate?.('bookings') },
        { label: 'Finance', icon: Wallet, active: adminTab === 'finance', onClick: () => onAdminNavigate?.('finance') },
        { label: 'My account', icon: CircleUserRound, active: adminTab === 'settings', onClick: () => onAdminNavigate?.('settings') },
    ] : user?.role === 'TUTOR' ? [
        { label: 'Home', icon: Home, active: view.name === 'tutor-dash' && (!view.params?.tab || view.params.tab === 'overview'), onClick: () => go('tutor-dash') },
        { label: 'Calendar', icon: CalendarDays, active: view.name === 'tutor-dash' && view.params?.tab === 'calendar', onClick: () => go('tutor-dash', { tab: 'calendar' }) },
        { label: 'Students', icon: Users, active: view.name === 'tutor-dash' && view.params?.tab === 'students', onClick: () => go('tutor-dash', { tab: 'students' }) },
        { label: 'Earnings', icon: Wallet, active: view.name === 'tutor-dash' && view.params?.tab === 'earnings', onClick: () => go('tutor-dash', { tab: 'earnings' }) },
        { label: 'My account', icon: CircleUserRound, active: view.name === 'tutor-dash' && view.params?.tab === 'profile', onClick: () => go('tutor-dash', { tab: 'profile' }) },
    ] : [
        { label: 'Home', icon: Home, active: view.name === 'landing' || view.name === dashboard && (!view.params?.tab || view.params.tab === 'overview'), onClick: () => go(user ? dashboard : 'landing') },
        { label: 'Explore', icon: Search, active: ['search', 'tutor'].includes(view.name), onClick: () => go('search') },
        { label: 'Lessons', icon: BookOpen, active: view.name === dashboard && view.params?.tab === 'lessons', onClick: () => user ? go(dashboard, { tab: 'lessons' }) : go('auth', { mode: 'login' }) },
        { label: 'Messages', icon: MessageCircle, active: view.name === 'messages', badge: unreadMessages, onClick: () => go(user ? 'messages' : 'auth', user ? {} : { mode: 'login' }) },
        { label: 'My account', icon: CircleUserRound, active: view.name === 'auth' || view.name === dashboard && ['settings', 'profile'].includes(view.params?.tab || ''), onClick: () => user ? go(dashboard, { tab: user.role === 'TUTOR' ? 'profile' : 'settings' }) : go('auth', { mode: 'login' }) },
    ];
    return <nav className={cn('mobile-app-nav', adminTab && 'mobile-app-nav--admin')} aria-label={adminTab ? uiText("Admin quick navigation") : uiText("Mobile navigation")}>
    {uiText(items.map(({ label, icon: Icon, active, badge, onClick }) => <button key={label} type="button" className={cn('mobile-app-nav-item', active && 'is-active')} onClick={onClick} aria-current={active ? 'page' : undefined}>
      <span className="mobile-app-nav-icon"><Icon size={21} strokeWidth={active ? 2.3 : 1.8} aria-hidden/>{badge ? <span className="mobile-app-nav-badge" aria-label={uiText("{{value1}} unread messages", { value1: badge })}>{badge > 9 ? '9+' : uiText(badge)}</span> : uiText(null)}</span>
      <span>{t(({ Home: 'nav.home', Explore: 'nav.explore', Lessons: 'nav.lessons', Messages: 'messages', 'My account': 'myAccount', Calendar: 'calendar', Students: 'teacher.students', Earnings: 'earnings', Overview: 'admin.overview', Users: 'admin.users', Bookings: 'admin.bookings', Finance: 'admin.finance' } as Record<string, string>)[label] || label)}</span>
    </button>))}
  </nav>;
}
