"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Check, HelpCircle, Send } from "lucide-react";
import type { Question } from "./types";

export interface QuestionCardProps {
  question: Question;
  className?: string;
  onSubmit?: (questionId: string, answer: unknown) => void;
}

export function QuestionCard({ question, className, onSubmit }: QuestionCardProps) {
  const [textAnswer, setTextAnswer] = React.useState("");
  const [selected, setSelected] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (question.status === "answered") {
      setTextAnswer(typeof question.answer === "string" ? question.answer : "");
      setSelected(Array.isArray(question.answer) ? question.answer.map(String) : []);
    } else {
      setTextAnswer("");
      setSelected([]);
    }
  }, [question.answer, question.status]);

  const canSubmit =
    question.status === "pending" &&
    (question.type === "text"
      ? textAnswer.trim().length > 0
      : selected.length > 0);

  const submit = () => {
    if (!canSubmit) {return;}
    onSubmit?.(
      question.id,
      question.type === "text"
        ? textAnswer.trim()
        : question.multiple
          ? selected
          : selected[0]
    );
  };

  const answeredDisplay =
    question.type === "text"
      ? String(question.answer ?? "")
      : Array.isArray(question.answer)
        ? question.answer.join(", ")
        : String(question.answer ?? "");

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-secondary">
          <HelpCircle className="size-4 text-muted-foreground" />
        </div>
        <div className="flex-1 space-y-3">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-foreground/80">
              Input required
            </div>
            <div className="text-sm text-foreground">{question.text}</div>
          </div>

          {question.status === "pending" ? (
            <>
              {question.type === "choice" ? (
                <div className="space-y-2">
                  {(question.options ?? []).map((opt) => {
                    const isSelected = selected.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setSelected((prev) => {
                            if (question.multiple) {
                              return isSelected
                                ? prev.filter((v) => v !== opt.id)
                                : [...prev, opt.id];
                            }
                            return [opt.id];
                          });
                        }}
                        className={cn(
                          "w-full rounded-lg border px-3 py-2 text-left transition-colors",
                          isSelected
                            ? "border-primary/40 bg-primary/10"
                            : "border-border hover:bg-secondary/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{opt.label}</div>
                            {opt.description ? (
                              <div className="text-xs text-muted-foreground">
                                {opt.description}
                              </div>
                            ) : null}
                          </div>
                          {isSelected ? (
                            <div className="flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="size-4" />
                            </div>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : question.multiline ? (
                <Textarea
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder={question.placeholder ?? "Type your answer…"}
                  className="min-h-24"
                />
              ) : (
                <Input
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder={question.placeholder ?? "Type your answer…"}
                />
              )}

              <div className="flex justify-end">
                <Button size="sm" className="gap-2" disabled={!canSubmit} onClick={submit}>
                  <Send className="size-4" />
                  Submit
                </Button>
              </div>
            </>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
              <div className="text-xs text-muted-foreground mb-1">Your answer</div>
              <div className="text-sm">{answeredDisplay}</div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

