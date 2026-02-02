import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | ProofMesh",
  description: "Privacy policy for ProofMesh - Collaborative mathematics platform",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-neutral-100 bg-white/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-5 h-5 bg-neutral-900 rounded-sm flex items-center justify-center text-white">
              <span className="font-[var(--font-math)] italic text-[11px] leading-none logo-rho">&rho;</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">ProofMesh</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-xs font-medium text-neutral-600 hover:text-neutral-900">
              Log in
            </Link>
            <Link
              href="/register"
              className="px-4 py-2 bg-neutral-900 text-white text-xs font-medium rounded-full hover:bg-neutral-800 transition-colors"
            >
              Start Proving
            </Link>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="pt-32 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-semibold tracking-tight text-neutral-900 mb-8">
            Privacy Policy
          </h1>
          
          <div className="prose prose-neutral max-w-none">
            <p className="text-neutral-600 mb-6">
              Last updated: February 2026
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">1. Information We Collect</h2>
              <p className="text-neutral-600 mb-4">
                We collect information you provide directly to us when you:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 ml-4">
                <li>Create an account (username, email, password)</li>
                <li>Create or edit problems, proofs, and discussions</li>
                <li>Upload files or mathematical content</li>
                <li>Interact with other users (comments, stars, follows)</li>
                <li>Communicate with us</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">2. How We Use Your Information</h2>
              <p className="text-neutral-600 mb-4">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 ml-4">
                <li>Provide, maintain, and improve ProofMesh services</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Understand how users interact with our platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">3. Information Sharing</h2>
              <p className="text-neutral-600">
                We do not sell or rent your personal information to third parties. 
                We may share information only in limited circumstances, such as with 
                your consent, to comply with legal obligations, or with service providers 
                who assist in operating our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">4. Data Security</h2>
              <p className="text-neutral-600">
                We take reasonable measures to help protect your personal information 
                from loss, theft, misuse, unauthorized access, disclosure, alteration, 
                and destruction. However, no internet transmission is completely secure.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">5. Your Rights</h2>
              <p className="text-neutral-600 mb-4">
                You have the right to:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 ml-4">
                <li>Access and update your account information</li>
                <li>Request deletion of your account and data</li>
                <li>Export your data</li>
                <li>Opt out of promotional communications</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">6. Contact Us</h2>
              <p className="text-neutral-600">
                If you have any questions about this Privacy Policy, please contact us at:
                privacy@proofmesh.io
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 py-8">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-neutral-500">
            &copy; 2026 ProofMesh. All rights reserved.
          </p>
          <div className="flex items-center gap-6 text-xs text-neutral-500">
            <Link href="/privacy" className="hover:text-neutral-900">Privacy</Link>
            <Link href="/terms" className="hover:text-neutral-900">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
