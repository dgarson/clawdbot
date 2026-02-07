import { useState } from "react";
import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: string;
  learnMoreHref?: string;
}

const FAQS: FAQItem[] = [
  {
    question: "What can it do automatically vs what needs approval?",
    answer:
      "Clawdbrain can run safe, reversible work automatically — like drafts, summaries, and research. Anything sensitive (sending messages, making purchases, deleting data, or acting in external systems) is gated behind approvals based on your settings.",
    learnMoreHref: "/settings",
  },
  {
    question: "How do approvals work?",
    answer:
      "When an action needs approval, Clawdbrain prepares the work and then pauses. You will see exactly what it wants to do and why, and you can approve, edit, or reject it.",
  },
  {
    question: "What data does it store?",
    answer:
      "Only what you choose to keep. You can run in minimal-memory mode, or allow preferences and summaries to reduce repetition. You can review and delete saved items at any time.",
  },
  {
    question: "Can I delete my data?",
    answer:
      "Yes. You can delete individual memories, preferences, and activity history from the console. Deletion is permanent and takes effect immediately.",
  },
  {
    question: "What happens if I disconnect the Gateway?",
    answer:
      "If the Gateway is disconnected, Clawdbrain cannot continue tasks that require it. The console shows a clear disconnected state and preserves your in-progress work so you can resume when reconnected.",
  },
  {
    question: "How do I pause everything?",
    answer:
      "Use the global Pause automation control in the console header or settings. This immediately stops all agents and workflows. You can resume at any time.",
  },
  {
    question: "Is there an audit trail?",
    answer:
      "Yes. Every action is recorded with what happened, when, why it was triggered, and what it affected. You can browse the full activity history in the console.",
  },
  {
    question: "Can I customize agents and tools?",
    answer:
      "Yes. You can create custom agents with specific tools, permissions, and memory scopes. You can also configure which integrations each agent can access.",
    learnMoreHref: "/agents",
  },
];

/** FAQ accordion section — accessible, keyboard navigable. */
export function FAQSection() {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  return (
    <LandingSection id="faq" alternate belowFold>
      <LandingSectionHeader
        headline="Frequently asked questions"
        subhead="Quick answers to the questions that matter most."
      />

      <div className="mx-auto max-w-3xl divide-y divide-border" data-reveal="">
        {FAQS.map((faq, i) => {
          const isOpen = openIdx === i;
          return (
            <div key={faq.question}>
              <button
                className="flex w-full items-center justify-between gap-4 py-5 text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                onClick={() => setOpenIdx(isOpen ? null : i)}
                aria-expanded={isOpen}
                aria-controls={`faq-answer-${i}`}
                id={`faq-question-${i}`}
              >
                <span className="text-sm sm:text-base font-medium text-foreground">
                  {faq.question}
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                    isOpen && "rotate-180"
                  )}
                />
              </button>

              <div
                id={`faq-answer-${i}`}
                role="region"
                aria-labelledby={`faq-question-${i}`}
                aria-hidden={!isOpen}
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-300 ease-out",
                  isOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div className="pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {faq.answer}
                  </p>
                  {faq.learnMoreHref && (
                    <a
                      href={faq.learnMoreHref}
                      className="mt-2 inline-block text-xs text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
                    >
                      Learn more
                    </a>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </LandingSection>
  );
}
