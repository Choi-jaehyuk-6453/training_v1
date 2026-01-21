import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { LogOut, BookOpen, Video, Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { CompanyLogo } from "@/components/CompanyLogo";
import { NotificationBadge } from "@/components/NotificationBadge";
import { CardViewer } from "@/components/CardViewer";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { TrainingMaterial, TrainingRecord } from "@shared/schema";

export default function GuardDashboard() {
  const [, navigate] = useLocation();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [selectedMaterial, setSelectedMaterial] = useState<TrainingMaterial | null>(null);
  const [cardViewerOpen, setCardViewerOpen] = useState(false);

  const { data: materials = [], isLoading: materialsLoading } = useQuery<TrainingMaterial[]>({
    queryKey: ["/api/training-materials"],
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/training-records/my"],
  });

  const completedMaterialIds = new Set(records.map((r) => r.materialId));

  const recordTrainingMutation = useMutation({
    mutationFn: async (material: TrainingMaterial) => {
      await apiRequest("POST", "/api/training-records", {
        materialId: material.id,
        materialType: material.type,
        materialTitle: material.title,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-records/my"] });
      setCardViewerOpen(false);
      setSelectedMaterial(null);
      toast({
        title: "학습 완료",
        description: "교육 이수가 기록되었습니다.",
      });
    },
    onError: () => {
      toast({
        title: "오류",
        description: "기록 저장에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleMaterialClick = (material: TrainingMaterial) => {
    if (material.type === "video" && material.videoUrl) {
      window.open(material.videoUrl, "_blank");
      if (!completedMaterialIds.has(material.id)) {
        recordTrainingMutation.mutate(material);
      }
    } else if (material.type === "card" && material.cardImages && material.cardImages.length > 0) {
      setSelectedMaterial(material);
      setCardViewerOpen(true);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const cardMaterials = materials.filter((m) => m.type === "card");
  const videoMaterials = materials.filter((m) => m.type === "video");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <CompanyLogo company={user?.company} className="h-10" />
          
          <div className="flex items-center gap-4">
            <NotificationBadge />
            <div className="hidden sm:block text-right">
              <p className="font-medium text-lg">{user?.name}</p>
              <p className="text-sm text-muted-foreground">경비원</p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">교육 자료</h1>
          <p className="text-muted-foreground text-lg">
            아래 자료를 클릭하여 교육을 이수하세요
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{cardMaterials.length}</p>
                <p className="text-sm text-muted-foreground">카드형 자료</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <Video className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">{videoMaterials.length}</p>
                <p className="text-sm text-muted-foreground">동영상 자료</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedMaterialIds.size}</p>
                <p className="text-sm text-muted-foreground">이수 완료</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Clock className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{materials.length - completedMaterialIds.size}</p>
                <p className="text-sm text-muted-foreground">미이수</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="all" className="space-y-6">
          <TabsList className="h-14">
            <TabsTrigger value="all" className="text-lg px-6 h-12">전체</TabsTrigger>
            <TabsTrigger value="card" className="text-lg px-6 h-12">카드형</TabsTrigger>
            <TabsTrigger value="video" className="text-lg px-6 h-12">동영상</TabsTrigger>
            <TabsTrigger value="history" className="text-lg px-6 h-12">내 이력</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            <MaterialList 
              materials={materials} 
              isLoading={materialsLoading}
              completedIds={completedMaterialIds}
              onMaterialClick={handleMaterialClick}
            />
          </TabsContent>

          <TabsContent value="card" className="space-y-4">
            <MaterialList 
              materials={cardMaterials} 
              isLoading={materialsLoading}
              completedIds={completedMaterialIds}
              onMaterialClick={handleMaterialClick}
            />
          </TabsContent>

          <TabsContent value="video" className="space-y-4">
            <MaterialList 
              materials={videoMaterials} 
              isLoading={materialsLoading}
              completedIds={completedMaterialIds}
              onMaterialClick={handleMaterialClick}
            />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">내 교육 이력</CardTitle>
                <CardDescription>
                  이수한 교육 자료 목록입니다
                </CardDescription>
              </CardHeader>
              <CardContent>
                {recordsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : records.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    아직 이수한 교육이 없습니다
                  </div>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-3">
                      {records.map((record) => (
                        <div
                          key={record.id}
                          className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                          data-testid={`record-item-${record.id}`}
                        >
                          <div className="flex items-center gap-4">
                            {record.materialType === "card" ? (
                              <BookOpen className="h-5 w-5 text-primary" />
                            ) : (
                              <Video className="h-5 w-5 text-accent" />
                            )}
                            <div>
                              <p className="font-medium">{record.materialTitle}</p>
                              <p className="text-sm text-muted-foreground">
                                {record.materialType === "card" ? "카드형" : "동영상"}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {new Date(record.completedAt).toLocaleDateString("ko-KR")}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {new Date(record.completedAt).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {selectedMaterial && (
        <CardViewer
          open={cardViewerOpen}
          onOpenChange={setCardViewerOpen}
          title={selectedMaterial.title}
          images={selectedMaterial.cardImages || []}
          onComplete={() => {
            if (!completedMaterialIds.has(selectedMaterial.id)) {
              recordTrainingMutation.mutate(selectedMaterial);
            } else {
              setCardViewerOpen(false);
              setSelectedMaterial(null);
            }
          }}
          isCompleting={recordTrainingMutation.isPending}
        />
      )}
    </div>
  );
}

interface MaterialListProps {
  materials: TrainingMaterial[];
  isLoading: boolean;
  completedIds: Set<string>;
  onMaterialClick: (material: TrainingMaterial) => void;
}

function MaterialList({ materials, isLoading, completedIds, onMaterialClick }: MaterialListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    );
  }

  if (materials.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground text-lg">등록된 교육 자료가 없습니다</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {materials.map((material) => {
        const isCompleted = completedIds.has(material.id);
        return (
          <Card
            key={material.id}
            className="cursor-pointer hover-elevate active-elevate-2 relative overflow-visible"
            onClick={() => onMaterialClick(material)}
            data-testid={`material-card-${material.id}`}
          >
            {isCompleted && (
              <Badge className="absolute -top-2 -right-2 bg-green-500 text-white">
                <CheckCircle className="h-3 w-3 mr-1" />
                이수완료
              </Badge>
            )}
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
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
              </div>
            </CardHeader>
            <CardContent>
              <CardTitle className="text-xl mb-2 line-clamp-2">{material.title}</CardTitle>
              {material.description && (
                <CardDescription className="line-clamp-2 text-base">
                  {material.description}
                </CardDescription>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                {new Date(material.createdAt).toLocaleDateString("ko-KR")} 등록
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
