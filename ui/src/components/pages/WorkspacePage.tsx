import React from 'react';
import Page from './Page';

const WorkspacePage = () => {
    return (
        <Page
            title="Workspace"
            subtitle="Interact with your local files and environment."
        >
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <div className="max-w-md">
                    <h2 className="text-2xl font-bold mb-4">Workspace is Coming Soon</h2>
                    <p className="text-neutral-500 dark:text-neutral-400">
                        This area will eventually provide a powerful IDE-like experience for managing your workspace directly from OpenKiwi.
                    </p>
                </div>
            </div>
        </Page>
    );
};

export default WorkspacePage;
