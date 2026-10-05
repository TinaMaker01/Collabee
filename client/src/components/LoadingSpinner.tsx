export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = { sm: 'h-5 w-5', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <div className="flex items-center justify-center p-8" role="status" aria-live="polite">
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-amber-200 border-t-amber-600`} />
      <span className="sr-only">Loading...</span>
    </div>
  )
}
