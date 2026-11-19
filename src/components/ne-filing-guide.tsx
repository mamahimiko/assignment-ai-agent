import { ExternalLink, ArrowRight, Info } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { neFieldRecords, neGuideCopy, neSources } from '@/lib/ne-guide-content';
import type { Language } from '@/lib/i18n';

export function NeFilingGuide({ lang, year, demo }: { lang: Language; year: number; demo: boolean }) {
  const copy = neGuideCopy[lang];
  return (
    <div className="mt-6 min-w-0">
      <h3 className="text-lg font-bold">{copy.title}</h3>
      <p className="mt-3 text-sm leading-7">{copy.intro}</p>
      <p className="mt-3 text-sm font-semibold">{copy.year}: {year} · {year + 1}</p>
      <p className="mt-2 text-xs text-muted-foreground">{copy.checked}</p>
      <div className="soft-note"><Info size={18} className="shrink-0" /><div>{copy.limitation}{demo && <p className="mt-2 font-semibold">{copy.demo}</p>}</div></div>
      <div className="mt-5 flex flex-wrap gap-3">
        <Button asChild className="h-auto whitespace-normal py-3 text-left"><a href={neSources.login} target="_blank" rel="noreferrer">{copy.open}<ExternalLink /></a></Button>
        <Button variant="outline" asChild className="h-auto whitespace-normal py-3"><Link to="/business">{copy.preparation}<ArrowRight /></Link></Button>
      </div>
      <ol className="mt-6">
        {copy.steps.map((step, index) => (
          <li key={step.title} className="border-b border-border py-6 first:pt-0">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-sage text-sm font-bold">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <h4 className="pt-1 text-base font-semibold">{step.title}</h4>
                <p className="mt-3 break-words border-l-2 border-primary pl-3 text-sm font-semibold leading-7">{step.path.join(' → ')}</p>
                {step.paragraphs.map((paragraph) => <p key={paragraph} className="mt-3 text-sm leading-7 text-muted-foreground">{paragraph}</p>)}
                {index === 4 && <dl className="mt-4 border-t border-border">
                  {neFieldRecords.map((field) => <div key={field.box} className="border-b border-border py-3">
                    <dt className="text-sm font-semibold leading-6">{field.box} · {field.label}</dt>
                    <dd className="mt-1 text-sm leading-7 text-muted-foreground">{field[lang]}</dd>
                  </div>)}
                </dl>}
                <Button asChild variant="link" className="mt-2 h-auto max-w-full whitespace-normal px-0 text-left text-xs"><a href={neSources[step.source]} target="_blank" rel="noreferrer">{copy.source}<ExternalLink /></a></Button>
              </div>
            </div>
          </li>
        ))}
      </ol>
      <h3 className="mt-8 text-lg font-bold">{copy.faq}</h3>
      <Accordion type="multiple" className="mt-2">
        {copy.questions.map(({ question, answer }, index) => (
          <AccordionItem key={question} value={`question-${index}`}>
            <AccordionTrigger className="gap-3 leading-6">{question}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground leading-7">{answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
