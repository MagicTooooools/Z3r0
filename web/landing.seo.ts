export const landingSeo = {
  siteUrl: "https://z3r0.fans/",
  siteName: "Z3r0",
  title: "Z3r0 - Multi-Agent Security Workbench for Red Team, Code Audit, and Research",
  description:
    "Z3r0 is a controlled multi-agent security workbench for authorized red team operations, code auditing, vulnerability validation, reverse engineering, cryptography review, and security research.",
  imagePath: "assets/z3r0-logo.png",
  imageAlt: "Z3r0 logo",
  keywords: [
    "Z3r0",
    "multi-agent security workbench",
    "AI security agent platform",
    "authorized red team operations",
    "code audit automation",
    "vulnerability validation",
    "Docker sandbox security testing",
    "security research workbench",
    "agent orchestration",
    "reverse engineering automation",
    "cryptography review",
  ],
};

export const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: landingSeo.siteName,
    applicationCategory: "SecurityApplication",
    operatingSystem: "Linux, Docker",
    url: landingSeo.siteUrl,
    image: new URL(landingSeo.imagePath, landingSeo.siteUrl).toString(),
    description: landingSeo.description,
    softwareRequirements: "Docker Engine, Docker Compose, PostgreSQL, model provider credentials",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    sameAs: ["https://github.com/yv1ing/Z3r0"],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What is Z3r0?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Z3r0 is a controlled multi-agent security workbench for authorized red team operations, code auditing, vulnerability validation, and security research.",
        },
      },
      {
        "@type": "Question",
        name: "Who is Z3r0 designed for?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Z3r0 is designed for security operators, internal assessment teams, code auditors, red teamers, reverse engineers, cryptography reviewers, and controlled research or training environments.",
        },
      },
      {
        "@type": "Question",
        name: "How does Z3r0 run security tooling?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Z3r0 binds agent tools and manual operator takeover to controlled Docker sandbox containers with shell, file, browser, noVNC, and security tooling access.",
        },
      },
      {
        "@type": "Question",
        name: "What environments should use Z3r0?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Z3r0 should be used only in authorized, trusted, and isolated environments where Docker access, model credentials, terminal access, and sandbox containers can be governed as high-privilege assets.",
        },
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Z3r0",
        item: landingSeo.siteUrl,
      },
    ],
  },
];

export function getRobotsTxt() {
  return [
    "User-agent: *",
    "Allow: /",
    "",
    `Sitemap: ${new URL("sitemap.xml", landingSeo.siteUrl).toString()}`,
    "",
  ].join("\n");
}

export function getSitemapXml() {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${landingSeo.siteUrl}</loc>`,
    "    <changefreq>weekly</changefreq>",
    "    <priority>1.0</priority>",
    "  </url>",
    "</urlset>",
    "",
  ].join("\n");
}

export function getWebManifest(iconSrc: string) {
  return JSON.stringify(
    {
      name: "Z3r0",
      short_name: "Z3r0",
      description: landingSeo.description,
      start_url: "/",
      display: "standalone",
      background_color: "#090d16",
      theme_color: "#d92d3a",
      icons: [
        {
          src: iconSrc,
          sizes: "1000x1000",
          type: "image/png",
          purpose: "any",
        },
      ],
    },
    null,
    2,
  );
}
