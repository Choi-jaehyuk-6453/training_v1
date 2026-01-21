import { useState } from "react";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";

interface CardViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  images: string[];
  onComplete: () => void;
  isCompleting?: boolean;
}

export function CardViewer({ 
  open, 
  onOpenChange, 
  title, 
  images, 
  onComplete,
  isCompleting = false 
}: CardViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isLastPage = currentIndex === images.length - 1;
  const progress = ((currentIndex + 1) / images.length) * 100;

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleComplete = () => {
    onComplete();
    setCurrentIndex(0);
  };

  const handleClose = () => {
    setCurrentIndex(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <div className="flex items-center gap-4 mt-2">
            <Progress value={progress} className="flex-1 h-2" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">
              {currentIndex + 1} / {images.length}
            </span>
          </div>
        </DialogHeader>

        <div className="relative flex-1 min-h-[400px] max-h-[60vh] bg-muted/30 flex items-center justify-center p-4">
          {images.length > 0 ? (
            <img
              src={images[currentIndex]}
              alt={`페이지 ${currentIndex + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              data-testid={`card-image-${currentIndex}`}
            />
          ) : (
            <div className="text-muted-foreground">이미지가 없습니다</div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-card">
          <Button
            variant="outline"
            size="lg"
            onClick={handlePrev}
            disabled={currentIndex === 0}
            className="text-lg px-8"
            data-testid="button-prev-card"
          >
            <ChevronLeft className="h-5 w-5 mr-2" />
            이전
          </Button>

          {isLastPage ? (
            <Button
              size="lg"
              onClick={handleComplete}
              disabled={isCompleting}
              className="text-lg px-8 bg-accent hover:bg-accent/90 text-accent-foreground"
              data-testid="button-complete-training"
            >
              <Check className="h-5 w-5 mr-2" />
              {isCompleting ? "처리 중..." : "학습 완료"}
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={handleNext}
              className="text-lg px-8"
              data-testid="button-next-card"
            >
              다음
              <ChevronRight className="h-5 w-5 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
