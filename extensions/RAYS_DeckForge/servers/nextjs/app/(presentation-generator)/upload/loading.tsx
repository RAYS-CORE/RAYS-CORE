import Header from "@/app/(presentation-generator)/(dashboard)/dashboard/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const loading = () => {
  return (
    <div>
      <Header />
      <div className="max-w-[1440px] w-[95%] mx-auto pb-10 lg:max-w-[70%] xl:max-w-[65%]  py-6">
        <Skeleton className="h-6 w-full max-w-lg mx-auto" />
        <Skeleton className="h-40 w-full  mx-auto mt-10" />
        <Skeleton className="h-64 w-full  mx-auto mt-16" />
        <Skeleton className="h-16 w-full  mx-auto mt-16" />
      </div>
    </div>
  );
};

export default loading;
