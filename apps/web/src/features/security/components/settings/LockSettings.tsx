"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Loader2, Lock, LockOpen, Key } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useSecurity } from "../../SecurityProvider";
import {
  useChangePassword,
  useDisableLock,
  useLock,
} from "../../hooks/useSecurityMutations";
import { SetupUnlockModal } from "../unlock/SetupUnlockModal";
import {
  changePasswordParamsSchema,
  disableParamsSchema,
  type ChangePasswordParams,
  type DisableParams,
} from "../../lib/security-schemas";

/**
 * Lock settings card.
 * Enable/disable app lock and change password.
 */
export function LockSettings() {
  const { state } = useSecurity();
  const [showSetupModal, setShowSetupModal] = React.useState(false);
  const [showChangePassword, setShowChangePassword] = React.useState(false);
  const [showDisable, setShowDisable] = React.useState(false);

  const lockMutation = useLock();

  const handleToggle = (enabled: boolean) => {
    if (enabled && !state.lockEnabled) {
      setShowSetupModal(true);
    } else if (!enabled && state.lockEnabled) {
      setShowDisable(true);
    }
  };

  const handleLockNow = async () => {
    await lockMutation.mutateAsync();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            App Lock
          </CardTitle>
          <CardDescription>
            Protect your Clawdbrain with a password
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enable/disable toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="lock-enabled">Password protection</Label>
              <p className="text-sm text-muted-foreground">
                Require password to access the app
              </p>
            </div>
            <Switch
              id="lock-enabled"
              checked={state.lockEnabled}
              onCheckedChange={handleToggle}
            />
          </div>

          {state.lockEnabled && (
            <>
              {/* Change password */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Password</Label>
                  <p className="text-sm text-muted-foreground">
                    Change your unlock password
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowChangePassword(true)}
                >
                  <Key className="h-4 w-4" />
                  Change
                </Button>
              </div>

              {/* Lock now */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Lock now</Label>
                  <p className="text-sm text-muted-foreground">
                    Immediately lock the app
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLockNow}
                  disabled={lockMutation.isPending || !state.isUnlocked}
                >
                  {lockMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LockOpen className="h-4 w-4" />
                  )}
                  Lock
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <SetupUnlockModal
        open={showSetupModal}
        onOpenChange={setShowSetupModal}
      />

      <ChangePasswordDialog
        open={showChangePassword}
        onOpenChange={setShowChangePassword}
      />

      <DisableLockDialog
        open={showDisable}
        onOpenChange={setShowDisable}
      />
    </>
  );
}

// =============================================================================
// Change Password Dialog
// =============================================================================

function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showCurrent, setShowCurrent] = React.useState(false);
  const [showNew, setShowNew] = React.useState(false);

  const mutation = useChangePassword();

  const form = useForm<ChangePasswordParams>({
    resolver: zodResolver(changePasswordParamsSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: ChangePasswordParams) => {
    try {
      await mutation.mutateAsync(data);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>
            Enter your current password and a new password
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <Label>Current password</Label>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showCurrent ? "text" : "password"}
                        autoComplete="current-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowCurrent(!showCurrent)}
                        tabIndex={-1}
                      >
                        {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <Label>New password</Label>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNew ? "text" : "password"}
                        autoComplete="new-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowNew(!showNew)}
                        tabIndex={-1}
                      >
                        {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Changing...
                  </>
                ) : (
                  "Change password"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// Disable Lock Dialog
// =============================================================================

function DisableLockDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [showPassword, setShowPassword] = React.useState(false);

  const mutation = useDisableLock();

  const form = useForm<DisableParams>({
    resolver: zodResolver(disableParamsSchema),
    defaultValues: {
      password: "",
    },
  });

  React.useEffect(() => {
    if (!open) {
      form.reset();
    }
  }, [open, form]);

  const onSubmit = async (data: DisableParams) => {
    try {
      await mutation.mutateAsync(data);
      onOpenChange(false);
    } catch {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Disable app lock</DialogTitle>
          <DialogDescription>
            Enter your password to disable app lock. Your data will no longer be
            protected.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <Label>Password</Label>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        {...field}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Disabling...
                  </>
                ) : (
                  "Disable app lock"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

export default LockSettings;
