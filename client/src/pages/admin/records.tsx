import { useState, useMemo, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Search, User, MapPin, FileText, Filter, AlertCircle, Clock, CheckCircle2 } from "lucide-react";

const MONTHS = [
  { value: "all", label: "전체" },
  { value: "1", label: "1월" },
  { value: "2", label: "2월" },
  { value: "3", label: "3월" },
  { value: "4", label: "4월" },
  { value: "5", label: "5월" },
  { value: "6", label: "6월" },
  { value: "7", label: "7월" },
  { value: "8", label: "8월" },
  { value: "9", label: "9월" },
  { value: "10", label: "10월" },
  { value: "11", label: "11월" },
  { value: "12", label: "12월" },
];
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CompanyLogo } from "@/components/CompanyLogo";
import type { User as GuardUser, Site, TrainingRecord, TrainingMaterial } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface GuardWithSite extends GuardUser {
  site?: Site;
}

interface TrainingRecordWithGuard extends TrainingRecord {
  guard?: GuardWithSite;
}

type ComplianceStatus = "completed" | "in_progress" | "uncompleted" | "failed";

export default function AdminRecords() {
  const [, setLocation] = useLocation();

  const getQueryParam = (param: string) => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      return searchParams.get(param);
    } catch (e) {
      return null;
    }
  };

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedGuard, setSelectedGuard] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "by-guard" | "by-site">("all");

  useEffect(() => {
    const siteParam = getQueryParam("site");
    if (siteParam) {
      setSelectedSite(siteParam);
      setActiveTab("by-site"); // Automatically switch tab if filtered by site
    }
  }, []);

  const { data: records = [], isLoading: recordsLoading } = useQuery<TrainingRecordWithGuard[]>({
    queryKey: ["/api/training-records"],
  });

  const { data: guards = [], isLoading: guardsLoading } = useQuery<GuardWithSite[]>({
    queryKey: ["/api/guards"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: materials = [], isLoading: materialsLoading } = useQuery<TrainingMaterial[]>({
    queryKey: ["/api/training-materials"],
  });

  const isLoading = recordsLoading || guardsLoading || sitesLoading || materialsLoading;

  // 1. Standard Filtering for generic view (showing existing records)
  const filteredRecords = useMemo(() => {
    let filtered = records.filter((record) => {
      // Safe access to Guard Name
      const guardName = record.guard ? record.guard.name : "";

      const matchesSearch =
        record.materialTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        guardName.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSite =
        selectedSite === "all" || record.guard?.siteId === selectedSite;

      const matchesGuard =
        selectedGuard === "all" || record.guardId === selectedGuard;

      const matchesMaterial =
        selectedMaterial === "all" || record.materialId === selectedMaterial;

      const matchesMonth = selectedMonth === "all" || (() => {
        const completedDate = new Date(record.completedAt);
        const recordMonth = (completedDate.getMonth() + 1).toString();
        return recordMonth === selectedMonth;
      })();

      return matchesSearch && matchesSite && matchesGuard && matchesMonth && matchesMaterial;
    });

    return filtered.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());
  }, [records, searchTerm, selectedSite, selectedGuard, selectedMonth, selectedMaterial]);

  // 2. Compliance Logic (Only active when filtering by Specific Material)
  const complianceData = useMemo(() => {
    if (selectedMaterial === "all") return null;

    // Filter guards based on site/search/etc first
    const targetGuards = guards.filter(g => {
      if (selectedSite !== "all" && g.siteId !== selectedSite) return false;
      if (selectedGuard !== "all" && g.id !== selectedGuard) return false;
      if (searchTerm && !g.name.includes(searchTerm)) return false;
      return true;
    });

    const materialRef = materials.find(m => m.id === selectedMaterial);

    return targetGuards.map(guard => {
      const userRecord = records.find(r => r.guardId === guard.id && r.materialId === selectedMaterial);

      let status: ComplianceStatus = "uncompleted";
      if (userRecord) {
        if (userRecord.passed) status = "completed";
        else if (userRecord.status === "started") status = "in_progress";
        // Map "completed but failed" to "uncompleted" visual (or failed logic if needed)
        else if (!userRecord.passed && userRecord.status === "completed") status = "uncompleted";
        else status = "in_progress"; // Default fallback
      }

      return {
        guard,
        record: userRecord,
        status,
        materialTitle: materialRef?.title || "-"
      };
    }).sort((a, b) => {
      // Sort Order: Uncompleted -> In Progress -> Failed -> Completed
      const order = { "uncompleted": 0, "in_progress": 1, "failed": 2, "completed": 3 };
      return order[a.status] - order[b.status];
    });

  }, [guards, records, selectedMaterial, selectedSite, selectedGuard, searchTerm, materials]);


  const exportToPDF = async (type: "all" | "guard" | "site", id?: string) => {
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    const doc = new jsPDF();
    doc.addFont("https://cdn.jsdelivr.net/npm/nanum-gothic-font@1.0.0/NanumGothic.ttf", "NanumGothic", "normal");

    let title = "교육 이수 내역";
    let dataToExport: any[] = [];

    // If viewing compliance list (specific material selected), export that view
    if (selectedMaterial !== "all" && complianceData) {
      title = `교육 이수 현황 - ${materials.find(m => m.id === selectedMaterial)?.title}`;
      dataToExport = complianceData.map(item => ({
        name: item.guard.name,
        site: item.guard.site?.name || "-",
        material: item.materialTitle,
        status: item.status === "completed" ? "이수" : item.status === "in_progress" ? "진행중" : "미이수",
        date: item.record ? new Date(item.record.completedAt).toLocaleDateString("ko-KR") : "-"
      }));
    } else {
      // Standard Export
      dataToExport = filteredRecords.map(r => ({
        name: r.guard?.name || "-",
        site: r.guard?.site?.name || "-",
        material: r.materialTitle,
        status: r.passed ? "이수" : r.status === "started" ? "진행중" : "미이수",
        date: new Date(r.completedAt).toLocaleDateString("ko-KR")
      }));
    }

    doc.setFontSize(18);
    doc.text(title, 14, 22);

    doc.setFontSize(10);
    doc.text(`출력일: ${new Date().toLocaleDateString("ko-KR")}`, 14, 30);
    doc.text(`총 ${dataToExport.length}명`, 14, 36);

    const tableData = dataToExport.map((item) => [
      item.name,
      item.site,
      item.material,
      item.status,
      item.date
    ]);

    (doc as any).autoTable({
      startY: 42,
      head: [["경비원", "현장", "교육 내용", "상태", "일자"]],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 3, font: "NanumGothic" },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold" },
    });

    doc.save(`${title}_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const getStatusBadge = (status: ComplianceStatus) => {
    switch (status) {
      case "completed": return <Badge className="bg-green-600 hover:bg-green-700"><CheckCircle2 className="w-3 h-3 mr-1" /> 이수</Badge>;
      case "in_progress": return <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200"><Clock className="w-3 h-3 mr-1" /> 진행중</Badge>;
      case "failed": return <Badge variant="outline" className="text-muted-foreground border-dashed"><AlertCircle className="w-3 h-3 mr-1" /> 미이수</Badge>;
      case "uncompleted": return <Badge variant="outline" className="text-muted-foreground border-dashed"><AlertCircle className="w-3 h-3 mr-1" /> 미이수</Badge>;
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
            <h1 className="text-3xl font-bold">교육 내역 조회</h1>
            <p className="text-muted-foreground text-lg">
              {selectedMaterial !== "all"
                ? "선택한 교육 자료에 대한 전체 경비원 이수 현황입니다."
                : "전체 교육 이수 기록을 조회합니다."}
            </p>
          </div>
          <Button
            size="lg"
            onClick={() => exportToPDF("all")}
            className="text-lg"
          >
            <Download className="h-5 w-5 mr-2" />
            현황 PDF 다운로드
          </Button>
        </div>

        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="이름 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-[180px] h-12 text-base" >
                  <SelectValue placeholder="현장 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 현장</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedGuard} onValueChange={setSelectedGuard}>
                <SelectTrigger className="w-[180px] h-12 text-base">
                  <SelectValue placeholder="경비원 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 경비원</SelectItem>
                  {guards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>{guard.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-4">
              <Select value={selectedMaterial} onValueChange={setSelectedMaterial}>
                <SelectTrigger className="flex-1 min-w-[200px] h-12 text-base border-primary/50 bg-primary/5">
                  <SelectValue placeholder="교육 내용(자료) 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 교육 내용</SelectItem>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] h-12 text-base">
                  <SelectValue placeholder="월 선택" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>{month.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {selectedMaterial !== "all" ? "과목별 이수 현황 (전체 경비원)" : "교육 이수 기록"}
              </CardTitle>
              <CardDescription>
                {selectedMaterial !== "all"
                  ? `대상: ${complianceData?.length}명 | 정렬: 미이수 → 진행중 → 이수`
                  : `총 ${filteredRecords.length}건의 이수 기록이 있습니다.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-base w-[120px]">상태</TableHead>
                      <TableHead className="text-base">경비원</TableHead>
                      <TableHead className="text-base">현장</TableHead>
                      <TableHead className="text-base">교육 내용</TableHead>
                      <TableHead className="text-base">최종 활동 일자</TableHead>
                      {selectedMaterial !== "all" && <TableHead className="text-base">점수</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedMaterial !== "all" && complianceData ? (
                      // Compliance View (All Guards Logic)
                      complianceData.map((item) => (
                        <TableRow key={item.guard.id} className={item.status === "uncompleted" ? "bg-red-50/50" : ""}>
                          <TableCell>{getStatusBadge(item.status)}</TableCell>
                          <TableCell className="font-medium">{item.guard.name}</TableCell>
                          <TableCell>{item.guard.site?.name || "-"}</TableCell>
                          <TableCell>{item.materialTitle}</TableCell>
                          <TableCell>
                            {item.record ? new Date(item.record.completedAt).toLocaleDateString("ko-KR") : "-"}
                          </TableCell>
                          <TableCell>
                            {item.record?.score !== null && item.record?.score !== undefined ? `${item.record.score}점` : "-"}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      // Standard View (Existing Records Only)
                      filteredRecords.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">기록이 없습니다.</TableCell></TableRow>
                      ) : (
                        filteredRecords.map((record) => (
                          <TableRow key={record.id}>
                            <TableCell>
                              {record.passed ? (
                                <Badge className="bg-green-600 hover:bg-green-700">이수</Badge>
                              ) : record.status === "started" ? (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-200">진행중</Badge>
                              ) : (
                                <Badge variant="outline" className="text-muted-foreground border-dashed">미이수</Badge>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">{record.guard?.name || "알 수 없음"}</TableCell>
                            <TableCell>{record.guard?.site?.name || "-"}</TableCell>
                            <TableCell>{record.materialTitle}</TableCell>
                            <TableCell>
                              {new Date(record.completedAt).toLocaleDateString("ko-KR")}
                            </TableCell>
                          </TableRow>
                        ))
                      )
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
