import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Search, User, MapPin, FileText, Calendar } from "lucide-react";

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
import type { User as GuardUser, Site, TrainingRecord } from "@shared/schema";

interface GuardWithSite extends GuardUser {
  site?: Site;
}

interface TrainingRecordWithGuard extends TrainingRecord {
  guard?: GuardWithSite;
}

export default function AdminRecords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSite, setSelectedSite] = useState<string>("all");
  const [selectedGuard, setSelectedGuard] = useState<string>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"all" | "by-guard" | "by-site">("all");

  const { data: records = [], isLoading: recordsLoading } = useQuery<TrainingRecordWithGuard[]>({
    queryKey: ["/api/training-records"],
  });

  const { data: guards = [], isLoading: guardsLoading } = useQuery<GuardWithSite[]>({
    queryKey: ["/api/guards"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const isLoading = recordsLoading || guardsLoading || sitesLoading;

  const filteredRecords = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch = 
        record.materialTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
        record.guard?.name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSite = 
        selectedSite === "all" || record.guard?.siteId === selectedSite;
      
      const matchesGuard = 
        selectedGuard === "all" || record.guardId === selectedGuard;

      const matchesMonth = selectedMonth === "all" || (() => {
        const completedDate = new Date(record.completedAt);
        const recordMonth = (completedDate.getMonth() + 1).toString();
        return recordMonth === selectedMonth;
      })();

      return matchesSearch && matchesSite && matchesGuard && matchesMonth;
    });
  }, [records, searchTerm, selectedSite, selectedGuard, selectedMonth]);

  const recordsByGuard = useMemo(() => {
    const grouped: Record<string, TrainingRecordWithGuard[]> = {};
    filteredRecords.forEach((record) => {
      const guardId = record.guardId;
      if (!grouped[guardId]) {
        grouped[guardId] = [];
      }
      grouped[guardId].push(record);
    });
    return grouped;
  }, [filteredRecords]);

  const recordsBySite = useMemo(() => {
    const grouped: Record<string, TrainingRecordWithGuard[]> = {};
    filteredRecords.forEach((record) => {
      const siteId = record.guard?.siteId || "unassigned";
      if (!grouped[siteId]) {
        grouped[siteId] = [];
      }
      grouped[siteId].push(record);
    });
    return grouped;
  }, [filteredRecords]);

  const exportToPDF = async (type: "all" | "guard" | "site", id?: string) => {
    const jsPDF = (await import("jspdf")).default;
    await import("jspdf-autotable");

    const doc = new jsPDF();
    
    doc.addFont("https://cdn.jsdelivr.net/npm/nanum-gothic-font@1.0.0/NanumGothic.ttf", "NanumGothic", "normal");
    
    let title = "교육 이수 내역";
    let dataToExport = filteredRecords;

    if (type === "guard" && id) {
      const guard = guards.find((g) => g.id === id);
      title = `${guard?.name || "경비원"} - 교육 이수 내역`;
      dataToExport = filteredRecords.filter((r) => r.guardId === id);
    } else if (type === "site" && id) {
      const site = sites.find((s) => s.id === id);
      title = `${site?.name || "현장"} - 교육 이수 내역`;
      dataToExport = filteredRecords.filter((r) => r.guard?.siteId === id);
    }

    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    doc.setFontSize(10);
    doc.text(`출력일: ${new Date().toLocaleDateString("ko-KR")}`, 14, 30);
    doc.text(`총 ${dataToExport.length}건`, 14, 36);

    const tableData = dataToExport.map((record) => [
      record.guard?.name || "-",
      record.guard?.site?.name || "-",
      record.materialTitle,
      record.materialType === "card" ? "카드형" : "동영상",
      new Date(record.completedAt).toLocaleDateString("ko-KR"),
      new Date(record.completedAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    ]);

    (doc as any).autoTable({
      startY: 42,
      head: [["경비원", "현장", "교육 내용", "유형", "일자", "시간"]],
      body: tableData,
      styles: {
        fontSize: 9,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [30, 64, 175],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [245, 247, 250],
      },
    });

    doc.save(`${title}_${new Date().toISOString().split("T")[0]}.pdf`);
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
              경비원 개인별, 현장별 교육 이수 현황을 확인합니다
            </p>
          </div>
          <Button 
            size="lg" 
            onClick={() => {
              if (activeTab === "all") {
                exportToPDF("all");
              } else if (activeTab === "by-guard" && selectedGuard !== "all") {
                exportToPDF("guard", selectedGuard);
              } else if (activeTab === "by-site" && selectedSite !== "all") {
                exportToPDF("site", selectedSite);
              } else {
                exportToPDF("all");
              }
            }}
            className="text-lg"
            data-testid="button-export-pdf"
          >
            <Download className="h-5 w-5 mr-2" />
            {activeTab === "all" && "전체 PDF 다운로드"}
            {activeTab === "by-guard" && (selectedGuard !== "all" ? "경비원별 PDF 다운로드" : "전체 PDF 다운로드")}
            {activeTab === "by-site" && (selectedSite !== "all" ? "현장별 PDF 다운로드" : "전체 PDF 다운로드")}
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="이름 또는 교육 내용 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 h-12 text-base"
                  data-testid="input-search"
                />
              </div>
              <Select value={selectedSite} onValueChange={setSelectedSite}>
                <SelectTrigger className="w-[200px] h-12 text-base" data-testid="select-site-filter">
                  <SelectValue placeholder="현장 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 현장</SelectItem>
                  {sites.map((site) => (
                    <SelectItem key={site.id} value={site.id}>
                      {site.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedGuard} onValueChange={setSelectedGuard}>
                <SelectTrigger className="w-[200px] h-12 text-base" data-testid="select-guard-filter">
                  <SelectValue placeholder="경비원 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">전체 경비원</SelectItem>
                  {guards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[160px] h-12 text-base" data-testid="select-month-filter">
                  <SelectValue placeholder="월 선택" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
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
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "all" | "by-guard" | "by-site")} className="space-y-6">
            <TabsList className="h-14">
              <TabsTrigger value="all" className="text-lg px-6 h-12" data-testid="tab-all">전체 내역</TabsTrigger>
              <TabsTrigger value="by-guard" className="text-lg px-6 h-12" data-testid="tab-by-guard">경비원별</TabsTrigger>
              <TabsTrigger value="by-site" className="text-lg px-6 h-12" data-testid="tab-by-site">현장별</TabsTrigger>
            </TabsList>

            <TabsContent value="all">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    전체 교육 이수 내역
                  </CardTitle>
                  <CardDescription>
                    총 {filteredRecords.length}건의 기록
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {filteredRecords.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      교육 이수 기록이 없습니다
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-base">경비원</TableHead>
                            <TableHead className="text-base">현장</TableHead>
                            <TableHead className="text-base">교육 내용</TableHead>
                            <TableHead className="text-base">유형</TableHead>
                            <TableHead className="text-base">일자</TableHead>
                            <TableHead className="text-base">시간</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRecords.map((record) => (
                            <TableRow key={record.id} data-testid={`record-row-${record.id}`}>
                              <TableCell className="font-medium">{record.guard?.name || "-"}</TableCell>
                              <TableCell>{record.guard?.site?.name || "-"}</TableCell>
                              <TableCell>{record.materialTitle}</TableCell>
                              <TableCell>
                                {record.materialType === "card" ? "카드형" : "동영상"}
                              </TableCell>
                              <TableCell>
                                {new Date(record.completedAt).toLocaleDateString("ko-KR")}
                              </TableCell>
                              <TableCell>
                                {new Date(record.completedAt).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="by-guard" className="space-y-4">
              {Object.keys(recordsByGuard).length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground text-lg">교육 이수 기록이 없습니다</p>
                </Card>
              ) : (
                Object.entries(recordsByGuard).map(([guardId, guardRecords]) => {
                  const guard = guards.find((g) => g.id === guardId);
                  return (
                    <Card key={guardId} data-testid={`guard-records-${guardId}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                              <User className="h-6 w-6 text-accent" />
                            </div>
                            <div>
                              <CardTitle className="text-xl">{guard?.name || "알 수 없음"}</CardTitle>
                              <CardDescription>
                                {guard?.site?.name || "현장 미배정"} · {guardRecords.length}건 이수
                              </CardDescription>
                            </div>
                          </div>
                          <Button
                            variant="outline"
                            onClick={() => exportToPDF("guard", guardId)}
                            data-testid={`button-export-guard-${guardId}`}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            PDF 다운로드
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {guardRecords.map((record) => (
                              <div
                                key={record.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">{record.materialTitle}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {record.materialType === "card" ? "카드형" : "동영상"}
                                  </p>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <p>{new Date(record.completedAt).toLocaleDateString("ko-KR")}</p>
                                  <p>
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
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>

            <TabsContent value="by-site" className="space-y-4">
              {Object.keys(recordsBySite).length === 0 ? (
                <Card className="p-12 text-center">
                  <p className="text-muted-foreground text-lg">교육 이수 기록이 없습니다</p>
                </Card>
              ) : (
                Object.entries(recordsBySite).map(([siteId, siteRecords]) => {
                  const site = sites.find((s) => s.id === siteId);
                  const siteName = site?.name || "현장 미배정";
                  return (
                    <Card key={siteId} data-testid={`site-records-${siteId}`}>
                      <CardHeader>
                        <div className="flex items-center justify-between flex-wrap gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                              <MapPin className="h-6 w-6 text-green-500" />
                            </div>
                            <div>
                              <CardTitle className="text-xl">{siteName}</CardTitle>
                              <CardDescription>
                                {siteRecords.length}건 이수
                              </CardDescription>
                            </div>
                          </div>
                          {siteId !== "unassigned" && (
                            <Button
                              variant="outline"
                              onClick={() => exportToPDF("site", siteId)}
                              data-testid={`button-export-site-${siteId}`}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              PDF 다운로드
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea className="h-48">
                          <div className="space-y-2">
                            {siteRecords.map((record) => (
                              <div
                                key={record.id}
                                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                              >
                                <div>
                                  <p className="font-medium">{record.materialTitle}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {record.guard?.name} · {record.materialType === "card" ? "카드형" : "동영상"}
                                  </p>
                                </div>
                                <div className="text-right text-sm text-muted-foreground">
                                  <p>{new Date(record.completedAt).toLocaleDateString("ko-KR")}</p>
                                  <p>
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
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
