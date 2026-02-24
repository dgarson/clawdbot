import React, { useState } from "react";
import { cn } from "../lib/utils";

// Types
type ContentType = "blog" | "social" | "email" | "video" | "ad";
type ContentStatus = "draft" | "scheduled" | "published";
type ChannelStatus = "connected" | "disconnected" | "pending";

interface ContentItem {
  id: string;
  title: string;
  type: ContentType;
  channel: string;
  status: ContentStatus;
  scheduledDate: Date;
  author: string;
}

interface Channel {
  id: string;
  name: string;
  handle: string;
  followers: number;
  postsThisMonth: number;
  engagementRate: number;
  status: ChannelStatus;
}

// Sample Data
const sampleContent: ContentItem[] = [
  { id: "1", title: "Q1 Product Launch Announcement", type: "blog", channel: "Blog", status: "published", scheduledDate: new Date(2026, 1, 1), author: "Sarah Chen" },
  { id: "2", title: "Behind the Scenes: Engineering", type: "social", channel: "Twitter/X", status: "published", scheduledDate: new Date(2026, 1, 2), author: "Mike Johnson" },
  { id: "3", title: "Weekly Newsletter #48", type: "email", channel: "Email Newsletter", status: "published", scheduledDate: new Date(2026, 1, 3), author: "Sarah Chen" },
  { id: "4", title: "Feature Demo Video", type: "video", channel: "YouTube", status: "scheduled", scheduledDate: new Date(2026, 1, 5), author: "Alex Rivera" },
  { id: "5", title: "Customer Success Story", type: "blog", channel: "Blog", status: "draft", scheduledDate: new Date(2026, 1, 7), author: "Emma Wilson" },
  { id: "6", title: "Product Update Thread", type: "social", channel: "Twitter/X", status: "scheduled", scheduledDate: new Date(2026, 1, 8), author: "Mike Johnson" },
  { id: "7", title: "Valentine's Day Campaign", type: "ad", channel: "Instagram", status: "scheduled", scheduledDate: new Date(2026, 1, 14), author: "Lisa Park" },
  { id: "8", title: "How-To Tutorial Series", type: "video", channel: "YouTube", status: "draft", scheduledDate: new Date(2026, 1, 10), author: "Alex Rivera" },
  { id: "9", title: "Industry Trends Analysis", type: "blog", channel: "Blog", status: "scheduled", scheduledDate: new Date(2026, 1, 12), author: "Sarah Chen" },
  { id: "10", title: "LinkedIn Article: Future of Work", type: "social", channel: "LinkedIn", status: "draft", scheduledDate: new Date(2026, 1, 15), author: "Mike Johnson" },
  { id: "11", title: "Monthly Newsletter #49", type: "email", channel: "Email Newsletter", status: "scheduled", scheduledDate: new Date(2026, 1, 17), author: "Emma Wilson" },
  { id: "12", title: "Product Teaser Clip", type: "video", channel: "Instagram", status: "scheduled", scheduledDate: new Date(2026, 1, 18), author: "Alex Rivera" },
  { id: "13", title: "Retargeting Campaign", type: "ad", channel: "Twitter/X", status: "draft", scheduledDate: new Date(2026, 1, 20), author: "Lisa Park" },
  { id: "14", title: "Case Study: Enterprise Client", type: "blog", channel: "Blog", status: "scheduled", scheduledDate: new Date(2026, 1, 22), author: "Sarah Chen" },
  { id: "15", title: "Team Spotlight Post", type: "social", channel: "LinkedIn", status: "published", scheduledDate: new Date(2026, 1, 23), author: "Mike Johnson" },
  { id: "16", title: "Q1 Results Infographic", type: "social", channel: "Instagram", status: "scheduled", scheduledDate: new Date(2026, 1, 25), author: "Lisa Park" },
  { id: "17", title: "Webinar Announcement", type: "email", channel: "Email Newsletter", status: "draft", scheduledDate: new Date(2026, 1, 27), author: "Emma Wilson" },
  { id: "18", title: "Feature Deep Dive", type: "video", channel: "YouTube", status: "scheduled", scheduledDate: new Date(2026, 2, 1), author: "Alex Rivera" },
  { id: "19", title: "Community Highlights", type: "blog", channel: "Blog", status: "scheduled", scheduledDate: new Date(2026, 2, 3), author: "Sarah Chen" },
  { id: "20", title: "March Campaign Kickoff", type: "ad", channel: "LinkedIn", status: "draft", scheduledDate: new Date(2026, 2, 5), author: "Lisa Park" },
];

