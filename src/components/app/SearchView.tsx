'use client';
import { uiText } from "@/lib/ui-text";
import { PackageStrip } from './PackagesView';
import { Fragment } from 'react';
import { GroupClassList } from './GroupClasses';
import { useCallback, useEffect, useState } from 'react';
import { useApp, api } from '@/lib/store';
import type { TutorCard as TutorCardData } from '@/lib/store';
import TutorCard from './TutorCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Loader2, SearchX, SlidersHorizontal } from 'lucide-react';
const COUNTRIES = ['United States', 'United Kingdom', 'Spain', 'Egypt', 'Turkey', 'Ghana', 'Iraq', 'Italy'];
export default function SearchView() {
    const { view, go, fmt, publicData } = useApp();
    const initial = view.params ?? {};
    const [q, setQ] = useState(initial.q ?? '');
    const [subject, setSubject] = useState(initial.subject ?? 'any');
    const [country, setCountry] = useState('any');
    const [language, setLanguage] = useState('');
    const [priceMax, setPriceMax] = useState([Math.max(1, Number(initial.priceMax) || 60)]);
    const [minRating, setMinRating] = useState('0');
    const [sort, setSort] = useState('relevance');
    const [trialOnly, setTrialOnly] = useState(false);
    const [tutors, setTutors] = useState<TutorCardData[]>([]);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [showFilters, setShowFilters] = useState(false);
    const subjects = publicData?.subjects ?? [];
    const search = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const sp = new URLSearchParams({
                page: String(p),
                priceMax: String(priceMax[0] * 100),
                minRating,
                sort,
            });
            if (q.trim())
                sp.set('q', q.trim());
            if (subject !== 'any')
                sp.set('subject', subject);
            if (country !== 'any')
                sp.set('country', country);
            if (language.trim())
                sp.set('language', language.trim());
            if (trialOnly)
                sp.set('trial', '1');
            const data = await api<{
                tutors: TutorCardData[];
                total: number;
                pages: number;
            }>(`/api/tutors?${sp}`);
            setTutors(data.tutors);
            setTotal(data.total);
            setPages(data.pages);
            setPage(p);
        }
        catch {
            setTutors([]);
        }
        finally {
            setLoading(false);
        }
    }, [q, subject, country, language, priceMax, minRating, sort, trialOnly]);
    useEffect(() => { void search(1); }, []); // initial
    return (<div className="search-screen mx-auto max-w-7xl px-4 py-8">
      <h1 className="text-2xl font-bold text-foreground">{q ? uiText("Tutors for \u201C{{value1}}\u201D", { value1: q }) : uiText("Find your tutor")}</h1>
      <p className="mt-1 text-muted-foreground">{uiText(total)}{uiText(" tutor")}{total === 1 ? '' : uiText("s")}{uiText(" available \u2014 prices in ")}{fmt(100000).slice(0, 1) === '$' ? uiText("your selected currency") : uiText("your currency")}</p>

      {/* Search row */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void search(1)} placeholder={uiText("Search by name or keyword\u2026")} className="h-11 rounded-xl" aria-label={uiText("Search")}/>
        <Select value={subject} onValueChange={(v) => { setSubject(v); setTimeout(() => void search(1), 0); }}>
          <SelectTrigger className="h-11 w-full rounded-xl sm:w-52"><SelectValue placeholder={uiText("Subject")}/></SelectTrigger>
          <SelectContent className="max-h-72 scroll-slim">
            <SelectItem value="any">{uiText("All subjects")}</SelectItem>
            {subjects.map((s) => <SelectItem key={s.id} value={s.slug}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => void search(1)} className="h-11 rounded-xl bg-teal-600 hover:bg-teal-700 shrink-0">{uiText("Search")}</Button>
        <Button variant="outline" onClick={() => setShowFilters((v) => !v)} className="h-11 rounded-xl shrink-0">
          <SlidersHorizontal className="mr-2 h-4 w-4"/>{uiText(" Filters")}</Button>
      </div>

      {/* Filters */}
      {showFilters && uiText((<Card className="mt-4 rounded-2xl border-border">
          <CardContent className="grid gap-5 p-5 md:grid-cols-3">
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/90">{uiText("Max price per hour: ")}<span className="text-teal-700 font-semibold">{uiText(fmt(priceMax[0] * 100))}</span></p>
              <Slider value={priceMax} onValueChange={setPriceMax} min={5} max={100} step={1}/>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/90">{uiText("Country")}</p>
              <Select value={country} onValueChange={setCountry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{uiText("Any country")}</SelectItem>
                  {uiText(COUNTRIES.map((c) => <SelectItem key={c} value={c}>{uiText(c)}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/90">{uiText("Language spoken")}</p>
              <Input value={language} onChange={(e) => setLanguage(e.target.value)} placeholder={uiText("e.g. Arabic, English\u2026")}/>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/90">{uiText("Minimum rating")}</p>
              <Select value={minRating} onValueChange={setMinRating}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{uiText("Any rating")}</SelectItem>
                  <SelectItem value="4">4.0+ ★</SelectItem>
                  <SelectItem value="4.5">4.5+ ★</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground/90">{uiText("Sort by")}</p>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">{uiText("Relevance")}</SelectItem>
                  <SelectItem value="price_asc">{uiText("Price: low to high")}</SelectItem>
                  <SelectItem value="price_desc">{uiText("Price: high to low")}</SelectItem>
                  <SelectItem value="rating">{uiText("Rating")}</SelectItem>
                  <SelectItem value="lessons">{uiText("Most lessons taught")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end gap-3">
              <label className="flex items-center gap-2 text-sm text-foreground/90 cursor-pointer">
                <input type="checkbox" checked={trialOnly} onChange={(e) => setTrialOnly(e.target.checked)} className="h-4 w-4 accent-teal-600"/>{uiText("Trial lesson available")}</label>
            </div>
            <div className="md:col-span-3">
              <Button onClick={() => void search(1)} className="bg-teal-600 hover:bg-teal-700">{uiText("Apply filters")}</Button>
            </div>
          </CardContent>
        </Card>))}

      {/* Results */}
      <div className="mt-8">
        {loading ? uiText((<div className="flex items-center justify-center py-20 text-muted-foreground/70">
            <Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Searching tutors\u2026")}</div>)) : tutors.length === 0 ? uiText((<div className="flex flex-col items-center py-20 text-muted-foreground/70">
            <SearchX className="h-10 w-10"/>
            <p className="mt-3 font-medium text-muted-foreground">{uiText("No tutors match your filters")}</p>
            <p className="text-sm">{uiText("Try widening the price range or clearing filters.")}</p>
          </div>)) : uiText((<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {uiText(tutors.map((t, index) => <Fragment key={t.id}>
              <TutorCard tutor={t} onOpen={() => go('tutor', { id: t.id })} onBook={() => go('tutor', { id: t.id, book: '1' })}/>
              {index === 2 && <div className="col-span-full"><GroupClassList strip title={uiText("Recommended group classes")}/><PackageStrip /></div>}
            </Fragment>))}
            {tutors.length < 3 && <div className="col-span-full"><GroupClassList strip title={uiText("Recommended group classes")}/><PackageStrip /></div>}
          </div>))}
      </div>

      {/* Pagination */}
      {pages > 1 && uiText((<div className="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => void search(page - 1)}>{uiText("Previous")}</Button>
          <Badge variant="secondary">{uiText("Page ")}{uiText(page)}{uiText(" of ")}{uiText(pages)}</Badge>
          <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => void search(page + 1)}>{uiText("Next")}</Button>
        </div>))}
    </div>);
}
