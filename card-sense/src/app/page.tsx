"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* This style block imports the new font from Google Fonts */}
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&display=swap');
      `}</style>
      <div
        className="flex min-h-screen w-full flex-col bg-[#561530] text-gray-200"
        style={{
          backgroundImage:
            "url('https://www.transparenttextures.com/patterns/diagmonds.png')",
          fontFamily: "'Share Tech Mono', monospace",
        }}
      >
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[#811844] bg-[#561530]/80 px-6 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-[#F5AD18]" />
            <span className="text-xl font-bold tracking-tight text-gray-100">
              CardSense
            </span>
          </div>
          <Link href="/home">
            <Button className="bg-[#9E1C60] text-white hover:bg-[#811844]">
              Try
            </Button>
          </Link>
        </header>

        {/* Main Content */}
        <main className="flex flex-1 flex-col items-center justify-center p-6 text-center">
          <div className="flex max-w-3xl flex-col items-center gap-6">
            {/* Hero Section */}
            <h1 className="text-4xl font-extrabold tracking-tighter text-white sm:text-5xl md:text-6xl">
              Unlock Insights from Your Credit Card Statements
            </h1>
            <p className="max-w-xl text-lg text-gray-300">
              CardSense intelligently parses your PDF statements, extracting key
              data effortlessly. Turn complex statements into clear, usable
              information in seconds.
            </p>
            <Link href="/home">
              <Button
                size="lg"
                className="mt-4 bg-[#9E1C60] text-lg text-white shadow-lg transition-all hover:bg-[#811844] hover:shadow-xl focus:ring-[#F5AD18]"
              >
                Get Started
              </Button>
            </Link>
          </div>

          {/* Features Section */}
          <div className="mt-24 grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-3">
            <FeatureCard
              icon={<FileText className="h-8 w-8 text-[#F5AD18]" />}
              title="Multi-Issuer Support"
              description="Reliably parse statements from 5 major credit card providers with high accuracy."
            />
            <FeatureCard
              icon={<Database className="h-8 w-8 text-[#F5AD18]" />}
              title="Key Data Extraction"
              description="Automatically extract transaction info, due dates, total balance, and more."
            />
            <FeatureCard
              icon={<ShieldCheck className="h-8 w-8 text-[#F5AD18]" />}
              title="Secure & Private"
              description="Your data is processed securely on your device and is never stored or shared."
            />
          </div>
        </main>

        {/* Footer */}
        <footer className="mt-auto border-t border-[#811844] py-6 text-center text-sm text-gray-400">
          © {new Date().getFullYear()} CardSense. All Rights Reserved.
        </footer>
      </div>
    </>
  );
}

// Helper component for feature cards using shadcn/ui Card
function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="transform border-[#811844] bg-[#811844] text-left text-gray-200 transition-transform duration-300 hover:shadow-xl hover:-translate-y-1 hover:shadow-[#F5AD18]/10">
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#561530]">
          {icon}
        </div>
        <div>
          <CardTitle className="text-lg font-semibold text-white">
            {title}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-base text-gray-300">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  );
}

