"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles, Loader2, Info, Mic, Volume2, Maximize2, Minimize2, Trash2, Copy, FileText, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { streamChat, getQuizStats, getFlashcardState, ChatSource, pdfUrl } from "@/lib/api";
import { COURSES } from "@/lib/courses";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "ai";
  content: string;
  sources?: ChatSource[];
};

export default function GlobalAiAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [personalContext, setPersonalContext] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isExamMode, setIsExamMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash");

  // Load selected model from localStorage on mount
  useEffect(() => {
    const savedModel = localStorage.getItem("hukuk_selected_model");
    if (savedModel) {
      setSelectedModel(savedModel);
    }
  }, []);

  const handleModelChange = (model: string) => {
    setSelectedModel(model);
    localStorage.setItem("hukuk_selected_model", model);
  };

  const renderMessageContent = (content: string) => {
    if (content.includes("<think>") && content.includes("</think>")) {
      const parts = content.split("</think>");
      const thinking = parts[0].replace("<think>", "").trim();
      const answer = parts[1].trim();
      return (
        <div className="space-y-4">
          <details className="group border border-zinc-800 bg-zinc-900/50 rounded-xl p-3 [&_summary::-webkit-details-marker]:hidden" open>
            <summary className="flex items-center justify-between font-semibold text-xs text-zinc-400 cursor-pointer select-none">
              <span className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                Düşünme Süreci
              </span>
              <span className="text-zinc-500 transition group-open:rotate-180">
                ▼
              </span>
            </summary>
            <div className="mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-800/40 pt-2 leading-relaxed">
              {thinking}
            </div>
          </details>
          {answer ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {answer}
            </ReactMarkdown>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm font-medium animate-pulse">Yanıt oluşturuluyor...</span>
            </div>
          )}
        </div>
      );
    }
    
    if (content.includes("<think>")) {
      const thinking = content.replace("<think>", "").trim();
      return (
        <div className="space-y-4">
          <div className="border border-zinc-800 bg-zinc-900/50 rounded-xl p-3">
            <div className="flex items-center gap-1.5 font-semibold text-xs text-zinc-400">
              <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
              <span>Düşünme Süreci...</span>
            </div>
            <div className="mt-2 text-xs text-zinc-500 font-mono whitespace-pre-wrap border-t border-zinc-800/40 pt-2 leading-relaxed">
              {thinking}
            </div>
          </div>
        </div>
      );
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    );
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // 1. Load & Save History
  useEffect(() => {
    const saved = localStorage.getItem("omni_ai_history");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("omni_ai_history", JSON.stringify(messages));
    }
  }, [messages]);

  // Load stats
  useEffect(() => {
    async function loadStats() {
      try {
        const statsInfo: string[] = [];
        const courses = ["borclar_genel"];
        
        for (const courseId of courses) {
          try {
            const courseName = COURSES.find(c => c.id === courseId)?.name || courseId;
            const qStats = await getQuizStats(courseId).catch(() => null);
            const fState = await getFlashcardState(courseId).catch(() => null);
            
            let info = `Ders: ${courseName}.`;
            if (qStats && qStats.total_attempts > 0) {
              const acc = Math.round((qStats.correct_count / qStats.total_attempts) * 100);
              info += ` Quiz: %${acc} başarı (${qStats.total_attempts} deneme).`;
              if (qStats.weakTopics && qStats.weakTopics.length > 0) {
                info += ` Zayıf konular: ${qStats.weakTopics.join(", ")}.`;
              }
            }
            if (fState && fState.state) {
              const due = fState.state.filter(c => Date.now() >= c.next_review).length;
              info += ` Flashcard: ${fState.state.length} kartın ${due} tanesi tekrar bekliyor.`;
            }
            statsInfo.push(info);
          } catch {
            // ignore
          }
        }
        
        if (statsInfo.length > 0) {
          setPersonalContext(`Kullanıcının sistemdeki senkronize çalışma durumu:\n${statsInfo.join("\n")}\n\nEğer kullanıcı durumunu sorarsa motive edici ve akademik bir analiz yap.`);
        }
      } catch (e) {
        console.error("Failed to load personal context:", e);
      }
    }
    loadStats();

    // 3. Setup Speech Recognition
    if (typeof window !== "undefined" && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'tr-TR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => prev + " " + transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([]);
    localStorage.removeItem("omni_ai_history");
  };

  const toggleListen = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  // 4. Text to Speech
  const readAloud = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'tr-TR';
      window.speechSynthesis.speak(utterance);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async (overrideText?: string, isSimplify?: boolean) => {
    const textToSend = overrideText || input;
    if (!textToSend.trim() || isLoading) return;

    if (!overrideText) setInput("");
    
    let userText = textToSend.trim();
    if (isExamMode && !overrideText) {
      userText = `[Sınav Modu Aktif - Bana soruyu doğrudan cevaplama, yönlendir veya konudan bir test sorusu sor.]\n` + userText;
    }
    if (isSimplify) {
      userText = `Lütfen şu konuyu/cevabını 5 yaşındaki birinin anlayacağı kadar basit, avukat argosundan uzak bir şekilde anlat: ` + userText;
    }
    
    const displayMessage = overrideText || input.trim();
    const newMessages: Message[] = [...messages, { role: "user", content: displayMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    let historyToSend = newMessages.slice(0, -1).map(m => ({
      role: m.role === "ai" ? "assistant" as const : "user" as const,
      content: m.content
    }));

    if (personalContext && historyToSend.length === 0) {
      historyToSend = [{
        role: "user",
        content: `[SİSTEM BİLGİSİ - BİLGİ AMAÇLI]: ${personalContext}`
      }];
    }

    setMessages(prev => [...prev, { role: "ai", content: "", sources: [] }]);

    try {
      const stream = streamChat({
        question: userText,
        history: historyToSend,
        model: selectedModel,
      });

      let currentText = "";
      let currentSources: ChatSource[] = [];

      for await (const ev of stream) {
        if (ev.type === "sources") {
          currentSources = ev.data;
          setMessages(prev => {
            const arr = [...prev];
            arr[arr.length - 1] = { ...arr[arr.length - 1], sources: currentSources };
            return arr;
          });
        } else if (ev.type === "token") {
          currentText += ev.data;
          setMessages(prev => {
            const arr = [...prev];
            arr[arr.length - 1] = { ...arr[arr.length - 1], content: currentText };
            return arr;
          });
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => {
        const arr = [...prev];
        arr[arr.length - 1] = { ...arr[arr.length - 1], content: `❌ Hata: ${String(e)}` };
        return arr;
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col bg-card/80 backdrop-blur-md border border-white/20 rounded-2xl shadow-xl overflow-hidden h-[600px] w-full max-w-2xl mx-auto transition-all duration-300 ${isFullscreen ? "fixed inset-4 z-50 !h-[calc(100vh-32px)] !max-w-none" : "relative"}`}>
      {/* Header */}
      <div className="p-4 border-b border-white/10 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-semibold text-lg text-gradient">İrem'in Asistanı</h2>
            <p className="text-xs text-muted-foreground hidden sm:block">Akıllı Sınav Arkadaşın</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Model Selector */}
          <div className="flex items-center gap-1.5 mr-2">
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              className="bg-zinc-900 border border-zinc-800 text-zinc-300 text-xs rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary/50 cursor-pointer"
            >
              <option value="gemini-2.5-flash">Gemini 2.5</option>
              <option value="deepseek-v4-pro">DeepSeek V4 Pro</option>
              <option value="deepseek-v4-flash">DeepSeek V4 Flash</option>
            </select>
          </div>

          {/* 9. Exam Mode Toggle */}
          <div className="flex items-center gap-2 mr-2">
            <span className="text-xs font-medium text-muted-foreground">Sınav Modu</span>
            <button 
              onClick={() => setIsExamMode(!isExamMode)}
              className={`w-10 h-5 rounded-full relative transition-colors ${isExamMode ? "bg-primary" : "bg-muted-foreground/30"}`}
            >
              <div className={`w-3 h-3 bg-white rounded-full absolute top-1 transition-transform ${isExamMode ? "right-1" : "left-1"}`} />
            </button>
          </div>

          <Button variant="ghost" size="icon" onClick={handleClearHistory} title="Sohbeti Temizle">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(!isFullscreen)} title="Tam Ekran">
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
            <Bot className="w-16 h-16 text-primary/40" />
            <div className="max-w-md space-y-2">
              <p className="font-medium text-lg text-foreground">Sana nasıl yardımcı olabilirim?</p>
              <p className="text-sm text-muted-foreground">Tüm ders kitaplarına, kanunlara ve senin performans verilerine erişimim var.</p>
            </div>
            
            {/* 2. Quick Prompts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-4 w-full max-w-lg">
              <Button variant="outline" size="sm" className="justify-start text-xs h-auto py-2" onClick={() => handleSend("Benim zayıf olduğum hukuki konular neler ve ne yapmalıyım?")}>
                📊 Çalışma Durumumu Analiz Et
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs h-auto py-2" onClick={() => handleSend("Bana Borçlar Genel'den zor bir deneme sorusu sor.")}>
                📝 Bana Rastgele Soru Sor
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs h-auto py-2" onClick={() => handleSend("Haksız fiil şartlarını kısa bir şekilde özetler misin?")}>
                ⚖️ Haksız Fiili Özetle
              </Button>
              <Button variant="outline" size="sm" className="justify-start text-xs h-auto py-2" onClick={() => handleSend("Maddi tazminat ile manevi tazminat arasındaki farklar nelerdir?")}>
                🔄 Tazminat Türlerini Karşılaştır
              </Button>
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"} animate-in slide-in-from-bottom-2 fade-in duration-300`}>
            <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl px-5 py-4 ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm shadow-md" : "bg-muted/60 border border-muted-foreground/10 rounded-bl-sm"}`}>
              {/* 5. PDF Link Redirect */}
              {m.role === "ai" && m.sources && m.sources.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2 pb-3 border-b border-border/50">
                  {m.sources.map((src, idx) => (
                    <a 
                      key={idx} 
                      href={`${pdfUrl(src.pdf)}#page=${src.page_start}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium bg-background/80 hover:bg-background text-muted-foreground hover:text-primary transition-colors border border-border/50 shadow-sm" 
                      title={`Score: ${src.score.toFixed(3)}`}
                    >
                      <FileText className="w-3 h-3 text-primary/70" />
                      [{idx + 1}] {src.pdf.replace(".pdf", "")} (s.{src.page_start})
                    </a>
                  ))}
                </div>
              )}
              
              <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none ${m.role === "user" ? "text-primary-foreground" : ""}`}>
                {m.content ? (
                  renderMessageContent(m.content)
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium animate-pulse">Yanıt oluşturuluyor...</span>
                  </div>
                )}
              </div>

              {/* Action Bar for AI message */}
              {m.role === "ai" && m.content && (
                <div className="mt-4 pt-3 border-t border-border/40 flex items-center gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => readAloud(m.content)} title="Sesli Oku">
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyToClipboard(m.content, i)} title="Kopyala">
                    {copiedIndex === i ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 text-muted-foreground" />}
                  </Button>
                  <div className="flex-1" />
                  <Button variant="outline" size="sm" className="h-8 text-xs bg-background/50 hover:bg-background" onClick={() => handleSend("Lütfen bu anlattığını daha basit, günlük bir dille, avukat argosundan uzak şekilde açıklar mısın?", true)}>
                    👶 Daha Basit Anlat
                  </Button>
                </div>
              )}
            </div>
            
            {/* 10. Dynamic Follow-ups */}
            {m.role === "ai" && m.content && i === messages.length - 1 && (
              <div className="flex flex-wrap gap-2 mt-3 ml-2">
                <Button variant="secondary" size="sm" className="text-[11px] h-7 rounded-full" onClick={() => handleSend("Bu konuyu pratik bir olay/örnek üzerinden açıklar mısın?")}>
                  ✨ Örnek Olay Ver
                </Button>
                <Button variant="secondary" size="sm" className="text-[11px] h-7 rounded-full" onClick={() => handleSend("Bana bu konudan kısa bir test sorusu sorar mısın?")}>
                  🧠 Konudan Soru Sor
                </Button>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-end gap-2 relative"
        >
          <div className="flex-1 relative bg-muted/30 rounded-2xl border focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50 transition-all">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isExamMode ? "Sınav Modu: Soruyu cevapla..." : "Hukuki bir soru sor veya istatistiklerini öğren..."}
              disabled={isLoading}
              className="w-full min-h-[52px] max-h-[150px] bg-transparent resize-none p-3 pl-4 pr-12 focus:outline-none text-sm leading-relaxed rounded-2xl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            {/* 3. Speech to Text Mic Button */}
            {recognitionRef.current && (
              <Button 
                type="button" 
                variant="ghost" 
                size="icon" 
                onClick={toggleListen}
                className={`absolute right-2 bottom-1.5 h-9 w-9 rounded-full ${isListening ? "text-red-500 bg-red-500/10 animate-pulse" : "text-muted-foreground hover:text-primary"}`}
                title="Sesli Soru Sor"
              >
                <Mic className="w-4 h-4" />
              </Button>
            )}
          </div>
          
          <Button 
            type="submit" 
            size="icon" 
            disabled={!input.trim() || isLoading}
            className={`h-[52px] w-[52px] rounded-2xl shrink-0 transition-all ${isLoading ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg"}`}
          >
            {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 ml-1" />}
          </Button>
        </form>
        <div className="text-center mt-2 text-[10px] text-muted-foreground">
          Yapay zeka hata yapabilir. Lütfen önemli hukuki işlemlerde resmi kanun metinlerini teyit edin.
        </div>
      </div>
    </div>
  );
}
