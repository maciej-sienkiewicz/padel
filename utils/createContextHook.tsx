import { createContext, useContext } from 'react';

export default function createContextHook<T>(
    hookFn: () => T
): [React.FC<{ children: React.ReactNode }>, () => T] {
    const Context = createContext<T | undefined>(undefined);

    const Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
        const value = hookFn();
        return <Context.Provider value={value}>{children}</Context.Provider>;
    };

    const useHook = (): T => {
        const context = useContext(Context);
        if (context === undefined) {
            throw new Error('useHook must be used within Provider');
        }
        return context;
    };

    return [Provider, useHook];
}