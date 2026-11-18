'use client';
import { uiText } from "@/lib/ui-text";
import { readDesignedPage, pageDocument } from '@/lib/cms-content';
import { useEffect, useState } from 'react';
import { useApp, api } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { LifeBuoy, Loader2, MessageSquare } from 'lucide-react';
export default function CmsView({ slug, mode }: {
    slug?: string;
    mode?: 'help';
}) {
    const { go } = useApp();
    const [page, setPage] = useState<{
        title: string;
        content: string;
        updatedAt: string;
    } | null>(null);
    const [faqs, setFaqs] = useState<{
        id: string;
        question: string;
        answer: string;
    }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    useEffect(() => {
        const load = async () => {
            setLoading(true);
            setError(false);
            try {
                if (mode === 'help') {
                    const pub = await api<{
                        faqs: {
                            id: string;
                            question: string;
                            answer: string;
                        }[];
                    }>('/api/public');
                    setFaqs(pub.faqs);
                }
                else if (slug) {
                    const data = await api<{
                        page: {
                            title: string;
                            content: string;
                            updatedAt: string;
                        };
                    }>(`/api/cms/${slug}`);
                    setPage(data.page);
                }
            }
            catch {
                setError(true);
            }
            finally {
                setLoading(false);
            }
        };
        void load();
    }, [slug, mode]);
    // Minimal markdown rendering (headings, bold, paragraphs)
    const renderContent = (content: string) => {
        return content.split('\n').map((line, i) => {
            if (line.startsWith('## '))
                return <h2 key={i} className="mt-6 text-xl font-bold text-foreground">{uiText(line.slice(3))}</h2>;
            if (line.startsWith('# '))
                return <h1 key={i} className="mt-6 text-2xl font-bold text-foreground">{uiText(line.slice(2))}</h1>;
            if (line.trim() === '')
                return <div key={i} className="h-3"/>;
            const bold = line.split(/\*\*(.+?)\*\*/g).map((part, j) => j % 2 === 1 ? <strong key={j}>{uiText(part)}</strong> : part);
            return <p key={i} className="mt-2 leading-relaxed text-muted-foreground">{uiText(bold)}</p>;
        });
    };
    if (loading) {
        return <div className="flex items-center justify-center py-32 text-muted-foreground/70"><Loader2 className="mr-2 h-5 w-5 animate-spin"/>{uiText(" Loading\u2026")}</div>;
    }
    if (mode === 'help') {
        return (<div className="mx-auto max-w-3xl px-4 py-12">
        <div className="text-center">
          <LifeBuoy className="mx-auto h-10 w-10 text-teal-600"/>
          <h1 className="mt-3 text-3xl font-bold text-foreground">{uiText("Help Center")}</h1>
          <p className="mt-2 text-muted-foreground">{uiText("Answers to common questions about lessons, payments and safety.")}</p>
        </div>
        <Accordion type="single" collapsible className="mt-8">
          {uiText(faqs.map((f) => (<AccordionItem key={f.id} value={f.id}>
              <AccordionTrigger className="text-start">{uiText(f.question)}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground">{uiText(f.answer)}</AccordionContent>
            </AccordionItem>)))}
        </Accordion>
        <Card className="mt-8 rounded-2xl border-border">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <MessageSquare className="h-6 w-6 text-teal-600"/>
            <p className="font-semibold text-foreground">{uiText("Still need help?")}</p>
            <p className="text-sm text-muted-foreground">{uiText("Open a support ticket and our team will get back to you within 24 hours.")}</p>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={() => go('support')}>{uiText("Contact support")}</Button>
          </CardContent>
        </Card>
      </div>);
    }
    if (error || !page) {
        return (<div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="font-semibold text-foreground/90">{uiText("Page not found")}</p>
        <Button className="mt-4 bg-teal-600 hover:bg-teal-700" onClick={() => go('landing')}>{uiText("Back home")}</Button>
      </div>);
    }
    return (<div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-foreground">{page.title}</h1>
      <p className="mt-1 text-xs text-muted-foreground/70">{uiText("Last updated ")}{uiText(new Date(page.updatedAt).toLocaleDateString())}</p>
      <div className="mt-6">{readDesignedPage(page.content) ? <iframe title={page.title} sandbox="" className="w-full rounded-2xl border bg-white" style={{ height: '75vh', minHeight: 500 }} srcDoc={pageDocument(readDesignedPage(page.content)!.html, readDesignedPage(page.content)!.css)}/> : renderContent(page.content)}</div>
    </div>);
}
