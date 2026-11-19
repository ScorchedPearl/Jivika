import { ChevronDown } from "lucide-react";
import { Container } from "@/app/components/Site/Container";
import { SectionHeading } from "@/app/components/Site/SectionHeading";

const faqs = [
  {
    question: "Can Jivika replace my doctor?",
    answer:
      "No. Jivika gives general guidance to help you understand what's going on. It can be wrong, and it can't examine you. For anything serious or urgent, see a doctor or call emergency services.",
  },
  {
    question: "What kinds of images can I share?",
    answer:
      "Brain MRI scans, chest X-rays and wound photos. Jivika first checks which of these it is looking at, then sends it to the matching model. If the image is something else, it tells you instead of guessing. Clear, well-lit images give the best results.",
  },
  {
    question: "How accurate are the models?",
    answer:
      "They give an informed reading, not a diagnosis. Each result shows how confident the model is and what else it could be, and it is marked as not certain when the model is unsure. Treat results as a reason to ask a doctor, not as a final answer.",
  },
  {
    question: "Do I need an account?",
    answer:
      "You need one to chat, save your history, see hospitals near you and request appointments. You can sign in with email or Google.",
  },
  {
    question: "Can I delete my chats?",
    answer: "Yes. Hover over any chat in the sidebar to rename or delete it.",
  },
];

export function FAQ() {
  return (
    <section className="py-20 sm:py-24">
      <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <SectionHeading eyebrow="Questions" title="Good to know before you start" />
        <div className="divide-y divide-border border-y border-border">
          {faqs.map(({ question, answer }) => (
            <details key={question} className="group py-1">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-serif text-lg text-foreground [&::-webkit-details-marker]:hidden">
                {question}
                <ChevronDown size={18} className="shrink-0 text-muted-foreground transition group-open:rotate-180" />
              </summary>
              <p className="pb-5 leading-relaxed text-muted-foreground">{answer}</p>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
