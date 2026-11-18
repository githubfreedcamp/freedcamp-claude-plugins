// Helpers for decoding `fc_fetch_notifications` responses into readable updates.
// Adapted from the Freedcamp web app's NotificationUtils. The mobx store, React icons,
// caching and API calls are dropped: every helper here is a pure function.
//
// Typical use:
//   const ctx = createNotificationContext(notificationsResponse, sessionResponse);
//   const digest = buildNotificationDigest(ctx, { sinceSeconds: ONE_DAY_SECONDS });

import {
  id_to_name,
  action_types,
  observed_action_types,
  APP_WIKI,
  APP_ITEM_NAMES_UNTRANSLATED,
  ASSIGNED_NOONE,
  ONE_MINUTE_SECONDS,
  ONE_HOUR_SECONDS,
  ONE_DAY_SECONDS,
  PRIORITY_NONE,
  PRIORITY_LOW,
  PRIORITY_MEDIUM,
  PRIORITY_HIGH,
} from './constants.js';

export { ONE_MINUTE_SECONDS, ONE_HOUR_SECONDS, ONE_DAY_SECONDS };

// Numeric action types by name, built from constants.js. ASSIGN and STATUS were only
// observed in real responses; ADD_INVITE has not appeared in a response yet.
const toActionIds = (typeMap) =>
  Object.fromEntries(Object.entries(typeMap).map(([id, name]) => [name.replace('ACTION_', ''), Number(id)]));

export const ACTION = { ...toActionIds(action_types), ...toActionIds(observed_action_types) };

export const ACTION_LABELS = {
  [ACTION.ADD]: 'created',
  [ACTION.EDIT]: 'edited',
  [ACTION.ASSIGN]: 'reassigned',
  [ACTION.COMMENT]: 'commented',
  [ACTION.ADD_VERSION]: 'new version',
  [ACTION.STATUS]: 'status change',
  [ACTION.ADD_INVITE]: 'invite',
};

// Order matters: it is the display order in the web app (getNotificationSections).
export const NOTIFICATION_SECTIONS = [
  { name: 'assigned', title: 'Items assigned to you' },
  { name: 'mentioned', title: 'Items you were mentioned in' },
  { name: 'response', title: 'Items response received or awaiting' },
  { name: 'involved', title: 'Items you are involved with' },
  { name: 'other', title: 'Other items notifications' },
];

export const PRIORITY_LABELS = {
  [PRIORITY_NONE]: 'None',
  [PRIORITY_LOW]: 'Low',
  [PRIORITY_MEDIUM]: 'Medium',
  [PRIORITY_HIGH]: 'High',
};

const NO_ONE_VALUES = new Set([ASSIGNED_NOONE, '', null, undefined]);

// "Calendar Event" -> "calendar event", "CRM record" stays "CRM record"
const toSentenceCase = (name) =>
  name
    .split(' ')
    .map((word) => (word === word.toUpperCase() ? word : word.toLowerCase()))
    .join(' ');

// ---------- Context ----------

/** Joins a notifications response with the session so ids resolve to names. */
export const createNotificationContext = (notificationsResponse, sessionResponse) => {
  const data = notificationsResponse?.data ?? notificationsResponse ?? {};
  const session = sessionResponse?.data ?? sessionResponse ?? {};
  const usersById = Object.fromEntries((session.users || []).map((u) => [u.user_id, u]));
  const projectsById = Object.fromEntries((session.projects || []).map((p) => [p.project_id, p]));
  return {
    notifications: data.notifications || [],
    properties: data.properties || {},
    hasMore: Boolean(data.meta?.has_more),
    currentUserId: session.user_id,
    timezone: usersById[session.user_id]?.timezone,
    usersById,
    projectsById,
  };
};

export const getUserName = (ctx, userId) => {
  const user = ctx.usersById[userId];
  if (!user) return `User ${userId}`;
  return user.full_name || `${user.first_name} ${user.last_name}`.trim() || user.email;
};

export const getAppName = (appId) => id_to_name[appId]?.name || `App ${appId}`;
/** Singular, lower-case item name for sentences: "created a task". */
export const getItemName = (appId) =>
  APP_ITEM_NAMES_UNTRANSLATED[appId] ? toSentenceCase(APP_ITEM_NAMES_UNTRANSLATED[appId]) : 'item';

export const getProjectInfo = (ctx, projectId) => {
  const project = ctx.projectsById[projectId];
  return {
    projectId,
    projectName: project?.project_name || `Project ${projectId}`,
    groupId: project?.group_id,
    groupName: project?.group_name,
  };
};

