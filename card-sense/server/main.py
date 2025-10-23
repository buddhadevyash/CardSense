from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import base64
import os
import requests
import fitz  # PyMuPDF
import io
from dotenv import load_dotenv
import json
import re
import uuid
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Credit Card Statement Parser",
    description="API for OCR processing and chat with credit card statements",
    version="1.0.0"
)

# Configuration
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL = "gemini-2.0-flash-exp"

# CORS middleware setup
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global storage for extracted content (in production, use database)
extracted_contents = {}

class ChatRequest(BaseModel):
    question: str
    session_id: Optional[str] = "default"

class OCRResponse(BaseModel):
    success: bool
    extracted_text: str
    tables: List[Dict]
    images_count: int
    session_id: str
    message: str

class ChatResponse(BaseModel):
    success: bool
    answer: str
    session_id: str

class GeneralChatResponse(BaseModel):
    success: bool
    answer: str

class OCR10Response(BaseModel):
    success: bool
    session_id: str
    extracted_data: Dict[str, Any]
    message: str

def extract_text_with_pymupdf(pdf_content: bytes) -> Dict[str, Any]:
    """
    Extract text, tables and images from PDF using PyMuPDF
    This serves as our OCR function since we don't have direct Mistral OCR access
    """
    try:
        # Open PDF from bytes
        pdf_document = fitz.open(stream=pdf_content, filetype="pdf")
        
        extracted_data = {
            "text": "",
            "tables": [],
            "images_count": 0,
            "pages": []  # Store individual pages for better processing
        }
        
        # Extract text from each page
        for page_num in range(len(pdf_document)):
            page = pdf_document[page_num]
            
            # Extract text
            text = page.get_text()
            page_data = {
                "page_number": page_num + 1,
                "text": text,
                "tables": []
            }
            
            # Extract tables (simple table detection)
            tables = page.find_tables()
            if tables.tables:
                for i, table in enumerate(tables.tables):
                    table_data = []
                    for row in table.extract():
                        table_data.append(row)
                    page_data["tables"].append({
                        "table_number": i + 1,
                        "data": table_data
                    })
                    extracted_data["tables"].append({
                        "page": page_num + 1,
                        "table_number": i + 1,
                        "data": table_data
                    })
            
            extracted_data["text"] += f"\n--- Page {page_num + 1} ---\n{text}"
            extracted_data["pages"].append(page_data)
            
            # Count images
            image_list = page.get_images()
            extracted_data["images_count"] += len(image_list)
        
        pdf_document.close()
        return extracted_data
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PDF processing error: {str(e)}")

def call_gemini_api(prompt: str) -> str:
    """Call Gemini API with given prompt"""
    try:
        headers = {
            "Content-Type": "application/json"
        }
        
        payload = {
            "contents": [{
                "parts": [{
                    "text": prompt
                }]
            }]
        }
        
        response = requests.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}",
            headers=headers,
            json=payload,
            timeout=60
        )
        
        if response.status_code == 200:
            result = response.json()
            return result['candidates'][0]['content']['parts'][0]['text']
        else:
            return f"Error: {response.status_code} - {response.text}"
            
    except Exception as e:
        return f"API call failed: {str(e)}"

def extract_card_number_from_text(text: str) -> Optional[str]:
    """
    Enhanced card number extraction using pattern matching
    Handles various formats: masked, partially masked, and full numbers
    """
    # Pattern 1: Partially masked card numbers (XXXX*****XXXX)
    pattern1 = r'Card Number\s*[:]?\s*(\d{4}[\*]+\d{4})'
    match1 = re.search(pattern1, text, re.IGNORECASE)
    if match1:
        return match1.group(1)
    
    # Pattern 2: Another common format
    pattern2 = r'Card No\s*[:]?\s*(\d{4}[\s\*]+\d{4})'
    match2 = re.search(pattern2, text, re.IGNORECASE)
    if match2:
        return match2.group(1).replace(' ', '')
    
    # Pattern 3: Full card numbers (less common in statements)
    pattern3 = r'Card Number\s*[:]?\s*(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})'
    match3 = re.search(pattern3, text, re.IGNORECASE)
    if match3:
        return match3.group(1).replace(' ', '').replace('-', '')
    
    # Pattern 4: Look for any 16-digit number patterns
    pattern4 = r'\b\d{4}[\*]+\d{4}\b'
    match4 = re.search(pattern4, text)
    if match4:
        return match4.group(0)
    
    return None

