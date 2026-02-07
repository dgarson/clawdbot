"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAgents } from "@/hooks/queries/useAgents";
import { useCreateWorkstream } from "@/hooks/mutations/useWorkstreamMutations";
import { Loader2, GitBranch } from "lucide-react";

const createWorkstreamSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
  description: z.string().max(500, "Description is too long").optional(),
  ownerId: z.string().optional(),
});

type CreateWorkstreamFormData = z.infer<typeof createWorkstreamSchema>;

interface CreateWorkstreamModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (workstreamId: string) => void;
}

export function CreateWorkstreamModal({
  open,
  onClose,
  onSuccess,
}: CreateWorkstreamModalProps) {
  const { data: agents = [], isLoading: isLoadingAgents } = useAgents();
  const createWorkstream = useCreateWorkstream();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateWorkstreamFormData>({
    resolver: zodResolver(createWorkstreamSchema),
    defaultValues: {
      name: "",
      description: "",
      ownerId: undefined,
    },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedOwnerId = watch("ownerId");
  const selectedOwner = agents.find((a) => a.id === selectedOwnerId);

  const onSubmit = async (data: CreateWorkstreamFormData) => {
    try {
      const result = await createWorkstream.mutateAsync({
        name: data.name,
        description: data.description,
        ownerId: data.ownerId,
        status: "active",
      });
      reset();
      onClose();
      onSuccess?.(result.id);
    } catch (error) {
      // Error is handled by mutation's onError
      console.error("Failed to create workstream:", error);
    }
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  function getOwnerInitials(name: string): string {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <GitBranch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Create Workstream</DialogTitle>
              <DialogDescription>
                Create a new workstream to organize related tasks
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <input
              id="name"
              type="text"
              placeholder="Enter workstream name..."
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              placeholder="Describe what this workstream is about..."
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-sm text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Owner Agent Selector */}
          <div className="space-y-2">
            <Label htmlFor="owner">Owner Agent (optional)</Label>
            <Select
              value={selectedOwnerId ?? ""}
              onValueChange={(value) => setValue("ownerId", value || undefined)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an owner agent...">
                  {selectedOwner && (
                    <div className="flex items-center gap-2">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={selectedOwner.avatar} />
                        <AvatarFallback className="text-[10px]">
                          {getOwnerInitials(selectedOwner.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{selectedOwner.name}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {isLoadingAgents ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : (
                  agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={agent.avatar} />
                          <AvatarFallback className="text-[10px]">
                            {getOwnerInitials(agent.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{agent.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({agent.role})
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || createWorkstream.isPending}
            >
              {(isSubmitting || createWorkstream.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Workstream
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateWorkstreamModal;
