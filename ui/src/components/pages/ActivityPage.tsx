import React from 'react';
import Page from './Page';
import Text from '../Text';
import { faArrowsSpin } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

const ActivityPage: React.FC = () => {
    return (
        <Page
            title="Activity"
            subtitle="Monitor and manage active background tasks and processes."
        >
            <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-24 h-24 bg-accent-primary/10 rounded-full flex items-center justify-center mb-8 relative">
                    <div className="absolute inset-0 bg-accent-primary/20 rounded-full animate-ping opacity-20" />
                    <FontAwesomeIcon icon={faArrowsSpin} className="text-4xl text-accent-primary relative z-10" />
                </div>
                <Text size="3xl" bold={true} className="mb-4">Coming Soon</Text>
                <Text secondary={true} className="max-w-md text-lg leading-relaxed">
                    Coming soon: a powerful activity monitor. You'll be able to track agent thoughts, background processes, and system performance in real-time.
                </Text>
            </div>
        </Page>
    );
};

export default ActivityPage;
