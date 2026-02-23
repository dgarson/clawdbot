import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Shield, 
  Filter, 
  Search,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Download,
  Eye,
  MoreHorizontal
} from 'lucide-react';

// Types
interface RemediationItem {
  id: string;
  findingId: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  status: 'open' | 'in_progress' | 'fixed' | 'accepted_risk';
  assignee?: string;
  createdAt: string;
  updatedAt: string;
  target: string;
  category: string;
  notes?: string;
  dueDate?: string;
}

const mockData: RemediationItem[] = [
  {
    id: 'rem-001',
    findingId: 'find-2847',
    title: 'SQL Injection in /api/users',
    severity: 'critical',
    status: 'in_progress',
    assignee: 'Sarah Chen',
    createdAt: '2026-02-15T10:30:00Z',
    updatedAt: '2026-02-22T14:20:00Z',
    target: 'prod-api-01',
    category: 'Injection',
    notes: 'Patched input validation. Awaiting penetration test.',
    dueDate: '2026-02-25'
  },
  {
    id: 'rem-002',
    findingId: 'find-2851',
    title: 'Exposed AWS Credentials',
    severity: 'critical',
    status: 'fixed',
    assignee: 'Mike Johnson',
    createdAt: '2026-02-16T08:15:00Z',
    updatedAt: '2026-02-20T16:45:00Z',
    target: 'legacy-service',
    category: 'Secrets',
    notes: 'Rotated credentials, revoked keys, implemented secrets manager.'
  },
  {
    id: 'rem-003',
    findingId: 'find-2863',
    title: 'Outdated OpenSSL Library',
    severity: 'high',
    status: 'open',
    assignee: 'DevOps Team',
    createdAt: '2026-02-18T11:00:00Z',
    updatedAt: '2026-02-18T11:00:00Z',
    target: 'web-server-05',
    category: 'Dependencies',
    dueDate: '2026-03-01'
  },
  {
    id: 'rem-004',
    findingId: 'find-2870',
    title: 'Missing Rate Limiting',
    severity: 'medium',
    status: 'accepted_risk',
    assignee: 'Product Team',
    createdAt: '2026-02-19T09:30:00Z',
    updatedAt: '2026-02-21T13:00:00Z',
    target: 'api-gateway',
    category: 'Configuration',
    notes: 'Risk accepted after business review. Implementing CDN-level limiting Q2.'
  },
  {
    id: 'rem-005',
    findingId: 'find-2875',
    title: 'Insecure Direct Object Reference',
    severity: 'high',
    status: 'in_progress',
    assignee: 'Alex Rivera',
    createdAt: '2026-02-20T14:00:00Z',
    updatedAt: '2026-02-22T10:30:00Z',
    target: 'customer-portal',
    category: 'Access Control',
    notes: 'Implementing proper authorization checks.'
  },
  {
    id: 'rem-006',
    findingId: 'find-2880',
    title: 'Weak Password Policy',
    severity: 'medium',
    status: 'fixed',
    assignee: 'Security Team',
    createdAt: '2026-02-17T16:00:00Z',
    updatedAt: '2026-02-19T09:00:00Z',
    target: 'auth-service',
    category: 'Authentication'
  },
  {
    id: 'rem-007',
    findingId: 'find-2885',
    title: 'Missing CSP Headers',
    severity: 'low',
    status: 'open',
    assignee: 'Frontend Team',
    createdAt: '2026-02-21T10:00:00Z',
    updatedAt: '2026-02-21T10:00:00Z',
    target: 'marketing-site',
    category: 'Headers'
  },
  {
    id: 'rem-008',
    findingId: 'find-2890',
    title: 'Unencrypted Data at Rest',
    severity: 'critical',
    status: 'in_progress',
    assignee: 'DBA Team',
    createdAt: '2026-02-22T08:00:00Z',
    updatedAt: '2026-02-22T15:30:00Z',
    target: 'database-primary',
    category: 'Encryption',
    notes: 'Migrating to encrypted volumes. 60% complete.',
    dueDate: '2026-02-28'
  }
];

const severityColors: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  info: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
};

const statusIcons: Record<string, React.ReactNode> = {
  open: <AlertTriangle className="w-4 h-4 text-red-400" />,
  in_progress: <Clock className="w-4 h-4 text-yellow-400" />,
  fixed: <CheckCircle className="w-4 h-4 text-green-400" />,
  accepted_risk: <Shield className="w-4 h-4 text-purple-400" />
};

