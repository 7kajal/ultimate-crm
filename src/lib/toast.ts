import { toast } from "@/components/ui/toast"

export function toastSuccess(title: string, description?: string) {
  toast.add({ title, type: "success", description })
}

export function toastError(title: string, description?: string) {
  toast.add({ title, type: "error", description })
}
