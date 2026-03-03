import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;

interface VerificationCheck {
  id: string;
  label: string;
  passed: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

const BraveAPIKeySetupWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);
  const [copied, setCopied] = useState(false);
  const [verificationChecks, setVerificationChecks] = useState<VerificationCheck[]>([
    { id: "key-set", label: "API Key is set", passed: false },
    { id: "format-valid", label: "Format looks valid", passed: false },
    { id: "connectivity", label: "Connectivity test passes", passed: false },
  ]);

  const REGISTRATION_URL = "https://api.search.brave.com/register";

  const steps: { step: WizardStep; label: string }[] = [
    { step: 1, label: "Why You Need This" },
    { step: 2, label: "Get Your Key" },
    { step: 3, label: "Configure" },
    { step: 4, label: "Verify" },
  ];

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(REGISTRATION_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard access
    }
  };

  const handleTestKey = () => {
    if (!apiKey.trim()) {
      setTestResult("error");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    // Mock API call
    setTimeout(() => {
      setIsTesting(false);
      // Mock: succeed if key is non-empty
      setTestResult(apiKey.trim().length > 0 ? "success" : "error");
    }, 1500);
  };

  const handleVerify = () => {
    // Run mock verification checks
    const newChecks: VerificationCheck[] = [
      { id: "key-set", label: "API Key is set", passed: apiKey.trim().length > 0 },
      { id: "format-valid", label: "Format looks valid", passed: apiKey.trim().length >= 20 },
      { id: "connectivity", label: "Connectivity test passes", passed: testResult === "success" },
    ];
    setVerificationChecks(newChecks);
  };

  const handleNext = () => {
    if (currentStep < 4) {
      setCurrentStep((currentStep + 1) as WizardStep);
    }
    if (currentStep === 3) {
      handleVerify();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as WizardStep);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return true;
      case 2:
        return true;
      case 3:
        return apiKey.trim().length > 0;
      case 4:
        return verificationChecks.every((c) => c.passed);
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 font-mono">
      {/* ── Header ── */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-2xl">🔑</span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Brave Search API Setup
          </h1>
        </div>
        <p className="text-sm text-gray-400 ml-12">
          Complete these steps to enable web search for all 15 discovery agents
        </p>
      </div>

      {/* ── Step Indicator ── */}
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          {steps.map((s, idx) => (
            <React.Fragment key={s.step}>
              {/* Step pill */}
              <button
                onClick={() => setCurrentStep(s.step)}
                disabled={s.step > currentStep && !canProceed()}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  currentStep === s.step
                    ? "bg-blue-600 text-white ring-2 ring-blue-400/30"
                    : s.step < currentStep
                    ? "bg-emerald-900 text-emerald-300 border border-emerald-700"
                    : "bg-gray-800 text-gray-400 border border-gray-700",
                  s.step > currentStep && "cursor-not-allowed opacity-50"
                )}
              >
                {s.step < currentStep ? (
                  <span className="text-emerald-400">✓</span>
                ) : (
                  <span className={cn("w-5 h-5 rounded-full flex items-center justify-center text-xs", currentStep === s.step ? "bg-white/20" : "bg-gray-700")}>
                    {s.step}
                  </span>
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </button>

              {/* Connector line */}
              {idx < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 mx-2",
                    s.step < currentStep ? "bg-emerald-600" : "bg-gray-700"
                  )}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── Step Content Card ── */}
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          {/* Step 1: Why You Need This */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">
                Why You Need This
              </h2>
              <div className="space-y-3 text-sm text-gray-300">
                <p>
                  <strong className="text-white">Brave Search API</strong> is the web
                  intelligence backbone for all 15 discovery agents in the Feb 23
                  discovery run.
                </p>
                <ul className="list-disc list-inside space-y-2 ml-2">
                  <li>
                    Each agent uses Brave Search to discover relevant APIs, documentation,
                    and developer resources
                  </li>
                  <li>
                    Without it, all 15 agents run{" "}
                    <span className="text-red-400 font-medium">completely blind</span> —
                    no web search capability
                  </li>
                  <li>
                    This is a <span className="text-amber-400">P0-CRITICAL</span>{" "}
                    pre-flight item. Wave 1 fires at 10:00 AM MST on Feb 23.
                  </li>
                </ul>
              </div>

              <div className="mt-6 p-4 bg-red-950/50 border border-red-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <span className="text-red-400 text-lg">⛔</span>
                  <div>
                    <div className="font-semibold text-red-300 text-sm">
                      Without this key, discovery fails
                    </div>
                    <div className="text-xs text-red-400/70 mt-1">
                      All web search tool calls will error out. Agents will produce
                      zero findings.
                    </div>
                  </div>
                </div>
              </div>

              <a
                href={REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-colors mt-4"
              >
                Get API Key
                <span className="text-xs opacity-75">→</span>
              </a>
            </div>
          )}

          {/* Step 2: Get Your Key */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">
                Get Your Key
              </h2>

              <p className="text-sm text-gray-300">
                Follow these steps to create a Brave Search API account:
              </p>

              <ol className="list-decimal list-inside space-y-3 ml-2 text-sm text-gray-300">
                <li>
                  Visit{" "}
                  <a
                    href={REGISTRATION_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:underline"
                  >
                    {REGISTRATION_URL}
                  </a>
                </li>
                <li>Create an account or sign in with existing credentials</li>
                <li>Select "API" as the product type</li>
                <li>
                  Choose the free tier (2,000 queries/month) or enter payment details
                  for higher limits
                </li>
                <li>Copy your API key from the dashboard</li>
              </ol>

              <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400 truncate mr-4 font-mono">
                    {REGISTRATION_URL}
                  </div>
                  <button
                    onClick={handleCopyUrl}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex-shrink-0",
                      copied
                        ? "bg-emerald-600 text-white"
                        : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                    )}
                  >
                    {copied ? "Copied!" : "Copy URL"}
                  </button>
                </div>
              </div>

              <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-amber-400">💡</span>
                  <p className="text-xs text-amber-300">
                    Your API key will look like: <code className="bg-gray-800 px-1 rounded">BSA-xxxxxxxxxxxxxxxxxxxxxxxx</code>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Configure */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">
                Configure Your Key
              </h2>

              <div className="space-y-3">
                <label className="block text-sm text-gray-300">
                  Brave Search API Key
                </label>

                <div className="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setTestResult(null);
                    }}
                    placeholder="Enter your Brave Search API key"
                    className="w-full px-4 py-3 bg-gray-950 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-200 text-xs"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span className="px-2 py-0.5 bg-gray-800 rounded font-mono">
                    BRAVE_API_KEY
                  </span>
                  <span>Environment variable name</span>
                </div>
              </div>

              {apiKey.trim() && (
                <div className="text-xs text-gray-400">
                  Key length: {apiKey.length} characters
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={handleTestKey}
                  disabled={!apiKey.trim() || isTesting}
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
                    !apiKey.trim() || isTesting
                      ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                      : testResult === "success"
                      ? "bg-emerald-600 text-white"
                      : testResult === "error"
                      ? "bg-red-600 text-white"
                      : "bg-gray-700 hover:bg-gray-600 text-gray-200"
                  )}
                >
                  {isTesting ? (
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Testing...
                    </span>
                  ) : testResult === "success" ? (
                    <span className="flex items-center gap-2">
                      ✓ Key Valid
                    </span>
                  ) : testResult === "error" ? (
                    <span className="flex items-center gap-2">
                      ✗ Invalid Key
                    </span>
                  ) : (
                    "Test Key"
                  )}
                </button>
              </div>

              {testResult === "error" && (
                <div className="mt-2 p-3 bg-red-950/50 border border-red-800 rounded-lg">
                  <p className="text-xs text-red-300">
                    The API key appears invalid. Please check and try again.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 4: Verify */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-white mb-4">
                Pre-Flight Verification
              </h2>

              <div className="space-y-3">
                {verificationChecks.map((check) => (
                  <div
                    key={check.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      check.passed
                        ? "bg-emerald-950/30 border-emerald-800"
                        : "bg-gray-800/50 border-gray-700"
                    )}
                  >
                    <span
                      className={cn(
                        "w-5 h-5 rounded-full flex items-center justify-center text-xs",
                        check.passed
                          ? "bg-emerald-600 text-white"
                          : "bg-gray-600 text-gray-300"
                      )}
                    >
                      {check.passed ? "✓" : "○"}
                    </span>
                    <span
                      className={cn(
                        "text-sm",
                        check.passed ? "text-emerald-300" : "text-gray-400"
                      )}
                    >
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>

              {verificationChecks.every((c) => c.passed) ? (
                <div className="mt-6 p-4 bg-emerald-950/50 border border-emerald-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400 text-xl">🎉</span>
                    <div>
                      <div className="font-semibold text-emerald-300 text-sm">
                        All checks passed!
                      </div>
                      <div className="text-xs text-emerald-400/70 mt-1">
                        Your Brave Search API is configured and ready for the
                        discovery run.
                      </div>
                    </div>
                  </div>

                  <button className="mt-4 w-full px-4 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg transition-colors">
                    Launch Discovery Run
                  </button>
                </div>
              ) : (
                <div className="mt-6 p-4 bg-amber-950/50 border border-amber-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <span className="text-amber-400 text-lg">⚠️</span>
                    <div>
                      <div className="font-semibold text-amber-300 text-sm">
                        Some checks failed
                      </div>
                      <div className="text-xs text-amber-400/70 mt-1">
                        Please go back and ensure your API key is valid and working.
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Navigation Buttons ── */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-lg transition-colors",
              currentStep === 1
                ? "text-gray-600 cursor-not-allowed"
                : "text-gray-300 hover:text-white hover:bg-gray-800"
            )}
          >
            ← Back
          </button>

          {currentStep < 4 && (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className={cn(
                "px-6 py-2 text-sm font-medium rounded-lg transition-colors",
                !canProceed()
                  ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              )}
            >
              Continue →
            </button>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="max-w-2xl mx-auto mt-8 pt-4 border-t border-gray-800 text-xs text-gray-600 flex justify-between">
        <span>BraveAPIKeySetupWizard v1.0 — OpenClaw Horizon UI</span>
        <span>Step {currentStep} of 4</span>
      </div>
    </div>
  );
};

export default BraveAPIKeySetupWizard;
