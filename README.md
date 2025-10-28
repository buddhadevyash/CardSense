# CardSense: Intelligent Credit Card Statement Analyzer

![CardSense](https://img.shields.io/badge/CardSense-AI%20Powered%20Statement%20Analysis-blue)
![FastAPI](https://img.shields.io/badge/FastAPI-Python%20Backend-green)
![Gemini AI](https://img.shields.io/badge/Gemini%20AI-Google%20LLM-orange)
![PyMuPDF](https://img.shields.io/badge/PyMuPDF-OCR%20Processing-lightgrey)

CardSense is an advanced AI-powered web application that transforms complex credit card statements into actionable financial insights. Using cutting-edge OCR technology and Gemini AI, it provides intelligent analysis, transaction categorization, and natural language querying capabilities.

## Project Demo

**Video Demo:** [Watch Here](https://drive.google.com/file/d/1EzcFgxYhUhJqeVZyjjikfjGphNU9SCJd/view?usp=sharing)  
**Deployed Frontend:** [Visit Frontend](https://card-sense-pi.vercel.app/)  
**Deployed Backend:** [Visit Backend](https://cardsense.onrender.com)


## 🚀 Technical System Overview

<img width="1014" height="722" alt="- visual selection(6)" src="https://github.com/user-attachments/assets/68dc64c8-40d2-4334-b2ab-d982322d42f7" />


This project integrates document processing, AI-powered analysis, and interactive chat capabilities to deliver comprehensive credit card statement insights. Below is a detailed breakdown of the components:

### 1. Intelligent OCR & Data Extraction Engine

I designed a sophisticated document processing pipeline that accurately extracts financial data from credit card statements using multiple extraction strategies:

- **PyMuPDF Integration**: High-performance PDF text extraction with table and image detection
- **Multi-Layer Pattern Matching**: Regex-based extraction for key financial fields (amounts, dates, card numbers)
- **Gemini AI Enhancement**: LLM-powered data validation and missing field calculation
- **Robust Data Merging**: Intelligent combination of pattern-matched and AI-extracted data

**Key Features:**
- Extracts 11 critical data points including customer info, transactions, reward points
- Handles masked card numbers and various statement formats
- Automatic calculation of derived fields (available credit, closing balances)
- Email address filtering to prevent incorrect customer name extraction

### 2. AI-Powered Financial Analysis & Chat

I implemented a conversational financial assistant that provides crisp, precise insights:

- **Context-Aware Responses**: Leverages extracted statement data for relevant answers
- **Structured Output**: Well-formatted financial summaries with clear sections
- **Multi-Session Support**: Maintains separate contexts for different statement analyses
- **Visual Formatting**: Uses headings, bullet points, and tables for readability

**Analysis Capabilities:**
- Transaction categorization and spending patterns
- Payment due date reminders and amount summaries
- Reward points tracking and utilization suggestions
- Credit limit utilization analysis

### 3. Advanced Data Point Extraction System

The core extraction engine meticulously processes 11 essential data points:

1. **Customer Information**: Name extraction with email filtering
2. **Statement Dates**: Generation and payment due dates
3. **Financial Summary**: Total due, minimum payment, credit limits
4. **Card Details**: Masked card number extraction
5. **Transaction History**: Complete transaction listing with amounts
6. **Reward Points**: Opening balance, earned, and closing balance
7. **Bank Identification**: Automatic bank name detection

### 4. Session Management & API Architecture

I built a robust backend with comprehensive session handling:

- **UUID-based Sessions**: Secure session management for multiple users
- **RESTful API Design**: Clean endpoints for OCR, extraction, and chat
- **Data Persistence**: In-memory storage with database-ready architecture
- **CORS Support**: Cross-origin resource sharing for web frontend integration

## 🛠 Technology Stack

**Backend:**
- FastAPI (Python) - High-performance API framework
- PyMuPDF - PDF text extraction and OCR
- Google Gemini AI - LLM for data extraction and analysis
- Pydantic - Data validation and serialization
- Python-dotenv - Environment configuration

**Frontend-Ready:**
- CORS middleware for web application integration
- RESTful JSON API design
- Session-based authentication
- File upload support

## Images

<img width="1788" height="973" alt="Screenshot From 2025-10-23 17-54-09" src="https://github.com/user-attachments/assets/4c3f4401-e9f9-4f74-a39e-38deb2256098" />

<img width="1788" height="973" alt="Screenshot From 2025-10-23 17-54-16" src="https://github.com/user-attachments/assets/c847872d-367c-4e42-a22f-b542f7729af7" />


<img width="1788" height="973" alt="Screenshot From 2025-10-23 17-54-21" src="https://github.com/user-attachments/assets/3795054a-1351-4fbd-9ec7-81d8ce4aadce" />

<img width="1788" height="973" alt="Screenshot From 2025-10-23 18-00-55" src="https://github.com/user-attachments/assets/7724be43-79af-4faa-8159-b9b9b9d7efcf" />

<img width="1788" height="973" alt="Screenshot From 2025-10-23 18-02-34" src="https://github.com/user-attachments/assets/685b26a9-384e-4ec8-9322-2e3a09ee7f50" />

<img width="1788" height="973" alt="Screenshot From 2025-10-23 18-02-38" src="https://github.com/user-attachments/assets/a70432c4-2ad1-43bd-b36f-f5e8aeb59aea" />

<img width="1920" height="1009" alt="Screenshot From 2025-10-23 18-02-57" src="https://github.com/user-attachments/assets/72f815ee-ad3e-46a4-9ee5-d6ef3694bb49" />

<img width="818" height="716" alt="- visual selection(11)" src="https://github.com/user-attachments/assets/9641570c-e7fe-484a-bda6-e197773b4767" />




## 📊 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/ocr` | Process PDF and extract text, tables, images |
| `GET` | `/ocr-10` | Extract 11 financial data points from processed PDF |
| `POST` | `/chatwithpdf` | AI-powered chat about uploaded statement |
| `POST` | `/chat` | General support chat |
| `GET` | `/sessions` | List all active processing sessions |
| `GET` | `/session/{id}` | Get specific session data |
| `DELETE` | `/session/{id}` | Delete session data |

## Project Structure

```plaintext
cardsense/
├── main.py                 # FastAPI application entry point
├── .env                    # Environment variables
├── requirements.txt        # Python dependencies
├── README.md               # Project documentation
├── server/                 # Backend server code
│   └── main.py
├── src/                    # Frontend source code
│   ├── app/
│   │   ├── api/
│   │   ├── home/
│   │   │   └── assistant/
│   │   │       └── page.tsx
│   │   └── info/
│   │       └── page.tsx
│   ├── components/
│   └── lib/
├── node_modules/           # Node dependencies
└── public/                 # Public assets


## 🚀 Getting Started

### Prerequisites
- Python 3.8+
- Google Gemini API key
- FastAPI and Uvicorn

# Clone the repository
git clone https://github.com/buddhadevyash/CardSense.git
cd CardSense

# Install dependencies from requirements.txt
pip install -r requirements.txt

# Create a .env file (replace with your actual keys)
echo "GEMINI_API_KEY=your_gemini_api_key_here" > .env
echo "GEMINI_MODEL=gemini-2.0-flash-exp" >> .env

# Run the application
uvicorn main:app --reload --host 0.0.0.0 --port 8000
