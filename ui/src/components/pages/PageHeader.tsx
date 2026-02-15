import { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

interface PageHeaderProps {
    icon?: IconDefinition
    title: string
    subtitle: string
}

export default function PageHeader({ icon, title, subtitle }: PageHeaderProps) {
    return (
        <header className="mb-8">
            <h2 className="text-3xl font-bold text-neutral-600 dark:text-white tracking-tight flex items-center gap-3">
                {icon && (
                    <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center text-accent-primary">
                        <FontAwesomeIcon icon={icon} />
                    </div>
                )}
                {title}
            </h2>
            <p className="text-neutral-500 mt-2">{subtitle}</p>
        </header>
    )
}
