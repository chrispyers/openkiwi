// import React from 'react';

// interface LabelProps {
//     children: React.ReactNode;
//     className?: string;
//     variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
//     size?: 'sm' | 'md' | 'lg';
// }

// const Label: React.FC<LabelProps> = ({
//     children,
//     className = '',
//     variant = 'primary',
//     size = 'md'
// }) => {
//     const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-200';

//     const sizeClasses = {
//         sm: 'px-2 py-0.5 text-xs rounded-md',
//         md: 'px-3 py-1 text-sm rounded-lg',
//         lg: 'px-4 py-1.5 text-base rounded-xl'
//     };

//     const variantClasses = {
//         primary: 'bg-accent-primary/10 backdrop-blur-sm text-accent-primary border border-accent-primary/20 shadow-sm shadow-accent-primary/5',
//         secondary: 'bg-neutral-100 dark:bg-white/5 text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/10',
//         outline: 'bg-transparent border border-neutral-300 dark:border-white/20 text-neutral-700 dark:text-neutral-300',
//         ghost: 'bg-transparent text-neutral-500 hover:bg-neutral-100 dark:hover:bg-white/5'
//     };

//     return (
//         <span className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
//             {children}
//         </span>
//     );
// };

// export default Label;