// ---------- Actions (getActionsReversed and friends) ----------

/** Newest action first. The API returns them oldest first. */
export const getActionsReversed = (notification) => (notification.actions || []).slice().reverse();

export const getActionByType = (notification, actionType) =>
  getActionsReversed(notification).find((action) => action.action_type === actionType);

/** Matches the web app: a notification with no actions still counts as 1. */
export const getNumActions = (notification) => (notification.actions || []).length || 1;

export const getLastActionTs = (notification) =>
  Math.max(0, ...(notification.actions || []).map((action) => action.action_ts));

export const hasCreatedAction = (notification) => Boolean(getActionByType(notification, ACTION.ADD));

export const hasNewWikiVersion = (notification) =>
  String(notification.app_id) === APP_WIKI && Boolean(getActionByType(notification, ACTION.ADD_VERSION));

export const getWikiVersionAuthorId = (notification) =>
  getActionByType(notification, ACTION.ADD_VERSION)?.user_id ?? null;

/** Comment text hides in changed_properties[0].new_value (as HTML). */
export const getCommentActionNewValue = (action) => action.changed_properties?.[0]?.new_value ?? '';

export const getNumAddedComments = (notification) => notification.comments_added_count || 0;

/** Add, comment, wiki-version and invite actions carry content in changed_properties, not real changes. */
export const shouldShowActionChangedProperties = (action) =>
  ![ACTION.ADD, ACTION.COMMENT, ACTION.ADD_VERSION, ACTION.ADD_INVITE].includes(action.action_type);

export const hasChangedProperties = (notification) =>
  Boolean(
    (notification.changed_properties || []).length ||
      getNumAddedComments(notification) ||
      hasCreatedAction(notification) ||
      hasNewWikiVersion(notification)
  );

export const getNumNotificationsText = (notification) => {
  const count = getNumActions(notification);
  return `${count} new notification${count === 1 ? '' : 's'}`;
};

// ---------- Properties (changed_properties) ----------

export const getPropertyLabel = (ctx, propertyName) =>
  ctx.properties[propertyName]?.label || 'Unknown property';

/** Text properties (title, description) hold HTML, so show "Updated" instead. */
export const isTextProperty = (ctx, propertyName) => ctx.properties[propertyName]?.type === 'text';

export const getChangedPropertyValues = (ctx, change) => {
  const isText = isTextProperty(ctx, change.property_name);
  return {
    initialValue: isText ? '' : change.old_value_human,
    finalValue: isText ? 'Updated' : change.new_value_human,
  };
};

export const formatChangedProperties = (ctx, changes = []) =>
  changes.map((change) => {
    const { initialValue, finalValue } = getChangedPropertyValues(ctx, change);
    const base = {
      property: change.property_name,
      label: getPropertyLabel(ctx, change.property_name),
      oldValue: initialValue,
      newValue: finalValue,
    };
    if (change.property_name === 'priority') {
      return {
        ...base,
        oldValue: initialValue ?? PRIORITY_LABELS[change.old_value],
        newValue: finalValue ?? PRIORITY_LABELS[change.new_value],
      };
    }
    if (change.property_name === 'assigned_to_id') {
      return {
        ...base,
        oldUserId: NO_ONE_VALUES.has(change.old_value) ? undefined : change.old_value,
        newUserId: NO_ONE_VALUES.has(change.new_value) ? undefined : change.new_value,
      };
    }
    return base;
  });

/** "Status: No Progress → Completed", "Description: Updated", "Ends: Sep 9, 2026". */
export const formatChangeLine = ({ label, oldValue, newValue }) => {
  if (oldValue && newValue) return `${label}: ${oldValue} → ${newValue}`;
  return `${label}: ${newValue || oldValue || 'Updated'}`;
};

// ---------- Text and time ----------

export const htmlToText = (html, maxLength = 200) => {
  const text = String(html ?? '')
    .replace(/<br\s*\/?>|<\/p>|<\/li>|<\/h\d>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
};

export const getCurrentTimestamp = () => Math.floor(Date.now() / 1000);

export const formatDateTime = (ts, timeZone) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(ts * 1000));

export const formatRelativeTime = (ts, now = getCurrentTimestamp()) => {
  const diff = Math.max(0, now - ts);
  if (diff < ONE_MINUTE_SECONDS) return 'just now';
  if (diff < ONE_HOUR_SECONDS) return `${Math.floor(diff / ONE_MINUTE_SECONDS)}m ago`;
  if (diff < ONE_DAY_SECONDS) return `${Math.floor(diff / ONE_HOUR_SECONDS)}h ago`;
  return `${Math.floor(diff / ONE_DAY_SECONDS)}d ago`;
};

