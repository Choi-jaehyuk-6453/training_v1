import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Pencil, Trash2, User, Phone, MapPin, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  FormDescription,
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
import type { User as GuardUser, Site } from "@shared/schema";

const guardSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  phone: z.string().min(4, "전화번호를 입력해주세요"),
  company: z.enum(["mirae_abm", "dawon_pmc"]),
  siteId: z.string().optional(),
});

type GuardForm = z.infer<typeof guardSchema>;

interface GuardWithSite extends GuardUser {
  site?: Site;
}

export default function AdminGuards() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingGuard, setEditingGuard] = useState<GuardWithSite | null>(null);
  const [deletingGuard, setDeletingGuard] = useState<GuardWithSite | null>(null);

  const { data: guards = [], isLoading } = useQuery<GuardWithSite[]>({
    queryKey: ["/api/guards"],
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const form = useForm<GuardForm>({
    resolver: zodResolver(guardSchema),
    defaultValues: {
      name: "",
      phone: "",
      company: "mirae_abm",
      siteId: "",
    },
  });

  const selectedCompany = form.watch("company");
  const filteredSites = sites.filter((site) => site.company === selectedCompany);

  const guardsBySite = useMemo(() => {
    const grouped: Record<string, GuardWithSite[]> = {};
    
    guards.forEach((guard) => {
      const siteId = guard.siteId || "unassigned";
      if (!grouped[siteId]) {
        grouped[siteId] = [];
      }
      grouped[siteId].push(guard);
    });
    
    return grouped;
  }, [guards]);

  const createMutation = useMutation({
    mutationFn: async (data: GuardForm) => {
      const password = data.phone.slice(-4);
      await apiRequest("POST", "/api/guards", {
        username: data.name,
        password,
        name: data.name,
        phone: data.phone,
        company: data.company,
        siteId: data.siteId || null,
        role: "guard",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "성공", description: "경비원이 등록되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "등록에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: GuardForm) => {
      const password = data.phone.slice(-4);
      await apiRequest("PATCH", `/api/guards/${editingGuard?.id}`, {
        username: data.name,
        password,
        name: data.name,
        phone: data.phone,
        company: data.company,
        siteId: data.siteId || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      setDialogOpen(false);
      setEditingGuard(null);
      form.reset();
      toast({ title: "성공", description: "경비원 정보가 수정되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/guards/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      setDeleteDialogOpen(false);
      setDeletingGuard(null);
      toast({ title: "성공", description: "경비원이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingGuard(null);
    form.reset({
      name: "",
      phone: "",
      company: "mirae_abm",
      siteId: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (guard: GuardWithSite) => {
    setEditingGuard(guard);
    form.reset({
      name: guard.name,
      phone: guard.phone || "",
      company: guard.company || "mirae_abm",
      siteId: guard.siteId || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: GuardForm) => {
    if (editingGuard) {
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
            <h1 className="text-3xl font-bold">경비원 관리</h1>
            <p className="text-muted-foreground text-lg">
              경비원을 등록하고 관리합니다
            </p>
          </div>
          <Button 
            size="lg" 
            onClick={openCreateDialog}
            className="text-lg"
            data-testid="button-add-guard"
          >
            <Plus className="h-5 w-5 mr-2" />
            경비원 추가
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : guards.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">등록된 경비원이 없습니다</p>
            <Button onClick={openCreateDialog} data-testid="button-add-first-guard">
              <Plus className="h-5 w-5 mr-2" />
              첫 번째 경비원 추가하기
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(guardsBySite).map(([siteId, siteGuards]) => {
              const site = sites.find((s) => s.id === siteId);
              const siteName = site?.name || "현장 미배정";
              const siteCompany = site?.company;
              
              return (
                <Card key={siteId} data-testid={`site-group-${siteId}`}>
                  <CardHeader className="pb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <Building2 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl flex items-center gap-3">
                          {siteName}
                          {siteCompany && (
                            <Badge variant="outline">
                              {siteCompany === "mirae_abm" ? "미래에이비엠" : "다원PMC"}
                            </Badge>
                          )}
                        </CardTitle>
                        <CardDescription>
                          {siteGuards.length}명의 경비원
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {siteGuards.map((guard) => (
                        <div 
                          key={guard.id} 
                          className="p-4 bg-muted/30 rounded-lg"
                          data-testid={`guard-card-${guard.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
                                <User className="h-4 w-4 text-accent" />
                              </div>
                              <span className="font-medium text-lg">{guard.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(guard)}
                                data-testid={`button-edit-${guard.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeletingGuard(guard);
                                  setDeleteDialogOpen(true);
                                }}
                                data-testid={`button-delete-${guard.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          {guard.phone && (
                            <div className="flex items-center gap-2 text-muted-foreground text-sm">
                              <Phone className="h-3 w-3" />
                              <span>{guard.phone}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingGuard ? "경비원 정보 수정" : "경비원 추가"}
            </DialogTitle>
            <DialogDescription>
              {editingGuard ? "경비원 정보를 수정합니다" : "새로운 경비원을 등록합니다"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">이름</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="홍길동" 
                        className="h-12 text-base"
                        data-testid="input-guard-name"
                      />
                    </FormControl>
                    <FormDescription>로그인 시 아이디로 사용됩니다</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">전화번호</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="010-1234-5678" 
                        className="h-12 text-base"
                        data-testid="input-guard-phone"
                      />
                    </FormControl>
                    <FormDescription>뒷자리 4자리가 비밀번호로 사용됩니다</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">소속 회사</FormLabel>
                    <Select 
                      onValueChange={(value) => {
                        field.onChange(value);
                        form.setValue("siteId", "");
                      }} 
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12 text-base" data-testid="select-company">
                          <SelectValue placeholder="회사 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
                        <SelectItem value="dawon_pmc">다원PMC</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">근무 현장</FormLabel>
                    <Select 
                      onValueChange={(value) => field.onChange(value === "__none__" ? "" : value)} 
                      value={field.value || "__none__"}
                    >
                      <FormControl>
                        <SelectTrigger className="h-12 text-base" data-testid="select-site">
                          <SelectValue placeholder="현장 선택 (선택사항)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">선택 안함</SelectItem>
                        {filteredSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            {site.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                  disabled={createMutation.isPending || updateMutation.isPending}
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
            <AlertDialogTitle>경비원 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingGuard?.name}" 경비원을 삭제하시겠습니까? 이 작업은 되돌릴 수 없으며, 관련된 교육 기록도 함께 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGuard && deleteMutation.mutate(deletingGuard.id)}
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
