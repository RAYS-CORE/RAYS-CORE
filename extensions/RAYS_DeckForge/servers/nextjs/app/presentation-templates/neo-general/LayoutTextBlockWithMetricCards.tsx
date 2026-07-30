import * as z from "zod";
import React from "react";

export const Schema = z.object({
    title: z
        .string()
        .max(30)
        .describe("The main heading of the slide")
        .default("Business Objective & KPIs"),
    objectiveTitle: z
        .string()
        .max(80)
        .describe("Subheading or objective statement")
        .default(
            "Accelerate enterprise customer acquisition across EMEA and North America"
        ),
    description: z
        .string()
        .max(300)
        .describe("Supporting description text")
        .default(
            "Focus on companies with 500+ employees in Financial Services, Healthcare, and Technology sectors. Target $3.5M in new pipeline with sub-$150 CAC through account-based marketing and content-led strategies."
        ),
    kpis: z
        .array(
            z.object({
                name: z.string().max(30).describe("Name of the metric card"),
                value: z.string().max(10).describe("Current value displayed"),
                targetValue: z.string().max(10).describe("Target value displayed"),
                targetLabel: z.string().max(15).describe("Label text for target"),
                progressPercentage: z
                    .number()
                    .min(0)
                    .max(100)
                    .describe("Progress percentage value"),
                color: z.string().describe("Color hex code for progress bar"),
                footerLabel: z.string().max(15).describe("Footer label text"),
            })
        )
        .default([
            {
                name: "Pipeline Generated",
                value: "$4.2M",
                targetValue: "$3.5M",
                targetLabel: "Target",
                progressPercentage: 85,
                color: "#9234EC",
                footerLabel: "of total",
            },
            {
                name: "Marketing Qualified Leads",
                value: "8,420",
                targetValue: "6,250",
                targetLabel: "Target",
                progressPercentage: 75,
                color: "#9234EC",
                footerLabel: "of total",
            },
            {
                name: "Return on Ad Spend",
                value: "4.8X",
                targetValue: "4.0x",
                targetLabel: "Target",
                progressPercentage: 80,
                color: "#FF5400",
                footerLabel: "of total",
            },
            {
                name: "Return on Ad Spend",
                value: "4.8X",
                targetValue: "4.0x",
                targetLabel: "Target",
                progressPercentage: 80,
                color: "#FF5400",
                footerLabel: "of total",
            },
            {
                name: "Return on Ad Spend",
                value: "4.8X",
                targetValue: "4.0x",
                targetLabel: "Target",
                progressPercentage: 80,
                color: "#FF5400",
                footerLabel: "of total",
            },


        ]),
});
export const layoutId = "layout-text-block-with-metric-cards";
export const layoutName = "Text Block With Progress Metric Cards";
export const layoutDescription =
    "A split layout with title, subheading, and description on the left, paired with a gray panel containing up to 5 metric cards on the right. Each card shows name, value, target comparison, and semi-circular progress indicator.";
