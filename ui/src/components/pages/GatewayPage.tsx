import { faServer } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import Page from './Page'

export default function GatewayPage() {
    return (
        <Page
            title="Gateway"
            subtitle="Manage your gateway connections and connected clients."
        >
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <div className="w-20 h-20 bg-bg-card border border-border-color rounded-3xl flex items-center justify-center mb-6 shadow-sm">
                    <FontAwesomeIcon
                        icon={faServer}
                        className="text-3xl text-accent-primary opacity-20"
                    />
                </div>
                <h3 className="text-xl font-bold text-neutral-600 dark:text-white mb-2">
                    Coming Soon
                </h3>
                <p className="max-w-md text-neutral-500 leading-relaxed">
                    We're working hard to bring you the best local AI management experience for your Gateway.
                </p>
            </div>
        </Page>
    )
}
