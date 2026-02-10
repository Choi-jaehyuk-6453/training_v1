import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  BookOpen,
  Video,
  Upload,
  X,
  Calendar,
  Music,
  CheckSquare,
  PlusCircle,
  MinusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
  videoUrls: z.array(z.string()).optional(),
  cardImages: z.array(z.string()).optional(),
  audioUrls: z.array(z.string()).optional(),
  quizzes: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()),
    answer: z.number()
  })).optional()
});

type MaterialForm = z.infer<typeof materialSchema>;

export default function AdminMaterials() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<TrainingMaterial | null>(null);
  const [deletingMaterial, setDeletingMaterial] = useState<TrainingMaterial | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedAudios, setUploadedAudios] = useState<string[]>([]);
  const [quizzes, setQuizzes] = useState<{ question: string; options: string[]; answer: number; }[]>([]);
  const [videoUrls, setVideoUrls] = useState<string[]>([]);
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [selectedMonthFilter, setSelectedMonthFilter] = useState<string>("all");

  const { data: materials = [], isLoading } = useQuery<TrainingMaterial[]>({
    queryKey: ["/api/training-materials"],
  });

  const filteredMaterials = useMemo(() => {
    if (selectedMonthFilter === "all") return materials;

    return materials.filter((m) => {
      // 월별 자료는 해당 월과 일치하면 표시
      if (m.month === selectedMonthFilter) return true;

      // 수시 자료는 등록 날짜(createdAt)의 월과 일치하면 표시
      if (m.month === "수시" && m.createdAt) {
        const createdMonth = new Date(m.createdAt).getMonth() + 1;
        const filterMonth = parseInt(selectedMonthFilter.replace("월", ""));
        return createdMonth === filterMonth;
      }

      return false;
    });
  }, [materials, selectedMonthFilter]);

  const form = useForm<MaterialForm>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "card",
      month: "수시",
      videoUrl: "",
      videoUrls: [],
      cardImages: [],
      audioUrls: [],
      quizzes: [],
    },
  });

  const materialType = form.watch("type");

  const createMutation = useMutation({
    mutationFn: async (data: MaterialForm) => {
      await apiRequest("POST", "/api/training-materials", {
        ...data,
        cardImages: materialType === "card" ? uploadedImages : [],
        audioUrls: materialType === "card" ? uploadedAudios : [],
        quizzes: quizzes,
        videoUrls: materialType === "video" ? videoUrls : [],
        videoUrl: materialType === "video" && videoUrls.length > 0 ? videoUrls[0] : data.videoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-materials"] });
      setDialogOpen(false);
      setUploadedImages([]);
      setVideoUrls([]);
      setNewVideoUrl("");
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
        audioUrls: materialType === "card" ? uploadedAudios : [],
        quizzes: quizzes,
        videoUrls: materialType === "video" ? videoUrls : [],
        videoUrl: materialType === "video" && videoUrls.length > 0 ? videoUrls[0] : data.videoUrl,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-materials"] });
      setDialogOpen(false);
      setEditingMaterial(null);
      setUploadedImages([]);
      setVideoUrls([]);
      setNewVideoUrl("");
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

  // Handle multiple image uploads with drag & drop support
  const processFiles = async (files: File[]) => {
    setIsUploading(true);

    // Split files
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));

    // Sort by name (numeric aware)
    imageFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    audioFiles.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

    const newImages: string[] = [];
    const newAudios: string[] = [];

    // Helper to upload a single file
    const uploadFile = async (file: File) => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        // 1. Get Signed URL
        const signedUrlRes = await fetch("/api/upload/signed-url", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            fileType: file.type,
            bucket: "uploads"
          })
        });

        if (!signedUrlRes.ok) {
          const err = await signedUrlRes.json();
          throw new Error(err.message || "Failed to get upload URL");
        }

        const { signedUrl, publicUrl } = await signedUrlRes.json();

        // 2. Upload to Supabase Storage directly (bypassing server limit)
        const uploadRes = await fetch(signedUrl, {
          method: "PUT",
          headers: {
            "Content-Type": file.type,
          },
          body: file,
        });

        if (!uploadRes.ok) {
          throw new Error(`Storage upload failed: ${uploadRes.statusText}`);
        }

        return publicUrl;
      } catch (error: any) {
        console.error("Upload error:", error);
        let msg = error.message || "알 수 없는 오류";
        if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
          msg += " (서버 연결 실패. Supabase CORS 설정을 확인해주세요.)";
        }
        toast({
          title: "업로드 실패",
          description: `${file.name}: ${msg}`,
          variant: "destructive",
          duration: 5000
        });
        return null;
      }
    };

    // Upload Images
    for (const file of imageFiles) {
      const path = await uploadFile(file);
      if (path) newImages.push(path);
    }

    // Upload Audios
    for (const file of audioFiles) {
      const path = await uploadFile(file);
      if (path) newAudios.push(path);
    }

    if (newImages.length > 0) {
      setUploadedImages((prev) => [...prev, ...newImages]);

      // Determine audio slots
      // 1. Extend existing audios with empty strings for new images
      // 2. Fill these new slots with uploaded audios in order
      setUploadedAudios((prev) => {
        const next = [...prev, ...new Array(newImages.length).fill("")];

        // Start filling from the index where new images begin
        const startIndex = prev.length;

        newAudios.forEach((audioPath, idx) => {
          if (startIndex + idx < next.length) {
            next[startIndex + idx] = audioPath;
          }
        });

        return next;
      });
    } else if (newAudios.length > 0) {
      setUploadedAudios((prev) => {
        const next = [...prev];
        let audioIdx = 0;

        for (let i = 0; i < next.length && audioIdx < newAudios.length; i++) {
          if (!next[i]) {
            next[i] = newAudios[audioIdx++];
          }
        }
        return next;
      });
    }

    setIsUploading(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
      e.target.value = ""; // Reset input
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleAudioUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Get Signed URL
      const signedUrlRes = await fetch("/api/upload/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileType: file.type,
          bucket: "uploads"
        })
      });

      if (!signedUrlRes.ok) {
        const err = await signedUrlRes.json();
        throw new Error(err.message || "Failed to get upload URL");
      }

      const { signedUrl, publicUrl } = await signedUrlRes.json();

      // 2. Upload to Supabase Storage directly
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Storage upload failed: ${uploadRes.statusText}`);
      }

      setUploadedAudios((prev) => {
        const newAudios = [...prev];
        // Ensure array is large enough
        while (newAudios.length <= index) {
          newAudios.push("");
        }
        newAudios[index] = publicUrl;
        return newAudios;
      });
    } catch (error: any) {
      console.error("Upload error:", error);
      let msg = error.message || "알 수 없는 오류";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg += " (서버 연결 실패. Supabase CORS 설정을 확인해주세요.)";
      }
      toast({ title: "오류", description: "오디오 업로드 실패: " + msg, variant: "destructive" });
    }
    setIsUploading(false);
    e.target.value = "";
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // 1. Get Signed URL
      const signedUrlRes = await fetch("/api/upload/signed-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          fileType: file.type,
          bucket: "uploads"
        })
      });

      if (!signedUrlRes.ok) {
        const err = await signedUrlRes.json();
        throw new Error(err.message || "Failed to get upload URL");
      }

      const { signedUrl, publicUrl } = await signedUrlRes.json();

      // 2. Upload to Supabase Storage directly
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type,
        },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Storage upload failed: ${uploadRes.statusText}`);
      }

      setVideoUrls((prev) => [...prev, publicUrl]);
      toast({ title: "성공", description: "동영상이 업로드되었습니다." });
    } catch (error: any) {
      console.error("Video upload error:", error);
      let msg = error.message || "알 수 없는 오류";
      if (msg.includes("Failed to fetch") || msg.includes("NetworkError")) {
        msg += " (서버 연결 실패. Supabase CORS 설정을 확인해주세요.)";
      }
      toast({ title: "오류", description: "동영상 업로드 실패: " + msg, variant: "destructive" });
    }
    setIsUploading(false);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setUploadedAudios((prev) => prev.filter((_, i) => i !== index));
  };

  const addVideoUrl = () => {
    if (newVideoUrl.trim()) {
      setVideoUrls((prev) => [...prev, newVideoUrl.trim()]);
      setNewVideoUrl("");
    }
  };

  const removeVideoUrl = (index: number) => {
    setVideoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const openCreateDialog = () => {
    setEditingMaterial(null);
    setUploadedImages([]);
    setUploadedAudios([]);
    setVideoUrls([]);
    setQuizzes([]);
    setNewVideoUrl("");
    form.reset({
      title: "",
      description: "",
      type: "card",
      month: "수시",
      videoUrl: "",
      videoUrls: [],
      cardImages: [],
      audioUrls: [],
      quizzes: [],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (material: TrainingMaterial) => {
    setEditingMaterial(material);
    setUploadedImages(material.cardImages || []);
    setUploadedAudios(material.audioUrls || []);
    setQuizzes((material.quizzes as any) || []);
    setVideoUrls(material.videoUrls || (material.videoUrl ? [material.videoUrl] : []));
    setNewVideoUrl("");
    form.reset({
      title: material.title,
      description: material.description || "",
      type: material.type,
      month: material.month || "수시",
      videoUrl: material.videoUrl || "",
      videoUrls: material.videoUrls || [],
      cardImages: material.cardImages || [],
      audioUrls: material.audioUrls || [],
      quizzes: (material.quizzes as any) || [],
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

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-primary" />
                <span className="font-medium text-lg">월별 조회:</span>
              </div>
              <Select value={selectedMonthFilter} onValueChange={setSelectedMonthFilter}>
                <SelectTrigger className="w-[200px] h-12 text-base" data-testid="select-month-filter">
                  <SelectValue placeholder="월 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체</SelectItem>
                  {MONTHS.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-muted-foreground">
                총 {filteredMaterials.length}개
              </span>
            </div>
          </CardContent>
        </Card>

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
        ) : filteredMaterials.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-lg">선택한 월에 등록된 교육 자료가 없습니다</p>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMaterials.map((material) => (
              <Card key={material.id} className="relative" data-testid={`material-card-${material.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {material.type === "card" ? (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                          <Video className="h-5 w-5 text-red-600" />
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
                <div className="space-y-4">
                  <FormLabel className="text-base">동영상 URL 목록</FormLabel>

                  {videoUrls.length > 0 && (
                    <div className="space-y-2">
                      {videoUrls.map((url, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 p-3 bg-muted/30 rounded-lg"
                          data-testid={`video-url-item-${idx}`}
                        >
                          <Video className="h-4 w-4 text-accent shrink-0" />
                          <span className="flex-1 text-sm truncate">{url}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeVideoUrl(idx)}
                            data-testid={`button-remove-video-${idx}`}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 items-start">
                    <div className="flex-1 flex gap-2">
                      <Input
                        value={newVideoUrl}
                        onChange={(e) => setNewVideoUrl(e.target.value)}
                        placeholder="유튜브 링크 (https://...)"
                        className="h-12 text-base flex-1"
                        data-testid="input-video-url"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addVideoUrl();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        onClick={addVideoUrl}
                        className="h-12 px-4"
                        disabled={!newVideoUrl.trim()}
                        data-testid="button-add-video-url"
                        variant="secondary"
                      >
                        <Plus className="h-5 w-5 mr-1" />
                        URL 추가
                      </Button>
                    </div>

                    <div className="h-12 w-[1px] bg-border mx-1" />

                    <label className="cursor-pointer">
                      <div className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center rounded-md text-sm font-medium transition-colors shadow-sm">
                        {isUploading ? (
                          "업로드 중..."
                        ) : (
                          <>
                            <Upload className="h-5 w-5 mr-2" />
                            영상 파일 업로드
                          </>
                        )}
                      </div>
                      <input
                        type="file"
                        accept="video/mp4,video/webm"
                        className="hidden"
                        disabled={isUploading}
                        onChange={handleVideoUpload}
                      />
                    </label>
                  </div>
                </div>
              )}

              {/* Card Images logic omitted for strict brevity compliance if needed, but here included fully */}
              {materialType === "card" && (
                <div className="space-y-4">
                  <FormLabel className="text-base">카드 이미지 및 오디오</FormLabel>
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isUploading ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary"
                      }`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                      <p className="text-lg font-medium">이미지와 오디오를 드래그하여 놓으세요</p>
                      <p className="text-sm text-muted-foreground mb-4">또는 아래 버튼을 클릭하여 선택하세요</p>
                      <label className="cursor-pointer">
                        <div className="h-12 px-6 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center rounded-md text-sm font-medium transition-colors shadow-sm">
                          파일 선택
                        </div>
                        <input
                          type="file"
                          multiple
                          accept="image/*,audio/*"
                          className="hidden"
                          disabled={isUploading}
                          onChange={handleFileUpload}
                        />
                      </label>
                    </div>
                  </div>

                  {uploadedImages.length > 0 && (
                    <div className="space-y-4 mt-6">
                      {uploadedImages.map((img, idx) => (
                        <div key={idx} className="flex gap-4 p-4 border rounded-lg bg-card shadow-sm items-start">
                          <div className="w-24 h-24 shrink-0 rounded-md overflow-hidden bg-muted">
                            <img src={img} alt={`Slide ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="font-medium">페이지 {idx + 1}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => removeImage(idx)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-3">
                              {uploadedAudios[idx] ? (
                                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded w-full">
                                  <Music className="h-4 w-4 shrink-0" />
                                  <span className="truncate flex-1">오디오 파일 등록됨</span>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 shrink-0"
                                    onClick={() => {
                                      const newAudios = [...uploadedAudios];
                                      newAudios[idx] = "";
                                      setUploadedAudios(newAudios);
                                    }}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2 w-full">
                                  <label className="cursor-pointer flex-1">
                                    <div className="flex items-center justify-center gap-2 h-9 px-3 rounded text-sm border hover:bg-muted transition-colors w-full">
                                      <PlusCircle className="h-4 w-4" />
                                      오디오 추가
                                    </div>
                                    <input
                                      type="file"
                                      accept="audio/*"
                                      className="hidden"
                                      onChange={(e) => handleAudioUpload(idx, e)}
                                      disabled={isUploading}
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Quiz Settings */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <FormLabel className="text-base">퀴즈 설정 (선택)</FormLabel>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setQuizzes([...quizzes, { question: "", options: ["O", "X"], answer: 0 }])}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    퀴즈 추가
                  </Button>
                </div>
                {quizzes.map((quiz, quizIdx) => (
                  <Card key={quizIdx} className="p-4 relative">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 text-destructive"
                      onClick={() => setQuizzes(quizzes.filter((_, i) => i !== quizIdx))}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>문제 {quizIdx + 1}</Label>
                        <Input
                          value={quiz.question}
                          onChange={(e) => {
                            const newQuizzes = [...quizzes];
                            newQuizzes[quizIdx].question = e.target.value;
                            setQuizzes(newQuizzes);
                          }}
                          placeholder="문제를 입력하세요"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>정답 (보기 {quiz.answer + 1})</Label>
                        <RadioGroup
                          value={quiz.answer.toString()}
                          onValueChange={(val) => {
                            const newQuizzes = [...quizzes];
                            newQuizzes[quizIdx].answer = parseInt(val);
                            setQuizzes(newQuizzes);
                          }}
                        >
                          {quiz.options.map((opt, optIdx) => (
                            <div key={optIdx} className="flex items-center gap-2">
                              <div className="flex items-center gap-2 flex-1">
                                <RadioGroupItem value={optIdx.toString()} id={`q${quizIdx}-o${optIdx}`} />
                                <Input
                                  value={opt}
                                  onChange={(e) => {
                                    const newQuizzes = [...quizzes];
                                    newQuizzes[quizIdx].options[optIdx] = e.target.value;
                                    setQuizzes(newQuizzes);
                                  }}
                                  className="h-8"
                                />
                              </div>
                              {quiz.options.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => {
                                    const newQuizzes = [...quizzes];
                                    newQuizzes[quizIdx].options = newQuizzes[quizIdx].options.filter((_, i) => i !== optIdx);
                                    setQuizzes(newQuizzes);
                                  }}
                                >
                                  <MinusCircle className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          ))}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => {
                              const newQuizzes = [...quizzes];
                              newQuizzes[quizIdx].options.push("");
                              setQuizzes(newQuizzes);
                            }}
                          >
                            <PlusCircle className="h-4 w-4 mr-2" />
                            보기 추가
                          </Button>
                        </RadioGroup>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  취소
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingMaterial ? "수정 저장" : "등록"}
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
              정말 이 교육 자료를 삭제하시겠습니까? 관련 교육 이수 기록도 모두 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deletingMaterial) {
                  deleteMutation.mutate(deletingMaterial.id);
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
