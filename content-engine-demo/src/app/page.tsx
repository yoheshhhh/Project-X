import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-3xl font-bold mb-4">Content Engine Demo</h1>
      <p className="text-gray-400 mb-8 text-center max-w-md">
        LAMS-style gated video: watch → quiz at segment end → pass to unlock next. Runs standalone until Narhen&apos;s repo is ready.
      </p>
      <Link
        href="/watch"
        className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 font-medium"
      >
        Go to Watch
      </Link>
    </main>
  );
}