const SemiCircleProgress = ({
    percentage,
    color,
}: {
    percentage: number;
    color: string;
}) => {
    const radius = 40;
    const strokeWidth = 14;
    const circumference = Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;
    return (
        <div className="relative w-[150px] h-[75px] overflow-hidden">

            <svg
                viewBox="0 0 100 50"
                className="w-full h-full transform transition-all duration-500"
            >

                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke="#E6EAF1"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                />
                <path
                    d="M 10 50 A 40 40 0 0 1 90 50"
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                />
            </svg>
        </div>
    );
};
const KPICard = ({ kpi }: { kpi: z.infer<typeof Schema>["kpis"][0] }) => {
    return (
        <div className="relative min-w-[300px] ">

            {/* Card Container */}
            <div className="   rounded-xl shadow-sm border  overflow-hidden"

                style={{
                    backgroundColor: 'var(--card-color,#ffffff)',
                    borderColor: 'var(--stroke,#F0F0F2)'
                }}
            >


                {/* Header Bar */}
                <div
                    className=" w-full h-[65px]  flex items-center justify-between px-5 text-foreground"
                    style={{
                        backgroundColor: 'var(--primary-color,#9234EC)',

                        color: 'var(--primary-text,#FFFFFF)'
                    }}
                >

                    <span className="font-normal text-[17.8px] leading-tight w-1/2"

                        style={{
                            color: 'var(--primary-text,#ffffff)'
                        }}
                    >
                        {kpi.name}
                    </span>
                    <span className=" font-bold text-[31.9px]"
                        style={{
                            color: 'var(--primary-text,#ffffff)'
                        }}
                    >
                        {kpi.value}
                    </span>
                </div>
                {/* Content Area */}
                <div className=" w-full h-[135px] flex items-center px-6">

                    <div className="flex flex-col flex-1">

                        <span className=" font-normal text-[#514E7D] text-[17.8px]"

                            style={{
                                color: 'var(--background-text,#514E7D)'
                            }}
                        >
                            {kpi.targetLabel}
                        </span>
                        <span className=" font-bold text-[#322C23] text-[24.9px]"

                            style={{
                                color: 'var(--background-text,#322C23)'
                            }}
                        >
                            {kpi.targetValue}
                        </span>
                        <span className=" font-normal text-[#322C23] opacity-70 text-[16px]"

                            style={{
                                color: 'var(--background-text,#322C23)'
                            }}
                        >
                            {kpi.footerLabel}
                        </span>
                    </div>


                    <SemiCircleProgress
                        percentage={kpi.progressPercentage}
                        color={kpi.color}
                    />

                </div>
            </div>
        </div>
    );
};
const dynamicSlideLayout = ({ data }: { data: z.infer<typeof Schema> }) => {
    return (
        <>
            <link
                href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
                rel="stylesheet"
            />
            <div className="  w-full h-full rounded-sm max-w-[1280px] flex items-center gap-[20px] shadow-lg aspect-video bg-card relative z-20 mx-auto overflow-hidden "

                style={{
                    fontFamily: 'var(--heading-font-family,Poppins)',
                    background: "var(--background-color,#ffffff)"
                }}
            >
                {((data as any)?.__companyName__ || (data as any)?._logo_url__) && (
                    <div className="absolute top-0 left-0 right-0 px-8  pt-4">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-1">
                                {(data as any)?._logo_url__ && <img src={(data as any)?._logo_url__} alt="logo" className="w-[60px] object-contain" />}
                                <span
                                    style={{ backgroundColor: 'var(--stroke, #F0F0F0)' }}
                                    className=' w-[2px] h-4'></span>
                                {(data as any)?.__companyName__ && <span className="text-sm  font-semibold" style={{ color: 'var(--background-text, #111827)' }}>
                                    {(data as any)?.__companyName__ || 'Company Name'}
                                </span>}
                            </div>
                        </div>
                    </div>
                )}


                <div className=" w-full p-8">

                    <h1 className="text-[42.7px]  font-bold leading-[1.1] mb-4 tracking-tight"

                        style={{
                            color: 'var(--background-text,#101828)'
                        }}
                    >

                        {data.title}
                    </h1>
                    <div className="w-[116px] h-[6px]"

                        style={{
                            backgroundColor: 'var(--primary-color,#9234EB)'
                        }}
                    />
                    <div className="space-y-6">

                        <h2 className="text-[21.3px]  font-bold leading-snug"

                            style={{
                                color: 'var(--background-text,#000000)'
                            }}
                        >

                            {data.objectiveTitle}
                        </h2>
                        <p className="text-[16px] font-normal leading-relaxed opacity-80"

                            style={{
                                color: 'var(--background-text,#000000)'
                            }}
                        >

                            {data.description}
                        </p>
                    </div>
                </div>
                <div className="bg-[#EEF3F7] w-full h-full flex items-center justify-center p-8">


                    <div className="flex gap-[18px] w-full items-center justify-center"

                    >
                        {data.kpis.length > 2 && <div className="flex flex-col gap-[18px]">
                            <div className="">

                                {data.kpis[3] && <KPICard kpi={data.kpis[3]} />}
                            </div>
                            <div className=" ">

                                {data.kpis[4] && <KPICard kpi={data.kpis[4]} />}
                            </div>
                        </div>}
                        <div className="flex flex-col gap-[18px]">

                            <div className=" ">

                                {data.kpis[0] && <KPICard kpi={data.kpis[0]} />}
                            </div>
                            <div className=" ">

                                {data.kpis[1] && <KPICard kpi={data.kpis[1]} />}
                            </div>
                            <div className="">

                                {data.kpis[2] && <KPICard kpi={data.kpis[2]} />}
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </>
    );
};

export default dynamicSlideLayout;