def extract_financial_data_from_text(text: str) -> Dict[str, Any]:
    """
    Extract financial data using pattern matching as fallback
    """
    financial_data = {}
    
    # Amount patterns (with currency symbols and commas)
    amount_patterns = {
        "total_amount_due": r'(?:Total Amount Due|Total Due|New Balance)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)',
        "minimum_amount_due": r'(?:Minimum Amount Due|Min Amount Due|Minimum Due|Min Due)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)',
        "credit_limit": r'(?:Credit Limit|Limit)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)',
        "available_credit_limit": r'(?:Available Credit Limit|Available Credit|Available Limit)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)',
        "opening_balance": r'(?:Opening Balance|Previous Balance)[\s:]*[₹$]?\s*([0-9,]+\.?[0-9]*)',
    }
    
    for field, pattern in amount_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            amount_str = match.group(1).replace(',', '')
            try:
                financial_data[field] = float(amount_str)
            except ValueError:
                financial_data[field] = None
    
    # Calculate available credit if not found but credit limit and total due are available
    if (financial_data.get('credit_limit') is not None and 
        financial_data.get('total_amount_due') is not None and
        financial_data.get('available_credit_limit') is None):
        financial_data['available_credit_limit'] = (
            financial_data['credit_limit'] - financial_data['total_amount_due']
        )
    
    return financial_data

def extract_reward_points_from_text(text: str) -> Dict[str, Any]:
    """
    Enhanced reward points extraction using pattern matching
    """
    rewards_data = {
        "opening_balance": None,
        "earned": None,
        "closing_balance": None
    }
    
    # Multiple patterns for reward points
    patterns = [
        r'REWARDS\s*SUMMARY\s*Opening Balance\s*(\d+)\s*Rewards Earned\s*(\d+)\s*Redeemed/Adjusted\s*(\d+)\s*Closing Balance\s*(\d+)',
        r'Reward Points.*?Opening Balance\s*(\d+).*?Earned\s*(\d+).*?Closing Balance\s*(\d+)',
        r'Opening Balance\s*(\d+)\s*Rewards Earned\s*(\d+)\s*Closing Balance\s*(\d+)',
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.DOTALL)
        if match:
            groups = match.groups()
            if len(groups) >= 3:
                rewards_data["opening_balance"] = int(groups[0])
                rewards_data["earned"] = int(groups[1])
                rewards_data["closing_balance"] = int(groups[-1])  # Last group is closing balance
            break
    
    # Calculate closing balance if not found but opening and earned are available
    if (rewards_data['opening_balance'] is not None and 
        rewards_data['earned'] is not None and
        rewards_data['closing_balance'] is None):
        rewards_data['closing_balance'] = rewards_data['opening_balance'] + rewards_data['earned']
    
    return rewards_data

def extract_transactions_from_text(text: str) -> List[Dict[str, Any]]:
    """
    Extract transactions using pattern matching
    """
    transactions = []
    
    # Look for transaction tables
    transaction_section = re.search(r'YOUR TRANSACTIONS(.*?)(?=KEY OFFERS|Page \d+ of \d+|$)', text, re.IGNORECASE | re.DOTALL)
    if transaction_section:
        transaction_text = transaction_section.group(1)
        
        # Pattern for transaction rows (date, description, amount)
        transaction_pattern = r'(\d{2}/\d{2}/\d{4})\s+([A-Za-z0-9\s\.\-&]+?)\s+([0-9,]+\.?[0-9]*)\s*(CR)?'
        matches = re.findall(transaction_pattern, transaction_text)
        
        for match in matches:
            date, description, amount_str, credit_indicator = match
            try:
                amount = float(amount_str.replace(',', ''))
                if credit_indicator:
                    amount = -amount  # Negative for credits
                
                transactions.append({
                    "date": date.strip(),
                    "description": description.strip(),
                    "amount": amount
                })
            except ValueError:
                continue
    
    return transactions

