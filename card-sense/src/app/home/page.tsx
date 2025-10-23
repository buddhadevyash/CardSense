"use client";

import { useState, useRef, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FileUp,
  Send,
  Mic,
  Volume2,
  Paperclip,
  XCircle,
  Loader2,
  Download,
  CreditCard,
  Search,
  Calendar,
  IndianRupee,
  Wallet,
  TrendingUp,
  FileText,
  Gift,
  Landmark, // Correct Icon
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import ReactMarkdown from 'react-markdown'; // Import react-markdown

// --- Type Definitions for API Responses & State ---
interface OcrTable {
  page: number;
  table_number: number;
  data: (string | null)[][];
}

interface OcrResponse {
  success: boolean;
  extracted_text: string;
  tables: OcrTable[];
  images_count: number;
  session_id: string;
  message: string;
}

interface Transaction {
  date: string | null;
  description: string | null;
  amount: string | number | null; // Allow number for amount
}

interface RewardPoints {
    opening_balance: string | number | null;
    earned: string | number | null;
    closing_balance: string | number | null;
}

// Updated interface to match the 10-point backend response structure
interface Ocr10Data {
  customer_name: string | null;
  statement_date: string | null;
  payment_due_date: string | null;
  total_amount_due: string | number | null; // Allow number
  minimum_amount_due: string | number | null; // Allow number
  credit_limit: string | number | null; // Allow number
  available_credit_limit: string | number | null; // Allow number
  transactions: Transaction[];
  reward_points_summary: RewardPoints | null;
  bank_name: string | null;
  card_number: string | null;
}

interface Ocr10Response {
  success: boolean;
  session_id: string;
  extracted_data: Ocr10Data;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: any) => void;
  onerror: (event: any) => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

// --- Chart Placeholder Data ---
const categoryData = [
    { name: 'Food & Dining', value: 400 },
    { name: 'Shopping', value: 300 },
    { name: 'Travel', value: 300 },
    { name: 'Utilities', value: 200 },
];
const COLORS = ['#F5AD18', '#9E1C60', '#811844', '#561530'];

const topCategoriesData = [
  { name: 'Food', total: 4000 },
  { name: 'Shopping', total: 3000 },
  { name: 'Travel', total: 2000 },
  { name: 'Utilities', total: 1000 },
];


// --- Helper Components ---
const DataCard = ({ title, value, icon }: { title: string, value: string | number | null, icon: React.ReactNode }) => (
    <Card className="bg-[#811844]/50 border-[#9E1C60]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-300">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold text-white">{String(value || 'N/A')}</div>
        </CardContent>
    </Card>
);

// --- Main Home Page Component ---
export default function HomePage() {
  // --- State Management ---
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [ocrData, setOcrData] = useState<OcrResponse | null>(null); // State to hold full OCR data
  const [ocr10Data, setOcr10Data] = useState<Ocr10Response | null>(null); // State for 10 key data points
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading10Keys, setIsLoading10Keys] = useState(false);
  const [transactionSearch, setTransactionSearch] = useState("");

  const [messages, setMessages] = useState<
    { sender: "user" | "ai"; text: string; isAttachment?: boolean }[]
  >([]);
  const [inputValue, setInputValue] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [showAttachmentSuggestion, setShowAttachmentSuggestion] =
    useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Utility Functions ---
  const API_BASE_URL = "http://127.0.0.1:8000"; // Using FastAPI backend URL

  const downloadJson = (data: object | null, filename: string) => {
    if (!data) {
        alert("No data available to download.");
        return;
    };
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const convertArrayToCsv = (data: any[]): string => {
    if (!data || data.length === 0) return "";
    const sanitizedData = data.filter(item => typeof item === 'object' && item !== null);
    if(sanitizedData.length === 0) return "";
    const headers = Object.keys(sanitizedData[0]);
    const csvRows = [
      headers.join(","), // Header row
      ...sanitizedData.map((row) => // Data rows
        headers
          .map((header) => JSON.stringify(row[header as keyof typeof row] || "")) // Access value using header key
          .join(",")
      ),
    ];
    return csvRows.join("\n");
  };

  const convertOcrTablesToCsvData = (tables: OcrTable[] | undefined): any[] => {
      if (!tables) return [];
      let csvData: any[] = [];
      tables.forEach(table => {
          if (!table.data || table.data.length < 1) return;
          const headers = table.data[0] || [];
          table.data.slice(1).forEach(row => {
              let obj: { [key: string]: any } = { page: table.page, table_number: table.table_number };
              headers.forEach((header, i) => {
                 const key = (header && typeof header === 'string') ? header.replace(/[\n\r]+/g, ' ').trim() : `col_${i}`;
                 obj[key] = row[i];
              });
              csvData.push(obj);
          });
      });
      return csvData;
  };

  const downloadCsv = (data: any[], filename: string) => {
    const csvStr = convertArrayToCsv(data);
    if (!csvStr) {
        alert("No data available to download.");
        return;
    }
    const blob = new Blob([csvStr], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const resetState = () => {
    setUploadedFile(null);
    setSessionId(null);
    setOcrData(null); // Reset full OCR data
    setOcr10Data(null); // Reset 10 key data
    setIsUploading(false);
    setIsLoading10Keys(false);
    setMessages([]); // Clear chat messages
    if(inputRef.current) inputRef.current.value = "";
  };

  // --- API Handlers ---
  const fetchOcr10Data = async (sessionId: string) => {
    setIsLoading10Keys(true);
    try {
      // Fetch using the GET endpoint
      const response = await fetch(`${API_BASE_URL}/ocr-10?session_id=${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch 10 key parameters.");
      const data: Ocr10Response = await response.json();
      if (data.success) {
        setOcr10Data(data); // Store the 10 key data
      } else {
        throw new Error(data.message || "API returned an error.");
      }
    } catch (error) {
      console.error("Error fetching OCR-10 data:", error);
      alert(`Error: ${(error as Error).message}`);
    } finally {
      setIsLoading10Keys(false);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || file.type !== "application/pdf") {
      alert("Please upload a valid PDF file.");
      return;
    }

    resetState();
    setUploadedFile(file);
    setIsUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      // First, call /ocr to get the session_id and full data
      const ocrResponse = await fetch(`${API_BASE_URL}/ocr`, {
        method: "POST",
        body: formData,
      });

      if (!ocrResponse.ok) throw new Error("Network response for /ocr was not ok. Check if the backend is running.");

      const ocrResult: OcrResponse = await ocrResponse.json();
      if (ocrResult.success) {
        setOcrData(ocrResult); // Store the full OCR result
        setSessionId(ocrResult.session_id);
        // Automatically fetch the 10 keys using the obtained session ID
        await fetchOcr10Data(ocrResult.session_id);
      } else {
        throw new Error(ocrResult.message || "Failed to process PDF via /ocr.");
      }
    } catch (error) {
      console.error("Error during file processing chain:", error);
      alert(`Error: ${(error as Error).message}`);
      resetState();
    } finally {
      setIsUploading(false);
    }
  };


  // --- Chat Handlers ---
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() === "" || isLoadingAI) return; // Prevent multiple submissions
    setShowAttachmentSuggestion(false);

    const isAttachmentQuery = !!(
      uploadedFile && inputValue.includes("@attachment")
    );
    const userMessage = {
      sender: "user" as const,
      text: inputValue,
      isAttachment: isAttachmentQuery,
    };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoadingAI(true);

    try {
      const endpoint = isAttachmentQuery ? `${API_BASE_URL}/chatwithpdf` : `${API_BASE_URL}/chat`;
      const body = { question: inputValue, session_id: sessionId || undefined };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Failed to get response from AI.");

      const data = await response.json();
      if (data.success) {
        const aiMessage = { sender: "ai" as const, text: data.answer };
        setMessages((prev) => [...prev, aiMessage]);
      } else {
        throw new Error(data.message || data.answer || "API returned an error.");
      }
    } catch (error) {
      const errorMessage = {
        sender: "ai" as const,
        text: `Sorry, I encountered an error: ${(error as Error).message}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoadingAI(false);
    }
  };

  // --- Accessibility & Input Handlers ---
  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        setInputValue(event.results[0][0].transcript);
        setIsRecording(false);
      };
      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsRecording(false);
      };
      recognitionRef.current = recognition;
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setShowAttachmentSuggestion(
      !!(uploadedFile && value.includes("@") && !value.includes("@attachment"))
    );
  };

  const handleSuggestionClick = () => {
    setInputValue((prev) => prev.replace(/@\S*/, "@attachment "));
    setShowAttachmentSuggestion(false);
    inputRef.current?.focus();
  };

  const toggleRecording = () => {
    if(!recognitionRef.current) {
        alert("Speech recognition not supported or enabled in this browser.");
        return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
    setIsRecording(!isRecording);
  };

  const speakText = (text: string) => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel(); // Cancel any previous speech
      speechSynthesis.speak(new SpeechSynthesisUtterance(text));
    } else {
        alert("Text-to-speech not supported in this browser.");
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredTransactions =
    ocr10Data?.extracted_data.transactions?.filter((tx) =>
      tx.description?.toLowerCase().includes(transactionSearch.toLowerCase())
    ) || [];

  // --- Render Component ---
  return (
    <div className="grid h-full w-full grid-cols-1 p-4 md:grid-cols-2 md:gap-8">
      {/* Left Column: File Upload & OCR View */}
      <div className="flex h-full flex-col items-center justify-start overflow-y-auto pr-2">
        {(!sessionId && !isUploading) && (
          <Card className="w-full max-w-lg border-2 border-dashed border-[#9E1C60] bg-[#561530]/50 text-center mt-10">
            <CardHeader>
              <CardTitle className="text-2xl font-bold text-white">Upload Your Statement</CardTitle>
              <CardDescription className="text-gray-300">A new session will start upon upload.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center space-y-4 p-8">
              <input type="file" id="file-upload" className="hidden" accept=".pdf" onChange={handleFileChange} />
              <label htmlFor="file-upload" className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-[#9E1C60] p-12 transition-colors hover:border-[#F5AD18] hover:bg-[#811844]/50">
                <FileUp className="h-12 w-12 text-gray-400" />
                <p className="mt-2 text-white">Select a PDF</p>
              </label>
            </CardContent>
          </Card>
        )}

        {(isUploading || isLoading10Keys) && (
            <div className="flex flex-col items-center justify-center h-full w-full">
                <Loader2 className="h-16 w-16 animate-spin text-[#F5AD18]" />
                <p className="mt-4 text-white text-lg">{isUploading ? "Processing PDF..." : "Extracting Key Data..."}</p>
            </div>
        )}

        {ocr10Data && (
          <div className="w-full max-w-4xl space-y-6 animate-fade-in">
            {/* Header Card */}
            <Card className="w-full bg-gradient-to-r from-[#811844] to-[#561530] text-white shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle className="text-2xl">{ocr10Data.extracted_data.bank_name || 'Bank Statement'}</CardTitle>
                            <CardDescription className="text-gray-300">
                                {ocr10Data.extracted_data.customer_name || 'Customer'}
                            </CardDescription>
                        </div>
                        <button onClick={resetState} className="text-gray-300 hover:text-white"><XCircle /></button>
                    </div>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                        <p className="text-sm text-gray-300">Statement Date</p>
                        <p className="font-bold">{ocr10Data.extracted_data.statement_date || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-300">Due Date</p>
                        <p className="font-bold">{ocr10Data.extracted_data.payment_due_date || 'N/A'}</p>
                    </div>
                    <div>
                        <p className="text-sm text-gray-300">Total Due</p>
                        <p className="font-bold text-xl">{ocr10Data.extracted_data.total_amount_due ?? '0.00'}</p>
                    </div>
                     <div>
                        <p className="text-sm text-gray-300">Minimum Due</p>
                        <p className="font-bold text-xl">{ocr10Data.extracted_data.minimum_amount_due ?? '0.00'}</p>
                    </div>
                </CardContent>
            </Card>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <DataCard title="Credit Limit" value={ocr10Data.extracted_data.credit_limit} icon={<IndianRupee className="h-4 w-4 text-gray-400" />} />
                <DataCard title="Available Credit" value={ocr10Data.extracted_data.available_credit_limit} icon={<Wallet className="h-4 w-4 text-gray-400" />} />
                <DataCard title="Total Transactions" value={ocr10Data.extracted_data.transactions?.length || 0} icon={<TrendingUp className="h-4 w-4 text-gray-400" />} />
                <DataCard title="Card Number" value={`**** ${ocr10Data.extracted_data.card_number?.slice(-4) || 'XXXX'}`} icon={<CreditCard className="h-4 w-4 text-gray-400" />} />
            </div>

            {/* Rewards Card */}
            {ocr10Data.extracted_data.reward_points_summary && (
                <Card className="bg-[#561530]/50 text-white shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Gift size={20} /> Reward Points Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-sm text-gray-300">Opening Balance</p>
                            <p className="font-bold text-lg">{ocr10Data.extracted_data.reward_points_summary.opening_balance ?? 'N/A'}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-300">Earned</p>
                            <p className="font-bold text-lg text-green-400">+{ocr10Data.extracted_data.reward_points_summary.earned ?? 0}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-300">Closing Balance</p>
                            <p className="font-bold text-lg">{ocr10Data.extracted_data.reward_points_summary.closing_balance ?? 'N/A'}</p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Transaction History */}
            <Card className="w-full bg-[#561530]/50 text-white shadow-lg">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Transaction History</CardTitle>
                        <div className="relative w-1/2">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search transactions..."
                                value={transactionSearch}
                                onChange={(e) => setTransactionSearch(e.target.value)}
                                className="w-full rounded-md bg-[#811844] pl-9 pr-3 py-1.5 text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#F5AD18]"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="border-b border-[#9E1C60]">
                                    <th className="p-3">Date</th>
                                    <th className="p-3">Description</th>
                                    <th className="p-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTransactions.map((tx, index) => (
                                    <tr key={index} className="border-b border-[#9E1C60]/50">
                                        <td className="p-3 text-gray-300">{tx.date}</td>
                                        <td className="p-3">{tx.description}</td>
                                        <td className="p-3 text-right font-medium">{String(tx.amount)}</td> {/* Ensure amount is string */}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                         {filteredTransactions.length === 0 && (
                            <p className="text-center py-8 text-gray-400">No transactions found.</p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Download Section */}
            <Card className="w-full bg-[#561530]/50 text-white shadow-lg">
                <CardHeader>
                    <CardTitle>Download Data</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-center rounded-lg bg-[#811844]/50 p-4">
                        <div>
                            <h4 className="font-semibold">Full Extracted Data</h4>
                            <p className="text-sm text-gray-300">Includes full text and all tables.</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => downloadJson(ocrData, "full_extract.json")} disabled={!ocrData} className="flex items-center gap-1 rounded bg-[#F5AD18] px-3 py-1 text-sm text-[#561530] disabled:opacity-50"><Download size={16} /> JSON</button>
                             <button onClick={() => downloadCsv(convertOcrTablesToCsvData(ocrData?.tables), "extracted_tables.csv")} disabled={!ocrData} className="flex items-center gap-1 rounded bg-[#F5AD18] px-3 py-1 text-sm text-[#561530] disabled:opacity-50"><FileText size={16} /> Tables (CSV)</button>
                        </div>
                    </div>
                    <div className="flex justify-between items-center rounded-lg bg-[#811844]/50 p-4">
                        <div>
                            <h4 className="font-semibold">Key Parameters</h4>
                            <p className="text-sm text-gray-300">Includes 10 key data points and transactions.</p>
                        </div>
                        <div className="flex gap-2">
                             <button onClick={() => downloadJson(ocr10Data, "key_parameters.json")} disabled={!ocr10Data} className="flex items-center gap-1 rounded bg-[#F5AD18] px-3 py-1 text-sm text-[#561530] disabled:opacity-50"><Download size={16} /> JSON</button>
                             <button onClick={() => ocr10Data && downloadCsv(ocr10Data.extracted_data.transactions, "transactions.csv")} disabled={!ocr10Data} className="flex items-center gap-1 rounded bg-[#F5AD18] px-3 py-1 text-sm text-[#561530] disabled:opacity-50"><FileText size={16} /> Transactions (CSV)</button>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Right Column: AI Assistant */}
      <div className="flex h-full flex-col rounded-lg border-2 border-[#811844] bg-[#561530]/50 p-4">
        <div className="flex-1 overflow-y-auto p-2">
          <div className="space-y-4">
            {messages.length === 0 && (
                 <div className="flex h-full items-center justify-center text-center text-gray-400">
                    <p>Ask a general question or upload a PDF to start a session.</p>
                 </div>
            )}
            {messages.map((msg, index) => (
              <div key={index} className={cn("flex animate-fade-in items-end gap-2", msg.sender === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-md rounded-2xl px-4 py-2", msg.sender === "user" ? "rounded-br-none bg-[#F5AD18] text-[#561530]" : "rounded-bl-none bg-[#811844] text-white")}>
                  {msg.isAttachment && (<div className="mb-1 flex items-center gap-1 text-xs text-gray-300"><Paperclip className="h-3 w-3" /><span>attachment query</span></div>)}
                  {/* Render AI response using ReactMarkdown with Tailwind Prose */}
                  {msg.sender === 'ai' ? (
                     <ReactMarkdown /* Removed className */ >
                       {msg.text}
                     </ReactMarkdown>
                  ) : (
                     <p>{msg.text}</p>
                  )}
                </div>
                {msg.sender === "ai" && (<button onClick={() => speakText(msg.text)} className="text-gray-400 hover:text-white"><Volume2 className="h-5 w-5" /></button>)}
              </div>
            ))}
            {isLoadingAI && (<div className="flex justify-start"><div className="flex items-center gap-2 rounded-2xl rounded-bl-none bg-[#811844] px-4 py-2 text-white"><Loader2 className="h-5 w-5 animate-spin" /><span>Thinking...</span></div></div>)}
            <div ref={messagesEndRef} />
          </div>
        </div>
        <div className="relative mt-4 border-t-2 border-[#811844] pt-4">
          <form onSubmit={handleFormSubmit} className="relative flex items-center">
            {showAttachmentSuggestion && (<div onClick={handleSuggestionClick} className="absolute bottom-16 left-0 z-10 w-full max-w-xs cursor-pointer rounded-lg bg-[#811844] p-3 text-white shadow-lg transition-colors hover:bg-[#9E1C60]"><div className="flex items-center gap-2"><Paperclip className="h-5 w-5 text-[#F5AD18]" /><div className="overflow-hidden"><span className="font-bold">@attachment</span><p className="truncate text-sm text-gray-300">{uploadedFile?.name}</p></div></div></div>)}
            <input ref={inputRef} type="text" value={inputValue} onChange={handleInputChange} placeholder="Ask a question..." className="w-full rounded-full border-2 border-[#9E1C60] bg-[#561530] p-4 pr-24 text-lg text-white placeholder-gray-400 focus:border-[#F5AD18] focus:outline-none focus:ring-2 focus:ring-[#F5AD18]/50"/>
            <div className="absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2">
              <button type="button" onClick={toggleRecording} className={cn("rounded-full p-2 text-white transition-colors", isRecording ? "bg-[#F5AD18] text-[#561530]" : "hover:bg-[#811844]")}><Mic className="h-6 w-6" /></button>
              <button type="submit" disabled={isLoadingAI} className="rounded-full bg-[#F5AD18] p-2 text-[#561530] transition-transform hover:scale-110 active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"><Send className="h-6 w-6" /></button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

