import { LandingSection } from "./LandingSection";
import { LandingSectionHeader } from "./LandingSectionHeader";
import { LandingCard } from "./LandingCard";
import { User, FileText, Target, Compass } from "lucide-react";

const PREFERENCES = [
  { icon: User, label: "Writing style", value: "Concise" },
  { icon: FileText, label: "Preferred format", value: "Bullet summary" },
  { icon: Target, label: "Priorities", value: "Speed, accuracy" },
  { icon: Compass, label: "Current focus", value: "Product launch" },
] as const;

/** Section showing adaptive personalization without creepy framing. */
export function PersonalizationSection() {
  return (
    <LandingSection belowFold>
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-16 items-center">
        <div data-reveal="">
          <LandingSectionHeader
            headline="It learns your preferences—without asking you to repeat yourself"
            subhead="As you work, Clawdbrain remembers what good looks like for you: tone, structure, priorities, and the way you like decisions summarized."
            align="left"
          />
          <a
            href="/you"
            className="text-sm text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
          >
            See what is remembered (and edit it)
          </a>
        </div>

        <div data-reveal="">
          <LandingCard variant="elevated" className="max-w-sm mx-auto lg:mx-0">
            <div className="flex items-center gap-3 mb-5">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">
                  Your profile
                </div>
                <div className="text-xs text-muted-foreground">
                  Learned from your usage
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {PREFERENCES.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2"
                >
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </LandingCard>
        </div>
      </div>
    </LandingSection>
  );
}
