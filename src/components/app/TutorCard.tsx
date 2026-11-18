'use client';
import { uiText } from "@/lib/ui-text";
import { useApp } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, BadgeCheck, Globe2, BookOpen, Heart } from 'lucide-react';
import { useState } from 'react';
export function Stars({ rating, size = 14 }: {
    rating: number;
    size?: number;
}) {
    return (<span className="inline-flex items-center gap-0.5" aria-label={uiText("Rated {{value1}} out of 5", { value1: rating })}>
      {uiText([1, 2, 3, 4, 5].map((i) => (<Star key={i} style={{ width: size, height: size }} className={i <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'fill-stone-200 text-stone-200'}/>)))}
    </span>);
}
export function TutorAvatar({ name, url, className }: {
    name?: string | null;
    url?: string | null;
    className?: string;
}) {
    const safeName = name ?? '?';
    return (<Avatar className={className}>
      {url ? <AvatarImage src={url} alt={safeName}/> : uiText(null)}
      <AvatarFallback className="bg-teal-100 text-teal-800 font-semibold">
        {uiText(safeName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase())}
      </AvatarFallback>
    </Avatar>);
}
export default function TutorCard({ tutor, onOpen, onBook }: {
    tutor: import('@/lib/store').TutorCard;
    onOpen: () => void;
    onBook: () => void;
}) {
    const { fmt } = useApp();
    const [fav, setFav] = useState(false);
    const toggleFav = () => {
        setFav((f) => !f);
        try {
            const raw = window.localStorage.getItem('ts_favorites');
            const list: string[] = raw ? JSON.parse(raw) : [];
            const next = list.includes(tutor.id) ? list.filter((x) => x !== tutor.id) : [...list, tutor.id];
            window.localStorage.setItem('ts_favorites', JSON.stringify(next));
        }
        catch { /* private mode */ }
    };
    return (<div className="group rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-teal-300">
      <div className="flex items-start gap-3">
        <TutorAvatar name={tutor.name} url={tutor.avatarUrl} className="h-14 w-14 border border-border"/>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate font-semibold text-foreground">{tutor.name}</h3>
            {tutor.identityVerified && <BadgeCheck className="h-4 w-4 shrink-0 text-teal-600" aria-label={uiText("Identity verified")}/>}
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{tutor.headline}</p>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            {tutor.country && <span className="inline-flex items-center gap-1"><Globe2 className="h-3 w-3"/>{tutor.country}</span>}
          </div>
        </div>
        <button onClick={toggleFav} aria-label={fav ? uiText("Remove from favorites") : uiText("Add to favorites")} className="rounded-full p-1.5 hover:bg-muted">
          <Heart className={`h-4 w-4 ${fav ? 'fill-red-400 text-red-400' : 'text-stone-300'}`}/>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {tutor.subjects.slice(0, 3).map((s) => (<Badge key={s.slug} variant="secondary" className="bg-muted text-muted-foreground border-0 text-[11px]">{s.name}</Badge>))}
        <Badge variant="secondary" className="bg-teal-50 text-teal-700 border-0 text-[11px]">{uiText(tutor.languages.split(',')[0])}</Badge>
      </div>

      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{tutor.about ?? tutor.headline}</p>

      <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
        {tutor.rating != null ? uiText((<span className="flex items-center gap-1">
            <Stars rating={tutor.rating}/> <strong className="text-foreground/90">{tutor.rating}</strong> ({tutor.reviewCount})
          </span>)) : uiText((<span className="text-muted-foreground/70">{uiText("New tutor")}</span>))}
        <span className="inline-flex items-center gap-1"><BookOpen className="h-3.5 w-3.5"/>{tutor.lessonsCompleted}{uiText(" lessons")}</span>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3">
        <div>
          <div className="text-lg font-bold text-foreground">{uiText(fmt(tutor.hourlyRateCents))}<span className="text-xs font-normal text-muted-foreground/70">{uiText(" /hour")}</span></div>
          <div className="text-xs text-primary font-medium">{uiText("Free first trial")}</div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onOpen}>{uiText("View profile")}</Button>
          <Button size="sm" onClick={onBook} className="bg-teal-600 hover:bg-teal-700">{uiText("Book trial")}</Button>
        </div>
      </div>
    </div>);
}
