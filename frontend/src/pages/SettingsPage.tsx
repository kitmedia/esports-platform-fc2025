import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  CogIcon,
  BellIcon,
  ShieldCheckIcon,
  CreditCardIcon,
  UserGroupIcon,
  EyeIcon,
  MoonIcon,
  SunIcon,
  ComputerDesktopIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import { useAuthStore } from '@/stores/authStore'
import { userApi, paymentApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const settingsSchema = z.object({
  notifications: z.object({
    email: z.boolean(),
    push: z.boolean(),
    tournament: z.boolean(),
    match: z.boolean(),
    marketing: z.boolean(),
  }),
  privacy: z.object({
    profileVisibility: z.enum(['PUBLIC', 'FRIENDS_ONLY', 'PRIVATE']),
    showOnlineStatus: z.boolean(),
    allowDirectMessages: z.boolean(),
    showStats: z.boolean(),
  }),
  display: z.object({
    theme: z.enum(['LIGHT', 'DARK', 'SYSTEM']),
    language: z.string(),
    timezone: z.string(),
  }),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
})

type SettingsFormData = z.infer<typeof settingsSchema>
type PasswordFormData = z.infer<typeof passwordSchema>

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'notifications' | 'privacy' | 'security' | 'payments' | 'danger'>('general')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  
  const { user, logout } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: settings, isLoading } = useQuery({
    queryKey: ['user', 'settings'],
    queryFn: userApi.getSettings,
  })

  const { data: paymentMethods } = useQuery({
    queryKey: ['payment', 'methods'],
    queryFn: paymentApi.getPaymentMethods,
    enabled: activeTab === 'payments',
  })

  const updateSettingsMutation = useMutation({
    mutationFn: userApi.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', 'settings'] })
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: userApi.changePassword,
    onSuccess: () => {
      passwordForm.reset()
    },
  })

  const deleteAccountMutation = useMutation({
    mutationFn: userApi.deleteAccount,
    onSuccess: () => {
      logout()
    },
  })

  const settingsForm = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings || {
      notifications: {
        email: true,
        push: true,
        tournament: true,
        match: true,
        marketing: false,
      },
      privacy: {
        profileVisibility: 'PUBLIC',
        showOnlineStatus: true,
        allowDirectMessages: true,
        showStats: true,
      },
      display: {
        theme: 'SYSTEM',
        language: 'en',
        timezone: 'America/New_York',
      },
    },
  })

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
  })

  const onSettingsSubmit = (data: SettingsFormData) => {
    updateSettingsMutation.mutate(data)
  }

  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    })
  }

  const handleDeleteAccount = () => {
    if (showDeleteConfirm) {
      deleteAccountMutation.mutate()
    } else {
      setShowDeleteConfirm(true)
    }
  }

  const tabs = [
    { id: 'general', label: 'General', icon: CogIcon },
    { id: 'notifications', label: 'Notifications', icon: BellIcon },
    { id: 'privacy', label: 'Privacy', icon: EyeIcon },
    { id: 'security', label: 'Security', icon: ShieldCheckIcon },
    { id: 'payments', label: 'Payments', icon: CreditCardIcon },
    { id: 'danger', label: 'Danger Zone', icon: ExclamationTriangleIcon },
  ]

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-96">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <tab.icon className="w-5 h-5 mr-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          {activeTab === 'general' && (
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Display Settings
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Theme
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'LIGHT', label: 'Light', icon: SunIcon },
                        { value: 'DARK', label: 'Dark', icon: MoonIcon },
                        { value: 'SYSTEM', label: 'System', icon: ComputerDesktopIcon },
                      ].map((theme) => (
                        <label
                          key={theme.value}
                          className="relative flex cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
                        >
                          <input
                            {...settingsForm.register('display.theme')}
                            type="radio"
                            value={theme.value}
                            className="sr-only"
                          />
                          <div className="flex-1 text-center">
                            <theme.icon className="mx-auto h-6 w-6 mb-2" />
                            <div className="text-sm font-medium">{theme.label}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Language
                      </label>
                      <select {...settingsForm.register('display.language')} className="input w-full">
                        <option value="en">English</option>
                        <option value="es">Español</option>
                        <option value="fr">Français</option>
                        <option value="de">Deutsch</option>
                        <option value="pt">Português</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Timezone
                      </label>
                      <select {...settingsForm.register('display.timezone')} className="input w-full">
                        <option value="America/New_York">Eastern Time (ET)</option>
                        <option value="America/Chicago">Central Time (CT)</option>
                        <option value="America/Denver">Mountain Time (MT)</option>
                        <option value="America/Los_Angeles">Pacific Time (PT)</option>
                        <option value="Europe/London">GMT</option>
                        <option value="Europe/Paris">CET</option>
                        <option value="Asia/Tokyo">JST</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateSettingsMutation.isPending}
                  className="btn-primary"
                >
                  {updateSettingsMutation.isPending ? (
                    <>
                      <LoadingSpinner size="sm" className="mr-2" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'notifications' && (
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Notification Preferences
                </h2>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                      Delivery Methods
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center">
                        <input
                          {...settingsForm.register('notifications.email')}
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Email notifications
                        </label>
                      </div>
                      <div className="flex items-center">
                        <input
                          {...settingsForm.register('notifications.push')}
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Push notifications
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-base font-medium text-gray-900 dark:text-white mb-4">
                      Notification Types
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Tournament Updates
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            New tournaments, brackets, and results
                          </div>
                        </div>
                        <input
                          {...settingsForm.register('notifications.tournament')}
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Match Notifications
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Match schedules, results, and disputes
                          </div>
                        </div>
                        <input
                          {...settingsForm.register('notifications.match')}
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            Marketing
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Promotions, events, and platform updates
                          </div>
                        </div>
                        <input
                          {...settingsForm.register('notifications.marketing')}
                          type="checkbox"
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateSettingsMutation.isPending}
                  className="btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'privacy' && (
            <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)} className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Privacy Settings
                </h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Profile Visibility
                    </label>
                    <div className="space-y-3">
                      {[
                        { value: 'PUBLIC', label: 'Public', description: 'Anyone can view your profile' },
                        { value: 'FRIENDS_ONLY', label: 'Friends Only', description: 'Only friends can view your profile' },
                        { value: 'PRIVATE', label: 'Private', description: 'Only you can view your profile' },
                      ].map((option) => (
                        <label key={option.value} className="flex items-start">
                          <input
                            {...settingsForm.register('privacy.profileVisibility')}
                            type="radio"
                            value={option.value}
                            className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                          />
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {option.label}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {option.description}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Show Online Status
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Let others see when you're online
                        </div>
                      </div>
                      <input
                        {...settingsForm.register('privacy.showOnlineStatus')}
                        type="checkbox"
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Allow Direct Messages
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Allow other users to send you direct messages
                        </div>
                      </div>
                      <input
                        {...settingsForm.register('privacy.allowDirectMessages')}
                        type="checkbox"
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          Show Statistics
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Display your stats and achievements publicly
                        </div>
                      </div>
                      <input
                        {...settingsForm.register('privacy.showStats')}
                        type="checkbox"
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={updateSettingsMutation.isPending}
                  className="btn-primary"
                >
                  Save Changes
                </button>
              </div>
            </form>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Change Password
                </h2>

                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Current Password
                    </label>
                    <input
                      {...passwordForm.register('currentPassword')}
                      type="password"
                      className="input w-full"
                    />
                    {passwordForm.formState.errors.currentPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {passwordForm.formState.errors.currentPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      New Password
                    </label>
                    <input
                      {...passwordForm.register('newPassword')}
                      type="password"
                      className="input w-full"
                    />
                    {passwordForm.formState.errors.newPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {passwordForm.formState.errors.newPassword.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Confirm New Password
                    </label>
                    <input
                      {...passwordForm.register('confirmPassword')}
                      type="password"
                      className="input w-full"
                    />
                    {passwordForm.formState.errors.confirmPassword && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                        {passwordForm.formState.errors.confirmPassword.message}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={changePasswordMutation.isPending}
                      className="btn-primary"
                    >
                      {changePasswordMutation.isPending ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Changing...
                        </>
                      ) : (
                        <>
                          <KeyIcon className="w-4 h-4 mr-2" />
                          Change Password
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-6">
              <div className="card p-6">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Payment Methods
                </h2>

                {paymentMethods && paymentMethods.length > 0 ? (
                  <div className="space-y-4">
                    {paymentMethods.map((method: any) => (
                      <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex items-center">
                          <CreditCardIcon className="w-8 h-8 text-gray-400 mr-3" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">
                              •••• •••• •••• {method.last4}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {method.brand} • Expires {method.expiryMonth}/{method.expiryYear}
                            </div>
                          </div>
                        </div>
                        <button className="btn-outline text-sm border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400">
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <CreditCardIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      No payment methods
                    </h3>
                    <p className="text-gray-500 dark:text-gray-400 mb-4">
                      Add a payment method to enter paid tournaments
                    </p>
                  </div>
                )}

                <button className="btn-primary w-full">
                  Add Payment Method
                </button>
              </div>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="card p-6 border-red-200 dark:border-red-800">
                <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-6">
                  Danger Zone
                </h2>

                <div className="space-y-6">
                  <div className="border border-red-200 dark:border-red-800 rounded-lg p-4">
                    <h3 className="text-base font-medium text-red-600 dark:text-red-400 mb-2">
                      Delete Account
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Once you delete your account, there is no going back. This will permanently delete your account, 
                      tournament history, and all associated data.
                    </p>
                    
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="btn-outline border-red-300 text-red-600 hover:bg-red-50 dark:border-red-600 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        <TrashIcon className="w-4 h-4 mr-2" />
                        Delete Account
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="flex items-center">
                            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
                            <span className="text-sm font-medium text-red-800 dark:text-red-200">
                              Are you absolutely sure?
                            </span>
                          </div>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                            This action cannot be undone. This will permanently delete your account and remove your data from our servers.
                          </p>
                        </div>
                        
                        <div className="flex space-x-3">
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="btn-outline"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleDeleteAccount}
                            disabled={deleteAccountMutation.isPending}
                            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
                          >
                            {deleteAccountMutation.isPending ? (
                              <>
                                <LoadingSpinner size="sm" className="mr-2" />
                                Deleting...
                              </>
                            ) : (
                              'Yes, delete my account'
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}