const sampleChannels: Channel[] = [
  { id: "1", name: "Twitter/X", handle: "@horizonapp", followers: 45200, postsThisMonth: 28, engagementRate: 4.2, status: "connected" },
  { id: "2", name: "LinkedIn", handle: "Horizon Inc", followers: 12800, postsThisMonth: 12, engagementRate: 6.8, status: "connected" },
  { id: "3", name: "Instagram", handle: "@horizonapp", followers: 31500, postsThisMonth: 18, engagementRate: 5.1, status: "connected" },
  { id: "4", name: "YouTube", handle: "Horizon App", followers: 8900, postsThisMonth: 6, engagementRate: 8.3, status: "connected" },
  { id: "5", name: "Blog", handle: "blog.horizon.io", followers: 22000, postsThisMonth: 8, engagementRate: 3.2, status: "connected" },
  { id: "6", name: "Email Newsletter", handle: "subscribers", followers: 18500, postsThisMonth: 4, engagementRate: 22.4, status: "connected" },
  { id: "7", name: "TikTok", handle: "@horizonapp", followers: 0, postsThisMonth: 0, engagementRate: 0, status: "disconnected" },
  { id: "8", name: "Facebook", handle: "HorizonApp", followers: 0, postsThisMonth: 0, engagementRate: 0, status: "pending" },
];

// Helper functions
const getTypeColor = (type: ContentType): string => {
  switch (type) {
    case "blog": return "bg-indigo-600 text-[var(--color-text-primary)]";
    case "social": return "bg-emerald-500 text-[var(--color-text-primary)]";
    case "email": return "bg-amber-500 text-[var(--color-text-primary)]";
    case "video": return "bg-blue-500 text-[var(--color-text-primary)]";
    case "ad": return "bg-rose-500 text-[var(--color-text-primary)]";
    default: return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]";
  }
};

const getStatusColor = (status: ContentStatus): string => {
  switch (status) {
    case "draft": return "text-[var(--color-text-secondary)]";
    case "scheduled": return "text-amber-400";
    case "published": return "text-emerald-400";
    default: return "text-[var(--color-text-secondary)]";
  }
};

const getStatusIcon = (status: ContentStatus): string => {
  switch (status) {
    case "draft": return "○";
    case "scheduled": return "◐";
    case "published": return "●";
    default: return "○";
  }
};

const getChannelStatusColor = (status: ChannelStatus): string => {
  switch (status) {
    case "connected": return "text-emerald-400";
    case "disconnected": return "text-rose-400";
    case "pending": return "text-amber-400";
    default: return "text-[var(--color-text-secondary)]";
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) {return (num / 1000000).toFixed(1) + "M";}
  if (num >= 1000) {return (num / 1000).toFixed(1) + "K";}
  return num.toString();
};

const formatDate = (date: Date): string => {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const formatTime = (date: Date): string => {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const getMonthDays = (year: number, month: number): (Date | null)[] => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  const days: (Date | null)[] = [];
  
  // Add empty cells for days before the first of the month
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(null);
  }
  
  // Add all days of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  
  return days;
};

const isSameDay = (date1: Date, date2: Date | null): boolean => {
  if (!date2) {return false;}
  return date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate();
};

const isToday = (date: Date | null): boolean => {
  if (!date) {return false;}
  const today = new Date();
  return isSameDay(date, today);
};

// Tab Components
interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, children }) => (
  <button
    onClick={onClick}
    className={cn(
      "px-4 py-2 text-sm font-medium transition-all duration-150 border-b-2",
      active
        ? "text-indigo-400 border-indigo-500"
        : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)]"
    )}
  >
    {children}
  </button>
);

