import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowLeft, Plus, Pencil, Trash2, MapPin, Users } from "lucide-react";
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
import type { Site, User } from "@shared/schema";

const siteSchema = z.object({
  name: z.string().min(1, "현장명을 입력해주세요"),
  company: z.enum(["mirae_abm", "dawon_pmc"]),
  address: z.string().optional(),
});

type SiteForm = z.infer<typeof siteSchema>;

interface SiteWithGuards extends Site {
  guards?: User[];
}

export default function AdminSites() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [deletingSite, setDeletingSite] = useState<Site | null>(null);

  const [selectedCompany, setSelectedCompany] = useState<"all" | "mirae_abm" | "dawon_pmc">("all");

  const { data: sites = [], isLoading } = useQuery<SiteWithGuards[]>({
    queryKey: ["/api/sites"],
  });

  const filteredSites = sites.filter((site) =>
    selectedCompany === "all" ? true : site.company === selectedCompany
  );

  const form = useForm<SiteForm>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: "",
      company: "mirae_abm",
      address: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SiteForm) => {
      await apiRequest("POST", "/api/sites", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "성공", description: "현장이 등록되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "등록에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: SiteForm) => {
      await apiRequest("PATCH", `/api/sites/${editingSite?.id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setDialogOpen(false);
      setEditingSite(null);
      form.reset();
      toast({ title: "성공", description: "현장 정보가 수정되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      setDeleteDialogOpen(false);
      setDeletingSite(null);
      toast({ title: "성공", description: "현장이 삭제되었습니다." });
    },
    onError: () => {
      toast({ title: "오류", description: "삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const openCreateDialog = () => {
    setEditingSite(null);
    form.reset({
      name: "",
      company: "mirae_abm",
      address: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (site: Site) => {
    setEditingSite(site);
    form.reset({
      name: site.name,
      company: site.company,
      address: site.address || "",
    });
    setDialogOpen(true);
  };

  const onSubmit = (data: SiteForm) => {
    if (editingSite) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <div className="min-h-screen bg-background" >
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link href="/admin">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <CompanyLogo company="mirae_abm" className="h-8" />
              <span className="text-muted-foreground mx-2">|</span>
              <CompanyLogo company="dawon_pmc" className="h-8" />
            </div>
          </div>
        </div>
      </header>

      <main className="p-4 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold">현장 관리</h1>
            <p className="text-muted-foreground text-lg">
              경비 현장을 등록하고 관리합니다
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Select
              value={selectedCompany}
              onValueChange={(value: any) => setSelectedCompany(value)}
            >
              <SelectTrigger className="w-[180px] h-11">
                <SelectValue placeholder="법인 전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 법인</SelectItem>
                <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
                <SelectItem value="dawon_pmc">다원PMC</SelectItem>
              </SelectContent>
            </Select>

            <Button
              size="lg"
              onClick={openCreateDialog}
              className="text-lg"
              data-testid="button-add-site"
            >
              <Plus className="h-5 w-5 mr-2" />
              현장 추가
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredSites.length === 0 ? (
          <Card className="p-12 text-center">
            <p className="text-muted-foreground text-lg mb-4">
              {selectedCompany === "all" ? "등록된 현장이 없습니다" : "선택한 법인의 현장이 없습니다"}
            </p>
            <Button onClick={openCreateDialog} data-testid="button-add-first-site">
              <Plus className="h-5 w-5 mr-2" />
              현장 추가하기
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSites.map((site) => (
              <Card key={site.id} data-testid={`site-card-${site.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-green-500" />
                      </div>
                      <Badge variant="secondary">
                        {site.company === "mirae_abm" ? "미래에이비엠" : "다원PMC"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditDialog(site)}
                        data-testid={`button-edit-${site.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDeletingSite(site);
                          setDeleteDialogOpen(true);
                        }}
                        data-testid={`button-delete-${site.id}`}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-xl mb-2">{site.name}</CardTitle>
                  {site.address && (
                    <CardDescription className="text-base mb-2">
                      {site.address}
                    </CardDescription>
                  )}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                    <Users className="h-4 w-4" />
                    <span>{site.guards?.length || 0}명의 경비원</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {new Date(site.createdAt).toLocaleDateString("ko-KR")} 등록
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {editingSite ? "현장 정보 수정" : "현장 추가"}
            </DialogTitle>
            <DialogDescription>
              {editingSite ? "현장 정보를 수정합니다" : "새로운 경비 현장을 등록합니다"}
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">현장명</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="OO빌딩"
                        className="h-12 text-base"
                        data-testid="input-site-name"
                      />
                    </FormControl>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">주소 (선택)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="서울시 강남구 ..."
                        className="h-12 text-base"
                        data-testid="input-site-address"
                      />
                    </FormControl>
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
            <AlertDialogTitle>현장 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              "{deletingSite?.name}" 현장을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSite && deleteMutation.mutate(deletingSite.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div >
  );
}