// ---------- Filtering and grouping ----------

/** fc_fetch_notifications takes no parameters, so time windows are applied here. */
export const filterSince = (notifications, sinceTs) =>
  notifications.filter((n) => getLastActionTs(n) >= sinceTs);

/** Port of getUnreadNotifications plus the page filters that the notification data supports. */
export const filterNotifications = (ctx, { appId, projectId, groupId, section, neverSeen } = {}) =>
  ctx.notifications.filter(
    (n) =>
      (appId === undefined || String(n.app_id) === String(appId)) &&
      (projectId === undefined || String(n.project_id) === String(projectId)) &&
      (groupId === undefined || String(getProjectInfo(ctx, n.project_id).groupId) === String(groupId)) &&
      (section === undefined || n.section === section) &&
      (neverSeen === undefined || n.f_never_seen === neverSeen)
  );

/** Port of getNotificationSectionItems, for every section at once. */
export const groupBySection = (items) =>
  NOTIFICATION_SECTIONS.map((section) => ({
    ...section,
    items: items.filter((item) => (NOTIFICATION_SECTIONS.some((s) => s.name === item.section) ? item.section : 'other') === section.name),
  })).filter((section) => section.items.length);

// ---------- Describing ----------

export const describeAction = (ctx, notification, action) => {
  const by = getUserName(ctx, action.user_id);
  const base = {
    type: action.action_type,
    label: ACTION_LABELS[action.action_type] || `action ${action.action_type}`,
    ts: action.action_ts,
    userId: action.user_id,
    userName: by,
  };
  switch (action.action_type) {
    case ACTION.ADD:
      return { ...base, summary: `${by} created a ${getItemName(notification.app_id)}` };
    case ACTION.COMMENT:
      return { ...base, summary: `${by} commented: "${htmlToText(getCommentActionNewValue(action), 160)}"` };
    case ACTION.ADD_VERSION:
      return { ...base, summary: `${by} added a new wiki version` };
    case ACTION.ADD_INVITE:
      return { ...base, summary: `${by} sent an invite` };
    default: {
      const changes = shouldShowActionChangedProperties(action)
        ? formatChangedProperties(ctx, action.changed_properties)
        : [];
      const detail = changes.length ? changes.map(formatChangeLine).join('; ') : 'made an edit';
      return { ...base, changes, summary: `${by} ${changes.length ? 'changed' : ''} ${detail}`.replace(/\s+/g, ' ').trim() };
    }
  }
};

/** One readable object per notification. Actions are newest first and limited to sinceTs. */
export const describeNotification = (ctx, notification, { sinceTs = 0 } = {}) => {
  const actions = getActionsReversed(notification)
    .filter((action) => action.action_ts >= sinceTs)
    .map((action) => describeAction(ctx, notification, action));
  return {
    uid: notification.uid,
    appId: notification.app_id,
    appName: getAppName(notification.app_id),
    itemName: getItemName(notification.app_id),
    itemId: notification.item_id,
    title: notification.item_title,
    ...getProjectInfo(ctx, notification.project_id),
    section: notification.section,
    isNew: Boolean(notification.f_never_seen),
    canComment: Boolean(notification.f_can_add_comment),
    commentsAdded: getNumAddedComments(notification),
    countText: getNumNotificationsText(notification),
    lastActionTs: getLastActionTs(notification),
    actions,
  };
};

/**
 * Digest for daily/hourly updates. Pass sinceSeconds (ONE_HOUR_SECONDS, ONE_DAY_SECONDS)
 * to keep only activity in that window; omit it to cover the whole response.
 */
export const buildNotificationDigest = (ctx, { sinceSeconds, now = getCurrentTimestamp() } = {}) => {
  const sinceTs = sinceSeconds ? now - sinceSeconds : 0;
  const source = sinceTs ? filterSince(ctx.notifications, sinceTs) : ctx.notifications;
  const items = source
    .map((n) => describeNotification(ctx, n, { sinceTs }))
    .sort((a, b) => b.lastActionTs - a.lastActionTs);
  return {
    generatedAt: now,
    sinceTs: sinceTs || null,
    total: items.length,
    neverSeen: items.filter((item) => item.isNew).length,
    hasMore: ctx.hasMore,
    sections: groupBySection(items),
  };
};
