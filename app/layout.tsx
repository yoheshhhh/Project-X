import './globals.css';
import AITutor from '@/components/AITutor';
import AuthGuard from '@/components/AuthGuard';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata = {
  title: 'NTUlearn - AI-Powered Adaptive Learning',
  description: 'Personalized learning platform powered by AI for NTU students',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthGuard>{children}</AuthGuard>
        <AITutor />
        <div className="fixed bottom-4 left-4 z-50">
          <ThemeToggle />
        </div>
      </body>
    </html>
  );
}