def extract_customer_info_from_text(text: str) -> Dict[str, Any]:
    """
    Extract customer information using pattern matching
    """
    customer_data = {
        "customer_name": None,
        "bank_name": None
    }
    
    # Extract customer name
    name_patterns = [
        r'Customer Name\s*[:]?\s*([A-Za-z\s]+)(?:\n|$)',
        r'Cardholder\s*[:]?\s*([A-Za-z\s]+)(?:\n|$)',
        r'Name\s*[:]?\s*([A-Za-z\s]+)(?:\n|$)',
        r'^([A-Za-z\s]+)(?:\n.*?Credit Card)'
    ]
    
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
        if match:
            customer_data["customer_name"] = match.group(1).strip()
            break
    
    # Extract bank name
    bank_patterns = [
        r'(HDFC Bank|ICICI Bank|Axis Bank|IDFC FIRST Bank|RBL Bank|SBI Card|Kotak Bank|Standard Chartered)',
        r'([A-Za-z]+ Bank Limited)',
        r'([A-Za-z]+ Card Services)'
    ]
    
    for pattern in bank_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            customer_data["bank_name"] = match.group(1).strip()
            break
    
    return customer_data

def extract_dates_from_text(text: str) -> Dict[str, Any]:
    """
    Extract dates using pattern matching
    """
    date_data = {
        "statement_date": None,
        "payment_due_date": None
    }
    
    # Date patterns
    date_patterns = {
        "statement_date": r'(?:Statement Date|Date)[\s:]*(\d{2}/\d{2}/\d{4})',
        "payment_due_date": r'(?:Payment Due Date|Due Date)[\s:]*(\d{2}/\d{2}/\d{4})'
    }
    
    for field, pattern in date_patterns.items():
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            date_data[field] = match.group(1)
    
    return date_data

