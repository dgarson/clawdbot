import React, { useState, useMemo } from 'react';
import { cn } from '../lib/utils';
import {
  Users, Shield, Mail, Search, Plus, ChevronDown,
  X, Check, AlertTriangle, MoreHorizontal, RefreshCw,
  Crown, ShieldCheck, User, Eye, Lock, Clock
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
type MemberStatus = 'active' | 'invited' | 'suspended';

interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  avatarColor: string;
  invitedAt?: string;
  suspendedAt?: string;
}

interface RoleInfo {
  id: MemberRole;
  name: string;
  description: string;
  badgeColor: string;
  permissions: string[];
  canChangeRole: boolean;
}

interface Invite {
  id: string;
  email: string;
  role: MemberRole;
  invitedBy: string;
  expiresAt: string;
  sentAt: string;
}

// ============================================================================
// Seed Data
// ============================================================================

const ROLES: RoleInfo[] = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Full access to all features and settings',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    permissions: ['Manage agents', 'View sessions', 'Edit cron jobs', 'Manage billing', 'Invite members', 'Manage team members', 'Delete team', 'Access settings'],
    canChangeRole: false,
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Can manage team members and most settings',
    badgeColor: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
    permissions: ['Manage agents', 'View sessions', 'Edit cron jobs', 'Manage billing', 'Invite members', 'Manage team members'],
    canChangeRole: true,
  },
  {
    id: 'member',
    name: 'Member',
    description: 'Standard access to agents and sessions',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    permissions: ['Manage agents', 'View sessions', 'Edit own cron jobs'],
    canChangeRole: true,
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Read-only access to view agents and sessions',
    badgeColor: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    permissions: ['View agents', 'View sessions'],
    canChangeRole: true,
  },
];

const SEED_MEMBERS: Member[] = [
  { id: '1', name: 'Luis Rodriguez', email: 'luis@horizon.ai', role: 'owner', status: 'active', avatarColor: 'bg-amber-500', invitedAt: '2024-01-15' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@horizon.ai', role: 'admin', status: 'active', avatarColor: 'bg-violet-500', invitedAt: '2024-02-20' },
  { id: '3', name: 'Marcus Johnson', email: 'marcus@horizon.ai', role: 'member', status: 'active', avatarColor: 'bg-blue-500', invitedAt: '2024-03-10' },
  { id: '4', name: 'Emily Davis', email: 'emily@horizon.ai', role: 'member', status: 'invited', avatarColor: 'bg-emerald-500', invitedAt: '2024-06-01' },
  { id: '5', name: 'James Wilson', email: 'james@horizon.ai', role: 'viewer', status: 'active', avatarColor: 'bg-cyan-500', invitedAt: '2024-04-05' },
  { id: '6', name: 'Alex Thompson', email: 'alex@horizon.ai', role: 'viewer', status: 'suspended', avatarColor: 'bg-rose-500', suspendedAt: '2024-07-15' },
];

const SEED_INVITES: Invite[] = [
  { id: '1', email: 'newuser1@company.com', role: 'member', invitedBy: 'Luis Rodriguez', expiresAt: '2026-02-25T23:59:59Z', sentAt: '2026-02-20T10:30:00Z' },
  { id: '2', email: 'newuser2@company.com', role: 'viewer', invitedBy: 'Sarah Chen', expiresAt: '2026-02-28T23:59:59Z', sentAt: '2026-02-21T14:15:00Z' },
];

// ============================================================================
// Utility Components
// ============================================================================

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getRoleBadgeStyles(role: MemberRole): string {
  const roleInfo = ROLES.find((r) => r.id === role);
  return roleInfo?.badgeColor ?? 'bg-gray-500/20 text-gray-400 border-gray-500/30';
}

function getStatusStyles(status: MemberStatus): { dot: string; text: string; label: string } {
  const configs = {
    active: { dot: 'bg-emerald-500', text: 'text-emerald-400', label: 'Active' },
    invited: { dot: 'bg-amber-500', text: 'text-amber-400', label: 'Invited' },
    suspended: { dot: 'bg-rose-500', text: 'text-rose-400', label: 'Suspended' },
  };
  return configs[status];
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {return 'Expired';}
  if (diffDays === 0) {return 'Today';}
  if (diffDays === 1) {return 'Tomorrow';}
  if (diffDays < 7) {return `${diffDays} days`;}
  return formatDate(dateString);
}

// ============================================================================
// Avatar Component
// ============================================================================

interface AvatarProps {
  name: string;
  color: string;
  size?: 'sm' | 'md' | 'lg';
}

function Avatar({ name, color, size = 'md' }: AvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-medium text-white',
        sizeClasses[size],
        color
      )}
    >
      {getInitials(name)}
    </div>
  );
}

