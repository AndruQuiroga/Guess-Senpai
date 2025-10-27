export type FooterLink = {
  label: string;
  href: string;
  external?: boolean;
};

export type FooterSection = {
  title: string;
  links: FooterLink[];
};

export const footerSections: FooterSection[] = [
  {
    title: "Support",
    links: [
      {
        label: "How to Play",
        href: "/how-to-play",
      },
      {
        label: "Contact Us",
        href: "mailto:support@guessenpai.app",
        external: true,
      },
    ],
  },
  {
    title: "Community",
    links: [
      {
        label: "Archive",
        href: "/archive",
      },
      {
        label: "Discord",
        href: "https://discord.gg/guessenpai",
        external: true,
      },
      {
        label: "X (Twitter)",
        href: "https://twitter.com/GuessSenpai",
        external: true,
      },
    ],
  },
  {
    title: "Legal",
    links: [
      {
        label: "Privacy Policy",
        href: "/privacy",
      },
      {
        label: "Terms of Service",
        href: "/terms",
      },
    ],
  },
];