def extract_10_data_points_with_gemini(extracted_text: str) -> Dict[str, Any]:
    """
    Use Gemini model to extract the 10 specific data points from OCR text
    """
    try:
        # Extract data using pattern matching first (as fallback)
        card_number = extract_card_number_from_text(extracted_text)
        financial_data = extract_financial_data_from_text(extracted_text)
        reward_points = extract_reward_points_from_text(extracted_text)
        transactions = extract_transactions_from_text(extracted_text)
        customer_info = extract_customer_info_from_text(extracted_text)
        dates_info = extract_dates_from_text(extracted_text)
        
        # Combine all pattern-matched data
        pattern_matched_data = {
            **customer_info,
            **dates_info,
            **financial_data,
            'card_number': card_number,
            'transactions': transactions,
            'reward_points_summary': reward_points
        }
        
        prompt = f"""
CRITICAL TASK: Extract ALL 11 data points from this credit card statement. DO NOT skip any field.

EXTRACTED TEXT FROM ALL PAGES:
{extracted_text[:20000]}  # Large context for comprehensive extraction

MANDATORY INSTRUCTIONS:
1. You MUST extract ALL 11 fields below. NO "null" or "N/A" allowed unless absolutely impossible to find.
2. Use pattern matching and calculations if direct values are not found.
3. Be extremely thorough - search every section of every page.

DATA POINTS TO EXTRACT:

1. CUSTOMER_NAME: Full name of cardholder
   - Search: Header, address, transaction headers
   - Patterns: "Customer Name:", "Cardholder:", "Name:"

2. STATEMENT_DATE: Statement generation date  
   - Search: Top section, summary
   - Patterns: "Statement Date:", "Date:"
   - Format: "YYYY-MM-DD" or keep original format

3. PAYMENT_DUE_DATE: Payment deadline
   - Search: Payment section
   - Patterns: "Payment Due Date:", "Due Date:"
   - Format: "YYYY-MM-DD" or keep original format

4. TOTAL_AMOUNT_DUE: Total balance owed
   - Search: Summary section
   - Patterns: "Total Amount Due:", "Total Due:"
   - Extract number only (remove ₹, $)

5. MINIMUM_AMOUNT_DUE: Minimum payment required
   - Search: Payment section
   - Patterns: "Minimum Amount Due:", "Min Amount Due:", "Minimum Due:"
   - Extract number only
   - CRITICAL: This is often near Total Amount Due

6. CREDIT_LIMIT: Total credit available
   - Search: Credit summary
   - Patterns: "Credit Limit:", "Limit:"
   - Extract number only

7. AVAILABLE_CREDIT_LIMIT: Remaining credit
   - Search: Credit summary  
   - Patterns: "Available Credit Limit:", "Available Credit:"
   - Extract number only
   - CALCULATION: If not found, calculate as: Credit Limit - Total Amount Due

8. CARD_NUMBER: Credit card number
   - Search: Transaction header, card details
   - Patterns: "Card Number:", "Card No:"
   - Can be masked (e.g., 428102*****9388)

9. TRANSACTIONS: All transactions
   - Search: Transaction table (usually page 2)
   - Include: Date, Description, Amount
   - Format as list of objects

10. REWARD_POINTS_SUMMARY: Reward points data
    - Search: "REWARDS SUMMARY" section
    - Extract: opening_balance, earned, closing_balance
    - CALCULATION: If closing not found, calculate as: opening_balance + earned

11. BANK_NAME: Bank/issuer name
    - Search: Header, footer, card name
    - Patterns: "HDFC", "ICICI", "Axis", "IDFC FIRST", "RBL"

PRE-EXTRACTED DATA (for verification):
- Customer Name: {pattern_matched_data.get('customer_name')}
- Statement Date: {pattern_matched_data.get('statement_date')}
- Payment Due Date: {pattern_matched_data.get('payment_due_date')}
- Financial Data: {financial_data}
- Card Number: {card_number}
- Reward Points: {reward_points}
- Transactions Count: {len(transactions)}
- Bank Name: {pattern_matched_data.get('bank_name')}

CALCULATION RULES (use if direct extraction fails):
- Available Credit = Credit Limit - Total Amount Due
- Closing Reward Balance = Opening Balance + Rewards Earned

RETURN FORMAT - MUST BE VALID JSON:
{{
  "customer_name": "string (REQUIRED)",
  "statement_date": "string (REQUIRED)", 
  "payment_due_date": "string (REQUIRED)",
  "total_amount_due": number (REQUIRED),
  "minimum_amount_due": number (REQUIRED)",
  "credit_limit": number (REQUIRED),
  "available_credit_limit": number (REQUIRED)",
  "card_number": "string (REQUIRED)",
  "transactions": [
    {{"date": "string", "description": "string", "amount": number}}
  ],
  "reward_points_summary": {{
    "opening_balance": number (REQUIRED),
    "earned": number (REQUIRED), 
    "closing_balance": number (REQUIRED)
  }},
  "bank_name": "string (REQUIRED)"
}}

IMPORTANT: 
- ALL fields are REQUIRED
- Use calculations if direct values missing
- Return COMPLETE JSON only
- No explanations, no partial data
"""

        response = call_gemini_api(prompt)
        print("Gemini Raw Response:", response[:1000] + "..." if len(response) > 1000 else response)
        
        # Extract JSON from response
        extracted_data = extract_json_from_response(response)
        
        # Enhanced merging with pattern-matched data
        extracted_data = robust_data_merging(extracted_data, pattern_matched_data)
        
        # Final validation and calculations
        return final_validation_and_calculation(extracted_data)
        
    except Exception as e:
        print(f"Error in data extraction: {e}")
        # Return pattern-matched data as fallback
        return create_complete_dataset(pattern_matched_data)

