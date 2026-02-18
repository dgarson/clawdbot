export type InteractivePromptOption = {
  value: string;
  label: string;
  description?: string;
};

export type InteractivePromptQuestion = {
  id: string;
  text: string;
  options: InteractivePromptOption[];
  allowMultiple?: boolean;
  timeoutMs?: number;
};

export type InteractivePromptConfirmation = {
  id: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  style?: "primary" | "danger";
  timeoutMs?: number;
};

export type InteractivePromptResponse = {
  answered: boolean;
  timedOut: boolean;
  selectedValues?: string[];
  confirmed?: boolean;
  respondedBy?: { id: string; name?: string };
  timestamp: number;
};

export type ChannelInteractiveAdapter = {
  askQuestion: (params: {
    to: string;
    question: InteractivePromptQuestion;
    threadId?: string;
    accountId?: string;
  }) => Promise<InteractivePromptResponse>;

  askConfirmation: (params: {
    to: string;
    confirmation: InteractivePromptConfirmation;
    threadId?: string;
    accountId?: string;
  }) => Promise<InteractivePromptResponse>;
};
