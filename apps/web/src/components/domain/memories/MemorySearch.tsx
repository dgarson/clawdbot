
import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Filter, Calendar, X } from "lucide-react";

export interface MemoryFilters {
  sources: string[];
  dateRange: {
    from?: Date;
    to?: Date;
  };
}

interface MemorySearchProps {
  value?: string;
  onValueChange?: (value: string) => void;
  filters?: MemoryFilters;
  onFiltersChange?: (filters: MemoryFilters) => void;
  availableSources?: string[];
  placeholder?: string;
  className?: string;
}

const defaultSources = ["Agent", "Manual", "Import", "Conversation"];

export function MemorySearch({
  value = "",
  onValueChange,
  filters = { sources: [], dateRange: {} },
  onFiltersChange,
  availableSources = defaultSources,
  placeholder = "Search memories...",
  className,
}: MemorySearchProps) {
  const [internalValue, setInternalValue] = React.useState(value);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const currentValue = onValueChange ? value : internalValue;
  const hasActiveFilters = filters.sources.length > 0 || filters.dateRange.from || filters.dateRange.to;

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (onValueChange) {
      onValueChange(newValue);
    } else {
      setInternalValue(newValue);
    }
  };

  const handleClear = () => {
    if (onValueChange) {
      onValueChange("");
    } else {
      setInternalValue("");
    }
    inputRef.current?.focus();
  };

  const handleSourceToggle = (source: string) => {
    if (!onFiltersChange) {return;}

    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];

    onFiltersChange({
      ...filters,
      sources: newSources,
    });
  };

  const handleDateRangeSelect = (range: "today" | "week" | "month" | "all") => {
    if (!onFiltersChange) {return;}

    const now = new Date();
    let from: Date | undefined;

    switch (range) {
      case "today":
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case "all":
        from = undefined;
        break;
    }

    onFiltersChange({
      ...filters,
      dateRange: { from, to: range === "all" ? undefined : now },
    });
  };

  const clearFilters = () => {
    if (!onFiltersChange) {return;}
    onFiltersChange({ sources: [], dateRange: {} });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("flex flex-col sm:flex-row gap-3", className)}
    >
      {/* Search Input */}
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          value={currentValue}
          onChange={handleValueChange}
          placeholder={placeholder}
          className={cn(
            "w-full h-10 pl-10 pr-10 rounded-xl border border-border bg-background",
            "text-sm text-foreground placeholder:text-muted-foreground",
            "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50",
            "transition-all duration-200"
          )}
        />
        {currentValue && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Filter Controls */}
      <div className="flex gap-2">
        {/* Source Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className={cn(
                "h-10 rounded-xl gap-2",
                filters.sources.length > 0 && "border-primary/50 bg-primary/5"
              )}
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Source</span>
              {filters.sources.length > 0 && (
                <span className="ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-xs font-medium">
                  {filters.sources.length}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by source</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableSources.map((source) => (
              <DropdownMenuCheckboxItem
                key={source}
                checked={filters.sources.includes(source)}
                onCheckedChange={() => handleSourceToggle(source)}
              >
                {source}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Date Range Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className={cn(
                "h-10 rounded-xl gap-2",
                (filters.dateRange.from || filters.dateRange.to) && "border-primary/50 bg-primary/5"
              )}
            >
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Date</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Filter by date</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={!filters.dateRange.from && !filters.dateRange.to}
              onCheckedChange={() => handleDateRangeSelect("all")}
            >
              All time
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={
                filters.dateRange.from?.toDateString() === new Date().toDateString()
              }
              onCheckedChange={() => handleDateRangeSelect("today")}
            >
              Today
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={() => handleDateRangeSelect("week")}
            >
              Last 7 days
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={() => handleDateRangeSelect("month")}
            >
              Last 30 days
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear Filters */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-xl"
            onClick={clearFilters}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default MemorySearch;
