import { Link } from 'react-router-dom'
import { ArrowRightIcon, TrophyIcon, UserGroupIcon, ChartBarIcon, SparklesIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { tournamentApi } from '@/services/api'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const features = [
  {
    name: 'AI-Powered Tournaments',
    description: 'Smart bracket generation, automatic result validation, and tournament optimization using advanced AI.',
    icon: SparklesIcon,
  },
  {
    name: 'Live Streaming',
    description: 'Built-in streaming with OBS integration, real-time overlays, and automatic highlight detection.',
    icon: ChartBarIcon,
  },
  {
    name: 'Fair Competition',
    description: 'Decentralized arbitration system and community-driven dispute resolution for maximum fairness.',
    icon: TrophyIcon,
  },
  {
    name: 'Global Community',
    description: 'Connect with players worldwide, form teams, and compete in tournaments across all skill levels.',
    icon: UserGroupIcon,
  },
]

const stats = [
  { name: 'Active Tournaments', value: '50+' },
  { name: 'Registered Players', value: '10,000+' },
  { name: 'Matches Played', value: '25,000+' },
  { name: 'Prize Pool Distributed', value: '$100K+' },
]

export default function HomePage() {
  const { data: tournaments, isLoading } = useQuery({
    queryKey: ['tournaments', 'featured'],
    queryFn: () => tournamentApi.getTournaments({ limit: 6 }),
  })

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-white dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-16 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-6xl">
              The Future of{' '}
              <span className="gradient-primary bg-clip-text text-transparent">
                FIFA eSports
              </span>
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Experience the most advanced tournament platform for EA SPORTS FC 2025. 
              AI-powered features, real-time streaming, and fair competition await.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/tournaments"
                className="btn-primary text-lg px-8 py-3"
              >
                Join Tournament
                <ArrowRightIcon className="ml-2 h-5 w-5" />
              </Link>
              <Link
                to="/auth/register"
                className="btn-outline text-lg px-8 py-3"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
        
        {/* Background Pattern */}
        <div className="absolute inset-x-0 top-[calc(100%-13rem)] -z-10 transform-gpu overflow-hidden blur-3xl sm:top-[calc(100%-30rem)]">
          <div
            className="relative left-[calc(50%+3rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 bg-gradient-to-tr from-primary-400 to-blue-600 opacity-20 sm:left-[calc(50%+36rem)] sm:w-[72.1875rem]"
            style={{
              clipPath:
                'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
            }}
          />
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-50 dark:bg-gray-800 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-4">
            {stats.map((stat) => (
              <div key={stat.name} className="mx-auto flex max-w-xs flex-col gap-y-4">
                <dt className="text-base leading-7 text-gray-600 dark:text-gray-400">{stat.name}</dt>
                <dd className="order-first text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-5xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white dark:bg-gray-900 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-base font-semibold leading-7 text-primary-600 dark:text-primary-400">
              Revolutionary Features
            </h2>
            <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Everything you need to compete
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Our platform combines cutting-edge AI technology with seamless user experience 
              to deliver the ultimate eSports tournament platform.
            </p>
          </div>
          <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
            <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-2">
              {features.map((feature) => (
                <div key={feature.name} className="flex flex-col">
                  <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-gray-900 dark:text-white">
                    <feature.icon className="h-5 w-5 flex-none text-primary-600 dark:text-primary-400" aria-hidden="true" />
                    {feature.name}
                  </dt>
                  <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-gray-600 dark:text-gray-300">
                    <p className="flex-auto">{feature.description}</p>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>

      {/* Featured Tournaments */}
      <div className="bg-gray-50 dark:bg-gray-800 py-24">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
              Featured Tournaments
            </h2>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300">
              Join the latest tournaments and compete against players from around the world.
            </p>
          </div>
          
          <div className="mt-16">
            {isLoading ? (
              <div className="flex justify-center">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tournaments?.data?.slice(0, 6).map((tournament: any) => (
                  <Link
                    key={tournament.id}
                    to={`/tournaments/${tournament.id}`}
                    className="card p-6 hover:shadow-lg transition-all duration-200 hover:scale-105"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {tournament.name}
                        </h3>
                        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {tournament.description}
                        </p>
                      </div>
                      <span className="badge-primary ml-4">
                        {tournament.format}
                      </span>
                    </div>
                    
                    <div className="mt-4 flex items-center justify-between text-sm">
                      <div className="flex items-center text-gray-500 dark:text-gray-400">
                        <UserGroupIcon className="h-4 w-4 mr-1" />
                        {tournament._count?.participants || 0}/{tournament.maxParticipants}
                      </div>
                      {tournament.prizePool > 0 && (
                        <div className="flex items-center text-success-600 dark:text-success-400">
                          <TrophyIcon className="h-4 w-4 mr-1" />
                          ${tournament.prizePool}
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <span className={`badge ${
                        tournament.status === 'REGISTRATION_OPEN' ? 'badge-success' :
                        tournament.status === 'LIVE' ? 'badge-danger' :
                        'badge-primary'
                      }`}>
                        {tournament.status.replace('_', ' ')}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
            
            <div className="mt-10 text-center">
              <Link
                to="/tournaments"
                className="btn-primary"
              >
                View All Tournaments
                <ArrowRightIcon className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 dark:bg-primary-700">
        <div className="px-6 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to compete?
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-primary-200">
              Join thousands of players in the most advanced FIFA tournament platform. 
              Create your account and start your journey to becoming a champion.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/auth/register"
                className="rounded-md bg-white px-3.5 py-2.5 text-sm font-semibold text-primary-600 shadow-sm hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                Get started
              </Link>
              <Link
                to="/tournaments"
                className="text-sm font-semibold leading-6 text-white hover:text-primary-200"
              >
                Browse tournaments <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}