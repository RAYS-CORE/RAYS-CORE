import React from "react";
import { Loader2 } from "lucide-react";
import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";

interface LoadingSpinnerProps {
  message: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <div className="min-h-screen bg-[#000000]">
      <Header />
      <div className="flex items-center justify-center aspect-video mx-auto px-6">
        <div className="text-center space-y-2 my-6 bg-[#1d1d1d] p-6 rounded-[10px] border border-[#383838]">
          <Loader2 className="w-6 h-6 animate-spin text-[#ffffff] mx-auto" />
          <p className="text-[#ffffff]">{message}</p>
        </div>
      </div>
    </div>
  );
}; 