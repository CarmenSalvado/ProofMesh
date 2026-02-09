import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | ProofMesh",
  description: "Terms of service for ProofMesh - Collaborative mathematics platform",
};

export default function TermsPage() {
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
            Terms of Service
          </h1>
          
          <div className="prose prose-neutral max-w-none">
            <p className="text-neutral-600 mb-6">
              Last updated: February 2026
            </p>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">1. Acceptance of Terms</h2>
              <p className="text-neutral-600">
                By accessing or using ProofMesh, you agree to be bound by these Terms of Service. 
                If you do not agree to these terms, please do not use our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">2. Description of Service</h2>
              <p className="text-neutral-600">
                ProofMesh is a collaborative platform for mathematical problem-solving, 
                proof verification, and academic research. We provide tools for creating, 
                sharing, and verifying mathematical proofs using Lean 4 and other formal 
                verification systems.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">3. User Accounts</h2>
              <p className="text-neutral-600 mb-4">
                To use certain features of ProofMesh, you must create an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 ml-4">
                <li>Provide accurate and complete information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Promptly notify us of any unauthorized access</li>
                <li>Accept responsibility for all activities under your account</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">4. User Content</h2>
              <p className="text-neutral-600 mb-4">
                You retain ownership of content you create on ProofMesh. By posting content, you grant us:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 ml-4">
                <li>A license to host, display, and distribute your content</li>
                <li>The right to modify content for technical purposes</li>
                <li>Permission to share public content with other users</li>
              </ul>
              <p className="text-neutral-600 mt-4">
                You are responsible for ensuring your content does not violate intellectual 
                property rights or contain harmful, illegal, or offensive material.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">5. Acceptable Use</h2>
              <p className="text-neutral-600 mb-4">
                You agree not to:
              </p>
              <ul className="list-disc list-inside text-neutral-600 space-y-2 ml-4">
                <li>Use the platform for any illegal purpose</li>
                <li>Attempt to gain unauthorized access to any part of the service</li>
                <li>Interfere with or disrupt the integrity of the platform</li>
                <li>Harass, abuse, or harm other users</li>
                <li>Upload malicious code or viruses</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">6. Termination</h2>
              <p className="text-neutral-600">
                We reserve the right to suspend or terminate your account at any time 
                for violations of these terms or for any other reason at our discretion. 
                You may also delete your account at any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">7. Disclaimer</h2>
              <p className="text-neutral-600">
                ProofMesh is provided &quot;as is&quot; without warranties of any kind. 
                We do not guarantee the accuracy of proofs or mathematical content created 
                by users. Always verify critical mathematical results independently.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-xl font-semibold text-neutral-900 mb-4">8. Contact</h2>
              <p className="text-neutral-600">
                For questions about these Terms, please contact us at: legal@proofmesh.org
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
