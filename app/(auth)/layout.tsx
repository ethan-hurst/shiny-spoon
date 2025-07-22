// Auth pages layout - centered card design
import Image from 'next/image'
import Link from 'next/link'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-gray-50 px-4 sm:px-6 lg:px-8">
      {/* Logo and branding */}
      <div className="mb-8 text-center">
        <Link href="/" className="inline-flex items-center space-x-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">T</span>
          </div>
          <span className="text-2xl font-bold text-gray-900">TruthSource</span>
        </Link>
        <p className="mt-2 text-sm text-gray-600">
          B2B e-commerce data accuracy platform
        </p>
      </div>

      {/* Auth form container */}
      <div className="w-full max-w-md">{children}</div>

      {/* Footer links */}
      <div className="mt-8 text-center text-sm text-gray-600">
        <p>
          By continuing, you agree to our{' '}
          <Link href="/terms" className="text-blue-600 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-blue-600 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
