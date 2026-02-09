import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";
import { CompanyLogo } from "@/components/CompanyLogo";

const loginSchema = z.object({
  username: z.string().min(1, "사용자명을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);

    try {
      // Server-side login (handles Korean username -> Phone conversion)
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: data.username,
          password: data.password,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "로그인 실패");
      }

      const { session } = await res.json();

      // Update Supabase client session
      const { error } = await supabase.auth.setSession(session);

      if (error) throw error;

      toast({
        title: "로그인 성공",
        description: "환영합니다!",
      });

      // Navigation is handled by AuthContext effect
    } catch (error: any) {
      toast({
        title: "로그인 실패",
        description: error.message || "아이디 또는 비밀번호를 확인해주세요",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <CompanyLogo company="mirae_abm" className="h-16 mx-auto" />
          <div>
            <CardTitle className="text-3xl font-bold">경비원 교육 지원 시스템</CardTitle>
            <CardDescription className="text-lg mt-3">
              아이디와 비밀번호를 입력해주세요
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
                    <FormLabel className="text-lg">아이디</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="이름 또는 관리자"
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
                    <FormLabel className="text-lg">비밀번호</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        type="password"
                        placeholder="비밀번호 입력"
                        className="h-14 text-lg"
                        data-testid="input-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button
                  type="submit"
                  className="w-full h-16 text-xl gap-3"
                  disabled={isLoading}
                  data-testid="button-login"
                >
                  <LogIn className="h-6 w-6" />
                  {isLoading ? "로그인 중..." : "로그인"}
                </Button>
              </div>

              <div className="text-center text-sm text-muted-foreground space-y-1 pt-2">
                <p>경비원: 아이디 "이름" / 비밀번호 "전화번호 뒷 4자리"</p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