def robust_data_merging(ai_data: Dict[str, Any], pattern_data: Dict[str, Any]) -> Dict[str, Any]:
    """Robust merging of AI data with pattern-matched data"""
    merged_data = ai_data.copy()
    
    # Define field priorities (pattern data has higher priority for certain fields)
    high_priority_fields = ['customer_name', 'card_number', 'bank_name', 'transactions']
    
    for field in high_priority_fields:
        if pattern_data.get(field) and is_valid_data(pattern_data[field]):
            if field == 'transactions' and len(pattern_data[field]) > len(merged_data.get(field, [])):
                merged_data[field] = pattern_data[field]
            elif field != 'transactions':
                merged_data[field] = pattern_data[field]
    
    # Merge financial data
    financial_fields = ['total_amount_due', 'minimum_amount_due', 'credit_limit', 'available_credit_limit']
    for field in financial_fields:
        if pattern_data.get(field) and is_valid_data(pattern_data[field]):
            if not merged_data.get(field) or not is_valid_data(merged_data[field]):
                merged_data[field] = pattern_data[field]
    
    # Merge dates
    date_fields = ['statement_date', 'payment_due_date']
    for field in date_fields:
        if pattern_data.get(field) and is_valid_data(pattern_data[field]):
            if not merged_data.get(field) or not is_valid_data(merged_data[field]):
                merged_data[field] = pattern_data[field]
    
    # Merge reward points
    if pattern_data.get('reward_points_summary'):
        reward_fields = ['opening_balance', 'earned', 'closing_balance']
        for field in reward_fields:
            pattern_value = pattern_data['reward_points_summary'].get(field)
            if pattern_value and is_valid_data(pattern_value):
                if ('reward_points_summary' not in merged_data or 
                    not merged_data['reward_points_summary'].get(field) or 
                    not is_valid_data(merged_data['reward_points_summary'].get(field))):
                    if 'reward_points_summary' not in merged_data:
                        merged_data['reward_points_summary'] = {}
                    merged_data['reward_points_summary'][field] = pattern_value
    
    return merged_data

def is_valid_data(value: Any) -> bool:
    """Check if data is valid (not null, empty, or invalid)"""
    if value is None:
        return False
    if isinstance(value, (int, float)) and value == 0:
        return True  # 0 can be valid for amounts
    if isinstance(value, (list, dict)) and not value:
        return False
    if isinstance(value, str) and value.lower() in ['null', 'na', 'n/a', '']:
        return False
    return True

def final_validation_and_calculation(data: Dict[str, Any]) -> Dict[str, Any]:
    """Final validation and calculation of missing fields"""
    validated_data = create_complete_fallback_data()
    
    # Merge with validated data
    for field in validated_data:
        if field in data and is_valid_data(data[field]):
            if field == 'reward_points_summary':
                if isinstance(data[field], dict):
                    validated_data[field] = {
                        'opening_balance': data[field].get('opening_balance'),
                        'earned': data[field].get('earned'),
                        'closing_balance': data[field].get('closing_balance')
                    }
            else:
                validated_data[field] = data[field]
    
    # Calculate available credit if missing
    if (is_valid_data(validated_data['credit_limit']) and 
        is_valid_data(validated_data['total_amount_due']) and 
        not is_valid_data(validated_data['available_credit_limit'])):
        validated_data['available_credit_limit'] = (
            validated_data['credit_limit'] - validated_data['total_amount_due']
        )
    
    # Calculate closing reward balance if missing
    reward_summary = validated_data['reward_points_summary']
    if (is_valid_data(reward_summary['opening_balance']) and 
        is_valid_data(reward_summary['earned']) and 
        not is_valid_data(reward_summary['closing_balance'])):
        reward_summary['closing_balance'] = (
            reward_summary['opening_balance'] + reward_summary['earned']
        )
    
    # Ensure minimum amount due has a reasonable value
    if (is_valid_data(validated_data['total_amount_due']) and 
        not is_valid_data(validated_data['minimum_amount_due'])):
        # Set minimum amount due as 5% of total amount due (common practice)
        validated_data['minimum_amount_due'] = round(validated_data['total_amount_due'] * 0.05, 2)
    
    return validated_data

