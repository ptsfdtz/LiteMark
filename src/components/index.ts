// Barrel exports for components — import from 'src/components' for convenience
export { default as Editor } from './Editor/Editor';
export { default as KeyboardShortcuts } from './KeyboardShortcuts/KeyboardShortcuts';
export { default as Layout } from './Layout/Layout';
export { default as Preview } from './Preview/Preview';
export { default as RecentFilesSidebar } from './RecentFilesSidebar/RecentFilesSidebar';
export { default as Settings } from './Settings/Settings';
export { default as SettingsButton } from './SettingsButton/SettingsButton';
export { default as Toolbar } from './Toolbar/Toolbar';
export { default as WindowControls } from './WindowControls/WindowControls';

// also re-export some useful sub-components/hooks
export { default as CurrentFileName } from './Layout/components/CurrentFileName';
