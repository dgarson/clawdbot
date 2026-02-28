import { describe, expect, it, vi } from "vitest";
import type { ChannelHistoryFetcher } from "./channel-snapshot-store.js";
import { ChannelSnapshotStore } from "./channel-snapshot-store.js";
import type { HistoryEntry } from "./history.js";
import { MAX_HISTORY_KEYS } from "./history.js";

function makeEntry(overrides: Partial<HistoryEntry> & { sender: string }): HistoryEntry {
  return {
    body: `message from ${overrides.sender}`,
    timestamp: Date.now(),
    messageId: String(Math.random()),
    ...overrides,
  };
}

function makeFetcher(entries: HistoryEntry[]) {
  const fetchRecentMessages = vi.fn().mockResolvedValue(entries);
  return { fetcher: { fetchRecentMessages } as ChannelHistoryFetcher, fetchRecentMessages };
}

describe("ChannelSnapshotStore", () => {
  describe("record + get", () => {
    it("records entries and retrieves them", () => {
      const store = new ChannelSnapshotStore(50);
      const entry = makeEntry({ sender: "alice" });
      store.record("C1", entry);
      expect(store.get("C1")).toEqual([entry]);
    });

    it("returns empty array for unknown channel", () => {
      const store = new ChannelSnapshotStore(50);
      expect(store.get("C_UNKNOWN")).toEqual([]);
    });

    it("respects limit and evicts oldest entries", () => {
      const store = new ChannelSnapshotStore(3);
      for (let i = 0; i < 5; i++) {
        store.record("C1", makeEntry({ sender: `user-${i}`, messageId: `m${i}` }));
      }
      const result = store.get("C1");
      expect(result).toHaveLength(3);
      expect(result[0].sender).toBe("user-2");
      expect(result[2].sender).toBe("user-4");
    });
  });

  describe("seedOnce", () => {
    it("seeds from fetcher on first call", async () => {
      const store = new ChannelSnapshotStore(50);
      const fetched: HistoryEntry[] = [
        makeEntry({ sender: "alice", timestamp: 1000, messageId: "t1" }),
        makeEntry({ sender: "bob", timestamp: 2000, messageId: "t2" }),
      ];
      const { fetcher, fetchRecentMessages } = makeFetcher(fetched);

      await store.seedOnce("C1", fetcher);

      expect(fetchRecentMessages).toHaveBeenCalledWith("C1", 50);
      expect(store.get("C1")).toHaveLength(2);
      expect(store.isSeeded("C1")).toBe(true);
    });

    it("does not re-fetch on second call", async () => {
      const store = new ChannelSnapshotStore(50);
      const { fetcher, fetchRecentMessages } = makeFetcher([
        makeEntry({ sender: "alice", messageId: "t1" }),
      ]);

      await store.seedOnce("C1", fetcher);
      await store.seedOnce("C1", fetcher);

      expect(fetchRecentMessages).toHaveBeenCalledTimes(1);
    });

    it("reconciles fetched entries with existing live entries", async () => {
      const store = new ChannelSnapshotStore(50);
      // Record a live entry first
      const liveEntry = makeEntry({
        sender: "charlie",
        timestamp: 3000,
        messageId: "live-1",
      });
      store.record("C1", liveEntry);

      // Seed with fetched entries — one overlapping messageId, one new
      const fetched: HistoryEntry[] = [
        makeEntry({ sender: "alice", timestamp: 1000, messageId: "fetched-1" }),
        makeEntry({ sender: "charlie-api", timestamp: 3000, messageId: "live-1" }), // duplicate
      ];
      const { fetcher } = makeFetcher(fetched);

      await store.seedOnce("C1", fetcher);

      const result = store.get("C1");
      // Should have fetched-1 + live-1 (deduped, live version kept)
      expect(result).toHaveLength(2);
      // Sorted by timestamp: fetched-1 (1000) then live-1 (3000)
      expect(result[0].messageId).toBe("fetched-1");
      expect(result[1].messageId).toBe("live-1");
      // The live version of the duplicate should be kept (sender "charlie", not "charlie-api")
      expect(result[1].sender).toBe("charlie");
    });

    it("caps merged result at limit", async () => {
      const store = new ChannelSnapshotStore(3);
      // Seed with 5 entries
      const fetched: HistoryEntry[] = Array.from({ length: 5 }, (_, i) =>
        makeEntry({ sender: `user-${i}`, timestamp: i * 1000, messageId: `f${i}` }),
      );
      const { fetcher } = makeFetcher(fetched);

      await store.seedOnce("C1", fetcher);

      expect(store.get("C1")).toHaveLength(3);
      // Should keep the 3 newest (oldest evicted)
      expect(store.get("C1")[0].messageId).toBe("f2");
      expect(store.get("C1")[2].messageId).toBe("f4");
    });

    it("is non-fatal on fetcher error", async () => {
      const store = new ChannelSnapshotStore(50);
      // Record a live entry first
      const liveEntry = makeEntry({ sender: "alice", messageId: "live-1" });
      store.record("C1", liveEntry);

      const fetcher: ChannelHistoryFetcher = {
        fetchRecentMessages: vi.fn().mockRejectedValue(new Error("API timeout")),
      };

      // Should not throw
      await store.seedOnce("C1", fetcher);

      // Live entry should still be accessible
      expect(store.get("C1")).toEqual([liveEntry]);
      // Channel is marked as seeded (won't retry)
      expect(store.isSeeded("C1")).toBe(true);
    });

    it("seeds different channels independently", async () => {
      const store = new ChannelSnapshotStore(50);
      const { fetcher: fetcherA } = makeFetcher([makeEntry({ sender: "a", messageId: "a1" })]);
      const { fetcher: fetcherB } = makeFetcher([makeEntry({ sender: "b", messageId: "b1" })]);

      await store.seedOnce("C1", fetcherA);
      await store.seedOnce("C2", fetcherB);

      expect(store.get("C1")).toHaveLength(1);
      expect(store.get("C1")[0].sender).toBe("a");
      expect(store.get("C2")).toHaveLength(1);
      expect(store.get("C2")[0].sender).toBe("b");
    });
  });

  describe("bounded growth", () => {
    it("never exceeds limit after many records", () => {
      const limit = 10;
      const store = new ChannelSnapshotStore(limit);
      for (let i = 0; i < 200; i++) {
        store.record("C1", makeEntry({ sender: `u${i}`, messageId: `m${i}` }));
      }
      expect(store.get("C1")).toHaveLength(limit);
      // Oldest entries evicted — most recent 10 remain
      expect(store.get("C1")[0].sender).toBe("u190");
      expect(store.get("C1")[9].sender).toBe("u199");
    });

    it("never exceeds limit after seed + many records", async () => {
      const limit = 5;
      const store = new ChannelSnapshotStore(limit);
      const fetched = Array.from({ length: 3 }, (_, i) =>
        makeEntry({ sender: `seed-${i}`, timestamp: i * 1000, messageId: `s${i}` }),
      );
      const { fetcher } = makeFetcher(fetched);
      await store.seedOnce("C1", fetcher);

      // Record 20 more live entries
      for (let i = 0; i < 20; i++) {
        store.record("C1", makeEntry({ sender: `live-${i}`, messageId: `l${i}` }));
      }
      expect(store.get("C1")).toHaveLength(limit);
    });

    it("handles many independent channels without cross-contamination", () => {
      const store = new ChannelSnapshotStore(5);
      for (let ch = 0; ch < 50; ch++) {
        for (let i = 0; i < 10; i++) {
          store.record(`C${ch}`, makeEntry({ sender: `u${i}`, messageId: `c${ch}-m${i}` }));
        }
      }
      // Each channel capped at 5
      for (let ch = 0; ch < 50; ch++) {
        expect(store.get(`C${ch}`)).toHaveLength(5);
      }
    });

    it("evicts oldest channels when exceeding MAX_HISTORY_KEYS", () => {
      const store = new ChannelSnapshotStore(2);
      // Fill beyond MAX_HISTORY_KEYS channels
      const totalChannels = MAX_HISTORY_KEYS + 50;
      for (let i = 0; i < totalChannels; i++) {
        store.record(`C${i}`, makeEntry({ sender: `u${i}`, messageId: `m${i}` }));
      }
      // Oldest channels should be evicted
      expect(store.get("C0")).toEqual([]);
      expect(store.get("C49")).toEqual([]);
      // Recent channels should still be present
      expect(store.get(`C${totalChannels - 1}`)).toHaveLength(1);
      expect(store.get(`C${MAX_HISTORY_KEYS}`)).toHaveLength(1);
    });

    it("seed with oversized fetch is capped", async () => {
      const limit = 3;
      const store = new ChannelSnapshotStore(limit);
      const fetched = Array.from({ length: 100 }, (_, i) =>
        makeEntry({ sender: `u${i}`, timestamp: i, messageId: `f${i}` }),
      );
      const { fetcher } = makeFetcher(fetched);
      await store.seedOnce("C1", fetcher);
      expect(store.get("C1")).toHaveLength(limit);
    });
  });

  describe("isSeeded", () => {
    it("returns false before seeding", () => {
      const store = new ChannelSnapshotStore(50);
      expect(store.isSeeded("C1")).toBe(false);
    });

    it("returns true after seeding (even on error)", async () => {
      const store = new ChannelSnapshotStore(50);
      const fetcher: ChannelHistoryFetcher = {
        fetchRecentMessages: vi.fn().mockRejectedValue(new Error("fail")),
      };
      await store.seedOnce("C1", fetcher);
      expect(store.isSeeded("C1")).toBe(true);
    });
  });
});