// ============================================================================
// Role Badge Component
// ============================================================================

interface RoleBadgeProps {
  role: MemberRole;
}

function RoleBadge({ role }: RoleBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        getRoleBadgeStyles(role)
      )}
    >
      {role === 'owner' && <Crown className="w-3 h-3 mr-1" />}
      {role === 'admin' && <ShieldCheck className="w-3 h-3 mr-1" />}
      {role === 'member' && <User className="w-3 h-3 mr-1" />}
      {role === 'viewer' && <Eye className="w-3 h-3 mr-1" />}
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// ============================================================================
// Status Badge Component
// ============================================================================

interface StatusBadgeProps {
  status: MemberStatus;
}

function StatusBadge({ status }: StatusBadgeProps) {
  const styles = getStatusStyles(status);

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs', styles.text)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', styles.dot)} />
      {styles.label}
    </span>
  );
}

// ============================================================================
// Invite Modal Component
// ============================================================================

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: MemberRole) => void;
}

function InviteModal({ isOpen, onClose, onInvite }: InviteModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('member');
  const [error, setError] = useState('');

  if (!isOpen) {return null;}

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    onInvite(email.trim(), role);
    setEmail('');
    setRole('member');
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md p-6 mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="invite-modal-title"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 id="invite-modal-title" className="text-lg font-semibold text-white">
            Invite Team Member
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white transition-colors rounded-lg hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="invite-email" className="block mb-2 text-sm font-medium text-zinc-300">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <input
                id="invite-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="colleague@company.com"
                className={cn(
                  'w-full pl-10 pr-4 py-2.5 bg-zinc-950 border rounded-lg text-white placeholder-zinc-500',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  'transition-colors',
                  error ? 'border-rose-500' : 'border-zinc-800'
                )}
              />
            </div>
            {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}
          </div>

          <div className="mb-6">
            <label htmlFor="invite-role" className="block mb-2 text-sm font-medium text-zinc-300">
              Role
            </label>
            <div className="relative">
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as MemberRole)}
                className={cn(
                  'w-full pl-10 pr-10 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white',
                  'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent',
                  'appearance-none cursor-pointer transition-colors'
                )}
              >
                {ROLES.filter((r) => r.id !== 'owner').map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 transition-colors"
            >
              Send Invite
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================================================
// Confirmation Dialog Component
// ============================================================================

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'danger' | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmVariant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-sm p-6 mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
      >
        <div className="flex items-start gap-4 mb-4">
          <div className={cn('p-2 rounded-full', confirmVariant === 'danger' ? 'bg-rose-500/20' : 'bg-amber-500/20')}>
            <AlertTriangle className={cn('w-5 h-5', confirmVariant === 'danger' ? 'text-rose-400' : 'text-amber-400')} />
          </div>
          <div className="flex-1">
            <h3 id="confirm-dialog-title" className="text-base font-semibold text-white">
              {title}
            </h3>
            <p id="confirm-dialog-description" className="mt-1 text-sm text-zinc-400">
              {message}
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-zinc-300 bg-zinc-800 rounded-lg hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium text-white rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 transition-colors',
              confirmVariant === 'danger' ? 'bg-rose-600 hover:bg-rose-500' : 'bg-amber-600 hover:bg-amber-500'
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Role Dropdown Component
// ============================================================================

interface RoleDropdownProps {
  currentRole: MemberRole;
  onChange: (newRole: MemberRole) => void;
  disabled?: boolean;
}

function RoleDropdown({ currentRole, onChange, disabled = false }: RoleDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentRoleInfo = ROLES.find((r) => r.id === currentRole);
  const availableRoles = ROLES.filter((r) => r.canChangeRole);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors',
          disabled
            ? 'bg-zinc-800/50 border-zinc-700 text-zinc-500 cursor-not-allowed'
            : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600 cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500'
        )}
        aria-label={`Change role, currently ${currentRoleInfo?.name}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <Shield className="w-3 h-3" />
        {currentRoleInfo?.name}
        {!disabled && <ChevronDown className="w-3 h-3" />}
      </button>

      {isOpen && !disabled && (
        <>
          <div
            className="fixed inset-0"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />
          <ul
            className="absolute right-0 z-20 mt-1 w-36 py-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg"
            role="listbox"
            aria-label="Select role"
          >
            {availableRoles.map((role) => (
              <li key={role.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(role.id);
                    setIsOpen(false);
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-xs text-left flex items-center gap-2 transition-colors',
                    currentRole === role.id
                      ? 'bg-indigo-600/20 text-indigo-400'
                      : 'text-zinc-300 hover:bg-zinc-700'
                  )}
                  role="option"
                  aria-selected={currentRole === role.id}
                >
                  <Shield className="w-3 h-3" />
                  {role.name}
                  {currentRole === role.id && <Check className="w-3 h-3 ml-auto" />}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Members Tab Component
// ============================================================================

interface MembersTabProps {
  members: Member[];
  onInvite: (email: string, role: MemberRole) => void;
  onRoleChange: (memberId: string, newRole: MemberRole) => void;
  onSuspend: (memberId: string) => void;
  onRemove: (memberId: string) => void;
}

function MembersTab({ members, onInvite, onRoleChange, onSuspend, onRemove }: MembersTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    type: 'suspend' | 'remove';
    memberId: string;
  } | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) {return members;}
    const query = searchQuery.toLowerCase();
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.email.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const handleSuspendConfirm = () => {
    if (confirmDialog?.type === 'suspend' && confirmDialog.memberId) {
      onSuspend(confirmDialog.memberId);
    }
    setConfirmDialog(null);
  };

  const handleRemoveConfirm = () => {
    if (confirmDialog?.type === 'remove' && confirmDialog.memberId) {
      onRemove(confirmDialog.memberId);
    }
    setConfirmDialog(null);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-white">Team Members</h2>
          <span className="px-2 py-0.5 text-xs font-medium text-zinc-400 bg-zinc-800 rounded-full">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setIsInviteModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Invite Member
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search members..."
          className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
          aria-label="Search members"
        />
      </div>

      {/* Members List */}
      <div className="space-y-2">
        {filteredMembers.length === 0 ? (
          <div className="py-12 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
            <p className="text-zinc-400">No members found</p>
          </div>
        ) : (
          filteredMembers.map((member) => (
            <div
              key={member.id}
              className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <Avatar name={member.name} color={member.avatarColor} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="text-sm font-medium text-white truncate">{member.name}</h3>
                  {member.status === 'suspended' && (
                    <span className="text-xs text-rose-400">(Suspended)</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 truncate">{member.email}</p>
              </div>

              <div className="hidden sm:flex items-center gap-3">
                <RoleBadge role={member.role} />
                <StatusBadge status={member.status} />
              </div>

              {/* Mobile: show status only */}
              <div className="flex sm:hidden items-center gap-2">
                <RoleBadge role={member.role} />
              </div>

              {/* Actions */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                  className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                  aria-label={`Actions for ${member.name}`}
                  aria-haspopup="menu"
                  aria-expanded={openMenuId === member.id}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>

                {openMenuId === member.id && (
                  <>
                    <div
                      className="fixed inset-0"
                      onClick={() => setOpenMenuId(null)}
                      aria-hidden="true"
                    />
                    <div className="absolute right-0 z-20 mt-1 w-40 py-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg">
                      {member.role !== 'owner' && (
                        <>
                          <RoleDropdown
                            currentRole={member.role}
                            onChange={(newRole) => onRoleChange(member.id, newRole)}
                          />
                          {member.status !== 'suspended' ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setConfirmDialog({ type: 'suspend', memberId: member.id });
                              }}
                              className="w-full px-3 py-2 text-xs text-left text-amber-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                            >
                              <Clock className="w-3 h-3" />
                              Suspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                onRoleChange(member.id, 'viewer');
                              }}
                              className="w-full px-3 py-2 text-xs text-left text-emerald-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                            >
                              <Check className="w-3 h-3" />
                              Reactivate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setConfirmDialog({ type: 'remove', memberId: member.id });
                            }}
                            className="w-full px-3 py-2 text-xs text-left text-rose-400 hover:bg-zinc-700 transition-colors flex items-center gap-2"
                          >
                            <X className="w-3 h-3" />
                            Remove
                          </button>
                        </>
                      )}
                      {member.role === 'owner' && (
                        <p className="px-3 py-2 text-xs text-zinc-500">
                          Owner cannot be modified
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onInvite={onInvite}
      />

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog !== null}
        title={confirmDialog?.type === 'suspend' ? 'Suspend Member' : 'Remove Member'}
        message={
          confirmDialog?.type === 'suspend'
            ? 'This will temporarily restrict their access to the team. You can reactivate them later.'
            : 'This will permanently remove them from the team. They will need to be invited again to rejoin.'
        }
        confirmLabel={confirmDialog?.type === 'suspend' ? 'Suspend' : 'Remove'}
        confirmVariant={confirmDialog?.type === 'suspend' ? 'warning' : 'danger'}
        onConfirm={confirmDialog?.type === 'suspend' ? handleSuspendConfirm : handleRemoveConfirm}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

// ============================================================================
// Roles Tab Component
// ============================================================================

function RolesTab() {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Roles & Permissions</h2>
        <p className="text-sm text-zinc-400">
          Each role has different permissions. Owner and Admin roles can manage team members.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {ROLES.map((role) => (
          <div
            key={role.id}
            className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={cn('p-2 rounded-lg', role.badgeColor.split(' ')[0])}>
                {role.id === 'owner' ? (
                  <Crown className="w-5 h-5 text-amber-400" />
                ) : role.id === 'admin' ? (
                  <ShieldCheck className="w-5 h-5 text-violet-400" />
                ) : role.id === 'member' ? (
                  <User className="w-5 h-5 text-blue-400" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-semibold text-white">{role.name}</h3>
                  <span
                    className={cn(
                      'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                      role.badgeColor
                    )}
                  >
                    {role.name}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">{role.description}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <h4 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Permissions
              </h4>
              <ul className="space-y-2">
                {role.permissions.map((permission) => (
                  <li key={permission} className="flex items-center gap-2 text-sm text-zinc-300">
                    <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    {permission}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}

        {/* Custom Role Teaser */}
        <div className="p-5 bg-zinc-900/30 border border-zinc-800 border-dashed rounded-xl relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/5 to-violet-600/5" />
          <div className="relative flex flex-col items-center justify-center py-6 text-center">
            <div className="p-3 rounded-full bg-zinc-800 mb-4">
              <Lock className="w-6 h-6 text-zinc-500" />
            </div>
            <h3 className="text-base font-semibold text-white mb-2">Custom Roles</h3>
            <p className="text-xs text-zinc-500 mb-4 max-w-[200px]">
              Create custom roles with specific permissions for your team
            </p>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-300 bg-indigo-500/20 rounded-full">
              <Crown className="w-3 h-3" />
              Pro Feature
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Invites Tab Component
// ============================================================================

interface InvitesTabProps {
  invites: Invite[];
  onCancel: (inviteId: string) => void;
  onResend: (inviteId: string) => void;
}

function InvitesTab({ invites, onCancel, onResend }: InvitesTabProps) {
  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-2">Pending Invitations</h2>
        <p className="text-sm text-zinc-400">
          Invitations that have been sent but not yet accepted.
        </p>
      </div>

      {invites.length === 0 ? (
        <div className="py-16 text-center bg-zinc-900/30 border border-zinc-800 rounded-xl">
          <Mail className="w-12 h-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400 mb-2">No pending invitations</p>
          <p className="text-xs text-zinc-500">
            Invite team members from the Members tab
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => (
            <div
              key={invite.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Mail className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{invite.email}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <RoleBadge role={invite.role} />
                    <span className="text-xs text-zinc-500">
                      Invited by {invite.invitedBy}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 ml-11 sm:ml-0">
                <div className="text-xs text-zinc-500">
                  Expires {formatRelativeDate(invite.expiresAt)}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResend(invite.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 bg-zinc-800 rounded-md hover:bg-zinc-700 focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                    aria-label={`Resend invitation to ${invite.email}`}
                  >
                    <RefreshCw className="w-3 h-3" />
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => onCancel(invite.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-400 bg-rose-500/10 rounded-md hover:bg-rose-500/20 focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
                    aria-label={`Cancel invitation to ${invite.email}`}
                  >
                    <X className="w-3 h-3" />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main TeamManagement Component
// ============================================================================

type TabId = 'members' | 'roles' | 'invites';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: Tab[] = [
  { id: 'members', label: 'Members', icon: Users },
  { id: 'roles', label: 'Roles', icon: Shield },
  { id: 'invites', label: 'Invites', icon: Mail },
];

export default function TeamManagement() {
  const [activeTab, setActiveTab] = useState<TabId>('members');
  const [members, setMembers] = useState<Member[]>(SEED_MEMBERS);
  const [invites, setInvites] = useState<Invite[]>(SEED_INVITES);

  const handleInvite = (email: string, role: MemberRole) => {
    const newMember: Member = {
      id: `new-${Date.now()}`,
      name: email.split('@')[0],
      email,
      role,
      status: 'invited',
      avatarColor: 'bg-emerald-500',
      invitedAt: new Date().toISOString(),
    };
    setMembers((prev) => [...prev, newMember]);

    const newInvite: Invite = {
      id: `invite-${Date.now()}`,
      email,
      role,
      invitedBy: 'You',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      sentAt: new Date().toISOString(),
    };
    setInvites((prev) => [...prev, newInvite]);
  };

  const handleRoleChange = (memberId: string, newRole: MemberRole) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, role: newRole } : m
      )
    );
  };

  const handleSuspend = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId
          ? { ...m, status: 'suspended', suspendedAt: new Date().toISOString() }
          : m
      )
    );
  };

  const handleRemove = (memberId: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
  };

  const handleCancelInvite = (inviteId: string) => {
    setInvites((prev) => prev.filter((i) => i.id !== inviteId));
  };

  const handleResendInvite = (inviteId: string) => {
    setInvites((prev) =>
      prev.map((i) =>
        i.id === inviteId
          ? { ...i, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() }
          : i
      )
    );
  };

  const pendingInvitesCount = invites.length;

  return (
    <div className="min-h-screen bg-zinc-950 p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Team Management</h1>
          <p className="text-sm text-zinc-400">
            Manage your team members, roles, and invitations
          </p>
        </div>

        {/* Tabs */}
        <div
          className="mb-6 border-b border-zinc-800"
          role="tablist"
          aria-label="Team management sections"
        >
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const count = tab.id === 'invites' ? pendingInvitesCount : undefined;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`panel-${tab.id}`}
                  id={`tab-${tab.id}`}
                  className={cn(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                    isActive
                      ? 'border-indigo-500 text-indigo-400'
                      : 'border-transparent text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {count !== undefined && count > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-amber-500/20 text-amber-400 rounded-full">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Panels */}
        <div className="mt-6">
          {activeTab === 'members' && (
            <div
              id="panel-members"
              role="tabpanel"
              aria-labelledby="tab-members"
            >
              <MembersTab
                members={members}
                onInvite={handleInvite}
                onRoleChange={handleRoleChange}
                onSuspend={handleSuspend}
                onRemove={handleRemove}
              />
            </div>
          )}

          {activeTab === 'roles' && (
            <div
              id="panel-roles"
              role="tabpanel"
              aria-labelledby="tab-roles"
            >
              <RolesTab />
            </div>
          )}

          {activeTab === 'invites' && (
            <div
              id="panel-invites"
              role="tabpanel"
              aria-labelledby="tab-invites"
            >
              <InvitesTab
                invites={invites}
                onCancel={handleCancelInvite}
                onResend={handleResendInvite}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
