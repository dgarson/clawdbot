import { describe, expect, it } from "vitest";
import "../../styles.css";
import { mountApp, registerAppMountHooks } from "../test-helpers/app-mount.ts";

registerAppMountHooks();

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

describe("telemetry dashboard", () => {
  it("telemetry tab appears in navigation", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;

    expect(app.tab).toBe("telemetry");
    expect(window.location.pathname).toBe("/telemetry");

    // The nav sidebar should contain a link to /telemetry
    const navLink = app.querySelector<HTMLAnchorElement>('a.nav-item[href="/telemetry"]');
    expect(navLink).not.toBeNull();
  });

  it("dashboard renders with KPI strip", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const dashboard = app.querySelector(".telem-dashboard");
    expect(dashboard).not.toBeNull();

    const kpiStrip = app.querySelector(".telem-kpi-strip");
    expect(kpiStrip).not.toBeNull();
  });

  it("dashboard renders cost breakdown card", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const costCard = app.querySelector(".telem-cost-card");
    expect(costCard).not.toBeNull();
  });

  it("dashboard renders sessions table", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const sessionsCard = app.querySelector(".telem-sessions-card");
    expect(sessionsCard).not.toBeNull();
  });

  it("dashboard renders leaderboard cards", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const leaderboardGrid = app.querySelector(".telem-leaderboard-grid");
    expect(leaderboardGrid).not.toBeNull();
  });

  it("dashboard renders header with refresh button", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const header = app.querySelector(".telem-header");
    expect(header).not.toBeNull();

    const refreshBtn = header?.querySelector("button.btn");
    expect(refreshBtn).not.toBeNull();
  });

  it("clicking a session navigates to detail view", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;

    // Simulate having sessions data
    app.telemetrySessions = [
      {
        key: "test-session-1",
        agentId: "default",
        runCount: 3,
        lastActivity: new Date().toISOString(),
        totalTokens: 1500,
        totalCost: 0.05,
        errorCount: 0,
      },
    ];
    await app.updateComplete;
    await nextFrame();

    const sessionRow = app.querySelector(".telem-session-row");
    expect(sessionRow).not.toBeNull();

    // Click the session row
    sessionRow?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await app.updateComplete;
    await nextFrame();

    // Should switch to session detail view
    expect(app.telemetryView).toBe("session-detail");
    expect(app.telemetrySelectedSessionKey).toBe("test-session-1");
  });

  it("session detail view shows back button and playback controls", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;

    // Set up session detail view state
    app.telemetryView = "session-detail";
    app.telemetrySelectedSessionKey = "test-session-1";
    app.telemetrySessions = [
      {
        key: "test-session-1",
        agentId: "default",
        runCount: 2,
        totalTokens: 1000,
        totalCost: 0.03,
        errorCount: 0,
      },
    ];
    app.telemetryTimeline = [
      {
        id: "1",
        timestamp: new Date().toISOString(),
        kind: "run.start",
        data: { runId: "abc" },
      },
      {
        id: "2",
        timestamp: new Date(Date.now() + 1000).toISOString(),
        kind: "llm.call",
        data: { model: "gpt-4" },
      },
    ];
    await app.updateComplete;
    await nextFrame();

    // Back button
    const backBtn = app.querySelector(".telem-back-btn");
    expect(backBtn).not.toBeNull();

    // Playback controls
    const playback = app.querySelector(".telem-playback");
    expect(playback).not.toBeNull();

    const playBtn = app.querySelector(".telem-play-btn");
    expect(playBtn).not.toBeNull();

    // Speed buttons
    const speedBtns = app.querySelectorAll(".telem-speed-btn");
    expect(speedBtns.length).toBe(3);

    // Progress slider
    const slider = app.querySelector(".telem-progress-slider");
    expect(slider).not.toBeNull();
  });

  it("back button returns to dashboard view", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;

    // Set up session detail
    app.telemetryView = "session-detail";
    app.telemetrySelectedSessionKey = "test-session-1";
    app.telemetrySessions = [];
    app.telemetryTimeline = [];
    await app.updateComplete;
    await nextFrame();

    const backBtn = app.querySelector(".telem-back-btn");
    expect(backBtn).not.toBeNull();

    // Click back
    backBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await app.updateComplete;

    expect(app.telemetryView).toBe("dashboard");
    expect(app.telemetrySelectedSessionKey).toBeNull();
  });

  it("timeline shows event cards with kind-specific styling", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;

    app.telemetryView = "session-detail";
    app.telemetrySelectedSessionKey = "test-session-1";
    app.telemetrySessions = [];
    app.telemetryReplay = { playing: false, speed: 1, currentIndex: 0 };
    app.telemetryTimeline = [
      { id: "1", timestamp: new Date().toISOString(), kind: "run.start" },
      { id: "2", timestamp: new Date().toISOString(), kind: "tool.start" },
      { id: "3", timestamp: new Date().toISOString(), kind: "llm.call" },
      { id: "4", timestamp: new Date().toISOString(), kind: "error" },
    ];
    await app.updateComplete;
    await nextFrame();

    const events = app.querySelectorAll(".telem-event");
    expect(events.length).toBe(4);

    // Check kind-specific classes
    expect(events[0].classList.contains("telem-event--run")).toBe(true);
    expect(events[1].classList.contains("telem-event--tool")).toBe(true);
    expect(events[2].classList.contains("telem-event--llm")).toBe(true);
    expect(events[3].classList.contains("telem-event--error")).toBe(true);
  });

  it("cost breakdown group-by toggles are present", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const toggleBtns = app.querySelectorAll(".telem-toggle-btn");
    expect(toggleBtns.length).toBeGreaterThanOrEqual(4);

    // The first should be active by default (model)
    const activeBtn = app.querySelector(".telem-toggle-btn--active");
    expect(activeBtn).not.toBeNull();
    expect(activeBtn?.textContent?.trim()).toBe("model");
  });

  it("monitor toggle checkbox is present", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    const toggle = app.querySelector(".telem-monitor-toggle input[type='checkbox']");
    expect(toggle).not.toBeNull();
  });

  it("page title/subtitle are suppressed in content header (own header used)", async () => {
    const app = mountApp("/telemetry");
    await app.updateComplete;
    await nextFrame();

    // The content-header should not render a page-title (telemetry renders its own)
    const contentHeader = app.querySelector(".content-header");
    expect(contentHeader).not.toBeNull();

    const genericTitle = contentHeader?.querySelector(".page-title");
    expect(genericTitle).toBeNull();
  });
});
