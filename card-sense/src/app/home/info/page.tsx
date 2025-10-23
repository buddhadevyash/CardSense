import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";

// --- PDF Data ---
// Corrected to use embeddable preview links and direct download links
const samplePdfs = [
  { name: "HDFC Bank", id: "1xBg-v_kpdvUtVDoYYrgM0sjO9f8HcpZh", previewUrl: "https://drive.google.com/file/d/1xBg-v_kpdvUtVDoYYrgM0sjO9f8HcpZh/preview", downloadUrl: "https://drive.google.com/uc?export=download&id=1xBg-v_kpdvUtVDoYYrgM0sjO9f8HcpZh" },
  { name: "IndusInd Bank", id: "1fbu2Pru4q9F6I11wOYcK_xbrYytpVnOo", previewUrl: "https://drive.google.com/file/d/1fbu2Pru4q9F6I11wOYcK_xbrYytpVnOo/preview", downloadUrl: "https://drive.google.com/uc?export=download&id=1fbu2Pru4q9F6I11wOYcK_xbrYytpVnOo" }, // Corrected name assumption
  { name: "ICICI Bank", id: "1o6Cz5TQ2k0DnE9Nek8RbtcQxN8FMTGYX", previewUrl: "https://drive.google.com/file/d/1o6Cz5TQ2k0DnE9Nek8RbtcQxN8FMTGYX/preview", downloadUrl: "https://drive.google.com/uc?export=download&id=1o6Cz5TQ2k0DnE9Nek8RbtcQxN8FMTGYX" },
  { name: "IDFC First Bank", id: "1Xbl_z3DhTjcE5ncuOqplGK9EwKzvjVjn", previewUrl: "https://drive.google.com/file/d/1Xbl_z3DhTjcE5ncuOqplGK9EwKzvjVjn/preview", downloadUrl: "https://drive.google.com/uc?export=download&id=1Xbl_z3DhTjcE5ncuOqplGK9EwKzvjVjn" },
  { name: "Axis Bank", id: "1nehKD_jqq5z2g3VPUsw7rnQ4Otb-wKvX", previewUrl: "https://drive.google.com/file/d/1nehKD_jqq5z2g3VPUsw7rnQ4Otb-wKvX/preview", downloadUrl: "https://drive.google.com/uc?export=download&id=1nehKD_jqq5z2g3VPUsw7rnQ4Otb-wKvX" },
];

// --- Info Page Component ---
export default function InfoPage() {
  return (
    // Inherits font-mono from layout, ensures consistent text color
    <div className="space-y-8 p-6 text-white"> {/* Added padding */}
      <h1 className="text-3xl font-bold">Project Information</h1>

      {/* Flow Diagram Section - Consistent background and text colors */}
      <Card className="bg-[#811844]/50 border-[#9E1C60]">
        <CardHeader>
          <CardTitle className="text-white">How CardSense Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-300">
          <div className="flex flex-col space-y-2">
            {/* Step 1 */}
            <div className="flex items-center gap-2">
               {/* Corrected step number text color */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5AD18] text-xs font-semibold text-[#561530]">1</span>
              <p>User uploads a PDF credit card statement via the Home page.</p>
            </div>
            <div className="ml-3 border-l-2 border-dashed border-[#9E1C60] pl-6 pb-2">
               <p className="text-sm">→ Frontend sends the file to the `/api/chat/ocr` API endpoint.</p>
            </div>
            {/* Step 2 */}
             <div className="flex items-center gap-2">
               {/* Corrected step number text color */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5AD18] text-xs font-semibold text-[#561530]">2</span>
              <p>Backend (API Route) processes the PDF.</p>
            </div>
             <div className="ml-3 border-l-2 border-dashed border-[#9E1C60] pl-6 pb-2">
               <p className="text-sm">→ Extracts full text and tables using PyMuPDF.</p>
               <p className="text-sm">→ Stores this data in memory, associated with a unique `session_id`.</p>
               <p className="text-sm">→ Returns the `session_id` and basic OCR info to the frontend.</p>
            </div>
            {/* Step 3 */}
              <div className="flex items-center gap-2">
               {/* Corrected step number text color */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5AD18] text-xs font-semibold text-[#561530]">3</span>
              <p>Frontend receives `session_id` and automatically calls `/api/chat/ocr-10`.</p>
            </div>
             <div className="ml-3 border-l-2 border-dashed border-[#9E1C60] pl-6 pb-2">
               <p className="text-sm">→ Backend retrieves the full text using the `session_id`.</p>
               <p className="text-sm">→ Sends the text to the Gemini API to extract 10 data points.</p>
                <p className="text-sm">→ Enhances/validates Gemini's output using pattern matching.</p>
               <p className="text-sm">→ Returns the structured 10 key data points.</p>
            </div>
            {/* Step 4 */}
            <div className="flex items-center gap-2">
               {/* Corrected step number text color */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5AD18] text-xs font-semibold text-[#561530]">4</span>
              <p>Frontend displays the dashboard using the 10 key data points.</p>
            </div>
            <div className="ml-3 border-l-2 border-dashed border-[#9E1C60] pl-6 pb-2">
               <p className="text-sm">→ Shows key metrics, rewards, transactions.</p>
               <p className="text-sm">→ User interacts with dashboard and AI assistant.</p>
            </div>
            {/* Step 5 */}
             <div className="flex items-center gap-2">
               {/* Corrected step number text color */}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F5AD18] text-xs font-semibold text-[#561530]">5</span>
              <p>AI Assistant handles user queries.</p>
            </div>
             <div className="ml-3 pl-6">
                <p className="text-sm">→ `@attachment`: Calls `/api/chat/chatwithpdf` for context-aware answers.</p>
                <p className="text-sm">→ General query: Calls `/api/chat/chat` for general knowledge answers.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sample PDFs Section - Consistent background and text colors */}
      <Card className="bg-[#811844]/50 border-[#9E1C60]">
        <CardHeader>
          <CardTitle className="text-white">Sample PDF Statements</CardTitle>
          <CardDescription className="text-gray-400">
            These are sample PDFs used for testing the extraction process.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {samplePdfs.map((pdf) => (
            <Card key={pdf.id} className="bg-[#561530]/70 border-[#9E1C60] overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2 text-white"> {/* Ensure title is white */}
                  <FileText size={18} /> {pdf.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-4 h-64 w-full overflow-hidden rounded-md border border-[#9E1C60] bg-[#561530]/40">
                  <iframe
                    src={pdf.previewUrl}
                    className="h-full w-full border-0"
                    title={`${pdf.name} Preview`}
                    allow="encrypted-media"
                    loading="lazy"
                  ></iframe>
                </div>
                <a
                  href={pdf.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  // Corrected download button text color to use #561530 for contrast
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-[#F5AD18] px-4 py-2 text-sm font-medium text-[#561530] transition-colors hover:bg-opacity-90"
                >
                  <Download size={16} /> Download PDF
                </a>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

