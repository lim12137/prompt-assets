import "./globals.css";

export const metadata = {
  title: "Prompt Library",
  description: "Prompt Library",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
