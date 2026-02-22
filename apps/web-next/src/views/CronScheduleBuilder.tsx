import React, { useState } from 'react';
import { 
  Plus, 
  Play, 
  Power, 
  MoreHorizontal, 
  Calendar, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  X,
  History,
  Timer,
  Terminal,
  Filter
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useGateway } from '../hooks/useGateway';
import { MOCK_CRON_JOBS, MOCK_AGENTS, formatCronSchedule, formatRelativeTime, formatDuration } from '../mock-data';
import type { CronJob, Agent } from '../types';

type Tab = 'all' | 'enabled' | 'disabled';

export default function CronScheduleBuilder() {
  const [activeTab, setActiveTab] = useState<Tab>('all');
  const [jobs, setJobs] = useState<CronJob[]>(MOCK_CRON_JOBS);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  // New Job State
  const [newJob, setNewJob] = useState({
    name: '',
    agentId: '',
    schedule: '0 7 * * *',
    customSchedule: '',
    prompt: '',
    useCustom: false
  });

  const filteredJobs = jobs.filter(job => {
    if (activeTab === 'enabled') return job.status === 'enabled' || job.status === 'running';
    if (activeTab === 'disabled') return job.status === 'disabled';
    return true;
  });

  const toggleJob = (id: string) => {
    setJobs(jobs.map(j => {
      if (j.id === id) {
        return { ...j, status: j.status === 'disabled' ? 'enabled' : 'disabled' };
      }
      return j;
    }));
  };

  const deleteJob = (id: string) => {
    if (confirm('Are you sure you want to delete this automation?')) {
      setJobs(jobs.filter(j => j.id !== id));
    }
  };

  return (
    <div className="flex h-full bg-gray-950 text-white overflow-hidden relative">
      <div className="flex-1 flex flex-col h-full overflow-y-auto">
        {/* Header */}
        <div className="p-8 border-b border-gray-800 flex items-center justify-between sticky top-0 bg-gray-950/80 backdrop-blur-md z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold">Automations</h1>
            <span className="px-2.5 py-0.5 bg-gray-900 border border-gray-800 rounded-full text-xs font-bold text-gray-400">
              {jobs.length} total
            </span>
          </div>
          <button 
            onClick={() => setIsPanelOpen(true)}
            className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl font-medium transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" />
            New Automation
          </button>
        </div>

        {/* Content */}
        <div className="p-8 space-y-8 max-w-6xl mx-auto w-full">
          {/* Filters */}
          <div className="flex items-center gap-1 bg-gray-900 p-1 rounded-xl w-fit border border-gray-800">
            {(['all', 'enabled', 'disabled'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize",
                  activeTab === tab ? "bg-gray-800 text-white shadow-sm" : "text-gray-500 hover:text-gray-300"
                )}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Job List */}
          <div className="space-y-4">
            {filteredJobs.length === 0 ? (
              <div className="p-20 text-center border-2 border-dashed border-gray-800 rounded-2xl">
                <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-gray-700" />
                </div>
                <h3 className="text-xl font-bold text-gray-300">No automations found</h3>
                <p className="text-gray-500 max-w-sm mx-auto mt-2">
                  Create your first scheduled task to run agents automatically at specific times.
                </p>
                <button 
                  onClick={() => setIsPanelOpen(true)}
                  className="mt-6 text-violet-500 font-bold hover:text-violet-400"
                >
                  + Create Automation
                </button>
              </div>
            ) : (
              filteredJobs.map(job => (
                <div key={job.id} className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden group">
                  <div className="p-6 flex items-center gap-6">
                    {/* Status Dot */}
                    <div className="relative">
                      <div className={cn(
                        "w-3 h-3 rounded-full ring-4 ring-gray-950",
                        job.status === 'enabled' ? "bg-green-500" :
                        job.status === 'running' ? "bg-amber-500 animate-pulse" :
                        job.status === 'error' ? "bg-red-500" : "bg-gray-600"
                      )} />
                    </div>

                    {/* Job Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="font-bold text-lg truncate">{job.name}</h3>
                        <div className="flex items-center gap-1.5 px-2 py-0.5 bg-gray-800 rounded-md">
                          <span className="text-xs">{job.agentEmoji}</span>
                          <span className="text-xs font-medium text-gray-400">{job.agentName}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-4 h-4" />
                          {formatCronSchedule(job.schedule)}
                        </div>
                      </div>
                    </div>

                    {/* Run Stats */}
                    <div className="hidden md:flex flex-col gap-1 w-64">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Next run:</span>
                        <span className="text-gray-300 font-medium">
                          {job.nextRun ? formatRelativeTime(job.nextRun).replace(' ago', '') : 'Never'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Last run:</span>
                        <div className="flex items-center gap-1.5">
                          {job.lastRunStatus === 'ok' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          ) : job.lastRunStatus === 'error' ? (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
                          )}
                          <span className="text-gray-300">
                            {job.lastRunStatus === 'ok' ? 'OK' : 'Error'} 
                            <span className="text-gray-600 ml-1">
                              ({formatDuration(job.lastRunDuration || 0)})
                            </span>
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors" title="Run Now">
                        <Play className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => toggleJob(job.id)}
                        className={cn(
                          "p-2 rounded-lg transition-colors",
                          job.status === 'disabled' ? "text-gray-600 hover:bg-gray-800" : "text-violet-500 hover:bg-violet-500/10"
                        )} 
                        title={job.status === 'disabled' ? 'Enable' : 'Disable'}
                      >
                        <Power className="w-5 h-5" />
                      </button>
                      
                      <div className="relative">
                        <button 
                          onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                          className={cn(
                            "p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors",
                            expandedJob === job.id && "bg-gray-800 text-white"
                          )}
                        >
                          <History className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="w-px h-6 bg-gray-800 mx-1" />
                      
                      <button className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors">
                        <MoreHorizontal className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Run History Expansion */}
                  {expandedJob === job.id && (
                    <div className="px-6 pb-6 pt-2 border-t border-gray-800 bg-gray-950/30 animate-in slide-in-from-top-2 duration-200">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">Recent Run History</h4>
                        <button className="text-xs text-violet-500 hover:text-violet-400 font-medium">View Logs</button>
                      </div>
                      <div className="space-y-2">
                        {[1, 2, 3, 4, 5].map(i => (
                          <div key={i} className="flex items-center justify-between p-3 bg-gray-900/50 rounded-xl border border-gray-800/50 hover:border-gray-700 transition-colors">
                            <div className="flex items-center gap-3">
                              {i === 3 ? (
                                <XCircle className="w-4 h-4 text-red-500" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-green-500" />
                              )}
                              <span className="text-sm font-medium">Run #{120 - i}</span>
                              <span className="text-xs text-gray-500">{formatRelativeTime(new Date(Date.now() - i * 86400000).toISOString())}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              {i === 3 && (
                                <span className="text-xs text-red-400 bg-red-400/10 px-2 py-0.5 rounded italic">API Connection Timeout</span>
                              )}
                              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                <Timer className="w-3 h-3" />
                                {i === 1 ? '1.2s' : i === 3 ? '15.0s' : '0.8s'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Slide-in Panel Overlay */}
      <div 
        className={cn(
          "absolute inset-0 bg-gray-950/60 backdrop-blur-sm transition-opacity z-40",
          isPanelOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsPanelOpen(false)}
      />

      {/* Slide-in Panel */}
      <div className={cn(
        "absolute right-0 top-0 bottom-0 w-[500px] bg-gray-900 border-l border-gray-800 shadow-2xl z-50 transform transition-transform duration-300 ease-out flex flex-col",
        isPanelOpen ? "translate-x-0" : "translate-x-full"
      )}>
        <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
          <h2 className="text-xl font-bold">New Automation</h2>
          <button 
            onClick={() => setIsPanelOpen(false)}
            className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Job Name</label>
            <input 
              type="text"
              placeholder="e.g. Daily Standup, Code Quality Check"
              value={newJob.name}
              onChange={e => setNewJob({...newJob, name: e.target.value})}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Assigned Agent</label>
            <div className="grid grid-cols-1 gap-2">
              {MOCK_AGENTS.map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setNewJob({...newJob, agentId: agent.id})}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all text-left",
                    newJob.agentId === agent.id 
                      ? "bg-violet-600/10 border-violet-600" 
                      : "bg-gray-950 border-gray-800 hover:border-gray-700"
                  )}
                >
                  <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-xl">
                    {agent.emoji}
                  </div>
                  <div>
                    <div className="font-bold text-sm">{agent.name}</div>
                    <div className="text-xs text-gray-500">{agent.role}</div>
                  </div>
                  {newJob.agentId === agent.id && <CheckCircle2 className="w-5 h-5 text-violet-500 ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-400">Schedule</label>
              <button 
                onClick={() => setNewJob({...newJob, useCustom: !newJob.useCustom})}
                className="text-xs font-bold text-violet-500 uppercase tracking-wider"
              >
                {newJob.useCustom ? 'Use Presets' : 'Custom Cron'}
              </button>
            </div>

            {newJob.useCustom ? (
              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="* * * * *"
                  value={newJob.customSchedule}
                  onChange={e => setNewJob({...newJob, customSchedule: e.target.value})}
                  className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 font-mono text-violet-400 placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all"
                />
                <div className="p-4 bg-gray-950/50 rounded-xl border border-gray-800 border-dashed">
                  <h4 className="text-[10px] font-bold text-gray-600 uppercase mb-3 tracking-widest">Next 3 Runs</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3 text-gray-600" />
                      <span>Today at 4:00 PM</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3 text-gray-600" />
                      <span>Today at 5:00 PM</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <Clock className="w-3 h-3 text-gray-600" />
                      <span>Today at 6:00 PM</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {[
                  { label: 'Every hour', value: '0 * * * *' },
                  { label: 'Every day at 7 AM', value: '0 7 * * *' },
                  { label: 'Every Monday at 9 AM', value: '0 9 * * 1' },
                  { label: 'Every weekday at 8 AM', value: '0 8 * * 1-5' },
                ].map(preset => (
                  <button
                    key={preset.value}
                    onClick={() => setNewJob({...newJob, schedule: preset.value})}
                    className={cn(
                      "p-4 rounded-xl border text-sm font-medium transition-all text-left",
                      newJob.schedule === preset.value && !newJob.useCustom
                        ? "bg-violet-600/10 border-violet-600 text-violet-200" 
                        : "bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700 hover:text-gray-300"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">Automation Prompt</label>
            <textarea 
              rows={5}
              placeholder="What should the agent do when this job runs?"
              value={newJob.prompt}
              onChange={e => setNewJob({...newJob, prompt: e.target.value})}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all resize-none"
            />
            <p className="text-[10px] text-gray-600 italic">This prompt will be sent as a new message to the agent on every run.</p>
          </div>
        </div>

        <div className="p-6 border-t border-gray-800 bg-gray-900/50 flex gap-4">
          <button 
            onClick={() => setIsPanelOpen(false)}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-800 font-bold text-gray-400 hover:bg-gray-800 transition-all"
          >
            Cancel
          </button>
          <button 
            disabled={!newJob.name || !newJob.agentId}
            className="flex-1 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-white shadow-lg shadow-violet-600/20 transition-all active:scale-95"
          >
            Create Job
          </button>
        </div>
      </div>
    </div>
  );
}
