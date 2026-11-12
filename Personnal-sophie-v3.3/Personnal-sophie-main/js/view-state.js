/* État volatil des vues : ne contient jamais les données utilisateur. */
export const ViewState = {
  goalCategory: 'Toutes', goalStatus: 'Tous',
  sportType: 'Tous', sportMetric: 'duration',
  projectView: 'cards', projectStatus: 'Tous',
  financeMonth: new Date().toISOString().slice(0, 7),
  calendarView: 'month', calendarCursor: new Date(),
  notificationTab: 'all', notificationType: 'Tous',
  journalType: 'Tous', settingsTab: 'general', reminderTab: 'today'
};
