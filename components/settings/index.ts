// Legacy exports (kept for backwards compatibility)
export { ProfileSettings } from "./profile-settings"
export { AISettings } from "./ai-settings"
export { OrganizationSettings } from "./organization-settings"
export { TagsSettings } from "./tags-settings"
export { LabelsSettings } from "./labels-settings"

// New dialog-based settings
export { SettingsDialog } from "./settings-dialog"
export { SettingsSidebar, type SettingsItemId } from "./settings-sidebar"
export { SettingSection, SettingRow, SettingsPaneHeader, PlaceholderPane } from "./setting-primitives"

// Settings panes
export * from "./panes"
