import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import type { ChannelStatusResponse } from "@/lib/api";
import { ChannelConfig } from "./ChannelConfig";
import { useChannelsStatus } from "@/hooks/queries/useChannels";
import { useConfig } from "@/hooks/queries/useConfig";
import { usePatchConfig, useLogoutChannel } from "@/hooks/mutations/useConfigMutations";
import { startWebLogin, waitWebLogin } from "@/lib/api";

vi.mock("@/hooks/queries/useChannels", () => ({
  useChannelsStatus: vi.fn(),
  channelKeys: { all: ["channels"] },
}));

vi.mock("@/hooks/queries/useConfig", () => ({
  useConfig: vi.fn(),
}));

vi.mock("@/hooks/mutations/useConfigMutations", () => ({
  usePatchConfig: vi.fn(),
  useLogoutChannel: vi.fn(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    startWebLogin: vi.fn(),
    waitWebLogin: vi.fn(),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("./channels", async () => {
  const actual = await vi.importActual<typeof import("./channels")>("./channels");
  return {
    ...actual,
    ChannelCard: ({ channel, onConfigure }: { channel: { id: string; name: string }; onConfigure?: () => void }) => (
      <div>
        <span>{channel.name}</span>
        <button type="button" onClick={onConfigure}>
          Configure {channel.id}
        </button>
      </div>
    ),
    TelegramConfigSheet: () => null,
    DiscordConfigSheet: () => null,
    SlackConfigSheet: () => null,
    SignalConfigSheet: () => null,
    IMessageConfigSheet: () => null,
    GenericChannelConfigDialog: () => null,
    WhatsAppConfigSheet: ({ open, onStartPairing }: { open: boolean; onStartPairing: () => void }) => (
      open ? (
        <button type="button" onClick={onStartPairing}>
          Start WhatsApp Pairing
        </button>
      ) : null
    ),
  };
});

const mockUseChannelsStatus = vi.mocked(useChannelsStatus);
const mockUseConfig = vi.mocked(useConfig);
const mockUsePatchConfig = vi.mocked(usePatchConfig);
const mockUseLogoutChannel = vi.mocked(useLogoutChannel);
const mockStartWebLogin = vi.mocked(startWebLogin);
const mockWaitWebLogin = vi.mocked(waitWebLogin);

const renderWithClient = (ui: React.ReactElement) => {
  const client = new QueryClient();
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

const baseChannelsData: ChannelStatusResponse = {
  ts: Date.now(),
  channelOrder: ["telegram", "whatsapp", "matrix", "customplug"],
  channelLabels: {
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    matrix: "Matrix",
    customplug: "Custom Plug",
  },
  channelDetailLabels: {},
  channelSystemImages: {},
  channelMeta: {
    telegram: { id: "telegram", label: "Telegram" },
    whatsapp: { id: "whatsapp", label: "WhatsApp" },
    matrix: { id: "matrix", label: "Matrix", blurb: "Decentralized protocol" },
    customplug: { id: "customplug", label: "Custom Plug", blurb: "Extension channel" },
  },
  channels: {},
  channelAccounts: {
    telegram: [],
    whatsapp: [],
    matrix: [],
    customplug: [],
  },
  channelDefaultAccountId: {},
};

describe("ChannelConfig", () => {
  beforeEach(() => {
    mockUseChannelsStatus.mockReturnValue({
      data: baseChannelsData,
      isLoading: false,
      isFetching: false,
      error: null,
      refetch: vi.fn(),
    });
    mockUseConfig.mockReturnValue({
      data: { config: { channels: {} }, hash: "hash", exists: true, valid: true },
      isLoading: false,
      error: null,
    });
    mockUsePatchConfig.mockReturnValue({ mutateAsync: vi.fn() } as never);
    mockUseLogoutChannel.mockReturnValue({ mutateAsync: vi.fn() } as never);
  });

  it("renders channel cards based on channelOrder", () => {
    renderWithClient(<ChannelConfig />);

    expect(screen.getByText("Telegram")).toBeTruthy();
    expect(screen.getByText("WhatsApp")).toBeTruthy();
    expect(screen.getByText("Matrix")).toBeTruthy();
    expect(screen.getByText("Custom Plug")).toBeTruthy();
  });

  it("uses the WhatsApp backend pairing flow", async () => {
    mockStartWebLogin.mockResolvedValue({ qrDataUrl: "data:image/png;base64,qr" });
    mockWaitWebLogin.mockResolvedValue({ connected: true });

    renderWithClient(<ChannelConfig />);

    fireEvent.click(screen.getByRole("button", { name: "Configure whatsapp" }));
    fireEvent.click(screen.getByRole("button", { name: "Start WhatsApp Pairing" }));

    await waitFor(() => {
      expect(mockStartWebLogin).toHaveBeenCalledWith({ force: true, timeoutMs: 30000 });
      expect(mockWaitWebLogin).toHaveBeenCalledWith({ timeoutMs: 120000 });
    });
  });
});
