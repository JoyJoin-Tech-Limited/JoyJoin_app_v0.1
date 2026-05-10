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

interface VenueEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: VenueFormData;
  setFormData: React.Dispatch<React.SetStateAction<VenueFormData>>;
  onSubmit: () => void;
  isPending: boolean;
  setShowMapPicker: (open: boolean) => void;
}

export default function VenueEditDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  isPending,
  setShowMapPicker,
}: VenueEditDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑场地</DialogTitle>
          <DialogDescription>修改场地信息</DialogDescription>
        </DialogHeader>

        <VenueFormFields
          formData={formData}
          setFormData={setFormData}
          setShowMapPicker={setShowMapPicker}
          mode="edit"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-edit">
            取消
          </Button>
          <Button onClick={onSubmit} disabled={isPending} data-testid="button-submit-edit">
            {isPending ? "更新中..." : "更新场地"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
