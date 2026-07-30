"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, FileX } from "lucide-react";

interface LoadingStatesProps {
  type: "loading" | "error" | "empty";
  message?: string;
}

const LoadingStates: React.FC<LoadingStatesProps> = ({ type, message }) => {
  if (type === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-card to-indigo-50 flex items-center justify-center">
        <Card className="p-8 text-center shadow-xl border-0 bg-card/80 backdrop-blur-sm">
          <CardContent className="space-y-6">
            <div className="relative">
              <div className="w-16 h-16 mx-auto mb-4 relative">
                <Loader2 className="w-16 h-16 text-blue-500 animate-spin" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-blue-100 rounded-full animate-pulse"></div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Loading Layouts
              </h3>
              <p className="text-foreground">
                {message || "Discovering and loading layout components..."}
              </p>
            </div>

            {/* Loading animation dots */}
            <div className="flex justify-center space-x-1">
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              ></div>
              <div
                className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "error") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-card to-orange-50 flex items-center justify-center">
        <Card className="p-8 text-center shadow-xl border-0 bg-card/80 backdrop-blur-sm max-w-md">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 mx-auto p-4 bg-red-100 rounded-full">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                Something went wrong
              </h3>
              <p className="text-foreground text-sm leading-relaxed">
                {message ||
                  "Failed to load layouts. Please check your layout files and try again."}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "empty") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-muted via-card to-card flex items-center justify-center">
        <Card className="p-8 text-center shadow-xl border-0 bg-card/80 backdrop-blur-sm max-w-md">
          <CardContent className="space-y-6">
            <div className="w-16 h-16 mx-auto p-4 bg-muted rounded-full">
              <FileX className="w-8 h-8 text-muted-foreground" />
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-semibold text-foreground">
                No Layouts Found
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                No valid layout files were discovered. Make sure your layout
                components export both a default component and a Schema.
              </p>
            </div>

            <div className="bg-muted p-4 rounded-lg text-left text-xs text-foreground">
              <p className="font-medium mb-2">Expected structure:</p>
              <code className="block">
                export default MyLayout
                <br />
                export const Schema = z.object(...)
              </code>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
};

// Component for layout grid skeleton while loading
export const LayoutGridSkeleton: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-card to-indigo-50">
      {/* Header Skeleton */}
      <div className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-muted rounded-lg animate-pulse"></div>
              <div className="w-32 h-6 bg-muted rounded animate-pulse"></div>
            </div>
            <div className="w-16 h-6 bg-muted rounded animate-pulse"></div>
          </div>
        </div>
      </div>

      {/* Main Content Skeleton */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar Skeleton */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="p-4">
              <div className="space-y-3">
                <div className="w-24 h-4 bg-muted rounded animate-pulse"></div>
                <div className="space-y-2">
                  <div className="w-full h-8 bg-muted rounded animate-pulse"></div>
                  <div className="w-full h-8 bg-muted rounded animate-pulse"></div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="w-full h-12 bg-muted rounded animate-pulse"
                    ></div>
                  ))}
                </div>
              </div>
            </Card>
          </div>

          {/* Main Display Skeleton */}
          <div className="lg:col-span-3">
            <Card className="p-6">
              <div className="space-y-4">
                <div className="w-full h-96 bg-muted rounded-lg animate-pulse"></div>
                <div className="space-y-2">
                  <div className="w-48 h-4 bg-muted rounded animate-pulse"></div>
                  <div className="w-32 h-3 bg-muted rounded animate-pulse"></div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingStates;
