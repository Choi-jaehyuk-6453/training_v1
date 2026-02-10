import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    CheckCircle,
    XCircle,
    HelpCircle,
    Volume2,
    VolumeX,
    PlayCircle,
    AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingMaterial } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatePresence, motion } from "framer-motion";

// Custom hook to load YouTube API
const useYouTubeAPI = () => {
    const [apiReady, setApiReady] = useState(false);

    useEffect(() => {
        if ((window as any).YT) {
            setApiReady(true);
            return;
        }

        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        (window as any).onYouTubeIframeAPIReady = () => {
            setApiReady(true);
        };
    }, []);

    return apiReady;
};

// Robust Video Player Component
const VideoPlayer = ({
    url,
    onProgress,
    onEnded,
    onError
}: {
    url: string;
    onProgress: (percent: number) => void;
    onEnded: () => void;
    onError: () => void;
}) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const playerRef = useRef<any>(null);
    const apiReady = useYouTubeAPI();
    const intervalRef = useRef<NodeJS.Timeout>();

    const getYouTubeId = (url: string) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    };

    const youtubeId = getYouTubeId(url);

    // Initial load for YouTube
    useEffect(() => {
        if (youtubeId && apiReady && iframeRef.current && !playerRef.current) {
            try {
                playerRef.current = new (window as any).YT.Player(iframeRef.current, {
                    events: {
                        'onStateChange': (event: any) => {
                            if (event.data === (window as any).YT.PlayerState.ENDED) {
                                onEnded();
                                clearInterval(intervalRef.current);
                            } else if (event.data === (window as any).YT.PlayerState.PLAYING) {
                                // Start polling for progress
                                intervalRef.current = setInterval(() => {
                                    if (playerRef.current && playerRef.current.getCurrentTime) {
                                        const current = playerRef.current.getCurrentTime();
                                        const duration = playerRef.current.getDuration();
                                        if (duration > 0) {
                                            onProgress((current / duration) * 100);
                                        }
                                    }
                                }, 1000);
                            } else {
                                clearInterval(intervalRef.current);
                            }
                        },
                        'onError': () => onError()
                    }
                });
            } catch (e) {
                console.error("YT init error", e);
            }
        }
    }, [youtubeId, apiReady]);

    // Cleanup
    useEffect(() => {
        return () => {
            clearInterval(intervalRef.current);
            if (playerRef.current && playerRef.current.destroy) {
                try {
                    playerRef.current.destroy();
                } catch (e) {
                    console.error("Player destroy error", e);
                }
                playerRef.current = null;
            }
        };
    }, [url]);

    if (youtubeId) {
        return (
            <div className="w-full h-full bg-black">
                <div id={`youtube-player-${youtubeId}`} className="hidden"></div>
                <iframe
                    ref={iframeRef}
                    className="w-full h-full"
                    src={`https://www.youtube.com/embed/${youtubeId}?enablejsapi=1&origin=${window.location.origin}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title="YouTube Video"
                />
            </div>
        );
    }

    return (
        <video
            ref={videoRef}
            src={url}
            className="w-full h-full object-contain bg-black"
            controls
            playsInline
            onTimeUpdate={() => {
                if (videoRef.current) {
                    const progress = (videoRef.current.currentTime / videoRef.current.duration) * 100;
                    onProgress(progress);
                }
            }}
            onEnded={onEnded}
            onError={onError}
        />
    );
};

export default function TrainingView() {
    const [match, params] = useRoute("/guard/training/:id");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const id = params?.id;

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const { data: materials } = useQuery<TrainingMaterial[]>({
        queryKey: ["/api/training-materials"],
    });

    const material = materials?.find(m => m.id === id);

    const safeParseArray = useCallback((data: unknown): string[] => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    }, []);

    const quizzes = useMemo(() => {
        if (!material?.quizzes) return [];
        if (Array.isArray(material.quizzes)) return material.quizzes;
        if (typeof material.quizzes === 'string') {
            try {
                const parsed = JSON.parse(material.quizzes);
                return Array.isArray(parsed) ? parsed : [];
            } catch {
                return [];
            }
        }
        return [];
    }, [material]);

    const cardImages = useMemo(() => safeParseArray(material?.cardImages), [material, safeParseArray]);
    const audioUrls = useMemo(() => safeParseArray(material?.audioUrls), [material, safeParseArray]);

    const videos = useMemo(() => {
        if (!material) return [];
        const uris = safeParseArray(material.videoUrls);
        if (uris.length > 0) return uris.map(u => u.trim());
        if (material.videoUrl) return [material.videoUrl.trim()];
        return [];
    }, [material, safeParseArray]);

    const [currentStep, setCurrentStep] = useState<"content" | "quiz" | "result">("content");
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const [canProceedCard, setCanProceedCard] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [hasPlayed, setHasPlayed] = useState(false);
    const [playerError, setPlayerError] = useState(false);

    // Missing state variables restored
    const [userAnswers, setUserAnswers] = useState<number[]>([]);
    const [quizResult, setQuizResult] = useState<{ score: number; passed: boolean } | null>(null);
    const [videoProgress, setVideoProgress] = useState(0);
    const [canProceedVideo, setCanProceedVideo] = useState(false);
    const [canTakeQuiz, setCanTakeQuiz] = useState(false);

    // Audio handling effect
    useEffect(() => {
        if (material?.type === "card") {
            const hasAudio = !!audioUrls[currentCardIndex];
            setCanProceedCard(!hasAudio);

            if (hasAudio && audioRef.current) {
                audioRef.current.src = audioUrls[currentCardIndex];
                audioRef.current.currentTime = 0;
                const playPromise = audioRef.current.play();

                if (playPromise !== undefined) {
                    playPromise
                        .then(() => setIsPlayingAudio(true))
                        .catch((error) => {
                            console.log("Audio play failed:", error);
                            setIsPlayingAudio(false);
                            // If autoplay fails, we might still want to lock navigation until they play
                            // But usually browser blocks autoplay until interaction.
                        });
                }
            } else {
                setIsPlayingAudio(false);
            }
        }
    }, [currentCardIndex, material, audioUrls]);
    const submitRecordMutation = useMutation({
        mutationFn: async (result: { passed: boolean; score: number }) => {
            if (!material) return;
            await apiRequest("POST", "/api/training-records", {
                materialId: material.id,
                materialType: material.type,
                materialTitle: material.title,
                passed: result.passed,
                score: result.score
            });
        },
        onSuccess: () => {
            toast({ title: "완료", description: "교육 이수 기록이 저장되었습니다." });
        }
    });

    useEffect(() => {
        const quizLen = quizzes.length;
        if (quizLen > 0 && userAnswers.length !== quizLen) {
            setUserAnswers(new Array(quizLen).fill(-1));
        }
    }, [quizzes, currentStep]);


    useEffect(() => {
        setVideoProgress(0);
        setCanProceedVideo(false);
        setHasPlayed(false);
        setPlayerError(false);
        if (videos.length > 0 && currentVideoIndex === videos.length - 1) {
            setCanTakeQuiz(false);
        }
    }, [currentVideoIndex, videos.length]);

    const handleNextCard = () => {
        if (currentCardIndex < cardImages.length - 1) {
            setCanProceedCard(false);
            setCurrentCardIndex(prev => prev + 1);
        } else {
            setCanTakeQuiz(true);
        }
    };

    const handlePrevCard = () => {
        if (currentCardIndex > 0) {
            setCanProceedCard(false);
            setCurrentCardIndex(prev => prev - 1);
        }
    };

    const handleRetryQuiz = () => {
        setUserAnswers(new Array(quizzes.length).fill(-1));
        setQuizResult(null);
        setCurrentStep("quiz");
        window.scrollTo(0, 0);
    };

    const toggleAudio = () => {
        if (audioRef.current) {
            if (isPlayingAudio) {
                audioRef.current.pause();
            } else {
                audioRef.current.play();
            }
            setIsPlayingAudio(!isPlayingAudio);
        }
    };

    const handleNextVideo = () => {
        if (currentVideoIndex < videos.length - 1) {
            setCurrentVideoIndex(prev => prev + 1);
        }
    };

    const handleQuizSubmit = () => {
        if (quizzes.length === 0) return;
        let correctCount = 0;
        quizzes.forEach((q: any, idx: number) => {
            if (userAnswers[idx] === q.answer) {
                correctCount++;
            }
        });
        const score = Math.round((correctCount / quizzes.length) * 100);
        const passed = score >= 60;
        setQuizResult({ score, passed });
        setCurrentStep("result");
        if (passed) {
            submitRecordMutation.mutate({ passed, score });
        }
    };

    if (!material) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Skeleton className="h-96 w-full max-w-4xl" />
            </div>
        );
    }

    if (!isMounted) return null;

    return (
        <div className="min-h-screen bg-background flex flex-col">
            <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur">
                <div className="flex items-center p-3 sm:p-4 max-w-7xl mx-auto w-full">
                    <Button variant="ghost" size="icon" onClick={() => setLocation("/guard")}>
                        <ArrowLeft className="h-6 w-6" />
                    </Button>
                    <h1 className="ml-3 text-lg sm:text-xl font-bold truncate flex-1">{material.title}</h1>
                </div>
            </header>

            <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full p-4">
                {currentStep === "content" && (
                    <div className="flex-1 flex flex-col gap-6">
                        {material.type === "card" && cardImages.length > 0 && (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6 min-h-[50vh] sm:min-h-[60vh]">
                                <div className="relative w-full aspect-auto sm:aspect-[16/9] max-h-[60vh] sm:max-h-[70vh] rounded-lg sm:rounded-xl overflow-hidden shadow-lg sm:shadow-2xl bg-black">
                                    <AnimatePresence mode="wait">
                                        <motion.img
                                            key={currentCardIndex}
                                            src={cardImages[currentCardIndex]}
                                            alt={`Page ${currentCardIndex + 1}`}
                                            className="w-full h-auto max-h-[60vh] sm:max-h-[70vh] object-contain mx-auto"
                                            initial={{ opacity: 0, x: 20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -20 }}
                                            transition={{ duration: 0.3 }}
                                        />
                                    </AnimatePresence>
                                    {audioUrls[currentCardIndex] && (
                                        <div className="absolute top-4 right-4 bg-black/50 backdrop-blur rounded-full p-2">
                                            <Button size="icon" variant="ghost" className="text-white rounded-full w-12 h-12" onClick={toggleAudio}>
                                                {isPlayingAudio ? <Volume2 className="h-6 w-6" /> : <VolumeX className="h-6 w-6" />}
                                            </Button>
                                        </div>
                                    )}
                                    {/* Always render audio element to ensure ref availability */}
                                    <audio
                                        ref={audioRef}
                                        className="hidden"
                                        onEnded={() => {
                                            setIsPlayingAudio(false);
                                            setCanProceedCard(true);
                                        }}
                                        onPause={() => setIsPlayingAudio(false)}
                                        onPlay={() => setIsPlayingAudio(true)}
                                    />
                                </div>
                                <div className="w-full flex items-center justify-between max-w-3xl px-4">
                                    <Button size="lg" variant="outline" onClick={handlePrevCard} disabled={currentCardIndex === 0} className="h-14 px-8 text-lg">
                                        <ChevronLeft className="mr-2 h-6 w-6" /> 이전
                                    </Button>
                                    <span className="text-xl font-mono text-muted-foreground">{currentCardIndex + 1} / {cardImages.length}</span>
                                    {currentCardIndex === cardImages.length - 1 ? (
                                        <Button
                                            size="lg"
                                            className="h-14 px-8 text-lg bg-orange-500 hover:bg-orange-600 text-white"
                                            onClick={() => setCurrentStep("quiz")}
                                            disabled={!canProceedCard}
                                        >
                                            퀴즈 풀기 <HelpCircle className="ml-2 h-6 w-6" />
                                        </Button>
                                    ) : (
                                        <Button
                                            size="lg"
                                            onClick={handleNextCard}
                                            className="h-14 px-8 text-lg"
                                            disabled={!canProceedCard}
                                        >
                                            다음 <ChevronRight className="ml-2 h-6 w-6" />
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}

                        {material.type === "video" && videos.length > 0 && (
                            <div className="flex-1 flex flex-col gap-6">
                                <div className="w-full aspect-video bg-black rounded-xl overflow-hidden shadow-2xl relative">
                                    {!playerError ? (
                                        <VideoPlayer
                                            key={currentVideoIndex}
                                            url={videos[currentVideoIndex]}
                                            onProgress={(progress) => {
                                                setVideoProgress(progress);
                                                setHasPlayed(true);
                                                if (progress >= 80) {
                                                    setCanProceedVideo(true);
                                                    if (currentVideoIndex === videos.length - 1) {
                                                        setCanTakeQuiz(true);
                                                    }
                                                }
                                            }}
                                            onEnded={() => {
                                                setVideoProgress(100);
                                                setCanProceedVideo(true);
                                                if (currentVideoIndex === videos.length - 1) setCanTakeQuiz(true);
                                            }}
                                            onError={() => setPlayerError(true)}
                                        />
                                    ) : (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-zinc-900">
                                            <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
                                            <h3 className="text-xl font-bold mb-2">동영상을 재생할 수 없습니다</h3>
                                            <p className="text-zinc-400 text-center px-4 mb-4">
                                                URL을 다시 확인해주세요.
                                            </p>
                                            <Button variant="outline" className="mt-6 text-black" onClick={() => setPlayerError(false)}>
                                                다시 시도
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2 max-w-3xl mx-auto w-full">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span>동영상 {currentVideoIndex + 1} / {videos.length}</span>
                                        <span>진행률 {Math.round(videoProgress)}%</span>
                                    </div>
                                    <Progress value={videoProgress} className="h-4" />
                                </div>

                                <div className="flex flex-col items-center gap-4 mt-8">
                                    <div className="flex gap-4">
                                        <Button
                                            size="lg"
                                            variant="outline"
                                            onClick={() => setCurrentVideoIndex(prev => Math.max(0, prev - 1))}
                                            disabled={currentVideoIndex === 0}
                                            className={currentVideoIndex === 0 ? "hidden" : ""}
                                        >
                                            <ChevronLeft className="mr-2 h-6 w-6" /> 이전 영상
                                        </Button>
                                        {currentVideoIndex < videos.length - 1 ? (
                                            <Button size="lg" className="h-14 px-8 text-lg" onClick={handleNextVideo} disabled={!canProceedVideo}>
                                                다음 영상 <ChevronRight className="ml-2 h-6 w-6" />
                                            </Button>
                                        ) : (
                                            <Button size="lg" className="h-16 px-12 text-xl bg-orange-500 hover:bg-orange-600 text-white" onClick={() => setCurrentStep("quiz")} disabled={!canTakeQuiz}>
                                                퀴즈 풀러 가기 <HelpCircle className="ml-2 h-6 w-6" />
                                            </Button>
                                        )}
                                    </div>
                                    {!canProceedVideo && !playerError && (
                                        <p className="text-muted-foreground animate-pulse text-center">
                                            {hasPlayed ? "영상을 80% 이상 시청해야 다음으로 넘어갈 수 있습니다." : "영상을 재생해주세요."}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {
                    currentStep === "quiz" && (
                        <div className="flex-1 max-w-2xl mx-auto w-full py-8 space-y-8">
                            <div className="text-center space-y-2"><h2 className="text-3xl font-bold">교육 확인 퀴즈</h2></div>
                            {quizzes.length > 0 && (
                                <Card>
                                    <CardContent className="p-6 space-y-8">
                                        {quizzes.map((quiz: any, idx: number) => (
                                            <div key={idx} className="space-y-4">
                                                <h3 className="text-lg font-semibold flex gap-2"><span className="text-primary">Q{idx + 1}.</span>{quiz.question}</h3>
                                                <RadioGroup onValueChange={(val) => {
                                                    const newAnswers = [...userAnswers]; newAnswers[idx] = parseInt(val); setUserAnswers(newAnswers);
                                                }}>
                                                    {(Array.isArray(quiz.options) ? quiz.options : []).map((option: string, oIdx: number) => (
                                                        <div key={oIdx} className="flex items-center space-x-2 border p-4 rounded-lg"><RadioGroupItem value={oIdx.toString()} id={`q${idx}-o${oIdx}`} /><Label htmlFor={`q${idx}-o${oIdx}`} className="flex-1 cursor-pointer">{option}</Label></div>
                                                    ))}
                                                </RadioGroup>
                                            </div>
                                        ))}
                                    </CardContent>
                                    <CardFooter className="p-6 bg-muted/20 flex justify-end"><Button size="lg" onClick={handleQuizSubmit} disabled={userAnswers.filter(a => a !== -1).length !== quizzes.length}>제출하기</Button></CardFooter>
                                </Card>
                            )}
                        </div>
                    )
                }
                {
                    currentStep === "result" && quizResult && (
                        <div className="flex-1 flex flex-col items-center justify-center gap-8 py-12">
                            <div className="text-center space-y-4">
                                <h2 className="text-4xl font-bold">{quizResult.passed ? "축하합니다!" : "아쉽네요..."}</h2>
                                <div className="text-2xl font-bold p-4 bg-muted rounded-xl inline-block px-8">점수: <span className={quizResult.passed ? "text-green-600" : "text-red-500"}>{quizResult.score}점</span></div>
                            </div>

                            {!quizResult.passed ? (
                                <div className="flex gap-4">
                                    <Button size="lg" variant="outline" className="h-14 px-8 text-lg" onClick={() => setLocation("/guard")}>홈으로 이동</Button>
                                    <Button size="lg" className="h-14 px-8 text-lg" onClick={handleRetryQuiz}>
                                        <RotateCcw className="mr-2 h-5 w-5" />
                                        퀴즈 다시 풀기
                                    </Button>
                                </div>
                            ) : (
                                <Button size="lg" className="h-14 px-8 text-lg" onClick={() => setLocation("/guard")}>홈으로 이동</Button>
                            )}
                        </div>
                    )
                }
            </main >
        </div >
    );
}
