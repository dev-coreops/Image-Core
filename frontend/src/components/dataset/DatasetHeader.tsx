"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useDatasetStore } from "@/stores/useDatasetStore";
import { toast } from "sonner";
import type { Dataset } from "@/types/dataset";

const STATUS_COLORS: Record<string, string> = {
  created: "bg-gray-100 text-gray-700",
  uploading: "bg-blue-100 text-blue-700",
  uploaded: "bg-blue-100 text-blue-700",
  preprocessing: "bg-yellow-100 text-yellow-700",
  preprocessed: "bg-green-100 text-green-700",
  labeling: "bg-purple-100 text-purple-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export function DatasetHeader({ dataset }: { dataset: Dataset }) {
  const router = useRouter();
  const { deleteDataset } = useDatasetStore();

  const handleDelete = async () => {
    try {
      await deleteDataset(dataset.id);
      toast.success("Dataset deleted");
      router.push("/datasets");
    } catch {
      toast.error("Failed to delete dataset");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="ghost" size="icon" asChild className="shrink-0">
        <Link href="/datasets">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold truncate">{dataset.name}</h1>
          <Badge className={STATUS_COLORS[dataset.status] || ""}>{dataset.status}</Badge>
        </div>
        {dataset.description && (
          <p className="text-muted-foreground text-sm mt-0.5 truncate">{dataset.description}</p>
        )}
      </div>
      <AlertDialog>
        <AlertDialogTrigger className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-destructive px-3 py-1.5 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 cursor-pointer">
          <Trash2 className="h-4 w-4" />
          Delete
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete dataset?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{dataset.name}&quot; and all its images. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