// Calendar Tab
interface CalendarTabProps {
  content: ContentItem[];
  selectedDate: Date | null;
  onSelectDate: (date: Date) => void;
}

const CalendarTab: React.FC<CalendarTabProps> = ({ content, selectedDate, onSelectDate }) => {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 1)); // February 2026
  
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const days = getMonthDays(year, month);
  
  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  const getContentForDate = (date: Date): ContentItem[] => {
    return content.filter(item => isSameDay(item.scheduledDate, date));
  };
  
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };
  
  const selectedContent = selectedDate ? getContentForDate(selectedDate) : [];
  
  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handlePrevMonth}
            className="px-3 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] rounded transition-colors"
          >
            ← Prev
          </button>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{monthName}</h2>
          <button
            onClick={handleNextMonth}
            className="px-3 py-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] rounded transition-colors"
          >
            Next →
          </button>
        </div>
        
        {/* Calendar Grid */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
          {/* Week Days Header */}
          <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-2 text-center text-xs font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-1)]"
              >
                {day}
              </div>
            ))}
          </div>
          
          {/* Calendar Days */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const dayContent = day ? getContentForDate(day) : [];
              const isSelected = day && selectedDate && isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);
              
              return (
                <div
                  key={index}
                  onClick={() => day && onSelectDate(day)}
                  className={cn(
                    "min-h-[80px] p-1 border-b border-r border-[var(--color-border)] cursor-pointer transition-colors",
                    day ? "hover:bg-[var(--color-surface-2)]/50" : "bg-[var(--color-surface-0)]/30",
                    isSelected && "bg-[var(--color-surface-2)]",
                    isTodayDate && !isSelected && "bg-[var(--color-surface-2)]/30"
                  )}
                >
                  {day && (
                    <>
                      <div className={cn(
                        "text-xs font-medium mb-1",
                        isTodayDate ? "text-indigo-400" : "text-[var(--color-text-secondary)]"
                      )}>
                        {day.getDate()}
                      </div>
                      <div className="space-y-0.5">
                        {dayContent.slice(0, 3).map((item) => (
                          <div
                            key={item.id}
                            className={cn(
                              "text-[10px] px-1 py-0.5 rounded truncate",
                              getTypeColor(item.type)
                            )}
                          >
                            {item.title.split(" ").slice(0, 2).join(" ")}
                          </div>
                        ))}
                        {dayContent.length > 3 && (
                          <div className="text-[10px] text-[var(--color-text-muted)]">
                            +{dayContent.length - 3} more
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex gap-4 mt-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
            <span className="text-[var(--color-text-secondary)]">Blog</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-[var(--color-text-secondary)]">Social</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            <span className="text-[var(--color-text-secondary)]">Email</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="text-[var(--color-text-secondary)]">Video</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            <span className="text-[var(--color-text-secondary)]">Ad</span>
          </div>
        </div>
      </div>
      
      {/* Day Detail Panel */}
      <div className="w-80 bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {selectedDate ? formatDate(selectedDate) : "Select a day"}
        </h3>
        
        {selectedDate ? (
          selectedContent.length > 0 ? (
            <div className="space-y-3">
              {selectedContent.map((item) => (
                <div
                  key={item.id}
                  className="p-3 bg-[var(--color-surface-0)] rounded border border-[var(--color-border)]"
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded",
                      getTypeColor(item.type)
                    )}>
                      {item.type.toUpperCase()}
                    </span>
                    <span className={cn("text-xs", getStatusColor(item.status))}>
                      {getStatusIcon(item.status)} {item.status}
                    </span>
                  </div>
                  <h4 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{item.title}</h4>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    <span>{item.channel}</span>
                    <span className="mx-1">•</span>
                    <span>{item.author}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-muted)]">No content scheduled for this day.</p>
          )
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Click on a day to view content details.</p>
        )}
      </div>
    </div>
  );
};

// Queue Tab
const QueueTab: React.FC = () => {
  const [selectedItem, setSelectedItem] = useState<ContentItem | null>(null);
  
  const upcomingContent = [...sampleContent]
    .filter(item => item.status === "scheduled" || item.status === "draft")
    .toSorted((a, b) => a.scheduledDate.getTime() - b.scheduledDate.getTime())
    .slice(0, 15);
  
  return (
    <div className="flex gap-6 h-full">
      <div className="flex-1">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Upcoming Content Queue</h2>
        <div className="space-y-2">
          {upcomingContent.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={cn(
                "p-4 bg-[var(--color-surface-1)] rounded-lg border cursor-pointer transition-colors",
                selectedItem?.id === item.id
                  ? "border-indigo-500"
                  : "border-[var(--color-border)] hover:border-[var(--color-border)]"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{item.title}</h3>
                  <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                    <span className={cn("px-1.5 py-0.5 rounded", getTypeColor(item.type))}>
                      {item.type}
                    </span>
                    <span>{item.channel}</span>
                    <span>•</span>
                    <span>{formatDate(item.scheduledDate)} at {formatTime(item.scheduledDate)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className={cn("text-xs block", getStatusColor(item.status))}>
                    {getStatusIcon(item.status)} {item.status}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] mt-1 block">{item.author}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Detail Panel */}
      <div className="w-80 bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {selectedItem ? "Content Details" : "Select an item"}
        </h3>
        
        {selectedItem ? (
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Title</label>
              <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedItem.title}</p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Type</label>
              <p className="text-sm text-[var(--color-text-primary)] mt-1">
                <span className={cn("px-2 py-1 rounded text-xs", getTypeColor(selectedItem.type))}>
                  {selectedItem.type}
                </span>
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Channel</label>
              <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedItem.channel}</p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Scheduled</label>
              <p className="text-sm text-[var(--color-text-primary)] mt-1">
                {formatDate(selectedItem.scheduledDate)} at {formatTime(selectedItem.scheduledDate)}
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Status</label>
              <p className={cn("text-sm mt-1", getStatusColor(selectedItem.status))}>
                {getStatusIcon(selectedItem.status)} {selectedItem.status}
              </p>
            </div>
            <div>
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Author</label>
              <p className="text-sm text-[var(--color-text-primary)] mt-1">{selectedItem.author}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">Click on a content item to see details.</p>
        )}
      </div>
    </div>
  );
};

// Analytics Tab
const AnalyticsTab: React.FC = () => {
  const publishedThisMonth = sampleContent.filter(item => item.status === "published").length;
  const avgEngagement = 7.2;
  const topChannel = "Email Newsletter";
  const bestType: ContentType = "video";
  
  // Posts by day of week
  const postsByDay = [
    { day: "Sun", count: 3 },
    { day: "Mon", count: 8 },
    { day: "Tue", count: 12 },
    { day: "Wed", count: 10 },
    { day: "Thu", count: 9 },
    { day: "Fri", count: 7 },
    { day: "Sat", count: 4 },
  ];
  const maxDayCount = Math.max(...postsByDay.map(d => d.count));
  
  // Content by type
  const contentByType = [
    { type: "blog", count: 8, percentage: 40 },
    { type: "social", count: 6, percentage: 30 },
    { type: "video", count: 3, percentage: 15 },
    { type: "email", count: 2, percentage: 10 },
    { type: "ad", count: 1, percentage: 5 },
  ];
  
  const typeColors: Record<ContentType, string> = {
    blog: "bg-indigo-600",
    social: "bg-emerald-500",
    email: "bg-amber-500",
    video: "bg-blue-500",
    ad: "bg-rose-500",
  };
  
  return (
    <div className="space-y-6 h-full overflow-auto">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Published This Month</label>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-1">{publishedThisMonth}</p>
          <p className="text-xs text-emerald-400 mt-1">+12% from last month</p>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Avg Engagement Rate</label>
          <p className="text-3xl font-bold text-[var(--color-text-primary)] mt-1">{avgEngagement}%</p>
          <p className="text-xs text-emerald-400 mt-1">+1.8% from last month</p>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Top Channel</label>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{topChannel}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">22.4% engagement</p>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Best Type</label>
          <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1 capitalize">{bestType}</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">8.3% engagement</p>
        </div>
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Bar Chart - Posts by Day */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Posts by Day of Week</h3>
          <div className="flex items-end justify-between h-40 gap-2">
            {postsByDay.map((item) => (
              <div key={item.day} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-indigo-600 rounded-t transition-all"
                  style={{ height: `${(item.count / maxDayCount) * 100}%` }}
                ></div>
                <span className="text-xs text-[var(--color-text-muted)] mt-2">{item.day}</span>
                <span className="text-xs text-[var(--color-text-primary)]">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* Horizontal Bars - Content by Type */}
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Content by Type</h3>
          <div className="space-y-3">
            {contentByType.map((item) => (
              <div key={item.type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[var(--color-text-secondary)] capitalize">{item.type}</span>
                  <span className="text-sm text-[var(--color-text-primary)]">{item.count} ({item.percentage}%)</span>
                </div>
                <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full", typeColors[item.type as ContentType])}
                    style={{ width: `${item.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// Channels Tab
const ChannelsTab: React.FC = () => {
  return (
    <div className="space-y-4 h-full overflow-auto">
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Connected Channels</h2>
      
      <div className="grid grid-cols-2 gap-4">
        {sampleChannels.map((channel) => (
          <div
            key={channel.id}
            className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--color-text-primary)]">{channel.name}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{channel.handle}</p>
              </div>
              <span className={cn(
                "text-xs px-2 py-1 rounded",
                channel.status === "connected" && "bg-emerald-400/20 text-emerald-400",
                channel.status === "disconnected" && "bg-rose-400/20 text-rose-400",
                channel.status === "pending" && "bg-amber-400/20 text-amber-400"
              )}>
                {channel.status}
              </span>
            </div>
            
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-[var(--color-surface-0)] rounded p-2">
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">{formatNumber(channel.followers)}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Followers</p>
              </div>
              <div className="bg-[var(--color-surface-0)] rounded p-2">
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">{channel.postsThisMonth}</p>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Posts</p>
              </div>
              <div className="bg-[var(--color-surface-0)] rounded p-2">
                <p className="text-lg font-semibold text-[var(--color-text-primary)]">{channel.engagementRate}%</p>
                <p className="text-[10px] text-[var(--color-text-muted)] uppercase">Engagement</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Channel Stats Summary */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 mt-6">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Channel Performance Summary</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{formatNumber(sampleChannels.reduce((sum, c) => sum + c.followers, 0))}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Total Followers</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">{sampleChannels.reduce((sum, c) => sum + c.postsThisMonth, 0)}</p>
            <p className="text-xs text-[var(--color-text-muted)]">Total Posts This Month</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[var(--color-text-primary)]">
              {(sampleChannels.reduce((sum, c) => sum + c.engagementRate, 0) / sampleChannels.filter(c => c.status === "connected").length).toFixed(1)}%
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">Avg Engagement Rate</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Main Component
const ContentCalendar: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"calendar" | "queue" | "analytics" | "channels">("calendar");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  
  const tabs: Array<{ key: "calendar" | "queue" | "analytics" | "channels"; label: string }> = [
    { key: "calendar", label: "Calendar" },
    { key: "queue", label: "Queue" },
    { key: "analytics", label: "Analytics" },
    { key: "channels", label: "Channels" },
  ];
  
  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Content Calendar</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">Plan, schedule, and track your content across all channels</p>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-[var(--color-border)] mb-6">
          <div className="flex gap-0">
            {tabs.map((tab) => (
              <TabButton
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </TabButton>
            ))}
          </div>
        </div>
        
        {/* Tab Content */}
        <div className="h-[calc(100vh-220px)]">
          {activeTab === "calendar" && (
            <CalendarTab
              content={sampleContent}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
            />
          )}
          {activeTab === "queue" && <QueueTab />}
          {activeTab === "analytics" && <AnalyticsTab />}
          {activeTab === "channels" && <ChannelsTab />}
        </div>
      </div>
    </div>
  );
};

export default ContentCalendar;
