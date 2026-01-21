import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { 
  LogOut, 
  Users, 
  MapPin, 
  BookOpen, 
  ClipboardList,
  TrendingUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { User, Site, TrainingMaterial, TrainingRecord } from "@shared/schema";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { logout } = useAuth();

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

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const isLoading = guardsLoading || sitesLoading || materialsLoading || recordsLoading;

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
      icon: Users,
      href: "/admin/guards",
      color: "bg-accent/10 text-accent",
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
            <div className="hidden sm:block text-right">
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
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                    <Users className="h-6 w-6 text-accent" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{guards.length}</p>
                    <p className="text-sm text-muted-foreground">등록된 경비원</p>
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                    <MapPin className="h-6 w-6 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{sites.length}</p>
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
                    <p className="text-2xl font-bold">{records.length}</p>
                    <p className="text-sm text-muted-foreground">총 이수 기록</p>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

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
