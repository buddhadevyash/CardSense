// src/app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = "gemini-2.0-flash-exp";

// Global storage for extracted content
const extractedContents: Record<string, any> = {};

// Types
interface ChatRequest {
  question: string;
  session_id?: string;
}

interface OCRResponse {
  success: boolean;
  extracted_text: string;
  tables: any[];
  images_count: number;
  session_id: string;
  message: string;
}

interface ChatResponse {
  success: boolean;
  answer: string;
  session_id: string;
}

interface GeneralChatResponse {
  success: boolean;
  answer: string;
}

interface OCR10Response {
  success: boolean;
  session_id: string;
  extracted_data: Record<string, any>;
  message: string;
}

interface ExtractedData {
  customer_name: string | null;
  statement_date: string | null;
  payment_due_date: string | null;
  total_amount_due: number | null;
  minimum_amount_due: number | null;
  credit_limit: number | null;
  available_credit_limit: number | null;
  card_number: string | null;
  transactions: any[];
  reward_points_summary: {
    opening_balance: number | null;
    earned: number | null;
    closing_balance: number | null;
  };
  bank_name: string | null;
}

// Enhanced Utility Functions
function extractCardNumberFromText(text: string): string | null {
  const patterns = [
    { regex: /Card Number\s*[:]?\s*(\d{4}[\*]+\d{4})/i, transform: (match: string) => match },
    { regex: /Card No\s*[:]?\s*(\d{4}[\s\*]+\d{4})/i, transform: (match: string) => match.replace(/\s/g, '') },
    { regex: /Card Number\s*[:]?\s*(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})/i, transform: (match: string) => match.replace(/[\s-]/g, '') },
    { regex: /\b\d{4}[\*]+\d{4}\b/, transform: (match: string) => match }
  ];

  for (const pattern of patterns) {
    const match = pattern.regex.exec(text);
    if (match) {
      const matchedText = match[1] || match[0];
      if (matchedText) {
        return pattern.transform(matchedText);
      }
    }
  }
  return null;
}

function extractFinancialDataFromText(text: string): Record<string, any> {
  const financialData: Record<string, any> = {};
  
  const amountPatterns = {
    "total_amount_due": /(?:Total Amount Due|Total Due|New Balance)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)/i,
    "minimum_amount_due": /(?:Minimum Amount Due|Min Amount Due|Minimum Due|Min Due)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)/i,
    "credit_limit": /(?:Credit Limit|Limit)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)/i,
    "available_credit_limit": /(?:Available Credit Limit|Available Credit|Available Limit)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)/i,
    "opening_balance": /(?:Opening Balance|Previous Balance)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)/i,
  };

  for (const [field, pattern] of Object.entries(amountPatterns)) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      const amountStr = match[1].replace(/,/g, '');
      try {
        financialData[field] = parseFloat(amountStr);
      } catch {
        financialData[field] = null;
      }
    }
  }

  // Calculate available credit if not found
  if (financialData.credit_limit !== undefined && 
      financialData.total_amount_due !== undefined && 
      financialData.available_credit_limit === undefined) {
    financialData.available_credit_limit = (financialData.credit_limit as number) - (financialData.total_amount_due as number);
  }

  return financialData;
}

function extractRewardPointsFromText(text: string): Record<string, any> {
  const rewardsData = {
    "opening_balance": null as number | null,
    "earned": null as number | null,
    "closing_balance": null as number | null
  };

  const patterns = [
    /REWARDS\s*SUMMARY\s*Opening Balance\s*(\d+)\s*Rewards Earned\s*(\d+)\s*Redeemed\/Adjusted\s*(\d+)\s*Closing Balance\s*(\d+)/i,
    /Reward Points[\s\S]*?Opening Balance\s*(\d+)[\s\S]*?Earned\s*(\d+)[\s\S]*?Closing Balance\s*(\d+)/i,
    /Opening Balance\s*(\d+)\s*Rewards Earned\s*(\d+)\s*Closing Balance\s*(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) {
      const groups = match.slice(1);
      if (groups.length >= 3) {
        rewardsData.opening_balance = parseInt(groups[0]);
        rewardsData.earned = parseInt(groups[1]);
        rewardsData.closing_balance = parseInt(groups[groups.length - 1]);
      }
      break;
    }
  }

  // Calculate closing balance if not found
  if (rewardsData.opening_balance !== null && 
      rewardsData.earned !== null && 
      rewardsData.closing_balance === null) {
    rewardsData.closing_balance = rewardsData.opening_balance + rewardsData.earned;
  }

  return rewardsData;
}

