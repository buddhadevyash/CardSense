"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, History, X } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Data for prompts and history ---
const starterPrompts = [
  { text: "What was my total spending last month?" },
  { text: "Show all transactions from Amazon." },
  { text: "When is my next payment due?" },
];

const dummyHistory = [
  "What was my total spending last month?",
  "Show me all transactions from Amazon.",
  "When is my next payment due?",
  "Compare my spending in March vs. April.",
];

export default function AssistantPage() {
  // --- State Management ---
  const [isChatStarted, setIsChatStarted] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [messages, setMessages] = useState<
    { sender: "user" | "ai"; text: string }[]
  >([]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Auto-scroll to latest message ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Core Chat Logic ---
  const startConversation = (firstMessage: string) => {
    if (!isChatStarted) {
      setIsChatStarted(true);
      // **FIX:** Make history visible by default once chat starts.
      setIsHistoryVisible(true);
    }

    const newMessages: { sender: "user" | "ai"; text: string }[] = [
      ...messages,
      { sender: "user", text: firstMessage },
    ];
    setMessages(newMessages);

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [...prev, { sender: "ai", text: "Thinking..." }]);
    }, 500);

    setTimeout(() => {
      setMessages((prev) => {
        const updatedMessages = [...prev];
        updatedMessages[updatedMessages.length - 1] = {
          sender: "ai",
          text: `This is a simulated response to: "${firstMessage}"`,
        };
        return updatedMessages;
      });
    }, 2000);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === "") return;
    startConversation(inputValue);
    setInputValue("");
  };

  // --- Render Component ---
  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* Main Content Area */}
      <main
        className={cn(
          "h-full w-full transition-all duration-500 ease-in-out",
          isHistoryVisible ? "pr-0 sm:pr-[24rem]" : "pr-0"
        )}
      >
        <div
          className={cn(
            "flex h-full w-full flex-col",
            isChatStarted ? "justify-between" : "items-center justify-center"
          )}
        >
          {/* Welcome Text & Starter Prompts (Initial View) */}
          <div
            className={cn(
              "text-center transition-all duration-500 ease-in-out",
              isChatStarted
                ? "animate-fade-out pointer-events-none absolute opacity-0"
                : "animate-fade-in relative opacity-100"
            )}
          >
            <h1 className="text-4xl font-bold text-white">
              AI Statement Assistant
            </h1>
            <p className="mt-2 text-lg text-gray-300">
              Ask me anything about your statement.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt.text}
                  onClick={() => startConversation(prompt.text)}
                  className="rounded-full border border-[#9E1C60] bg-[#811844]/50 px-4 py-2 text-white transition-colors hover:bg-[#9E1C60]"
                >
                  {prompt.text}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Messages Area */}
          <div
            className={cn(
              "mx-auto w-full max-w-4xl flex-1 transform overflow-y-auto p-4 transition-opacity duration-500", // **FIX:** Added mx-auto for proper centering
              isChatStarted ? "animate-fade-in opacity-100" : "hidden"
            )}
          >
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex animate-fade-in items-end gap-2",
                    msg.sender === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-md rounded-2xl px-4 py-2",
                      msg.sender === "user"
                        ? "rounded-br-none bg-[#F5AD18] text-[#561530]"
                        : "rounded-bl-none bg-[#811844] text-white"
                    )}
                  >
                    <p>{msg.text}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Floating Input Form */}
          <div
            className={cn(
              "z-10 mx-auto w-full max-w-4xl p-4 transition-all duration-700 ease-in-out", // **FIX:** Added mx-auto for proper centering
              !isChatStarted && "mt-12"
            )}
          >
            <form
              onSubmit={handleFormSubmit}
              className="relative flex items-center"
            >
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Ask about transactions, due dates, spending habits..."
                className="w-full rounded-full border-2 border-[#9E1C60] bg-[#561530] p-4 pr-14 text-lg text-white placeholder-gray-400 transition-shadow focus:border-[#F5AD18] focus:outline-none focus:ring-2 focus:ring-[#F5AD18]/50"
              />
              <button
                type="submit"
                className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-[#F5AD18] p-2 text-[#561530] transition-transform hover:scale-110 active:scale-100"
              >
                <Send className="h-6 w-6" />
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Button to OPEN History Panel */}
      <button
        onClick={() => setIsHistoryVisible(true)}
        className={cn(
          "absolute right-4 top-4 z-30 rounded-full bg-[#9E1C60] p-3 text-white shadow-lg transition-all duration-300 hover:bg-[#F5AD18] hover:text-[#561530]",
          isChatStarted && !isHistoryVisible
            ? "animate-fade-in opacity-100"
            : "pointer-events-none opacity-0"
        )}
      >
        <History />
      </button>

      {/* History Side Panel */}
      <aside
        className={cn(
          "absolute right-0 top-0 h-full w-full max-w-sm transform bg-[#561530]/80 p-4 shadow-2xl backdrop-blur-sm transition-transform duration-500 ease-in-out",
          isHistoryVisible ? "translate-x-0" : "translate-x-full"
        )}
      >
        <Card className="h-full border-[#9E1C60] bg-transparent">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-white">Chat History</CardTitle>
            <button
              onClick={() => setIsHistoryVisible(false)}
              className="rounded-full p-1 text-white transition-colors hover:bg-[#9E1C60]"
            >
              <X className="h-5 w-5" />
            </button>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {dummyHistory.map((item, index) => (
                <li
                  key={index}
                  onClick={() => startConversation(item)}
                  className="cursor-pointer rounded-lg bg-[#811844] p-3 text-gray-200 transition-colors hover:bg-[#9E1C60]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}

