import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { User, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { CompanyLogo } from "@/components/CompanyLogo";

const loginSchema = z.object({
  username: z.string().min(1, "사용자명을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const [selectedRole, setSelectedRole] = useState<"guard" | "admin" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    if (!selectedRole) return;
    
    setIsLoading(true);
    const result = await login(data.username, data.password, selectedRole);
    setIsLoading(false);

    if (result.success) {
      toast({
        title: "로그인 성공",
        description: "환영합니다!",
      });
      navigate(selectedRole === "admin" ? "/admin" : "/guard");
    } else {
      toast({
        title: "로그인 실패",
        description: result.message,
        variant: "destructive",
      });
    }
  };

  if (!selectedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-4">
            <CompanyLogo company="mirae_abm" className="h-16 mx-auto" />
            <div>
              <h1 className="text-3xl font-bold text-foreground">경비원 교육 지원 시스템</h1>
              <p className="text-muted-foreground mt-2">로그인 유형을 선택해주세요</p>
            </div>
          </div>

          <div className="grid gap-4">
            <Card 
              className="cursor-pointer hover-elevate active-elevate-2 border-2 hover:border-primary transition-colors"
              onClick={() => setSelectedRole("guard")}
              data-testid="card-select-guard"
            >
              <CardContent className="flex items-center gap-6 p-8">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-10 w-10 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-2xl mb-2">경비원 로그인</CardTitle>
                  <CardDescription className="text-base">
                    교육자료 열람 및 학습 기록 관리
                  </CardDescription>
                </div>
              </CardContent>
            </Card>

            <Card 
              className="cursor-pointer hover-elevate active-elevate-2 border-2 hover:border-accent transition-colors"
              onClick={() => setSelectedRole("admin")}
              data-testid="card-select-admin"
            >
              <CardContent className="flex items-center gap-6 p-8">
                <div className="w-20 h-20 rounded-full bg-accent/10 flex items-center justify-center">
                  <Shield className="h-10 w-10 text-accent" />
                </div>
                <div>
                  <CardTitle className="text-2xl mb-2">관리자 로그인</CardTitle>
                  <CardDescription className="text-base">
                    교육자료 및 인원 관리
                  </CardDescription>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <CompanyLogo company="mirae_abm" className="h-12 mx-auto" />
          <div>
            <CardTitle className="text-2xl">
              {selectedRole === "admin" ? "관리자 로그인" : "경비원 로그인"}
            </CardTitle>
            <CardDescription className="text-base mt-2">
              {selectedRole === "admin" 
                ? "관리자 계정으로 로그인하세요" 
                : "이름과 전화번호 뒷자리로 로그인하세요"}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      {selectedRole === "admin" ? "아이디" : "이름"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder={selectedRole === "admin" ? "관리자" : "홍길동"}
                        className="h-14 text-lg"
                        data-testid="input-username"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">
                      {selectedRole === "admin" ? "비밀번호" : "전화번호 뒷자리 (4자리)"}
                    </FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        type="password"
                        placeholder={selectedRole === "admin" ? "••••••••" : "1234"}
                        className="h-14 text-lg"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 pt-2">
                <Button 
                  type="submit" 
                  className="w-full h-14 text-lg"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full h-12"
                  onClick={() => {
                    setSelectedRole(null);
                    form.reset();
                  }}
                  data-testid="button-back"
                >
                  다른 방법으로 로그인
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