def create_complete_dataset(pattern_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create complete dataset from pattern-matched data"""
    dataset = create_complete_fallback_data()
    
    for field in dataset:
        if field in pattern_data and is_valid_data(pattern_data[field]):
            if field == 'reward_points_summary':
                if isinstance(pattern_data[field], dict):
                    dataset[field] = pattern_data[field]
            else:
                dataset[field] = pattern_data[field]
    
    return final_validation_and_calculation(dataset)

def extract_json_from_response(response: str) -> Dict[str, Any]:
    """Extract JSON from AI response using multiple strategies"""
    # Strategy 1: Direct JSON match
    json_match = re.search(r'\{[\s\S]*\}', response)
    if json_match:
        json_str = json_match.group()
        try:
            return json.loads(json_str)
        except json.JSONDecodeError:
            # Strategy 2: Clean common JSON issues
            json_str = clean_json_string(json_str)
            try:
                return json.loads(json_str)
            except json.JSONDecodeError:
                pass
    
    return create_complete_fallback_data()

def clean_json_string(json_str: str) -> str:
    """Clean common JSON formatting issues"""
    # Remove trailing commas
    json_str = re.sub(r',\s*}', '}', json_str)
    json_str = re.sub(r',\s*]', ']', json_str)
    
    # Fix missing quotes around keys
    json_str = re.sub(r'(\w+):', r'"\1":', json_str)
    
    # Fix single quotes to double quotes
    json_str = json_str.replace("'", '"')
    
    # Remove any text before {
    json_str = re.sub(r'^[^{]*', '', json_str)
    
    return json_str

def create_complete_fallback_data() -> Dict[str, Any]:
    """Create a complete fallback data structure with all 11 fields"""
    return {
        "customer_name": None,
        "statement_date": None,
        "payment_due_date": None,
        "total_amount_due": None,
        "minimum_amount_due": None,
        "credit_limit": None,
        "available_credit_limit": None,
        "card_number": None,
        "transactions": [],
        "reward_points_summary": {
            "opening_balance": None,
            "earned": None,
            "closing_balance": None
        },
        "bank_name": None
    }

@app.post("/ocr", response_model=OCRResponse)
async def process_ocr(file: UploadFile = File(...)):
    """
    Process PDF with OCR to extract text, tables and images
    """
    try:
        if not file.filename.lower().endswith('.pdf'):
            raise HTTPException(status_code=400, detail="Only PDF files are supported")
        
        # Read file content
        pdf_content = await file.read()
        
        # Extract content using PyMuPDF (serving as our OCR)
        extracted_data = extract_text_with_pymupdf(pdf_content)
        
        # Generate session ID
        session_id = str(uuid.uuid4())
        
        # Store extracted content
        extracted_contents[session_id] = {
            "text": extracted_data["text"],
            "tables": extracted_data["tables"],
            "images_count": extracted_data["images_count"],
            "pages": extracted_data["pages"],
            "filename": file.filename,
            "processed_at": datetime.now().isoformat()
        }
        
        return OCRResponse(
            success=True,
            extracted_text=extracted_data["text"][:2000] + "..." if len(extracted_data["text"]) > 2000 else extracted_data["text"],
            tables=extracted_data["tables"],
            images_count=extracted_data["images_count"],
            session_id=session_id,
            message="PDF processed successfully"
        )
        
    except Exception as e:
        return OCRResponse(
            success=False,
            extracted_text="",
            tables=[],
            images_count=0,
            session_id="",
            message=f"Error processing PDF: {str(e)}"
        )

@app.get("/ocr-10", response_model=OCR10Response)
async def get_ocr_extract_10(session_id: str = Query(...)):
    """
    Extract 10 specific data points using Gemini model from a previously processed PDF
    """
    if session_id not in extracted_contents:
        raise HTTPException(status_code=404, detail="Session not found. Please process a PDF first.")
    
    stored_content = extracted_contents[session_id]
    extracted_text = stored_content.get("text")
    
    if not extracted_text:
        raise HTTPException(status_code=400, detail="No text found in the session to process.")

    # Use enhanced extraction with better error handling
    extracted_10_data = extract_10_data_points_with_gemini(extracted_text)
    
    # Store the newly extracted data back into the session
    extracted_contents[session_id]["extracted_10_data"] = extracted_10_data
    
    return OCR10Response(
        success=True,
        session_id=session_id,
        extracted_data=extracted_10_data,
        message="10 data points extracted successfully"
    )

@app.post("/chatwithpdf", response_model=ChatResponse)
async def chat_with_pdf(chat_request: ChatRequest):
    """
    Chat with the extracted PDF content using Gemini model
    """
    try:
        session_id = chat_request.session_id
        
        if session_id not in extracted_contents:
            raise HTTPException(status_code=404, detail="Session not found. Please process a PDF first.")
        
        pdf_content = extracted_contents[session_id]
        
        # Get the extracted 10 data points if available
        extracted_data = pdf_content.get("extracted_10_data", {})
        
        # Prepare enhanced context for AI agent
        context = f"""
        CREDIT CARD STATEMENT ANALYSIS CONTEXT:

        EXTRACTED STRUCTURED DATA:
        {json.dumps(extracted_data, indent=2)}

        ADDITIONAL TEXT CONTEXT (for reference):
        {pdf_content['text'][:4000]}

        USER QUESTION: {chat_request.question}
        """
        
        prompt = f"""
        You are an intelligent financial analyst assistant. Analyze the credit card statement data and provide helpful, structured, and visually appealing responses.
        
        CONTEXT DATA:
        {context}
        
        RESPONSE GUIDELINES:
        1. Structure your response with clear sections and bullet points
        2. Format amounts in Indian Rupees (₹)
        3. Highlight key information
        4. Provide insights and summaries
        5. Use clear headings and spacing
        6. Make it easy to read and understand
        
        FORMATTING EXAMPLES:
        - Use headings like: "Account Summary" or "## Transaction Overview"
        - Group related information together
        - Use tables for transaction summaries when appropriate
        
        Please provide a well-structured, visually appealing response to the user's question.
        """
        
        answer = call_gemini_api(prompt)
        
        return ChatResponse(
            success=True,
            answer=answer,
            session_id=session_id
        )
        
    except Exception as e:
        return ChatResponse(
            success=False,
            answer=f"Error processing your request: {str(e)}",
            session_id=chat_request.session_id
        )

@app.post("/chat", response_model=GeneralChatResponse)
async def general_chat(chat_request: ChatRequest):
    """
    General support chat - No limits, user can ask anything
    """
    try:
        prompt = f"""
        You are a helpful, knowledgeable AI assistant. You can discuss any topic the user is interested in.
        
        However, if the user asks about you, your capabilities, or who created you, please mention:
        "This is made by Yash Buddhadev as an assignment for Sure Financials. For more details, drop an email at yashbuddhadev21@gmail.com"
        
        User Question: {chat_request.question}
        
        Please provide a helpful, engaging response.
        """
        
        answer = call_gemini_api(prompt)
        
        return GeneralChatResponse(
            success=True,
            answer=answer
        )
        
    except Exception as e:
        return GeneralChatResponse(
            success=False,
            answer=f"Error: {str(e)}"
        )

@app.get("/")
async def root():
    return {
        "message": "Credit Card Statement Parser API is running!",
        "endpoints": {
            "POST /ocr": "Process PDF to extract text, tables, images",
            "GET /ocr-10": "Extract 10 common data points from processed PDF",
            "POST /chatwithpdf": "Chat specifically about the uploaded PDF content",
            "POST /chat": "General chat about any topic",
            "GET /sessions": "List all active sessions",
            "GET /session/{session_id}": "Get specific session data"
        }
    }

@app.get("/sessions")
async def list_sessions():
    """List all active sessions (for debugging)"""
    sessions_info = {}
    for session_id, content in extracted_contents.items():
        sessions_info[session_id] = {
            "filename": content.get("filename", "Unknown"),
            "processed_at": content.get("processed_at", "Unknown"),
            "text_length": len(content.get("text", "")),
            "tables_count": len(content.get("tables", [])),
            "pages_count": len(content.get("pages", [])),
            "has_extracted_data": "extracted_10_data" in content
        }
    
    return {
        "active_sessions": sessions_info,
        "session_count": len(extracted_contents)
    }

@app.get("/session/{session_id}")
async def get_session_data(session_id: str):
    """Get stored data for a specific session"""
    if session_id in extracted_contents:
        content = extracted_contents[session_id]
        # Don't return full text in response to avoid huge payloads
        return {
            "success": True,
            "session_id": session_id,
            "filename": content.get("filename"),
            "processed_at": content.get("processed_at"),
            "text_length": len(content.get("text", "")),
            "tables_count": len(content.get("tables", [])),
            "pages_count": len(content.get("pages", [])),
            "images_count": content.get("images_count", 0),
            "has_extracted_10_data": "extracted_10_data" in content,
            "extracted_10_data": content.get("extracted_10_data", {})
        }
    else:
        raise HTTPException(status_code=404, detail="Session not found")

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a specific session"""
    if session_id in extracted_contents:
        del extracted_contents[session_id]
        return {"success": True, "message": "Session deleted successfully"}
    else:
        raise HTTPException(status_code=404, detail="Session not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)