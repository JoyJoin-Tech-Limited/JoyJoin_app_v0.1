import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import VenueFormFields from "./VenueFormFields";
import { VenueFormData } from "./venueConstants";

interface VenueCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: VenueFormData;
  setFormData: React.Dispatch<React.SetStateAction<VenueFormData>>;
  onSubmit: () => void;
  onCancel: () => void;
  isPending: boolean;
  setShowMapPicker: (open: boolean) => void;
}

export default function VenueCreateDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isPending,
  setShowMapPicker,
}: VenueCreateDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加场地</DialogTitle>
          <DialogDescription>创建新的活动场地</DialogDescription>
        </DialogHeader>

        <VenueFormFields
          formData={formData}
          setFormData={setFormData}
          setShowMapPicker={setShowMapPicker}
          mode="create"
        />

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} data-testid="button-cancel">
            取消
          </Button>
          <Button onClick={onSubmit} disabled={isPending} data-testid="button-submit-venue">
            {isPending ? "创建中..." : "创建场地"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