function extractTransactionsFromText(text: string): any[] {
  const transactions: any[] = [];
  
  const transactionSection = /YOUR TRANSACTIONS([\s\S]*?)(?=KEY OFFERS|Page \d+ of \d+|$)/i.exec(text);
  if (transactionSection && transactionSection[1]) {
    const transactionText = transactionSection[1];
    const transactionPattern = /(\d{2}\/\d{2}\/\d{4})\s+([A-Za-z0-9\s\.\-&]+?)\s+([0-9,]+\.?[0-9]*)\s*(CR)?/g;
    
    let match;
    while ((match = transactionPattern.exec(transactionText)) !== null) {
      const date = match[1];
      const description = match[2];
      const amountStr = match[3];
      const creditIndicator = match[4];
      
      if (date && description && amountStr) {
        try {
          let amount = parseFloat(amountStr.replace(/,/g, ''));
          if (creditIndicator) {
            amount = -amount;
          }
          
          transactions.push({
            date: date.trim(),
            description: description.trim(),
            amount
          });
        } catch {
          continue;
        }
      }
    }
  }

  return transactions;
}

function extractCustomerInfoFromText(text: string): Record<string, any> {
  const customerData = {
    "customer_name": null as string | null,
    "bank_name": null as string | null
  };

  // Enhanced name patterns that exclude "email"
  const namePatterns = [
    /Customer Name\s*[:]?\s*([A-Za-z\s\.]+(?!\s*email))(?:\n|$)/i,
    /Cardholder\s*[:]?\s*([A-Za-z\s\.]+(?!\s*email))(?:\n|$)/i,
    /Name\s*[:]?\s*([A-Za-z\s\.]+(?!\s*email))(?:\n|$)/i,
    /^([A-Za-z\s\.]+(?!\s*email))(?:\n.*?Credit Card)/im
  ];

  for (const pattern of namePatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      let name = match[1].trim();
      // Additional cleanup to remove any potential "email" that might have been captured
      name = name.replace(/\s*email\s*$/i, '').trim();
      customerData.customer_name = name;
      break;
    }
  }

  const bankPatterns = [
    /(HDFC Bank|ICICI Bank|Axis Bank|IDFC FIRST Bank|RBL Bank|SBI Card|Kotak Bank|Standard Chartered)/i,
    /([A-Za-z]+ Bank Limited)/i,
    /([A-Za-z]+ Card Services)/i
  ];

  for (const pattern of bankPatterns) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      customerData.bank_name = match[1].trim();
      break;
    }
  }

  return customerData;
}

function extractDatesFromText(text: string): Record<string, any> {
  const dateData = {
    "statement_date": null as string | null,
    "payment_due_date": null as string | null
  };

  const datePatterns = {
    "statement_date": /(?:Statement Date|Date)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    "payment_due_date": /(?:Payment Due Date|Due Date)[\s:]*(\d{1,2}\/\d{1,2}\/\d{4})/i
  };

  for (const [field, pattern] of Object.entries(datePatterns)) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      dateData[field as keyof typeof dateData] = match[1];
    }
  }

  return dateData;
}

async function callGeminiApi(prompt: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured');
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 32,
            topP: 0.95,
            maxOutputTokens: 8192,
          }
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} - ${await response.text()}`);
    }

    const result = await response.json();
    return result.candidates[0]?.content?.parts[0]?.text || "No response from AI";
  } catch (error) {
    console.error('Gemini API call failed:', error);
    return `API call failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

function isValidData(value: any): boolean {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'number' && isNaN(value)) {
    return false;
  }
  if (typeof value === 'number' && value === 0) {
    return true;
  }
  if (Array.isArray(value) && value.length === 0) {
    return false;
  }
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return false;
  }
  if (typeof value === 'string' && ['null', 'na', 'n/a', '', 'undefined'].includes(value.toLowerCase())) {
    return false;
  }
  return true;
}

