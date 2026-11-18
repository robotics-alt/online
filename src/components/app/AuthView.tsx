'use client';
import { uiText } from "@/lib/ui-text";
import ProfilePhotoField from './ProfilePhotoField';
import StudentLearningSetup from './StudentLearningSetup';
import { useT } from '@/lib/i18n';
import LanguageListEditor from './LanguageListEditor';
import { type LanguageItem } from '@/lib/profile-data';
import { ALL_COUNTRY_NAMES, suggestedCountry, timezoneForCountry, zonesForCountry } from '@/lib/country-timezones';
import { useEffect, useState } from 'react';
import { useApp, api, COUNTRY_OPTIONS, RTL_LANGS } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Eye, EyeOff, GraduationCap, Loader2, MailQuestion, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { COMMON_TIMEZONES } from '@/lib/tz';
type Mode = 'login' | 'register' | 'forgot' | 'reset' | 'onboard';
const INTERESTS = ['Languages', 'Mathematics', 'Programming', 'Music', 'Business', 'Test preparation', 'Other'];
export default function AuthView() {
    const { view, go, refreshMe, language, publicData } = useApp();
    const t = useT(language);
    const [avatarData, setAvatarData] = useState('');
    const params = view.params ?? {};
    const [mode, setMode] = useState<Mode>(params.mode === 'onboard' ? 'onboard' : params.mode === 'register' ? 'register' : 'login');
    const [pending, setPending] = useState(false);
    const [authError, setAuthError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const { toast } = useToast();
    // form state
    const [role, setRole] = useState<'STUDENT' | 'TUTOR'>(params.role === 'TUTOR' ? 'TUTOR' : 'STUDENT');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [country, setCountry] = useState(() => suggestedCountry(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
    const [spokenLanguages, setSpokenLanguages] = useState<LanguageItem[]>([{ name: 'English', level: 'B1 · Intermediate' }]);
    const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
    const [resetToken, setResetToken] = useState('');
    const [newPassword, setNewPassword] = useState('');
    useEffect(() => { setMode(params.mode === 'onboard' ? 'onboard' : params.mode === 'register' ? 'register' : 'login'); }, [params.mode]);
    useEffect(() => { setAuthError(''); }, [mode]);
    const submitAuth = async (fields: FormData) => {
        if (pending)
            return;
        // Read the submitted fields as well as React state so browser autofill is captured.
        const submittedEmail = String(fields.get('email') ?? email).trim();
        const submittedPassword = String(fields.get('password') ?? password);
        setAuthError('');
        setPending(true);
        try {
            if (mode === 'login') {
                const res = await api<{
                    role: string;
                    onboarded: boolean;
                }>('/api/auth/login', { method: 'POST', json: { email: submittedEmail, password: submittedPassword } });
                await refreshMe();
                if (!useApp.getState().user)
                    throw new Error('Your sign-in session could not be loaded. Please try again.');
                if (params.classroom)
                    go('classroom', { bookingId: params.classroom, ...(params.callId ? { callId: params.callId } : {}) });
                else if (res.role === 'ADMIN' || res.role === 'SUPPORT')
                    go('admin');
                else if (res.role === 'TUTOR')
                    go('tutor-dash');
                else
                    go('student');
                toast({ title: 'Welcome back!' });
            }
            else if (mode === 'register') {
                if (!avatarData)
                    throw Error('Add your profile photo to continue');
                const res = await api<{
                    userId: string;
                    role: string;
                }>('/api/auth/register', { method: 'POST', json: { email: submittedEmail, password: submittedPassword, name: String(fields.get('name') ?? name).trim(), role, country: country || undefined, timezone, spokenLanguages, avatarData } });
                await refreshMe();
                if (res.role === 'TUTOR')
                    go('onboarding-tutor');
                else
                    go('auth', { mode: 'onboard' });
            }
            else if (mode === 'forgot') {
                const res = await api<{
                    resetToken?: string;
                    message: string;
                }>('/api/auth/forgot', { method: 'POST', json: { email: submittedEmail } });
                if (res.resetToken) {
                    setResetToken(res.resetToken);
                    setMode('reset');
                    toast({ title: 'Reset token issued', description: 'Email delivery is not configured — your token has been filled in automatically.' });
                }
                else {
                    toast({ title: 'Check your inbox', description: res.message });
                }
            }
            else if (mode === 'reset') {
                await api('/api/auth/reset', { method: 'POST', json: { token: String(fields.get('resetToken') ?? resetToken), password: String(fields.get('newPassword') ?? newPassword) } });
                await refreshMe();
                go('student');
                toast({ title: 'Password updated' });
            }
        }
        catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
        }
        finally {
            setPending(false);
        }
    };
    if (mode === 'onboard') {
        return <StudentLearningSetup />;
    }
    return (<div className={mode === 'register' ? 'registration-shell' : 'mx-auto flex max-w-md flex-col justify-center px-4 py-12'} data-registration-role={mode === 'register' ? role : undefined}>
      {mode === 'register' && <aside className="registration-intro"><span>{role === 'TUTOR' ? t('teacherRegistration') : t('studentRegistration')}</span><h1>{role === 'TUTOR' ? t('shareYourExpertise') : t('yourNextChapter')}</h1><p>{role === 'TUTOR' ? t('teacherSignupIntro') : t('studentSignupIntro')}</p><div className="registration-steps"><span>1. {t('yourAccount')}</span><span>2. {role === 'TUTOR' ? t('teachingProfile') : t('yourLearningPlan')}</span><span>3. {role === 'TUTOR' ? t('reviewAndApproval') : t('findMatchingTutors')}</span></div></aside>}<Card className="rounded-2xl border-border shadow-sm">
        <CardHeader className="text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-600 text-white">
            <GraduationCap className="h-6 w-6"/>
          </span>
          <CardTitle className="mt-2 text-xl">
            {mode === 'login' ? uiText("Welcome back") : mode === 'register' ? t('createAccount') : mode === 'forgot' ? uiText("Reset your password") : uiText("Set a new password")}
          </CardTitle>
          <CardDescription>
            {mode === 'register' ? uiText("Start learning or teaching in minutes.") : mode === 'login' ? uiText("Log in to your {{value1}} account.", { value1: (publicData?.settings.platformName || 'TutorSphere') }) : mode === 'forgot' ? uiText("We will issue a reset token for your account.") : uiText("Choose a strong password (8+ characters).")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); void submitAuth(new FormData(event.currentTarget)); }}>
          {mode === 'register' && uiText((<>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant={role === 'STUDENT' ? 'default' : 'outline'} onClick={() => setRole('STUDENT')} className={role === 'STUDENT' ? 'bg-teal-600 hover:bg-teal-700' : ''}>
                  {t('wantToLearn')}
                </Button>
                <Button type="button" variant={role === 'TUTOR' ? 'default' : 'outline'} onClick={() => setRole('TUTOR')} className={role === 'TUTOR' ? 'bg-teal-600 hover:bg-teal-700' : ''}>
                  {t('wantToTeach')}
                </Button>
              </div>
              <ProfilePhotoField value={avatarData} onChange={setAvatarData}/><div className="space-y-1.5">
                <Label htmlFor="name">{uiText("Full name")}</Label>
                <Input id="name" name="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder={uiText("Alex Morgan")} autoComplete="name"/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{uiText("Country")}</Label>
                  <Select value={country} onValueChange={(value) => { setCountry(value); setTimezone(timezoneForCountry(value, Intl.DateTimeFormat().resolvedOptions().timeZone)); }}>
                    <SelectTrigger><SelectValue placeholder={uiText("Select")}/></SelectTrigger>
                    <SelectContent>
                      {uiText(ALL_COUNTRY_NAMES.map((c) => <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{uiText("Time zone")}</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-64 scroll-slim">
                      {uiText([...new Set([timezone, ...zonesForCountry(country), ...COMMON_TIMEZONES])].map((tz) => <SelectItem key={tz} value={tz}>{uiText(tz)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>))}

          {mode === 'register' && <section className="space-y-3"><Label>{uiText("Languages you speak")}</Label><LanguageListEditor value={spokenLanguages} onChange={setSpokenLanguages}/></section>}
          {mode !== 'reset' && uiText((<div className="space-y-1.5">
              <Label htmlFor="email">{uiText("Email")}</Label>
              <Input id="email" name="email" type="email" required inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} placeholder={uiText("you@example.com")} autoComplete={mode === 'login' ? 'username' : 'email'}/>
            </div>))}
          {mode !== 'forgot' && mode !== 'reset' && uiText((<div className="space-y-1.5">
              <Label htmlFor="password">{uiText("Password")}</Label>
              <div className="relative">
                <Input id="password" name="password" type={showPassword ? 'text' : 'password'} required minLength={mode === 'register' ? 8 : undefined} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="pe-12" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={uiText("Enter your password")} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}/>
                <button type="button" className="absolute inset-y-0 end-0 flex w-11 items-center justify-center text-muted-foreground" aria-label={showPassword ? uiText("Hide password") : uiText("Show password")} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
              </div>
            </div>))}
          {mode === 'reset' && uiText((<>
              <div className="space-y-1.5">
                <Label htmlFor="token">{uiText("Reset token")}</Label>
                <Input id="token" name="resetToken" required value={resetToken} onChange={(e) => setResetToken(e.target.value)}/>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="newPassword">{uiText("New password")}</Label>
                <Input id="newPassword" name="newPassword" type="password" required minLength={8} autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}/>
              </div>
            </>))}

          {authError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{uiText(authError)}</p>}
          <Button type="submit" disabled={pending} className="w-full bg-teal-600 hover:bg-teal-700">
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            {mode === 'login' ? uiText("Log in") : mode === 'register' ? t('createAccount') : mode === 'forgot' ? uiText("Get reset token") : uiText("Update password")}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {mode === 'login' ? uiText((<>{uiText("No account?")}{' '}
                <button type="button" className="font-medium text-teal-700 hover:underline" onClick={() => setMode('register')}>{uiText("Sign up")}</button>
                {' · '}
                <button type="button" className="font-medium text-teal-700 hover:underline" onClick={() => setMode('forgot')}>{uiText("Forgot password?")}</button>
              </>)) : uiText((<button type="button" className="font-medium text-teal-700 hover:underline" onClick={() => setMode('login')}>{uiText("Back to login")}</button>))}
          </div>

          {mode === 'login' && uiText((<div className="rounded-xl bg-muted/40 border border-border p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-muted-foreground flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-teal-600"/>{uiText(" Demo accounts (local development only)")}</p>
              <p>{uiText("Student: student@tutorsphere.app")}</p>
              <p>{uiText("Tutor: sarah@tutorsphere.app")}</p>
              <p>{uiText("Admin: admin@tutorsphere.app")}</p>
              <p>{uiText("Password for all: ")}<code className="rounded bg-muted px-1">{uiText("Password123!")}</code></p>
            </div>))}
          {false && uiText((<p className="flex items-start gap-1.5 text-xs text-muted-foreground/70">
              <MailQuestion className="mt-0.5 h-3.5 w-3.5 shrink-0"/>{uiText("Email verification requires SMTP configuration. You can use the platform immediately; an administrator can enable email later.")}</p>))}
          </form>
        </CardContent>
      </Card>
      {RTL_LANGS.has(useApp.getState().language) && <p className="mt-4 text-center text-xs text-muted-foreground/70">واجهة تدعم الكتابة من اليمين إلى اليسار</p>}
    </div>);
}
