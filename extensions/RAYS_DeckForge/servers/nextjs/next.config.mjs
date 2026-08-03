const isTauri = process.env.BUILD_TARGET === "tauri";

const nextConfig = {
  reactStrictMode: false,
  distDir: ".next-build",
  output: isTauri ? "export" : "standalone",
  ...(process.env.NODE_ENV !== "production" && !isTauri
    ? {
        allowedDevOrigins: [
          "http://127.0.0.1:40001",
          "http://localhost:40001",
          "http://127.0.0.1:8080",
          "http://localhost:8080",
          "127.0.0.1",
          "localhost",
        ],
      }
    : {}),

  // Rewrites for development - proxy font requests to FastAPI backend
  // Dynamic rewrites are not supported by Next.js static exports
  ...(!isTauri
    ? {
        async rewrites() {
          return [
            {
              source: '/api/v1/:path*',
              destination: `${process.env.NEXT_PUBLIC_FAST_API || 'http://localhost:8000'}/api/v1/:path*`,
            },
            {
              source: '/app_data/fonts/:path*',
              destination: `${process.env.NEXT_PUBLIC_FAST_API || 'http://localhost:8000'}/app_data/fonts/:path*`,
            },
          ];
        },
      }
    : {}),


  images: {
    unoptimized: isTauri ? true : undefined,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-7c765f3726084c52bcd5d180d51f1255.r2.dev",
      },
      {
        protocol: "https",
        hostname: "pptgen-public.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "pptgen-public.s3.ap-south-1.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "img.icons8.com",
      },
      {
        protocol: "https",
        hostname: "present-for-me.s3.amazonaws.com",
      },
      {
        protocol: "https",
        hostname: "yefhrkuqbjcblofdcpnr.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
      {
        protocol: "https",
        hostname: "unsplash.com",
      },
    ],
  },
  
};

export default nextConfig;
