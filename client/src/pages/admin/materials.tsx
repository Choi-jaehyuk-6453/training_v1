import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  ArrowLeft, 
  Plus, 
  Pencil, 
  Trash2, 
  BookOpen, 
  Video,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { TrainingMaterial } from "@shared/schema";

const MONTHS = [
  "수시", "1월", "2월", "3월", "4월", "5월", "6월", 
  "7월", "8월", "9월", "10월", "11월", "12월"
];

const materialSchema = z.object({
  title: z.string().min(1, "제목을 입력해주세요"),
  description: z.string().optional(),
  type: z.enum(["card", "video"]),
  month: z.string().default("수시"),
  videoUrl: z.string().optional(),
  cardImages: z.array(z.string()).optional(),
});

type MaterialForm = z.infer<typeof materialSchema>;

export default function AdminMaterials() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<TrainingMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<TrainingMaterial | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const { data: materials = [], isLoading } = useQuery<TrainingMaterial[]>({
    queryKey: ["/api/training-materials"],
  });

  const form = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "card",
      month: "수시",
      videoUrl: "",
      cardImages: [],
    },
  });

  const materialType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: MaterialForm) => {
      await apiRequest("POST", "/api/training-materials", {
        ...data,
        cardImages: materialType === "card" ? uploadedImages : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-materials"] });
      setDialogOpen(false);
      setUploadedImages([]);
      form.reset();
      toast({ title: "성공", description: "교육 자료가 등록되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "등록에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: MaterialForm) => {
      await apiRequest("PATCH", `/api/training-materials/${editingMaterial?.id}`, {
        ...data,
        cardImages: materialType === "card" ? uploadedImages : [],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-materials"] });
      setDialogOpen(false);
      setEditingMaterial(null);
      setUploadedImages([]);
      form.reset();
      toast({ title: "성공", description: "교육 자료가 수정되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/training-materials/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-materials"] });
      setDeleteDialogOpen(false);
      setDeletingMaterial(null);
      toast({ title: "성공", description: "교육 자료가 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const newImages: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const res = await fetch("/api/uploads/request-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: file.name,
            size: file.size,
            contentType: file.type,
          }),
        });

        if (!res.ok) throw new Error("Failed to get upload URL");

        const { uploadURL, objectPath } = await res.json();

        await fetch(uploadURL, {
          method: "PUT",
          body: file,
          headers: { "Content-Type": file.type },
        });

        newImages.push(objectPath);
      } catch (error) {
        console.error("Upload error:", error);
        toast({ title: "오류", description: `${file.name} 업로드에 실패했습니다.`, variant: "destructive" });
      }
    }

    setUploadedImages((prev) => [...prev, ...newImages]);
    setIsUploading(false);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
  };

  const openCreateDialog = () => {
    setEditingMaterial(null);
    setUploadedImages([]);
    form.reset({
      title: "",
      description: "",
      type: "card",
      month: "수시",
      videoUrl: "",
      cardImages: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (material: TrainingMaterial) => {
    setEditingMaterial(material);
    setUploadedImages(material.cardImages || []);
    form.reset({
      title: material.title,
      description: material.description || "",
      type: material.type,
      month: material.month || "수시",
      videoUrl: material.videoUrl || "",
      cardImages: material.cardImages || [],
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: MaterialForm) => {
    if (editingMaterial) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <CompanyLogo company="mirae_abm" className="h-10" />
          </div>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">교육 자료 관리</h1>
            <p className="text-muted-foreground text-lg">
              카드형 및 동영상 교육 자료를 관리합니다
            </p>
          </div>
          <Button 
            size="lg" 
            onClick={openCreateDialog}
            className="text-lg"
            data-testid="button-add-material"
          >
            <Plus className="h-5 w-5 mr-2" />
            자료 추가
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : materials.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">등록된 교육 자료가 없습니다</p>
            <Button onClick={openCreateDialog} data-testid="button-add-first-material">
              <Plus className="h-5 w-5 mr-2" />
              첫 번째 자료 추가하기
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {materials.map((material) => (
              <Card key={material.id} className="relative" data-testid={`material-card-${material.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {material.type === "card" ? (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                          <Video className="h-5 w-5 text-accent" />
                        </div>
                      )}
                      <Badge variant="secondary">
                        {material.type === "card" ? "카드형" : "동영상"}
                      </Badge>
                      <Badge variant="outline">
                        {material.month || "수시"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(material)}
                        data-testid={`button-edit-${material.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingMaterial(material);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-${material.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-xl mb-2 line-clamp-2">{material.title}</CardTitle>
                  {material.description && (
                    <CardDescription className="line-clamp-2 text-base">
                      {material.description}
                    </CardDescription>
                  )}
                  <div className="mt-4 text-sm text-muted-foreground">
                    {material.type === "card" && material.cardImages && (
                      <span>{material.cardImages.length}장의 이미지</span>
                    )}
                    {material.type === "video" && material.videoUrl && (
                      <span className="truncate block">URL: {material.videoUrl}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date(material.createdAt).toLocaleDateString("ko-KR")} 등록
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingMaterial ? "교육 자료 수정" : "교육 자료 추가"}
            </DialogTitle>
            <DialogDescription>
              {editingMaterial ? "교육 자료 정보를 수정합니다" : "새로운 교육 자료를 등록합니다"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">자료 유형</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base" data-testid="select-type">
                            <SelectValue placeholder="유형 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="card">카드형 (이미지)</SelectItem>
                          <SelectItem value="video">동영상 (URL)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">제공 시기</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base" data-testid="select-month">
                            <SelectValue placeholder="제공 시기 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {MONTHS.map((m) => (
                            <SelectItem key={m} value={m}>{m}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">제목</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="교육 자료 제목" 
                        className="h-12 text-base"
                        data-testid="input-title"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">설명 (선택)</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="교육 자료에 대한 간단한 설명"
                        className="text-base min-h-20"
                        data-testid="input-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {materialType === "video" && (
                <FormField
                  control={form.control}
                  name="videoUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-base">동영상 URL</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          placeholder="https://www.youtube.com/watch?v=..." 
                          className="h-12 text-base"
                          data-testid="input-video-url"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {materialType === "card" && (
                <div className="space-y-4">
                  <FormLabel className="text-base">카드 이미지</FormLabel>
                  
                  <div className="flex flex-wrap gap-3">
                    {uploadedImages.map((img, idx) => (
                      <div key={idx} className="relative w-24 h-24 bg-muted rounded-lg overflow-hidden">
                        <img 
                          src={img} 
                          alt={`카드 ${idx + 1}`} 
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          className="absolute top-1 right-1 w-6 h-6 bg-destructive text-white rounded-full flex items-center justify-center"
                          onClick={() => removeImage(idx)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <span className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                          {idx + 1}
                        </span>
                      </div>
                    ))}
                    
                    <label className="w-24 h-24 border-2 border-dashed rounded-lg flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">
                        {isUploading ? "업로드 중..." : "이미지 추가"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        data-testid="input-upload-images"
                      />
                    </label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    이미지를 순서대로 업로드해주세요. 경비원은 이 순서대로 카드를 넘기며 학습합니다.
                  </p>
                </div>
              )}

              <DialogFooter className="gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="h-12"
                  data-testid="button-cancel"
                >
                  취소
                </Button>
                <Button 
                  type="submit" 
                  className="h-12"
                  disabled={createMutation.isPending || updateMutation.isPending || isUploading}
                  data-testid="button-submit"
                >
                  {(createMutation.isPending || updateMutation.isPending) ? "저장 중..." : "저장"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>교육 자료 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingMaterial?.title}" 자료를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMaterial && deleteMutation.mutate(deletingMaterial.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
