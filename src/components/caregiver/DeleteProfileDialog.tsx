import { useState } from "react";
import { Trash2 } from "lucide-react";
import { ServerError } from "@/components/auth/ServerError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const GENERIC_ERROR = "Nie udało się usunąć profilu. Spróbuj ponownie.";

interface ErrorResponse {
  error?: string;
}

const outlineDangerClass =
  "rounded-lg border-red-400/50 bg-transparent text-red-200 hover:bg-red-900/30 hover:text-red-100 dark:bg-transparent";

export default function DeleteProfileDialog() {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(next: boolean) {
    // While the request runs the dialog stays open (Esc and the close icon included).
    if (deleting) return;
    setOpen(next);
    if (next) setError(null);
  }

  async function handleDelete() {
    setError(null);
    setDeleting(true);
    try {
      const response = await fetch("/api/caregiver/profile", { method: "DELETE" });

      if (response.ok) {
        window.location.assign("/profil?usunieto=1");
        return;
      }
      if (response.status === 404) {
        // The profile was already gone (e.g. deleted in another tab).
        window.location.assign("/profil");
        return;
      }
      if (response.status === 401) {
        window.location.assign("/auth/signin");
        return;
      }
      const body = (await response.json().catch(() => ({}))) as ErrorResponse;
      setError(body.error ?? GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    }
    setDeleting(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className={outlineDangerClass}>
          <Trash2 className="size-4" />
          Usuń profil
        </Button>
      </DialogTrigger>
      <DialogContent className="border-white/10 bg-[#0f1529] text-white">
        <DialogHeader>
          <DialogTitle>Usunąć profil na zawsze?</DialogTitle>
          <DialogDescription className="space-y-2 text-blue-100/80">
            <span className="block">
              Profil, dane kontaktowe, gminy, usługi i dostępność zostaną trwale usunięte, a koordynatorzy przestaną
              widzieć Twój profil. Tej operacji nie można cofnąć.
            </span>
            <span className="block">Konto logowania zostaje — później możesz założyć nowy profil.</span>
          </DialogDescription>
        </DialogHeader>

        <ServerError message={error} />

        <DialogFooter>
          <DialogClose asChild>
            <Button
              variant="outline"
              disabled={deleting}
              className="rounded-lg border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white dark:bg-white/10"
            >
              Anuluj
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={deleting}
            onClick={() => void handleDelete()}
            className={cn("rounded-lg bg-red-600 text-white hover:bg-red-500", deleting && "cursor-wait")}
          >
            {deleting ? (
              <span className="flex items-center gap-2">
                <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Usuwanie…
              </span>
            ) : (
              "Usuń na zawsze"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
