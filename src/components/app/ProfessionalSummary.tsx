'use client';
import { uiText } from "@/lib/ui-text";
import { readList, type ExperienceItem, type LanguageItem, type SkillItem } from '@/lib/profile-data';
export default function ProfessionalSummary({ data, review = false }: {
    data: {
        languageItems?: unknown;
        experienceItems?: unknown;
        skillItems?: unknown;
    };
    review?: boolean;
}) {
    const languages = readList<LanguageItem>(data.languageItems), experiences = readList<ExperienceItem>(data.experienceItems), skills = readList<SkillItem>(data.skillItems);
    if (!languages.length && !experiences.length && !skills.length)
        return null;
    return <section className="professional-entry"><h3 className="text-base font-semibold">{review ? uiText("Professional details & evidence") : uiText("Languages, experience & specialities")}</h3>{languages.length > 0 && <div><h4 className="mb-2 text-sm font-medium">{uiText("Languages")}</h4><div className="flex flex-wrap gap-2">{languages.map(item => <span className="rounded-lg border px-3 py-2 text-xs" key={item.name}>{item.name} · {uiText(item.level)}</span>)}</div></div>}{experiences.length > 0 && <div className="space-y-3"><h4 className="text-sm font-medium">{uiText("Teaching experience")}</h4>{uiText(experiences.map((item, index) => <article key={index} className="rounded-xl bg-muted p-4"><strong className="text-sm">{uiText(item.title)}</strong><p className="mt-1 text-sm text-muted-foreground">{uiText([item.organization, item.program, `${item.years} years`].filter(Boolean).join(' · '))}</p>{review && item.certificateId && <a className="mt-2 inline-block text-xs text-primary underline" target="_blank" rel="noreferrer" href={'/api/media/' + item.certificateId}>{uiText("View qualification document")}</a>}</article>))}</div>}{skills.length > 0 && <div><h4 className="mb-2 text-sm font-medium">{uiText("Skills & programmes")}</h4><div className="flex flex-wrap gap-2">{skills.map((item, index) => <span key={index} className="rounded-lg border px-3 py-2 text-xs">{item.name}{review && item.certificateId && <> · <a className="text-primary underline" target="_blank" rel="noreferrer" href={'/api/media/' + item.certificateId}>{uiText("Document")}</a></>}</span>)}</div></div>}</section>;
}
