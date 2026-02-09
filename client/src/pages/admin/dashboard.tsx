import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  LogOut,
  Users,
  MapPin,
  BookOpen,
  ClipboardList,
  TrendingUp,
  UserCheck,
  Shield,
  Building2,
  Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { User, Site, TrainingMaterial, TrainingRecord } from "@shared/schema";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { logout } = useAuth();
  const [selectedCompany, setSelectedCompany] = useState<"mirae_abm" | "dawon_pmc" | "all">("all");

  const { data: guards = [], isLoading: guardsLoading } = useQuery<User[]>({
    queryKey: ["/api/guards"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: materials = [], isLoading: materialsLoading } = useQuery<TrainingMaterial[]>({
    queryKey: ["/api/training-materials"],
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery<TrainingRecord[]>({
    queryKey: ["/api/training-records"],
  });

  const { data: stats = [], isLoading: statsLoading } = useQuery<any[]>({
    queryKey: ["/api/dashboard/stats"],
  });

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("선택한 엑셀 파일로 현장 및 경비원 데이터를 일괄 등록하시겠습니까?")) {
      e.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch("/api/import/excel", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Upload failed");
      }

      const data = await res.json();
      alert(`등록 완료!\n현장 신규: ${data.stats.sitesCreated}건\n경비원 신규: ${data.stats.guardsCreated}건\n경비원 업데이트: ${data.stats.guardsUpdated}건\n오류: ${data.stats.errors}건`);

      // Refresh Data
      queryClient.invalidateQueries({ queryKey: ["/api/guards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });

    } catch (err: any) {
      console.error(err);
      alert("업로드 중 오류가 발생했습니다: " + err.message);
    } finally {
      e.target.value = ""; // Reset input
    }
  };

  const isLoading = guardsLoading || sitesLoading || materialsLoading || recordsLoading || statsLoading;

  // Filter Data based on selectedCompany
  const filteredGuards = useMemo(() => {
    if (selectedCompany === "all") return guards;
    return guards.filter(g => g.company === selectedCompany);
  }, [guards, selectedCompany]);

  const filteredSites = useMemo(() => {
    if (selectedCompany === "all") return sites;
    return sites.filter(s => s.company === selectedCompany);
  }, [sites, selectedCompany]);

  const filteredRecords = useMemo(() => {
    if (selectedCompany === "all") return records;
    // Filter records where the guard belongs to the selected company
    // Need to map guardId to company
    const guardCompanyMap = new Map(guards.map(g => [g.id, g.company]));
    return records.filter(r => guardCompanyMap.get(r.guardId) === selectedCompany);
  }, [records, guards, selectedCompany]);

  const filteredStats = useMemo(() => {
    if (selectedCompany === "all") return stats;
    // stats array objects have "name" (site name). Map site name to company.
    const siteCompanyMap = new Map(sites.map(s => [s.name, s.company]));
    return stats.filter(s => siteCompanyMap.get(s.name) === selectedCompany);
  }, [stats, sites, selectedCompany]);


  const menuItems = [
    {
      title: "교육 자료 관리",
      description: "카드형 및 동영상 교육 자료 추가, 수정, 삭제",
      icon: BookOpen,
      href: "/admin/materials",
      color: "bg-primary/10 text-primary",
    },
    {
      title: "현장 관리",
      description: "경비 현장 등록 및 관리",
      icon: MapPin,
      href: "/admin/sites",
      color: "bg-green-500/10 text-green-500",
    },
    {
      title: "경비원 관리",
      description: "경비원 등록 및 정보 관리",
      icon: Shield,
      href: "/admin/guards",
      color: "bg-amber-500/10 text-amber-500",
    },
    {
      title: "교육 내역 조회",
      description: "개인별, 현장별 교육 이수 현황 확인 및 PDF 출력",
      icon: ClipboardList,
      href: "/admin/records",
      color: "bg-purple-500/10 text-purple-500",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <CompanyLogo company="mirae_abm" className="h-10" />

          <div className="flex items-center gap-4">
            {/* Excel Upload Button */}
            <div className="mr-2">
              <label>
                <Input
                  type="file"
                  className="hidden"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                />
                <Button variant="outline" size="sm" asChild>
                  <span className="cursor-pointer flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    엑셀 일괄 등록
                  </span>
                </Button>
              </label>
            </div>

            {/* Company Switcher */}
            <Select
              value={selectedCompany}
              onValueChange={(val: "mirae_abm" | "dawon_pmc" | "all") => setSelectedCompany(val)}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="회사 선택" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 보기</SelectItem>
                <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
                <SelectItem value="dawon_pmc">다원PMC</SelectItem>
              </SelectContent>
            </Select>

            <div className="hidden sm:block text-right border-l pl-4 ml-2">
              <p className="font-medium text-lg">관리자</p>
              <p className="text-sm text-muted-foreground">시스템 관리</p>
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

      <main className="p-4 max-w-7xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">관리자 대시보드</h1>
          <p className="text-muted-foreground text-lg">
            경비원 교육 지원 시스템을 관리합니다
            {selectedCompany !== "all" && (
              <span className="ml-2 font-medium text-primary">
                - {selectedCompany === "mirae_abm" ? "미래에이비엠" : "다원PMC"}
              </span>
            )}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            [1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))
          ) : (
            <>
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                    <UserCheck className="h-6 w-6 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredGuards.length}</p>
                    <p className="text-sm text-muted-foreground">등록된 경비원</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredSites.length}</p>
                    <p className="text-sm text-muted-foreground">등록된 현장</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{materials.length}</p>
                    <p className="text-sm text-muted-foreground">교육 자료</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="h-6 w-6 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{filteredRecords.length}</p>
                    <p className="text-sm text-muted-foreground">총 이수 기록</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {!isLoading && (
          <Card className="col-span-full">
            <CardHeader>
              <CardTitle>현장별 교육 이수율</CardTitle>
              <CardDescription>
                그래프를 클릭하면 해당 현장의 상세 교육 내역으로 이동합니다.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={filteredStats}
                  onClick={(data) => {
                    if (data && data.activePayload && data.activePayload.length > 0) {
                      const payload = data.activePayload[0].payload;
                      // Find site ID by name since payload only contains name from stats logic
                      const site = sites.find(s => s.name === payload.name);
                      if (site) {
                        navigate(`/admin/records?site=${site.id}`);
                      } else {
                        console.warn("Could not find site for click navigation", payload);
                      }
                    }
                  }}
                  className="cursor-pointer"
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis unit="%" />
                  <Tooltip
                    cursor={{ fill: 'rgba(0, 0, 0, 0.1)' }}
                  />
                  <Legend />
                  <Bar dataKey="completionRate" name="이수율" fill="#8884d8" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {menuItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Card
                className="cursor-pointer hover-elevate active-elevate-2 h-full"
                data-testid={`menu-card-${item.href.split("/").pop()}`}
              >
                <CardContent className="flex items-center gap-6 p-8">
                  <div className={`w-16 h-16 rounded-full ${item.color} flex items-center justify-center`}>
                    <item.icon className="h-8 w-8" />
                  </div>
                  <div>
                    <CardTitle className="text-xl mb-2">{item.title}</CardTitle>
                    <CardDescription className="text-base">
                      {item.description}
                    </CardDescription>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
