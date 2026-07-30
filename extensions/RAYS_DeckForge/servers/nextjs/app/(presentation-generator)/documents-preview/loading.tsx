import { Skeleton } from "@/components/ui/skeleton";
import React from "react";

const loading = () => {
  return (
    <div>
      <Skeleton className="h-20 w-full  mx-auto" />
      <div className=" flex gap-14 pb-10  h-screen  py-6">
        <Skeleton className="h-full w-[30%]  mx-auto" />
        <Skeleton className="h-full w-[70%]   " />
      </div>
    </div>
  );
};

export default loading;
