import * as z from "zod";
import { ImageSchema, IconSchema } from "@/app/presentation-templates/defaultSchemes";

export const Schema = z.object({
  title: z.string().min(5).max(50).default("Quarterly Business Review").meta({
    description: "Main slide title",
  }),

  subtitle: z
    .string()
    .min(3)
    .max(100)
    .optional()
    .default("Q1 2024 Performance Summary")
    .meta({
      description: "Optional subtitle",
    }),

  metrics: z
    .array(
      z.object({
        label: z.string().min(2).max(20),
        value: z.string().min(1).max(10),
        trend: z.enum(["up", "down", "stable"]),
      })
    )
    .default([
      { label: "Revenue", value: "$2.4M", trend: "up" },
      { label: "Growth", value: "15%", trend: "up" },
    ])
    .meta({
      description: "Key performance metrics",
    }),

  chartImage: ImageSchema.default({
    __image_url__: "https://example.com/quarterly-chart.png",
    __image_prompt__: "Quarterly performance chart showing upward trend",
  }).meta({
    description: "Main performance chart",
  }),

  trendIcon: IconSchema.default({
    __icon_url__: "/static/icons/placeholder.svg",
    __icon_query__: "upward trend arrow icon",
  }).meta({
    description: "Trend indicator icon",
  }),
});

type SchemaType = z.infer<typeof Schema>;

export default function ExampleSlideLayout({ data }: { data: SchemaType }) {
  const { title, subtitle, metrics, chartImage, trendIcon } = data;
  return (
    <div className="aspect-video max-w-[1280px] w-full bg-card">
      <header className="slide-header">
        {title && <h1 className="text-4xl font-bold text-foreground">{title}</h1>}
        {subtitle && <p className="text-xl text-foreground mt-2">{subtitle}</p>}
      </header>

      <main className="slide-content flex-1 flex">
        {chartImage?.__image_url__ && (
          <div className="chart-section flex-1">
            <img
              src={chartImage.__image_url__}
              alt={chartImage.__image_prompt__}
              className="w-full h-auto max-h-96 object-contain"
            />
          </div>
        )}

        {metrics && metrics.length > 0 && (
          <div className="metrics-section w-1/3 ml-6">
            <h2 className="text-2xl font-semibold mb-4">Key Metrics</h2>
            {metrics.map((metric, index) => (
              <div
                key={index}
                className="metric-item mb-4 p-3 bg-muted rounded"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{metric.label}</span>
                  {trendIcon?.__icon_url__ && (
                    <img
                      src={trendIcon.__icon_url__}
                      alt={metric.trend}
                      className="w-6 h-6"
                    />
                  )}
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