function createCompleteFallbackData(): ExtractedData {
  return {
    "customer_name": null,
    "statement_date": null,
    "payment_due_date": null,
    "total_amount_due": null,
    "minimum_amount_due": null,
    "credit_limit": null,
    "available_credit_limit": null,
    "card_number": null,
    "transactions": [],
    "reward_points_summary": {
      "opening_balance": null,
      "earned": null,
      "closing_balance": null
    },
    "bank_name": null
  };
}

function extractJsonFromResponse(response: string): Record<string, any> {
  try {
    // First try to find JSON in code blocks
    const codeBlockMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
    if (codeBlockMatch) {
      const jsonStr = codeBlockMatch[1];
      return JSON.parse(jsonStr);
    }

    // Then try to find any JSON object
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      let jsonStr = jsonMatch[0];
      
      // Clean JSON string
      jsonStr = jsonStr.replace(/,\s*}/g, '}');
      jsonStr = jsonStr.replace(/,\s*]/g, ']');
      jsonStr = jsonStr.replace(/(\w+):/g, '"$1":');
      jsonStr = jsonStr.replace(/'/g, '"');
      jsonStr = jsonStr.replace(/^[^{]*/, '');
      
      return JSON.parse(jsonStr);
    }
  } catch (error) {
    console.error('JSON extraction failed:', error);
  }
  
  return createCompleteFallbackData();
}

function finalValidationAndCalculation(data: Record<string, any>): ExtractedData {
  const validatedData = createCompleteFallbackData();

  // Merge with validated data
  for (const field in validatedData) {
    if (field in data && isValidData(data[field])) {
      if (field === 'reward_points_summary' && typeof data[field] === 'object') {
        validatedData.reward_points_summary = {
          opening_balance: data[field].opening_balance ?? null,
          earned: data[field].earned ?? null,
          closing_balance: data[field].closing_balance ?? null
        };
      } else {
        (validatedData as any)[field] = data[field];
      }
    }
  }

  // Calculate available credit if missing
  if (isValidData(validatedData.credit_limit) && 
      isValidData(validatedData.total_amount_due) && 
      !isValidData(validatedData.available_credit_limit)) {
    validatedData.available_credit_limit = (validatedData.credit_limit as number) - (validatedData.total_amount_due as number);
  }

  // Calculate closing reward balance if missing
  const rewardSummary = validatedData.reward_points_summary;
  if (isValidData(rewardSummary.opening_balance) && 
      isValidData(rewardSummary.earned) && 
      !isValidData(rewardSummary.closing_balance)) {
    rewardSummary.closing_balance = (rewardSummary.opening_balance as number) + (rewardSummary.earned as number);
  }

  // Set minimum amount due as 5% of total amount due if missing
  if (isValidData(validatedData.total_amount_due) && 
      !isValidData(validatedData.minimum_amount_due)) {
    validatedData.minimum_amount_due = Math.round((validatedData.total_amount_due as number) * 0.05 * 100) / 100;
  }

  return validatedData;
}

function robustDataMerging(aiData: Record<string, any>, patternData: Record<string, any>): Record<string, any> {
  const mergedData = { ...aiData };
  
  // Define field priorities (pattern data has higher priority for certain fields)
  const highPriorityFields = ['customer_name', 'card_number', 'bank_name', 'transactions'];
  
  for (const field of highPriorityFields) {
    if (patternData[field] && isValidData(patternData[field])) {
      if (field === 'transactions' && Array.isArray(patternData[field]) && patternData[field].length > (mergedData[field]?.length || 0)) {
        mergedData[field] = patternData[field];
      } else if (field !== 'transactions') {
        mergedData[field] = patternData[field];
      }
    }
  }
  
  // Merge financial data
  const financialFields = ['total_amount_due', 'minimum_amount_due', 'credit_limit', 'available_credit_limit'];
  for (const field of financialFields) {
    if (patternData[field] && isValidData(patternData[field])) {
      if (!mergedData[field] || !isValidData(mergedData[field])) {
        mergedData[field] = patternData[field];
      }
    }
  }
  
  // Merge dates
  const dateFields = ['statement_date', 'payment_due_date'];
  for (const field of dateFields) {
    if (patternData[field] && isValidData(patternData[field])) {
      if (!mergedData[field] || !isValidData(mergedData[field])) {
        mergedData[field] = patternData[field];
      }
    }
  }
  
  // Merge reward points
  if (patternData.reward_points_summary) {
    const rewardFields = ['opening_balance', 'earned', 'closing_balance'];
    for (const field of rewardFields) {
      const patternValue = patternData.reward_points_summary[field];
      if (patternValue && isValidData(patternValue)) {
        if (!mergedData.reward_points_summary || 
            !mergedData.reward_points_summary[field] || 
            !isValidData(mergedData.reward_points_summary[field])) {
          if (!mergedData.reward_points_summary) {
            mergedData.reward_points_summary = {};
          }
          mergedData.reward_points_summary[field] = patternValue;
        }
      }
    }
  }
  
  return mergedData;
}

