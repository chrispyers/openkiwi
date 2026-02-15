import { faCube } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

export default function ProvidersPage() {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
            <div className="w-20 h-20 bg-bg-card border border-border-color rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                <FontAwesomeIcon
                    icon={faCube}
                    className="text-3xl text-accent-primary opacity-20"
                />
            </div>
            <h2 className="text-3xl font-bold text-neutral-600 dark:text-white mb-2 tracking-tight transition-all duration-300">
                Providers
            </h2>
            <p className="max-w-md text-neutral-500 leading-relaxed">
                This section is coming soon. We're working hard to bring you the best local AI management experience for your Providers.
            </p>
        </div>
    )
}