const statusLabels: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  fixed: 'Fixed',
  accepted_risk: 'Accepted Risk'
};

export default function FindingRemediationTracker() {
  const [items, setItems] = useState<RemediationItem[]>(mockData);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const filteredItems = items.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search.toLowerCase()) ||
                          item.findingId.toLowerCase().includes(search.toLowerCase()) ||
                          item.target.toLowerCase().includes(search.toLowerCase());
    const matchesSeverity = filterSeverity === 'all' || item.severity === filterSeverity;
    const matchesStatus = filterStatus === 'all' || item.status === filterStatus;
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const stats = {
    total: items.length,
    open: items.filter(i => i.status === 'open').length,
    inProgress: items.filter(i => i.status === 'in_progress').length,
    fixed: items.filter(i => i.status === 'fixed').length,
    acceptedRisk: items.filter(i => i.status === 'accepted_risk').length,
    critical: items.filter(i => i.severity === 'critical').length
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Finding Remediation Tracker</h1>
        <p className="text-gray-400">Track and manage remediation status of security findings</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-400">Total</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-400">{stats.open}</div>
          <div className="text-sm text-gray-400">Open</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.inProgress}</div>
          <div className="text-sm text-gray-400">In Progress</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-400">{stats.fixed}</div>
          <div className="text-sm text-gray-400">Fixed</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-purple-400">{stats.acceptedRisk}</div>
          <div className="text-sm text-gray-400">Accepted Risk</div>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-red-500">{stats.critical}</div>
          <div className="text-sm text-gray-400">Critical</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search findings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-gray-700"
          />
        </div>
        
        <div className="flex gap-2">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-700"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gray-700"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="fixed">Fixed</option>
            <option value="accepted_risk">Accepted Risk</option>
          </select>

          <button className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm hover:bg-gray-800">
            <Filter className="w-4 h-4" />
            More
          </button>

          <button className="flex items-center gap-2 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm hover:bg-gray-800">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800/50 text-left text-sm text-gray-400">
            <tr>
              <th className="p-4 w-8"></th>
              <th className="p-4">Finding</th>
              <th className="p-4">Severity</th>
              <th className="p-4">Status</th>
              <th className="p-4">Assignee</th>
              <th className="p-4">Target</th>
              <th className="p-4">Due Date</th>
              <th className="p-4 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {filteredItems.map((item) => (
              <React.Fragment key={item.id}>
                <tr className="hover:bg-gray-800/30">
                  <td className="p-4">
                    <button
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                      className="text-gray-400 hover:text-gray-200"
                    >
                      {expandedItem === item.id ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                  <td className="p-4">
                    <div>
                      <div className="font-medium">{item.title}</div>
                      <div className="text-sm text-gray-500">{item.findingId} • {item.category}</div>
                    </div>
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${severityColors[item.severity]}`}>
                      {item.severity.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      {statusIcons[item.status]}
                      <span className="text-sm">{statusLabels[item.status]}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm text-gray-300">
                    {item.assignee || '-'}
                  </td>
                  <td className="p-4 text-sm text-gray-300">
                    {item.target}
                  </td>
                  <td className="p-4 text-sm">
                    {item.dueDate ? (
                      <span className={new Date(item.dueDate) < new Date() ? 'text-red-400' : 'text-gray-300'}>
                        {formatDate(item.dueDate)}
                      </span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="p-4">
                    <button className="text-gray-400 hover:text-gray-200">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
                {expandedItem === item.id && (
                  <tr>
                    <td colSpan={8} className="bg-gray-800/20 p-4">
                      <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Details</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Created</span>
                              <span>{formatDate(item.createdAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Updated</span>
                              <span>{formatDate(item.updatedAt)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Category</span>
                              <span>{item.category}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Notes</h4>
                          <p className="text-sm text-gray-300">
                            {item.notes || 'No notes added.'}
                          </p>
                          <div className="mt-4 flex gap-2">
                            <button className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded">
                              <Eye className="w-3 h-3" />
                              View Finding
                            </button>
                            <button className="flex items-center gap-1 text-xs bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded">
                              <RefreshCw className="w-3 h-3" />
                              Update Status
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>

        {filteredItems.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No findings match your filters.
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4 text-sm text-gray-400">
        <div>Showing {filteredItems.length} of {items.length} items</div>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800" disabled>
            Previous
          </button>
          <button className="px-3 py-1 bg-gray-900 border border-gray-800 rounded hover:bg-gray-800">
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
