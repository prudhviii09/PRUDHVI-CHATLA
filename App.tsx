import React, { useState, useRef, useEffect } from 'react';
import { Mic, Send, Image as ImageIcon, X, StopCircle, Command, WifiOff } from 'lucide-react';
import { Message, Role, Attachment, SystemAction } from './types';
import { sendMessageToGemini, resetChat } from './services/geminiService';
import { processOfflineCommand } from './services/offlineService';
import VoiceOrb from './components/VoiceOrb';
import ChatMessage from './components/ChatMessage';
import SystemHUD from './components/SystemHUD';

// Simple polyfill for SpeechRecognition
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

const WAKE_WORD = "hey buddy";

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  
  // Voice State
  const [listeningState, setListeningState] = useState<'off' | 'standby' | 'active'>('off');
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  
  const [lastSystemAction, setLastSystemAction] = useState<SystemAction | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const results = event.results;
        const lastResult = results[results.length - 1];
        const transcript = lastResult[0].transcript.toLowerCase();
        const isFinal = lastResult.isFinal;

        setListeningState(currentState => {
          // If we are in STANDBY, check for wake word
          if (currentState === 'standby') {
            if (transcript.includes(WAKE_WORD)) {
              // Extract the command after "hey buddy" if it exists
              const commandPart = transcript.split(WAKE_WORD)[1]?.trim();
              if (commandPart) {
                setInputValue(commandPart);
              } else {
                setInputValue('');
              }
              // Reset silence timer to prevent immediate cut-off
              resetSilenceTimer();
              return 'active';
            }
          } 
          
          // If we are ACTIVE, capture the command
          if (currentState === 'active') {
            // Need to be careful with continuous results vs single utterance
            // For simplicity, we grab the latest transcript part
            const cleanTranscript = transcript.includes(WAKE_WORD) 
              ? transcript.split(WAKE_WORD).pop()?.trim() || ''
              : transcript;

            setInputValue(cleanTranscript);
            resetSilenceTimer();
          }

          return currentState;
        });
      };

      recognition.onerror = (event: any) => {
        console.warn('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
           setListeningState('off');
           setRecognitionError("Mic access denied");
        }
        // If it's a network error or no-speech, we might want to restart
      };

      recognition.onend = () => {
        // Auto-restart if we are supposed to be listening (Standby or Active)
        // This keeps the "Always On" feel
        setListeningState(current => {
          if (current !== 'off') {
             try {
               recognitionRef.current?.start();
             } catch (e) { /* ignore already started */ }
          }
          return current;
        });
      };

      recognitionRef.current = recognition;
    }
  }, []);

  // Handle Silence Detection to Auto-Send
  const resetSilenceTimer = () => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    
    silenceTimerRef.current = setTimeout(() => {
      // If we are active and have text, send it!
      setListeningState(current => {
        if (current === 'active') {
          // Use a timeout to break the state update cycle and trigger send
          setTimeout(() => {
             // Only send if there is content
             setInputValue(val => {
               if (val.trim()) handleSend(val);
               return '';
             });
          }, 0);
          return 'standby'; // Go back to waiting for "Hey Buddy"
        }
        return current;
      });
    }, 2500); // 2.5 seconds of silence = send command
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition not supported in this browser.");
      return;
    }

    if (listeningState !== 'off') {
      recognitionRef.current.stop();
      setListeningState('off');
    } else {
      recognitionRef.current.start();
      setListeningState('standby');
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1];
      
      const newAttachment: Attachment = {
        mimeType: file.type,
        data: base64Data,
        previewUrl: result
      };

      setAttachments(prev => [...prev, newAttachment]);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSystemAction = (action: SystemAction) => {
    setLastSystemAction(action);
  };

  const handleSend = async (overrideText?: string) => {
    const textToSend = overrideText !== undefined ? overrideText : inputValue;

    if ((!textToSend.trim() && attachments.length === 0) || isLoading) return;

    const userText = textToSend.trim();
    const currentAttachments = [...attachments];
    
    // Reset inputs
    setInputValue('');
    setAttachments([]);
    // Note: We don't stop listening here completely, we just transitioned to standby in the silence handler
    
    // Create User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: Role.USER,
      text: userText,
      attachments: currentAttachments,
      timestamp: Date.now()
    };

    // Create Placeholder Bot Message
    const botMsgId = (Date.now() + 1).toString();
    const botMsg: Message = {
      id: botMsgId,
      role: Role.MODEL,
      text: '', 
      timestamp: Date.now(),
      isStreaming: true
    };

    setMessages(prev => [...prev, userMsg, botMsg]);
    setIsLoading(true);

    try {
      if (navigator.onLine) {
        // --- ONLINE MODE: Use Gemini ---
        const stream = await sendMessageToGemini(userText, currentAttachments, handleSystemAction);
        let fullText = '';
        for await (const chunk of stream) {
          fullText += chunk;
          setMessages(prev => prev.map(msg => 
            msg.id === botMsgId ? { ...msg, text: fullText } : msg
          ));
        }
      } else {
        // --- OFFLINE MODE: Use Local Logic ---
        const offlineResponse = await processOfflineCommand(userText, handleSystemAction);
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId ? { ...msg, text: offlineResponse } : msg
        ));
      }

      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId ? { ...msg, isStreaming: false } : msg
      ));

    } catch (error) {
      console.error(error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, text: "I'm having trouble connecting. Try checking your internet connection.", isStreaming: false } 
          : msg
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex flex-col h-screen bg-[#050505] text-white overflow-hidden font-sans selection:bg-cyan-500/30">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-50%] left-[-20%] w-[80%] h-[80%] rounded-full bg-blue-900/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-purple-900/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
      </div>

      <SystemHUD lastAction={lastSystemAction} />

      {/* Header / Orb Area */}
      <div className="flex-none p-4 flex flex-col items-center justify-center min-h-[180px] relative z-10">
        <div className="absolute top-4 right-4 z-50">
           <button 
             onClick={() => { setMessages([]); resetChat(); }} 
             className="text-[10px] flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-black/20 text-white/40 hover:text-white/80 hover:bg-white/5 transition-all uppercase tracking-widest hover:border-white/30"
           >
             <Command size={10} />
             Reset Core
           </button>
        </div>
        
        <VoiceOrb 
          isActive={messages.length === 0 || listeningState === 'active' || isLoading} 
          isListening={listeningState === 'active'}
          isLoading={isLoading}
        />
        
        <div className="mt-8 flex flex-col items-center gap-2">
           {messages.length === 0 && listeningState === 'off' && (
             <h1 className="text-3xl font-extralight text-transparent bg-clip-text bg-gradient-to-b from-white via-white/80 to-white/20 tracking-tight animate-fade-in-up">
               Hello, I'm Buddy
             </h1>
           )}
           
           <div className={`px-4 py-1.5 rounded-full text-xs font-mono tracking-wider transition-all duration-500 ${
             listeningState === 'active' 
               ? 'bg-red-500/20 text-red-200 border border-red-500/30'
               : listeningState === 'standby'
               ? 'bg-cyan-500/10 text-cyan-200 border border-cyan-500/20'
               : 'bg-zinc-800/50 text-zinc-500 border border-white/5'
           }`}>
             {listeningState === 'active' ? "LISTENING..." : listeningState === 'standby' ? "LISTENING FOR 'HEY BUDDY'" : "MICROPHONE OFF"}
           </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 md:px-20 lg:px-64 pb-4 z-10 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
        <div className="flex flex-col min-h-full justify-end">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 md:px-20 lg:px-64 z-20">
        <div className="bg-gradient-to-t from-black via-[#050505] to-transparent pt-10 pb-2">
          
          {/* Attachment Previews */}
          {attachments.length > 0 && (
            <div className="flex gap-3 mb-3 px-2 overflow-x-auto pb-2">
              {attachments.map((att, idx) => (
                <div key={idx} className="relative group animate-in fade-in zoom-in duration-300">
                  <div className="absolute inset-0 bg-cyan-500/20 blur-md rounded-lg"></div>
                  <img 
                    src={att.previewUrl} 
                    alt="preview" 
                    className="relative h-20 w-20 object-cover rounded-lg border border-cyan-500/30" 
                  />
                  <button 
                    onClick={() => removeAttachment(idx)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm z-20"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className={`relative flex items-center gap-2 backdrop-blur-xl border rounded-2xl p-2 shadow-2xl ring-1 transition-all duration-300 ${
            listeningState === 'active' 
              ? 'bg-zinc-900/80 border-cyan-500/50 ring-cyan-500/20' 
              : 'bg-zinc-900/60 border-white/5 ring-white/5'
          }`}>
            
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-zinc-400 hover:text-cyan-400 hover:bg-cyan-950/30 rounded-xl transition-all"
              title="Analyze Visual Data"
            >
              <ImageIcon size={20} />
            </button>

            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={listeningState === 'active' ? "Speaking..." : "Enter command or say 'Hey Buddy'..."}
              className="flex-1 bg-transparent border-none focus:ring-0 text-white placeholder-zinc-500 resize-none max-h-32 py-3 px-2 text-base"
              rows={1}
              style={{ minHeight: '44px' }}
            />

            <button
              onClick={toggleListening}
              className={`p-3 rounded-xl transition-all duration-300 ${
                listeningState !== 'off' 
                  ? 'text-cyan-400 bg-cyan-950/30 animate-pulse ring-1 ring-cyan-500/30' 
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
              title={listeningState === 'off' ? "Turn On Mic" : "Turn Off Mic"}
            >
              {listeningState === 'off' ? <Mic size={20} /> : <StopCircle size={20} />}
            </button>

            <button 
              onClick={() => handleSend()}
              disabled={(!inputValue.trim() && attachments.length === 0) || isLoading}
              className={`p-3 rounded-xl transition-all duration-300 ${
                (!inputValue.trim() && attachments.length === 0) || isLoading
                  ? 'text-zinc-600 bg-zinc-800/50' 
                  : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_15px_rgba(8,145,178,0.4)]'
              }`}
            >
              <Send size={18} className={isLoading ? 'opacity-50' : ''} />
            </button>
          </div>
          
          <div className="text-center mt-3 flex items-center justify-center gap-2 opacity-40">
             <div className={`h-1 w-1 rounded-full animate-pulse ${navigator.onLine ? 'bg-green-500' : 'bg-orange-500'}`}></div>
             <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-mono">
               {navigator.onLine ? "Gemini-3-Pro-Preview // Systems Nominal" : "Offline Mode // Local Core Active"}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;