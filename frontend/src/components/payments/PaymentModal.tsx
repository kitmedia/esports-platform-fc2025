import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  XMarkIcon,
  CreditCardIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline'
import { paymentApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const paymentSchema = z.object({
  cardNumber: z.string().min(16, 'Card number must be 16 digits').max(19),
  expiryMonth: z.string().min(2, 'Invalid month').max(2),
  expiryYear: z.string().min(2, 'Invalid year').max(2),
  cvv: z.string().min(3, 'CVV must be 3-4 digits').max(4),
  cardholderName: z.string().min(2, 'Cardholder name is required'),
  billingAddress: z.object({
    line1: z.string().min(1, 'Address is required'),
    line2: z.string().optional(),
    city: z.string().min(1, 'City is required'),
    state: z.string().min(1, 'State is required'),
    postalCode: z.string().min(1, 'Postal code is required'),
    country: z.string().min(1, 'Country is required'),
  }),
  saveCard: z.boolean(),
})

type PaymentFormData = z.infer<typeof paymentSchema>

interface PaymentModalProps {
  isOpen: boolean
  onClose: () => void
  amount: number
  description: string
  tournamentId?: string
  onSuccess?: () => void
}

export default function PaymentModal({
  isOpen,
  onClose,
  amount,
  description,
  tournamentId,
  onSuccess,
}: PaymentModalProps) {
  const [step, setStep] = useState<'payment' | 'processing' | 'success' | 'error'>('payment')
  const [errorMessage, setErrorMessage] = useState('')
  
  const queryClient = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      saveCard: false,
      billingAddress: {
        country: 'US',
      },
    },
  })

  const paymentMutation = useMutation({
    mutationFn: (data: any) => {
      if (tournamentId) {
        return paymentApi.createTournamentPayment({
          tournamentId,
          amount,
          paymentMethod: data,
        })
      }
      return paymentApi.createTournamentPayment({
        amount,
        paymentMethod: data,
      })
    },
    onMutate: () => {
      setStep('processing')
    },
    onSuccess: (data) => {
      setStep('success')
      queryClient.invalidateQueries({ queryKey: ['payment'] })
      setTimeout(() => {
        onSuccess?.()
        onClose()
      }, 2000)
    },
    onError: (error: any) => {
      setStep('error')
      setErrorMessage(error.response?.data?.message || 'Payment failed. Please try again.')
    },
  })

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
    const matches = v.match(/\d{4,16}/g)
    const match = matches && matches[0] || ''
    const parts = []
    for (let i = 0; i < match.length; i += 4) {
      parts.push(match.substring(i, i + 4))
    }
    if (parts.length) {
      return parts.join(' ')
    } else {
      return v
    }
  }

  const onSubmit = (data: PaymentFormData) => {
    const paymentData = {
      ...data,
      cardNumber: data.cardNumber.replace(/\s/g, ''),
    }
    paymentMutation.mutate(paymentData)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-end justify-center px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} />

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {step === 'payment' && (
            <>
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <CreditCardIcon className="w-6 h-6 text-gray-400 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Payment Details
                  </h3>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-gray-300">{description}</span>
                  <span className="text-xl font-bold text-gray-900 dark:text-white">
                    ${amount.toFixed(2)}
                  </span>
                </div>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Card Number
                  </label>
                  <input
                    {...register('cardNumber', {
                      onChange: (e) => {
                        e.target.value = formatCardNumber(e.target.value)
                      }
                    })}
                    type="text"
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                    className="input w-full"
                  />
                  {errors.cardNumber && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.cardNumber.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Month
                    </label>
                    <select {...register('expiryMonth')} className="input w-full">
                      <option value="">MM</option>
                      {Array.from({ length: 12 }, (_, i) => (
                        <option key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {String(i + 1).padStart(2, '0')}
                        </option>
                      ))}
                    </select>
                    {errors.expiryMonth && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.expiryMonth.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Year
                    </label>
                    <select {...register('expiryYear')} className="input w-full">
                      <option value="">YY</option>
                      {Array.from({ length: 10 }, (_, i) => {
                        const year = new Date().getFullYear() + i
                        return (
                          <option key={year} value={String(year).slice(-2)}>
                            {String(year).slice(-2)}
                          </option>
                        )
                      })}
                    </select>
                    {errors.expiryYear && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.expiryYear.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      CVV
                    </label>
                    <input
                      {...register('cvv')}
                      type="text"
                      placeholder="123"
                      maxLength={4}
                      className="input w-full"
                    />
                    {errors.cvv && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {errors.cvv.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cardholder Name
                  </label>
                  <input
                    {...register('cardholderName')}
                    type="text"
                    placeholder="John Doe"
                    className="input w-full"
                  />
                  {errors.cardholderName && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                      {errors.cardholderName.message}
                    </p>
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-600 pt-6">
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                    Billing Address
                  </h4>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Address Line 1
                      </label>
                      <input
                        {...register('billingAddress.line1')}
                        type="text"
                        className="input w-full"
                      />
                      {errors.billingAddress?.line1 && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {errors.billingAddress.line1.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Address Line 2 (Optional)
                      </label>
                      <input
                        {...register('billingAddress.line2')}
                        type="text"
                        className="input w-full"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          City
                        </label>
                        <input
                          {...register('billingAddress.city')}
                          type="text"
                          className="input w-full"
                        />
                        {errors.billingAddress?.city && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.billingAddress.city.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          State
                        </label>
                        <input
                          {...register('billingAddress.state')}
                          type="text"
                          className="input w-full"
                        />
                        {errors.billingAddress?.state && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.billingAddress.state.message}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Postal Code
                        </label>
                        <input
                          {...register('billingAddress.postalCode')}
                          type="text"
                          className="input w-full"
                        />
                        {errors.billingAddress?.postalCode && (
                          <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                            {errors.billingAddress.postalCode.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Country
                        </label>
                        <select {...register('billingAddress.country')} className="input w-full">
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="GB">United Kingdom</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="ES">Spain</option>
                          <option value="IT">Italy</option>
                          <option value="BR">Brazil</option>
                          <option value="MX">Mexico</option>
                          <option value="AU">Australia</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center">
                  <input
                    {...register('saveCard')}
                    type="checkbox"
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Save this card for future payments
                  </label>
                </div>

                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <LockClosedIcon className="w-4 h-4 mr-2" />
                  Your payment information is encrypted and secure
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="btn-outline flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={paymentMutation.isPending}
                    className="btn-primary flex-1"
                  >
                    Pay ${amount.toFixed(2)}
                  </button>
                </div>
              </form>
            </>
          )}

          {step === 'processing' && (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" className="mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Processing Payment
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Please wait while we process your payment...
              </p>
            </div>
          )}

          {step === 'success' && (
            <div className="text-center py-8">
              <CheckCircleIcon className="mx-auto h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Payment Successful!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Your payment has been processed successfully.
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="text-center py-8">
              <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Payment Failed
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {errorMessage}
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={onClose}
                  className="btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setStep('payment')}
                  className="btn-primary flex-1"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}