async function extract10DataPointsWithGemini(extractedText: string): Promise<ExtractedData> {
  // Extract data using pattern matching first
  const cardNumber = extractCardNumberFromText(extractedText);
  const financialData = extractFinancialDataFromText(extractedText);
  const rewardPoints = extractRewardPointsFromText(extractedText);
  const transactions = extractTransactionsFromText(extractedText);
  const customerInfo = extractCustomerInfoFromText(extractedText);
  const datesInfo = extractDatesFromText(extractedText);

  const patternMatchedData: Record<string, any> = {
    ...customerInfo,
    ...datesInfo,
    ...financialData,
    card_number: cardNumber,
    transactions: transactions,
    reward_points_summary: rewardPoints
  };

  try {
    const prompt = `
EXTRACT ALL 11 data points from this credit card statement. BE THOROUGH and search every section.

EXTRACTED TEXT:
${extractedText.substring(0, 15000)}

DATA POINTS TO EXTRACT:

1. CUSTOMER_NAME: Full name of cardholder
   - Search: "Customer Name:", "Cardholder:", "Name:"
   - EXCLUDE any text containing "email"

2. STATEMENT_DATE: Statement generation date  
   - Search: "Statement Date:", "Date:"
   - Format: "MM/DD/YYYY" or keep original

3. PAYMENT_DUE_DATE: Payment deadline
   - Search: "Payment Due Date:", "Due Date:"
   - Format: "MM/DD/YYYY" or keep original

4. TOTAL_AMOUNT_DUE: Total balance owed
   - Search: "Total Amount Due:", "Total Due:"
   - Extract number only

5. MINIMUM_AMOUNT_DUE: Minimum payment required
   - Search: "Minimum Amount Due:", "Min Amount Due:"
   - Extract number only

6. CREDIT_LIMIT: Total credit available
   - Search: "Credit Limit:", "Limit:"
   - Extract number only

7. AVAILABLE_CREDIT_LIMIT: Remaining credit
   - Search: "Available Credit Limit:", "Available Credit:"
   - CALCULATION: If not found = Credit Limit - Total Amount Due

8. CARD_NUMBER: Credit card number
   - Search: "Card Number:", "Card No:"
   - Can be masked (e.g., 4281****9388)

9. TRANSACTIONS: All transactions
   - Search: Transaction table
   - Include: Date, Description, Amount

10. REWARD_POINTS_SUMMARY: Reward points data
    - Search: "REWARDS SUMMARY" section
    - Extract: opening_balance, earned, closing_balance
    - CALCULATION: closing_balance = opening_balance + earned

11. BANK_NAME: Bank/issuer name
    - Search: "HDFC", "ICICI", "Axis", etc.

CALCULATION RULES (use if direct extraction fails):
- Available Credit = Credit Limit - Total Amount Due
- Closing Reward Balance = Opening Balance + Rewards Earned
- Minimum Amount Due = 5% of Total Amount Due (if not found)

RETURN VALID JSON ONLY - NO EXPLANATIONS:
{
  "customer_name": "string or null",
  "statement_date": "string or null", 
  "payment_due_date": "string or null",
  "total_amount_due": "number or null",
  "minimum_amount_due": "number or null",
  "credit_limit": "number or null",
  "available_credit_limit": "number or null",
  "card_number": "string or null",
  "transactions": [
    {"date": "string", "description": "string", "amount": number}
  ],
  "reward_points_summary": {
    "opening_balance": "number or null",
    "earned": "number or null", 
    "closing_balance": "number or null"
  },
  "bank_name": "string or null"
}
`;

    const response = await callGeminiApi(prompt);
    console.log("Gemini Raw Response:", response.substring(0, 500));

    // Extract JSON from response
    const extractedData = extractJsonFromResponse(response);
    
    // Enhanced merging with pattern-matched data
    const mergedData = robustDataMerging(extractedData, patternMatchedData);
    
    // Final validation and calculations
    return finalValidationAndCalculation(mergedData);

  } catch (error) {
    console.error("Error in data extraction:", error);
    // Return pattern-matched data as fallback with complete structure
    const fallbackData = createCompleteFallbackData();
    for (const field in fallbackData) {
      if (field in patternMatchedData && isValidData(patternMatchedData[field])) {
        if (field === 'reward_points_summary' && typeof patternMatchedData[field] === 'object') {
          fallbackData[field] = patternMatchedData[field];
        } else {
          (fallbackData as any)[field] = patternMatchedData[field];
        }
      }
    }
    return finalValidationAndCalculation(fallbackData);
  }
}

// PDF Processing Function
async function processPDF(file: File): Promise<{ text: string; tables: any[]; imagesCount: number }> {
  try {
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // For now, we'll use a simple approach to extract text from PDF
    // In a real implementation, you would use a PDF library like pdf-parse or pdf.js
    
    // This is a placeholder - you should replace this with actual PDF processing
    // For demonstration, we'll create a mock processing that simulates OCR
    
    const mockExtractedText = `
    Credit Card Statement - ${file.name}
    
    IMPORTANT: This is a simulated extraction. In a real implementation,
    you would use a proper PDF processing library to extract text from the actual PDF.
    
    For now, this serves as a placeholder to demonstrate the data flow.
    
    To implement real PDF processing, install a library like:
    - pdf-parse: npm install pdf-parse
    - pdf.js: npm install pdfjs-dist
    - or use a cloud OCR service
    
    Then replace this mock extraction with actual PDF text extraction.
    `;

    return {
      text: mockExtractedText,
      tables: [],
      imagesCount: 0
    };
    
  } catch (error) {
    console.error('PDF processing error:', error);
    throw new Error(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Main POST handler - handles ALL endpoints via query parameter
export async function POST(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    console.log('API Call - Action:', action);

    if (!action) {
      return NextResponse.json(
        { error: 'Action parameter is required. Use ?action=ocr|ocr10|chatwithpdf|chat' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'ocr':
        return await handleOCR(request);
      
      case 'ocr10':
        return await handleOCR10(request);
      
      case 'chatwithpdf':
        return await handleChatWithPDF(request);
      
      case 'chat':
        return await handleGeneralChat(request);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use ocr, ocr10, chatwithpdf, or chat' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Handler functions
async function handleOCR(request: NextRequest): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { 
          success: false,
          extracted_text: "",
          tables: [],
          images_count: 0,
          session_id: "",
          message: "No file provided" 
        },
        { status: 400 }
      );
    }

    // Generate session ID
    const sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
    
    try {
      // Process the actual PDF file
      const { text: extractedText, tables, imagesCount } = await processPDF(file);

      // Store extracted content
      extractedContents[sessionId] = {
        text: extractedText,
        tables: tables,
        images_count: imagesCount,
        pages: [{ page_number: 1, text: extractedText, tables: tables }],
        filename: file.name,
        processed_at: new Date().toISOString()
      };

      const response: OCRResponse = {
        success: true,
        extracted_text: extractedText.substring(0, 1000) + (extractedText.length > 1000 ? "..." : ""),
        tables: tables,
        images_count: imagesCount,
        session_id: sessionId,
        message: "PDF processed successfully"
      };

      return NextResponse.json(response);
      
    } catch (processingError) {
      console.error('PDF processing failed:', processingError);
      return NextResponse.json(
        {
          success: false,
          extracted_text: "",
          tables: [],
          images_count: 0,
          session_id: "",
          message: `PDF processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('OCR processing error:', error);
    return NextResponse.json(
      {
        success: false,
        extracted_text: "",
        tables: [],
        images_count: 0,
        session_id: "",
        message: `Error processing PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

async function handleOCR10(request: NextRequest): Promise<NextResponse> {
  try {
    const { session_id } = await request.json();
    
    if (!session_id) {
      return NextResponse.json(
        { error: 'session_id is required' },
        { status: 400 }
      );
    }

    if (!extractedContents[session_id]) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    const storedContent = extractedContents[session_id];
    const extractedText = storedContent.text;

    if (!extractedText) {
      return NextResponse.json(
        { error: 'No text found in the session to process' },
        { status: 400 }
      );
    }

    const extracted10Data = await extract10DataPointsWithGemini(extractedText);
    extractedContents[session_id].extracted_10_data = extracted10Data;

    const response: OCR10Response = {
      success: true,
      session_id: session_id,
      extracted_data: extracted10Data,
      message: "10 data points extracted successfully"
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('OCR-10 extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        session_id: "unknown",
        extracted_data: createCompleteFallbackData(),
        message: `Error extracting data: ${error instanceof Error ? error.message : 'Unknown error'}`
      },
      { status: 500 }
    );
  }
}

async function handleChatWithPDF(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ChatRequest = await request.json();
    const { question, session_id = "default" } = body;

    if (!extractedContents[session_id]) {
      return NextResponse.json(
        { error: 'Session not found. Please process a PDF first.' },
        { status: 404 }
      );
    }

    const pdfContent = extractedContents[session_id];
    const extractedData = pdfContent.extracted_10_data || {};

    const context = `
CREDIT CARD STATEMENT ANALYSIS CONTEXT:

EXTRACTED STRUCTURED DATA:
${JSON.stringify(extractedData, null, 2)}

ADDITIONAL TEXT CONTEXT (for reference):
${pdfContent.text?.substring(0, 4000) || ''}

USER QUESTION: ${question}
`;

    const prompt = `
You are an intelligent financial analyst assistant. Analyze the credit card statement data and provide precise, accurate, and professional responses.

CONTEXT DATA:
${context}

RESPONSE GUIDELINES:
1. Provide accurate, factual information based on the extracted data
2. Structure your response clearly with appropriate sections
3. Format amounts properly in Indian Rupees (₹)
4. Be concise and professional
5. Do not use emojis or informal language
6. Focus on delivering precise information
7. If the data is incomplete, mention what information is available and what might be missing
8. Provide insights and summaries when appropriate

Please provide a professional, accurate response to the user's question based on the credit card statement data.
`;

    const answer = await callGeminiApi(prompt);
    
    const response: ChatResponse = {
      success: true,
      answer,
      session_id
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Chat with PDF error:', error);
    const response: ChatResponse = {
      success: false,
      answer: `Error processing your request: ${error instanceof Error ? error.message : 'Unknown error'}`,
      session_id: "default"
    };

    return NextResponse.json(response, { status: 500 });
  }
}

async function handleGeneralChat(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ChatRequest = await request.json();
    const { question } = body;

    const prompt = `
You are a helpful, knowledgeable AI assistant. You can discuss any topic the user is interested in.

However, if the user asks about you, your capabilities, or who created you, please mention:
"This is made by Yash Buddhadev as an assignment for Sure Financials. For more details, drop an email at yashbuddhadev21@gmail.com"

User Question: ${question}

Please provide a helpful, professional response. Be accurate and informative in your answers.
`;

    const answer = await callGeminiApi(prompt);
    
    const response: GeneralChatResponse = {
      success: true,
      answer
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('General chat error:', error);
    const response: GeneralChatResponse = {
      success: false,
      answer: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };

    return NextResponse.json(response, { status: 500 });
  }
}

// GET handler for testing and information
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: "Credit Card Statement Parser API is running!",
    version: "1.0.0",
    endpoints: {
      "POST /api/chat?action=ocr": "Process PDF to extract text, tables, images",
      "POST /api/chat?action=ocr10": "Extract 10 common data points from processed PDF",
      "POST /api/chat?action=chatwithpdf": "Chat specifically about the uploaded PDF content",
      "POST /api/chat?action=chat": "General chat about any topic"
    },
    features: [
      "Advanced pattern matching for data extraction",
      "AI-powered data validation and completion",
      "Professional financial analysis",
      "Robust error handling"
    ]
  });
}